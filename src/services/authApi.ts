import { User, UserRole, AuthResponse, AuditLog } from '../types.ts';

const TOKEN_KEY = 'demiryolu_auth_token';
const USER_KEY = 'demiryolu_auth_user';

export function getStoredToken(): string | null {
  try {
    const sessionToken = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
    return sessionToken;
  } catch {
    return null;
  }
}

export function getStoredUser(): User | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function storeAuthData(token: string, user: User) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (err) {
    console.warn('Oturum bilgisi kaydedilemedi:', err);
  }
}

export function clearStoredAuth() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch (err) {
    console.warn('Oturum bilgisi silinemedi:', err);
  }
}

export async function loginApi(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Giriş yapılamadı' }));
    const errorObj = new Error(err.error || 'Giriş yapılamadı');
    (errorObj as any).code = err.code;
    throw errorObj;
  }

  const data: AuthResponse = await res.json();
  storeAuthData(data.token, data.user);
  return data;
}

export async function registerApi(data: {
  name: string;
  email: string;
  password: string;
  department?: string;
  role?: UserRole;
}): Promise<AuthResponse> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Kayıt başarısız' }));
    throw new Error(err.error || 'Kayıt işlemi başarısız');
  }

  const result: AuthResponse = await res.json();
  storeAuthData(result.token, result.user);
  return result;
}

export async function fetchCurrentUser(): Promise<User | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      clearStoredAuth();
      return null;
    }

    const data = await res.json();
    if (data.user) {
      sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data.user;
    }
    return null;
  } catch (err) {
    // Offline resilience: return stored cached user
    return getStoredUser();
  }
}

export async function fetchAllUsers(): Promise<User[]> {
  const token = getStoredToken();
  try {
    const res = await fetch('/api/auth/users', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return [];
    const list: User[] = await res.json();
    let deletedSet = new Set<string>();
    try {
      const raw = localStorage.getItem('demiryolu_deleted_users');
      if (raw) deletedSet = new Set(JSON.parse(raw));
    } catch {}

    return list.filter((u) => !deletedSet.has(u.id) && !deletedSet.has((u.email || '').toLowerCase()));
  } catch {
    return [];
  }
}

export async function updateUserRoleApi(userId: string, role: UserRole): Promise<boolean> {
  const token = getStoredToken();
  const res = await fetch(`/api/auth/users/${userId}/role`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ role }),
  });

  return res.ok;
}

export async function resetUserPasswordApi(userId: string, newPassword: string): Promise<boolean> {
  const token = getStoredToken();
  const res = await fetch(`/api/auth/users/${userId}/password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ newPassword }),
  });

  return res.ok;
}

export async function approveUserApi(userId: string, role: UserRole, status: 'active' | 'rejected' = 'active'): Promise<boolean> {
  const token = getStoredToken();
  const res = await fetch(`/api/auth/users/${userId}/approve`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ role, status }),
  });

  return res.ok;
}

export async function deleteUserApi(userId: string, email?: string): Promise<boolean> {
  const token = getStoredToken();
  // Record locally in deleted users blacklist so even offline or on reload it never resurfaces
  try {
    const raw = localStorage.getItem('demiryolu_deleted_users') || '[]';
    const set = new Set(JSON.parse(raw));
    set.add(userId);
    if (email) set.add(email.trim().toLowerCase());
    localStorage.setItem('demiryolu_deleted_users', JSON.stringify(Array.from(set)));
  } catch {}

  const res = await fetch(`/api/auth/users/${userId}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  return res.ok;
}

export async function fetchAuditLogs(): Promise<AuditLog[]> {
  try {
    const res = await fetch('/api/logs');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function clearAuditLogs(): Promise<boolean> {
  try {
    const res = await fetch('/api/logs/clear', { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}
