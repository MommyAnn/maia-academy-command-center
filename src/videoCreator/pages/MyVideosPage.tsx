import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { vcApi, type Video } from "../api";
import { VideoCard } from "../components/VideoCard";
import { Alert, Button, Card, Input, isActiveStatus, PageHeader, Select, Spinner } from "../components/ui";

export function MyVideosPage() {
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [style, setStyle] = useState("ALL");

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const { videos } = await vcApi.videos({ search: search.trim() || undefined, status, style, limit: 100 });
        if (stop) return;
        setVideos(videos);
        setError(null);
        if (videos.some((v) => isActiveStatus(v.status))) timer = setTimeout(load, 6000);
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : "Could not load your videos.");
      }
    };
    const debounce = setTimeout(load, search ? 300 : 0);
    return () => {
      stop = true;
      clearTimeout(debounce);
      clearTimeout(timer);
    };
  }, [search, status, style]);

  return (
    <div>
      <PageHeader
        title="My Videos"
        subtitle="All the videos you've created. Only you can see them."
        action={
          <Link to="/studio/create">
            <Button>
              <Sparkles className="h-4 w-4" /> Create AI Video
            </Button>
          </Link>
        }
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_180px_200px]">
        <Input type="search" placeholder="Search by product name or video ID…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search videos" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="ALL">All statuses</option>
          <option value="COMPLETED">Ready</option>
          <option value="IN_PROGRESS">Being created</option>
          <option value="FAILED">Failed</option>
        </Select>
        <Select value={style} onChange={(e) => setStyle(e.target.value)} aria-label="Filter by style">
          <option value="ALL">All styles</option>
          <option value="PRODUCT_COMMERCIAL">Product Commercial</option>
          <option value="UGC_PROMO">UGC-Style Promo</option>
          <option value="SALES_PROMOTION">Sales Promotion</option>
        </Select>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {!videos ? (
        <Spinner />
      ) : videos.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="font-semibold text-vc-ivory">{search || status !== "ALL" || style !== "ALL" ? "No videos match your filters." : "You haven't created any videos yet."}</p>
          <Link to="/studio/create" className="mt-3 inline-block text-sm font-semibold text-vc-gold">
            Create your first video →
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      )}
    </div>
  );
}
