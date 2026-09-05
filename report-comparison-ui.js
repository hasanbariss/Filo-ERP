(function () {
    'use strict';

    var state = { request: 0, period: null, current: null, previous: null, summary: null, previousSummary: null, vehicles: [], vehicleMeta: [], priceDefinitions: [], payroll: [], customers: [], caris: [] };

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>'"]/g, function (char) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char];
        });
    }
    function fmtMoney(value) { return '₺' + Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function fmtNumber(value, digits) { return Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: digits || 0, maximumFractionDigits: digits || 0 }); }
    function setText(id, value) { var el = document.getElementById(id); if (el) el.textContent = value; }
    function changeMarkup(current, previous, inverse) {
        var change = window.ReportAnalytics.percentChange(current, previous);
        if (change === null) return '<span class="report-change is-neutral">Veri yok</span>';
        var favourable = inverse ? change <= 0 : change >= 0;
        var tone = change === 0 ? 'is-neutral' : favourable ? 'is-positive' : 'is-negative';
        var arrow = change > 0 ? '▲' : change < 0 ? '▼' : '•';
        return '<span class="report-change ' + tone + '">' + arrow + ' %' + fmtNumber(Math.abs(change), 1) + '</span>';
    }
    function setTrend(id, current, previous, inverse) {
        var el = document.getElementById(id);
        if (!el) return;
        var change = window.ReportAnalytics.percentChange(current, previous);
        el.className = 'report-change ' + (change === null || change === 0 ? 'is-neutral' : (inverse ? change <= 0 : change >= 0) ? 'is-positive' : 'is-negative');
        el.textContent = change === null ? 'Karşılaştırma yok' : (change > 0 ? '▲ ' : change < 0 ? '▼ ' : '• ') + '%' + fmtNumber(Math.abs(change), 1);
    }
    function setCard(prefix, current, previous, inverse) {
        setText(prefix, fmtMoney(current));
        setText(prefix + '-prev', state.period.previousLabel + ' ' + fmtMoney(previous));
        setTrend(prefix + '-trend', current, previous, inverse);
    }
    async function rangeQuery(table, columns, field, start, end) {
        var rows = [];
        var pageSize = 1000;
        for (var from = 0; ; from += pageSize) {
            var response = await window.supabaseClient.from(table).select(columns).gte(field, start).lte(field, end).range(from, from + pageSize - 1);
            if (response && response.error) throw response.error;
            var batch = response && Array.isArray(response.data) ? response.data : [];
            rows = rows.concat(batch);
            if (batch.length < pageSize) break;
        }
        return { data: rows, error: null };
    }
    async function allRows(table, columns) {
        var rows = [];
        var pageSize = 1000;
        for (var from = 0; ; from += pageSize) {
            var response = await window.supabaseClient.from(table).select(columns).range(from, from + pageSize - 1);
            if (response && response.error) throw response.error;
            var batch = response && Array.isArray(response.data) ? response.data : [];
            rows = rows.concat(batch);
            if (batch.length < pageSize) break;
        }
        return { data: rows, error: null };
    }
    async function vehicleRows() {
        var response = await window.supabaseClient.from('araclar').select('id, plaka, arac_sinifi, mulkiyet_durumu');
        if (response && response.error && /arac_sinifi|column|schema cache/i.test(response.error.message || '')) {
            response = await window.supabaseClient.from('araclar').select('id, plaka, mulkiyet_durumu');
        }
        if (response && response.error) throw response.error;
        return response;
    }
    async function serviceRangeQuery(start, end) {
        try {
            return await rangeQuery('musteri_servis_puantaj', 'musteri_id, arac_id, bolge, vardiya, tek, cikis_8, giris_2030, mesai, gunluk_ucret', 'tarih', start, end);
        } catch (error) {
            if (!/cikis_8|giris_2030|mesai|column|schema cache/i.test(error.message || '')) throw error;
            return rangeQuery('musteri_servis_puantaj', 'musteri_id, arac_id, bolge, vardiya, tek, gunluk_ucret', 'tarih', start, end);
        }
    }
    async function priceRows() {
        try {
            return await allRows('musteri_arac_tanimlari', 'id, musteri_id, arac_id, bolge, donem, vardiya_fiyat, tek_fiyat, cikis_8_fiyat, giris_2030_fiyat, mesai_fiyat');
        } catch (error) {
            if (!/cikis_8_fiyat|giris_2030_fiyat|mesai_fiyat|column|schema cache/i.test(error.message || '')) throw error;
            return allRows('musteri_arac_tanimlari', 'id, musteri_id, arac_id, bolge, donem, vardiya_fiyat, tek_fiyat');
        }
    }
    async function safe(promise, label) {
        try {
            var response = await promise;
            if (response && response.error) throw response.error;
            return response && Array.isArray(response.data) ? response.data : [];
        } catch (error) {
            console.warn('[Raporlar] ' + label + ' alınamadı:', error && error.message || error);
            return [];
        }
    }
    function updateColumnHead(tableId, index, label) {
        var th = document.querySelector('#' + tableId + ' thead th:nth-child(' + index + ')');
        if (th) th.textContent = label;
    }

    function renderSummary() {
        var current = state.summary;
        var previous = state.previousSummary;
        setCard('rapor-yakit', current.fuelCost, previous.fuelCost, true);
        setCard('rapor-bakim', current.maintenance, previous.maintenance, true);
        setCard('rapor-police', current.policies, previous.policies, true);
        setCard('rapor-maas', current.payroll, previous.payroll, true);
        setCard('rapor-avans', current.advances, previous.advances, true);
        setCard('rapor-ciro', current.accrual, previous.accrual, false);
        setText('rapor-litre', fmtNumber(current.fuelLiters, 1) + ' L');
        setText('rapor-litre-prev', state.period.previousLabel + ' ' + fmtNumber(previous.fuelLiters, 1) + ' L');
        setTrend('rapor-litre-trend', current.fuelLiters, previous.fuelLiters, true);
        setText('rapor-toplam-gider', fmtMoney(current.totalExpense));
        setText('rapor-toplam-gider-prev', state.period.previousLabel + ' ' + fmtMoney(previous.totalExpense));
        setTrend('rapor-toplam-gider-trend', current.totalExpense, previous.totalExpense, true);
        setText('rapor-kart-harcama', fmtMoney(current.cardSpend));
        setText('rapor-kart-harcama-prev', state.period.previousLabel + ' ' + fmtMoney(previous.cardSpend));
        setTrend('rapor-kart-harcama-trend', current.cardSpend, previous.cardSpend, true);
        setText('rapor-operasyon', fmtNumber(current.shifts, 0) + ' / ' + fmtNumber(current.trips, 0));
        setText('rapor-operasyon-prev', state.period.previousLabel + ' ' + fmtNumber(previous.shifts, 0) + ' / ' + fmtNumber(previous.trips, 0));
        setTrend('rapor-operasyon-trend', current.operations, previous.operations, false);
        setText('report-period-copy', state.period.label + ' ile ' + state.period.previousLabel + ' arasındaki finansal ve operasyonel farklar.');
        setText('report-general-current-head', state.period.label);
        setText('report-general-previous-head', state.period.previousLabel);
    }

    function renderGeneral() {
        var tbody = document.getElementById('rapor-gelir-gider-tbody');
        if (!tbody) return;
        var c = state.summary, p = state.previousSummary;
        var rows = [
            { label: 'Taşeron Hakediş', type: 'GELİR', current: c.contractorAccrual, previous: p.contractorAccrual, inverse: false },
            { label: 'Servis / Cari Hakediş', type: 'GELİR', current: c.serviceAccrual, previous: p.serviceAccrual, inverse: false },
            { label: 'Toplam Cari Hakediş', type: 'TOPLAM', current: c.accrual, previous: p.accrual, inverse: false },
            { label: 'Yakıt Gideri', type: 'GİDER', current: c.fuelCost, previous: p.fuelCost, inverse: true },
            { label: 'Bakım / Onarım', type: 'GİDER', current: c.maintenance, previous: p.maintenance, inverse: true },
            { label: 'Sigorta / Poliçe', type: 'GİDER', current: c.policies, previous: p.policies, inverse: true },
            { label: 'Personel Maaşı', type: 'GİDER', current: c.payroll, previous: p.payroll, inverse: true },
            { label: 'Avans / Kesinti', type: 'GİDER', current: c.advances, previous: p.advances, inverse: true },
            { label: 'Kredi Kartı Hareketi', type: 'BİLGİ', current: c.cardSpend, previous: p.cardSpend, inverse: true },
            { label: 'Toplam Filo Gideri', type: 'TOPLAM', current: c.totalExpense, previous: p.totalExpense, inverse: true },
            { label: 'Faaliyet Farkı', type: 'SONUÇ', current: c.operatingDifference, previous: p.operatingDifference, inverse: false }
        ];
        tbody.innerHTML = rows.map(function (row) {
            return '<tr><td><strong>' + row.label + '</strong></td><td class="is-center"><span class="report-kind is-' + row.type.toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ş/g, 's') + '">' + row.type + '</span></td><td class="is-number">' + fmtMoney(row.current) + '</td><td class="is-number">' + fmtMoney(row.previous) + '</td><td class="is-number">' + changeMarkup(row.current, row.previous, row.inverse) + '</td></tr>';
        }).join('');

        var expenseRows = rows.slice(3, 8);
        var topCategory = expenseRows.reduce(function (top, row) { return !top || row.current > top.current ? row : top; }, null);
        if (topCategory) { setText('highlight-top-category', topCategory.label); setText('highlight-top-category-val', fmtMoney(topCategory.current)); }
        setText('highlight-active-count', state.vehicles.filter(function (row) { return row.current.total > 0; }).length);
        var topVehicle = state.vehicles[0];
        setText('highlight-top-arac', topVehicle ? topVehicle.plate : '—');
        setText('highlight-top-arac-val', topVehicle ? fmtMoney(topVehicle.current.total) : fmtMoney(0));
        renderCharts(expenseRows);
    }

    function renderCharts(expenseRows) {
        if (!window.Chart) return;
        var textColor = getComputedStyle(document.documentElement).getPropertyValue('--erp-text-3').trim() || '#7e8993';
        var ctx = document.getElementById('raporGelirGiderChart');
        if (ctx) {
            if (window._raporGelirChart) window._raporGelirChart.destroy();
            window._raporGelirChart = new Chart(ctx, { type: 'doughnut', data: { labels: expenseRows.map(function (r) { return r.label; }), datasets: [{ data: expenseRows.map(function (r) { return r.current; }), backgroundColor: ['#ef6657','#169a9b','#7a5bb8','#c8842f','#3178c6'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { position: 'right', labels: { color: textColor, boxWidth: 8, usePointStyle: true } } } } });
        }
        var ctx2 = document.getElementById('raporAracHarcamaChart');
        if (ctx2) {
            if (window._raporAracChart) window._raporAracChart.destroy();
            var top = state.vehicles.slice(0, 10);
            window._raporAracChart = new Chart(ctx2, { type: 'bar', data: { labels: top.map(function (r) { return r.plate; }), datasets: [{ label: state.period.label, data: top.map(function (r) { return r.current.total; }), backgroundColor: '#ef6657' }, { label: state.period.previousLabel, data: top.map(function (r) { return r.previous.total; }), backgroundColor: '#aab3bb' }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: textColor } } }, scales: { x: { grid: { color: 'rgba(127,137,147,.12)' }, ticks: { color: textColor } }, y: { grid: { display: false }, ticks: { color: textColor } } } } });
        }
    }

    function renderVehicles() {
        var tbody = document.getElementById('rapor-arac-tbody');
        if (!tbody) return;
        updateColumnHead('rapor-arac-table', 7, state.period.label + ' Net');
        updateColumnHead('rapor-arac-table', 8, state.period.previousLabel + ' Net');
        if (!state.vehicles.length) { tbody.innerHTML = '<tr><td colspan="9"><div class="empty-state">Bu iki dönemde araç geliri veya gideri bulunamadı.</div></td></tr>'; return; }
        tbody.innerHTML = state.vehicles.map(function (row) { return '<tr><td><strong>' + esc(row.plate) + '</strong><small class="report-vehicle-class">' + esc(row.vehicleClass || 'SINIFLANDIRILMAMIŞ') + '</small></td><td class="is-number is-income">' + fmtMoney(row.current.revenue) + '</td><td class="is-number">' + fmtMoney(row.current.fuel) + '</td><td class="is-number">' + fmtMoney(row.current.maintenance) + '</td><td class="is-number">' + fmtMoney(row.current.policies) + '</td><td class="is-number is-emphasis">' + fmtMoney(row.current.total) + '</td><td class="is-number ' + (row.current.net < 0 ? 'is-negative' : 'is-positive') + '">' + fmtMoney(row.current.net) + '</td><td class="is-number">' + fmtMoney(row.previous.net) + '</td><td class="is-number">' + changeMarkup(row.current.net, row.previous.net, false) + '</td></tr>'; }).join('');
    }

    function renderPayroll() {
        var tbody = document.getElementById('rapor-personel-tbody');
        if (!tbody) return;
        updateColumnHead('rapor-personel-table', 5, state.period.label + ' Ödeme');
        updateColumnHead('rapor-personel-table', 6, state.period.previousLabel + ' Ödeme');
        if (!state.payroll.length) { tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">Bu iki dönemde bordro kaydı bulunamadı.</div></td></tr>'; return; }
        tbody.innerHTML = state.payroll.map(function (row) {
            var current = row.current || {};
            return '<tr><td><strong>' + esc(row.name) + '</strong></td><td class="is-number">' + fmtMoney(current.net_maas) + '</td><td class="is-number">' + fmtMoney(current.avans) + '</td><td class="is-number">' + fmtMoney(Number(current.ceza || 0) + Number(current.haciz || 0)) + '</td><td class="is-number is-emphasis">' + fmtMoney(row.currentPayment) + '</td><td class="is-number">' + fmtMoney(row.previousPayment) + '</td><td class="is-number">' + changeMarkup(row.currentPayment, row.previousPayment, false) + '</td></tr>';
        }).join('');
    }

    function renderCustomers() {
        var tbody = document.getElementById('rapor-musteri-tbody');
        if (!tbody) return;
        updateColumnHead('rapor-musteri-table', 4, state.period.label + ' Hizmet Bedeli');
        updateColumnHead('rapor-musteri-table', 5, state.period.previousLabel + ' Hizmet Bedeli');
        if (!state.customers.length) { tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">Bu iki dönemde müşteri puantajı bulunamadı.</div></td></tr>'; return; }
        tbody.innerHTML = state.customers.map(function (row, customerIndex) {
            var ownershipGroups=window.ReportAnalytics.groupServiceOwnership(row.details);
            var missingClass=row.details.filter(function(item){return item.vehicleClass==='SINIFLANDIRILMAMIŞ';});
            var breakdown='<div class="customer-service-breakdown">'+ownershipGroups.map(function(item){return '<span><small>'+esc(item.ownership)+'</small><b>'+fmtMoney(item.gross)+'</b></span>';}).join('')+'<span class="service-total"><small>GENEL TOPLAM</small><b>'+fmtMoney(row.current.accrual)+'</b></span></div>';

            var summary = '<tr class="report-customer-row"><td><button type="button" class="report-customer-toggle" onclick="window.toggleReportCustomer(' + customerIndex + ')"><i data-lucide="chevron-right"></i><span><strong>' + esc(row.name) + '</strong><small>' + row.details.length + ' araç / bölge kaydı</small></span></button></td><td class="is-center">' + fmtNumber(row.current.shifts, 0) + '</td><td class="is-center">' + fmtNumber(row.current.trips, 0) + '</td><td class="is-number is-emphasis">' + breakdown + '</td><td class="is-number">' + fmtMoney(row.previous.accrual) + '</td><td class="is-number">' + changeMarkup(row.current.accrual, row.previous.accrual, false) + '</td><td class="is-center"><button class="report-detail-button" type="button" onclick="window.toggleReportCustomer(' + customerIndex + ')">Sınıflar</button></td></tr>';
            var detail = '<tr class="report-customer-detail" data-report-customer="' + customerIndex + '" hidden><td colspan="7"><div class="report-customer-detail-panel"><p>Hizmet bedeli müşteri tarifelerinden hesaplanır; taşeron ödeme maliyeti değildir. Kesilmiş faturalar harici muhasebe / Excel’de takip edilir.</p>'+(missingClass.length?'<p class="customer-class-warning">'+missingClass.length+' araç / bölge kaydında sınıf eksik. Bu hizmetler aşağıda ve toplamlarda yer alır.</p>':'')+ownershipGroups.map(function(group, ownershipIndex){return '<section class="customer-ownership-section"><h4>'+esc(group.ownership)+'</h4><table class="premium-table w-full"><thead><tr><th>Sınıf</th><th>Bölge</th><th>Vardiya</th><th>Vardiya fiyatı</th><th>Tek</th><th>Tek fiyatı</th><th>Diğer</th><th>Hizmet bedeli</th><th>Fiyat</th></tr></thead><tbody>'+window.ReportAnalytics.groupServiceClasses(group.details).map(function(item, classIndex){return '<tr><td>'+esc(item.vehicleClass)+'</td><td>'+esc(Array.from(item.regions).join(', '))+'</td><td>'+fmtNumber(item.shifts,0)+'</td><td>'+fmtMoney(item.vardiyaPrice)+'</td><td>'+fmtNumber(item.trips,0)+'</td><td>'+fmtMoney(item.tekPrice)+'</td><td>'+fmtNumber(item.other,0)+'</td><td>'+fmtMoney(item.gross)+'</td><td><button type="button" class="report-detail-button" onclick="window.openReportClassPrices('+customerIndex+','+ownershipIndex+','+classIndex+')">Düzenle</button></td></tr>';}).join('')+'<tr class="customer-ownership-total"><td colspan="2">'+esc(group.ownership)+' TOPLAMI</td><td>'+fmtNumber(group.shifts,0)+'</td><td></td><td>'+fmtNumber(group.trips,0)+'</td><td></td><td>'+fmtNumber(group.other,0)+'</td><td>'+fmtMoney(group.gross)+'</td><td></td></tr></tbody></table></section>';}).join('')+'<p class="customer-factory-total">Fabrika genel toplamı: '+fmtMoney(row.current.accrual)+'</p><details class="report-rate-exceptions"><summary>Araç bazlı tarife düzenle</summary><div class="report-service-head"><span>Araç / sınıf</span><span>Vardiya</span><span>Vardiya fiyatı</span><span>Tek</span><span>Tek fiyatı</span><span>Brüt gelir</span><span></span></div>' + row.details.map(function (item, detailIndex) {
                return '<div class="report-service-line"><span><strong>' + esc(item.plate) + '</strong><small>' + esc(item.vehicleClass) + ' · ' + esc(item.region) + '</small></span><span>' + fmtNumber(item.current.shifts, 0) + '</span><label><span class="sr-only">Vardiya fiyatı</span><input type="number" min="0" step="0.01" data-report-rate="vardiya" data-customer-index="' + customerIndex + '" data-detail-index="' + detailIndex + '" value="' + item.current.vardiyaPrice + '"></label><span>' + fmtNumber(item.current.trips, 0) + '</span><label><span class="sr-only">Tek sefer fiyatı</span><input type="number" min="0" step="0.01" data-report-rate="tek" data-customer-index="' + customerIndex + '" data-detail-index="' + detailIndex + '" value="' + item.current.tekPrice + '"></label><span class="is-money">' + fmtMoney(item.current.gross) + '</span><button type="button" onclick="window.saveReportServicePrices(' + customerIndex + ',' + detailIndex + ',this)"><i data-lucide="save"></i>Kaydet</button></div>';
            }).join('') + '</details></div></td></tr>';
            return summary + detail;
        }).join('');
        if (window.lucide) window.lucide.createIcons();
    }

    var priceEdit = null;
    function priceEditorDialog() {
        var dialog=document.getElementById('report-class-price-dialog');
        if(!dialog){dialog=document.createElement('dialog');dialog.id='report-class-price-dialog';dialog.className='report-price-dialog';dialog.setAttribute('aria-labelledby','report-price-title');dialog.addEventListener('cancel',function(event){if(priceEdit&&priceEdit.busy)event.preventDefault();});document.body.appendChild(dialog);}
        return dialog;
    }
    window.openReportClassPrices = function(customerIndex, ownershipIndex, classIndex) {
        if(priceEdit&&priceEdit.busy)return;
        var customer=state.customers[customerIndex];
        var group=customer&&window.ReportAnalytics.groupServiceOwnership(customer.details)[ownershipIndex];
        var item=group&&window.ReportAnalytics.groupServiceClasses(group.details)[classIndex];
        if(!item)return;
        var rates={vardiya_fiyat:item.vardiyaPrice,tek_fiyat:item.tekPrice};
        priceEdit={customerId:customer.id,period:state.period.value,details:item.details,busy:false,baseline:window.ReportAnalytics.servicePricePlan(state.priceDefinitions,item.details,state.period.value,rates,window.HakedisCalculations.selectPriceDefinition)};
        var dialog=priceEditorDialog();
        dialog.innerHTML='<h2 id="report-price-title">Sınıf fiyatlarını düzenle</h2><p>'+esc(customer.name)+' · '+esc(group.ownership)+' · '+esc(item.vehicleClass)+'</p><p><strong>'+esc(state.period.label)+'</strong> · '+item.vehicles.size+' araç / '+item.details.length+' araç-bölge kaydı</p><div class="report-price-inputs"><label>Vardiya fiyatı (TL)<input id="report-class-shift-price" type="number" min="0" step="0.01" value="'+item.vardiyaPrice+'"></label><label>Tek sefer fiyatı (TL)<input id="report-class-trip-price" type="number" min="0" step="0.01" value="'+item.tekPrice+'"></label></div><p>Bu fiyatlar aşağıdaki araçların yalnızca seçili dönemine uygulanır. Diğer hizmet fiyatları korunur.</p><ul>'+item.details.map(function(detail){return '<li>'+esc(detail.plate)+' · '+esc(detail.region)+'</li>';}).join('')+'</ul><p id="report-price-status" role="status" aria-live="polite"></p><div class="report-price-actions"><button type="button" id="report-price-close">Kapat</button><button type="button" id="report-price-save">Bu döneme uygula</button></div>';
        dialog.querySelector('#report-price-close').onclick=function(){if(!priceEdit.busy)dialog.close();};
        dialog.querySelector('#report-price-save').onclick=window.saveReportClassPrices;
        dialog.showModal();
    };
    window.saveReportClassPrices = async function() {
        if(!priceEdit||priceEdit.busy)return;
        var edit=priceEdit, dialog=priceEditorDialog(), status=dialog.querySelector('#report-price-status');
        var shift=dialog.querySelector('#report-class-shift-price'),trip=dialog.querySelector('#report-class-trip-price');
        if(!shift.value||!trip.value||!shift.checkValidity()||!trip.checkValidity()){status.textContent='İki fiyatı da geçerli, sıfır veya pozitif bir tutar olarak girin.';return;}
        var rates={vardiya_fiyat:Number(shift.value),tek_fiyat:Number(trip.value)};
        var saved=0;
        edit.busy=true;dialog.querySelectorAll('button,input').forEach(function(el){el.disabled=true;});status.textContent='Fiyatlar kontrol ediliyor…';
        try {
            var fresh=await priceRows();
            var plan=window.ReportAnalytics.servicePricePlan(fresh.data,edit.details,edit.period,rates,window.HakedisCalculations.selectPriceDefinition);
            if(plan.some(function(item,index){return item.signature!==edit.baseline[index].signature;}))throw new Error('Tarifeler rapor açıldıktan sonra değişmiş. Raporu yenileyip tekrar düzenleyin.');
            for(var item of plan){
                var response;
                if(item.id){response=await window.supabaseClient.from('musteri_arac_tanimlari').update(item.payload).eq('id',item.id).select('id');}
                else{response=await window.supabaseClient.from('musteri_arac_tanimlari').insert([item.payload]).select('id');}
                if(response.error)throw response.error;
                if(!response.data||response.data.length!==1)throw new Error(item.plate+' kaydı güncellenemedi.');
                saved++;status.textContent=saved+' / '+plan.length+' kayıt kaydedildi.';
            }
            dialog.close();
            if(window.Toast)window.Toast.success(edit.period+' döneminde '+saved+' araç-bölge tarifesi güncellendi.');
        } catch(error) {
            status.textContent=saved+' / '+edit.details.length+' kayıt kaydedildi. '+(error.message||'Kaydetme başarısız.')+' Kapatıp güncel rapor üzerinden yeniden deneyin.';
        } finally {
            edit.busy=false;dialog.querySelector('#report-price-close').disabled=false;
            // Reload after success or partial failure; do not retry stale target definitions.
            await window.fetchRaporlar();
            var index=state.customers.findIndex(function(customer){return customer.id===edit.customerId;});
            var detailRow=document.querySelector('[data-report-customer="'+index+'"]');if(detailRow)detailRow.hidden=false;
        }
    };

    window.getCustomerServiceExport = function() {
        var rows=[];
        state.customers.forEach(function(customer){
            window.ReportAnalytics.groupServiceOwnership(customer.details).forEach(function(group){
                window.ReportAnalytics.groupServiceClasses(group.details).forEach(function(item){rows.push([customer.name,group.ownership,item.vehicleClass,item.shifts,item.vardiyaPrice,item.trips,item.tekPrice,item.other,item.gross]);});
                rows.push([customer.name,group.ownership,'ARA TOPLAM',group.shifts,'',group.trips,'',group.other,group.gross]);
            });
            rows.push([customer.name,'GENEL TOPLAM','',customer.current.shifts,'',customer.current.trips,'',window.ReportAnalytics.groupServiceOwnership(customer.details).reduce(function(sum,g){return sum+g.other;},0),customer.current.accrual]);
        });
        return {headers:['Fabrika','Mülkiyet','Araç sınıfı','Vardiya','Vardiya fiyatı (TL)','Tek','Tek fiyatı (TL)','Diğer','Hizmet bedeli (TL)'],rows:rows};
    };

    window.toggleReportCustomer = function (index) {
        var row = document.querySelector('[data-report-customer="' + index + '"]');
        if (!row) return;
        row.hidden = !row.hidden;
        var icon = row.previousElementSibling && row.previousElementSibling.querySelector('.report-customer-toggle svg');
        if (icon) icon.style.transform = row.hidden ? '' : 'rotate(90deg)';
    };

    window.saveReportServicePrices = async function (customerIndex, detailIndex, button) {
        var customer = state.customers[customerIndex];
        var detail = customer && customer.details[detailIndex];
        if (!detail || !state.period) return;
        var line = button.closest('.report-service-line');
        var vardiyaPrice = Math.max(0, Number(line.querySelector('[data-report-rate="vardiya"]').value) || 0);
        var tekPrice = Math.max(0, Number(line.querySelector('[data-report-rate="tek"]').value) || 0);
        var change=window.ReportAnalytics.servicePricePlan(state.priceDefinitions,[detail],state.period.value,{vardiya_fiyat:vardiyaPrice,tek_fiyat:tekPrice},window.HakedisCalculations.selectPriceDefinition)[0];
        var original = button.innerHTML;
        button.disabled = true;
        button.textContent = 'Kaydediliyor…';
        try {
            var response;
            if (change.id) response = await window.supabaseClient.from('musteri_arac_tanimlari').update(change.payload).eq('id', change.id);
            else response = await window.supabaseClient.from('musteri_arac_tanimlari').insert([change.payload]);
            if (response.error) throw response.error;
            if (window.Toast) window.Toast.success('Dönemsel vardiya ve tek sefer fiyatları kaydedildi.');
            await window.fetchRaporlar();
        } catch (error) {
            console.error('[Raporlar] fiyat kaydetme hatası:', error);
            if (window.Toast) window.Toast.error('Fiyatlar kaydedilemedi: ' + (error.message || 'Bilinmeyen hata'));
            else alert('Fiyatlar kaydedilemedi: ' + (error.message || 'Bilinmeyen hata'));
        } finally {
            button.disabled = false;
            button.innerHTML = original;
            if (window.lucide) window.lucide.createIcons();
        }
    };

    function renderCaris() {
        var tbody = document.getElementById('rapor-cari-tbody');
        if (!tbody) return;
        updateColumnHead('rapor-cari-table', 3, state.period.label + ' Borç');
        updateColumnHead('rapor-cari-table', 4, state.period.label + ' Ödeme');
        updateColumnHead('rapor-cari-table', 5, state.period.label + ' Net');
        updateColumnHead('rapor-cari-table', 6, state.period.previousLabel + ' Net');
        if (!state.caris.length) { tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">Bu iki dönemde cari hareket bulunamadı.</div></td></tr>'; return; }
        tbody.innerHTML = state.caris.map(function (row) { return '<tr><td><strong>' + esc(row.name) + '</strong></td><td><span class="report-kind">' + esc(row.type) + '</span></td><td class="is-number">' + fmtMoney(row.currentDebt) + '</td><td class="is-number">' + fmtMoney(row.currentPayment) + '</td><td class="is-number is-emphasis">' + fmtMoney(row.currentNet) + '</td><td class="is-number">' + fmtMoney(row.previousNet) + '</td><td class="is-number">' + changeMarkup(Math.abs(row.currentNet), Math.abs(row.previousNet), true) + '</td></tr>'; }).join('');
    }

    function renderMileage(payload) {
        var currentKm = 0, previousKm = 0;
        (payload && payload.results || []).forEach(function (row) { if (row.status === 'ready') { currentKm += Number(row.currentKm) || 0; previousKm += Number(row.previousKm) || 0; } });
        var currentConsumption = currentKm > 0 ? state.summary.fuelLiters / currentKm * 100 : null;
        var previousConsumption = previousKm > 0 ? state.previousSummary.fuelLiters / previousKm * 100 : null;
        setText('rapor-km', currentKm > 0 ? fmtNumber(currentKm, 0) + ' km' : '—');
        setText('rapor-km-prev', state.period.previousLabel + ' ' + (previousKm > 0 ? fmtNumber(previousKm, 0) + ' km' : '—'));
        setTrend('rapor-km-trend', currentKm, previousKm, false);
        setText('rapor-tuketim', currentConsumption !== null ? fmtNumber(currentConsumption, 2) + ' L/100 km' : '—');
        setText('rapor-tuketim-prev', state.period.previousLabel + ' ' + (previousConsumption !== null ? fmtNumber(previousConsumption, 2) + ' L/100 km' : '—'));
        setTrend('rapor-tuketim-trend', currentConsumption, previousConsumption, true);
        renderConsumptionSegments(payload);
    }

    function renderConsumptionSegments(payload) {
        var container = document.getElementById('report-consumption-segments');
        if (!container || !window.FuelAnalytics) return;
        var vehicleById = new Map(state.vehicleMeta.map(function (row) { return [String(row.id), row]; }));
        var classByPlate = new Map(state.vehicleMeta.map(function (row) { return [window.FuelAnalytics.normalizePlate(row.plaka), row.arac_sinifi || 'SINIFLANDIRILMAMIŞ']; }));
        var groups = new Map();
        function ensure(name) {
            if (!groups.has(name)) groups.set(name, { name:name, currentKm:0, previousKm:0, currentLiters:0, previousLiters:0, vehicles:new Set() });
            return groups.get(name);
        }
        (payload && payload.results || []).forEach(function (row) {
            if (row.status !== 'ready') return;
            var name = classByPlate.get(window.FuelAnalytics.normalizePlate(row.plate)) || 'SINIFLANDIRILMAMIŞ';
            var group = ensure(name);
            group.currentKm += Number(row.currentKm) || 0;
            group.previousKm += Number(row.previousKm) || 0;
            group.vehicles.add(window.FuelAnalytics.normalizePlate(row.plate));
        });
        (state.current.fuel || []).forEach(function (row) { var vehicle = vehicleById.get(String(row.arac_id)) || {}; ensure(vehicle.arac_sinifi || 'SINIFLANDIRILMAMIŞ').currentLiters += Number(row.litre) || 0; });
        (state.previous.fuel || []).forEach(function (row) { var vehicle = vehicleById.get(String(row.arac_id)) || {}; ensure(vehicle.arac_sinifi || 'SINIFLANDIRILMAMIŞ').previousLiters += Number(row.litre) || 0; });
        var rows = Array.from(groups.values()).filter(function (group) { return group.currentKm > 0 || group.previousKm > 0; });
        if (!rows.length) { container.innerHTML = ''; return; }
        container.innerHTML = '<div class="report-segment-heading"><div><strong>Araç sınıfına göre tüketim</strong><span>16+1, 27+1 ve taksi birbirinden bağımsız karşılaştırılır.</span></div></div><div class="report-segment-grid">' + rows.map(function (group) {
            var current = group.currentKm > 0 ? group.currentLiters / group.currentKm * 100 : null;
            var previous = group.previousKm > 0 ? group.previousLiters / group.previousKm * 100 : null;
            return '<article><span>' + esc(group.name) + '</span><strong>' + (current === null ? '—' : fmtNumber(current, 2) + ' L/100 km') + '</strong><small>' + state.period.previousLabel + ' ' + (previous === null ? '—' : fmtNumber(previous, 2) + ' L/100 km') + '</small>' + changeMarkup(current, previous, true) + '</article>';
        }).join('') + '</div>';
    }

    window.fetchRaporlar = async function () {
        var periodInput = document.getElementById('rapor-ay');
        var ay = periodInput && periodInput.value;
        if (!window.ReportAnalytics || !window.supabaseClient) return;
        if (!ay) {
            var now = new Date();
            var previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            ay = previousMonth.getFullYear() + '-' + String(previousMonth.getMonth() + 1).padStart(2, '0');
            if (periodInput) periodInput.value = ay;
        }
        var request = ++state.request;
        state.period = window.ReportAnalytics.periodBounds(ay);
        var p = state.period;
        var promises = [
            safe(rangeQuery('yakit_takip','toplam_tutar, litre, arac_id, araclar(plaka)','tarih',p.start,p.end),'yakıt'),
            safe(rangeQuery('yakit_takip','toplam_tutar, litre, arac_id, araclar(plaka)','tarih',p.previousStart,p.previousEnd),'önceki yakıt'),
            safe(rangeQuery('arac_bakimlari','toplam_tutar, arac_id, cari_id, araclar(plaka)','islem_tarihi',p.start,p.end),'bakım'),
            safe(rangeQuery('arac_bakimlari','toplam_tutar, arac_id, cari_id, araclar(plaka)','islem_tarihi',p.previousStart,p.previousEnd),'önceki bakım'),
            safe(rangeQuery('arac_policeler','toplam_tutar, arac_id, cari_id, araclar(plaka)','baslangic_tarihi',p.start,p.end),'poliçe'),
            safe(rangeQuery('arac_policeler','toplam_tutar, arac_id, cari_id, araclar(plaka)','baslangic_tarihi',p.previousStart,p.previousEnd),'önceki poliçe'),
            safe(window.supabaseClient.from('sofor_maas_bordro').select('sofor_id, net_maas, avans, ceza, haciz, soforler(ad_soyad)').eq('donem',p.value),'bordro'),
            safe(window.supabaseClient.from('sofor_maas_bordro').select('sofor_id, net_maas, avans, ceza, haciz, soforler(ad_soyad)').eq('donem',p.previousValue),'önceki bordro'),
            safe(rangeQuery('sofor_finans','sofor_id, tutar, islem_turu','tarih',p.start,p.end),'personel finans'),
            safe(rangeQuery('sofor_finans','sofor_id, tutar, islem_turu','tarih',p.previousStart,p.previousEnd),'önceki personel finans'),
            safe(rangeQuery('taseron_hakedis','net_hakedis, anlasilan_tutar','sefer_tarihi',p.start,p.end),'taşeron hakediş'),
            safe(rangeQuery('taseron_hakedis','net_hakedis, anlasilan_tutar','sefer_tarihi',p.previousStart,p.previousEnd),'önceki taşeron hakediş'),
            safe(serviceRangeQuery(p.start,p.end),'müşteri puantajı'),
            safe(serviceRangeQuery(p.previousStart,p.previousEnd),'önceki müşteri puantajı'),
            safe(window.supabaseClient.from('musteriler').select('id, ad'),'müşteriler'),
            safe(window.supabaseClient.from('cariler').select('id, unvan, tur'),'cariler'),
            safe(rangeQuery('cari_faturalar','cari_id, toplam_tutar','fatura_tarihi',p.start,p.end),'cari faturalar'),
            safe(rangeQuery('cari_faturalar','cari_id, toplam_tutar','fatura_tarihi',p.previousStart,p.previousEnd),'önceki cari faturalar'),
            safe(rangeQuery('cari_odemeler','cari_id, tutar','tarih',p.start,p.end),'cari ödemeler'),
            safe(rangeQuery('cari_odemeler','cari_id, tutar','tarih',p.previousStart,p.previousEnd),'önceki cari ödemeler'),
            safe(vehicleRows(),'araçlar'),
            safe(rangeQuery('kredi_karti_islemleri','toplam_tutar','islem_tarihi',p.start,p.end),'kredi kartı hareketleri'),
            safe(rangeQuery('kredi_karti_islemleri','toplam_tutar','islem_tarihi',p.previousStart,p.previousEnd),'önceki kredi kartı hareketleri'),
            safe(priceRows(),'hakediş fiyatları')
        ];
        var r = await Promise.all(promises);
        if (request !== state.request) return;
        state.current = { fuel:r[0], maintenance:r[2], policies:r[4], payroll:r[6], finance:r[8], contractorAccrual:r[10], serviceAccrual:r[12], cardTransactions:r[21] };
        state.previous = { fuel:r[1], maintenance:r[3], policies:r[5], payroll:r[7], finance:r[9], contractorAccrual:r[11], serviceAccrual:r[13], cardTransactions:r[22] };
        state.summary = window.ReportAnalytics.summarize(state.current);
        state.previousSummary = window.ReportAnalytics.summarize(state.previous);
        state.vehicleMeta = r[20];
        state.priceDefinitions = r[23];
        state.customers = window.ReportAnalytics.groupCustomerServices(r[14], r[20], r[12], r[13], r[23], p.value, p.previousValue, window.HakedisCalculations && window.HakedisCalculations.selectPriceDefinition);
        state.vehicles = window.ReportAnalytics.mergeVehicleRevenue(window.ReportAnalytics.groupVehicles(state.current, state.previous, r[20]), state.customers, r[20]);
        state.payroll = window.ReportAnalytics.groupPayroll(r[6], r[7]);
        state.summary.serviceAccrual = state.customers.reduce(function (total, row) { return total + row.current.accrual; }, 0);
        state.previousSummary.serviceAccrual = state.customers.reduce(function (total, row) { return total + row.previous.accrual; }, 0);
        state.summary.accrual = state.summary.contractorAccrual + state.summary.serviceAccrual;
        state.previousSummary.accrual = state.previousSummary.contractorAccrual + state.previousSummary.serviceAccrual;
        state.summary.operatingDifference = state.summary.accrual - state.summary.totalExpense;
        state.previousSummary.operatingDifference = state.previousSummary.accrual - state.previousSummary.totalExpense;
        state.caris = window.ReportAnalytics.groupCaris(r[15], r[16].concat(r[2], r[4]), r[18], r[17].concat(r[3], r[5]), r[19]);
        window._raporData = { ay: p.value, period: p, current: state.current, previous: state.previous, vehicles: state.vehicles, payroll: state.payroll, customers: state.customers, caris: state.caris };
        renderSummary(); renderGeneral(); renderVehicles(); renderPayroll(); renderCustomers(); renderCaris();
        if (window.fetchInfoMobileMileage && r[20].length) {
            setText('rapor-km', 'Yükleniyor…'); setText('rapor-tuketim', 'Yükleniyor…');
            window.fetchInfoMobileMileage(r[20].map(function (row) { return row.plaka; }), { infoStart:p.start+' 00:00', infoEnd:p.end+' 23:59' }, { infoStart:p.previousStart+' 00:00', infoEnd:p.previousEnd+' 23:59' })
                .then(function (payload) { if (request === state.request) renderMileage(payload); })
                .catch(function () { if (request === state.request) renderMileage({ results:[] }); });
        } else renderMileage({ results:[] });
        if (window.lucide) window.lucide.createIcons();
    };

    window.fetchRaporPersonel = function () { renderPayroll(); };
    window.fetchRaporMusteri = function () { renderCustomers(); };
    window.fetchRaporCari = function () { renderCaris(); };
    window.switchRaporTab = function (tab) {
        ['genel','arac','personel','musteri','cari'].forEach(function (name) {
            var button = document.getElementById('rapor-tab-' + name);
            var content = document.getElementById('rapor-content-' + name);
            if (button) {
                button.classList.toggle('active', name === tab);
                button.classList.toggle('bg-orange-500', name === tab);
                button.classList.toggle('text-white', name === tab);
                button.classList.toggle('text-gray-400', name !== tab);
            }
            if (content) {
                content.classList.toggle('hidden', name !== tab);
                content.classList.toggle('block', name === tab);
            }
        });
        if (!state.summary) window.fetchRaporlar();
        if (window.lucide) window.lucide.createIcons();
    };
})();
