import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, GraduationCap, ShieldCheck, TrendingUp } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/common/Button";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("owner@maiaacademy.demo");
  const [password, setPassword] = useState("demo1234");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError("Please enter both email address and password.");
      return;
    }

    setIsSubmitting(true);
    const result = await login(email, password);
    setIsSubmitting(false);

    if (result.success) {
      navigate("/dashboard", { replace: true });
    } else {
      setError(result.error ?? "Unable to sign in. Please try again.");
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-maia-bg">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-maia-black px-12 py-12 text-maia-gold-soft lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #c8a44d 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #c8a44d 0%, transparent 70%)" }}
        />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-maia-gold/40 bg-maia-black-soft">
            <span className="font-display text-lg font-bold text-maia-gold">M</span>
          </div>
          <div className="leading-tight">
            <p className="font-display text-sm font-bold tracking-[0.2em] text-white">M.A.I.A.</p>
            <p className="text-[11px] tracking-[0.15em] text-maia-gold-soft/80">BUSINESS SOLUTIONS ACADEMY</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="font-display text-4xl font-extrabold leading-tight text-white">
            Academy Command
            <br />
            Center
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-maia-gold-soft/80">
            One elegant workspace to manage students, finances, training, and your
            entire team &mdash; built for Mommy Ann Import Academy.
          </p>

          <div className="mt-10 space-y-5">
            <FeatureRow icon={<GraduationCap size={18} />} text="Track every student journey, from enrollment to certification." />
            <FeatureRow icon={<TrendingUp size={18} />} text="Monitor collections, receivables, and expenses in real time." />
            <FeatureRow icon={<ShieldCheck size={18} />} text="Give your team clear, accountable daily task visibility." />
          </div>
        </div>

        <p className="relative text-xs text-maia-gold-soft/50">
          &copy; {new Date().getFullYear()} Mommy Ann Import Academy. All rights reserved.
        </p>
      </div>

      {/* Login form panel */}
      <div className="flex w-full flex-1 items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex flex-col items-center text-center lg:hidden">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-maia-black">
              <span className="font-display text-lg font-bold text-maia-gold">M</span>
            </div>
          </div>

          <div className="mb-8 text-center lg:text-left">
            <p className="font-display text-xs font-bold tracking-[0.3em] text-maia-gold-deep">M.A.I.A.</p>
            <h2 className="mt-1 font-display text-2xl font-extrabold text-maia-ink">
              ACADEMY COMMAND CENTER
            </h2>
            <p className="mt-2 text-sm font-medium text-maia-ink-soft">Manage. Monitor. Grow.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-maia-ink">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@maiaacademy.com"
                className="w-full rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none transition-colors placeholder:text-maia-ink-soft/50 focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-maia-ink">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 pr-10 text-sm text-maia-ink outline-none transition-colors placeholder:text-maia-ink-soft/50 focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-maia-ink-soft hover:text-maia-ink"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-maia-danger-bg px-3 py-2 text-sm font-medium text-maia-danger">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-maia-ink-soft">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-maia-border text-maia-gold-deep focus:ring-maia-gold/40 accent-maia-gold-deep"
                />
                Remember Me
              </label>
              <button
                type="button"
                className="font-semibold text-maia-gold-deep hover:text-maia-ink"
                onClick={() => window.alert("Password reset is not available in this demo build.")}
              >
                Forgot Password?
              </button>
            </div>

            <Button type="submit" className="w-full justify-center" disabled={isSubmitting}>
              {isSubmitting ? "Signing In..." : "SIGN IN"}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-maia-ink-soft">
            Demo authentication only &middot; any email &amp; password will sign you in as Owner.
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-maia-gold/30 bg-maia-black-soft text-maia-gold">
        {icon}
      </div>
      <p className="text-sm leading-relaxed text-maia-gold-soft/80">{text}</p>
    </div>
  );
}
