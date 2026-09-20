import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AuthenticatedUser } from "@/types";
import { DEMO_OWNER_USER } from "@/data/demoUser";

// DEMO AUTHENTICATION ONLY.
// This context simulates a logged-in session in memory. No passwords are
// checked against a real store, no tokens are issued, and nothing is
// persisted beyond the current browser session. This will be replaced by
// real authentication (e.g. a backend session/JWT flow) in a later step.

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const SESSION_KEY = "maia_demo_session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    return stored ? DEMO_OWNER_USER : null;
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      login: async (_email: string, _password: string) => {
        // Demo login: any non-empty email/password combination succeeds.
        await new Promise((resolve) => setTimeout(resolve, 500));
        sessionStorage.setItem(SESSION_KEY, "true");
        setUser(DEMO_OWNER_USER);
        return { success: true };
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
