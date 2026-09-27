import React, { useState, useEffect } from 'react';
import { User, UserRole, AuditLog } from '../types.ts';
import {
  fetchAllUsers,
  updateUserRoleApi,
  deleteUserApi,
  resetUserPasswordApi,
  fetchAuditLogs,
  clearAuditLogs,
  registerApi,
} from '../services/authApi.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { DeleteConfirmModal } from './DeleteConfirmModal.tsx';
import {
  X,
  Users,
  Shield,
  Trash2,
  RefreshCw,
  Building,
  Clock,
  CheckCircle2,
  UserPlus,
  Key,
  FileText,
  AlertTriangle,
  AlertCircle,
  Search,
  LogIn,
  ChevronDown,
  Info,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRegisterModal?: () => void;
  onSuccessToast?: (msg: string) => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  onSuccessToast,
}) => {
  const { user: currentUser } = useAuth();

  // Active view tab: 'users' or 'logs'
  const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users');

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // New user form state
  const [showAddUser, setShowAddUser] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDept, setNewDept] = useState('Demiryolu Operasyonları & Saha Şefliği');
  const [newRole, setNewRole] = useState<UserRole>('editor');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Password reset state
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);
  const [targetNewPassword, setTargetNewPassword] = useState('');
  const [isResettingPass, setIsResettingPass] = useState(false);

  // Delete user state
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Audit Logs state
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'login' | 'role' | 'errors'>('all');
  const [showClearLogsModal, setShowClearLogsModal] = useState(false);
  const [isClearingLogs, setIsClearingLogs] = useState(false);

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const list = await fetchAllUsers();
      setUsers(list);
    } catch (err) {
      console.warn('Kullanıcılar yüklenemedi:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const list = await fetchAuditLogs();
      setLogs(list);
    } catch (err) {
      console.warn('Loglar yüklenemedi:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      loadLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Role Change
  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingId(userId);
    try {
      const ok = await updateUserRoleApi(userId, newRole);
      if (ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
        );
        onSuccessToast?.('Kullanıcı yetkisi başarıyla güncellendi.');
        loadLogs(); // Refresh audit logs
      } else {
        onSuccessToast?.('Yetki güncellenemedi.');
      }
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle Add New User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword) {
      return;
    }

    setIsCreatingUser(true);
    try {
      await registerApi({
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        department: newDept.trim(),
        role: newRole,
      });

      setShowAddUser(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      onSuccessToast?.(`Yeni kullanıcı ${newName} sisteme eklendi.`);
      loadUsers();
      loadLogs();
    } catch (err: any) {
      onSuccessToast?.(err.message || 'Kullanıcı eklenemedi.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Handle Password Reset
  const handleSaveResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser || !targetNewPassword || targetNewPassword.length < 4) {
      return;
    }

    setIsResettingPass(true);
    try {
      const ok = await resetUserPasswordApi(resetTargetUser.id, targetNewPassword);
      if (ok) {
        onSuccessToast?.(`${resetTargetUser.name} kullanıcısının şifresi güncellendi.`);
        setResetTargetUser(null);
        setTargetNewPassword('');
        loadLogs();
      } else {
        onSuccessToast?.('Şifre güncellenemedi.');
      }
    } finally {
      setIsResettingPass(false);
    }
  };

  // Handle Delete User
  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    try {
      const ok = await deleteUserApi(userToDelete.id);
      if (ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
        onSuccessToast?.(`${userToDelete.name} sistemden silindi.`);
        loadLogs();
      } else {
        onSuccessToast?.('Kullanıcı silinemedi.');
      }
    } finally {
      setIsDeletingUser(false);
      setUserToDelete(null);
    }
  };

  // Handle Clear Logs
  const confirmClearLogs = async () => {
    setIsClearingLogs(true);
    try {
      const ok = await clearAuditLogs();
      if (ok) {
        setLogs([]);
        onSuccessToast?.('Güvenlik ve giriş logları temizlendi.');
      }
    } finally {
      setIsClearingLogs(false);
      setShowClearLogsModal(false);
    }
  };

  // Filtered users
  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.department || '').toLowerCase().includes(q)
    );
  });

  // Filtered logs
  const filteredLogs = logs.filter((log) => {
    if (logFilter === 'all') return true;
    if (logFilter === 'login') return log.action.includes('GİRİŞ') || log.action.includes('LOGIN');
    if (logFilter === 'role') return log.action.includes('YETKİ') || log.action.includes('ROLE');
    if (logFilter === 'errors') return log.status === 'failed' || log.action.includes('HATA') || log.action.includes('BAŞARISIZ');
    return true;
  });

  const formatDate = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div
      id="user-mgmt-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="user-mgmt-container"
        className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100"
      >
        {/* Header */}
        <div className="bg-slate-950 px-5 py-3.5 flex items-center justify-between border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">Yetki &amp; Giriş Log Paneli</h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                  Yönetici Konsolu
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Kayıtlı personeli yetkilendirin, şifreleri yönetin ve giriş hatalarını anlık denetleyin.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadUsers();
                loadLogs();
              }}
              title="Yenile"
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${(usersLoading || logsLoading) ? 'animate-spin' : ''}`} />
            </button>
            <button
              id="close-user-mgmt-btn"
              onClick={onClose}
              title="Kapat"
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-5 bg-slate-950/70 border-b border-slate-800/80 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              id="mgmt-tab-users-btn"
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 py-3 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'users'
                  ? 'border-purple-500 text-purple-400 bg-purple-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Kayıtlı Kullanıcılar &amp; Yetkiler</span>
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-800 text-slate-300">
                {users.length}
              </span>
            </button>

            <button
              id="mgmt-tab-logs-btn"
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 py-3 px-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'border-sky-500 text-sky-400 bg-sky-950/20'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Giriş &amp; Denetim Logları</span>
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-800 text-slate-300">
                {logs.length}
              </span>
            </button>
          </div>

          {activeTab === 'users' && (
            <button
              id="open-add-user-btn"
              onClick={() => setShowAddUser((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md shadow-purple-600/30 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{showAddUser ? 'Formu Kapat' : 'Yeni Kullanıcı Ekle'}</span>
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* TAB 1: USERS LIST & MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* Expandable Add User Form */}
              {showAddUser && (
                <form
                  onSubmit={handleCreateUser}
                  className="bg-slate-950/90 border border-purple-500/40 rounded-2xl p-4 shadow-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-purple-400" />
                      Yeni Personel / Kullanıcı Ekle
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddUser(false)}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Ad Soyad *</label>
                      <input
                        type="text"
                        required
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Örn: Hasan Yılmaz"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">E-posta Adresi *</label>
                      <input
                        type="email"
                        required
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="personel@tcdd.gov.tr"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Şifre *</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="En az 4 karakter"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-3 pr-8 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((p) => !p)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                        >
                          {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-300 mb-1">Görev / Birim</label>
                      <input
                        type="text"
                        value={newDept}
                        onChange={(e) => setNewDept(e.target.value)}
                        placeholder="Örn: Saha Bakım Şefliği"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-300 mb-1">Yetki Rolü</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setNewRole('admin')}
                          className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                            newRole === 'admin'
                              ? 'bg-purple-950/70 border-purple-500 text-purple-200'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <div className="font-bold">👑 Yönetici</div>
                          <div className="text-[10px]">Tam yetki &amp; kullanıcı yönetimi</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewRole('editor')}
                          className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                            newRole === 'editor'
                              ? 'bg-sky-950/70 border-sky-500 text-sky-200'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <div className="font-bold">🛠️ Saha Personeli</div>
                          <div className="text-[10px]">Fotoğraf, not ve metraj</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewRole('viewer')}
                          className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                            newRole === 'viewer'
                              ? 'bg-slate-800/80 border-slate-600 text-slate-200'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}
                        >
                          <div className="font-bold">👁️ Gözlemci</div>
                          <div className="text-[10px]">Yalnızca izleme</div>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddUser(false)}
                      className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingUser}
                      className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-60"
                    >
                      {isCreatingUser ? 'Ekleniyor...' : 'Kullanıcıyı Kaydet'}
                    </button>
                  </div>
                </form>
              )}

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Kullanıcı ara (Ad, e-posta veya şeflik)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Users Cards */}
              <div className="space-y-2.5">
                {usersLoading ? (
                  <div className="p-8 text-center text-xs text-slate-400">Kullanıcılar yükleniyor...</div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-slate-950/60 rounded-xl border border-slate-800">
                    Arama kriterine uygun kullanıcı bulunamadı.
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelf = currentUser?.id === u.id;
                    const isUpdating = updatingId === u.id;

                    return (
                      <div
                        key={u.id}
                        id={`user-card-${u.id}`}
                        className="p-3.5 bg-slate-950/70 border border-slate-800/90 rounded-2xl hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        {/* User Identity Info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-md ${
                              u.role === 'admin'
                                ? 'bg-gradient-to-br from-purple-600 to-purple-800 ring-2 ring-purple-500/40'
                                : u.role === 'editor'
                                ? 'bg-gradient-to-br from-sky-600 to-sky-800 ring-2 ring-sky-500/40'
                                : 'bg-slate-700 ring-2 ring-slate-600/40'
                            }`}
                          >
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white truncate">{u.name}</span>
                              {isSelf && (
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                                  Siz
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 truncate">{u.email}</div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                              <span className="truncate">{u.department || 'Demiryolu Operasyonları'}</span>
                              <span>•</span>
                              <span>Son Giriş: {formatDate(u.lastLoginAt)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Actions & Role Selector */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {/* Role Selector */}
                          <div className="relative">
                            <select
                              id={`role-select-${u.id}`}
                              disabled={isUpdating}
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                              className={`text-xs font-bold py-1.5 px-3 rounded-xl border appearance-none pr-8 cursor-pointer focus:outline-none transition-all ${
                                u.role === 'admin'
                                  ? 'bg-purple-950/80 border-purple-700 text-purple-300'
                                  : u.role === 'editor'
                                  ? 'bg-sky-950/80 border-sky-700 text-sky-300'
                                  : 'bg-slate-900 border-slate-700 text-slate-300'
                              }`}
                            >
                              <option value="admin">👑 Yönetici</option>
                              <option value="editor">🛠️ Saha Personeli</option>
                              <option value="viewer">👁️ Gözlemci</option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>

                          {/* Reset Password Button */}
                          <button
                            id={`reset-pwd-btn-${u.id}`}
                            onClick={() => {
                              setResetTargetUser(u);
                              setTargetNewPassword('demiryolu123');
                            }}
                            title="Şifresini Sıfırla / Belirle"
                            className="p-1.5 rounded-xl border border-slate-700 text-slate-400 hover:text-amber-400 hover:border-amber-500 hover:bg-slate-900 transition-colors cursor-pointer"
                          >
                            <Key className="w-4 h-4" />
                          </button>

                          {/* Delete Button (Only for other users) */}
                          {!isSelf && (
                            <button
                              id={`delete-user-btn-${u.id}`}
                              onClick={() => setUserToDelete(u)}
                              title="Kullanıcıyı Sil"
                              className="p-1.5 rounded-xl border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500 hover:bg-red-950/30 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: AUDIT & LOGIN LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-3.5">
              {/* Filter Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400 text-[11px] font-semibold mr-1">Filtre:</span>
                  <button
                    onClick={() => setLogFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      logFilter === 'all' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    Tümü ({logs.length})
                  </button>
                  <button
                    onClick={() => setLogFilter('login')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      logFilter === 'login' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    Giriş Denemeleri
                  </button>
                  <button
                    onClick={() => setLogFilter('errors')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      logFilter === 'errors' ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    Hatalı Girişler
                  </button>
                  <button
                    onClick={() => setLogFilter('role')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      logFilter === 'role' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    Yetki Değişiklikleri
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={loadLogs}
                    className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${logsLoading ? 'animate-spin' : ''}`} />
                    <span>Güncelle</span>
                  </button>
                  <button
                    onClick={() => setShowClearLogsModal(true)}
                    className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 px-2 py-1 rounded-lg bg-red-950/40 hover:bg-red-900/50 border border-red-900/60 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Logları Temizle</span>
                  </button>
                </div>
              </div>

              {/* Logs Stream */}
              <div className="space-y-2">
                {logsLoading ? (
                  <div className="p-8 text-center text-xs text-slate-400">Loglar alınıyor...</div>
                ) : filteredLogs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-slate-950/60 rounded-xl border border-slate-800">
                    Henüz kayıtlı bir denetim logu bulunmuyor.
                  </div>
                ) : (
                  filteredLogs.map((log) => {
                    const isError = log.status === 'failed' || log.action.includes('HATA') || log.action.includes('BAŞARISIZ');
                    const isSuccess = log.status === 'success' || log.action.includes('BAŞARILI');
                    const isWarning = log.status === 'warning' || log.action.includes('ŞİFRE');

                    return (
                      <div
                        key={log.id}
                        className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 transition-colors ${
                          isError
                            ? 'bg-red-950/30 border-red-900/70 text-red-200'
                            : isSuccess
                            ? 'bg-slate-950/70 border-slate-800/80 text-slate-200'
                            : isWarning
                            ? 'bg-amber-950/30 border-amber-900/60 text-amber-200'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          {isError ? (
                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                          ) : isSuccess ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          ) : isWarning ? (
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                          ) : (
                            <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                          )}

                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] font-black uppercase px-1.5 py-0.2 rounded border ${
                                  isError
                                    ? 'bg-red-950 border-red-800 text-red-300'
                                    : isSuccess
                                    ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
                                    : 'bg-purple-950 border-purple-800 text-purple-300'
                                }`}
                              >
                                {log.action}
                              </span>
                              {log.email && (
                                <span className="font-bold text-white truncate">{log.email}</span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-300 leading-snug break-words">
                              {log.details}
                            </p>
                          </div>
                        </div>

                        <div className="text-[10px] text-slate-500 shrink-0 text-right">
                          <div>{formatDate(log.timestamp)}</div>
                          {log.ip && <div className="text-slate-600 truncate max-w-[120px]">{log.ip}</div>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-5 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>Tüm kullanıcı yetkileri ve sistem günlükleri anlık olarak korunmaktadır.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      </div>

      {/* Password Reset Modal */}
      {resetTargetUser && (
        <div
          id="reset-pass-overlay"
          className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setResetTargetUser(null)}
        >
          <div
            id="reset-pass-modal"
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Şifre Belirle / Sıfırla</h3>
                <p className="text-[11px] text-slate-400">{resetTargetUser.name} ({resetTargetUser.email})</p>
              </div>
            </div>

            <form onSubmit={handleSaveResetPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Yeni Şifre Belirleyin
                </label>
                <input
                  type="text"
                  required
                  value={targetNewPassword}
                  onChange={(e) => setTargetNewPassword(e.target.value)}
                  placeholder="Yeni şifreyi giriniz"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Öneri: demiryolu123 veya saha123
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTargetUser(null)}
                  className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isResettingPass}
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs shadow-md cursor-pointer disabled:opacity-60"
                >
                  {isResettingPass ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Modal (rule 3: using DeleteConfirmModal) */}
      <DeleteConfirmModal
        isOpen={Boolean(userToDelete)}
        title="Kullanıcıyı Sil"
        itemName={userToDelete?.name}
        description={`"${userToDelete?.name}" (${userToDelete?.email}) kullanıcısı sistemden kalıcı olarak silinecektir. Devam etmek istiyor musunuz?`}
        confirmText="Evet, Kullanıcıyı Sil"
        cancelText="Vazgeç"
        isDeleting={isDeletingUser}
        onConfirm={confirmDeleteUser}
        onClose={() => setUserToDelete(null)}
      />

      {/* Clear Logs Modal (rule 3: using DeleteConfirmModal) */}
      <DeleteConfirmModal
        isOpen={showClearLogsModal}
        title="Logları Temizle"
        description="Tüm geçmiş oturum ve denetim log kayıtları silinecektir. Bu işlem geri alınamaz."
        confirmText="Evet, Logları Temizle"
        cancelText="Vazgeç"
        isDeleting={isClearingLogs}
        onConfirm={confirmClearLogs}
        onClose={() => setShowClearLogsModal(false)}
      />
    </div>
  );
};
