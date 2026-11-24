import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useVcAuth } from "../auth";
import { ApiError, authApi } from "../api";
import { Logo } from "../components/Layout";
import { Alert, Button, Input, Label, Spinner } from "../components/ui";

function AuthFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-vc-black px-4 py-10">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-vc-gold/10 blur-3xl" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-3xl border border-vc-border bg-vc-surface/90 p-6 shadow-2xl backdrop-blur sm:p-8">
          <h1 className="font-display text-2xl font-extrabold text-vc-ivory">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-vc-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-6 text-center text-xs text-vc-dim">M.A.I.A. Business Solutions Academy · Upload Your Product. Let AI Create Your Video.</p>
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, id, autoComplete }: { value: string; onChange: (v: string) => void; id: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} required className="pr-12" />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-vc-dim hover:text-vc-ivory">
        {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}

export function LoginPage() {
  const { user, loading, login } = useVcAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return <Spinner />;
  if (user) return <Navigate to={user.studentId ? "/studio" : "/studio/admin"} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(email.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/studio/login" ? from : u.studentId ? "/studio" : "/studio/admin", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? "Too many attempts. Please wait a minute and try again." : err instanceof ApiError ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Welcome back" subtitle="Log in to create your AI product videos.">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert kind="error">{error}</Alert>}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/studio/forgot-password" className="mb-1.5 text-sm text-vc-gold hover:text-vc-gold-bright">
              Forgot password?
            </Link>
          </div>
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" />
        </div>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Log in
        </Button>
        <p className="text-center text-xs text-vc-dim">Accounts are created by M.A.I.A. after your purchase is confirmed.</p>
      </form>
    </AuthFrame>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await authApi.requestReset(email.trim());
      setDevToken(res.devOnlyResetToken ?? null);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Reset your password" subtitle="Enter the email you use to log in.">
      {sent ? (
        <div className="space-y-4">
          <Alert kind="success" title="Request received">
            If this email has an account, a password reset link is on its way. Didn't get it? Message M.A.I.A. support and we'll send you a reset link directly.
          </Alert>
          {devToken && (
            <Alert kind="warning" title="Development mode only">
              <Link className="underline" to={`/studio/reset-password?token=${devToken}`}>
                Open reset page
              </Link>
            </Alert>
          )}
          <Link to="/studio/login" className="block text-center text-sm text-vc-gold">
            Back to log in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert kind="error">{error}</Alert>}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Send reset link
          </Button>
          <Link to="/studio/login" className="block text-center text-sm text-vc-muted hover:text-vc-ivory">
            Back to log in
          </Link>
        </form>
      )}
    </AuthFrame>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw !== pw2) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      await authApi.completeReset(token, pw);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Choose a new password" subtitle="At least 10 characters, with uppercase, lowercase and a number.">
      {!token ? (
        <Alert kind="error">This reset link is incomplete. Please use the full link you received.</Alert>
      ) : done ? (
        <div className="space-y-4">
          <Alert kind="success" title="Password updated">
            You can now log in with your new password.
          </Alert>
          <Link to="/studio/login">
            <Button size="lg" className="w-full">
              Go to log in
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert kind="error">{error}</Alert>}
          <div>
            <Label htmlFor="pw">New password</Label>
            <PasswordInput id="pw" value={pw} onChange={setPw} autoComplete="new-password" />
          </div>
          <div>
            <Label htmlFor="pw2">Confirm new password</Label>
            <PasswordInput id="pw2" value={pw2} onChange={setPw2} autoComplete="new-password" />
          </div>
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Save new password
          </Button>
        </form>
      )}
    </AuthFrame>
  );
}
