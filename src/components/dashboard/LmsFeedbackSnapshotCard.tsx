import { useNavigate } from "react-router-dom";
import { Card, CardHeader } from "@/components/common/Card";

function Tile({ label, value, path, tone }: { label: string; value: number; path: string; tone?: "gold" | "success" }) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(path)} className="rounded-xl bg-maia-bg px-3.5 py-3 text-left transition-colors hover:bg-maia-gold-bg">
      <p className={`font-display text-xl font-extrabold leading-none ${tone === "gold" ? "text-maia-gold-deep" : tone === "success" ? "text-maia-success" : "text-maia-ink"}`}>
        {value}
      </p>
      <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">{label}</p>
    </button>
  );
}

export function LmsFeedbackSnapshotCard({
  coursesActive,
  studentsLearning,
  coursesCompleted,
  feedbackReceived,
  videoTestimonials,
  testimonialsForReview,
}: {
  coursesActive: number;
  studentsLearning: number;
  coursesCompleted: number;
  feedbackReceived: number;
  videoTestimonials: number;
  testimonialsForReview: number;
}) {
  return (
    <Card>
      <CardHeader title="Courses & Feedback" subtitle="Compact snapshot — see Courses / Feedback modules for full detail." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Tile label="Courses Active" value={coursesActive} path="/courses/library" />
        <Tile label="Students Learning" value={studentsLearning} path="/courses/progress" tone="gold" />
        <Tile label="Courses Completed" value={coursesCompleted} path="/courses/progress" tone="success" />
        <Tile label="Feedback Received" value={feedbackReceived} path="/feedback/all" />
        <Tile label="Video Testimonials" value={videoTestimonials} path="/feedback/all?type=Video" />
        <Tile label="Testimonials For Review" value={testimonialsForReview} path="/feedback/all?status=Submitted" tone={testimonialsForReview > 0 ? "gold" : undefined} />
      </div>
    </Card>
  );
}
