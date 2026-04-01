window.fetchDashboardData = async function () {
    const conn = window.checkSupabaseConnection();
    if (!conn.ok) {
        console.error("[fetchDashboardData] Bağlantı Hatası:", conn.msg);
        return;
    }
    
    try {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const future30Str = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const y = today.getFullYear(), m = String(today.getMonth() + 1).padStart(2, '0');
        const monthStart = `${y}-${m}-01`;
        const monthEnd = `${y}-${m}-${new Date(y, today.getMonth() + 1, 0).getDate()}`;
        
        // 1. Paralel, Korumalı Veri Çekimi
        const [
            resAraclar,
            resSoforler,
            resCariler,
            resMusteriler,
            resPoliceler,
            resYakitlar,
            resBakimlar,
            resHakedisTaseron,
            resHakedisServis
        ] = await Promise.allSettled([
            window.supabaseClient.from('araclar').select('id, plaka, mulkiyet_durumu, sigorta_bitis, kasko_bitis, vize_bitis, koltuk_bitis, guncel_km, son_yag_km'),
            window.supabaseClient.from('soforler').select('id', { count: 'exact', head: true }),
            window.supabaseClient.from('cariler').select('id', { count: 'exact', head: true }),
            window.supabaseClient.from('musteriler').select('id', { count: 'exact', head: true }),
            window.supabaseClient.from('arac_policeler').select('bitis_tarihi, police_turu, toplam_tutar, arac_id').gte('bitis_tarihi', todayStr).lte('bitis_tarihi', future30Str),
            window.supabaseClient.from('yakit_takip').select('toplam_tutar, tarih').gte('tarih', monthStart).lte('tarih', monthEnd),
            window.supabaseClient.from('arac_bakimlari').select('toplam_tutar, islem_tarihi').gte('islem_tarihi', monthStart).lte('islem_tarihi', monthEnd),
            window.supabaseClient.from('taseron_hakedis').select('net_hakedis, sefer_tarihi').gte('sefer_tarihi', monthStart).lte('sefer_tarihi', monthEnd),
            window.supabaseClient.from('musteri_servis_puantaj').select('gunluk_ucret, tarih').gte('tarih', monthStart).lte('tarih', monthEnd)
        ]);

        const ext = (res) => (res.status === 'fulfilled' && res.value?.data) ? res.value.data : [];
        const cnt = (res) => (res.status === 'fulfilled' && res.value?.count) ? res.value.count : 0;

        const araclar = ext(resAraclar);
        const policeler = ext(resPoliceler);
        const yakitlar = ext(resYakitlar);
        const bakimlar = ext(resBakimlar);
        const hakedisler_taseron = ext(resHakedisTaseron);
        const hakedisler_servis = ext(resHakedisServis);

        const soforCount = cnt(resSoforler);
        const cariCount = cnt(resCariler);
        const musteriCount = cnt(resMusteriler);

        const fmt = v => '₺' + new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(v);
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        // === KPI GÜNCELLEMELERİ ===
        setEl('kpi-arac', araclar.length);
        setEl('kpi-sofor', soforCount);
        setEl('kpi-cari', cariCount);
        setEl('kpi-musteri', musteriCount);

        let kritikEvrak = 0;
        let expiring15Days = 0;
        const future15Str = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        araclar.forEach(a => {
            let is30 = false;
            let is15 = false;
            ['sigorta_bitis', 'kasko_bitis', 'vize_bitis', 'koltuk_bitis'].forEach(f => {
                if (a[f] && a[f] <= future30Str && a[f] >= todayStr) is30 = true;
                if (a[f] && a[f] <= future15Str && a[f] >= todayStr) is15 = true;
            });
            if (is30) kritikEvrak++;
            if (is15) expiring15Days++;
        });
        setEl('kpi-evrak', kritikEvrak);

        if (expiring15Days > 0 && typeof window.Toast !== 'undefined') {
            setTimeout(() => {
                window.Toast.warning(`⚠️ Dikkat: ${expiring15Days} aracın vize, kasko veya sigorta süresi dolmak üzere!`);
            }, 2000);
        }

        const sumYakit = yakitlar.reduce((s, y) => s + (y.toplam_tutar || 0), 0);
        const sumBakim = bakimlar.reduce((s, b) => s + (b.toplam_tutar || 0), 0);
        
        const sumHakedisTaseron = hakedisler_taseron.reduce((s, h) => s + (h.net_hakedis || 0), 0);
        const sumCiro = sumHakedisTaseron + hakedisler_servis.reduce((s, h) => s + (h.gunluk_ucret || 0), 0);
        
        setEl('kpi-ciro', fmt(sumCiro));
        setEl('kpi-gider', fmt(sumYakit + sumBakim));
        setEl('kpi-taseron-hakedis', fmt(sumHakedisTaseron)); 

        // === DONUT CHART UPDATE ===
        const ozmal = araclar.filter(a => a.mulkiyet_durumu === 'ÖZMAL').length;
        const taseron = araclar.filter(a => a.mulkiyet_durumu === 'TAŞERON').length;
        const kiralik = araclar.length - ozmal - taseron;
        setEl('fleet-ozmal-count', ozmal);
        setEl('fleet-taseron-count', taseron);
        setEl('fleet-kiralik-count', kiralik);
        setEl('donut-total', araclar.length);

        const donutCanvas = document.getElementById('fleetDonutChart');
        if (donutCanvas && window.Chart) {
            if (window._fleetDonutChart) window._fleetDonutChart.destroy();
            window._fleetDonutChart = new Chart(donutCanvas, {
                type: 'doughnut',
                data: {
                    labels: ['Özmal', 'Taşeron', 'Kiralık'],
                    datasets: [{ data: [ozmal, taseron, kiralik], backgroundColor: ['#f97316', '#3b82f6', '#a855f7'], borderWidth: 0, cutout: '78%' }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        }

        // === Redesigned Widgets Population ===
        
        // 1. Evrak Bitişleri (Gelişmiş Kart Görünümü)
        try {
            renderEvrakWidget(araclar, future30Str, todayStr, today);
        } catch(ee) { console.error('Evrak Render Hata:', ee); }

        // 2. Yaklaşan Ödemeler (Finansal Odaklı Tasarım)
        try {
            // Policeler'e plaka bilgisini ekle (Join hatası yerine manual map)
            const plakaMap = {};
            araclar.forEach(a => { plakaMap[a.id] = a.plaka; });
            const policelerEnriched = policeler.map(p => ({ ...p, plaka: plakaMap[p.arac_id] || '-' }));
            renderOdemelerWidget(policelerEnriched);
        } catch(eo) { console.error('Ödemeler Render Hata:', eo); }

        // 3. Yağ Bakımı (İlerleme Çubuğu Göstergesi)
        try {
            renderYagBakimWidget(araclar);
        } catch(ey) { console.error('Yağ Bakım Render Hata:', ey); }

        // 4. Activity Feed'i ayrı çağır
        await window.fetchSonAktiviteler(araclar); 

    } catch(e) { 
        console.error('[fetchDashboardData] HATA:', e); 
        if(window.Toast) window.Toast.error('Pano yüklenirken bir hata oluştu.');
    }
};

// === Widget Render Fonksiyonları (Top-Level) ===

function renderEvrakWidget(araclar, limitDate, todayStr, todayObj) {
    const el = document.getElementById('evrak-bitis-list');
    if (!el) return;

    const items = [];
    araclar.forEach(a => {
        ['sigorta_bitis', 'kasko_bitis', 'vize_bitis', 'koltuk_bitis'].forEach(f => {
            if (a[f] && a[f] <= limitDate && a[f] >= todayStr) {
                items.push({ 
                    plaka: a.plaka, 
                    tur: f.replace('_bitis', '').toUpperCase(), 
                    tarih: a[f],
                    icon: f === 'vize_bitis' ? 'eye' : 'shield-check'
                });
            }
        });
    });

    items.sort((a,b) => a.tarih.localeCompare(b.tarih));

    if (items.length === 0) {
        el.innerHTML = '<div class="flex flex-col items-center justify-center py-10 opacity-40"><i data-lucide="check-circle" class="w-8 h-8 mb-2"></i><span class="text-[10px] font-bold uppercase tracking-widest text-center">Tüm Evraklar Güncel</span></div>';
    } else {
        el.innerHTML = items.slice(0, 8).map(i => {
            const days = Math.ceil((new Date(i.tarih) - todayObj) / 86400000);
            const isCritical = days <= 5;
            const color = isCritical ? 'red' : 'yellow';
            const colorClass = isCritical ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400';
            
            return `
            <div class="group relative flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-2xl mb-2 hover:bg-white/10 transition-all cursor-default shadow-sm hover:shadow-lg">
                <div class="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl ${colorClass} group-hover:scale-110 transition-transform">
                    <i data-lucide="${i.icon}" class="w-5 h-5"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-0.5">
                        <span class="text-xs font-black text-white group-hover:text-orange-400 transition-colors">${i.plaka}</span>
                        <span class="text-[10px] font-bold ${isCritical ? 'text-red-500 bg-red-500/10' : 'text-yellow-500 bg-yellow-500/10'} px-2 py-0.5 rounded-full">${days <= 0 ? 'BUGÜN' : days + ' GÜN'}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-[10px] font-medium text-gray-500 uppercase tracking-tighter">${i.tur} POLİÇESİ</span>
                        <span class="text-[10px] font-mono text-gray-600">${new Date(i.tarih).toLocaleDateString('tr-TR')}</span>
                    </div>
                </div>
            </div>`;
        }).join('');
    }
    if (window.lucide) window.lucide.createIcons();
}

function renderOdemelerWidget(policeler) {
    const el = document.getElementById('upcoming-payments-list');
    if (!el) return;

    if (!policeler || policeler.length === 0) {
        el.innerHTML = '<div class="flex flex-col items-center justify-center py-10 opacity-40"><i data-lucide="wallet" class="w-8 h-8 mb-2"></i><span class="text-[10px] font-bold uppercase tracking-widest text-center">Bekleyen Ödeme Yok</span></div>';
    } else {
        const sorted = [...policeler].sort((a,b) => a.bitis_tarihi.localeCompare(b.bitis_tarihi));
        el.innerHTML = sorted.slice(0, 8).map(p => {
            const plaka = p.plaka || '-';
            const dateObj = new Date(p.bitis_tarihi);
            const day = dateObj.getDate();
            const month = dateObj.toLocaleDateString('tr-TR', { month: 'short' }).toUpperCase();
            
            return `
            <div class="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/5 rounded-2xl mb-2 hover:bg-blue-500/5 hover:border-blue-500/20 transition-all group shadow-sm">
                <div class="w-10 h-10 rounded-xl bg-blue-500/10 flex flex-col items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all shadow-lg shadow-blue-500/10">
                    <span class="text-[11px] font-black leading-none">${day}</span>
                    <span class="text-[9px] font-bold leading-none mt-0.5">${month}</span>
                </div>
                <div class="flex-1">
                    <div class="text-xs font-black text-gray-200 group-hover:text-blue-300 transition-colors">${plaka}</div>
                    <div class="text-[10px] text-gray-500 font-medium">${p.police_turu} Yenileme</div>
                </div>
                <div class="text-right">
                    <div class="text-[10px] font-black text-blue-400">₺${(p.toplam_tutar || 0).toLocaleString('tr-TR')}</div>
                    <div class="text-[9px] text-gray-700 font-mono italic">Yenileme Bedeli</div>
                </div>
            </div>`;
        }).join('');
    }
    if (window.lucide) window.lucide.createIcons();
}

function renderYagBakimWidget(araclar) {
    const el = document.getElementById('yag-bakim-list');
    if (!el) return;

    const items = araclar.filter(a => a.guncel_km > 0 && a.son_yag_km > 0 && (a.guncel_km - a.son_yag_km) > 5000)
        .map(a => {
            const usage = a.guncel_km - a.son_yag_km;
            const pct = Math.min(100, Math.max(0, (usage / 10000) * 100));
            return { plaka: a.plaka, usage, pct };
        })
        .sort((a,b) => b.usage - a.usage);

    if (items.length === 0) {
        el.innerHTML = '<div class="flex flex-col items-center justify-center py-10 opacity-40"><i data-lucide="droplet" class="w-8 h-8 mb-2"></i><span class="text-[10px] font-bold uppercase tracking-widest text-center">Bakım Limitine Yaklaşan Araç Yok</span></div>';
    } else {
        el.innerHTML = items.slice(0, 6).map(i => {
            const isCritical = i.usage >= 9500;
            const isWarning = i.usage >= 8000;
            const barColor = isCritical ? 'bg-red-500' : (isWarning ? 'bg-orange-500' : 'bg-emerald-500');
            const shadowColor = isCritical ? 'shadow-red-500/20' : (isWarning ? 'shadow-orange-500/20' : 'shadow-emerald-500/20');
            const textColor = isCritical ? 'text-red-500' : (isWarning ? 'text-orange-500' : 'text-emerald-500');
            
            return `
            <div class="p-4 bg-white/[0.02] border border-white/5 rounded-2xl mb-3 hover:bg-white/5 transition-all shadow-sm">
                <div class="flex justify-between items-end mb-2">
                    <div>
                        <div class="text-[10px] font-black text-white">${i.plaka}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-[11px] font-bold text-gray-300 font-mono">${i.usage.toLocaleString('tr-TR')} / 10K</div>
                    </div>
                </div>
                <div class="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div class="h-full ${barColor} ${shadowColor} shadow-lg transition-all duration-1000" style="width: ${i.pct}%"></div>
                </div>
                <div class="flex justify-between mt-2">
                    <span class="text-[9px] font-black tracking-tighter uppercase text-gray-500">DURUM: ${isCritical ? 'KRİTİK' : (isWarning ? 'UYARI' : 'NORMAL')}</span>
                    <span class="text-[10px] font-black ${textColor}">%${Math.round(i.pct)}</span>
                </div>
            </div>`;
        }).join('');
    }
    if (window.lucide) window.lucide.createIcons();
}

window.fetchSonAktiviteler = async function(araclarDB = []) {
    const tbody = document.getElementById('son-islemler-tbody');
    if (!tbody) return;
    
    try {
        const conn = window.checkSupabaseConnection();
        if (!conn.ok) return;

        const plakaMap = {};
        araclarDB.forEach(a => { plakaMap[a.id] = a.plaka; });

        const typeColors = {
            'Yakıt': 'bg-blue-500/10 text-blue-400',
            'Bakım': 'bg-orange-500/10 text-orange-400',
            'Maaş': 'bg-yellow-500/10 text-yellow-400',
            'Cari Fatura': 'bg-red-500/10 text-red-400',
            'Poliçe': 'bg-pink-500/10 text-pink-400'
        };

        const [yakitRes, bakimRes, maasRes, fatRes, policeRes] = await Promise.allSettled([
            window.supabaseClient.from('yakit_takip').select('tarih, toplam_tutar, arac_id').order('tarih', {ascending:false}).limit(20),
            window.supabaseClient.from('arac_bakimlari').select('islem_tarihi, toplam_tutar, aciklama, arac_id').order('islem_tarihi', {ascending:false}).limit(20),
            window.supabaseClient.from('sofor_maas_bordro').select('donem, net_maas, soforler(ad_soyad)').limit(20),
            window.supabaseClient.from('cari_faturalar').select('fatura_tarihi, toplam_tutar, aciklama, cariler(unvan)').order('fatura_tarihi', {ascending:false}).limit(20),
            window.supabaseClient.from('arac_policeler').select('baslangic_tarihi, toplam_tutar, police_turu, arac_id').limit(20)
        ]);

        const getD = (res) => (res.status === 'fulfilled' && res.value?.data) ? res.value.data : [];
        const activities = [];
        
        getD(yakitRes).forEach(r => {
            const plaka = plakaMap[r.arac_id] || 'Bilinmeyen';
            activities.push({tarih:r.tarih, tur:'Yakıt', detay:`${plaka} - Yakıt Alımı`, tutar:r.toplam_tutar});
        });
        
        getD(bakimRes).forEach(r => {
            const plaka = plakaMap[r.arac_id] || 'Bilinmeyen';
            activities.push({tarih:r.islem_tarihi, tur:'Bakım', detay:`${plaka} - ${(r.aciklama||'Bakım/Servis').substring(0,35)}`, tutar:r.toplam_tutar});
        });
        
        getD(maasRes).forEach(r => {
            activities.push({tarih: r.donem ? r.donem+'-05' : '-', tur:'Maaş', detay:`${r.soforler?.ad_soyad||'Personel'} Maaş Tahakkuku`, tutar:r.net_maas});
        });
        
        getD(fatRes).forEach(r => {
            activities.push({tarih:r.fatura_tarihi, tur:'Cari Fatura', detay:`${r.cariler?.unvan||'Cari'} - ${(r.aciklama||'').substring(0,25)}`, tutar:r.toplam_tutar});
        });
        
        getD(policeRes).forEach(r => {
            const plaka = plakaMap[r.arac_id] || 'Bilinmeyen';
            activities.push({tarih:r.baslangic_tarihi, tur:'Poliçe', detay:`${plaka} ${r.police_turu}`, tutar:r.toplam_tutar});
        });

        activities.sort((a,b) => {
            if(!a.tarih || a.tarih === '-') return 1;
            if(!b.tarih || b.tarih === '-') return -1;
            return new Date(b.tarih) - new Date(a.tarih);
        });

        const top = activities.slice(0, 50); 
        if (top.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="py-12 text-center text-xs text-gray-500 italic">Henüz sistemde kaydedilmiş bir aktivite bulunmuyor.</td></tr>';
            return;
        }

        const fmtT = (n) => n != null ? '₺' + parseFloat(n).toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2}) : '₺0,00';
        
        tbody.innerHTML = top.map(a => {
            const colorClass = typeColors[a.tur] || 'bg-gray-500/10 text-gray-400';
            return `<tr class="hover:bg-white/5 transition-all border-b border-white/5 group">
                <td class="py-4 px-3 text-xs text-gray-500 whitespace-nowrap font-mono">${a.tarih || '-'}</td>
                <td class="py-4 px-3"><span class="px-2 py-1 ${colorClass} text-[10px] uppercase font-heavy rounded-md whitespace-nowrap shadow-sm">${a.tur}</span></td>
                <td class="py-4 px-3 text-xs font-semibold text-gray-300 truncate max-w-[220px]" title="${a.detay}">${a.detay}</td>
                <td class="py-4 px-3 text-sm font-black text-right text-white tabular-nums">${fmtT(a.tutar)}</td>
            </tr>`;
        }).join('');
    } catch(e) { 
        console.error('[fetchSonAktiviteler] HATA:', e); 
        tbody.innerHTML = '<tr><td colspan="4" class="py-8 text-center text-xs text-red-500 italic">Veriler yüklenirken hata oluştu.</td></tr>';
    }
};

window.fetchDashboard = window.fetchDashboardData;
