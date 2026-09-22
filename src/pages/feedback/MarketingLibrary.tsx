import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, User, Video } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { FilterSelect } from "@/components/common/FilterSelect";
import { useFeedbackStore } from "@/data/feedbackStore";
import { useStudentStore } from "@/data/studentStore";
import { useWebinarStore } from "@/data/webinarStore";
import { useMasterBrainStore } from "@/data/masterBrainStore";
import { isEligibleForMarketingLibrary } from "@/utils/feedback";
import { FEEDBACK_SOURCE_TYPES } from "@/types/feedback";

const BATCHES = ["Batch 14", "Batch 13", "Batch 12"] as const;

export function MarketingLibrary() {
  const { submissions, consents } = useFeedbackStore();
  const { students } = useStudentStore();
  const { leads } = useWebinarStore();
  const { getSubmissionForStudent } = useMasterBrainStore();
  const navigate = useNavigate();

  const [typeFilter, setTypeFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [batchFilter, setBatchFilter] = useState("All");
  const [featuredOnly, setFeaturedOnly] = useState("All");

  const eligible = submissions
    .map((s) => ({
      submission: s,
      consent: consents.find((c) => c.feedbackId === s.feedbackId),
      student: s.studentId ? students.find((st) => st.id === s.studentId) : undefined,
      lead: s.leadId ? leads.find((l) => l.id === s.leadId) : undefined,
    }))
    .filter((r) => (r.student || r.lead) && isEligibleForMarketingLibrary(r.submission, r.consent))
    .filter((r) => typeFilter === "All" || (typeFilter === "Written" ? r.submission.writtenFeedback.trim().length > 0 : Boolean(r.submission.videoAsset)))
    .filter((r) => sourceFilter === "All" || r.submission.sourceType === sourceFilter)
    .filter((r) => batchFilter === "All" || r.submission.batch === batchFilter)
    .filter((r) => featuredOnly === "All" || r.submission.status === "Featured")
    .sort((a, b) => b.submission.submittedAt.localeCompare(a.submission.submittedAt));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">Marketing Testimonial Library</h2>
        <p className="text-sm text-maia-ink-soft">
          Curated testimonials with BOTH valid marketing consent AND admin approval. {eligible.length} shown.
        </p>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <FilterSelect value={typeFilter} onChange={setTypeFilter} options={[{ value: "All", label: "Written + Video" }, { value: "Written", label: "Written" }, { value: "Video", label: "Video" }]} />
        <FilterSelect value={sourceFilter} onChange={setSourceFilter} options={[{ value: "All", label: "All Sources" }, ...FEEDBACK_SOURCE_TYPES.map((t) => ({ value: t, label: t }))]} />
        <FilterSelect value={batchFilter} onChange={setBatchFilter} options={[{ value: "All", label: "All Batches" }, ...BATCHES.map((b) => ({ value: b, label: b }))]} />
        <FilterSelect value={featuredOnly} onChange={setFeaturedOnly} options={[{ value: "All", label: "All" }, { value: "Featured", label: "Featured Only" }]} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {eligible.map(({ submission, consent, student, lead }) => {
          const assets = consent!.permittedAssets;
          const personName = student?.fullName ?? lead?.fullName ?? "";
          const showFirstName = assets.includes("First Name") || assets.includes("Full Name");
          const displayName = assets.includes("Full Name") ? personName : assets.includes("First Name") ? personName.split(" ")[0] : "Anonymous Student";
          const businessName = assets.includes("Business Name") ? (student ? getSubmissionForStudent(student.id)?.businessFoundation.businessName : lead?.businessName) : "";
          const showPhoto = assets.includes("Profile Photo");
          const showWritten = assets.includes("Written Feedback") && submission.writtenFeedback.trim();
          const showVideo = assets.includes("Video Feedback") && submission.videoAsset;

          return (
            <Card key={submission.id} className="flex cursor-pointer flex-col gap-3" onClick={() => navigate(`/feedback/all/${submission.id}`)}>
              <div className="flex items-center gap-3">
                {showPhoto ? (
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-maia-gold-bg text-maia-gold-deep">
                    <User size={18} />
                  </div>
                ) : (
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-maia-bg text-maia-ink-soft">
                    <User size={16} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-maia-ink">{showFirstName ? displayName : "Anonymous Student"}</p>
                  {businessName && <p className="text-xs text-maia-ink-soft">{businessName}</p>}
                </div>
                {submission.status === "Featured" && <Badge tone="gold" >Featured</Badge>}
              </div>

              {submission.rating !== null && (
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={13} className={i < submission.rating! ? "fill-maia-gold text-maia-gold" : "text-maia-border"} />
                  ))}
                </div>
              )}

              {showWritten && <p className="line-clamp-4 text-sm text-maia-ink-soft">&ldquo;{submission.writtenFeedback}&rdquo;</p>}
              {showVideo && (
                <div className="flex items-center gap-2 rounded-lg bg-maia-bg px-3 py-2 text-xs font-semibold text-maia-gold-deep">
                  <Video size={14} />
                  Video Testimonial
                </div>
              )}

              <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-maia-border pt-3 text-xs text-maia-ink-soft">
                <Badge tone="neutral">{submission.sourceType}</Badge>
                <span>{submission.sourceLabel}</span>
                {submission.batch && <span>· {submission.batch}</span>}
                <span>· {new Date(submission.submittedAt).toLocaleDateString("en-PH")}</span>
              </div>

              {submission.marketingTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {submission.marketingTags.map((t) => (
                    <span key={t} className="rounded-full bg-maia-gold-bg px-2 py-0.5 text-[10px] font-semibold text-maia-gold-deep">{t}</span>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
        {eligible.length === 0 && (
          <Card className="sm:col-span-2 xl:col-span-3">
            <p className="py-8 text-center text-sm text-maia-ink-soft">No approved testimonials match this filter.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
