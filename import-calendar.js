// ============================================================
// AYLIK IMPORT TAKVİMİ
// Son üç ayda aktif olan fabrikaların seçili aydaki puantaj
// kayıtlarını görsel olarak takip eder. Salt okunur çalışır.
// ============================================================
(function () {
    'use strict';

    const PAGE_SIZE = 1000;
    let requestVersion = 0;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function localDateKey(date) {
        return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    }

    function monthKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    function monthBounds(monthValue) {
        const match = String(monthValue || '').match(/^(\d{4})-(\d{2})$/);
        const now = new Date();
        const year = match ? Number(match[1]) : now.getFullYear();
        const monthIndex = match ? Number(match[2]) - 1 : now.getMonth();
        const days = new Date(year, monthIndex + 1, 0).getDate();
        return {
            year,
            monthIndex,
            days,
            start: `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`,
            end: `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`,
        };
    }

    function subMonths(year, monthIndex, count) {
        const date = new Date(year, monthIndex - count, 1);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    }

    function formatDate(value) {
        if (!value) return '–';
        const date = new Date(`${value}T12:00:00`);
        return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
    }

    function normalizeRegion(value, customerName) {
        const raw = String(value || '').toLocaleUpperCase('tr-TR');
        const customer = String(customerName || '').toLocaleUpperCase('tr-TR');
        if (customer.includes('DİKKAN') || customer.includes('DIKKAN')) return 'İzmir';
        if (raw.includes('İZMİR') || raw.includes('IZMIR')) return 'İzmir';
        return 'Manisa';
    }

    async function fetchPagedPuantaj(start, end) {
        const rows = [];
        for (let offset = 0; ; offset += PAGE_SIZE) {
            const { data, error } = await window.supabaseClient
                .from('musteri_servis_puantaj')
                .select('musteri_id, tarih, bolge')
                .gte('tarih', start)
                .lte('tarih', end)
                .order('tarih', { ascending: false })
                .range(offset, offset + PAGE_SIZE - 1);
            if (error) throw new Error(error.message || 'Puantaj kayıtları alınamadı.');
            rows.push(...(data || []));
            if (!data || data.length < PAGE_SIZE) return rows;
        }
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    function setLoading(message) {
        const list = document.getElementById('import-calendar-list');
        if (!list) return;
        list.innerHTML = `<div class="import-calendar-loading"><i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i>${escapeHtml(message)}</div>`;
        if (window.lucide) window.lucide.createIcons();
    }

    function dayState(date, hasRecord, today) {
        const isFuture = date > today;
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        if (hasRecord) return { className: 'is-complete', text: 'İşlendi' };
        if (isFuture) return { className: 'is-future', text: 'Gelecek gün' };
        if (isWeekend) return { className: 'is-weekend', text: 'Hafta sonu' };
        return { className: 'is-missing', text: 'Kontrol edin' };
    }

    function renderCalendar(items, bounds, selectedRegion) {
        const list = document.getElementById('import-calendar-list');
        if (!list) return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const allStats = items.reduce((stats, item) => {
            stats.completed += item.completedDays.size;
            stats.missing += item.missingDays;
            if (item.lastImport && (!stats.lastImport || item.lastImport > stats.lastImport)) stats.lastImport = item.lastImport;
            return stats;
        }, { completed: 0, missing: 0, lastImport: '' });

        setText('import-calendar-factory-count', String(items.length));
        setText('import-calendar-complete-count', String(allStats.completed));
        setText('import-calendar-missing-count', String(allStats.missing));
        setText('import-calendar-last-import', formatDate(allStats.lastImport));

        if (!items.length) {
            const area = selectedRegion === 'Tümü' ? 'seçilen dönemde' : `${selectedRegion} bölgesinde`;
            list.innerHTML = `<div class="import-calendar-empty"><i data-lucide="calendar-x2" class="w-6 h-6"></i><p>Son üç ayda ${escapeHtml(area)} puantajı bulunan fabrika yok.</p></div>`;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        const dayGridStyle = `style="grid-template-columns:repeat(${bounds.days}, minmax(16px, 1fr))"`;
        const gridHeader = Array.from({ length: bounds.days }, (_, index) => `<span>${index + 1}</span>`).join('');
        const rows = items.map(item => {
            const days = Array.from({ length: bounds.days }, (_, index) => {
                const date = new Date(bounds.year, bounds.monthIndex, index + 1);
                date.setHours(0, 0, 0, 0);
                const key = localDateKey(date);
                const status = dayState(date, item.completedDays.has(key), today);
                const dateTitle = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
                return `<span class="import-calendar-day ${status.className}" title="${dateTitle} · ${status.text}" aria-label="${dateTitle}: ${status.text}">${index + 1}</span>`;
            }).join('');

            const targetLabel = item.expectedDays ? `${item.completedBusinessDays}/${item.expectedDays}` : '–';
            const missingLabel = item.missingDays ? `<span class="import-calendar-missing-label">${item.missingDays} gün kontrol</span>` : '<span class="import-calendar-ok-label">Tamam</span>';
            return `
                <article class="import-calendar-row">
                    <div class="import-calendar-factory">
                        <div class="import-calendar-factory-main">
                            <strong>${escapeHtml(item.name)}</strong>
                            <span class="import-calendar-region-badge ${item.region === 'İzmir' ? 'is-izmir' : 'is-manisa'}">${escapeHtml(item.region)}</span>
                        </div>
                        <span class="import-calendar-last-date">Son kayıt: ${formatDate(item.lastImport)}</span>
                    </div>
                    <div class="import-calendar-track" ${dayGridStyle} role="img" aria-label="${escapeHtml(item.name)} günlük import durumu">
                        ${days}
                    </div>
                    <div class="import-calendar-progress">
                        <strong>${targetLabel}</strong>
                        <span>iş günü</span>
                        ${missingLabel}
                    </div>
                    <button type="button" class="import-calendar-open" data-musteri-id="${escapeHtml(item.musteriId)}" title="Fabrika puantajını aç">
                        <i data-lucide="arrow-up-right" class="w-4 h-4"></i><span>Aç</span>
                    </button>
                </article>`;
        }).join('');

        list.innerHTML = `
            <div class="import-calendar-grid-head">
                <span>Fabrika</span>
                <div ${dayGridStyle}>${gridHeader}</div>
                <span>Durum</span>
                <span></span>
            </div>
            ${rows}`;

        list.querySelectorAll('.import-calendar-open').forEach(button => {
            button.addEventListener('click', () => {
                const customerId = button.dataset.musteriId;
                if (customerId && typeof window.openPuantajForMusteri === 'function') {
                    window.openPuantajForMusteri(customerId);
                }
            });
        });
        if (window.lucide) window.lucide.createIcons();
    }

    window.fetchImportCalendar = async function () {
        const list = document.getElementById('import-calendar-list');
        const monthInput = document.getElementById('import-calendar-month');
        const regionInput = document.getElementById('import-calendar-region');
        if (!list || !monthInput || !regionInput || !window.supabaseClient) return;

        const currentRequest = ++requestVersion;
        const bounds = monthBounds(monthInput.value);
        const selectedRegion = regionInput.value || 'Tümü';
        setLoading('Takvim hazırlanıyor...');

        try {
            const [records, customersResult] = await Promise.all([
                fetchPagedPuantaj(subMonths(bounds.year, bounds.monthIndex, 2), bounds.end),
                window.supabaseClient.from('musteriler').select('id, ad'),
            ]);
            if (currentRequest !== requestVersion) return;
            if (customersResult.error) throw new Error(customersResult.error.message || 'Fabrika listesi alınamadı.');

            const customerMap = new Map((customersResult.data || []).map(customer => [String(customer.id), customer.ad || 'İsimsiz fabrika']));
            const roster = new Map();
            const selectedMonthRecords = [];

            records.forEach(record => {
                if (!record.musteri_id || !record.tarih) return;
                const name = customerMap.get(String(record.musteri_id)) || 'İsimsiz fabrika';
                const region = normalizeRegion(record.bolge, name);
                if (selectedRegion !== 'Tümü' && region !== selectedRegion) return;
                const key = `${record.musteri_id}::${region}`;
                if (!roster.has(key)) {
                    roster.set(key, {
                        musteriId: String(record.musteri_id),
                        name,
                        region,
                        completedDays: new Set(),
                        lastImport: '',
                    });
                }
                if (record.tarih >= bounds.start && record.tarih <= bounds.end) {
                    selectedMonthRecords.push({ ...record, region, key });
                }
            });

            selectedMonthRecords.forEach(record => {
                const item = roster.get(record.key);
                if (!item) return;
                item.completedDays.add(record.tarih);
                if (!item.lastImport || record.tarih > item.lastImport) item.lastImport = record.tarih;
            });

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const items = [...roster.values()].map(item => {
                let expectedDays = 0;
                let completedBusinessDays = 0;
                for (let day = 1; day <= bounds.days; day += 1) {
                    const date = new Date(bounds.year, bounds.monthIndex, day);
                    date.setHours(0, 0, 0, 0);
                    if (date > today || date.getDay() === 0 || date.getDay() === 6) continue;
                    expectedDays += 1;
                    if (item.completedDays.has(localDateKey(date))) completedBusinessDays += 1;
                }
                return {
                    ...item,
                    expectedDays,
                    completedBusinessDays,
                    missingDays: Math.max(expectedDays - completedBusinessDays, 0),
                };
            }).sort((a, b) => b.missingDays - a.missingDays || a.name.localeCompare(b.name, 'tr'));

            renderCalendar(items, bounds, selectedRegion);
        } catch (error) {
            console.error('[Import Calendar]', error);
            setText('import-calendar-factory-count', '–');
            setText('import-calendar-complete-count', '–');
            setText('import-calendar-missing-count', '–');
            setText('import-calendar-last-import', '–');
            list.innerHTML = `<div class="import-calendar-empty is-error"><i data-lucide="triangle-alert" class="w-6 h-6"></i><p>Takvim yüklenemedi: ${escapeHtml(error.message || 'Bilinmeyen hata')}</p></div>`;
            if (window.lucide) window.lucide.createIcons();
        }
    };

    window.addEventListener('DOMContentLoaded', function () {
        const monthInput = document.getElementById('import-calendar-month');
        if (monthInput && !monthInput.value) monthInput.value = monthKey(new Date());
    });
})();
