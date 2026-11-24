import { Film, ImageOff } from "lucide-react";
import { Link } from "react-router-dom";
import { media, type Video } from "../api";
import { formatDate, STYLE_LABEL, StatusBadge } from "./ui";

export function VideoCard({ video }: { video: Video }) {
  const thumb = media(video.media?.thumbnailUrl) ?? media(video.photoUrl);
  return (
    <Link to={`/studio/videos/${video.id}`} className="group overflow-hidden rounded-2xl border border-vc-border bg-vc-surface transition hover:border-vc-gold/50">
      <div className="relative aspect-[4/5] bg-vc-raised">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" className={`h-full w-full object-cover transition group-hover:scale-[1.02] ${video.status !== "COMPLETED" ? "opacity-50" : ""}`} />
        ) : (
          <div className="flex h-full items-center justify-center text-vc-dim">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
        <div className="absolute left-3 top-3">
          <StatusBadge status={video.status} />
        </div>
        {video.status === "COMPLETED" && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-vc-black/75 px-2.5 py-1 text-xs font-semibold text-vc-ivory">
            <Film className="h-3.5 w-3.5 text-vc-gold" /> {video.durationSeconds}s · {video.aspectRatio}
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="truncate font-semibold text-vc-ivory">{video.product.productName || "Untitled product"}</p>
        <p className="mt-0.5 text-xs text-vc-muted">
          {STYLE_LABEL[video.style]} · {formatDate(video.createdAt)}
        </p>
      </div>
    </Link>
  );
}
