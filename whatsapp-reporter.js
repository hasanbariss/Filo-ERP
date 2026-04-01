// ============================================
// ADMIN WHATSAPP RAPORLAMA
// ============================================

window.sendAutoWhatsAppReport = async function() {
    let num = localStorage.getItem('admin_wp_no');
    if(!num) {
        num = prompt('Lütfen sistem raporlarının gönderileceği yetkili numaranızı girin (Örn: 5321234567):');
        if(num) localStorage.setItem('admin_wp_no', num);
        else return;
    }
    
    num = num.replace(/\D/g, '');
    let text = "*FİLO-ERP GÜNLÜK ÖZET RAPORU*\n\n";
    
    try {
        if(window.Toast) window.Toast.info("WhatsApp Raporu hazırlanıyor...");
        
        // 1. Poliçeler - Son 15 Gün
        const { data: polices } = await window.supabaseClient.from('arac_policeler').select('*, araclar(plaka)');
        const now = new Date();
        let pAlerts = [];
        (polices||[]).forEach(p => {
            let bitis = new Date(p.bitis_tarihi);
            let diff = Math.floor((bitis - now) / (1000*60*60*24));
            if(diff <= 15 && diff >= -15) {
                pAlerts.push('- ' + (p.araclar?.plaka || '-') + ' - ' + p.police_turu + ' (' + (diff < 0 ? 'SÜRESİ GEÇTİ!' : diff+' Gün Kaldı') + ')');
            }
        });

        if(pAlerts.length > 0) {
           text += "*YAKLAŞAN/BİTEN POLİÇELER:*\n" + pAlerts.join("\n") + "\n\n";
        } else {
           text += "Yakın zamanda biten poliçe yok.\n\n";
        }

        // 2. Tahsilat (>10 Gün Geciken Invoices)
        const { data: faturalar } = await window.supabaseClient.from('cari_faturalar').select('id, cari_id, fatura_tarihi, toplam_tutar, cariler(unvan)');
        const { data: odemeler } = await window.supabaseClient.from('cari_odemeler').select('cari_id, tutar');
        let cB = {};
        (faturalar||[]).forEach(f => {
            if(!cB[f.cari_id]) cB[f.cari_id] = {b:0, o:0, u: f.cariler?.unvan, last: f.fatura_tarihi};
            cB[f.cari_id].b += parseFloat(f.toplam_tutar||0);
        });
        (odemeler||[]).forEach(o => {
            if(cB[o.cari_id]) cB[o.cari_id].o += parseFloat(o.tutar||0);
        });
        let fAlerts = [];
        Object.keys(cB).forEach(cid => {
            const k = cB[cid].b - cB[cid].o;
            if(k > 10) {
                const invDate = new Date(cB[cid].last);
                const d = Math.floor(Math.abs(now - invDate) / (1000 * 60 * 60 * 24)); 
                if(d >= 10) {
                    fAlerts.push('- ' + cB[cid].u.substring(0, 15) + '... (Risk: ' + d + ' Gün geç) ₺' + k.toLocaleString('tr-TR',{maximumFractionDigits:0}));
                }
            }
        });

        if(fAlerts.length > 0) {
           text += "*GECİKEN TAHSİLATLAR:*\n" + fAlerts.join("\n") + "\n\n";
        } else {
           text += "Geciken acil tahsilat uyarısı yok.\n\n";
        }

        text += "_Filo-ERP Otomatik Altyapısı._";
        
        window.open('https://wa.me/90' + num + '?text=' + encodeURIComponent(text), '_blank');
    } catch(e) { console.error(e); }
};
