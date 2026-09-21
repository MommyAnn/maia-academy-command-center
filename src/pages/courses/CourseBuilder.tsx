import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardHeader } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { SelectField } from "@/components/common/SelectField";
import { Modal } from "@/components/common/Modal";
import { useLmsStore } from "@/data/lmsStore";
import { COURSE_ACCESS_TYPES, COURSE_CATEGORIES } from "@/types/lms";
import type { Course, CourseCategory } from "@/types/lms";

const DIFFICULTIES = ["", "Beginner", "Intermediate", "Advanced"] as const;

interface FormState {
  title: string;
  shortDescription: string;
  fullDescription: string;
  category: CourseCategory;
  instructor: string;
  thumbnailLabel: string;
  estimatedDuration: string;
  difficulty: Course["difficulty"];
  introduction: string;
  learningOutcomes: string;
  whoThisIsFor: string;
  requirements: string;
  accessType: Course["accessType"];
  certificateEligible: boolean;
}

function blankForm(): FormState {
  return {
    title: "",
    shortDescription: "",
    fullDescription: "",
    category: "Other",
    instructor: "",
    thumbnailLabel: "📘",
    estimatedDuration: "",
    difficulty: "",
    introduction: "",
    learningOutcomes: "",
    whoThisIsFor: "",
    requirements: "",
    accessType: "Package",
    certificateEligible: false,
  };
}

export function CourseBuilder() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { courses, createCourse, updateCourse, setCourseStatus } = useLmsStore();
  const existing = courseId ? courses.find((c) => c.id === courseId) : undefined;
  const isEdit = Boolean(existing);

  const [form, setForm] = useState<FormState>(() =>
    existing
      ? {
          title: existing.title,
          shortDescription: existing.shortDescription,
          fullDescription: existing.fullDescription,
          category: existing.category,
          instructor: existing.instructor,
          thumbnailLabel: existing.thumbnailLabel,
          estimatedDuration: existing.estimatedDuration,
          difficulty: existing.difficulty,
          introduction: existing.introduction,
          learningOutcomes: existing.learningOutcomes,
          whoThisIsFor: existing.whoThisIsFor,
          requirements: existing.requirements,
          accessType: existing.accessType,
          certificateEligible: existing.certificateEligible,
        }
      : blankForm(),
  );
  const [previewOpen, setPreviewOpen] = useState(false);

  function patch(p: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...p }));
  }

  function persistCurrentForm() {
    if (existing) {
      updateCourse(existing.id, form);
      return existing.id;
    }
    const created = createCourse(form);
    return created.id;
  }

  function handleSaveDraft() {
    const id = persistCurrentForm();
    if (!existing) setCourseStatus(id, "Draft");
    navigate(`/courses/${id}`);
  }

  function handlePublish() {
    const id = persistCurrentForm();
    setCourseStatus(id, "Published");
    navigate(`/courses/${id}`);
  }

  const canSave = form.title.trim().length > 0 && form.instructor.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-maia-ink">{isEdit ? "Edit Course" : "Course Builder"}</h2>
          <p className="text-sm text-maia-ink-soft">
            {isEdit ? `Editing ${existing?.courseId} — ${existing?.title}` : "Create a new course. You can add modules and lessons after saving."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setPreviewOpen(true)} disabled={!canSave}>
            PREVIEW
          </Button>
          <Button variant="secondary" onClick={handleSaveDraft} disabled={!canSave}>
            SAVE DRAFT
          </Button>
          <Button onClick={handlePublish} disabled={!canSave}>
            PUBLISH
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader title="Course Details" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Title" required value={form.title} onChange={(e) => patch({ title: e.target.value })} />
          <TextField label="Instructor / Coach" required value={form.instructor} onChange={(e) => patch({ instructor: e.target.value })} />
          <SelectField
            label="Category"
            value={form.category}
            onChange={(e) => patch({ category: e.target.value as CourseCategory })}
            options={COURSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          <TextField
            label="Thumbnail"
            hint="No image upload pipeline yet — use a short label or emoji stand-in."
            value={form.thumbnailLabel}
            onChange={(e) => patch({ thumbnailLabel: e.target.value })}
          />
          <TextField
            label="Estimated Duration (optional)"
            placeholder="e.g. 3 hours"
            value={form.estimatedDuration}
            onChange={(e) => patch({ estimatedDuration: e.target.value })}
          />
          <SelectField
            label="Difficulty (optional)"
            value={form.difficulty}
            onChange={(e) => patch({ difficulty: e.target.value as Course["difficulty"] })}
            options={DIFFICULTIES.map((d) => ({ value: d, label: d || "Not set" }))}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4">
          <TextAreaField
            label="Short Description"
            hint="Shown on the course card."
            rows={2}
            value={form.shortDescription}
            onChange={(e) => patch({ shortDescription: e.target.value })}
          />
          <TextAreaField
            label="Full Description"
            hint="Shown on the course page."
            rows={4}
            value={form.fullDescription}
            onChange={(e) => patch({ fullDescription: e.target.value })}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Course Page Content" subtitle="Shown to students on the course page before/while they learn." />
        <div className="grid grid-cols-1 gap-4">
          <TextAreaField label="Introduction" rows={2} value={form.introduction} onChange={(e) => patch({ introduction: e.target.value })} />
          <TextAreaField
            label="Learning Outcomes"
            rows={2}
            value={form.learningOutcomes}
            onChange={(e) => patch({ learningOutcomes: e.target.value })}
          />
          <TextAreaField label="Who This Is For" rows={2} value={form.whoThisIsFor} onChange={(e) => patch({ whoThisIsFor: e.target.value })} />
          <TextAreaField label="Requirements" rows={2} value={form.requirements} onChange={(e) => patch({ requirements: e.target.value })} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Access Rules" subtitle="Fine-tune this in Student Access / individual grants after saving." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Access Type"
            value={form.accessType}
            onChange={(e) => patch({ accessType: e.target.value as Course["accessType"] })}
            options={COURSE_ACCESS_TYPES.map((t) => ({
              value: t,
              label: t === "Package" ? "Package (matrix-controlled)" : t === "Manual" ? "Manual (grants only)" : "Open (all students)",
            }))}
          />
          <label className="flex items-center gap-2.5 self-end pb-2.5 text-sm font-semibold text-maia-ink">
            <input
              type="checkbox"
              checked={form.certificateEligible}
              onChange={(e) => patch({ certificateEligible: e.target.checked })}
              className="h-4 w-4 rounded border-maia-border accent-maia-gold-deep"
            />
            Certificate Eligible
          </label>
        </div>
      </Card>

      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Course Preview" size="lg">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-maia-gold-bg text-2xl">{form.thumbnailLabel}</div>
            <div>
              <p className="font-display text-base font-bold text-maia-ink">{form.title || "Untitled Course"}</p>
              <p className="text-xs text-maia-ink-soft">{form.instructor || "No instructor set"} · {form.category}</p>
            </div>
            <div className="ml-auto flex gap-1.5">
              {form.difficulty && <Badge tone="gold">{form.difficulty}</Badge>}
              {form.certificateEligible && <Badge tone="success">Certificate Eligible</Badge>}
            </div>
          </div>
          <p className="text-sm text-maia-ink-soft">{form.shortDescription || "No short description yet."}</p>
          {form.introduction && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">Introduction</p>
              <p className="mt-1 text-sm text-maia-ink">{form.introduction}</p>
            </div>
          )}
          {form.learningOutcomes && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">Learning Outcomes</p>
              <p className="mt-1 text-sm text-maia-ink">{form.learningOutcomes}</p>
            </div>
          )}
          <p className="rounded-lg bg-maia-bg px-3 py-2 text-xs text-maia-ink-soft">
            This is a draft preview only. The real Student Course Page renders modules and lessons once they're added.
          </p>
        </div>
      </Modal>
    </div>
  );
}
