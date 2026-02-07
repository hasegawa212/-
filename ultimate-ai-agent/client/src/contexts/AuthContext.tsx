import { createContext, useContext, useState, useCallback, useEffect } from "react";

interface AuthUser {
  id: string;
  username: string;
  role: "admin" | "user";
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  login: async () => false,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem("auth_user");
    return stored ? JSON.parse(stored) : null;
  });

  const isAuthenticated = !!user;

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem("auth_user", JSON.stringify(data.user));
        localStorage.setItem("auth_token", data.token);
        return true;
      }

      // Fallback: simple local auth for demo
      if (username === "admin" && password === "admin") {
        const demoUser: AuthUser = { id: "1", username: "admin", role: "admin" };
        setUser(demoUser);
        localStorage.setItem("auth_user", JSON.stringify(demoUser));
        return true;
      }

      return false;
    } catch {
      // Fallback for when server doesn't have auth endpoint
      if (username === "admin" && password === "admin") {
        const demoUser: AuthUser = { id: "1", username: "admin", role: "admin" };
        setUser(demoUser);
        localStorage.setItem("auth_user", JSON.stringify(demoUser));
        return true;
      }
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("auth_user");
    localStorage.removeItem("auth_token");
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
