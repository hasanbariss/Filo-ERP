(function () {
    'use strict';

    var state = { period: 'week', tab: 'analysis', rows: [], fuelRows: [], manualRows: [], bounds: null };

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>'"]/g, function (char) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char];
        });
    }

    function fmtNumber(value, digits) {
        return Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: digits || 0, maximumFractionDigits: digits || 0 });
    }

    function fmtMoney(value) {
        return '₺' + Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function fmtDate(value) {
        if (!value) return '—';
        var parts = String(value).slice(0, 10).split('-');
        return parts.length === 3 ? parts.reverse().join('.') : esc(value);
    }

    function setText(id, value) {
        var element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    function setProviderStatus(kind, label) {
        var element = document.getElementById('fuel-provider-status');
        if (!element) return;
        element.className = 'fuel-provider-status is-' + kind;
        element.innerHTML = '<span class="status-dot"></span><span>' + esc(label) + '</span>';
    }

    function periodLabel(bounds) {
        return fmtDate(bounds.start) + ' – ' + fmtDate(bounds.end);
    }

    async function safeQuery(query, optional) {
        try {
            var result = await query;
            if (result && result.error) {
                if (optional) return [];
                throw result.error;
            }
            return result && Array.isArray(result.data) ? result.data : [];
        } catch (error) {
            if (optional) return [];
            throw error;
        }
    }

    function getSessionToken() {
        return window.supabaseClient.auth.getSession().then(function (result) {
            return result && result.data && result.data.session ? result.data.session.access_token : null;
        }).catch(function () { return null; });
    }

    async function fetchInfoMobile(plates, current, previous) {
        var token = await getSessionToken();
        if (!token) throw new Error('InfoMobil için geçerli kullanıcı oturumu bulunamadı.');
        var allResults = [];
        var unmatched = [];
        var offset = 0;
        do {
            var response = await fetch('/api/infomobil', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                body: JSON.stringify({ plates: plates, current: { start: current.infoStart, end: current.infoEnd }, previous: { start: previous.infoStart, end: previous.infoEnd }, offset: offset })
            });
            var payload = await response.json().catch(function () { return {}; });
            if (!response.ok) throw new Error(payload.error || 'InfoMobil kilometreleri alınamadı.');
            allResults = allResults.concat(payload.results || []);
            unmatched = payload.unmatched || unmatched;
            offset = payload.nextOffset;
        } while (offset !== null && offset !== undefined);
        return { results: allResults, unmatched: unmatched };
    }

    function mileageMaps(payload) {
        var current = {};
        var previous = {};
        (payload && payload.results || []).forEach(function (row) {
            if (row.status !== 'ready') return;
            current[row.plate] = Number(row.currentKm) || 0;
            previous[row.plate] = Number(row.previousKm) || 0;
        });
        return { current: current, previous: previous };
    }

    function renderAnalysis(rows) {
        state.rows = rows;
        var query = String(document.getElementById('yakit-km-search')?.value || '').toLocaleLowerCase('tr-TR');
        var visible = rows.filter(function (row) { return String(row.plate).toLocaleLowerCase('tr-TR').includes(query); });
        var container = document.getElementById('yakit-km-container');
        setText('fuel-analysis-count', visible.length + ' araç');
        if (!container) return;
        if (!visible.length) {
            container.innerHTML = '<div class="empty-state"><span class="empty-state-icon"><i data-lucide="fuel"></i></span><strong>Bu dönemde gösterilecek araç yok</strong><p>Plaka filtresini veya seçili dönemi değiştirin.</p></div>';
            if (window.lucide) window.lucide.createIcons();
            return;
        }
        var tableRows = visible.map(function (row) {
            var change = row.changePercent;
            var changeClass = change === null ? 'is-neutral' : change > 10 ? 'is-danger' : change > 0 ? 'is-warning' : 'is-success';
            var changeLabel = change === null ? '—' : (change > 0 ? '+' : '') + fmtNumber(change, 1) + '%';
            return '<tr>' +
                '<td><strong class="fuel-plate">' + esc(row.plate) + '</strong></td>' +
                '<td class="is-number">' + (row.km > 0 ? fmtNumber(row.km, 1) + ' km' : '—') + '</td>' +
                '<td class="is-number">' + fmtNumber(row.liters, 2) + ' L</td>' +
                '<td class="is-number">' + fmtMoney(row.cost) + '</td>' +
                '<td class="is-number">' + (row.averageUnitPrice !== null ? fmtMoney(row.averageUnitPrice) : '—') + '</td>' +
                '<td class="is-number is-emphasis">' + (row.litersPer100Km !== null ? fmtNumber(row.litersPer100Km, 2) : '—') + '</td>' +
                '<td class="is-number">' + (row.costPerKm !== null ? fmtMoney(row.costPerKm) : '—') + '</td>' +
                '<td class="is-number">' + row.receiptCount + '</td>' +
                '<td class="is-number"><span class="fuel-change ' + changeClass + '">' + changeLabel + '</span></td>' +
                '</tr>';
        }).join('');
        container.innerHTML = '<div class="fuel-table-wrap"><table class="fuel-table"><thead><tr><th>Plaka</th><th class="is-number">Toplam KM</th><th class="is-number">Litre</th><th class="is-number">Yakıt Maliyeti</th><th class="is-number">Ort. Litre</th><th class="is-number">L/100 KM</th><th class="is-number">TL/KM</th><th class="is-number">Kayıt</th><th class="is-number">Önceki Dönem</th></tr></thead><tbody>' + tableRows + '</tbody></table></div>';
    }

    function renderKpis(rows, fuelRows) {
        var summary = window.FuelAnalytics.summarizeFuelRows(fuelRows);
        var totalKm = rows.reduce(function (sum, row) { return sum + Number(row.km || 0); }, 0);
        var consumption = window.FuelAnalytics.metrics(summary.liters, summary.cost, totalKm).litersPer100Km;
        var topKm = rows.filter(function (row) { return row.km > 0; }).sort(function (a, b) { return b.km - a.km; })[0];
        var topCost = rows.filter(function (row) { return row.cost > 0; }).sort(function (a, b) { return b.cost - a.cost; })[0];
        var topConsumption = rows.filter(function (row) { return row.litersPer100Km !== null; }).sort(function (a, b) { return b.litersPer100Km - a.litersPer100Km; })[0];
        setText('fuel-kpi-km', totalKm > 0 ? fmtNumber(totalKm, 1) + ' km' : '—');
        setText('fuel-kpi-litres', fmtNumber(summary.liters, 1) + ' L');
        setText('fuel-kpi-cost', fmtMoney(summary.cost));
        setText('fuel-kpi-consumption', consumption !== null ? fmtNumber(consumption, 2) + ' L' : '—');
        setText('fuel-kpi-top-km', topKm ? topKm.plate + ' · ' + fmtNumber(topKm.km, 0) + ' km' : '—');
        setText('fuel-kpi-top-cost', topCost ? topCost.plate + ' · ' + fmtMoney(topCost.cost) : '—');
        setText('fuel-kpi-top-consumption', topConsumption ? topConsumption.plate + ' · ' + fmtNumber(topConsumption.litersPer100Km, 1) + ' L' : '—');
    }

    function renderRecords(fuelRows, manualRows, vehicles) {
        var vehicleMap = new Map((vehicles || []).map(function (vehicle) { return [String(vehicle.id), vehicle.plaka]; }));
        setText('fuel-record-count', fuelRows.length + ' kayıt');
        var container = document.getElementById('fuel-records-container');
        if (!container) return;
        var fuelHtml = fuelRows.length ? '<div class="fuel-table-wrap"><table class="fuel-table"><thead><tr><th>Tarih</th><th>Plaka</th><th class="is-number">Litre</th><th class="is-number">Litre Fiyatı</th><th class="is-number">Toplam</th><th class="is-number">İşlem</th></tr></thead><tbody>' + fuelRows.map(function (row) {
            return '<tr><td>' + fmtDate(row.tarih) + '</td><td><strong class="fuel-plate">' + esc(vehicleMap.get(String(row.arac_id)) || row.araclar?.plaka || '—') + '</strong></td><td class="is-number">' + fmtNumber(row.litre, 2) + ' L</td><td class="is-number">' + fmtMoney(row.birim_fiyat) + '</td><td class="is-number is-emphasis">' + fmtMoney(row.toplam_tutar) + '</td><td class="is-number"><button class="btn-icon is-danger" onclick="deleteRecord(\'yakit_takip\', \'' + esc(row.id) + '\', \'fetchFuelAnalytics\')" aria-label="Yakıt kaydını sil"><i data-lucide="trash-2"></i></button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty-state compact"><strong>Bu dönemde yakıt kaydı yok</strong><p>Yeni kayıt ekleyebilir veya Excel’den aktarabilirsiniz.</p></div>';
        var manualHtml = manualRows.length ? '<div class="fuel-manual-block"><div class="fuel-section-head"><div><h3>Manuel KM Fişleri</h3><p>Eski manuel takip kayıtları korunur; tüketim hesabında InfoMobil KM kullanılır.</p></div><span class="badge badge-neutral">' + manualRows.length + ' kayıt</span></div><div class="fuel-manual-list">' + manualRows.map(function (row) {
            return '<div><span><strong>' + esc(row.araclar?.plaka || vehicleMap.get(String(row.arac_id)) || '—') + '</strong><small>' + fmtDate(row.tarih) + ' · ' + esc(row.sofor_adi || 'Şoför belirtilmemiş') + '</small></span><b>' + fmtNumber(row.kilometre, 0) + ' km</b></div>';
        }).join('') + '</div></div>' : '';
        container.innerHTML = fuelHtml + manualHtml;
        if (window.lucide) window.lucide.createIcons();
    }

    window.switchFuelAnalyticsTab = function (tab) {
        state.tab = ['analysis', 'records', 'receipts'].includes(tab) ? tab : 'analysis';
        document.querySelectorAll('[data-fuel-tab]').forEach(function (button) { button.classList.toggle('is-active', button.dataset.fuelTab === state.tab); });
        document.querySelectorAll('.fuel-panel').forEach(function (panel) { panel.classList.toggle('is-active', panel.id === 'fuel-panel-' + state.tab); });
    };

    window.setFuelAnalyticsPeriod = function (period) {
        state.period = period === 'month' ? 'month' : 'week';
        document.querySelectorAll('[data-fuel-period]').forEach(function (button) { button.classList.toggle('is-active', button.dataset.fuelPeriod === state.period); });
        window.fetchFuelAnalytics();
    };

    window.filterYakitKm = function () { renderAnalysis(state.rows); };

    window.fetchFuelAnalytics = async function () {
        var container = document.getElementById('yakit-km-container');
        if (!container || !window.FuelAnalytics || !window.supabaseClient) return;
        container.innerHTML = '<div class="loading-state">Yakıt ve kilometre verileri hazırlanıyor...</div>';
        setProviderStatus('loading', 'InfoMobil bağlanıyor');
        var anchor = document.getElementById('fuel-period-anchor');
        if (anchor && !anchor.value) anchor.value = window.FuelAnalytics.todayIstanbul();
        var bounds = window.FuelAnalytics.periodBounds(state.period, anchor && anchor.value);
        var previous = window.FuelAnalytics.previousBounds(bounds);
        state.bounds = bounds;
        setText('fuel-period-label', periodLabel(bounds));
        try {
            var results = await Promise.all([
                safeQuery(window.supabaseClient.from('araclar').select('id, plaka').order('plaka')),
                safeQuery(window.supabaseClient.from('yakit_takip').select('*').gte('tarih', bounds.start).lte('tarih', bounds.end).order('tarih', { ascending: false })),
                safeQuery(window.supabaseClient.from('yakit_takip').select('*').gte('tarih', previous.start).lte('tarih', previous.end)),
                safeQuery(window.supabaseClient.from('manuel_yakit_fisleri').select('*, araclar(plaka)').gte('tarih', bounds.start).lte('tarih', bounds.end).order('tarih', { ascending: false }), true)
            ]);
            var vehicles = results[0];
            var fuelRows = results[1];
            var previousFuelRows = results[2];
            var manualRows = results[3];
            state.fuelRows = fuelRows;
            state.manualRows = manualRows;
            window.allYakitKmRecords = manualRows;
            var infoPayload = null;
            try {
                infoPayload = await fetchInfoMobile(vehicles.map(function (vehicle) { return vehicle.plaka; }), bounds, previous);
                var ready = infoPayload.results.filter(function (row) { return row.status === 'ready'; }).length;
                setProviderStatus(ready > 0 ? 'ready' : 'warning', ready + ' araç eşleşti');
            } catch (infoError) {
                setProviderStatus('warning', infoError.message || 'InfoMobil kullanılamıyor');
            }
            var maps = mileageMaps(infoPayload);
            var rows = window.FuelAnalytics.aggregateByVehicle(fuelRows, vehicles, maps.current, previousFuelRows, maps.previous);
            renderKpis(rows, fuelRows);
            renderAnalysis(rows);
            renderRecords(fuelRows, manualRows, vehicles);
            if (window.lucide) window.lucide.createIcons();
        } catch (error) {
            console.error('[FUEL ANALYTICS]', error);
            setProviderStatus('error', 'Veri yüklenemedi');
            container.innerHTML = '<div class="error-state"><span class="empty-state-icon"><i data-lucide="triangle-alert"></i></span><strong>Yakıt analizi yüklenemedi</strong><p>' + esc(error.message || 'Bilinmeyen hata') + '</p><button class="btn-secondary" onclick="window.fetchFuelAnalytics()">Tekrar dene</button></div>';
            if (window.lucide) window.lucide.createIcons();
        }
    };

    document.addEventListener('DOMContentLoaded', function () {
        var anchor = document.getElementById('fuel-period-anchor');
        if (anchor && !anchor.value && window.FuelAnalytics) anchor.value = window.FuelAnalytics.todayIstanbul();
    });
})();
