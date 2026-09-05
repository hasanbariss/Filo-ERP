(function () {
    'use strict';
    // Both ownership screens use the same vehicle layout and renderer, with
    // separate IDs/filter state. No data is moved between ownership groups.
    window.prepareContractorFleet = function () {
        var target=document.getElementById('taseron-content-liste');
        var source=document.getElementById('sub-araclar');
        if(!target||!source||target.dataset.sharedFleet)return;
        var copy=source.cloneNode(true);
        copy.removeAttribute('id');copy.classList.remove('hidden');
        copy.querySelectorAll('[id]').forEach(function(el){el.id='contractor-'+el.id;});
        copy.querySelectorAll('[for]').forEach(function(el){el.htmlFor='contractor-'+el.htmlFor;});
        copy.querySelectorAll('[onclick],[oninput],[onchange]').forEach(function(el){
            ['onclick','oninput','onchange'].forEach(function(attr){
                var value=el.getAttribute(attr);if(!value)return;
                value=value.replace('openFleetBulkEditor()',"openFleetBulkEditor('TAŞERON')")
                    .replace('applyOwnedFleetFilters()',"applyOwnedFleetFilters('TAŞERON')")
                    .replace('resetOwnedFleetFilters()',"resetOwnedFleetFilters('TAŞERON')")
                    .replace('filterOwnedFleetSearch(this.value)',"filterOwnedFleetSearch(this.value, 'TAŞERON')")
                    .replace('Yeni Araç Ekle','Yeni Taşeron Kaydı')
                    .replace("setFleetView('ÖZMAL'","setFleetView('TAŞERON'")
                    .replace("exportFleetScope('ÖZMAL'","exportFleetScope('TAŞERON'");
                el.setAttribute(attr,value);
            });
        });
        copy.querySelector('.page-title').textContent='Taşeron Araçlar';
        copy.querySelector('.page-subtitle').textContent='Yalnızca taşeron araçların sürücü, sınıf, evrak ve bakım bilgilerini yönetin.';
        copy.querySelector('.owned-fleet-eyebrow').textContent='İş ortakları';
        copy.querySelector('.fleet-toolbar .badge-info').textContent='Yalnızca taşeron araçlar';
        copy.querySelector('input[type="search"]').placeholder='Plaka, firma veya sürücü ara';
        copy.querySelectorAll('input[type="search"],select').forEach(function(el){el.value='';});
        copy.querySelector('#contractor-arac-cards-grid').replaceChildren();
        copy.querySelector('#contractor-arac-list-tbody').replaceChildren();
        target.replaceChildren(copy);target.dataset.sharedFleet='true';
        var module=document.getElementById('module-taseron');
        module.querySelector('.contractor-kpi-grid').hidden=true;
        module.querySelector('.contractor-page-header').hidden=true;
    };
})();

window.setFleetView = function(scope, mode) {
    var root=document.getElementById(scope==='TAŞERON'?'taseron-content-liste':'sub-araclar');
    if(root) {
        var surface=root.querySelector('.fleet-surface');
        surface.dataset.viewMode=mode==='grid'?'grid':'list';
        surface.dataset.viewSelected='true';
    }
};
window.exportFleetScope = function(scope) {
    var prefix=scope==='TAŞERON'?'contractor-':'';
    var table=document.getElementById(prefix+'arac-list-tbody')?.closest('table');
    if(!table||!window.XLSX)return;
    var copy=table.cloneNode(true);copy.querySelectorAll('tbody tr[hidden]').forEach(function(row){row.remove();});
    copy.querySelectorAll('tr').forEach(function(row){row.lastElementChild?.remove();});
    var workbook=XLSX.utils.table_to_book(copy,{sheet:'Araçlar'});
    XLSX.writeFile(workbook,(scope==='TAŞERON'?'Taseron_Araclar':'Ozmal_Filo')+'.xlsx');
};
function addFleetViewControls() {
    var source=document.querySelector('#sub-araclar .fleet-toolbar-controls');if(!source)return;
    var controls=document.createElement('span');controls.className='fleet-view-controls';
    controls.innerHTML='<button type="button" class="btn-secondary" onclick="window.setFleetView(\'ÖZMAL\',\'list\')">Liste</button><button type="button" class="btn-secondary" onclick="window.setFleetView(\'ÖZMAL\',\'grid\')">Kartlar</button><button type="button" class="btn-secondary" onclick="window.exportFleetScope(\'ÖZMAL\')">Excel</button>';
    source.appendChild(controls);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addFleetViewControls);else addFleetViewControls();
