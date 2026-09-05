(function () {
    'use strict';

    var VEHICLE_CLASSES = [
        { value: '', label: 'Sınıflandırılmamış' },
        { value: 'TAKSİ', label: 'Taksi' },
        { value: '16+1', label: '16+1 Minibüs' },
        { value: '27+1', label: '27+1 Midibüs' },
        { value: '46+1', label: '46+1 Otobüs' },
        { value: 'DİĞER', label: 'Diğer' }
    ];

    var state = {
        scope: 'ÖZMAL',
        vehicles: [],
        drivers: [],
        supportsVehicleClass: true,
        dirtyIds: new Set(),
        previousBodyOverflow: ''
    };

    function notify(message, type) {
        if (window.Toast && typeof window.Toast[type] === 'function') {
            window.Toast[type](message);
        } else if (typeof window.showToast === 'function') {
            window.showToast(message, type);
        } else if (type === 'error') {
            window.alert(message);
        }
    }

    function closeEditor(force) {
        if (!force && state.dirtyIds.size && !window.confirm('Kaydedilmemiş değişiklikler var. Pencere kapatılsın mı?')) return;
        var overlay = document.getElementById('fleet-bulk-editor-overlay');
        if (overlay) overlay.remove();
        document.body.classList.remove('fleet-bulk-editor-open');
        document.body.style.overflow = state.previousBodyOverflow;
        state.dirtyIds.clear();
    }

    function buildOption(value, label) {
        var option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        return option;
    }

    function currentVehicleValues(row) {
        return {
            vehicleClass: row.querySelector('[data-field="vehicle-class"]').value,
            driverId: row.querySelector('[data-field="driver-id"]').value
        };
    }

    function updateDirtyState(row) {
        var values = currentVehicleValues(row);
        var isDirty = values.vehicleClass !== row.dataset.originalClass || values.driverId !== row.dataset.originalDriver;
        row.classList.toggle('is-dirty', isDirty);
        if (isDirty) state.dirtyIds.add(row.dataset.vehicleId);
        else state.dirtyIds.delete(row.dataset.vehicleId);

        var count = document.getElementById('fleet-bulk-change-count');
        var save = document.getElementById('fleet-bulk-save');
        if (count) count.textContent = state.dirtyIds.size ? state.dirtyIds.size + ' değişiklik' : 'Değişiklik yok';
        if (save) save.disabled = state.dirtyIds.size === 0;
    }

    function applyFilters() {
        var query = String(document.getElementById('fleet-bulk-search')?.value || '').toLocaleLowerCase('tr-TR').trim();
        var scope = document.getElementById('fleet-bulk-scope')?.value || 'all';
        var visible = 0;

        document.querySelectorAll('#fleet-bulk-tbody tr[data-vehicle-id]').forEach(function (row) {
            var missingDriver = !row.querySelector('[data-field="driver-id"]').value;
            var missingClass = !row.querySelector('[data-field="vehicle-class"]').value;
            var scopeMatch = scope === 'all'
                || (scope === 'missing-any' && (missingDriver || missingClass))
                || (scope === 'missing-driver' && missingDriver)
                || (scope === 'missing-class' && missingClass)
                || (scope === 'changed' && row.classList.contains('is-dirty'));
            var matches = (!query || row.dataset.search.includes(query)) && scopeMatch;
            row.hidden = !matches;
            if (matches) visible += 1;
        });

        var visibleCount = document.getElementById('fleet-bulk-visible-count');
        if (visibleCount) visibleCount.textContent = visible + ' araç';
        var empty = document.getElementById('fleet-bulk-empty');
        if (empty) empty.hidden = visible !== 0;
    }

    function renderRows() {
        var tbody = document.getElementById('fleet-bulk-tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        var assignedPlateByDriver = new Map();
        state.vehicles.forEach(function (vehicle) {
            if (vehicle.sofor_id) assignedPlateByDriver.set(String(vehicle.sofor_id), vehicle.plaka || 'Başka araç');
        });

        state.vehicles.forEach(function (vehicle) {
            var vehicleId = String(vehicle.id);
            var driverId = vehicle.sofor_id ? String(vehicle.sofor_id) : '';
            var vehicleClass = vehicle.arac_sinifi || '';
            var row = document.createElement('tr');
            row.dataset.vehicleId = vehicleId;
            row.dataset.originalDriver = driverId;
            row.dataset.originalClass = vehicleClass;
            row.dataset.search = [vehicle.plaka, vehicle.marka_model, vehicle.sirket].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');

            var identityCell = document.createElement('td');
            var identity = document.createElement('div');
            identity.className = 'fleet-bulk-vehicle';
            var icon = document.createElement('span');
            icon.innerHTML = '<i data-lucide="bus-front"></i>';
            var copy = document.createElement('div');
            var plate = document.createElement('strong');
            plate.textContent = vehicle.plaka || 'Plakasız araç';
            var model = document.createElement('small');
            model.textContent = vehicle.marka_model || 'Marka/model belirtilmemiş';
            copy.append(plate, model);
            identity.append(icon, copy);
            identityCell.appendChild(identity);

            var classCell = document.createElement('td');
            var classSelect = document.createElement('select');
            classSelect.dataset.field = 'vehicle-class';
            classSelect.setAttribute('aria-label', (vehicle.plaka || 'Araç') + ' araç sınıfı');
            VEHICLE_CLASSES.forEach(function (item) { classSelect.appendChild(buildOption(item.value, item.label)); });
            classSelect.value = vehicleClass;
            classSelect.disabled = !state.supportsVehicleClass;
            if (!state.supportsVehicleClass) classSelect.title = 'Araç sınıfı alanı production veritabanında henüz etkin değil.';
            classCell.appendChild(classSelect);

            var driverCell = document.createElement('td');
            var driverSelect = document.createElement('select');
            driverSelect.dataset.field = 'driver-id';
            driverSelect.setAttribute('aria-label', (vehicle.plaka || 'Araç') + ' şoförü');
            driverSelect.appendChild(buildOption('', 'Şoför atanmamış'));
            if (driverId && !state.drivers.some(function (driver) { return String(driver.id) === driverId; })) {
                driverSelect.appendChild(buildOption(driverId, 'Mevcut şoför kaydı bulunamadı'));
            }
            state.drivers.forEach(function (driver) {
                var assignedPlate = assignedPlateByDriver.get(String(driver.id));
                var suffix = assignedPlate && String(driver.id) !== driverId ? ' · ' + assignedPlate : '';
                driverSelect.appendChild(buildOption(String(driver.id), (driver.ad_soyad || 'İsimsiz şoför') + suffix));
            });
            driverSelect.value = driverId;
            driverCell.appendChild(driverSelect);

            var statusCell = document.createElement('td');
            statusCell.className = 'fleet-bulk-row-status';
            statusCell.innerHTML = '<span><i data-lucide="check"></i><b>Kayıtlı</b></span>';

            [classSelect, driverSelect].forEach(function (select) {
                select.addEventListener('change', function () {
                    updateDirtyState(row);
                    applyFilters();
                });
            });

            row.append(identityCell, classCell, driverCell, statusCell);
            tbody.appendChild(row);
        });

        var total = document.getElementById('fleet-bulk-total-count');
        if (total) total.textContent = state.vehicles.length + ' özmal araç';
        applyFilters();
        if (window.lucide) window.lucide.createIcons();
    }

    async function loadEditorData() {
        var body = document.getElementById('fleet-bulk-body');
        try {
            var results = await Promise.all([
                window.supabaseClient.from('araclar').select('id, plaka, marka_model, sirket, sofor_id, arac_sinifi').eq('mulkiyet_durumu', state.scope).order('plaka'),
                window.supabaseClient.from('soforler').select('id, ad_soyad, sirket').order('ad_soyad')
            ]);
            state.supportsVehicleClass = true;
            if (results[0].error && /arac_sinifi|column|schema cache/i.test(results[0].error.message || '')) {
                results[0] = await window.supabaseClient.from('araclar').select('id, plaka, marka_model, sirket, sofor_id').eq('mulkiyet_durumu', state.scope).order('plaka');
                state.supportsVehicleClass = false;
            }
            if (results[0].error) throw results[0].error;
            if (results[1].error) throw results[1].error;
            state.vehicles = results[0].data || [];
            state.drivers = results[1].data || [];
            var schemaNotice = document.getElementById('fleet-bulk-schema-notice');
            if (schemaNotice) schemaNotice.hidden = state.supportsVehicleClass;
            renderRows();
        } catch (error) {
            console.error('[FLEET BULK EDIT]', error);
            if (body) {
                body.innerHTML = '';
                var errorBox = document.createElement('div');
                errorBox.className = 'fleet-bulk-error';
                var errorTitle = document.createElement('strong');
                var errorMessage = document.createElement('span');
                errorTitle.textContent = 'Toplu düzenleme verileri yüklenemedi.';
                errorMessage.textContent = String(error.message || error);
                errorBox.append(errorTitle, errorMessage);
                body.appendChild(errorBox);
            }
            notify('Araç ve şoför listesi yüklenemedi.', 'error');
        }
    }

    async function saveChanges() {
        var saveButton = document.getElementById('fleet-bulk-save');
        var rows = Array.from(document.querySelectorAll('#fleet-bulk-tbody tr.is-dirty'));
        if (!rows.length || !saveButton) return;

        saveButton.disabled = true;
        saveButton.classList.add('is-loading');
        saveButton.innerHTML = '<i data-lucide="loader-2"></i>Kaydediliyor';
        if (window.lucide) window.lucide.createIcons();

        try {
            for (var start = 0; start < rows.length; start += 8) {
                var batch = rows.slice(start, start + 8);
                var responses = await Promise.all(batch.map(function (row) {
                    var values = currentVehicleValues(row);
                    var payload = { sofor_id: values.driverId || null };
                    if (state.supportsVehicleClass) payload.arac_sinifi = values.vehicleClass || null;
                    return window.supabaseClient.from('araclar').update(payload).eq('id', row.dataset.vehicleId).eq('mulkiyet_durumu', state.scope).select('id').then(function (response) {
                        if(!response.error && (!response.data || response.data.length!==1))response.error=new Error('Araç mülkiyeti değişmiş veya kayıt güncellenemedi. Listeyi yenileyin.');
                        return { response: response, row: row };
                    });
                }));
                var failed = responses.find(function (item) { return item.response.error; });
                if (failed) throw failed.response.error;
            }

            var savedCount = rows.length;
            state.dirtyIds.clear();
            closeEditor(true);
            if (typeof window.fetchAraclar === 'function') await window.fetchAraclar();
            if (typeof window.fetchTaseronlar === 'function') await window.fetchTaseronlar();
            if (typeof window.fetchSoforler === 'function') window.fetchSoforler();
            notify(savedCount + ' araç güncellendi.', 'success');
        } catch (error) {
            console.error('[FLEET BULK SAVE]', error);
            notify('Toplu atama kaydedilemedi: ' + (error.message || 'Bilinmeyen hata'), 'error');
            saveButton.disabled = false;
            saveButton.classList.remove('is-loading');
            saveButton.innerHTML = '<i data-lucide="save"></i>Değişiklikleri Kaydet';
            if (window.lucide) window.lucide.createIcons();
        }
    }

    window.openFleetBulkEditor = function (scope = 'ÖZMAL') {
        state.scope = scope === 'TAŞERON' ? 'TAŞERON' : 'ÖZMAL';
        if (!window.supabaseClient) {
            notify('Veri bağlantısı henüz hazır değil.', 'error');
            return;
        }
        closeEditor(true);
        state.previousBodyOverflow = document.body.style.overflow;
        state.vehicles = [];
        state.drivers = [];
        state.supportsVehicleClass = true;
        state.dirtyIds.clear();

        var overlay = document.createElement('div');
        overlay.id = 'fleet-bulk-editor-overlay';
        overlay.className = 'fleet-bulk-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'fleet-bulk-title');
        overlay.innerHTML = `
            <div class="fleet-bulk-dialog">
                <header class="fleet-bulk-header">
                    <div class="fleet-bulk-title-group">
                        <span class="fleet-bulk-title-icon"><i data-lucide="users-round"></i></span>
                        <div><small>${state.scope === 'TAŞERON' ? 'TAŞERON ARAÇLAR' : 'ÖZMAL FİLO'}</small><h2 id="fleet-bulk-title">Sürücü ve Araç Sınıfı Atama</h2><p>Plaka bazında seçim yapın; yalnızca değiştirdiğiniz satırlar kaydedilir.</p></div>
                    </div>
                    <button type="button" class="fleet-bulk-close" aria-label="Toplu düzenleme penceresini kapat"><i data-lucide="x"></i></button>
                </header>
                <div class="fleet-bulk-toolbar">
                    <label class="fleet-bulk-search"><i data-lucide="search"></i><input id="fleet-bulk-search" type="search" placeholder="Plaka veya araç ara" autocomplete="off"></label>
                    <select id="fleet-bulk-scope" aria-label="Atama durumuna göre filtrele">
                        <option value="all">Tüm özmal araçlar</option>
                        <option value="missing-any">Eksik ataması olanlar</option>
                        <option value="missing-driver">Şoförü olmayanlar</option>
                        <option value="missing-class">Sınıfı olmayanlar</option>
                        <option value="changed">Değiştirdiklerim</option>
                    </select>
                    <span id="fleet-bulk-total-count">Araçlar yükleniyor</span>
                </div>
                <div id="fleet-bulk-schema-notice" class="fleet-bulk-schema-notice" hidden><i data-lucide="info"></i><span>Şoför ataması kullanılabilir. Araç sınıfı alanı veritabanında etkinleştirildikten sonra 16+1 / 27+1 seçimleri açılacak.</span></div>
                <div id="fleet-bulk-body" class="fleet-bulk-body">
                    <table class="fleet-bulk-table">
                        <thead><tr><th>Araç</th><th>Araç Sınıfı</th><th>Atanan Şoför</th><th>Durum</th></tr></thead>
                        <tbody id="fleet-bulk-tbody"><tr><td colspan="4"><div class="fleet-bulk-loading"><i data-lucide="loader-2"></i><span>Araçlar ve şoförler yükleniyor…</span></div></td></tr></tbody>
                    </table>
                    <div id="fleet-bulk-empty" class="fleet-bulk-empty" hidden>Bu filtreye uygun araç bulunamadı.</div>
                </div>
                <footer class="fleet-bulk-footer">
                    <div><strong id="fleet-bulk-visible-count">— araç</strong><span id="fleet-bulk-change-count">Değişiklik yok</span></div>
                    <div><button type="button" class="fleet-bulk-cancel">İptal</button><button type="button" id="fleet-bulk-save" disabled><i data-lucide="save"></i>Değişiklikleri Kaydet</button></div>
                </footer>
            </div>`;

        document.body.appendChild(overlay);
        document.body.classList.add('fleet-bulk-editor-open');
        document.body.style.overflow = 'hidden';
        overlay.addEventListener('click', function (event) { if (event.target === overlay) closeEditor(false); });
        overlay.querySelector('.fleet-bulk-close').addEventListener('click', function () { closeEditor(false); });
        overlay.querySelector('.fleet-bulk-cancel').addEventListener('click', function () { closeEditor(false); });
        overlay.querySelector('#fleet-bulk-save').addEventListener('click', saveChanges);
        overlay.querySelector('#fleet-bulk-search').addEventListener('input', applyFilters);
        overlay.querySelector('#fleet-bulk-scope').addEventListener('change', applyFilters);
        if (window.lucide) window.lucide.createIcons();
        loadEditorData();
    };

    window.closeFleetBulkEditor = closeEditor;

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && document.getElementById('fleet-bulk-editor-overlay')) closeEditor(false);
    });
})();
