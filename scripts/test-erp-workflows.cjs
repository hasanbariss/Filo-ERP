'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const fuel = require('../fuel-analytics.js');
const report = require('../report-analytics.js');
const vehicles = [
    {id:'a',mulkiyet_durumu:'ÖZMAL',sirket:'DİKKAN'},
    {id:'b',mulkiyet_durumu:'ÖZMAL',sirket:'IDEOL'},
    {id:'c',mulkiyet_durumu:'ÖZMAL',sirket:'M.K.'},
    {id:'d',mulkiyet_durumu:'TAŞERON',sirket:'DİKKAN'},
    {id:'e',mulkiyet_durumu:'TAŞERON',sirket:'IDEOL'},
    {id:'f',mulkiyet_durumu:'TAŞERON',sirket:null}
];
for (const [preset, expected] of Object.entries({owned:['a','b','c'],subcontract:['d','e','f'],'dikkan-owned':['a'],'ideol-mk-owned':['b','c'],'dikkan-subcontract':['d'],'other-subcontract':['e']})) {
    assert.deepEqual(vehicles.filter(v=>fuel.matchesReportPreset(v,preset)).map(v=>v.id),expected,preset);
}
const mileage=fuel.mileageIntervals([{arac_id:'a',tarih:'2026-09-03',kilometre:300},{arac_id:'a',tarih:'2026-09-01',kilometre:100},{arac_id:'a',tarih:'2026-09-02',kilometre:150}]);
assert.deepEqual(mileage.map(r=>r.fark_km),[0,50,150]);
assert.equal(fuel.mileageIntervals([{arac_id:'a',tarih:'2026-09-01',kilometre:100},{arac_id:'a',tarih:'2026-09-02',kilometre:90}])[1].km_status,'Tutarsız KM');
const details=[100,100,120].map((price,i)=>({vehicleClass:'16+1',vehicleId:String(i),region:'Manisa',current:{shifts:2,trips:1,gross:2*price+50,vardiyaPrice:price,tekPrice:50}}));
const classes=report.groupServiceClasses(details);
assert.equal(classes.length,2);assert.equal(classes[0].shifts,4);assert.equal(classes.reduce((s,r)=>s+r.gross,0),790);

function query(data) {
    let rows=data.slice();
    const q={select(){return q},order(){return q},gte(k,v){rows=rows.filter(r=>r[k]>=v);return q},lte(k,v){rows=rows.filter(r=>r[k]<=v);return q},lt(k,v){rows=rows.filter(r=>r[k]<v);return q},eq(k,v){rows=rows.filter(r=>r[k]===v);return q},range(a,b){rows=rows.slice(a,b+1);return q},then(resolve){return Promise.resolve({data:rows}).then(resolve)}};
    return q;
}
(async()=>{
    const elements=new Map();
    const el=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',dataset:{},appendChild(node){this.innerHTML+=node.innerHTML}});return elements.get(id)};
    el('personel-ay').value='2026-09';
    const db={soforler:[{id:'s',ad_soyad:'Test Şoför',aylik_maas:30000}],araclar:[{id:'a',plaka:'35 TEST 1',sofor_id:'s',arac_sinifi:'16+1'}],musteriler:[{id:'m',ad:'Test Fabrikası'}],musteri_servis_puantaj:[{id:'p',tarih:'2026-09-01',musteri_id:'m',bolge:'Manisa',arac_id:'a',sofor_id:'s',vardiya:2,tek:1}],sofor_maas_bordro:[],sofor_finans:[{id:'f',tarih:'2026-09-01',sofor_id:'s',islem_turu:'AVANS',tutar:-500,soforler:{ad_soyad:'Test Şoför'}}]};
    const context={console,Map,Set,Date,Number,String,document:{readyState:'loading',addEventListener(){},getElementById:el,createElement(){return {innerHTML:''}}},window:{supabaseClient:{from:table=>query(db[table]||[])}}};
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../personnel-operations.js'),'utf8'),context);
    await context.window.fetchPersonnelOperations();
    assert.match(el('personnel-performance-tbody').innerHTML,/Test Fabrikası/);
    assert.match(el('personnel-operation-tbody').innerHTML,/Tarihsel kayıt/);
    await context.window.fetchPersonnelPayrollOverview();
    assert.match(el('personnel-payroll-tbody').innerHTML,/₺500,00/);
    assert.doesNotMatch(el('personnel-payroll-tbody').innerHTML,/₺-500/);
    const source=fs.readFileSync(path.join(__dirname,'../data-services.js'),'utf8');
    const start=source.indexOf('let soforFinanceRequest');const end=source.indexOf('async function fetchTaseronFinans',start);
    vm.runInContext(source.slice(start,end),context);
    await context.fetchSoforFinans();
    assert.match(el('per-sofor-finans-tbody').innerHTML,/Test Şoför/);
    el('personel-ay').value='2026-08';await context.fetchSoforFinans();
    assert.match(el('per-sofor-finans-tbody').innerHTML,/İşlem bulunmuyor/);
    console.log('ERP kapsam, tarife, kronolojik KM, fabrika ve avans regresyonları başarılı.');
})().catch(error=>{console.error(error);process.exitCode=1;});
