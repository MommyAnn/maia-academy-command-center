import { useNavigate } from "react-router-dom";
import { Award, MessageSquareHeart, Star, Video } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { useFeedbackStore } from "@/data/feedbackStore";
import { hasExistingFeedbackRequest } from "@/utils/feedback";

export function Feedback() {
  const { student } = useStudentPortal();
  const { requests, submissions, incentives } = useFeedbackStore();
  const navigate = useNavigate();

  const now = new Date();
  const openRequests = requests.filter((r) => {
    if (r.status !== "Open") return false;
    if (r.closeDate && new Date(r.closeDate) < now) return false;
    const targetsStudent = r.audience === "All Eligible Students" || r.audienceStudentId === student.id;
    if (!targetsStudent) return false;
    return !hasExistingFeedbackRequest(student.id, r.sourceType, r.sourceId, [], submissions);
  });

  const myHistory = submissions
    .filter((s) => s.studentId === student.id && !s.isDraft)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-maia-gold/30 bg-gradient-to-br from-maia-gold-bg/70 to-maia-surface">
        <div className="flex items-center gap-3">
          <MessageSquareHeart size={22} className="flex-shrink-0 text-maia-gold-deep" />
          <div>
            <p className="font-display text-base font-bold text-maia-ink">Share Your Experience</p>
            <p className="text-sm text-maia-ink-soft">Your honest feedback — positive or constructive — helps us improve. It's always private unless you separately choose to allow marketing use.</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Open Feedback Requests" />
        {openRequests.length === 0 ? (
          <p className="rounded-xl bg-maia-bg px-4 py-6 text-center text-sm text-maia-ink-soft">Nothing to share right now — check back after your next course, training, or masterclass.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {openRequests.map((r) => {
              const incentive = r.incentiveId ? incentives.find((i) => i.id === r.incentiveId) : undefined;
              return (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-maia-border px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-maia-ink">{r.title}</p>
                    <p className="text-xs text-maia-ink-soft">{r.sourceType} · {r.sourceLabel}</p>
                    {incentive && (
                      <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-maia-gold-deep">
                        <Award size={12} />
                        Bonus: {incentive.name}
                      </p>
                    )}
                  </div>
                  <Button onClick={() => navigate(`/portal/feedback/${r.id}`)}>SHARE FEEDBACK</Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card padded={false}>
        <div className="p-5 sm:p-6">
          <CardHeader title="My Feedback History" />
        </div>
        <div className="overflow-x-auto border-t border-maia-border">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {myHistory.map((s) => (
                <tr key={s.id} className="border-b border-maia-border/60 last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">{s.sourceLabel}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">
                    <div className="flex items-center gap-1.5">
                      {s.writtenFeedback && "Written"}
                      {s.writtenFeedback && s.videoAsset && " + "}
                      {s.videoAsset && (
                        <span className="flex items-center gap-1">
                          <Video size={12} />
                          Video
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">
                    {s.rating ? (
                      <span className="flex items-center gap-0.5">
                        <Star size={12} className="fill-maia-gold text-maia-gold" />
                        {s.rating}/5
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{new Date(s.submittedAt).toLocaleDateString("en-PH")}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge tone="neutral">Received — thank you!</Badge>
                  </td>
                </tr>
              ))}
              {myHistory.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    You haven't submitted feedback yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
