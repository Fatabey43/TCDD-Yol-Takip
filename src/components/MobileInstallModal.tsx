import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  QrCode,
  Copy,
  Check,
  X,
  Share2,
  Download,
  ExternalLink,
  Train,
  CheckCircle2,
  Apple,
  Monitor
} from 'lucide-react';

interface MobileInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onTriggerInstall: () => void;
}

export const MobileInstallModal: React.FC<MobileInstallModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onTriggerInstall,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [activeDeviceTab, setActiveDeviceTab] = useState<'android' | 'iphone' | 'desktop'>('android');

  // If user is accessing via shared URL or dev URL, use current window.location.origin
  const currentOrigin = typeof window !== 'undefined' && window.location.origin.includes('run.app')
    ? window.location.origin
    : 'https://ais-pre-jxnlqcgxcphcf7fuimkqt7-355311322052.europe-west2.run.app';

  const publicSharedUrl = 'https://ais-pre-jxnlqcgxcphcf7fuimkqt7-355311322052.europe-west2.run.app';
  const devUrl = 'https://ais-dev-jxnlqcgxcphcf7fuimkqt7-355311322052.europe-west2.run.app';

  // Default to public shared URL so when they share it with others, it works everywhere!
  const [selectedUrlType, setSelectedUrlType] = useState<'shared' | 'current'>('shared');
  const activeUrl = selectedUrlType === 'shared' ? publicSharedUrl : currentOrigin;

  useEffect(() => {
    if (isOpen && activeUrl) {
      QRCode.toDataURL(activeUrl, {
        width: 240,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR code generation error:', err));
    }
  }, [isOpen, activeUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      id="mobile-install-modal"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-red-500/50 flex items-center justify-center">
              <img
                src="/pwa-192x192.png"
                alt="TCDD Lokomotif"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h3 className="font-bold text-sm">TCDD KM TAKİP Yükleme Rehberi</h3>
              <p className="text-[11px] text-red-300">712 Şefliği • Mobil ve Masaüstü Kurulum</p>
            </div>
          </div>
          <button
            id="close-mobile-install-modal-btn"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-slate-800">
          {/* Native Install Button (if browser supports beforeinstallprompt) */}
          {deferredPrompt && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-sky-900">Uygulama Yüklemeye Hazır</div>
                <div className="text-[11px] text-sky-700">Tek tıkla ana ekranınıza ekleyin.</div>
              </div>
              <button
                id="native-pwa-install-btn"
                onClick={onTriggerInstall}
                className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Şimdi Yükle</span>
              </button>
            </div>
          )}

          {/* QR Code Section (Scan with phone camera) */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
            <span className="inline-block text-[11px] font-bold text-sky-700 uppercase tracking-wider bg-sky-100 px-2.5 py-0.5 rounded-full mb-2">
              1. Yöntem: Kameranızla QR Kodu Okutun
            </span>
            <p className="text-xs text-slate-600 mb-3">
              Telefonunuzun kamerasını aşağıdaki QR koda tutarak uygulamayı doğrudan telefonunuzda açabilirsiniz:
            </p>

            {qrDataUrl ? (
              <div className="inline-block p-2 bg-white rounded-xl shadow-md border border-slate-200">
                <img
                  src={qrDataUrl}
                  alt="Demiryolu KM Uygulaması Mobil Giriş QR Kodu"
                  className="w-44 h-44 mx-auto rounded-lg"
                />
              </div>
            ) : (
              <div className="w-44 h-44 mx-auto bg-slate-200 rounded-xl flex items-center justify-center text-xs text-slate-400 animate-pulse">
                QR Kod Üretiliyor...
              </div>
            )}

            {/* Quick Copy Link & WhatsApp Button */}
            <div className="mt-3 flex flex-col sm:flex-row items-center justify-center gap-2">
              <button
                id="copy-mobile-app-link-btn"
                onClick={handleCopyLink}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 shadow-sm transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Bağlantı Kopyalandı!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Bağlantıyı Kopyala</span>
                  </>
                )}
              </button>

              <a
                id="send-whatsapp-link-btn"
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent('Demiryolu KM Takip Uygulaması Giriş Bağlantısı: ' + activeUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>WhatsApp ile Gönder</span>
              </a>
            </div>

            {/* URL Selector Tabs */}
            <div className="mt-3 bg-slate-100 p-1.5 rounded-xl flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setSelectedUrlType('shared')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-all ${
                  selectedUrlType === 'shared'
                    ? 'bg-white shadow-xs text-sky-700 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Genel Paylaşım Linki (Önerilen)
              </button>
              <button
                type="button"
                onClick={() => setSelectedUrlType('current')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium transition-all ${
                  selectedUrlType === 'current'
                    ? 'bg-white shadow-xs text-sky-700 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mevcut Çalışma Bağlantısı
              </button>
            </div>
          </div>

          {/* 404 URL Not Found Helper Banner */}
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-950 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-rose-900">
              <span>⚠️ &ldquo;URL bu sunucuda bulunamadı&rdquo; Hatası Alıyorsanız:</span>
            </div>
            <p className="text-[11px] leading-relaxed text-rose-800">
              Bu hata, uygulamanın henüz AI Studio üzerinden dış dünyaya <strong>&ldquo;Share / Paylaş&rdquo;</strong> yapılmamasından kaynaklanır.
            </p>
            <div className="bg-white/80 rounded-lg p-2 text-[11px] text-slate-700 space-y-1 border border-rose-100">
              <p><strong>1. Kalıcı Çözüm:</strong> Bilgisayar ekranınızdaki AI Studio arayüzünün sağ üst köşesinde yer alan <strong>&ldquo;Share&rdquo; (Paylaş)</strong> butonuna 1 defa tıklayın. Böylece Google bu adresi kalıcı olarak aktif eder.</p>
              <p><strong>2. Anında Giriş:</strong> Yukarıdaki <strong>&ldquo;Aktif Canlı Bağlantı&rdquo;</strong> QR kodunu okutarak telefonunuzun tarayıcısında Google hesabınızla giriş yapıp anında kullanabilirsiniz.</p>
            </div>
          </div>

          {/* Important explanation about PWA installation vs APK */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-950">
              <span>💡 İndirme Hakkında Önemli Bilgi:</span>
            </div>
            <p className="text-[11px] text-amber-900 leading-relaxed">
              Bu uygulama bir APK kurulum dosyası olarak inmez. Modern <strong>PWA (Web Uygulaması)</strong> teknolojisi sayesinde telefonunuzun tarayıcısından <strong>&ldquo;Ana Ekrana Ekle&rdquo;</strong> veya <strong>&ldquo;Uygulamayı Yükle&rdquo;</strong> seçeneği ile doğrudan telefonunuza uygulama olarak kurulur.
            </p>
          </div>

          {/* Operating System Instructions Tab */}
          <div>
            <div className="text-xs font-bold text-slate-800 mb-2">
              2. Yöntem: Telefonda Ana Ekrana Ekleme (Kurulum)
            </div>

            <div className="flex border-b border-slate-200 mb-3">
              <button
                id="install-tab-android-btn"
                onClick={() => setActiveDeviceTab('android')}
                className={`flex-1 py-2 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                  activeDeviceTab === 'android'
                    ? 'border-b-2 border-sky-600 text-sky-700 bg-sky-50/50'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Android (Chrome)</span>
              </button>
              <button
                id="install-tab-iphone-btn"
                onClick={() => setActiveDeviceTab('iphone')}
                className={`flex-1 py-2 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                  activeDeviceTab === 'iphone'
                    ? 'border-b-2 border-sky-600 text-sky-700 bg-sky-50/50'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Apple className="w-3.5 h-3.5" />
                <span>iPhone / iPad</span>
              </button>
              <button
                id="install-tab-desktop-btn"
                onClick={() => setActiveDeviceTab('desktop')}
                className={`flex-1 py-2 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                  activeDeviceTab === 'desktop'
                    ? 'border-b-2 border-sky-600 text-sky-700 bg-sky-50/50'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Masaüstü PC</span>
              </button>
            </div>

            {/* Android Instructions */}
            {activeDeviceTab === 'android' && (
              <div className="space-y-2.5 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Telefonunuzda <strong>Google Chrome</strong> tarayıcısını açıp uygulama bağlantısına girin.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Chrome'un sağ üst köşesindeki <strong>üç nokta (⋮)</strong> simgesine dokunun.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Menüden <strong>"Uygulamayı Yükle"</strong> veya <strong>"Ana Ekrana Ekle"</strong> seçeneğine tıklayın.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                    ✓
                  </span>
                  <span>
                    Artık telefonunuzun ana ekranında tren simgeli <strong>"Demiryolu KM"</strong> uygulaması hazır! Tıkladığınızda tarayıcı çubuğu olmadan tam ekran açılır.
                  </span>
                </div>
              </div>
            )}

            {/* iPhone Instructions */}
            {activeDeviceTab === 'iphone' && (
              <div className="space-y-2.5 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    iPhone'unuzda <strong>Safari</strong> tarayıcısını açın ve uygulama linkine girin.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Ekranın en altındaki <strong>Paylaş</strong> simgesine (kare içinden yukarı ok çıkan buton <Share2 className="w-3.5 h-3.5 inline text-sky-600" />) dokunun.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Aşağı kaydırıp <strong>"Ana Ekrana Ekle"</strong> (Add to Home Screen) seçeneğini seçin.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                    ✓
                  </span>
                  <span>
                    Sağ üst köşedeki <strong>"Ekle"</strong>ye basın. Uygulama iPhone ana ekranınıza bir uygulama ikonu olarak kurulacaktır.
                  </span>
                </div>

                {/* iPhone Safari Security Bypass Hint */}
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 mt-2 space-y-1">
                  <div className="font-bold text-amber-950 flex items-center gap-1">
                    <span>⚠️ Safari &ldquo;Bağlantı Gizli Değil&rdquo; veya Güvenlik Uyarısı Verirse:</span>
                  </div>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-700">
                    <li>Ekranda çıkan <strong>&ldquo;Ayrıntıları Göster&rdquo;</strong> (Show Details) yazısına dokunun.</li>
                    <li>Metnin en altındaki <strong>&ldquo;bu web sitesini ziyaret et&rdquo;</strong> (visit this website) bağlantısına dokunun.</li>
                    <li>Veya iPhone&apos;unuza <strong>Google Chrome</strong> indirip bağlantıyı Chrome ile de açabilirsiniz.</li>
                  </ol>
                </div>
              </div>
            )}

            {/* Desktop PC Instructions */}
            {activeDeviceTab === 'desktop' && (
              <div className="space-y-2.5 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Bilgisayarınızda <strong>Google Chrome</strong> veya <strong>Microsoft Edge</strong> tarayıcısı ile linki açın.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Adres çubuğunun en sağında yer alan <strong>"Uygulamayı Yükle" (monitör & aşağı ok simgesi)</strong>ne tıklayın.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Çıkan onay penceresinde <strong>"Yükle"</strong> butonuna basın.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                    ✓
                  </span>
                  <span>
                    Masaüstünüze ve Başlat menünüze <strong>"Demiryolu KM"</strong> simgesi yerleşir. Tıpkı bilgisayar programı gibi bağımsız pencerede çalışır!
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Sync Guarantee Note */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2 text-xs text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Tüm Cihazlarda Otomatik Senkronize:</strong> Telefonunuzdan sahada ekleyeceğiniz tüm demiryolu KM noktaları, notlar ve fotoğraflar bilgisayarınızda ve diğer tüm cihazlarda anında canlı olarak görünür.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            id="modal-got-it-btn"
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-5 py-2 rounded-xl transition-colors"
          >
            Anladım, Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
