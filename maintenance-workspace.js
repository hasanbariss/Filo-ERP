window.filterMaintenanceRecords = function () {
    var query=String(document.getElementById('maintenance-search')?.value||'').trim().toLocaleLowerCase('tr-TR');
    var ownership=document.getElementById('maintenance-ownership')?.value||'';
    var status=document.getElementById('maintenance-status')?.value||'';
    var count=0,total=0,vehicles=new Set();
    document.querySelectorAll('#bakim-tbody .maintenance-row').forEach(function(row){
        var show=(!query||row.dataset.maintenanceSearch.includes(query))&&(!ownership||row.dataset.maintenanceOwnership===ownership)&&(!status||row.dataset.maintenanceStatus===status);
        row.hidden=!show;if(show){count++;total+=Number(row.dataset.maintenanceCost)||0;vehicles.add(row.dataset.maintenanceVehicle);}
    });
    var summary=document.getElementById('maintenance-filtered-totals');
    if(summary)summary.textContent=count+' kayıt · '+vehicles.size+' araç · '+window.formatCurrency(total);
};
window.clearMaintenanceFilters = function () {
    ['maintenance-search','maintenance-ownership','maintenance-status'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
    window.filterMaintenanceRecords();
};
