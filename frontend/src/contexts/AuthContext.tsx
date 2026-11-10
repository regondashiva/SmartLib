import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import type { AuthUser, LoginRequest, UserRole } from "@/types";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  hasRole: (role: string | string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount — restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem("smartlib_token");
    const stored = localStorage.getItem("smartlib_user");
    if (token && stored) {
      try {
        setUser(JSON.parse(stored) as AuthUser);
      } catch {
        localStorage.removeItem("smartlib_user");
        localStorage.removeItem("smartlib_token");
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (credentials: LoginRequest) => {
    const res = await api.post<{
      success: boolean;
      data: {
        user: { id: string; email: string; firstName?: string; lastName?: string; name?: string; role: UserRole };
        tokens?: { accessToken: string; refreshToken: string };
        accessToken?: string;
      };
    }>("/auth/login", credentials);

    const payload = res.data.data;
    const authUser: AuthUser = {
      id: payload.user.id,
      name: payload.user.name || `${payload.user.firstName || ""} ${payload.user.lastName || ""}`.trim() || payload.user.email,
      email: payload.user.email,
      role: payload.user.role,
    };
    const token = payload.tokens?.accessToken || payload.accessToken;
    if (token) {
      localStorage.setItem("smartlib_token", token);
    }
    localStorage.setItem("smartlib_user", JSON.stringify(authUser));
    setUser(authUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("smartlib_token");
    localStorage.removeItem("smartlib_user");
    setUser(null);
    window.location.href = "/login";
  }, []);

  const hasRole = useCallback(
    (role: string | string[]) => {
      if (!user) return false;
      const roles = Array.isArray(role) ? role : [role];
      return roles.includes(user.role);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, logout, hasRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

