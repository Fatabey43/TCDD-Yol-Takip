import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Lock,
  Mail,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Train,
  ArrowRight,
  UserPlus,
  LogIn,
  User,
  Building,
  CheckCircle2,
  Sparkles,
  Zap,
} from 'lucide-react';

interface LoginScreenProps {
  onSuccessToast?: (msg: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccessToast }) => {
  const { login, register } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDepartment, setRegDepartment] = useState('Demiryolu Operasyonları & Saha Şefliği');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Shared UI states
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      setError({ message: 'Lütfen e-posta adresinizi ve şifrenizi giriniz.' });
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await login(loginEmail.trim(), loginPassword);
      onSuccessToast?.('Hoş geldiniz! Demiryolu KM Harita Sistemi yüklendi.');
    } catch (err: any) {
      setError({
        message: err.message || 'Giriş yapılamadı. Lütfen e-posta veya şifrenizi kontrol edin.',
        code: err.code,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setError({ message: 'Lütfen tüm zorunlu alanları doldurunuz.' });
      return;
    }

    if (regPassword.length < 4) {
      setError({ message: 'Şifreniz en az 4 karakter uzunluğunda olmalıdır.' });
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await register({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        department: regDepartment.trim(),
      });
      onSuccessToast?.('Hesabınız başarıyla oluşturuldu ve oturum açıldı!');
    } catch (err: any) {
      setError({
        message: err.message || 'Kayıt işlemi gerçekleştirilemedi. Lütfen bilgilerinizi kontrol edin.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick fill helper for testing/fast sign in
  const handleQuickLogin = (email: string, pass: string) => {
    setLoginEmail(email);
    setLoginPassword(pass);
    setError(null);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden font-sans select-none text-slate-100">
      {/* Ambient background decoration */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-96 bg-radial from-slate-900/40 to-transparent pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center p-1.5 bg-slate-900 rounded-2xl shadow-xl shadow-red-950/40 border border-red-500/40 mb-3 animate-in fade-in zoom-in-90 duration-300">
            <img
              src="/pwa-192x192.png"
              alt="TCDD Lokomotif Logo"
              className="w-16 h-16 rounded-xl object-cover shadow-md"
            />
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-[11px] font-black tracking-widest uppercase px-2 py-0.5 bg-red-950/90 border border-red-700 text-red-300 rounded-md">
              TCDD
            </span>
            <span className="text-[11px] font-bold text-sky-400">
              712 Şefliği Portalı
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight sm:text-3xl">
            TCDD KM TAKİP
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
            Demiryolu hat koordinatları, kilometre bilgileri ve saha kayıt yönetim sistemi.
          </p>
        </div>

        {/* Card Box */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 relative">
          {/* Navigation Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-950/90 border border-slate-800 rounded-xl mb-5">
            <button
              id="tab-login-btn"
              type="button"
              onClick={() => {
                setActiveTab('login');
                setError(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'login'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Giriş Yap</span>
            </button>
            <button
              id="tab-register-btn"
              type="button"
              onClick={() => {
                setActiveTab('register');
                setError(null);
                if (loginEmail && !regEmail) {
                  setRegEmail(loginEmail);
                }
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'register'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Yeni Hesap Oluştur</span>
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-3 bg-red-950/80 border border-red-800 rounded-xl flex items-start gap-2.5 text-red-200 text-xs animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <div className="leading-snug">{error.message}</div>
                {error.code === 'USER_NOT_FOUND' && (
                  <button
                    type="button"
                    onClick={() => {
                      setRegEmail(loginEmail);
                      setActiveTab('register');
                      setError(null);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:text-sky-300 underline underline-offset-2 cursor-pointer"
                  >
                    <span>Şimdi Bu E-posta İle Kayıt Olun</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 1: LOGIN FORM */}
          {activeTab === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  E-posta Adresi
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-email-input"
                    type="email"
                    required
                    autoFocus
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="ornek@tcdd.gov.tr veya mailiniz"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Şifre
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Varsayılan: demiryolu123 / saha123
                  </span>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password-input"
                    type={showLoginPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                id="login-submit-btn"
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow-lg shadow-sky-600/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Haritaya Giriş Yap</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Quick Select Buttons */}
              <div className="pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    Hızlı Giriş Seçenekleri
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-left">
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('bahadirefet@gmail.com', 'demiryolu123')}
                    className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-[11px] transition-colors flex flex-col cursor-pointer"
                  >
                    <span className="font-bold text-purple-300 truncate">👑 Bahadır Efet</span>
                    <span className="text-[10px] text-slate-400">Yönetici (Tam Yetki)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('turkmenhassan34@gmail.com', 'demiryolu123')}
                    className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-[11px] transition-colors flex flex-col cursor-pointer"
                  >
                    <span className="font-bold text-purple-300 truncate">👑 Hasan Türkmen</span>
                    <span className="text-[10px] text-slate-400">Yönetici (Sistem)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('saha@tcdd.gov.tr', 'saha123')}
                    className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-[11px] transition-colors flex flex-col cursor-pointer"
                  >
                    <span className="font-bold text-sky-300 truncate">🛠️ Saha Şefliği</span>
                    <span className="text-[10px] text-slate-400">Veri &amp; Fotoğraf</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickLogin('izleyici@tcdd.gov.tr', 'izleyici123')}
                    className="p-2 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-[11px] transition-colors flex flex-col cursor-pointer"
                  >
                    <span className="font-bold text-slate-300 truncate">👁️ Gözlemci</span>
                    <span className="text-[10px] text-slate-400">Salt Okunur</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* TAB 2: REGISTER FORM */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Ad Soyad *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="register-name-input"
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Örn: Ahmet Yılmaz"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  E-posta Adresi *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="register-email-input"
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="ornek@tcdd.gov.tr"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Şifre Belirleyin (En az 4 karakter) *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="register-password-input"
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Birim / Şeflik / Görev
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="register-dept-input"
                    type="text"
                    value={regDepartment}
                    onChange={(e) => setRegDepartment(e.target.value)}
                    placeholder="Örn: Yol Bakım Müdürlüğü"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                  />
                </div>
              </div>

              <button
                id="register-submit-btn"
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow-lg shadow-purple-600/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Hesabı Oluştur &amp; Başla</span>
                  </>
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('login');
                    setError(null);
                  }}
                  className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Zaten bir hesabınız var mı? Giriş Yapın
                </button>
              </div>
            </form>
          )}

          {/* Security Banner Note & Developer Signature */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                TCDD Demiryolu hat koordinatları ve saha kayıtları güvenli şifreleme altındadır.
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/50">
              <span className="font-semibold text-slate-400">Geliştirici: <strong className="text-sky-400">712 Şefliği</strong></span>
              <span className="text-slate-500">v2.5 Özel Kurumsal Sürüm</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
