import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  X,
  Lock,
  Mail,
  Shield,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessToast?: (msg: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
}) => {
  const { login, user, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Lütfen e-posta ve şifrenizi giriniz.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
      onSuccessToast?.('Başarıyla giriş yapıldı.');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="login-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="login-modal-container"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Demiryolu Giriş Portalı</h2>
              <p className="text-[11px] text-slate-400">Yetkili personel oturum açma</p>
            </div>
          </div>
          <button
            id="close-login-modal-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current User Status Banner (if logged in) */}
        {user && (
          <div className="bg-sky-50 dark:bg-sky-950/40 border-b border-sky-200 dark:border-sky-800/50 px-5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs text-slate-700 dark:text-slate-300">
                Aktif Oturum: <strong className="text-slate-900 dark:text-white">{user.name}</strong> ({user.role.toUpperCase()})
              </span>
            </div>
            <button
              id="logout-btn"
              onClick={() => {
                logout();
                onSuccessToast?.('Oturum kapatıldı.');
                onClose();
              }}
              className="text-[11px] text-red-600 dark:text-red-400 hover:underline font-semibold cursor-pointer"
            >
              Çıkış Yap
            </button>
          </div>
        )}

        {/* Form Body */}
        <div className="p-5">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                E-Posta Adresi
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  id="login-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@tcdd.gov.tr"
                  className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Şifre
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  id="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs pl-9 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="submit-login-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sky-600/20 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? 'Giriş Yapılıyor...' : 'Oturum Aç'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
