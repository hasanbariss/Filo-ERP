/**
 * rota-logic.js
 * Manual route entry and waypoint management.
 */

let routeLines = {}; // { plaka: L.polyline }
let routeMarkers = [];

window.initRotaLogic = function () {
    console.log("[ROTA] Mantık başlatılıyor...");

    // Araç listesini select box'a doldur
    loadSelectOptions('rota-arac-sec', 'araclar', 'plaka', 'plaka');
    loadSelectOptions('rota-musteri-sec', 'musteriler', 'id', 'unvan');

    // Harita etkileşimi: Çift tıklama ile koordinat al
    if (window.mainMap) {
        window.mainMap.on('dblclick', function (e) {
            document.getElementById('rota-lat').value = e.latlng.lat.toFixed(6);
            document.getElementById('rota-lng').value = e.latlng.lng.toFixed(6);

            // Geçici marker
            const tempMarker = L.marker(e.latlng, {
                icon: L.divIcon({
                    className: 'bg-orange-500 w-3 h-3 rounded-full border-2 border-white shadow-lg',
                    iconSize: [12, 12]
                })
            }).addTo(window.mainMap);

            setTimeout(() => tempMarker.remove(), 2000);
        });
    }

    // Araç seçimi değiştiğinde durakları getir
    document.getElementById('rota-arac-sec').addEventListener('change', function (e) {
        const plaka = e.target.value;
        if (plaka) {
            window.fetchRotaDuraklari(plaka);
        } else {
            document.getElementById('rota-listesi').innerHTML = '<p class="text-xs text-gray-600 italic">Araç seçerek durakları listeleyin.</p>';
        }
    });
};


window.fetchRotaDuraklari = async function (plaka) {
    const container = document.getElementById('rota-listesi');
    container.innerHTML = '<div class="flex justify-center p-4"><div class="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div></div>';

    try {
        const { data, error } = await window.supabaseClient
            .from('arac_rotalari')
            .select('*')
            .eq('arac_plaka', plaka)
            .order('created_at', { ascending: true });

        if (error) throw error;

        container.innerHTML = '';
        if (data.length === 0) {
            container.innerHTML = '<p class="text-xs text-gray-500 italic">Henüz durak eklenmemiş.</p>';
            // Haritadaki çizgiyi de temizle
            if (routeLines[plaka]) {
                routeLines[plaka].remove();
                delete routeLines[plaka];
            }
            return;
        }

        const latlngs = [];
        data.forEach(d => {
            const item = document.createElement('div');
            item.className = "group flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:border-orange-500/50 transition-all";
            item.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]"></div>
                    <div>
                        <div class="text-xs font-bold text-white">${d.durak_adi}</div>
                        <div class="text-[9px] text-gray-500">${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}</div>
                    </div>
                </div>
                <button onclick="window.deleteRotaDurak('${d.id}', '${plaka}')" class="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 text-gray-500 hover:text-red-500 rounded-lg transition-all">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            `;
            container.appendChild(item);
            latlngs.push([d.lat, d.lng]);
        });

        if (window.lucide) window.lucide.createIcons();

        // Haritada rotayı çiz
        window.drawRouteOnMap(plaka, latlngs);

    } catch (e) {
        console.error("[ROTA] Çekme hatası:", e);
        container.innerHTML = `<p class="text-xs text-red-400">Hata: ${e.message}</p>`;
    }
};

window.drawRouteOnMap = function (plaka, latlngs) {
    if (!window.mainMap) return;

    // Eğer bu araç için zaten bir çizgi varsa kaldır
    if (routeLines[plaka]) {
        routeLines[plaka].remove();
    }

    // Yeni çizgi oluştur
    const line = L.polyline(latlngs, {
        color: '#f97316', // orange-500
        weight: 3,
        opacity: 0.8,
        dashArray: '10, 10',
        lineJoin: 'round'
    }).addTo(window.mainMap);

    routeLines[plaka] = line;

    // Haritayı rotaya odakla
    if (latlngs.length > 0) {
        window.mainMap.fitBounds(line.getBounds(), { padding: [50, 50] });
    }
};

window.deleteRotaDurak = async function (id, plaka) {
    if (!confirm("Bu durağı silmek istediğinize emin misiniz?")) return;

    try {
        const { error } = await window.supabaseClient.from('arac_rotalari').delete().eq('id', id);
        if (error) throw error;
        window.fetchRotaDuraklari(plaka);
    } catch (e) {
        alert("Silme hatası: " + e.message);
    }
};

window.searchLocation = async function () {
    const query = document.getElementById('map-search-input').value.trim();
    if (!query) return;

    const btn = window.event.currentTarget;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = "...";

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const results = await response.json();

        if (results && results.length > 0) {
            const { lat, lon } = results[0];
            window.mainMap.setView([lat, lon], 12);

            L.popup()
                .setLatLng([lat, lon])
                .setContent(`<div class="text-xs font-bold text-blue-500">${query}</div>`)
                .openOn(window.mainMap);
        } else {
            alert("Konum bulunamadı.");
        }
    } catch (e) {
        console.error("[MAP] Arama hatası:", e);
    } finally {
        btn.innerHTML = originalHTML;
    }
};

window.saveRotaNoktasi = async function () {
    const plaka = document.getElementById('rota-arac-sec').value;
    const musteriId = document.getElementById('rota-musteri-sec').value;
    const durakAd = document.getElementById('rota-durak-ad').value.trim();
    const lat = parseFloat(document.getElementById('rota-lat').value);
    const lng = parseFloat(document.getElementById('rota-lng').value);

    if (!plaka || !durakAd || isNaN(lat) || isNaN(lng)) {
        alert("Lütfen tüm alanları doldurun.");
        return;
    }

    const btn = window.event.currentTarget;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = "Kaydediliyor...";
    btn.disabled = true;

    try {
        const { error } = await window.supabaseClient.from('arac_rotalari').insert([{
            arac_plaka: plaka,
            musteri_id: musteriId || null,
            durak_adi: durakAd,
            lat: lat,
            lng: lng,
            sira: 0
        }]);

        if (error) throw error;

        document.getElementById('rota-durak-ad').value = '';
        document.getElementById('rota-lat').value = '';
        document.getElementById('rota-lng').value = '';

        window.fetchRotaDuraklari(plaka);

    } catch (e) {
        console.error("[ROTA] Kaydetme hatası:", e);
        alert("Hata: " + e.message);
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
};
