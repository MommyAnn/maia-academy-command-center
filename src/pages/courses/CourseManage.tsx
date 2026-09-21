import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { Card } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { SelectField } from "@/components/common/SelectField";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { InfoTooltip } from "@/components/common/InfoTooltip";
import { RepeatableCardList } from "@/components/portal/masterBrainSteps/RepeatableCardList";
import { useLmsStore, type CreateLessonInput } from "@/data/lmsStore";
import { LESSON_TYPES, RESOURCE_TYPES, VIDEO_PROVIDERS } from "@/types/lms";
import type { Lesson, LessonResource, Module } from "@/types/lms";
import { getCourseStructure } from "@/utils/lms";

const VIDEO_TYPES = new Set<Lesson["type"]>(["Video Lesson", "Live Session / Replay"]);

function blankLessonForm(moduleId: string, courseId: string): CreateLessonInput {
  return {
    moduleId,
    courseId,
    title: "",
    description: "",
    type: "Video Lesson",
    videoProvider: "Vimeo",
    videoRef: "",
    textContent: "",
    duration: "",
  };
}

export function CourseManage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const {
    courses,
    modules,
    lessons,
    createModule,
    updateModule,
    reorderModules,
    archiveModule,
    createLesson,
    updateLesson,
    reorderLessons,
    setLessonStatus,
  } = useLmsStore();

  const course = courses.find((c) => c.id === courseId);

  const [moduleModal, setModuleModal] = useState<{ mode: "create" | "edit"; module?: Module } | null>(null);
  const [moduleTitle, setModuleTitle] = useState("");
  const [archiveModuleTarget, setArchiveModuleTarget] = useState<Module | null>(null);

  const [lessonModal, setLessonModal] = useState<{ mode: "create" | "edit"; moduleId: string; lesson?: Lesson } | null>(null);
  const [lessonForm, setLessonForm] = useState<CreateLessonInput>(blankLessonForm("", ""));
  const [lessonResources, setLessonResources] = useState<LessonResource[]>([]);

  if (!course) {
    return (
      <Card>
        <p className="text-sm text-maia-ink-soft">Course not found.</p>
        <Button className="mt-3" variant="secondary" onClick={() => navigate("/courses/library")}>
          BACK TO LIBRARY
        </Button>
      </Card>
    );
  }

  const courseId2 = course.id;
  const structure = getCourseStructure(courseId2, modules, lessons).map((entry) => ({
    ...entry,
    // getCourseStructure only returns Published lessons — admin manager needs Draft ones too.
    lessons: lessons.filter((l) => l.moduleId === entry.module.id).sort((a, b) => a.order - b.order),
  }));
  const allModulesOrdered = modules.filter((m) => m.courseId === courseId2 && m.status === "Active").sort((a, b) => a.order - b.order);

  function openCreateModule() {
    setModuleTitle("");
    setModuleModal({ mode: "create" });
  }
  function openEditModule(module: Module) {
    setModuleTitle(module.title);
    setModuleModal({ mode: "edit", module });
  }
  function saveModule() {
    if (!moduleTitle.trim() || !moduleModal) return;
    if (moduleModal.mode === "create") {
      createModule(courseId2, moduleTitle.trim());
    } else if (moduleModal.module) {
      updateModule(moduleModal.module.id, { title: moduleTitle.trim() });
    }
    setModuleModal(null);
  }

  function moveModule(module: Module, direction: -1 | 1) {
    const ids = allModulesOrdered.map((m) => m.id);
    const idx = ids.indexOf(module.id);
    const swapWith = idx + direction;
    if (swapWith < 0 || swapWith >= ids.length) return;
    [ids[idx], ids[swapWith]] = [ids[swapWith], ids[idx]];
    reorderModules(courseId2, ids);
  }

  function openCreateLesson(moduleId: string) {
    setLessonForm(blankLessonForm(moduleId, courseId2));
    setLessonResources([]);
    setLessonModal({ mode: "create", moduleId });
  }
  function openEditLesson(lesson: Lesson) {
    setLessonForm({
      moduleId: lesson.moduleId,
      courseId: lesson.courseId,
      title: lesson.title,
      description: lesson.description,
      type: lesson.type,
      videoProvider: lesson.videoProvider,
      videoRef: lesson.videoRef,
      textContent: lesson.textContent,
      duration: lesson.duration,
    });
    setLessonResources(lesson.resources);
    setLessonModal({ mode: "edit", moduleId: lesson.moduleId, lesson });
  }
  function saveLesson() {
    if (!lessonForm.title.trim() || !lessonModal) return;
    if (lessonModal.mode === "create") {
      const created = createLesson(lessonForm);
      updateLesson(created.id, { resources: lessonResources });
    } else if (lessonModal.lesson) {
      updateLesson(lessonModal.lesson.id, { ...lessonForm, resources: lessonResources });
    }
    setLessonModal(null);
  }

  function moveLesson(lesson: Lesson, direction: -1 | 1) {
    const siblings = lessons.filter((l) => l.moduleId === lesson.moduleId).sort((a, b) => a.order - b.order);
    const ids = siblings.map((l) => l.id);
    const idx = ids.indexOf(lesson.id);
    const swapWith = idx + direction;
    if (swapWith < 0 || swapWith >= ids.length) return;
    [ids[idx], ids[swapWith]] = [ids[swapWith], ids[idx]];
    reorderLessons(lesson.moduleId, ids);
  }

  function addResource() {
    setLessonResources((prev) => [...prev, { id: crypto.randomUUID(), type: "PDF", label: "", url: "", fileSizeLabel: "" }]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-maia-gold-bg text-2xl">{course.thumbnailLabel}</div>
          <div>
            <p className="font-mono text-[11px] font-semibold text-maia-ink-soft">{course.courseId}</p>
            <h2 className="font-display text-lg font-bold text-maia-ink">{course.title}</h2>
            <p className="text-xs text-maia-ink-soft">{course.instructor} · {course.category}</p>
          </div>
          <Badge tone={course.status === "Published" ? "success" : course.status === "Archived" ? "warning" : "neutral"}>{course.status}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate("/courses/library")}>
            BACK TO LIBRARY
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/courses/${course.id}/edit`)}>
            EDIT COURSE
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/courses/access?course=${course.id}`)}>
            MANAGE ACCESS
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {structure.map(({ module, lessons: moduleLessons }) => (
          <Card key={module.id}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => moveModule(module, -1)}
                    className="text-maia-ink-soft hover:text-maia-gold-deep disabled:opacity-30"
                    disabled={allModulesOrdered[0]?.id === module.id}
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveModule(module, 1)}
                    className="text-maia-ink-soft hover:text-maia-gold-deep disabled:opacity-30"
                    disabled={allModulesOrdered[allModulesOrdered.length - 1]?.id === module.id}
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                <p className="font-display text-sm font-bold text-maia-ink">
                  Module {module.order}: {module.title}
                </p>
                <Badge tone="neutral">{moduleLessons.length} lesson(s)</Badge>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => openEditModule(module)}>
                  EDIT
                </Button>
                <Button size="sm" variant="secondary" onClick={() => openCreateLesson(module.id)}>
                  <Plus size={12} />
                  ADD LESSON
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setArchiveModuleTarget(module)}>
                  ARCHIVE
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {moduleLessons.map((lesson) => (
                <div key={lesson.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-maia-border px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => moveLesson(lesson, -1)}
                        className="text-maia-ink-soft hover:text-maia-gold-deep disabled:opacity-30"
                        disabled={moduleLessons[0]?.id === lesson.id}
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLesson(lesson, 1)}
                        className="text-maia-ink-soft hover:text-maia-gold-deep disabled:opacity-30"
                        disabled={moduleLessons[moduleLessons.length - 1]?.id === lesson.id}
                      >
                        <ChevronDown size={12} />
                      </button>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] font-semibold text-maia-ink-soft">{lesson.lessonId}</p>
                      <p className="text-sm font-semibold text-maia-ink">{lesson.title}</p>
                      <p className="text-xs text-maia-ink-soft">
                        {lesson.type} {lesson.duration && `· ${lesson.duration}`} {lesson.resources.length > 0 && `· ${lesson.resources.length} resource(s)`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge tone={lesson.status === "Published" ? "success" : "neutral"}>{lesson.status}</Badge>
                    <Button size="sm" variant="secondary" onClick={() => openEditLesson(lesson)}>
                      EDIT
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setLessonStatus(lesson.id, lesson.status === "Published" ? "Draft" : "Published")}
                    >
                      {lesson.status === "Published" ? "UNPUBLISH" : "PUBLISH"}
                    </Button>
                  </div>
                </div>
              ))}
              {moduleLessons.length === 0 && <p className="rounded-lg bg-maia-bg px-3 py-4 text-center text-xs text-maia-ink-soft">No lessons yet.</p>}
            </div>
          </Card>
        ))}

        <Button variant="secondary" onClick={openCreateModule} className="self-start">
          <Plus size={14} />
          ADD MODULE
        </Button>
      </div>

      {/* Module create/edit */}
      <Modal
        open={moduleModal !== null}
        onClose={() => setModuleModal(null)}
        title={moduleModal?.mode === "edit" ? "Edit Module" : "Add Module"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModuleModal(null)}>
              CANCEL
            </Button>
            <Button onClick={saveModule} disabled={!moduleTitle.trim()}>
              SAVE
            </Button>
          </div>
        }
      >
        <TextField label="Module Title" value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} autoFocus />
      </Modal>

      <ConfirmDialog
        open={archiveModuleTarget !== null}
        onClose={() => setArchiveModuleTarget(null)}
        onConfirm={() => {
          if (archiveModuleTarget) archiveModule(archiveModuleTarget.id);
          setArchiveModuleTarget(null);
        }}
        title="Archive Module"
        description={`Archive "${archiveModuleTarget?.title}"? Its lessons will no longer appear to students.`}
        confirmLabel="ARCHIVE"
        tone="danger"
      />

      {/* Lesson create/edit */}
      <Modal
        open={lessonModal !== null}
        onClose={() => setLessonModal(null)}
        title={lessonModal?.mode === "edit" ? "Edit Lesson" : "Add Lesson"}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setLessonModal(null)}>
              CANCEL
            </Button>
            <Button onClick={saveLesson} disabled={!lessonForm.title.trim()}>
              SAVE
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <TextField label="Title" required value={lessonForm.title} onChange={(e) => setLessonForm((f) => ({ ...f, title: e.target.value }))} />
          <TextAreaField
            label="Description"
            rows={2}
            value={lessonForm.description}
            onChange={(e) => setLessonForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              label="Lesson Type"
              value={lessonForm.type}
              onChange={(e) => setLessonForm((f) => ({ ...f, type: e.target.value as Lesson["type"] }))}
              options={LESSON_TYPES.map((t) => ({ value: t, label: t }))}
            />
            <TextField
              label="Duration"
              placeholder="e.g. 15 min"
              value={lessonForm.duration}
              onChange={(e) => setLessonForm((f) => ({ ...f, duration: e.target.value }))}
            />
          </div>

          {VIDEO_TYPES.has(lessonForm.type) && (
            <div className="rounded-xl border border-maia-border p-4">
              <div className="mb-3 flex items-center gap-1.5">
                <p className="text-xs font-bold uppercase tracking-wide text-maia-gold-deep">Video Source</p>
                <InfoTooltip text="Hiding a download button does not protect a video. This only stores a provider reference (embed id) — a real production build needs a real secure hosting/DRM integration, swappable here without touching the rest of the LMS." />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SelectField
                  label="Video Provider"
                  value={lessonForm.videoProvider}
                  onChange={(e) => setLessonForm((f) => ({ ...f, videoProvider: e.target.value as Lesson["videoProvider"] }))}
                  options={VIDEO_PROVIDERS.map((p) => ({ value: p, label: p }))}
                />
                <TextField
                  label="Video Reference (embed id)"
                  hint="Never a raw playback URL — a provider embed id only."
                  value={lessonForm.videoRef}
                  onChange={(e) => setLessonForm((f) => ({ ...f, videoRef: e.target.value }))}
                />
              </div>
            </div>
          )}

          {lessonForm.type === "Text Lesson" && (
            <TextAreaField
              label="Text Content"
              rows={5}
              value={lessonForm.textContent}
              onChange={(e) => setLessonForm((f) => ({ ...f, textContent: e.target.value }))}
            />
          )}

          <div>
            <p className="mb-2 text-sm font-semibold text-maia-ink">Resources</p>
            <RepeatableCardList
              items={lessonResources}
              onAdd={addResource}
              onRemove={(idx) => setLessonResources((prev) => prev.filter((_, i) => i !== idx))}
              onItemChange={(idx, patch) => setLessonResources((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))}
              addLabel="ADD RESOURCE"
              emptyLabel="No resources attached yet."
              itemLabel={(r, i) => r.label || `Resource ${i + 1}`}
              renderItem={(resource, update) => (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SelectField
                    label="Type"
                    value={resource.type}
                    onChange={(e) => update({ type: e.target.value as LessonResource["type"] })}
                    options={RESOURCE_TYPES.map((t) => ({ value: t, label: t }))}
                  />
                  <TextField label="Label" value={resource.label} onChange={(e) => update({ label: e.target.value })} />
                  <TextField
                    label="URL"
                    hint="Only meaningful for External Link — otherwise a placeholder filename."
                    value={resource.url}
                    onChange={(e) => update({ url: e.target.value })}
                  />
                  <TextField label="File Size" placeholder="e.g. 480 KB" value={resource.fileSizeLabel} onChange={(e) => update({ fileSizeLabel: e.target.value })} />
                </div>
              )}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
