import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, ApiError, type User } from "@/lib/api";
import { useAuth } from "@/lib/context";
import { EmptyState, ErrorNote, Ornament, Spinner } from "@/components/ui";

function AuthShell({ title, gold, sub, children }: { title: string; gold: string; sub: ReactNode; children: ReactNode }) {
  return (
    <div className="container-x flex justify-center py-16">
      <div className="glass w-full max-w-md p-8">
        <Ornament />
        <h1 className="h-display mt-6 text-center text-3xl text-ivory">
          {title} <span className="text-gold-grad">{gold}</span>
        </h1>
        <p className="mt-3 text-center text-sm text-muted">{sub}</p>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

const home = (u: User) => (u.role === "admin" ? "/admin" : "/portal");

export function Login() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from ?? home(user)} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ user: User }>("/api/auth/login", { email, password });
      setUser(r.user);
      navigate(from ?? home(r.user), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome" gold="back." sub="Sign in to your M.A.I.A. Student Portal.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="l-email">Email</label>
          <input id="l-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="l-pass">Password</label>
          <input id="l-pass" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </div>
        <ErrorNote message={error} />
        <button className="btn btn-gold w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link to="/register" className="text-gold hover:text-gold-pale">
          Create a student account
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-muted">
        Forgot your password? <Link to="/contact?topic=Account%20help" className="text-gold">Contact us</Link> and we'll help you reset it.
      </p>
    </AuthShell>
  );
}

export function Register() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", mobile: "", password: "" });
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={home(user)} replace />;
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!agree) return setError("Please agree to the Terms and Privacy Notice.");
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ user: User }>("/api/auth/register", form);
      setUser(r.user);
      navigate("/portal", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your"
      gold="account."
      sub="Your purchased courses will appear in your Student Portal once your enrollment is confirmed."
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="r-name">Full name</label>
          <input id="r-name" className="input" value={form.name} onChange={set("name")} autoComplete="name" required />
        </div>
        <div>
          <label className="label" htmlFor="r-email">Email</label>
          <input id="r-email" type="email" className="input" value={form.email} onChange={set("email")} autoComplete="email" required />
          <p className="hint">Use the same email you'll use when you pay, so we can match your enrollment.</p>
        </div>
        <div>
          <label className="label" htmlFor="r-mobile">Mobile number <span className="text-muted">(optional)</span></label>
          <input id="r-mobile" className="input" value={form.mobile} onChange={set("mobile")} autoComplete="tel" />
        </div>
        <div>
          <label className="label" htmlFor="r-pass">Password</label>
          <input id="r-pass" type="password" className="input" value={form.password} onChange={set("password")} autoComplete="new-password" minLength={10} required />
          <p className="hint">At least 10 characters.</p>
        </div>
        <label className="flex items-start gap-3 text-sm text-ivory/85">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[#d6a524]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>
            I agree to the{" "}
            <Link to="/policies/terms" className="text-gold">Terms of Enrollment</Link> and{" "}
            <Link to="/policies/privacy" className="text-gold">Privacy Notice</Link>.
          </span>
        </label>
        <ErrorNote message={error} />
        <button className="btn btn-gold w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" className="text-gold hover:text-gold-pale">Sign in</Link>
      </p>
    </AuthShell>
  );
}

const POLICY_TITLES: Record<string, string> = {
  terms: "Terms of Enrollment",
  refund: "Refund & Rescheduling Policy",
  privacy: "Privacy Notice",
};

export function Policy() {
  const { key = "" } = useParams();
  const [body, setBody] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    setBody(null);
    setMissing(false);
    api
      .get<{ body: string }>(`/api/public/policies/${key}`)
      .then((r) => setBody(r.body))
      .catch(() => setMissing(true));
  }, [key]);
  if (missing || !POLICY_TITLES[key])
    return (
      <div className="container-x py-20">
        <EmptyState title="Page not found" />
      </div>
    );
  if (body === null) return <Spinner />;
  return (
    <div className="container-x max-w-3xl py-16">
      <span className="eyebrow">Policies</span>
      <h1 className="h-display mt-5 text-4xl text-ivory">{POLICY_TITLES[key]}</h1>
      <div className="glass mt-8 p-8 leading-relaxed whitespace-pre-line text-ivory/85">{body}</div>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="container-x py-20">
      <EmptyState title="Page not found">
        <Link to="/" className="btn btn-outline mt-4">
          Go home
        </Link>
      </EmptyState>
    </div>
  );
}
