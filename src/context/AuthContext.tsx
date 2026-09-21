import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AuthenticatedUser } from "@/types";

// DEMO AUTHENTICATION ONLY.
// This context simulates a logged-in session in memory. No passwords are
// checked against a real store, no tokens are issued. The resolved user is
// mirrored to sessionStorage only so a page refresh keeps the same demo
// session (including which role/record it resolved to) — this is NOT a
// real, secure session token and will be replaced by a real backend
// session/JWT flow in a later step.
//
// Role resolution itself (deciding whether an email belongs to a student,
// staff member, or defaults to Owner) happens in src/pages/Login.tsx, which
// has access to the student/staff stores — this context only holds and
// persists whatever resolved user it's given.

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  login: (user: AuthenticatedUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const SESSION_KEY = "maia_demo_session";

function loadStoredUser(): AuthenticatedUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthenticatedUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(() => loadStoredUser());

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      login: (nextUser: AuthenticatedUser) => {
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));
        } catch {
          // Demo-only persistence — safe to ignore quota/availability errors.
        }
        setUser(nextUser);
      },
      logout: () => {
        sessionStorage.removeItem(SESSION_KEY);
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
