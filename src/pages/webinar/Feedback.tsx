import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { FilterSelect } from "@/components/common/FilterSelect";
import { useFeedbackStore } from "@/data/feedbackStore";
import { useWebinarStore } from "@/data/webinarStore";
import { matchesDateFilter } from "@/utils/finance";
import { DatePresetSelect, DEFAULT_DATE_FILTER } from "@/components/finance/DatePresetSelect";
import type { DateFilterValue } from "@/utils/finance";

/**
 * Feedback submitted by Free Webinar Leads — filtered from the SAME Global
 * Feedback System used across the rest of the Academy (spec section 29/30).
 * This is a view, not a second database: every row here also appears in
 * /feedback/all, and "VIEW" opens the exact same detail page.
 */
export function Feedback() {
  const { submissions, consents, redemptions } = useFeedbackStore();
  const { leads, sessions } = useWebinarStore();
  const navigate = useNavigate();

  const [dateFilter, setDateFilter] = useState<DateFilterValue>(DEFAULT_DATE_FILTER);
  const [sessionFilter, setSessionFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("All");
  const [consentFilter, setConsentFilter] = useState("All");
  const [ratingFilter, setRatingFilter] = useState("All");
  const [reviewedFilter, setReviewedFilter] = useState("All");
  const [approvedFilter, setApprovedFilter] = useState("All");

  const rows = submissions
    .filter((s) => !s.isDraft && s.sourceType === "Free Webinar")
    .map((s) => {
      const lead = s.leadId ? leads.find((l) => l.id === s.leadId) : undefined;
      const session = (s.sourceId ? sessions.find((sess) => sess.id === s.sourceId) : undefined) ?? sessions.find((sess) => sess.title === s.sourceLabel);
      return {
        submission: s,
        lead,
        session,
        consent: consents.find((c) => c.feedbackId === s.feedbackId),
        redemption: redemptions.find((r) => r.feedbackSubmissionId === s.id),
      };
    })
    .filter((r) => sessionFilter === "all" || r.session?.id === sessionFilter)
    .filter((r) => matchesDateFilter(r.submission.submittedAt, dateFilter))
    .filter((r) => typeFilter === "All" || (typeFilter === "Written" ? r.submission.writtenFeedback.trim().length > 0 : Boolean(r.submission.videoAsset)))
    .filter((r) => consentFilter === "All" || (consentFilter === "Granted" ? r.consent?.status === "Granted" : r.consent?.status !== "Granted"))
    .filter((r) => ratingFilter === "All" || String(r.submission.rating ?? "") === ratingFilter)
    .filter((r) => reviewedFilter === "All" || (reviewedFilter === "Reviewed" ? r.submission.status !== "Submitted" : r.submission.status === "Submitted"))
    .filter((r) => approvedFilter === "All" || (approvedFilter === "Approved" ? r.submission.status === "Approved for Marketing" || r.submission.status === "Featured" : r.submission.status !== "Approved for Marketing" && r.submission.status !== "Featured"))
    .sort((a, b) => b.submission.submittedAt.localeCompare(a.submission.submittedAt));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">Free Webinar Feedback</h2>
        <p className="text-sm text-maia-ink-soft">
          {rows.length} submission(s) from webinar Leads — same Global Feedback System as the rest of the Academy.
        </p>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <DatePresetSelect value={dateFilter} onChange={setDateFilter} />
        <FilterSelect
          value={sessionFilter}
          onChange={setSessionFilter}
          options={[{ value: "all", label: "All Sessions" }, ...sessions.map((s) => ({ value: s.id, label: s.title }))]}
        />
        <FilterSelect value={typeFilter} onChange={setTypeFilter} options={[{ value: "All", label: "Written + Video" }, { value: "Written", label: "Written" }, { value: "Video", label: "Video" }]} />
        <FilterSelect value={consentFilter} onChange={setConsentFilter} options={[{ value: "All", label: "Any Consent" }, { value: "Granted", label: "Marketing Consent Granted" }, { value: "None", label: "No Marketing Consent" }]} />
        <FilterSelect
          value={ratingFilter}
          onChange={setRatingFilter}
          options={[{ value: "All", label: "Any Rating" }, { value: "5", label: "5 Stars" }, { value: "4", label: "4 Stars" }, { value: "3", label: "3 Stars" }, { value: "2", label: "2 Stars" }, { value: "1", label: "1 Star" }]}
        />
        <FilterSelect value={reviewedFilter} onChange={setReviewedFilter} options={[{ value: "All", label: "Any Review Status" }, { value: "Reviewed", label: "Reviewed" }, { value: "Not Reviewed", label: "Not Reviewed" }]} />
        <FilterSelect value={approvedFilter} onChange={setApprovedFilter} options={[{ value: "All", label: "Any Marketing Status" }, { value: "Approved", label: "Marketing Approved" }, { value: "Not Approved", label: "Not Approved" }]} />
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Feedback ID</th>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Session</th>
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
              {rows.map(({ submission, lead, session, consent, redemption }) => (
                <tr key={submission.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-maia-ink-soft">{submission.feedbackId}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">
                    {lead ? (
                      <button className="hover:underline" onClick={() => navigate(`/webinar/leads/${lead.id}`)}>
                        {lead.fullName}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{session?.title ?? submission.sourceLabel}</td>
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
                  <td colSpan={10} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No webinar feedback matches this filter.
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
