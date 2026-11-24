import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi, type SessionUser } from "./api";

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  isStaff: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

/** Real server-session auth (httpOnly cookie). The browser never decides who you are — /api/auth/me does. */
export function VcAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser((await authApi.me()).user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await authApi.login(email, password);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, loading, isStaff: !!user && !user.studentId, login, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useVcAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useVcAuth must be used inside VcAuthProvider");
  return v;
}
