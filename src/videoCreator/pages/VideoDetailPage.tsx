import clsx from "clsx";
import { ArrowLeft, Check, Download, Loader2, RotateCcw, Trash2, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, media, vcApi, type Video } from "../api";
import { useMe } from "../components/Layout";
import { Alert, Button, Card, formatDate, formatDuration, isActiveStatus, LANGUAGE_LABEL, Spinner, StatusBadge, STYLE_LABEL } from "../components/ui";

const STEPS = [
  { key: "QUEUED", label: "Getting ready" },
  { key: "SUBMITTED", label: "Sent to Google" },
  { key: "RUNNING", label: "AI is creating your video" },
  { key: "PROCESSING", label: "Adding finishing touches" },
  { key: "COMPLETED", label: "Ready to download" },
] as const;

export function VideoDetailPage() {
  const { id = "" } = useParams();
  const { reload } = useMe();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const wasActive = useRef(false);

  const load = useCallback(async () => {
    try {
      const { video } = await vcApi.video(id);
      setVideo(video);
      setError(null);
      if (wasActive.current && !isActiveStatus(video.status)) void reload(); // refund/charge settled
      wasActive.current = isActiveStatus(video.status);
      return video;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load this video.");
      return null;
    }
  }, [id, reload]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const v = await load();
      if (!stopped && (!v || isActiveStatus(v.status))) timer = setTimeout(tick, 4000);
    };
    void tick();
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(clock);
    };
  }, [load]);

  if (error && !video) return <Alert kind="error" title="Video not found">{error}</Alert>;
  if (!video) return <Spinner />;

  const active = isActiveStatus(video.status);
  const elapsed = Math.max(0, ((video.completedAt ? new Date(video.completedAt).getTime() : now) - new Date(video.createdAt).getTime()) / 1000);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link to="/studio/videos" className="inline-flex items-center gap-2 text-sm text-vc-muted hover:text-vc-ivory">
        <ArrowLeft className="h-4 w-4" /> My Videos
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-vc-ivory sm:text-3xl">{video.product.productName || "Your product video"}</h1>
          <p className="mt-1 text-sm text-vc-muted">
            {STYLE_LABEL[video.style]} · {video.displayId}
          </p>
        </div>
        <StatusBadge status={video.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {video.status === "COMPLETED" && video.media ? (
            <Player video={video} />
          ) : video.status === "FAILED" ? (
            <Card className="border-vc-danger/40">
              <div className="flex items-start gap-3">
                <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-vc-danger" />
                <div>
                  <p className="font-display text-lg font-bold text-vc-ivory">This video could not be created</p>
                  <p className="mt-1 text-vc-muted">{video.statusMessage}</p>
                  {video.creditStatus === "REFUNDED" && <p className="mt-3 text-sm font-semibold text-vc-success">✓ {video.creditsCharged} credit{video.creditsCharged === 1 ? " was" : "s were"} returned to your balance.</p>}
                  <Link to="/studio/create">
                    <Button className="mt-4">
                      <RotateCcw className="h-4 w-4" /> Try again
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="flex flex-col items-center gap-6 py-6 text-center sm:flex-row sm:items-start sm:text-left">
                {video.photoUrl && (
                  <div className="relative w-36 shrink-0 overflow-hidden rounded-2xl border border-vc-border bg-white">
                    <img src={media(video.photoUrl)} alt="" className="aspect-square w-full object-contain opacity-80" />
                    <div className="absolute inset-0 animate-pulse bg-gradient-to-t from-vc-gold/30 to-transparent" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-display text-xl font-bold text-vc-ivory">Creating your video…</p>
                  <p className="mt-1 text-sm text-vc-muted" data-testid="status-message">
                    {video.statusMessage}
                  </p>
                  <p className="mt-2 text-xs text-vc-dim">
                    Time so far: {formatDuration(elapsed)} · You can leave this page — your video keeps generating and will appear in My Videos.
                  </p>
                  <ol className="mt-5 space-y-2.5">
                    {STEPS.map((s, i) => {
                      const current = STEPS.findIndex((x) => x.key === video.status);
                      const done = i < current;
                      const now_ = i === current;
                      return (
                        <li key={s.key} className={clsx("flex items-center gap-3 text-sm", done ? "text-vc-success" : now_ ? "text-vc-gold-bright" : "text-vc-dim")}>
                          <span className={clsx("flex h-6 w-6 items-center justify-center rounded-full ring-1", done ? "bg-vc-success/15 ring-vc-success/40" : now_ ? "bg-vc-gold/15 ring-vc-gold/50" : "ring-vc-border")}>
                            {done ? <Check className="h-3.5 w-3.5" /> : now_ ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="text-[10px]">{i + 1}</span>}
                          </span>
                          {s.label}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>
            </Card>
          )}
          {video.warningMessage && <Alert kind="warning">{video.warningMessage}</Alert>}
        </div>

        <Card className="h-fit space-y-4">
          <h2 className="font-display font-bold text-vc-ivory">Video details</h2>
          <dl className="space-y-2.5 text-sm">
            <Row label="Style" value={STYLE_LABEL[video.style]} />
            <Row label="Shape" value={video.aspectRatio === "9:16" ? "Vertical 9:16" : "Horizontal 16:9"} />
            <Row label="Length" value={`${video.durationSeconds} seconds`} />
            <Row label="Quality" value={video.resolution} />
            <Row label="Language" value={LANGUAGE_LABEL[video.language]} />
            <Row label="Voiceover" value={video.voiceover ? "On" : "Off"} />
            <Row label="Text on video" value={video.media ? (video.media.hasTextOverlay ? "Added" : "None") : video.overlay ? "On" : "Off"} />
            <Row label="Created" value={formatDate(video.createdAt)} />
            {video.completedAt && <Row label={video.status === "FAILED" ? "Ended" : "Finished"} value={`${formatDate(video.completedAt)} (${formatDuration(elapsed)})`} />}
            <Row label="Credits used" value={video.creditStatus === "REFUNDED" ? `0 (${video.creditsCharged} returned)` : String(video.creditsCharged)} />
          </dl>
          {!active && (
            <Button
              variant="danger"
              size="sm"
              className="w-full"
              onClick={async () => {
                if (!window.confirm("Delete this video permanently? This cannot be undone.")) return;
                try {
                  await vcApi.deleteVideo(video.id);
                  navigate("/studio/videos");
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Delete failed.");
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete video
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-vc-muted">{label}</dt>
      <dd className="text-right font-medium text-vc-ivory">{value}</dd>
    </div>
  );
}

function Player({ video }: { video: Video }) {
  const m = video.media!;
  const filename = `${(video.product.productName || "maia-video").replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "maia-video"}-${video.displayId}.mp4`;
  return (
    <Card className="p-3 sm:p-4">
      <div className={clsx("mx-auto overflow-hidden rounded-xl bg-black", video.aspectRatio === "9:16" ? "max-w-sm" : "w-full")}>
        <video src={media(m.videoUrl)} poster={media(m.thumbnailUrl)} controls playsInline preload="metadata" className={clsx("w-full", video.aspectRatio === "9:16" ? "aspect-[9/16]" : "aspect-video")} data-testid="video-player" />
      </div>
      <div className="mt-4 space-y-2">
        <DownloadButton url={media(m.downloadUrl)!} filename={filename} label="Download MP4" primary />
        {m.originalDownloadUrl && <DownloadButton url={media(m.originalDownloadUrl)!} filename={filename.replace(".mp4", "-no-text.mp4")} label="Download without text" />}
      </div>
    </Card>
  );
}

/** Real download with progress (fetches the bytes, then saves them), with a plain-link fallback. */
function DownloadButton({ url, filename, label, primary }: { url: string; filename: string; label: string; primary?: boolean }) {
  const [state, setState] = useState<{ kind: "idle" } | { kind: "loading"; pct: number | null } | { kind: "done" } | { kind: "error"; msg: string }>({ kind: "idle" });

  async function start() {
    setState({ kind: "loading", pct: 0 });
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(res.status === 403 ? "The download link expired. Please refresh the page." : `Download failed (error ${res.status}).`);
      const total = Number(res.headers.get("content-length") ?? 0);
      const reader = res.body?.getReader();
      let blob: Blob;
      if (reader) {
        const chunks: BlobPart[] = [];
        let received = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value as BlobPart);
          received += value.byteLength;
          setState({ kind: "loading", pct: total ? Math.round((received / total) * 100) : null });
        }
        blob = new Blob(chunks, { type: "video/mp4" });
      } else {
        blob = await res.blob();
      }
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 60_000);
      setState({ kind: "done" });
    } catch (e) {
      setState({ kind: "error", msg: e instanceof Error ? e.message : "Download failed." });
    }
  }

  return (
    <div>
      <Button variant={primary ? "primary" : "secondary"} size={primary ? "lg" : "md"} className="w-full" onClick={start} loading={state.kind === "loading"} data-testid={primary ? "download-button" : undefined}>
        {state.kind !== "loading" && <Download className="h-5 w-5" />}
        {state.kind === "loading" ? (state.pct !== null ? `Downloading… ${state.pct}%` : "Downloading…") : label}
      </Button>
      {state.kind === "done" && <p className="mt-1.5 text-center text-xs text-vc-success" data-testid="download-status">✓ Downloaded — check your Downloads folder (or Files app on iPhone).</p>}
      {state.kind === "error" && (
        <p className="mt-1.5 text-center text-xs text-vc-danger">
          {state.msg}{" "}
          <a href={url} className="underline" download={filename}>
            Try direct link
          </a>
        </p>
      )}
    </div>
  );
}
