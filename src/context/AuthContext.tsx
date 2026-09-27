import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types.ts';
import {
  getStoredToken,
  getStoredUser,
  clearStoredAuth,
  loginApi,
  registerApi,
  fetchCurrentUser,
} from '../services/authApi.ts';

interface AuthContextType {
  user: User | null;
  token: string | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  isViewer: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
  canAddPoint: boolean;
  canAddNote: boolean;
  canAddPhoto: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; department?: string; role?: UserRole }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize and verify user session
  useEffect(() => {
    async function initAuth() {
      const storedToken = getStoredToken();
      if (!storedToken) {
        setUser(null);
        setToken(null);
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await fetchCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          setToken(storedToken);
        } else {
          clearStoredAuth();
          setUser(null);
          setToken(null);
        }
      } catch (err) {
        console.warn('Oturum doğrulanamadı:', err);
        clearStoredAuth();
        setUser(null);
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await loginApi(email, pass);
      setUser(res.user);
      setToken(res.token);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: {
    name: string;
    email: string;
    password: string;
    department?: string;
    role?: UserRole;
  }) => {
    setIsLoading(true);
    try {
      const res = await registerApi(data);
      setUser(res.user);
      setToken(res.token);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearStoredAuth();
    setUser(null);
    setToken(null);
  };

  const role: UserRole = user?.role || 'viewer';
  const isAdmin = role === 'admin';
  const isEditor = role === 'editor';
  const isViewer = role === 'viewer';
  // Sahadaki sınıflardan nokta ekleme ve düzenleme kaldırıldı: Yalnızca Yönetici nokta ekleyip düzenleyebilir
  const canAddPoint = isAdmin;
  const canEdit = isAdmin;
  const canDelete = isAdmin;
  const canManageUsers = isAdmin;
  // Saha personeli yalnızca mevcut noktalara saha notu yazabilir ve fotoğraf yükleyebilir
  const canAddNote = isAdmin || isEditor;
  const canAddPhoto = isAdmin || isEditor;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role,
        isAuthenticated: !!user,
        isLoading,
        isAdmin,
        isEditor,
        isViewer,
        canEdit,
        canDelete,
        canManageUsers,
        canAddPoint,
        canAddNote,
        canAddPhoto,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
