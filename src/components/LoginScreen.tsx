import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { registerApi } from '../services/authApi.ts';
import {
  Lock,
  Mail,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Train,
  ArrowRight,
  LogIn,
  KeyRound,
  UserPlus,
  User,
  Building,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface LoginScreenProps {
  onSuccessToast?: (msg: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccessToast }) => {
  const { login } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state (Note: NO role choice, strictly name, email, pass, dept)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDepartment, setRegDepartment] = useState('Demiryolu Operasyonları & Saha Şefliği');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [registerSuccessMessage, setRegisterSuccessMessage] = useState<string | null>(null);

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
    setRegisterSuccessMessage(null);
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
      setError({ message: 'Şifreniz en az 4 karakter olmalıdır.' });
      return;
    }

    setError(null);
    setRegisterSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const res: any = await registerApi({
        name: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        department: regDepartment.trim(),
        // No role selected here; server sets it to 'editor' with status: 'pending'
      });

      // Clear input fields
      setLoginEmail(regEmail.trim());
      setRegName('');
      setRegEmail('');
      setRegPassword('');

      // Show confirmation message
      setRegisterSuccessMessage(
        res?.message || 'Hesap başvurunuz başarıyla alındı! Güvenlik nedeniyle sisteme giriş yapabilmeniz için sistem yöneticilerinden birinin onay vermesi gerekmektedir.'
      );
      setActiveTab('login');
      onSuccessToast?.('Hesap başvurunuz yönetici onayına iletildi.');
    } catch (err: any) {
      setError({
        message: err.message || 'Kayıt başvurusu oluşturulamadı.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden font-sans select-none text-slate-100">
      {/* Ambient background decoration */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md z-10 space-y-5">
        {/* Brand Header */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 shadow-xl shadow-sky-600/30 border border-sky-400/30 mb-0.5">
            <Train className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              <span>TCDD KM TAKİP</span>
            </h1>
            <p className="text-xs font-semibold text-sky-400 tracking-wider uppercase mt-0.5">
              Demiryolu Kilometre ve Tesis Portalı
            </p>
          </div>
        </div>

        {/* Card Box */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 relative">
          {/* Dual Navigation Tabs: Giriş Yap & Yeni Hesap Aç */}
          <div className="grid grid-cols-2 p-1 bg-slate-950/90 border border-slate-800 rounded-xl mb-4.5">
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
                setRegisterSuccessMessage(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'register'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Yeni Hesap Aç</span>
            </button>
          </div>

          {/* Pending Approval / Success Banner */}
          {registerSuccessMessage && (
            <div className="mb-4 p-3.5 bg-emerald-950/60 border border-emerald-600/50 rounded-xl flex items-start gap-2.5 text-emerald-200 text-xs animate-in fade-in duration-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold text-white block">Hesap Başvurusu Kaydedildi!</span>
                <p className="leading-relaxed text-[11px] text-emerald-300">
                  {registerSuccessMessage}
                </p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-3 bg-red-950/80 border border-red-800 rounded-xl flex items-start gap-2.5 text-red-200 text-xs animate-in fade-in duration-150">
              {error.code === 'ACCOUNT_PENDING_APPROVAL' ? (
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-1">
                <div className="leading-snug">{error.message}</div>
                {error.code === 'ACCOUNT_PENDING_APPROVAL' && (
                  <p className="text-[11px] text-amber-300 font-semibold">
                    * Yöneticilerden biri yönetim panelinden "Onayla" butonuna bastığı an giriş yapabileceksiniz.
                  </p>
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
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <KeyRound className="w-3 h-3 text-slate-500" />
                    <span>Şifreli Giriş</span>
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1 cursor-pointer"
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

              {/* Hızlı Giriş & Tanımlı Hesaplar Kartı */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 block">
                  ⚡ Hızlı Tek Tıkla Giriş:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginEmail('bahadirefet@gmail.com');
                      setLoginPassword('demiryolu123');
                    }}
                    className="p-2 bg-slate-950/80 hover:bg-slate-800 border border-purple-500/40 hover:border-purple-400 rounded-xl text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-300 flex items-center gap-1">
                        👑 Bahadır Efet
                      </span>
                      <span className="text-[9px] bg-purple-900/60 text-purple-200 px-1 rounded">Yönetici</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono block truncate">
                      bahadirefet@gmail.com
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Şifre: demiryolu123</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLoginEmail('saha@tcdd.gov.tr');
                      setLoginPassword('saha123');
                    }}
                    className="p-2 bg-slate-950/80 hover:bg-slate-800 border border-sky-500/40 hover:border-sky-400 rounded-xl text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-300 flex items-center gap-1">
                        🛠️ Saha Personeli
                      </span>
                      <span className="text-[9px] bg-sky-900/60 text-sky-200 px-1 rounded">Saha</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono block truncate">
                      saha@tcdd.gov.tr
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">Şifre: saha123</span>
                  </button>
                </div>
              </div>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('register');
                    setError(null);
                    setRegisterSuccessMessage(null);
                  }}
                  className="text-xs text-slate-400 hover:text-purple-300 transition-colors cursor-pointer"
                >
                  Hesabınız yok mu? <span className="font-bold underline">Yeni Hesap Aç</span>
                </button>
              </div>
            </form>
          ) : (
            /* TAB 2: REGISTER FORM (Strictly No Role Choice, Requires Admin Confirmation) */
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="bg-purple-950/30 border border-purple-800/40 p-2.5 rounded-xl text-[11px] text-purple-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                <span>Hesabınız oluşturulduktan sonra herhangi bir <strong>Sistem Yöneticisi</strong> tarafından onaylanacaktır.</span>
              </div>

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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1 cursor-pointer"
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
                    placeholder="Örn: 712 Yol Bakım Şefliği"
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
                    <span>Hesap Başvurusunu Tamamla</span>
                  </>
                )}
              </button>

              <div className="text-center pt-1">
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
