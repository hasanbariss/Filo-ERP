# Bağımsız çalışma dosyaları

Kullanıcının son talimatıyla kabul edilen 11 özellik uygulandı. Son öneri, reddedilmiş fikirler, arıza iş emri ve sonraya bırakılan QR/hesap yetkileri kapsam dışıdır.

## Kullanım

Sol menü → **Çalışma Dosyaları**. Dönemi ve ilgili filtreleri seçin, **Dosyayı hazırla** ile kaynağı okuyun. **Sürümü kaydet** bu çıktının değişmez görüntüsünü tutar. **Kaydedilmiş dosyalar** üzerinden eski sürüm açılır. PDF / Yazdır ve Excel çıktıları İDEOL ve küçük Baris.Flow markasını, dönemi, filtreleri ve kaynak zamanını içerir. PDF, tarayıcının “PDF olarak kaydet” yazdırma seçeneğini kullanır.

1. **Fabrika aylık dosyası:** Sınıf, mülkiyet, bölge ve beş servis türü; özmal/taşeron ara toplamları ve fabrika toplamı. Dış muhasebe satış faturaları ve tahsilatlar ayrı kaydedilir. Excel şablonu ve kontrollü önizleme vardır. Aynı fabrika/fatura numarası tekrar eklenmez. Hizmette sadece `rapor_musteri_fiyatlari` okunur.
2. **Araç sahibi hesap pusulası:** Sahip–taşeron araç–cari eşleştirmesi açık seçimle yapılır. Cari tarifesi, dönemsel adet düzeltmeleri, KDV/tevkifat, yakıt, yerel manuel kalemler ve cari dönem ödemeleri ayrı satırlardır. Ek kalem/avans yalnızca çalışma dosyasında tutulur.
3. **Araç dosyası:** Araç kartındaki düğmeden veya çalışma alanından açılır. Araç/şoför/belge tarihleri, seçilen dönem hizmeti, tüm bakım/poliçe/yakıt/hizmet geçmişi ve GPS ölçüm anı gösterilir.
4. **Bu ay neden değişti?:** Fabrika/araç hizmetinde miktar ve fiyat etkisi, araç giderlerinin önceki/güncel tutarları, araç sahibi brüt/yakıt/net karşılaştırması. Önceki tarife bilinmiyorsa sebep uydurulmaz.
5. **Araç sahibine hesap paketi:** Pusula, araç/fabrika hizmet ayrıntıları, yakıt, ödemeler ve ek kalemler tek çıktıda; paylaşım metni kopyalanabilir, mesaj otomatik gönderilmez.
6. **Teklif hesaplayıcısı:** Hizmet/boş KM, gün, tüketim varsayımı, yakıt fiyatı, şoför maliyeti, bakım payı, sabit gider, taşeron günlük bedeli ve maliyet üzerine kazanç yüzdesi. Eksik maliyetler sıfıra çevrilmez. Özmal ve taşeron başabaş/teklif karşılaştırması kaydedilebilir.
7. **Birlikte yapılabilecek bakımlar:** Aktif bakımların araç seçiminde “Birlikte yapılacak işler / PDF”. Planlar seçilir, servis notuyla iş listesi hazırlanır. Planı tamamlamaz, sayaç sıfırlamaz.
8. **Her yerden bul:** Araç, fabrika, personel, cari, alış ve yeni satış faturalarında arama. Son aramalar oturumda saklanır. Araç/fabrika sonucu ilgili dosyayı açar. Diğer sonuçlar kaynak ayrıntısını gösterir.
9. **Toplu fiyat önizlemesi:** Dönem/fabrika/mülkiyet/araç/sınıf seçimiyle yüzdelik veya birim fiyata TL değişimi; eski/yeni/fark dökümü. Kaydetmek hiçbir gerçek tarifeyi uygulamaz.
10. **Aylık yönetim dosyası:** Yönetici özeti, seçilebilir fabrika/araç sahibi/değişim/GPS/gider/stok bölümleri, eksik veri ve yönetim notları. Ekstre ayrıntıları aynı dosyada saklanır.
11. **Parça ve sarf stokları:** Parça kodu, birim, raf, minimum stok, uyumlu araçlar/model notu; depoya giriş ve araca çıkış; envanter/hareket/ihtiyaç listesi ve çıktılar.

## Veri sınırları

Yeni modüller eski tablolarda INSERT/UPDATE/DELETE yapmaz. `erp-workspace-data.js` eski kaynaklara yazmayı reddeder. Eski fiyat, puantaj, cari, bakım, ödeme ve araç tabloları bu modüller için yalnızca kaynaktır. Yeni modülden otomatik muhasebeleştirme veya çift yönlü eşitleme yoktur.

Yeni tablolar: `ek_workspace_entries`, `ek_workspace_snapshots`, `ek_stock_parts`, `ek_stock_movements`. RLS mevcut authenticated oturum modelini kullanır; yeni kullanıcı/rol sistemi kurulmadı. Kaydedilen hesap dosyaları ve finans kayıtları eklemeli ve değişmezdir. Sahip eşleştirmesi yeni sürümle değişir; önceden kaydedilmiş dosya etkilenmez.

`ek_stock_move` yalnızca yeni stok tablosuna yazar. Parça satırını kilitler; stok kontrolü ve hareketi aynı işlemde yapar. Tekrarlanan işlem kimliği ikinci hareket yaratmaz; aynı kimlik farklı içerikle reddedilir. Negatif stok ve doğrudan istemci hareket yazımı engellenir. Stok düzeltmesi açıklamalı karşı hareketle yapılır; geçmiş silinmez.

## Muhasebe ve ölçüm sınırları

- Dış muhasebe kayıtları ilk kullanımda girilmeli/aktarılmalı. Mevcut `cari_faturalar` alış faturasıdır ve müşteriye kesilmiş satış faturası kabul edilmez.
- Hizmet bedelinin KDV kapsamı doğrulanmadan matrahla kesin fark verilmez. Ödeme bulunmaması “borç kapandı” anlamına gelmez.
- Cari hakedişin manuel kalemleri eski sistemde tarayıcı localStorage içindedir. Bu cihazdakiler okunur, başka cihazdaki kayıtlar bulunmuş gibi gösterilmez. Dönem ödemesi eski borca ait olabileceği için pusula kesin açılışlı cari bakiye değildir.
- `taseron_hakedis` ayrı sefer kayıtları ana puantaj hesabına tekrar eklenmez. Yakıt netten ikinci defa düşülmez.
- Yakıt alımı tüketim değildir; kesin depo seviyesi ve tüketim üretilmez. GPS, kaynağın hesaplanan anı ve durumu ile gösterilir. Güncel GPS kilometresi dönemin toplam mesafesi olarak etiketlenmez.
- 5 Eylül 2026 kaynak kontrolünde bakım planı/GPS referansı yoktu. Gerçek plan ve başlangıç değeri girilmeden kalan KM üretilmez.

## Kontroller

`node scripts/test-erp-workspace.cjs`: hesaplama, fiyat izolasyonu, eksik veri, miktar/fiyat ayrımı ve yazma engeli.

`PLAYWRIGHT_MODULE=<playwright yolu> node scripts/test-erp-workspace-ui.cjs`: ekranlar, sürüm koruma, mobil, XSS kaçışları, bakım seçiminin kaynakları değiştirmemesi.

`PGLITE_MODULE=<pglite yolu> node scripts/test-erp-workspace-sql.cjs`: SQL/RLS, anonim erişim engeli, değişmez dosyalar, stok tekrar/eksik stok kontrolü. Test için PGlite geçici dizine kurulabilir; üretim verisinde test kaydı açılmaz.

İlgili mevcut rapor, hakediş ve bakım regresyonları da çalıştırılır. Root kaynaklar `npm run ios:prepare` ile `www/` içine hazırlanır.
