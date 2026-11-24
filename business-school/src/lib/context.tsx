import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type Course, type SiteInfo, type User } from "./api";

type SiteCtx = {
  site: SiteInfo | null;
  courses: Course[] | null;
  reload: () => void;
};
const SiteContext = createContext<SiteCtx>({ site: null, courses: null, reload: () => {} });

export function SiteProvider({ children }: { children: ReactNode }) {
  const [site, setSite] = useState<SiteInfo | null>(null);
  const [courses, setCourses] = useState<Course[] | null>(null);
  const reload = useCallback(() => {
    api.get<SiteInfo>("/api/public/site").then(setSite).catch(() => {});
    api.get<Course[]>("/api/public/courses").then(setCourses).catch(() => setCourses([]));
  }, []);
  useEffect(reload, [reload]);
  useMetaPixel(site?.settings["tracking.metaPixelId"]);
  return <SiteContext.Provider value={{ site, courses, reload }}>{children}</SiteContext.Provider>;
}

export const useSite = () => useContext(SiteContext);

type AuthCtx = {
  user: User | null;
  ready: boolean;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthCtx>({ user: null, ready: false, setUser: () => {}, logout: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    api
      .get<{ user: User | null }>("/api/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);
  const logout = async () => {
    await api.post("/api/auth/logout").catch(() => {});
    setUser(null);
  };
  return <AuthContext.Provider value={{ user, ready, setUser, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/**
 * Meta Pixel — only loaded when the admin has saved a Pixel ID in Settings.
 * Nothing is tracked while the field is empty.
 */
function useMetaPixel(pixelId: string | undefined) {
  useEffect(() => {
    if (!pixelId || !/^\d{5,20}$/.test(pixelId)) return;
    type Fbq = ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue: unknown[];
      loaded: boolean;
      version: string;
      push: unknown;
    };
    const w = window as unknown as { fbq?: Fbq; _fbq?: Fbq };
    if (w.fbq) return;
    // Same bootstrap as Meta's official snippet: queue calls until fbevents.js loads.
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    } as Fbq;
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.push = fbq;
    w.fbq = fbq;
    w._fbq = fbq;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
    fbq("init", pixelId);
    fbq("track", "PageView");
  }, [pixelId]);
}

/** Fires a Meta Pixel event if the pixel is configured; otherwise does nothing. */
export function trackEvent(name: string, params?: Record<string, unknown>) {
  const w = window as unknown as { fbq?: (...args: unknown[]) => void };
  w.fbq?.("track", name, params);
}
