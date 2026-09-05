(function () {
    'use strict';

    var state = { request: 0, period: 'month', tab: 'analysis', rows: [], fuelRows: [], vehicles: [], bounds: null };

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

    async function fuelRange(start, end) {
        var rows = [];
        for (var offset = 0; ; offset += 1000) {
            var batch = await safeQuery(window.supabaseClient.from('yakit_takip').select('*').gte('tarih', start).lte('tarih', end).order('tarih', {ascending:false}).order('id').range(offset, offset + 999));
            rows = rows.concat(batch);
            if (batch.length < 1000) return rows;
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

    window.fetchInfoMobileMileage = fetchInfoMobile;

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
        var availability = document.getElementById('fuel-analysis-availability')?.value || 'complete';
        var ownership = String(document.getElementById('fuel-analysis-ownership')?.value || '').toUpperCase();
        var sort = document.getElementById('fuel-analysis-sort')?.value || 'cost-desc';
        var visible = rows.filter(function (row) {
            var matchesQuery = String(row.plate).toLocaleLowerCase('tr-TR').includes(query);
            var matchesOwnership = !ownership || row.ownership === ownership;
            var matchesAvailability = availability === 'all' ||
                (availability === 'complete' && row.km > 0 && row.receiptCount > 0) ||
                (availability === 'km' && row.km > 0) ||
                (availability === 'fuel' && row.receiptCount > 0);
            return matchesQuery && matchesOwnership && matchesAvailability;
        });
        var sorters = {
            'cost-desc': function (a, b) { return b.cost - a.cost; },
            'km-desc': function (a, b) { return b.km - a.km; },
            'consumption-desc': function (a, b) { return Number(b.litersPer100Km || -1) - Number(a.litersPer100Km || -1); },
            'consumption-asc': function (a, b) { return Number(a.litersPer100Km == null ? Infinity : a.litersPer100Km) - Number(b.litersPer100Km == null ? Infinity : b.litersPer100Km); },
            'liters-desc': function (a, b) { return b.liters - a.liters; },
            'plate-asc': function (a, b) { return String(a.plate).localeCompare(String(b.plate), 'tr'); }
        };
        visible.sort(sorters[sort] || sorters['cost-desc']);
        var container = document.getElementById('yakit-km-container');
        setText('fuel-analysis-count', visible.length + ' araç');
        if (!container) return;
        if (!visible.length) {
            container.innerHTML = '<div class="empty-state"><span class="empty-state-icon"><i data-lucide="fuel"></i></span><strong>Bu dönemde gösterilecek araç yok</strong><p>Plaka filtresini veya seçili dönemi değiştirin.</p></div>';
            if (window.lucide) window.lucide.createIcons();
            return;
        }
        var tableRows = visible.map(function (row) {
            function changeBadge(change, metric) {
                var isConsumption = metric === 'consumption';
                var changeClass = 'is-neutral';
                if (change !== null && change !== 0) {
                    if (isConsumption) changeClass = change < 0 ? 'is-success' : change > 10 ? 'is-danger' : 'is-warning';
                    else changeClass = change > 0 ? 'is-increase' : 'is-decrease';
                }
                var changeLabel = change === null ? '—' : (change > 0 ? '+' : '') + fmtNumber(change, 1) + '%';
                var meaning = change === null ? 'Karşılaştırma yok' : change === 0 ? 'Değişmedi' :
                    isConsumption ? (change < 0 ? 'Alım / km azaldı' : 'Alım / km arttı') :
                    (change > 0 ? 'Daha fazla yol' : 'Daha az yol');
                return '<span class="fuel-change-detail"><span class="fuel-change ' + changeClass + '">' + changeLabel + '</span><small>' + meaning + '</small></span>';
            }
            var previousPeriodLabel = state.period === 'month' ? 'Önceki ay' : 'Önceki hafta';
            var efficiency;
            if (row.km <= 0 && row.receiptCount > 0) {
                efficiency = '<div class="fuel-efficiency-cell is-missing"><span class="badge badge-warning">KM verisi yok</span><small>Tüketim için GPS kilometresi gerekli</small></div>';
            } else if (row.receiptCount === 0) {
                efficiency = '<div class="fuel-efficiency-cell is-missing"><span class="badge badge-neutral">Yakıt kaydı yok</span><small>Bu dönem hesaplanamaz</small></div>';
            } else {
                efficiency = '<div class="fuel-efficiency-cell">' +
                    '<div class="fuel-efficiency-primary"><strong>' + fmtNumber(row.litersPer100Km, 2) + '</strong><span>L / 100 km</span></div>' +
                    '<div class="fuel-efficiency-breakdown"><span><b>KM maliyeti</b>' + (row.costPerKm !== null ? fmtMoney(row.costPerKm) + ' / km' : '—') + '</span>' +
                    '<span><b>Ort. litre</b>' + (row.averageUnitPrice !== null ? fmtMoney(row.averageUnitPrice) + ' / L' : '—') + '</span></div>' +
                    '<small class="fuel-efficiency-previous">' + previousPeriodLabel + ': ' + (row.previousLitersPer100Km !== null ? fmtNumber(row.previousLitersPer100Km, 2) + ' L / 100 km' : 'karşılaştırma verisi yok') + '</small>' +
                    '</div>';
            }
            return '<tr>' +
                '<td><strong class="fuel-plate">' + esc(row.plate) + '</strong><span class="fuel-owner">' + esc(row.ownership) + '</span></td>' +
                '<td class="is-number">' + (row.km > 0 ? fmtNumber(row.km, 1) + ' km' : '—') + '</td>' +
                '<td class="is-number fuel-stacked-value"><strong>' + fmtMoney(row.cost) + '</strong><span>' + fmtNumber(row.liters, 2) + ' L · ' + row.receiptCount + ' kayıt</span></td>' +
                '<td class="fuel-efficiency-column">' + efficiency + '</td>' +
                '<td class="is-number">' + changeBadge(row.kmChangePercent, 'km') + '</td>' +
                '<td class="is-number">' + changeBadge(row.consumptionChangePercent, 'consumption') + '</td>' +
                '</tr>';
        }).join('');
        var comparisonLabel = state.period === 'month' ? 'Önceki aya göre' : 'Önceki haftaya göre';
        container.innerHTML = '<p class="personnel-operation-note">Dönemsel yakıt alımı / 100 km: depo seviyesi bilinmediği için gerçek tüketimden farklı olabilir. Devam eden dönem, tamamlanmış önceki dönemle karşılaştırılır.</p><div class="fuel-table-wrap"><table class="fuel-table fuel-efficiency-table"><thead><tr><th>Araç</th><th class="is-number">Toplam KM</th><th class="is-number">Yakıt</th><th><span class="fuel-column-label">Tüketim ve KM Maliyeti<small>Seçili dönem değerleri</small></span></th><th class="is-number"><span class="fuel-column-label">KM Değişimi<small>' + comparisonLabel + '</small></span></th><th class="is-number"><span class="fuel-column-label">Tüketim Değişimi<small>' + comparisonLabel + '</small></span></th></tr></thead><tbody>' + tableRows + '</tbody></table></div>';
    }

    function renderKpis(rows, fuelRows) {
        var summary = window.FuelAnalytics.summarizeFuelRows(fuelRows);
        var totalKm = rows.reduce(function (sum, row) { return sum + Number(row.km || 0); }, 0);
        var comparable = rows.filter(function (row) { return row.km > 0 && row.receiptCount > 0; });
        var comparableKm = comparable.reduce(function (sum, row) { return sum + row.km; }, 0);
        var comparableLiters = comparable.reduce(function (sum, row) { return sum + row.liters; }, 0);
        var comparableCost = comparable.reduce(function (sum, row) { return sum + row.cost; }, 0);
        var fleetMetrics = window.FuelAnalytics.metrics(comparableLiters, comparableCost, comparableKm);
        var topKm = rows.filter(function (row) { return row.km > 0; }).sort(function (a, b) { return b.km - a.km; })[0];
        var topCost = rows.filter(function (row) { return row.cost > 0; }).sort(function (a, b) { return b.cost - a.cost; })[0];
        var topConsumption = rows.filter(function (row) { return row.litersPer100Km !== null; }).sort(function (a, b) { return b.litersPer100Km - a.litersPer100Km; })[0];
        var lowConsumption = rows.filter(function (row) { return row.litersPer100Km !== null; }).sort(function (a, b) { return a.litersPer100Km - b.litersPer100Km; })[0];
        setText('fuel-kpi-km', totalKm > 0 ? fmtNumber(totalKm, 1) + ' km' : '—');
        setText('fuel-kpi-litres', fmtNumber(summary.liters, 1) + ' L');
        setText('fuel-kpi-cost', fmtMoney(summary.cost));
        setText('fuel-kpi-consumption', fleetMetrics.litersPer100Km !== null ? fmtNumber(fleetMetrics.litersPer100Km, 2) + ' L / 100 km' : '—');
        setText('fuel-kpi-cost-per-km', fleetMetrics.costPerKm !== null ? fmtMoney(fleetMetrics.costPerKm) + ' / km' : '—');
        setText('fuel-kpi-top-km', topKm ? topKm.plate + ' · ' + fmtNumber(topKm.km, 0) + ' km' : '—');
        setText('fuel-kpi-top-cost', topCost ? topCost.plate + ' · ' + fmtMoney(topCost.cost) : '—');
        setText('fuel-kpi-top-consumption', topConsumption ? topConsumption.plate + ' · ' + fmtNumber(topConsumption.litersPer100Km, 1) + ' L/100 km' : '—');
        setText('fuel-kpi-low-consumption', lowConsumption ? lowConsumption.plate + ' · ' + fmtNumber(lowConsumption.litersPer100Km, 1) + ' L/100 km' : '—');
    }

    function renderRecords(fuelRows, vehicles) {
        var vehicleMap = new Map((vehicles || []).map(function (vehicle) { return [String(vehicle.id), vehicle.plaka]; }));
        var query = String(document.getElementById('yakit-km-search')?.value || '').toLocaleLowerCase('tr-TR');
        var selectedVehicle = String(document.getElementById('fuel-record-vehicle')?.value || '');
        var visible = (fuelRows || []).filter(function (row) {
            var plate = vehicleMap.get(String(row.arac_id)) || row.araclar?.plaka || '';
            return (!query || String(plate).toLocaleLowerCase('tr-TR').includes(query)) && (!selectedVehicle || String(row.arac_id) === selectedVehicle);
        });
        setText('fuel-record-count', visible.length + ' kayıt');
        var container = document.getElementById('fuel-records-container');
        if (!container) return;
        var fuelHtml = visible.length ? '<div class="fuel-table-wrap"><table class="fuel-table"><thead><tr><th>Tarih</th><th>Plaka</th><th class="is-number">Litre</th><th class="is-number">Litre Fiyatı</th><th class="is-number">Toplam</th><th class="is-number">İşlem</th></tr></thead><tbody>' + visible.map(function (row) {
            return '<tr><td>' + fmtDate(row.tarih) + '</td><td><strong class="fuel-plate">' + esc(vehicleMap.get(String(row.arac_id)) || row.araclar?.plaka || '—') + '</strong></td><td class="is-number">' + fmtNumber(row.litre, 2) + ' L</td><td class="is-number">' + fmtMoney(row.birim_fiyat) + '</td><td class="is-number is-emphasis">' + fmtMoney(row.toplam_tutar) + '</td><td class="is-number"><button class="btn-icon is-danger" onclick="deleteRecord(\'yakit_takip\', \'' + esc(row.id) + '\', \'fetchFuelAnalytics\')" aria-label="Yakıt kaydını sil"><i data-lucide="trash-2"></i></button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty-state compact"><strong>Bu dönemde yakıt kaydı yok</strong><p>Yeni kayıt ekleyebilir veya Excel’den aktarabilirsiniz.</p></div>';
        container.innerHTML = fuelHtml;
        if (window.lucide) window.lucide.createIcons();
    }

    window.switchFuelAnalyticsTab = function (tab) {
        state.tab = ['analysis', 'records', 'entry'].includes(tab) ? tab : 'analysis';
        document.querySelectorAll('[data-fuel-tab]').forEach(function (button) { button.classList.toggle('is-active', button.dataset.fuelTab === state.tab); });
        document.querySelectorAll('.fuel-panel').forEach(function (panel) { panel.classList.toggle('is-active', panel.id === 'fuel-panel-' + state.tab); });
        const activeButton = document.querySelector('[data-fuel-tab="' + state.tab + '"]');
        if (typeof window.setVisibleModuleBrowserTitle === 'function') window.setVisibleModuleBrowserTitle('module-yakit-km', 'Yakıt & KM', activeButton?.textContent);
    };

    window.setFuelAnalyticsPeriod = function (period) {
        state.period = period === 'month' ? 'month' : 'week';
        document.querySelectorAll('[data-fuel-period]').forEach(function (button) { button.classList.toggle('is-active', button.dataset.fuelPeriod === state.period); });
        window.fetchFuelAnalytics();
    };

    window.shiftFuelAnalyticsPeriod = function (direction) {
        var anchor = document.getElementById('fuel-period-anchor');
        var value = anchor && anchor.value ? anchor.value : window.FuelAnalytics.todayIstanbul();
        var date = new Date(value + 'T12:00:00Z');
        if (state.period === 'week') date.setUTCDate(date.getUTCDate() + Number(direction || 0) * 7);
        else { date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + Number(direction || 0)); }
        if (anchor) anchor.value = date.toISOString().slice(0, 10);
        window.fetchFuelAnalytics();
    };

    window.filterYakitKm = function () { renderAnalysis(state.rows); renderRecords(state.fuelRows, state.vehicles); };
    window.clearFuelAnalysisFilters = function () {
        var search = document.getElementById('yakit-km-search');
        var availability = document.getElementById('fuel-analysis-availability');
        var ownership = document.getElementById('fuel-analysis-ownership');
        var sort = document.getElementById('fuel-analysis-sort');
        if (search) search.value = '';
        if (availability) availability.value = 'complete';
        if (ownership) ownership.value = '';
        if (sort) sort.value = 'cost-desc';
        renderAnalysis(state.rows);
        renderRecords(state.fuelRows, state.vehicles);
    };
    window.filterFuelRecords = function () { renderRecords(state.fuelRows, state.vehicles); };
    window.clearFuelRecordFilters = function () {
        var search = document.getElementById('yakit-km-search');
        var vehicle = document.getElementById('fuel-record-vehicle');
        if (search) search.value = '';
        if (vehicle) vehicle.value = '';
        renderAnalysis(state.rows);
        renderRecords(state.fuelRows, state.vehicles);
    };

    window.fetchFuelAnalytics = async function () {
        var container = document.getElementById('yakit-km-container');
        if (!container || !window.FuelAnalytics || !window.supabaseClient) return;
        container.innerHTML = '<div class="loading-state">Yakıt ve kilometre verileri hazırlanıyor...</div>';
        setProviderStatus('loading', 'InfoMobil bağlanıyor');
        var anchor = document.getElementById('fuel-period-anchor');
        if (anchor && !anchor.value) anchor.value = window.FuelAnalytics.todayIstanbul();
        var request = ++state.request;
        var bounds = window.FuelAnalytics.periodBounds(state.period, anchor && anchor.value);
        var previous = window.FuelAnalytics.previousBounds(bounds);
        state.bounds = bounds;
        setText('fuel-period-label', periodLabel(bounds));
        try {
            var results = await Promise.all([
                safeQuery(window.supabaseClient.from('araclar').select('id, plaka, mulkiyet_durumu').order('plaka')),
                fuelRange(bounds.start, bounds.end),
                fuelRange(previous.start, previous.end)
            ]);
            if (request !== state.request) return;
            var vehicles = results[0];
            var fuelRows = results[1];
            var previousFuelRows = results[2];
            state.fuelRows = fuelRows;
            state.vehicles = vehicles;
            var vehicleSelect = document.getElementById('fuel-record-vehicle');
            if (vehicleSelect) {
                var selectedVehicle = vehicleSelect.value;
                vehicleSelect.innerHTML = '<option value="">Tüm araçlar</option>' + vehicles.map(function (vehicle) { return '<option value="' + esc(vehicle.id) + '">' + esc(vehicle.plaka) + '</option>'; }).join('');
                vehicleSelect.value = selectedVehicle;
            }
            var infoPayload = null;
            try {
                infoPayload = await fetchInfoMobile(vehicles.map(function (vehicle) { return vehicle.plaka; }), bounds, previous);
                if (request !== state.request) return;
                var ready = infoPayload.results.filter(function (row) { return row.status === 'ready'; }).length;
                var unmatchedCount = (infoPayload.unmatched || []).length;
                setProviderStatus(ready > 0 ? 'ready' : 'warning', ready + ' araç eşleşti · InfoMobil eşleşmesi olmayan araçlar: ' + unmatchedCount);
            } catch (infoError) {
                if (request !== state.request) return;
                setProviderStatus('warning', infoError.message || 'InfoMobil kullanılamıyor');
            }
            var maps = mileageMaps(infoPayload);
            var rows = window.FuelAnalytics.aggregateByVehicle(fuelRows, vehicles, maps.current, previousFuelRows, maps.previous);
            renderKpis(rows, fuelRows);
            renderAnalysis(rows);
            renderRecords(fuelRows, vehicles);
            if (window.lucide) window.lucide.createIcons();
        } catch (error) {
            if (request !== state.request) return;
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
