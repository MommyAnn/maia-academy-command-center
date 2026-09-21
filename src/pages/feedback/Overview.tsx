import { useNavigate } from "react-router-dom";
import { Card, CardHeader } from "@/components/common/Card";
import { useFeedbackStore } from "@/data/feedbackStore";
import { FEEDBACK_SOURCE_TYPES } from "@/types/feedback";

export function Overview() {
  const { requests, submissions, consents } = useFeedbackStore();
  const navigate = useNavigate();

  const final = submissions.filter((s) => !s.isDraft);
  const written = final.filter((s) => s.writtenFeedback.trim().length > 0);
  const video = final.filter((s) => Boolean(s.videoAsset));
  const consentGranted = consents.filter((c) => c.status === "Granted");
  const privateFeedback = final.filter((s) => s.status === "Kept Private" || s.status === "Submitted" || s.status === "Reviewed");
  const pendingReview = final.filter((s) => s.status === "Submitted");
  const approvedTestimonials = final.filter((s) => s.status === "Approved for Marketing" || s.status === "Featured");

  const bySource = FEEDBACK_SOURCE_TYPES.map((type) => ({
    type,
    count: final.filter((s) => s.sourceType === type).length,
  })).filter((r) => r.count > 0);

  const tiles = [
    { label: "Requests Sent", value: requests.length, path: "/feedback/requests" },
    { label: "Feedback Received", value: final.length, path: "/feedback/all" },
    { label: "Written", value: written.length, path: "/feedback/all?type=Written" },
    { label: "Video", value: video.length, path: "/feedback/all?type=Video" },
    { label: "Marketing Consent Granted", value: consentGranted.length, path: "/feedback/marketing-library" },
    { label: "Private Feedback", value: privateFeedback.length, path: "/feedback/all" },
    { label: "Pending Review", value: pendingReview.length, path: "/feedback/all?status=Submitted" },
    { label: "Approved Testimonials", value: approvedTestimonials.length, path: "/feedback/marketing-library" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">Feedback Overview</h2>
        <p className="text-sm text-maia-ink-soft">
          Live counts across every feedback request and submission. Ratings alone are never treated as the measure of training quality.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <button
            key={tile.label}
            onClick={() => navigate(tile.path)}
            className="rounded-2xl border border-maia-border bg-maia-surface px-4 py-4 text-left transition-colors hover:border-maia-gold"
          >
            <p className="font-display text-2xl font-extrabold leading-none text-maia-ink">{tile.value}</p>
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">{tile.label}</p>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader title="Feedback by Source" />
        {bySource.length === 0 ? (
          <p className="text-sm text-maia-ink-soft">No feedback submitted yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {bySource.map((r) => (
              <div key={r.type} className="flex items-center justify-between rounded-lg bg-maia-bg px-3.5 py-2.5 text-sm">
                <span className="font-medium text-maia-ink">{r.type}</span>
                <span className="font-display font-bold text-maia-gold-deep">{r.count}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
