# GPS destekli bakım takibi — uygulama tasarımı

Durum: Hesap çekirdeği, veritabanı, sunucu eşitlemesi ve bakım ekranı uygulandı. Mevcut bakım/cari kayıtları korundu. İlk kullanımda gerçek kilometre referansı ve araç bakım aralıkları kullanıcı tarafından girilir.

## Kullanıcı akışı

1. Araç için bir kez gösterge kilometresi ve bu değerin ölçüldüğü tarih/saat girilir. Mevcut guncel_km başlangıç önerisi olur; ölçüm zamanı bilinmediği için otomatik olarak bugüne bağlanmaz.
2. Plaka–GPS cihazı eşleştirmesi doğrulanır. Aynı plakaya birden fazla cihaz karşılık gelirse otomatik seçim yapılmaz.
3. Bakım eklerken araç, işlem türü ve işlem tarihi seçilir. Doğrulanmış GPS kapsamı varsa bakım anındaki kilometre önerilir; kullanıcı düzeltirse neden/kaynak saklanır. Geçmiş tarihli bakıma bugünkü kilometre yazılmaz.
4. Her bakım türü kendi kilometre ve/veya gün aralığına sahip olur. Hangisi önce dolarsa bakım gelir. Değerler araç/üretici planına göre kullanıcı tarafından belirlenir; lastiğe evrensel ömür atanmaz.
5. Yağ, filtre, lastik değişimi/rotasyonu, fren kontrolü ve diğer işlemler bağımsızdır. Kontrol, yağ ekleme veya parça alımı otomatik olarak yağ değişimi sayacını sıfırlamaz. Lastik işleminde aks/konum ve takım bilgisi tutulur.
6. Ana bakım görünümü geçmiş işlem satırları yerine araç–bakım planlarını listeler; böylece bu ay bakım kaydı olmayan araçlar da yaklaşan bakımlarda görünür. Geçmiş işlemler ayrı sekmede kalır.

## Önerilen kayıtlar

- arac_km_referanslari: araç, kilometre, ölçüm anı (timestamptz), kaynak, GPS cihazı, oluşturan, düzeltme nedeni, önceki referans.
- arac_gps_mesafeleri: araç/cihaz, aralık başlangıcı–bitişi, mesafe, alınma zamanı, doğrulama durumu. Araç–cihaz–aralık anahtarı benzersiz. API'den sorgulama saati gerçek son GPS sinyali diye gösterilmez.
- arac_bakim_planlari: araç, bakım türü/lastik konumu, km aralığı, gün aralığı, erken uyarı eşiği, etkinlik. Son ilgili tamamlanmış bakım mevcut arac_bakimlari kayıtlarına bağlanır.
- Bakım kaydına ilişki tablosu: plan, bakım kaydı, işlem anı, kilometre kaynağı, değişim/kontrol ayrımı. Mevcut finans alanları değiştirilmez.
- Yakıt tahmini ayarları/referansları: araç, depo kapasitesi, doğrulanmış dolum anı ve seviyesi, tüketim referansı. Gerçek sensör bilgisi ile tahmin ayrı kaynaklardır.

## GPS eşitleme

Mevcut api/infomobil yalnızca dönem mesafesi döndürüyor; tek aralık en fazla 32 gün. Gerçek odometre, motor saati, depo sensörü ve son sinyal alanlarının mevcut hesap/serviste sunulup sunulmadığı ayrıca doğrulanacak.

Sunucu tarafında zamanlanmış günlük eşitleme + kullanıcı için Şimdi güncelle önerilir. Eksik günler parçalara bölünerek tamamlanır. Sadece bekleyen aralıklar sorgulanır; son açık aralık gecikmeli GPS verileri için yeniden hesaplanır. Aynı aralık tekrar gelirse üzerine yazılır, mevcut kilometreye yeniden eklenmez. Cihaz değişikliği yeni eşleştirme/referans gerektirir.

Başlangıç kilometresi + doğrulanmış kesintisiz mesafe toplamı kullanılır. Eksik, çakışan veya olağandışı sonuçta son doğrulanmış değer ve veri eksikliği gösterilir; gerçek 0 km ile eksik yanıt ayrılır. GPS mesafesinin göstergeyle zaman içinde sapabileceği için kullanıcı gerektiğinde yeni referansla kalibrasyon yapabilir.

Motor saati bulunmazsa tarih farkı motor çalışma saati olarak gösterilmez. Bakıma kalan tahmini gün, yeterli ve tam son dönem günlük kullanımından türetilir; takvim bakım vadesinden ayrı etiketlenir.

## Yakıt

Mazot dosyası alınan litreyi gösterir; tek başına depo seviyesi veya tam dolum kanıtı değildir. Sensör yoksa en az bir doğrulanmış dolum/seviye referansı, depo kapasitesi, tüm dolumlar ve uygun tüketim referansı gerekir. Tahmini kalan litre = referans litre + dolumlar − GPS mesafesinden tahmini tüketim. Kalan menzil de tahmin olarak gösterilir. Kısmi dolum tam depo kabul edilmez; kapasite aşımı/negatif bakiye otomatik yakıt kaybı iddiası yerine veri kontrolü gerektirir.

Yakıt tahmini bakım kilometresini değiştirmez. Yakıt yükleme kayıtları bakım saatini veya geçmiş kilometreyi doğrulanmadan belirlemez.

## Kontroller ve kabul

- Tekrar eşitleme kilometreyi iki kez artırmaz; aralık boşlukları/çakışmaları güvenilir toplam üretmez.
- Güncel gösterge, ölçüm anı olmadan GPS başlangıcı sayılmaz.
- Yağ değişimi lastik planını; lastik değişimi yağ planını sıfırlamaz.
- Geçmiş bakım ekleme son bakım sırasını bozmaz; düzeltme/silme sonrası ilgili plan yeniden hesaplanır.
- Bakım maliyeti ve cari ödeme akışları değişmez.
- İlk sürüm özmal araçlarda etkinleştirilir; GPS eşleşmesi bulunan taşeronlar aynı altyapıyla ayrıca etkinleştirilebilir.
- Yeni tablolar mevcut oturum erişim politikasını izler; arka plan işinin sırları yalnızca sunucuda bulunur.

Hesaplama testleri: node scripts/test-maintenance-tracking.cjs

## İlk sürümün sınırları

Günlük cron 03:00 UTC olarak yapılandırıldı (Türkiye saati yaklaşık 06:00; platform zamanlama hassasiyetine bağlı). Her çalışmada aralık başına en fazla 7 gün, araç başına en fazla 4 yeni GPS sorgusu yapılır. Eski referansların ilk eşitlemesi birkaç çalıştırma isteyebilir. 36 saatten eski veya hata durumundaki GPS kilometresi yeni bakım kalan mesafesi için kullanılmaz. Motor saati / gerçek depo sensörü kullanılmıyor; gösterilen saat mesafe hesabının bitiş anıdır. Yakıt gün sonu referansı ve kullanıcı tüketim referansıyla tahmin edilir. Son kullanım hızına göre tahmini bakım günü henüz gösterilmez; takvim planlarının kalan günleri gösterilir.

Testler: `node scripts/test-maintenance-tracking.cjs`, `node scripts/test-maintenance-gps-server.cjs`, `PLAYWRIGHT_MODULE=<playwright yolu> node scripts/test-maintenance-planner-ui.cjs`.
