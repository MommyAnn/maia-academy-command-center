import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Award } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { ProgressBar } from "@/components/common/ProgressBar";
import { Modal } from "@/components/common/Modal";
import { SelectField } from "@/components/common/SelectField";
import { TextField } from "@/components/common/TextField";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useLmsStore } from "@/data/lmsStore";
import { useFinanceStore } from "@/data/financeStore";
import { getStudentFinanceSummary } from "@/utils/finance";
import { computeCourseProgress, resolveCourseAccess } from "@/utils/lms";
import { COURSE_ACCESS_SOURCES } from "@/types/lms";
import type { Course, CourseAccessGrant, CourseAccessSource } from "@/types/lms";
import type { StudentRecord } from "@/types/student";

export function LearningTab({ student }: { student: StudentRecord }) {
  const navigate = useNavigate();
  const { courses, lessons, packageAccessMatrix, accessGrants, lessonProgress, automationSettings, grantCourseAccess, revokeCourseAccess, extendCourseAccess } =
    useLmsStore();
  const { transactions, adjustments } = useFinanceStore();

  const [grantTarget, setGrantTarget] = useState<Course | null>(null);
  const [grantSource, setGrantSource] = useState<CourseAccessSource>("Manual");
  const [grantExpires, setGrantExpires] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<CourseAccessGrant | null>(null);
  const [extendTarget, setExtendTarget] = useState<CourseAccessGrant | null>(null);
  const [extendDate, setExtendDate] = useState("");

  const finance = getStudentFinanceSummary(student, transactions, adjustments);
  const isFullyPaidAndConfirmed = finance.status === "Fully Paid" && student.enrollmentStatus === "Confirmed Student";

  const publishedCourses = courses.filter((c) => c.status === "Published");
  const rows = publishedCourses.map((course) => ({
    course,
    access: resolveCourseAccess(course, student, packageAccessMatrix, accessGrants, lessons, lessonProgress, automationSettings, isFullyPaidAndConfirmed),
    progress: computeCourseProgress(student.id, course.id, lessons, lessonProgress),
  }));

  const available = rows.filter((r) => r.access.status !== "Locked" && r.access.status !== "Revoked" && r.access.status !== "Expired");
  const started = available.filter((r) => r.progress.status !== "Not Started");
  const completed = available.filter((r) => r.progress.status === "Completed");

  const overallProgress =
    available.length > 0 ? Math.round(available.reduce((sum, r) => sum + r.progress.percent, 0) / available.length) : 0;

  const lastActivity = available
    .map((r) => r.progress.lastAccessedAt)
    .filter((d): d is string => Boolean(d))
    .sort()
    .reverse()[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">Courses Available</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-maia-ink">{available.length}</p>
        </Card>
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">Started</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-maia-ink">{started.length}</p>
        </Card>
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">Completed</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-maia-success">{completed.length}</p>
        </Card>
        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-maia-ink-soft">Overall Progress</p>
          <p className="mt-1 font-display text-2xl font-extrabold text-maia-gold-deep">{overallProgress}%</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Learning Activity"
          subtitle={lastActivity ? `Last active ${new Date(lastActivity).toLocaleString("en-PH")}` : "No learning activity yet."}
        />
      </Card>

      <Card padded={false}>
        <div className="p-5 sm:p-6">
          <CardHeader title="Course History" subtitle="Every course this student has access to." action={
            <button onClick={() => navigate("/courses/library")} className="text-xs font-semibold text-maia-gold-deep hover:underline">
              MANAGE COURSES
            </button>
          } />
        </div>
        <div className="overflow-x-auto border-t border-maia-border">
          <table className="w-full min-w-[800px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Access</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Accessed</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Access Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ course, access, progress }) => (
                <tr key={course.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">
                    <div className="flex items-center gap-1.5">
                      {course.title}
                      {access.status === "Completed" && course.certificateEligible && (
                        <Award size={13} className="text-maia-gold-deep" />
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{access.status === "Locked" ? "—" : access.grant?.source ?? "Package"}</td>
                  <td className="px-4 py-3">
                    <div className="w-32">
                      <ProgressBar percent={progress.percent} />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge
                      tone={
                        access.status === "Completed"
                          ? "success"
                          : access.status === "In Progress"
                            ? "gold"
                            : access.status === "Locked"
                              ? "neutral"
                              : "warning"
                      }
                    >
                      {access.status}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">
                    {progress.lastAccessedAt ? new Date(progress.lastAccessedAt).toLocaleDateString("en-PH") : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">
                    {progress.completedAt ? new Date(progress.completedAt).toLocaleDateString("en-PH") : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {access.status === "Locked" || access.status === "Expired" || access.status === "Revoked" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setGrantTarget(course);
                          setGrantSource("Manual");
                          setGrantExpires("");
                        }}
                      >
                        GRANT
                      </Button>
                    ) : access.grant ? (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setExtendTarget(access.grant);
                            setExtendDate(access.grant!.expiresAt ? access.grant!.expiresAt.slice(0, 10) : "");
                          }}
                        >
                          EXTEND
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setRevokeTarget(access.grant)}>
                          REMOVE
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-maia-ink-soft">Via package</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No published courses yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={grantTarget !== null}
        onClose={() => setGrantTarget(null)}
        title="Grant Course Access"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setGrantTarget(null)}>
              CANCEL
            </Button>
            <Button
              onClick={() => {
                if (grantTarget) grantCourseAccess(student.id, grantTarget.id, grantSource, { expiresAt: grantExpires || null });
                setGrantTarget(null);
              }}
            >
              GRANT ACCESS
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-maia-ink-soft">Granting access to <span className="font-semibold text-maia-ink">{grantTarget?.title}</span> for {student.fullName}.</p>
          <SelectField
            label="Access Source"
            value={grantSource}
            onChange={(e) => setGrantSource(e.target.value as CourseAccessSource)}
            options={COURSE_ACCESS_SOURCES.map((s) => ({ value: s, label: s }))}
          />
          <TextField label="Expiration (optional)" type="date" value={grantExpires} onChange={(e) => setGrantExpires(e.target.value)} />
        </div>
      </Modal>

      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => {
          if (revokeTarget) revokeCourseAccess(revokeTarget.id);
          setRevokeTarget(null);
        }}
        title="Remove Course Access"
        description="Remove this student's access to the course? This is logged in their Activity History."
        confirmLabel="REMOVE"
        tone="danger"
      />

      <Modal
        open={extendTarget !== null}
        onClose={() => setExtendTarget(null)}
        title="Extend Access"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setExtendTarget(null)}>
              CANCEL
            </Button>
            <Button
              onClick={() => {
                if (extendTarget && extendDate) extendCourseAccess(extendTarget.id, new Date(extendDate).toISOString());
                setExtendTarget(null);
              }}
              disabled={!extendDate}
            >
              EXTEND
            </Button>
          </div>
        }
      >
        <TextField label="New Expiration Date" type="date" value={extendDate} onChange={(e) => setExtendDate(e.target.value)} />
      </Modal>
    </div>
  );
}
