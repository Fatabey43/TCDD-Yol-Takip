# Proje Kuralları ve Kalıcı Ayarlar

Kullanıcının belirlediği ve gelecekteki tüm geliştirmelerde kesinlikle korunması gereken temel kurallar:

## 1. Varsayılan (Örnek) Noktalar
- Uygulama başlatıldığında veya sıfırlandığında hiçbir varsayılan/örnek nokta (`pt-tcdd-*`, demo verileri vb.) otomatik olarak eklenmemelidir.
- Kullanıcı boş ve temiz bir çalışma alanıyla başlar.
- Örnek verilerin otomatik geri yüklenmesi (fallback) yasaktır.

## 2. Silinen Noktalar ve Kalıcılık
- Kullanıcının sildiği noktalar kesinlikle geri getirilmemelidir (resurrection engellenmiştir).
- Silinen nokta kimlikleri (ID) hem sunucu (`/data/deleted_points.json`) hem de istemci (`localStorage`) seviyesinde kara listeye kaydedilir.
- Herhangi bir yedek önbellek taraması silinmiş noktaları veya varsayılan örnek noktaları geri yüklememelidir.

## 3. Silme Butonları ve Modal Kullanımı
- `window.confirm()` veya tarayıcı uyarı diyalogları iframe ortamında engellendiği için kesinlikle kullanılmamalıdır.
- Tüm silme ve onay işlemleri için özel bileşen olan `DeleteConfirmModal` kullanılmalıdır.

## 4. Hata Yönetimi ve API İletişimi
- İstemciye 400, 404 veya 500 gibi teknik hata kodları yansıtılmamalı; işlemler sessiz ve zarif biçimde çevrimdışı önbelleğe alınmalıdır.
- Kullanıcıya yalnızca anlaşılır Türkçe durum bildirimleri (Toast) gösterilmelidir.
- Sunucu ve istemci veri modelleri senkronize tutulmalıdır.

## 5. Saha Fotoğraflarının Kalıcılığı ve Optimizasyonu
- Yüklenen fotoğraflar istemci tarafında otomatik optimize edilir (boyut küçültülerek depolama kotası ve veri kaybı önlenir).
- Fotoğraflar hem sunucu (`/data/railway_points.json`), hem IndexedDB hem de yerel önbellekte (`localStorage`) çift katmanlı korunur.
- Nokta güncelleme veya içe aktarma senkronizasyonlarında mevcut fotoğraflar asla üzerine yazılıp silinmez (akıllı birleştirme yapılır).
- Fotoğraf silme işlemi yalnızca kullanıcı açıkça silme butonuna tıklayıp onayladığında gerçekleştirilir.

