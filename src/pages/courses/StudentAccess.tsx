import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { SelectField } from "@/components/common/SelectField";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { SearchInput } from "@/components/common/SearchInput";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useLmsStore } from "@/data/lmsStore";
import { useStudentStore } from "@/data/studentStore";
import { COURSE_ACCESS_SOURCES } from "@/types/lms";
import type { CourseAccessGrant, CourseAccessSource } from "@/types/lms";

const PACKAGE_TYPES = ["Premium", "VIP", "Dual VIP"] as const;

export function StudentAccess() {
  const [searchParams] = useSearchParams();
  const highlightCourseId = searchParams.get("course");
  const { courses, packageAccessMatrix, setPackageAccessMatrix, accessGrants, grantCourseAccess, revokeCourseAccess, extendCourseAccess } =
    useLmsStore();
  const { students } = useStudentStore();

  const publishedCourses = courses.filter((c) => c.status !== "Archived");

  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState(highlightCourseId ?? "");
  const [source, setSource] = useState<CourseAccessSource>("Manual");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<CourseAccessGrant | null>(null);
  const [extendTarget, setExtendTarget] = useState<CourseAccessGrant | null>(null);
  const [extendDate, setExtendDate] = useState("");

  function toggleMatrixCell(pkg: (typeof PACKAGE_TYPES)[number], courseId: string) {
    const current = packageAccessMatrix[pkg] ?? [];
    const next = current.includes(courseId) ? current.filter((id) => id !== courseId) : [...current, courseId];
    setPackageAccessMatrix({ ...packageAccessMatrix, [pkg]: next });
  }

  function openGrantModal() {
    setStudentSearch("");
    setSelectedStudentId("");
    setSelectedCourseId(highlightCourseId ?? "");
    setSource("Manual");
    setExpiresAt("");
    setNotes("");
    setGrantModalOpen(true);
  }

  function confirmGrant() {
    if (!selectedStudentId || !selectedCourseId) return;
    grantCourseAccess(selectedStudentId, selectedCourseId, source, { expiresAt: expiresAt || null, notes });
    setGrantModalOpen(false);
  }

  const matchingStudents = studentSearch.trim()
    ? students.filter(
        (s) => s.fullName.toLowerCase().includes(studentSearch.toLowerCase()) || s.studentId.toLowerCase().includes(studentSearch.toLowerCase()),
      )
    : students;

  const grantRows = accessGrants
    .map((grant) => ({ grant, student: students.find((s) => s.id === grant.studentId), course: courses.find((c) => c.id === grant.courseId) }))
    .filter((r) => r.student && r.course)
    .sort((a, b) => b.grant.grantedAt.localeCompare(a.grant.grantedAt));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-maia-ink">Student Access</h2>
          <p className="text-sm text-maia-ink-soft">Package matrix + individual course access grants.</p>
        </div>
        <Button onClick={openGrantModal}>
          <Plus size={14} />
          GRANT ACCESS
        </Button>
      </div>

      <Card padded={false}>
        <div className="p-5 sm:p-6">
          <CardHeader
            title="Package Access Matrix"
            subtitle="Sample mapping only — fully editable. Individual grants below can layer on top of this."
          />
        </div>
        <div className="overflow-x-auto border-t border-maia-border">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Course</th>
                {PACKAGE_TYPES.map((pkg) => (
                  <th key={pkg} className="px-4 py-3 text-center">{pkg}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {publishedCourses.map((course) => (
                <tr
                  key={course.id}
                  className={`border-b border-maia-border/60 last:border-0 ${course.id === highlightCourseId ? "bg-maia-gold-bg/40" : ""}`}
                >
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-maia-ink">
                    {course.title}
                    {course.accessType !== "Package" && (
                      <span className="ml-2 text-[10px] font-semibold uppercase text-maia-ink-soft">({course.accessType})</span>
                    )}
                  </td>
                  {PACKAGE_TYPES.map((pkg) => (
                    <td key={pkg} className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={(packageAccessMatrix[pkg] ?? []).includes(course.id)}
                        onChange={() => toggleMatrixCell(pkg, course.id)}
                        className="h-4 w-4 rounded border-maia-border accent-maia-gold-deep"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padded={false}>
        <div className="p-5 sm:p-6">
          <CardHeader title="Individual Access Grants" subtitle="Manual, Bonus, Promotion, Admin Override, or Future Purchase access." />
        </div>
        <div className="overflow-x-auto border-t border-maia-border">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Granted</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {grantRows.map(({ grant, student, course }) => (
                <tr key={grant.id} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink">{student!.fullName} <span className="text-xs text-maia-ink-soft">({student!.studentId})</span></td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{course!.title}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{grant.source}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{new Date(grant.grantedAt).toLocaleDateString("en-PH")}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-maia-ink-soft">{grant.expiresAt ? new Date(grant.expiresAt).toLocaleDateString("en-PH") : "No expiry"}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge tone={grant.status === "Active" ? "success" : grant.status === "Expired" ? "warning" : "danger"}>{grant.status}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex gap-1.5">
                      {grant.status === "Active" && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setExtendTarget(grant);
                              setExtendDate(grant.expiresAt ? grant.expiresAt.slice(0, 10) : "");
                            }}
                          >
                            EXTEND
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setRevokeTarget(grant)}>
                            REMOVE
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {grantRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-maia-ink-soft">
                    No individual access grants yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={grantModalOpen}
        onClose={() => setGrantModalOpen(false)}
        title="Grant Course Access"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setGrantModalOpen(false)}>
              CANCEL
            </Button>
            <Button onClick={confirmGrant} disabled={!selectedStudentId || !selectedCourseId}>
              GRANT ACCESS
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-maia-ink">Student</label>
            <SearchInput value={studentSearch} onChange={setStudentSearch} placeholder="Search name or Student ID..." />
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-maia-border">
              {matchingStudents.slice(0, 20).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStudentId(s.id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-maia-bg ${
                    selectedStudentId === s.id ? "bg-maia-gold-bg font-semibold text-maia-gold-deep" : "text-maia-ink"
                  }`}
                >
                  <span>{s.fullName}</span>
                  <span className="text-xs text-maia-ink-soft">{s.studentId}</span>
                </button>
              ))}
              {matchingStudents.length === 0 && <p className="px-3 py-3 text-xs text-maia-ink-soft">No students found.</p>}
            </div>
          </div>
          <SelectField
            label="Course"
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            placeholder="Select a course"
            options={publishedCourses.map((c) => ({ value: c.id, label: c.title }))}
          />
          <SelectField
            label="Access Source"
            value={source}
            onChange={(e) => setSource(e.target.value as CourseAccessSource)}
            options={COURSE_ACCESS_SOURCES.map((s) => ({ value: s, label: s }))}
          />
          <TextField label="Expiration (optional)" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          <TextAreaField label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
