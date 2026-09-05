(function () {
    'use strict';

    var state = { request: 0, month: '', dailyRows: [], performance: [], snapshotAvailable: true, unassignedCount: 0 };
    function esc(value) { return String(value == null ? '' : value).replace(/[&<>'"]/g, function (char) { return { '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]; }); }
    function number(value) { var parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
    function fmt(value) { return Number(value || 0).toLocaleString('tr-TR'); }
    function money(value) { return '₺' + Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits:2, maximumFractionDigits:2 }); }
    function monthBounds(value) {
        var safe = /^\d{4}-\d{2}$/.test(value || '') ? value : new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
        var parts = safe.split('-').map(Number);
        var previous = new Date(parts[0], parts[1] - 2, 1);
        var previousValue = previous.getFullYear() + '-' + String(previous.getMonth() + 1).padStart(2, '0');
        return { value:safe, start:safe+'-01', end:safe+'-'+String(new Date(parts[0], parts[1], 0).getDate()).padStart(2,'0'), previousValue:previousValue, previousStart:previousValue+'-01', previousEnd:previousValue+'-'+String(new Date(previous.getFullYear(), previous.getMonth()+1, 0).getDate()).padStart(2,'0') };
    }
    async function vehicles() {
        var result = await window.supabaseClient.from('araclar').select('id, plaka, sofor_id, arac_sinifi');
        if (result.error && /arac_sinifi|column|schema cache/i.test(result.error.message || '')) result = await window.supabaseClient.from('araclar').select('id, plaka, sofor_id');
        if (result.error) throw result.error;
        return result.data || [];
    }
    async function operationPages(columns, start, end) {
        var rows=[];
        for(var offset=0;;offset+=1000){
            var result=await window.supabaseClient.from('musteri_servis_puantaj').select(columns).gte('tarih',start).lte('tarih',end).order('id').range(offset,offset+999);
            if(result.error)return result;
            rows=rows.concat(result.data||[]);
            if(!result.data||result.data.length<1000)return {data:rows};
        }
    }
    async function serviceRows(start, end) {
        var result = await operationPages('id, tarih, musteri_id, bolge, arac_id, sofor_id, vardiya, tek, cikis_8, giris_2030, mesai', start, end);
        if (result.error && /sofor_id|column|schema cache/i.test(result.error.message || '')) {
            state.snapshotAvailable = false;
            result = await operationPages('id, tarih, musteri_id, bolge, arac_id, vardiya, tek, cikis_8, giris_2030, mesai', start, end);
        }
        if (result.error) throw result.error;
        return result.data || [];
    }
    function prepareMarkup() {
        var puantaj = document.getElementById('per-content-puantaj');
        var performance = document.getElementById('per-content-performans');
        if (puantaj && puantaj.dataset.operationalReady !== 'true') {
            puantaj.dataset.operationalReady = 'true';
            puantaj.innerHTML = '<div class="personnel-operation-head"><div><span>OPERASYONEL PUANTAJ</span><h3>Seferden Gelen Günlük Çalışma</h3><p>Araç seferleri şoför bazında görünür; bordroya yalnızca onaylı kayıtlar etki eder.</p></div><span class="personnel-safe-badge"><i data-lucide="shield-check"></i>Bordroya otomatik yazılmaz</span></div><div class="personnel-operation-summary" id="personnel-operation-summary"></div><div class="personnel-operation-toolbar"><label><i data-lucide="search"></i><input id="personnel-operation-search" type="search" placeholder="Şoför, plaka veya fabrika ara" oninput="window.applyPersonnelOperationFilters()"></label><select id="personnel-operation-class" onchange="window.applyPersonnelOperationFilters()"><option value="">Tüm araç sınıfları</option><option value="TAKSİ">Taksi</option><option value="16+1">16+1 Minibüs</option><option value="27+1">27+1 Midibüs</option><option value="46+1">46+1 Otobüs</option><option value="SINIFLANDIRILMAMIŞ">Sınıflandırılmamış</option></select><select id="personnel-operation-sort" onchange="window.applyPersonnelOperationFilters()"><option value="date-desc">Tarih · yeniden eskiye</option><option value="operation-desc">Sefer · yüksekten</option><option value="driver-asc">Şoför · A–Z</option></select></div><div id="personnel-operation-note" class="personnel-operation-note"></div><div class="personnel-operation-table-wrap"><table class="personnel-operation-table"><thead><tr><th>Tarih</th><th>Şoför</th><th>Araç / Sınıf</th><th>Fabrika / Bölge</th><th>Vardiya</th><th>Tek</th><th>Diğer</th><th>Toplam</th><th>Kaynak</th></tr></thead><tbody id="personnel-operation-tbody"></tbody></table></div>';
        }
        if (performance && performance.dataset.operationalReady !== 'true') {
            performance.dataset.operationalReady = 'true';
            performance.innerHTML = '<div class="personnel-operation-head"><div><span>ŞOFÖR DEĞERLENDİRME</span><h3>Dönemsel Operasyon Performansı</h3><p>Şoförler yalnızca kendi sefer, vardiya ve aktif günleri üzerinden karşılaştırılır.</p></div></div><div class="personnel-operation-table-wrap"><table class="personnel-operation-table is-performance"><thead><tr><th>Şoför</th><th>Araç / Sınıf</th><th>Aktif Gün</th><th>Vardiya</th><th>Tek</th><th>Toplam Operasyon</th><th>Önceki Ay</th><th>Değişim</th><th>Veri Durumu</th></tr></thead><tbody id="personnel-performance-tbody"></tbody></table></div>';
        }
        if (window.lucide) window.lucide.createIcons();
    }
    function operationCount(row) { return number(row.vardiya)+number(row.tek)+number(row.cikis_8)+number(row.giris_2030)+number(row.mesai); }
    function buildDaily(rows, vehicleMap, driverMap, customerMap) {
        return (rows || []).map(function (row) {
            var vehicle = vehicleMap.get(String(row.arac_id)) || {};
            var driverId = row.sofor_id || vehicle.sofor_id || '';
            return { id:row.id, date:row.tarih, customer:customerMap.get(String(row.musteri_id)) || 'Eşleşmeyen fabrika', region:row.bolge || 'Belirtilmemiş', driverId:driverId, driver:driverMap.get(String(driverId)) || 'Atanmamış', plate:vehicle.plaka || 'Eşleşmeyen araç', vehicleClass:vehicle.arac_sinifi || 'SINIFLANDIRILMAMIŞ', shifts:number(row.vardiya), trips:number(row.tek), other:number(row.cikis_8)+number(row.giris_2030)+number(row.mesai), operations:operationCount(row), source:row.sofor_id ? 'Tarihsel kayıt' : (vehicle.sofor_id ? 'Güncel atama' : 'Atanmamış') };
        }).filter(function (row) { return row.operations > 0; });
    }
    function aggregate(current, previous) {
        var previousMap = new Map();
        previous.forEach(function (row) { var item=previousMap.get(row.driverId)||0; previousMap.set(row.driverId,item+row.operations); });
        var groups = new Map();
        current.forEach(function (row) {
            var key = row.driverId || 'unassigned';
            var group = groups.get(key) || { driverId:key, driver:row.driver, plates:new Set(), classes:new Set(), days:new Set(), shifts:0, trips:0, operations:0, source:row.source, factories:new Map() };
            var factoryKey = row.customer+' · '+row.region;
            var factory = group.factories.get(factoryKey) || {name:factoryKey, days:new Set(), shifts:0, trips:0, other:0};
            factory.days.add(row.date); factory.shifts+=row.shifts; factory.trips+=row.trips; factory.other+=row.other;
            group.factories.set(factoryKey,factory);
            group.plates.add(row.plate); group.classes.add(row.vehicleClass); group.days.add(row.date); group.shifts += row.shifts; group.trips += row.trips; group.operations += row.operations;
            if (row.source !== 'Tarihsel kayıt') group.source = row.source;
            groups.set(key, group);
        });
        return Array.from(groups.values()).map(function (group) { group.previous=previousMap.get(group.driverId)||0; group.change=group.previous>0?((group.operations-group.previous)/group.previous)*100:null; return group; }).sort(function(a,b){return b.operations-a.operations;});
    }
    function renderSummary() {
        var el=document.getElementById('personnel-operation-summary'); if(!el)return;
        var assigned=new Set(state.dailyRows.filter(function(r){return r.driverId;}).map(function(r){return r.driverId;}));
        var days=new Set(state.dailyRows.map(function(r){return r.driverId+'|'+r.date;}));
        el.innerHTML='<article><span>Aktif Şoför</span><strong>'+fmt(assigned.size)+'</strong></article><article><span>Şoför / Gün</span><strong>'+fmt(days.size)+'</strong></article><article><span>Vardiya</span><strong>'+fmt(state.dailyRows.reduce(function(s,r){return s+r.shifts;},0))+'</strong></article><article><span>Tek Sefer</span><strong>'+fmt(state.dailyRows.reduce(function(s,r){return s+r.trips;},0))+'</strong></article>';
    }
    function renderDaily() {
        var tbody=document.getElementById('personnel-operation-tbody'); if(!tbody)return;
        var query=String(document.getElementById('personnel-operation-search')?.value||'').toLocaleLowerCase('tr-TR');
        var vehicleClass=document.getElementById('personnel-operation-class')?.value||'';
        var sort=document.getElementById('personnel-operation-sort')?.value||'date-desc';
        var rows=state.dailyRows.filter(function(row){return (!query||(row.driver+' '+row.plate+' '+row.customer+' '+row.region).toLocaleLowerCase('tr-TR').includes(query))&&(!vehicleClass||row.vehicleClass===vehicleClass);});
        rows.sort(sort==='operation-desc'?function(a,b){return b.operations-a.operations;}:sort==='driver-asc'?function(a,b){return a.driver.localeCompare(b.driver,'tr');}:function(a,b){return String(b.date).localeCompare(String(a.date));});
        if(!rows.length){tbody.innerHTML='<tr><td colspan="9"><div class="empty-state">Seçilen dönemde şoförle ilişkilendirilebilen sefer bulunamadı.</div></td></tr>';return;}
        tbody.innerHTML=rows.map(function(row){return '<tr><td>'+esc(String(row.date||'').split('-').reverse().join('.'))+'</td><td><strong>'+esc(row.driver)+'</strong></td><td><strong>'+esc(row.plate)+'</strong><small>'+esc(row.vehicleClass)+'</small></td><td>'+esc(row.customer)+'<small>'+esc(row.region)+'</small></td><td>'+fmt(row.shifts)+'</td><td>'+fmt(row.trips)+'</td><td>'+fmt(row.other)+'</td><td><strong>'+fmt(row.operations)+'</strong></td><td><span class="personnel-source is-'+(row.source==='Tarihsel kayıt'?'exact':row.source==='Atanmamış'?'missing':'fallback')+'">'+esc(row.source)+'</span></td></tr>';}).join('');
    }
    function renderPerformance() {
        var tbody=document.getElementById('personnel-performance-tbody'); if(!tbody)return;
        if(!state.performance.length){tbody.innerHTML='<tr><td colspan="9"><div class="empty-state">Değerlendirilecek operasyon kaydı bulunamadı.</div></td></tr>';return;}
        tbody.innerHTML=state.performance.map(function(row){var change=row.change===null?'Karşılaştırma yok':(row.change>0?'▲ ':row.change<0?'▼ ':'• ')+'%'+Math.abs(row.change).toLocaleString('tr-TR',{maximumFractionDigits:1});return '<tr><td><strong>'+esc(row.driver)+'</strong></td><td>'+esc(Array.from(row.plates).join(', '))+'<small>'+esc(Array.from(row.classes).join(', '))+'</small></td><td>'+fmt(row.days.size)+'</td><td>'+fmt(row.shifts)+'</td><td>'+fmt(row.trips)+'</td><td><strong>'+fmt(row.operations)+'</strong></td><td>'+fmt(row.previous)+'</td><td>'+change+'</td><td><span class="personnel-source is-'+(row.source==='Tarihsel kayıt'?'exact':row.source==='Atanmamış'?'missing':'fallback')+'">'+esc(row.source)+'</span></td></tr><tr><td colspan="9"><details><summary>Çalıştığı fabrikalar ('+row.factories.size+')</summary><table class="personnel-operation-table"><thead><tr><th>Fabrika / Bölge</th><th>Gün</th><th>Vardiya</th><th>Tek</th><th>Diğer</th></tr></thead><tbody>'+Array.from(row.factories.values()).map(function(f){return '<tr><td>'+esc(f.name)+'</td><td>'+f.days.size+'</td><td>'+fmt(f.shifts)+'</td><td>'+fmt(f.trips)+'</td><td>'+fmt(f.other)+'</td></tr>';}).join('')+'</tbody></table></details></td></tr>';}).join('');
    }
    window.applyPersonnelOperationFilters=renderDaily;
    window.fetchPersonnelOperations=async function(){
        prepareMarkup();
        if(!window.supabaseClient)return;
        var input=document.getElementById('personel-ay'); var bounds=monthBounds(input&&input.value); if(input&&!input.value)input.value=bounds.value;
        var request=++state.request; state.month=bounds.value; state.snapshotAvailable=true;
        try{
            var results=await Promise.all([window.supabaseClient.from('soforler').select('id, ad_soyad'),vehicles(),serviceRows(bounds.start,bounds.end),serviceRows(bounds.previousStart,bounds.previousEnd),window.supabaseClient.from('musteriler').select('id, ad')]);
            if(request!==state.request)return;
            if(results[0].error)throw results[0].error;
            var driverMap=new Map((results[0].data||[]).map(function(row){return[String(row.id),row.ad_soyad||'İsimsiz şoför'];}));
            var vehicleMap=new Map(results[1].map(function(row){return[String(row.id),row];}));
            if(results[4].error)throw results[4].error;
            var customerMap=new Map((results[4].data||[]).map(function(row){return [String(row.id),row.ad];}));
            var currentRows=buildDaily(results[2],vehicleMap,driverMap,customerMap);
            var previousRows=buildDaily(results[3],vehicleMap,driverMap,customerMap);
            state.unassignedCount=currentRows.filter(function(row){return !row.driverId;}).length;
            state.dailyRows=currentRows.filter(function(row){return !!row.driverId;});
            state.performance=aggregate(state.dailyRows,previousRows.filter(function(row){return !!row.driverId;}));
            renderSummary();renderDaily();renderPerformance();
            var note=document.getElementById('personnel-operation-note');if(note){var unassigned=state.unassignedCount?' · '+fmt(state.unassignedCount)+' atamasız sefer değerlendirmeye alınmadı.':'';note.innerHTML=(state.snapshotAvailable?'<i data-lucide="database"></i>Yeni seferlerde şoför, kayıt tarihindeki araç atamasından sabitlenir.':'<i data-lucide="triangle-alert"></i>Şoför snapshot alanı henüz etkin değil; eşleşme mevcut araç atamasına göre gösteriliyor.')+unassigned;}
            if(window.lucide)window.lucide.createIcons();
        }catch(error){console.error('[Personel Operasyon]',error);var tbody=document.getElementById('personnel-operation-tbody');if(tbody)tbody.innerHTML='<tr><td colspan="9"><div class="empty-state">Operasyon puantajı yüklenemedi.</div></td></tr>';}
    };

    window.fetchPersonnelPayrollOverview=async function(){
        prepareMarkup();
        var container=document.getElementById('per-content-bordro');if(!container||!window.supabaseClient)return;
        var input=document.getElementById('personel-ay');var bounds=monthBounds(input&&input.value);if(input&&!input.value)input.value=bounds.value;
        container.innerHTML='<div class="personnel-operation-head"><div><span>MAAŞ BORDROSU</span><h3>Onaylı Ödeme Hesabı</h3><p>Brüt kazanç − avans − ceza − haciz − banka ödemeleri = kalan ödeme.</p></div><button class="btn-primary" onclick="openModal(\'Yeni Maaş Kaydı\')"><i data-lucide="plus"></i>Bordro Kaydı</button></div><div class="personnel-operation-note"><i data-lucide="shield-check"></i>Operasyonel sefer günleri bilgi amaçlıdır; bordroya otomatik tutar yazmaz.</div><div class="personnel-operation-table-wrap"><table class="personnel-operation-table"><thead><tr><th>Şoför</th><th>Ücret Tipi</th><th>Onaylı Gün</th><th>Brüt / Net Maaş</th><th>Avans</th><th>Ceza / Haciz</th><th>Banka</th><th>Kalan Ödeme</th><th>Durum</th></tr></thead><tbody id="personnel-payroll-tbody"><tr><td colspan="9">Yükleniyor…</td></tr></tbody></table></div>';
        if(window.lucide)window.lucide.createIcons();
        try{
            var res=await Promise.all([window.supabaseClient.from('soforler').select('id, ad_soyad, aylik_maas, gunluk_ucret').order('ad_soyad'),window.supabaseClient.from('sofor_maas_bordro').select('*').eq('donem',bounds.value),window.supabaseClient.from('sofor_finans').select('sofor_id, islem_turu, tutar').gte('tarih',bounds.start).lte('tarih',bounds.end)]);
            res.forEach(function(r){if(r.error)throw r.error;});
            var payroll=new Map((res[1].data||[]).map(function(row){return[String(row.sofor_id),row];}));
            var finance=new Map();(res[2].data||[]).forEach(function(row){var item=finance.get(String(row.sofor_id))||{avans:0,ceza:0,haciz:0};var type=String(row.islem_turu||'').toLocaleLowerCase('tr-TR');if(type.includes('avans'))item.avans+=Math.abs(number(row.tutar));else if(type.includes('ceza') || type.includes('kesinti'))item.ceza+=Math.abs(number(row.tutar));else if(type.includes('haciz'))item.haciz+=Math.abs(number(row.tutar));finance.set(String(row.sofor_id),item);});
            var tbody=document.getElementById('personnel-payroll-tbody');var rows=res[0].data||[];
            tbody.innerHTML=rows.map(function(driver){var record=payroll.get(String(driver.id));var extra=finance.get(String(driver.id))||{};var days=number(record&&record.calisma_gun);var daily=number(driver.gunluk_ucret)||(number(driver.aylik_maas)/30);var wage=record&&number(record.net_maas)>0?number(record.net_maas):days*daily;var advance=record?number(record.avans):number(extra.avans);var penalty=record?number(record.ceza)+number(record.haciz):number(extra.ceza)+number(extra.haciz);var bank=number(record&&record.mk_banka)+number(record&&record.ideol_banka);var payable=Math.max(0,wage-advance-penalty-bank);return '<tr><td><strong>'+esc(driver.ad_soyad)+'</strong></td><td>'+ (number(driver.gunluk_ucret)>0?'Günlük '+money(driver.gunluk_ucret):'Aylık '+money(driver.aylik_maas))+'</td><td>'+fmt(days)+'</td><td>'+money(wage)+'</td><td>'+money(advance)+'</td><td>'+money(penalty)+'</td><td>'+money(bank)+'</td><td><strong>'+money(payable)+'</strong></td><td><span class="personnel-source is-'+(record?'exact':'fallback')+'">'+(record?'Onaylı kayıt':'Taslak')+'</span></td></tr>';}).join('')||'<tr><td colspan="9"><div class="empty-state">Personel kaydı bulunamadı.</div></td></tr>';
        }catch(error){console.error('[Personel Bordro]',error);var tbody=document.getElementById('personnel-payroll-tbody');if(tbody)tbody.innerHTML='<tr><td colspan="9">Bordro yüklenemedi. Dönemi yeniden seçerek tekrar deneyin.</td></tr>';}
    };

    function init(){prepareMarkup();}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
