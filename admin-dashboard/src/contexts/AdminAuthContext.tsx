import { createContext, useContext, useState } from "react";

interface AdminUser {
  email: string;
}

interface AdminAuthContextType {
  admin: AdminUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

const STORAGE_KEY = "admin-dashboard-session";

// デモ用の簡易認証。実運用ではサーバー側の認証に置き換えてください。
const DEMO_EMAIL = "admin@example.com";
const DEMO_PASSWORD = "admin";

const AdminAuthContext = createContext<AdminAuthContextType>({
  admin: null,
  isAuthenticated: false,
  login: () => false,
  logout: () => {},
});

function readSession(): AdminUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdminUser) : null;
  } catch {
    return null;
  }
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(() => readSession());

  const login = (email: string, password: string): boolean => {
    if (email.trim() === DEMO_EMAIL && password === DEMO_PASSWORD) {
      const user: AdminUser = { email: email.trim() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      setAdmin(user);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider
      value={{ admin, isAuthenticated: admin !== null, login, logout }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}
