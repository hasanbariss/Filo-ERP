// ============================================================
// OPERASYON MERKEZİ
// Kârlılık, araç dosyası, şoför özeti, yedekleme ve hızlı giriş
// Mevcut puantaj/import akışından bağımsız, küçük ekranlarda da
// çalışacak şekilde tasarlanmıştır.
// ============================================================
(function () {
    'use strict';

    const PAGE_SIZE = 1000;
    const state = {
        month: '',
        tab: 'profit',
        data: null,
        dataMonth: '',
        vehicleId: '',
        loadVersion: 0,
    };

    function esc(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function number(value) {
        const parsed = Number(String(value ?? 0).replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function money(value) {
        return number(value).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
    }

    function shortNumber(value) {
        return number(value).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
    }

    function isoToday() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    function currentMonth() {
        return isoToday().slice(0, 7);
    }

    function monthBounds(month) {
        const match = String(month || '').match(/^(\d{4})-(\d{2})$/);
        const now = new Date();
        const year = match ? Number(match[1]) : now.getFullYear();
        const monthIndex = match ? Number(match[2]) - 1 : now.getMonth();
        const days = new Date(year, monthIndex + 1, 0).getDate();
        return {
            start: `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`,
            end: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`,
        };
    }

    function dateText(value) {
        if (!value) return '—';
        const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('tr-TR');
    }

    function monthText(value) {
        const parts = String(value || '').split('-');
        if (parts.length !== 2) return value || 'Seçili dönem';
        return new Date(Number(parts[0]), Number(parts[1]) - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    }

    function normalizeRegion(value, customerName) {
        const raw = String(value || '').toLocaleUpperCase('tr-TR');
        const customer = String(customerName || '').toLocaleUpperCase('tr-TR');
        if (customer.includes('DİKKAN') || customer.includes('DIKKAN')) return 'İzmir';
        if (raw.includes('İZMİR') || raw.includes('IZMIR')) return 'İzmir';
        return 'Manisa';
    }

    function periodMatches(value, month) {
        if (!value) return true;
        const normalized = String(value).trim().replaceAll('.', '-').replaceAll('/', '-');
        return normalized === month || normalized === `${month.slice(5)}-${month.slice(0, 4)}`;
    }

    function notify(type, message) {
        if (window.Toast && typeof window.Toast[type] === 'function') window.Toast[type](message);
        else if (type === 'error') alert(message);
    }

    function refreshIcons() {
        if (window.lucide) window.lucide.createIcons();
    }

    async function fetchRows(table, select, configure) {
        if (!window.supabaseClient) throw new Error('Veri tabanı bağlantısı hazır değil.');
        const rows = [];
        for (let offset = 0; ; offset += PAGE_SIZE) {
            let query = window.supabaseClient.from(table).select(select);
            if (configure) query = configure(query);
            const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
            if (error) throw new Error(error.message || `${table} verisi alınamadı.`);
            rows.push(...(data || []));
            if (!data || data.length < PAGE_SIZE) return rows;
        }
    }

    async function optionalRows(table, select, configure) {
        try {
            return await fetchRows(table, select, configure);
        } catch (error) {
            console.warn(`[Operasyon Merkezi] ${table} okunamadı:`, error.message || error);
            return [];
        }
    }

    async function getData(month, force) {
        if (!force && state.data && state.dataMonth === month) return state.data;
        const bounds = monthBounds(month);
        const results = await Promise.allSettled([
            fetchRows('musteri_servis_puantaj', '*', q => q.gte('tarih', bounds.start).lte('tarih', bounds.end)),
            fetchRows('musteriler', 'id, ad'),
            fetchRows('araclar', '*'),
            fetchRows('soforler', 'id, ad_soyad, telefon'),
            fetchRows('musteri_arac_tanimlari', '*'),
            fetchRows('yakit_takip', '*', q => q.gte('tarih', bounds.start).lte('tarih', bounds.end)),
            fetchRows('arac_bakimlari', '*', q => q.gte('islem_tarihi', bounds.start).lte('islem_tarihi', bounds.end)),
            fetchRows('taseron_hakedis', '*', q => q.gte('sefer_tarihi', bounds.start).lte('sefer_tarihi', bounds.end)),
        ]);
        const labels = ['puantaj', 'fabrikalar', 'araçlar', 'şoförler', 'fabrika-araç tanımları', 'yakıt', 'bakım', 'taşeron hakediş'];
        const errors = [];
        const list = results.map((result, index) => {
            if (result.status === 'fulfilled') return result.value || [];
            errors.push(labels[index]);
            console.warn(`[Operasyon Merkezi] ${labels[index]} yüklenemedi:`, result.reason);
            return [];
        });
        const data = {
            month,
            bounds,
            puantaj: list[0],
            customers: list[1],
            vehicles: list[2],
            drivers: list[3],
            assignments: list[4],
            fuel: list[5],
            maintenance: list[6],
            subcontractor: list[7],
            errors,
        };
        state.data = data;
        state.dataMonth = month;
        return data;
    }

    function customerMap(data) {
        return new Map((data.customers || []).map(item => [String(item.id), item.ad || 'İsimsiz fabrika']));
    }

    function vehicleMap(data) {
        return new Map((data.vehicles || []).map(item => [String(item.id), item]));
    }

    function driverMap(data) {
        return new Map((data.drivers || []).map(item => [String(item.id), item]));
    }

    function priceFor(row, data, customerName) {
        if (number(row.gunluk_ucret) > 0) return { amount: number(row.gunluk_ucret), source: 'Kayıtlı günlük ücret' };
        const rowRegion = normalizeRegion(row.bolge, customerName);
        const candidates = (data.assignments || [])
            .filter(item => String(item.musteri_id) === String(row.musteri_id) && String(item.arac_id) === String(row.arac_id))
            .map(item => {
                const itemRegion = item.bolge ? normalizeRegion(item.bolge, customerName) : '';
                const itemPeriod = item.donem ? periodMatches(item.donem, data.month) : true;
                if (!itemPeriod || (itemRegion && itemRegion !== rowRegion)) return null;
                let score = 10;
                if (itemRegion === rowRegion) score += 4;
                if (item.donem) score += 3;
                return { item, score };
            })
            .filter(Boolean)
            .sort((a, b) => b.score - a.score);
        const tariff = candidates[0]?.item;
        if (!tariff) return { amount: 0, source: '' };
        const amount =
            number(row.vardiya) * number(tariff.vardiya_fiyat) +
            number(row.tek) * number(tariff.tek_fiyat) +
            number(row.cikis_8) * number(tariff.cikis_8_fiyat) +
            number(row.giris_2030) * number(tariff.giris_2030_fiyat) +
            number(row.mesai) * number(tariff.mesai_fiyat);
        return { amount, source: 'Fabrika-araç tarifesi' };
    }

    function calculateProfitability(data) {
        const customers = customerMap(data);
        const recordsByVehicle = new Map();
        const rows = new Map();
        let unpricedRows = 0;

        (data.puantaj || []).forEach(record => {
            if (!record.musteri_id || !record.arac_id) return;
            const factoryId = String(record.musteri_id);
            const vehicleId = String(record.arac_id);
            const factoryName = customers.get(factoryId) || 'Tanımsız fabrika';
            const region = normalizeRegion(record.bolge, factoryName);
            const key = `${factoryId}::${region}`;
            const price = priceFor(record, data, factoryName);
            const serviceAmount = number(record.vardiya) + number(record.tek) + number(record.cikis_8) + number(record.giris_2030) + number(record.mesai);
            const isUnpriced = serviceAmount > 0 && price.amount <= 0;
            if (isUnpriced) unpricedRows += 1;
            if (!rows.has(key)) rows.set(key, {
                key, factoryId, factoryName, region, days: new Set(), vehicleCounts: new Map(), revenue: 0, cost: 0, unpriced: 0,
            });
            const item = rows.get(key);
            item.days.add(record.tarih);
            item.revenue += price.amount;
            if (isUnpriced) item.unpriced += 1;
            item.vehicleCounts.set(vehicleId, (item.vehicleCounts.get(vehicleId) || 0) + 1);
            if (!recordsByVehicle.has(vehicleId)) recordsByVehicle.set(vehicleId, new Map());
            recordsByVehicle.get(vehicleId).set(key, item);
        });

        function allocate(records, dateField, amountField) {
            (records || []).forEach(record => {
                const vehicleId = String(record.arac_id || '');
                const related = [...(recordsByVehicle.get(vehicleId)?.values() || [])];
                if (!related.length) return;
                const totalWeight = related.reduce((sum, item) => sum + (item.vehicleCounts.get(vehicleId) || 0), 0);
                if (!totalWeight) return;
                related.forEach(item => {
                    const weight = item.vehicleCounts.get(vehicleId) || 0;
                    item.cost += number(record[amountField]) * (weight / totalWeight);
                });
            });
        }
        allocate(data.fuel, 'tarih', 'toplam_tutar');
        allocate(data.maintenance, 'islem_tarihi', 'toplam_tutar');
        allocate(data.subcontractor, 'sefer_tarihi', 'net_hakedis');

        const rowsArray = [...rows.values()].map(item => ({
            ...item,
            dayCount: item.days.size,
            net: item.revenue - item.cost,
            margin: item.revenue > 0 ? ((item.revenue - item.cost) / item.revenue) * 100 : null,
        })).sort((a, b) => b.net - a.net || a.factoryName.localeCompare(b.factoryName, 'tr'));
        return {
            rows: rowsArray,
            revenue: rowsArray.reduce((sum, item) => sum + item.revenue, 0),
            cost: rowsArray.reduce((sum, item) => sum + item.cost, 0),
            unpricedRows,
        };
    }

    function renderProfitability(data) {
        const view = document.getElementById('om-panel');
        if (!view) return;
        const report = calculateProfitability(data);
        const net = report.revenue - report.cost;
        const margin = report.revenue > 0 ? (net / report.revenue) * 100 : 0;
        view.innerHTML = `
            <section class="om-section">
                <div class="om-summary-grid">
                    <article class="om-metric is-revenue"><span>Hesaplanan gelir</span><strong>${money(report.revenue)}</strong><small>Günlük ücret + tanımlı tarife</small></article>
                    <article class="om-metric is-cost"><span>Dağıtılmış maliyet</span><strong>${money(report.cost)}</strong><small>Yakıt, bakım ve hakediş</small></article>
                    <article class="om-metric is-net"><span>Net sonuç</span><strong>${money(net)}</strong><small>${shortNumber(margin)}% marj</small></article>
                    <article class="om-metric is-warning"><span>Fiyat kontrolü</span><strong>${report.unpricedRows}</strong><small>Tarifesi/ücreti olmayan satır</small></article>
                </div>
                <div class="om-note"><i data-lucide="info"></i><span>Araç ortak maliyetleri, seçili ayda o araçla çalışan fabrikalara puantaj kayıt adedi oranında dağıtılır. Bu nedenle maliyet sütunu muhasebe kesinliği değil, operasyonel karar desteğidir.</span></div>
                ${data.errors.length ? `<div class="om-inline-warning"><i data-lucide="triangle-alert"></i> Bazı kaynaklar okunamadı: ${esc(data.errors.join(', '))}. Görünen toplamlar eksik olabilir.</div>` : ''}
                <div class="om-table-card">
                    <div class="om-table-head"><div><h3>Fabrika kârlılığı</h3><p>${esc(monthText(data.month))} puantajına göre</p></div><span class="om-count-badge">${report.rows.length} fabrika/bölge</span></div>
                    <div class="om-table-wrap"><table class="om-table"><thead><tr><th>Fabrika</th><th>Gün</th><th>Gelir</th><th>Maliyet*</th><th>Net</th><th>Marj</th><th>Kontrol</th></tr></thead><tbody>
                        ${report.rows.length ? report.rows.map(item => `<tr>
                            <td><strong>${esc(item.factoryName)}</strong><span class="om-region-badge ${item.region === 'İzmir' ? 'is-izmir' : ''}">${esc(item.region)}</span></td>
                            <td>${item.dayCount}</td><td class="om-positive">${money(item.revenue)}</td><td>${money(item.cost)}</td>
                            <td class="${item.net >= 0 ? 'om-positive' : 'om-negative'}">${money(item.net)}</td>
                            <td>${item.margin === null ? '—' : `${shortNumber(item.margin)}%`}</td>
                            <td>${item.unpriced ? `<span class="om-status is-warning">${item.unpriced} fiyat yok</span>` : '<span class="om-status is-ok">Tamam</span>'}</td>
                        </tr>`).join('') : '<tr><td colspan="7" class="om-empty-cell">Seçili ay için hesaplanacak puantaj kaydı yok.</td></tr>'}
                    </tbody></table></div>
                    <p class="om-table-foot">* Yakıt, bakım ve taşeron hakedişleri araç çalışma yoğunluğuna göre dağıtılır.</p>
                </div>
            </section>`;
        refreshIcons();
    }

    async function renderVehicleFile(data) {
        const view = document.getElementById('om-panel');
        if (!view) return;
        const vehicles = [...(data.vehicles || [])].sort((a, b) => String(a.plaka || '').localeCompare(String(b.plaka || ''), 'tr'));
        if (!state.vehicleId || !vehicles.some(item => String(item.id) === String(state.vehicleId))) state.vehicleId = vehicles[0]?.id || '';
        view.innerHTML = `
            <section class="om-section">
                <div class="om-toolbar-card"><div><h3>Araç dosyası</h3><p>Seçili ayın operasyon özeti, evrak durumu ve zaman akışı.</p></div>
                    <label class="om-select-label">Araç <select id="om-vehicle-select" class="om-select">${vehicles.length ? vehicles.map(item => `<option value="${esc(item.id)}" ${String(item.id) === String(state.vehicleId) ? 'selected' : ''}>${esc(item.plaka || 'Plakasız araç')} ${item.marka_model ? `· ${esc(item.marka_model)}` : ''}</option>`).join('') : '<option value="">Araç bulunamadı</option>'}</select></label>
                </div>
                <div id="om-vehicle-detail" class="om-loading"><i data-lucide="loader-2" class="animate-spin"></i> Araç dosyası hazırlanıyor...</div>
            </section>`;
        document.getElementById('om-vehicle-select')?.addEventListener('change', event => {
            state.vehicleId = event.target.value;
            renderVehicleDetail(data, state.vehicleId);
        });
        refreshIcons();
        await renderVehicleDetail(data, state.vehicleId);
    }

    async function renderVehicleDetail(data, vehicleId) {
        const container = document.getElementById('om-vehicle-detail');
        if (!container) return;
        const vehicle = vehicleMap(data).get(String(vehicleId));
        if (!vehicle) {
            container.innerHTML = '<div class="om-empty">Görüntülenecek araç bulunamadı.</div>';
            return;
        }
        const customers = customerMap(data);
        const drivers = driverMap(data);
        const [policies, documents] = await Promise.all([
            optionalRows('arac_policeler', '*', q => q.eq('arac_id', vehicleId)),
            optionalRows('evraklar', '*', q => q.eq('ilgili_id', vehicleId)),
        ]);
        if (String(state.vehicleId) !== String(vehicleId)) return;
        const puantaj = (data.puantaj || []).filter(item => String(item.arac_id) === String(vehicleId));
        const fuel = (data.fuel || []).filter(item => String(item.arac_id) === String(vehicleId));
        const maintenance = (data.maintenance || []).filter(item => String(item.arac_id) === String(vehicleId));
        const factoryNames = [...new Set(puantaj.map(item => customers.get(String(item.musteri_id)) || 'Tanımsız fabrika'))];
        const driver = drivers.get(String(vehicle.sofor_id));
        const expiry = [
            ['Vize', vehicle.vize_bitis], ['Sigorta', vehicle.sigorta_bitis], ['Kasko', vehicle.kasko_bitis], ['Koltuk ferdi kaza', vehicle.koltuk_bitis],
            ...policies.map(item => [item.police_turu || 'Poliçe', item.bitis_tarihi]),
        ].filter(item => item[1]).sort((a, b) => String(a[1]).localeCompare(String(b[1])));
        const timeline = [
            ...puantaj.map(item => ({ date: item.tarih, type: 'Puantaj', icon: 'calendar-check', text: `${customers.get(String(item.musteri_id)) || 'Tanımsız fabrika'} · ${shortNumber(number(item.vardiya) + number(item.tek) + number(item.cikis_8) + number(item.giris_2030) + number(item.mesai))} işlem` })),
            ...fuel.map(item => ({ date: item.tarih, type: 'Yakıt', icon: 'fuel', text: money(item.toplam_tutar) })),
            ...maintenance.map(item => ({ date: item.islem_tarihi, type: item.islem_turu || 'Bakım', icon: 'wrench', text: `${item.aciklama || 'Bakım kaydı'} · ${money(item.toplam_tutar)}` })),
            ...documents.map(item => ({ date: item.bitis_tarihi || item.baslangic_tarihi, type: item.evrak_turu || 'Evrak', icon: 'file-text', text: item.notlar || 'Araç evrakı' })),
        ].filter(item => item.date).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 16);
        const today = isoToday();
        container.innerHTML = `
            <div class="om-vehicle-hero">
                <div><span class="om-kicker">ARAÇ DOSYASI</span><h2>${esc(vehicle.plaka || 'Plakasız araç')}</h2><p>${esc(vehicle.marka_model || 'Marka/model kaydı yok')} · ${esc(vehicle.mulkiyet_durumu || 'Sahiplik bilgisi yok')}</p></div>
                <button type="button" id="om-open-vehicle" class="om-secondary-button"><i data-lucide="external-link"></i> Araç kartını aç</button>
            </div>
            <div class="om-summary-grid is-vehicle">
                <article class="om-metric"><span>Puantaj günü</span><strong>${new Set(puantaj.map(item => item.tarih)).size}</strong><small>${factoryNames.length} fabrikada çalışma</small></article>
                <article class="om-metric"><span>Yakıt</span><strong>${money(fuel.reduce((sum, item) => sum + number(item.toplam_tutar), 0))}</strong><small>${fuel.length} kayıt</small></article>
                <article class="om-metric"><span>Bakım</span><strong>${money(maintenance.reduce((sum, item) => sum + number(item.toplam_tutar), 0))}</strong><small>${maintenance.length} kayıt</small></article>
                <article class="om-metric"><span>Atanan şoför</span><strong class="om-name-metric">${esc(driver?.ad_soyad || 'Atanmamış')}</strong><small>${esc(driver?.telefon || 'Telefon kaydı yok')}</small></article>
            </div>
            <div class="om-split-grid">
                <article class="om-panel-card"><div class="om-panel-title"><h3>Çalıştığı fabrikalar</h3><i data-lucide="building-2"></i></div>
                    ${factoryNames.length ? `<div class="om-chip-list">${factoryNames.map(name => `<span>${esc(name)}</span>`).join('')}</div>` : '<p class="om-muted">Seçili ayda puantaj kaydı yok.</p>'}
                    <dl class="om-details"><div><dt>Güncel KM</dt><dd>${shortNumber(vehicle.guncel_km)} km</dd></div><div><dt>Şirket</dt><dd>${esc(vehicle.sirket || vehicle.firma_adi || '—')}</dd></div><div><dt>Kira bedeli</dt><dd>${number(vehicle.kira_bedeli) ? money(vehicle.kira_bedeli) : '—'}</dd></div></dl>
                </article>
                <article class="om-panel-card"><div class="om-panel-title"><h3>Evrak ve poliçe durumu</h3><i data-lucide="shield-check"></i></div>
                    <div class="om-expiry-list">${expiry.length ? expiry.slice(0, 6).map(item => { const overdue = String(item[1]) < today; const days = Math.ceil((new Date(`${item[1]}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000); return `<div><span>${esc(item[0])}</span><strong class="${overdue || days <= 30 ? 'om-negative' : ''}">${dateText(item[1])}${overdue ? ' · geçti' : days <= 30 ? ` · ${days} gün` : ''}</strong></div>`; }).join('') : '<p class="om-muted">Bitiş tarihi bulunan evrak/poliçe kaydı yok.</p>'}</div>
                </article>
            </div>
            <article class="om-panel-card"><div class="om-panel-title"><h3>Son hareketler</h3><i data-lucide="clock-3"></i></div>
                <div class="om-timeline">${timeline.length ? timeline.map(item => `<div><i data-lucide="${esc(item.icon)}"></i><span><strong>${esc(item.type)}</strong><small>${esc(item.text)}</small></span><time>${dateText(item.date)}</time></div>`).join('') : '<p class="om-muted">Seçili ay için hareket kaydı yok.</p>'}</div>
            </article>`;
        document.getElementById('om-open-vehicle')?.addEventListener('click', () => {
            if (typeof window.openAracDetay === 'function') window.openAracDetay(vehicleId);
            else notify('info', 'Araç kartı bu sürümde açılamıyor.');
        });
        refreshIcons();
    }

    async function renderDriverPerformance(data) {
        const view = document.getElementById('om-panel');
        if (!view) return;
        view.innerHTML = '<div class="om-loading"><i data-lucide="loader-2" class="animate-spin"></i> Şoför performansı hesaplanıyor...</div>';
        refreshIcons();
        const advances = await optionalRows('sofor_avans_kesinti', '*', q => q.gte('tarih', data.bounds.start).lte('tarih', data.bounds.end));
        const customers = customerMap(data);
        const vehiclesByDriver = new Map();
        (data.vehicles || []).forEach(vehicle => {
            if (!vehicle.sofor_id) return;
            if (!vehiclesByDriver.has(String(vehicle.sofor_id))) vehiclesByDriver.set(String(vehicle.sofor_id), []);
            vehiclesByDriver.get(String(vehicle.sofor_id)).push(vehicle);
        });
        const advanceByDriver = new Map();
        advances.forEach(item => advanceByDriver.set(String(item.sofor_id), (advanceByDriver.get(String(item.sofor_id)) || 0) + number(item.tutar)));
        const rows = (data.drivers || []).map(driver => {
            const vehicles = vehiclesByDriver.get(String(driver.id)) || [];
            const vehicleIds = new Set(vehicles.map(item => String(item.id)));
            const works = (data.puantaj || []).filter(item => vehicleIds.has(String(item.arac_id)));
            const days = new Set(works.map(item => item.tarih));
            const factories = new Set(works.map(item => customers.get(String(item.musteri_id)) || 'Tanımsız fabrika'));
            const services = works.reduce((sum, item) => sum + number(item.vardiya) + number(item.tek) + number(item.cikis_8) + number(item.giris_2030) + number(item.mesai), 0);
            return { driver, vehicles, days: days.size, factories: factories.size, services, advance: advanceByDriver.get(String(driver.id)) || 0 };
        }).filter(item => item.vehicles.length || item.days).sort((a, b) => b.days - a.days || b.services - a.services || String(a.driver.ad_soyad).localeCompare(String(b.driver.ad_soyad), 'tr'));
        view.innerHTML = `
            <section class="om-section"><div class="om-toolbar-card"><div><h3>Şoför performans özeti</h3><p>Mevcut araç atamasına göre seçili ay puantajı ile hazırlanır.</p></div><span class="om-count-badge">${rows.length} şoför</span></div>
                <div class="om-note"><i data-lucide="info"></i><span>Şoför atama geçmişi ayrı tutulmadığı için geçmiş puantaj, aracın bugünkü şoför atamasına göre özetlenir. Araç değişikliklerinde bu notu dikkate alın.</span></div>
                <div class="om-table-card"><div class="om-table-wrap"><table class="om-table"><thead><tr><th>Şoför</th><th>Mevcut araç</th><th>Çalışma günü</th><th>İşlem</th><th>Fabrika</th><th>Avans/kesinti</th></tr></thead><tbody>
                    ${rows.length ? rows.map(item => `<tr><td><strong>${esc(item.driver.ad_soyad || 'İsimsiz şoför')}</strong><small class="om-inline-small">${esc(item.driver.telefon || 'Telefon yok')}</small></td><td>${item.vehicles.length ? item.vehicles.map(vehicle => `<span class="om-plate">${esc(vehicle.plaka || 'Plakasız')}</span>`).join('') : '—'}</td><td>${item.days}</td><td>${shortNumber(item.services)}</td><td>${item.factories}</td><td>${item.advance ? money(item.advance) : '—'}</td></tr>`).join('') : '<tr><td colspan="6" class="om-empty-cell">Araç ataması veya seçili ay puantajı olan şoför bulunamadı.</td></tr>'}
                </tbody></table></div></div></section>`;
        refreshIcons();
    }

    function toFlatRows(rows) {
        return (rows || []).map(row => Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key, value && typeof value === 'object' ? JSON.stringify(value) : value ?? ''])));
    }

    function downloadBlob(content, filename, type) {
        const url = URL.createObjectURL(new Blob([content], { type }));
        const anchor = document.createElement('a');
        anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 500);
    }

    async function collectBackup(month, full) {
        const bounds = monthBounds(month);
        const results = await Promise.all([
            fetchRows('araclar', '*'), fetchRows('soforler', '*'), fetchRows('musteriler', '*'),
            fetchRows('musteri_arac_tanimlari', '*'),
            fetchRows('musteri_servis_puantaj', '*', q => full ? q : q.gte('tarih', bounds.start).lte('tarih', bounds.end)),
            fetchRows('yakit_takip', '*', q => full ? q : q.gte('tarih', bounds.start).lte('tarih', bounds.end)),
            fetchRows('arac_bakimlari', '*', q => full ? q : q.gte('islem_tarihi', bounds.start).lte('islem_tarihi', bounds.end)),
            fetchRows('taseron_hakedis', '*', q => full ? q : q.gte('sefer_tarihi', bounds.start).lte('sefer_tarihi', bounds.end)),
            optionalRows('arac_policeler', '*'),
        ]);
        return {
            metadata: { exported_at: new Date().toISOString(), scope: full ? 'tam' : month, application: 'Baris.Flow' },
            araclar: results[0], soforler: results[1], fabrikalar: results[2], fabrika_arac_tanimlari: results[3],
            puantaj: results[4], yakit: results[5], bakim: results[6], taseron_hakedis: results[7], policeler: results[8],
        };
    }

    async function runBackup(button, type) {
        const original = button.innerHTML;
        button.disabled = true; button.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> Hazırlanıyor...'; refreshIcons();
        try {
            const full = type === 'full-excel' || type === 'full-json';
            const backup = await collectBackup(state.month, full);
            const scope = full ? `tam_${isoToday()}` : state.month;
            if (type.endsWith('json')) {
                downloadBlob(JSON.stringify(backup, null, 2), `filo-erp-yedek_${scope}.json`, 'application/json;charset=utf-8');
            } else {
                if (!window.XLSX) throw new Error('Excel dışa aktarma kütüphanesi henüz hazır değil.');
                const book = window.XLSX.utils.book_new();
                Object.entries(backup).filter(([key]) => key !== 'metadata').forEach(([key, rows]) => {
                    const sheet = window.XLSX.utils.json_to_sheet(toFlatRows(rows));
                    window.XLSX.utils.book_append_sheet(book, sheet, key.slice(0, 31));
                });
                const info = window.XLSX.utils.json_to_sheet([backup.metadata]);
                window.XLSX.utils.book_append_sheet(book, info, 'Yedek Bilgisi');
                window.XLSX.writeFile(book, `filo-erp-yedek_${scope}.xlsx`);
            }
            notify('success', 'Yedek dosyası indirildi. Güvenli bir yerde saklayın.');
        } catch (error) {
            console.error('[Operasyon Merkezi] yedek hatası:', error);
            notify('error', `Yedek hazırlanamadı: ${error.message || 'Bilinmeyen hata'}`);
        } finally {
            button.disabled = false; button.innerHTML = original; refreshIcons();
        }
    }

    function renderBackupCenter() {
        const view = document.getElementById('om-panel');
        if (!view) return;
        view.innerHTML = `
            <section class="om-section"><div class="om-toolbar-card"><div><h3>Yedekleme merkezi</h3><p>Verinizi tarayıcınızdan indirir; hiçbir dosya harici bir servise gönderilmez.</p></div><span class="om-count-badge">Salt okunur</span></div>
                <div class="om-backup-grid">
                    <article class="om-panel-card"><i data-lucide="calendar-days" class="om-card-icon"></i><h3>${esc(monthText(state.month))} operasyon yedeği</h3><p>Bu ayın puantaj, yakıt, bakım ve hakediş kayıtları ile kart bilgileri.</p><button type="button" class="om-primary-button" data-backup="month-excel"><i data-lucide="file-spreadsheet"></i> Excel indir</button></article>
                    <article class="om-panel-card"><i data-lucide="database-backup" class="om-card-icon"></i><h3>Tam Excel yedeği</h3><p>Tüm kayıtlı operasyon verilerini sekmeli Excel dosyası olarak dışa aktarır.</p><button type="button" class="om-secondary-button" data-backup="full-excel"><i data-lucide="download"></i> Tam yedek indir</button></article>
                    <article class="om-panel-card"><i data-lucide="braces" class="om-card-icon"></i><h3>JSON arşivi</h3><p>Teknik geri yükleme ve arşivleme için yapılandırılmış tam veri çıktısı.</p><button type="button" class="om-secondary-button" data-backup="full-json"><i data-lucide="file-json"></i> JSON indir</button></article>
                </div>
                <div class="om-inline-warning"><i data-lucide="shield-alert"></i> Bu dışa aktarım, uygulama verilerinin kopyasıdır. Supabase proje ayarları, kullanıcı erişimleri ve depolama dosyaları bu pakete dahil değildir.</div>
            </section>`;
        view.querySelectorAll('[data-backup]').forEach(button => button.addEventListener('click', () => runBackup(button, button.dataset.backup)));
        refreshIcons();
    }

    function quickFactories(data, region) {
        const byId = customerMap(data);
        const assigned = new Set((data.assignments || []).filter(item => normalizeRegion(item.bolge, byId.get(String(item.musteri_id))) === region).map(item => String(item.musteri_id)));
        const source = assigned.size ? (data.customers || []).filter(item => assigned.has(String(item.id))) : (data.customers || []).filter(item => normalizeRegion('', item.ad) === region);
        return source.sort((a, b) => String(a.ad).localeCompare(String(b.ad), 'tr'));
    }

    function fillQuickVehicles(data) {
        const region = document.getElementById('om-quick-region')?.value || 'Manisa';
        const factoryId = document.getElementById('om-quick-factory')?.value;
        const vehicleSelect = document.getElementById('om-quick-vehicle');
        const message = document.getElementById('om-quick-vehicle-message');
        if (!vehicleSelect) return;
        const customerName = customerMap(data).get(String(factoryId));
        const allowedIds = new Set((data.assignments || []).filter(item => String(item.musteri_id) === String(factoryId) && normalizeRegion(item.bolge, customerName) === region).map(item => String(item.arac_id)));
        const vehicles = (data.vehicles || []).filter(item => allowedIds.has(String(item.id))).sort((a, b) => String(a.plaka).localeCompare(String(b.plaka), 'tr'));
        vehicleSelect.innerHTML = vehicles.length
            ? '<option value="">Araç seçin</option>' + vehicles.map(item => `<option value="${esc(item.id)}">${esc(item.plaka || 'Plakasız araç')}${item.marka_model ? ` · ${esc(item.marka_model)}` : ''}</option>`).join('')
            : '<option value="">Bağlı araç bulunamadı</option>';
        vehicleSelect.disabled = !vehicles.length;
        if (message) message.textContent = factoryId ? (vehicles.length ? `${vehicles.length} bağlı araç listelendi.` : 'Bu fabrika/bölge için araç tanımı bulunamadı. Önce fabrika kartından tanımlayın.') : 'Önce fabrika seçin.';
    }

    function fillQuickFactories(data) {
        const region = document.getElementById('om-quick-region')?.value || 'Manisa';
        const factorySelect = document.getElementById('om-quick-factory');
        if (!factorySelect) return;
        const factories = quickFactories(data, region);
        factorySelect.innerHTML = `<option value="">Fabrika seçin</option>${factories.map(item => `<option value="${esc(item.id)}">${esc(item.ad || 'İsimsiz fabrika')}</option>`).join('')}`;
        fillQuickVehicles(data);
    }

    async function saveQuickEntry(data, button) {
        const date = document.getElementById('om-quick-date')?.value;
        const region = document.getElementById('om-quick-region')?.value;
        const factoryId = document.getElementById('om-quick-factory')?.value;
        const vehicleId = document.getElementById('om-quick-vehicle')?.value;
        const vardiya = number(document.getElementById('om-quick-vardiya')?.value);
        const tek = number(document.getElementById('om-quick-tek')?.value);
        if (!date || !region || !factoryId || !vehicleId) return notify('error', 'Tarih, bölge, fabrika ve araç seçimi zorunlu.');
        if (vardiya < 0 || tek < 0 || (!vardiya && !tek)) return notify('error', 'En az bir vardiya veya tek servisi girin.');
        const allowed = (data.assignments || []).some(item => String(item.musteri_id) === String(factoryId) && String(item.arac_id) === String(vehicleId) && normalizeRegion(item.bolge, customerMap(data).get(String(factoryId))) === region);
        if (!allowed) return notify('error', 'Bu araç seçilen fabrika ve bölgeye tanımlı değil.');
        const original = button.innerHTML;
        button.disabled = true; button.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> Kaydediliyor...'; refreshIcons();
        try {
            const { data: existing, error: readError } = await window.supabaseClient.from('musteri_servis_puantaj').select('id').eq('musteri_id', factoryId).eq('arac_id', vehicleId).eq('tarih', date).eq('bolge', region).limit(1);
            if (readError) throw readError;
            let result;
            if (existing?.length) result = await window.supabaseClient.from('musteri_servis_puantaj').update({ vardiya, tek }).eq('id', existing[0].id);
            else result = await window.supabaseClient.from('musteri_servis_puantaj').insert([{ musteri_id: factoryId, arac_id: vehicleId, tarih: date, bolge: region, vardiya, tek, gunluk_ucret: 0 }]);
            if (result.error) throw result.error;
            state.data = null;
            notify('success', existing?.length ? 'Hızlı puantaj güncellendi.' : 'Hızlı puantaj kaydedildi.');
            if (typeof window.fetchImportCalendar === 'function') window.fetchImportCalendar();
            if (typeof window.renderBugunYapilacaklar === 'function') window.renderBugunYapilacaklar();
        } catch (error) {
            console.error('[Operasyon Merkezi] hızlı giriş hatası:', error);
            notify('error', `Puantaj kaydedilemedi: ${error.message || 'Bilinmeyen hata'}`);
        } finally {
            button.disabled = false; button.innerHTML = original; refreshIcons();
        }
    }

    function renderQuickEntry(data) {
        const view = document.getElementById('om-panel');
        if (!view) return;
        view.innerHTML = `
            <section class="om-section"><div class="om-toolbar-card"><div><h3>Mobil hızlı giriş</h3><p>Tek ekranda fabrika, araç ve vardiya/tek kaydı. Saat alanı gerektirmez.</p></div><span class="om-count-badge">Güvenli kayıt</span></div>
                <form id="om-quick-form" class="om-quick-form">
                    <label>Tarih<input id="om-quick-date" type="date" value="${isoToday()}" required></label>
                    <label>Bölge<select id="om-quick-region"><option value="Manisa">Manisa</option><option value="İzmir">İzmir</option></select></label>
                    <label>Fabrika<select id="om-quick-factory" required></select></label>
                    <label>Araç<select id="om-quick-vehicle" required disabled><option value="">Önce fabrika seçin</option></select></label>
                    <label>Vardiya<input id="om-quick-vardiya" type="number" min="0" step="1" value="0" inputmode="numeric"></label>
                    <label>Tek servis<input id="om-quick-tek" type="number" min="0" step="1" value="0" inputmode="numeric"></label>
                    <div class="om-quick-action"><p id="om-quick-vehicle-message">Önce fabrika seçin.</p><button type="submit" class="om-primary-button"><i data-lucide="save"></i> Puantajı kaydet</button></div>
                </form>
                <div class="om-note"><i data-lucide="shield-check"></i><span>Araç yalnızca seçilen fabrika ve bölgeye tanımlıysa listelenir. Aynı tarih/fabrika/araç kaydı varsa, yalnızca vardiya ve tek sayıları güncellenir; diğer puantaj alanları korunur.</span></div>
            </section>`;
        const form = document.getElementById('om-quick-form');
        document.getElementById('om-quick-region')?.addEventListener('change', () => fillQuickFactories(data));
        document.getElementById('om-quick-factory')?.addEventListener('change', () => fillQuickVehicles(data));
        form?.addEventListener('submit', event => { event.preventDefault(); saveQuickEntry(data, form.querySelector('button[type="submit"]')); });
        fillQuickFactories(data);
        refreshIcons();
    }

    function renderSkeleton() {
        const panel = document.getElementById('om-panel');
        if (panel) { panel.innerHTML = '<div class="om-loading"><i data-lucide="loader-2" class="animate-spin"></i> Operasyon verileri hazırlanıyor...</div>'; refreshIcons(); }
    }

    async function loadPanel(force) {
        const panel = document.getElementById('om-panel');
        if (!panel) return;
        const version = ++state.loadVersion;
        renderSkeleton();
        try {
            const data = await getData(state.month, force);
            if (version !== state.loadVersion) return;
            if (state.tab === 'profit') renderProfitability(data);
            else if (state.tab === 'vehicle') await renderVehicleFile(data);
            else if (state.tab === 'driver') await renderDriverPerformance(data);
            else if (state.tab === 'backup') renderBackupCenter();
            else renderQuickEntry(data);
        } catch (error) {
            console.error('[Operasyon Merkezi]', error);
            if (version === state.loadVersion) {
                panel.innerHTML = `<div class="om-empty is-error"><i data-lucide="triangle-alert"></i><p>Operasyon verileri yüklenemedi: ${esc(error.message || 'Bilinmeyen hata')}</p></div>`;
                refreshIcons();
            }
        }
    }

    function setActiveTab() {
        document.querySelectorAll('[data-om-tab]').forEach(button => button.classList.toggle('is-active', button.dataset.omTab === state.tab));
    }

    function ensureLayout() {
        const root = document.getElementById('module-operasyon-merkezi');
        if (!root || root.dataset.ready === 'true') return root;
        root.dataset.ready = 'true';
        root.innerHTML = `
            <section class="om-shell">
                <div class="om-header"><div><span class="om-kicker">KONTROL MERKEZİ</span><h2>Operasyon Merkezi</h2><p>Fabrika kârlılığı, saha araçları, şoför özeti ve güvenli yedekleme tek yerde.</p></div>
                    <div class="om-header-actions"><label class="om-select-label">Dönem <input id="om-month" class="om-month" type="month"></label><button id="om-refresh" type="button" class="om-secondary-button"><i data-lucide="refresh-cw"></i> Yenile</button></div>
                </div>
                <div class="om-tabs" role="tablist">
                    <button type="button" data-om-tab="profit" class="is-active"><i data-lucide="chart-no-axes-combined"></i> Fabrika kârlılığı</button>
                    <button type="button" data-om-tab="vehicle"><i data-lucide="truck"></i> Araç dosyası</button>
                    <button type="button" data-om-tab="driver"><i data-lucide="badge-check"></i> Şoför performansı</button>
                    <button type="button" data-om-tab="backup"><i data-lucide="database-backup"></i> Yedekleme merkezi</button>
                    <button type="button" data-om-tab="quick"><i data-lucide="smartphone"></i> Mobil hızlı giriş</button>
                </div>
                <div id="om-panel"></div>
            </section>`;
        const month = document.getElementById('om-month');
        month.value = state.month || currentMonth();
        state.month = month.value;
        month.addEventListener('change', () => { state.month = month.value || currentMonth(); state.data = null; loadPanel(true); });
        document.getElementById('om-refresh')?.addEventListener('click', () => { state.data = null; loadPanel(true); });
        root.querySelectorAll('[data-om-tab]').forEach(button => button.addEventListener('click', () => { state.tab = button.dataset.omTab; setActiveTab(); loadPanel(false); }));
        refreshIcons();
        return root;
    }

    window.renderOperasyonMerkezi = function () {
        ensureLayout();
        loadPanel(false);
    };

    window.openOperasyonTab = function (tab) {
        const allowed = ['profit', 'vehicle', 'driver', 'backup', 'quick'];
        state.tab = allowed.includes(tab) ? tab : 'profit';
        ensureLayout();
        setActiveTab();
        loadPanel(false);
    };

    window.OperasyonMerkezi = {
        calculateProfitability,
        monthBounds,
        normalizeRegion,
        priceFor,
    };

    // Dashboard'daki sade "Bugün yapılacaklar" kartı. Bu fonksiyonun
    // hata vermesi dashboard'un geri kalanını etkilemez.
    window.renderBugunYapilacaklar = async function () {
        const list = document.getElementById('today-tasks-list');
        if (!list || !window.supabaseClient) return;
        const today = isoToday();
        const future = new Date(`${today}T12:00:00`); future.setDate(future.getDate() + 30);
        const futureKey = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
        list.innerHTML = '<div class="today-tasks-loading"><i data-lucide="loader-2" class="animate-spin"></i> Bugünün kontrol listesi hazırlanıyor...</div>';
        refreshIcons();
        try {
            const [todayPuantaj, vehicles, policies, jobs] = await Promise.all([
                optionalRows('musteri_servis_puantaj', 'id', q => q.eq('tarih', today)),
                optionalRows('araclar', 'id, plaka, vize_bitis, sigorta_bitis, kasko_bitis, koltuk_bitis'),
                optionalRows('arac_policeler', 'id, arac_id, police_turu, bitis_tarihi', q => q.gte('bitis_tarihi', today).lte('bitis_tarihi', futureKey)),
                optionalRows('is_emirleri', 'id, baslik, durum, oncelik, deadline_tarihi', q => q.in('durum', ['AÇIK', 'DEVAM EDİYOR'])),
            ]);
            const tasks = [];
            if (!todayPuantaj.length) tasks.push({ type: 'warning', icon: 'calendar-clock', title: 'Bugünün puantajı bekliyor', detail: 'Bugün için henüz puantaj kaydı yok.', action: 'Hızlı giriş', tab: 'quick' });
            else tasks.push({ type: 'ok', icon: 'calendar-check-2', title: 'Bugünün puantajı işleniyor', detail: `${todayPuantaj.length} araç/fabrika kaydı bulundu.`, action: 'Kontrol et', tab: 'quick' });
            const expiry = [];
            (vehicles || []).forEach(vehicle => [['Vize', vehicle.vize_bitis], ['Sigorta', vehicle.sigorta_bitis], ['Kasko', vehicle.kasko_bitis], ['Koltuk', vehicle.koltuk_bitis]].forEach(([label, date]) => { if (date && String(date) <= futureKey) expiry.push(`${vehicle.plaka || 'Plakasız'} · ${label}`); }));
            (policies || []).forEach(item => expiry.push(`${item.police_turu || 'Poliçe'} · ${item.bitis_tarihi}`));
            if (expiry.length) tasks.push({ type: 'danger', icon: 'shield-alert', title: `${expiry.length} evrak/poliçe kontrolü`, detail: expiry.slice(0, 2).join(' · ') + (expiry.length > 2 ? ` +${expiry.length - 2}` : ''), action: 'Araç dosyası', tab: 'vehicle' });
            const urgentJobs = (jobs || []).filter(item => item.oncelik === 'ACİL' || (item.deadline_tarihi && String(item.deadline_tarihi) <= today));
            if (urgentJobs.length) tasks.push({ type: 'danger', icon: 'wrench', title: `${urgentJobs.length} açık iş emri öncelikli`, detail: urgentJobs.slice(0, 2).map(item => item.baslik || 'İş emri').join(' · '), action: 'İş emirleri', tab: '' });
            const calendar = window.importCalendarSummary;
            if (calendar && calendar.month === currentMonth() && calendar.missing > 0) tasks.push({ type: 'warning', icon: 'calendar-x2', title: `${calendar.missing} puantaj günü kontrol bekliyor`, detail: `${calendar.factories} fabrika için aylık import takviminden geldi.`, action: 'Takvimi aç', tab: '' });
            list.innerHTML = tasks.map(item => `<article class="today-task is-${item.type}"><i data-lucide="${item.icon}"></i><div><strong>${esc(item.title)}</strong><span>${esc(item.detail)}</span></div>${item.tab ? `<button type="button" data-task-tab="${esc(item.tab)}">${esc(item.action)}</button>` : `<span class="today-task-label">${esc(item.action)}</span>`}</article>`).join('') || '<div class="today-tasks-empty"><i data-lucide="circle-check" aria-hidden="true"></i><span>Şu anda dikkat gerektiren kritik bir kayıt bulunmuyor.</span></div>';
            list.querySelectorAll('[data-task-tab]').forEach(button => button.addEventListener('click', () => {
                const nav = document.querySelector('[data-target="module-operasyon-merkezi"]');
                if (nav) nav.click();
                window.openOperasyonTab(button.dataset.taskTab);
            }));
            refreshIcons();
        } catch (error) {
            console.warn('[Bugün yapılacaklar]', error);
            list.innerHTML = '<div class="today-tasks-empty is-error"><i data-lucide="triangle-alert" aria-hidden="true"></i><span>Kontrol listesi şu anda alınamadı. Lütfen yeniden deneyin.</span></div>';
            refreshIcons();
        }
    };
})();
