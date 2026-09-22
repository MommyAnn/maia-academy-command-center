import { useSearchParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { FilterSelect } from "@/components/common/FilterSelect";
import { useFeedbackStore } from "@/data/feedbackStore";
import { useStudentStore } from "@/data/studentStore";
import { useWebinarStore } from "@/data/webinarStore";
import { FEEDBACK_SOURCE_TYPES } from "@/types/feedback";

const BATCHES = ["Batch 14", "Batch 13", "Batch 12"] as const;

export function AllFeedback() {
  const { submissions, consents, redemptions } = useFeedbackStore();
  const { students } = useStudentStore();
  const { leads } = useWebinarStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const sourceFilter = searchParams.get("source") ?? "All";
  const batchFilter = searchParams.get("batch") ?? "All";
  const typeFilter = searchParams.get("type") ?? "All";
  const consentFilter = searchParams.get("consent") ?? "All";
  const statusFilter = searchParams.get("status") ?? "All";

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value === "All") next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  }

  const rows = submissions
    .filter((s) => !s.isDraft)
    .map((s) => ({
      submission: s,
      student: s.studentId ? students.find((st) => st.id === s.studentId) : undefined,
      lead: s.leadId ? leads.find((l) => l.id === s.leadId) : undefined,
      consent: consents.find((c) => c.feedbackId === s.feedbackId),
      redemption: redemptions.find((r) => r.feedbackSubmissionId === s.id),
    }))
    .filter((r) => r.student || r.lead)
    .filter((r) => sourceFilter === "All" || r.submission.sourceType === sourceFilter)
    .filter((r) => batchFilter === "All" || r.submission.batch === batchFilter)
    .filter((r) => typeFilter === "All" || (typeFilter === "Written" ? r.submission.writtenFeedback.trim().length > 0 : Boolean(r.submission.videoAsset)))
    .filter((r) => consentFilter === "All" || (consentFilter === "Granted" ? r.consent?.status === "Granted" : r.consent?.status !== "Granted"))
    .filter((r) => statusFilter === "All" || r.submission.status === statusFilter)
    .sort((a, b) => b.submission.submittedAt.localeCompare(a.submission.submittedAt));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">All Feedback</h2>
        <p className="text-sm text-maia-ink-soft">{rows.length} submission(s) shown.</p>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <FilterSelect value={sourceFilter} onChange={(v) => setFilter("source", v)} options={[{ value: "All", label: "All Sources" }, ...FEEDBACK_SOURCE_TYPES.map((t) => ({ value: t, label: t }))]} />
        <FilterSelect value={batchFilter} onChange={(v) => setFilter("batch", v)} options={[{ value: "All", label: "All Batches" }, ...BATCHES.map((b) => ({ value: b, label: b }))]} />
        <FilterSelect value={typeFilter} onChange={(v) => setFilter("type", v)} options={[{ value: "All", label: "Written + Video" }, { value: "Written", label: "Written Only" }, { value: "Video", label: "Video Only" }]} />
        <FilterSelect value={consentFilter} onChange={(v) => setFilter("consent", v)} options={[{ value: "All", label: "Any Consent" }, { value: "Granted", label: "Consent Granted" }, { value: "None", label: "No Consent" }]} />
        <FilterSelect
          value={statusFilter}
          onChange={(v) => setFilter("status", v)}
          options={[
            { value: "All", label: "All Review Status" },
            { value: "Submitted", label: "Submitted" },
            { value: "Reviewed", label: "Reviewed" },
            { value: "Approved for Marketing", label: "Approved for Marketing" },
            { value: "Kept Private", label: "Kept Private" },
            { value: "Featured", label: "Featured" },
            { value: "Archived", label: "Archived" },
          ]}
        />
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Feedback ID</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Marketing Consent</th>
                <th className="px-4 py-3">Review Status</th>
                <th className="px-4 py-3">Incentive</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ submission, student, lead, consent, redemption }) => (
                <tr key={submission.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-maia-ink-soft">{submission.feedbackId}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">
                    {student?.fullName ?? lead?.fullName}
                    {lead && <span className="ml-1.5 text-[10px] font-semibold uppercase text-maia-gold-deep">Lead</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{submission.batch || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{submission.sourceType}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">
                    {submission.writtenFeedback.trim() ? "Written" : ""}{submission.writtenFeedback.trim() && submission.videoAsset ? " + " : ""}{submission.videoAsset ? "Video" : ""}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{submission.rating ? `${submission.rating}/5` : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{new Date(submission.submittedAt).toLocaleDateString("en-PH")}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {consent?.status === "Granted" ? <Badge tone="success">Granted</Badge> : consent?.status === "Withdrawn" ? <Badge tone="warning">Withdrawn</Badge> : <Badge tone="neutral">None</Badge>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge tone={submission.status === "Approved for Marketing" || submission.status === "Featured" ? "success" : submission.status === "Submitted" ? "gold" : "neutral"}>
                      {submission.status}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{redemption ? redemption.deliveryStatus : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Button size="sm" onClick={() => navigate(`/feedback/all/${submission.id}`)}>
                      VIEW
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No feedback matches this filter.
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
