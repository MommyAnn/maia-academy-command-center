import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Coins, Film, HelpCircle, Loader2, Settings, Sparkles, Upload, Wand2, Download } from "lucide-react";
import { vcApi, type Video } from "../api";
import { useMe } from "../components/Layout";
import { VideoCard } from "../components/VideoCard";
import { Alert, Button, Card, isActiveStatus } from "../components/ui";

export function DashboardPage() {
  const { me, reload } = useMe();
  const [recent, setRecent] = useState<Video[] | null>(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      const { videos } = await vcApi.videos({ limit: 8 }).catch(() => ({ videos: [] as Video[] }));
      if (stop) return;
      setRecent(videos);
      // Keep refreshing while something is still being created.
      if (videos.some((v) => isActiveStatus(v.status))) setTimeout(() => !stop && void load().then(reload), 6000);
    }
    void load();
    return () => {
      stop = true;
    };
  }, [reload]);

  if (!me) return null;
  const inactive = me.account.accessStatus !== "ACTIVE";
  const firstName = me.user.fullName.split(" ")[0];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-vc-gold/30 bg-gradient-to-br from-vc-raised via-vc-surface to-vc-black p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-vc-gold/15 blur-3xl" />
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-vc-gold">Welcome to M.A.I.A. AI Video Creator</p>
        <h1 className="mt-3 max-w-2xl font-display text-3xl font-extrabold leading-tight text-vc-ivory sm:text-4xl">
          Hi {firstName}! Create your product video with AI.
        </h1>
        <p className="mt-3 max-w-xl text-vc-muted">Upload a product photo, pick a style, and M.A.I.A. will create a ready-to-post promotional video for you.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link to="/studio/create">
            <Button size="lg" className="w-full sm:w-auto" disabled={inactive || me.account.creditBalance <= 0} data-testid="create-video-cta">
              <Sparkles className="h-5 w-5" /> Create AI Video
            </Button>
          </Link>
          <p className="flex items-center gap-2 text-sm text-vc-muted">
            <Coins className="h-4 w-4 text-vc-gold" />
            You have <strong className="text-vc-gold-bright">{me.account.creditBalance}</strong> video credit{me.account.creditBalance === 1 ? "" : "s"} left
          </p>
        </div>
      </section>

      {inactive && (
        <Alert kind="warning" title="Your access is not active">
          Your AI Video Creator access is currently paused. Please contact M.A.I.A. support to reactivate it.
        </Alert>
      )}
      {!inactive && me.account.creditBalance <= 0 && (
        <Alert kind="info" title="You've used all your video credits">
          Contact M.A.I.A. support if you'd like more credits. You can still watch and download all your existing videos.
        </Alert>
      )}
      {!me.service.providerConnected && (
        <Alert kind="warning" title="Video service not connected yet">
          The AI video service is still being set up. You'll be able to create videos as soon as it's ready.
        </Alert>
      )}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat icon={Coins} label="Credits left" value={me.account.creditBalance} highlight />
        <Stat icon={Film} label="Videos ready" value={me.stats.completed} />
        <Stat icon={Loader2} label="Being created" value={me.stats.inProgress} />
        <Stat icon={Wand2} label="Styles available" value={3} />
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-vc-ivory">Recent videos</h2>
          <Link to="/studio/videos" className="flex items-center gap-1 text-sm font-medium text-vc-gold hover:text-vc-gold-bright">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {recent === null ? (
          <div className="h-40 animate-pulse rounded-2xl bg-vc-surface" />
        ) : recent.length === 0 ? (
          <Card className="text-center">
            <p className="font-semibold text-vc-ivory">No videos yet</p>
            <p className="mt-1 text-sm text-vc-muted">Your first AI video is just a photo away.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {recent.map((v) => (
              <VideoCard key={v.id} video={v} />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <HowStep icon={Upload} n={1} title="Upload a photo" text="A clear photo of your product on a plain background works best." />
        <HowStep icon={Wand2} n={2} title="Pick a style" text="Commercial, UGC-style or Sales Promotion. M.A.I.A. writes the AI directions for you." />
        <HowStep icon={Download} n={3} title="Download your MP4" text="Watch it, then download and post it on Facebook, TikTok, Reels or Shopee." />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <QuickLink to="/studio/videos" icon={Film} label="Video history" />
        <QuickLink to="/studio/account" icon={Settings} label="Account settings" />
        <QuickLink to="/studio/help" icon={HelpCircle} label="Help & tutorials" />
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value, highlight }: { icon: typeof Coins; label: string; value: number; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-vc-gold/40" : ""}>
      <Icon className={`h-5 w-5 ${highlight ? "text-vc-gold-bright" : "text-vc-muted"}`} />
      <p className={`mt-3 font-display text-3xl font-extrabold ${highlight ? "text-vc-gold-bright" : "text-vc-ivory"}`}>{value}</p>
      <p className="text-sm text-vc-muted">{label}</p>
    </Card>
  );
}

function HowStep({ icon: Icon, n, title, text }: { icon: typeof Coins; n: number; title: string; text: string }) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-vc-gold/10 text-vc-gold-bright ring-1 ring-vc-gold/30">
          <Icon className="h-5 w-5" />
        </span>
        <p className="font-semibold text-vc-ivory">
          {n}. {title}
        </p>
      </div>
      <p className="mt-3 text-sm text-vc-muted">{text}</p>
    </Card>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: typeof Coins; label: string }) {
  return (
    <Link to={to} className="flex items-center justify-between rounded-2xl border border-vc-border bg-vc-surface px-5 py-4 text-sm font-medium text-vc-ivory hover:border-vc-gold/50">
      <span className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-vc-gold" />
        {label}
      </span>
      <ArrowRight className="h-4 w-4 text-vc-dim" />
    </Link>
  );
}
