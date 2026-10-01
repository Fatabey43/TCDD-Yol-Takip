export type RailwayPointCategory =
  | 'km_marker'
  | 'switch'
  | 'crossing'
  | 'bridge'
  | 'culvert'
  | 'station'
  | 'signal'
  | 'other';

export type FontFamilyType = 'sans' | 'mono' | 'serif' | 'rounded';
export type LineHeightType = 'tight' | 'normal' | 'relaxed';
export type TextAlignType = 'left' | 'center' | 'right';

export interface TextStyleConfig {
  color?: string;
  fontFamily?: FontFamilyType;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  lineHeight?: LineHeightType;
  textAlign?: TextAlignType;
  fontSize?: 'xs' | 'sm' | 'base' | 'lg';
}

/**
 * Hemzemin Geçitler (Crossing) kategorisine özel teknik ve operasyonel geçit özellikleri
 */
export interface LevelCrossingDetails {
  crossingType?: string; // Geçit Tipi: Örn: Flaşörlü+Çanlı Otomatik Bariyerli
  surfaceType?: string; // Kaplama Cinsi: Örn: Lastik (Kauçuk), Kompozit, Asfalt
  dailyVehicleCount?: string | number; // 24 Saatte Geçen Ortalama Taşıt Adedi
  dailyTrainCount?: string | number; // 24 Saatte Geçen Ortalama Tren Adedi
  clearanceWidth?: string; // Geçit Açıklığı / Yol Genişliği (metre)
  skewAngle?: string; // Verevlik Açısı (Derece cinsinden, örn: 90)
  intersectedTrackCount?: string | number; // Kestiği Hat Adedi
  minSightDistance?: string; // Trenin Min. Görüş Mesafesi (metre)
  railwayGradient?: string; // Demiryolunun Eğimi (Binde - ‰)
  curveInfo?: string; // Kurp Bilgileri (YNMAN vb.)
  subeSefligi?: string; // Şube Şefliği (Örn: 71, 72 Kütahya)
  roadBelonging?: string; // Karayolunun Ait Olduğu Kuruluş (Örn: İl Özel İdaresi, Karayolları, Belediye)
  nereleriBagladigi?: string; // Nereleri Bağladığı (Örn: Uluköy - Bayramşah)
  bulunduguIl?: string; // Bulunduğu İl (Örn: Kütahya)
}

/**
 * Menfezler (Culvert) kategorisine özel TCDD Yol Bakım Şefliği Menfez Bilgileri
 */
export interface CulvertDetails {
  siraNo?: number | string; // Sıra No
  hatti?: string; // Hattı (Örn: Esk.-Konya)
  mihverKlm?: string; // Mihver Klm.si (Örn: 54+673)
  aciklikSerbest?: string | number; // Açıklığı - Serbest (m) (Örn: 0,60 veya 4,00)
  aciklikMesnet?: string | number; // Açıklığı - Mesnet (Adet/Göz) (Örn: 1)
  debuseYuksekligi?: string | number; // Debuşe Yüksekliği (m) (Örn: 0,60 veya 0,70)
  yapimYili?: string | number; // Yapım Yılı (Örn: 1894)
  dingilBasinci?: string | number; // Dingil Basıncı (Ton) (Örn: 22,5)
  cinsi?: string; // Cinsi (Örn: Taş Kapak, Demir Boru, Ferbeton, Ferbeton-Betonarme, Taş Kemer)
  bakimSefligi?: string; // Bakım Şefliği (Örn: 712 YOL BAKIM ŞEFLİĞİ)
}

export interface PointNote {
  id: string;
  text: string;
  createdAt: string;
  author: string;
  style?: TextStyleConfig;
}

export interface PointPhoto {
  id: string;
  dataUrl: string; // base64 or URL
  caption: string;
  takenAt: string;
}

/**
 * Yapılan İş / Bakım / Onarım Kayıtları (İş Raporları için)
 */
export interface WorkLog {
  id: string;
  title: string; // Örn: Balast Takviyesi, Travers Değişimi, Kaynak Taşlama, Menfez Temizliği
  workType: 'bakim' | 'onarim' | 'yenileme' | 'muayene' | 'temizlik' | 'diger';
  performedAt: string; // Tarih
  performedBy: string; // Ekip / Şeflik / Personel
  description: string; // Yapılan işin detayı
  crewCount?: number | string; // Çalışan personel sayısı
  materialsUsed?: string; // Kullanılan malzeme (Örn: 4 adet B70 travers, 2 çuval çimento)
  photos?: PointPhoto[]; // İşe ait öncesi/sonrası fotoğraflar
  status: 'tamamlandi' | 'devam_ediyor' | 'planlandi';
}

export interface RailwayPoint {
  id: string;
  title: string;
  kmValue: string; // e.g. "142+350" or "48.2"
  lineName: string; // e.g. "Ankara - Eskişehir YHT"
  locationDesc?: string; // e.g. "Polatlı Batı Girişi"
  category: RailwayPointCategory;
  lat: number;
  lng: number;
  description: string;
  notes: PointNote[];
  photos: PointPhoto[];
  workLogs?: WorkLog[]; // Yapılan iş kayıtları
  createdAt: string;
  updatedAt: string;
  textStyle?: TextStyleConfig;
  titleTextStyle?: TextStyleConfig;
  levelCrossing?: LevelCrossingDetails;
  culvert?: CulvertDetails;
}

export interface FilterOptions {
  search: string;
  selectedLine: string;
  category: string;
}

export type UserRole = 'admin' | 'editor' | 'viewer';
export type UserStatus = 'active' | 'pending' | 'rejected';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status?: UserStatus; // 'active' (onaylanmış) | 'pending' (yönetici onayı bekliyor)
  department?: string;
  avatar?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  email?: string;
  userName?: string;
  role?: string;
  status: 'success' | 'failed' | 'warning' | 'info';
  details: string;
  ip?: string;
}

/**
 * TCDD Takyidat (Geçici/Kalıcı Hız Kısıtlaması & Yol Emri) Tanımı
 */
export interface TakyidatSpeedRestriction {
  id: string;
  startKm: string; // e.g. "54+000" veya "54"
  endKm: string; // e.g. "55+000" veya "55"
  startKmNum: number; // e.g. 54.0
  endKmNum: number; // e.g. 55.0
  lineName: string; // e.g. "Eskişehir-Konya" veya "Tüm Hatlar"
  speedLimit: number; // e.g. 30, 50, 70 (km/s)
  normalSpeed?: number; // e.g. 100, 120 (km/s)
  reason: string; // e.g. "Yol tamiratı / Balast çalışması / Menfez yenileme"
  status: 'active' | 'planned' | 'lifted'; // active: yürürlükte, planned: planlanan, lifted: kaldırıldı
  trackType?: 'single' | 'line1' | 'line2' | 'both'; // Hat 1, Hat 2 vb.
  startDate?: string;
  endDate?: string;
  issuedBy?: string; // e.g. "712 Yol Bakım Şefliği / Servis Müdürlüğü"
  noticeNo?: string; // e.g. "Yol Emri No: 2026/14"
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

