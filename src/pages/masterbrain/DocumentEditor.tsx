import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Plus, Save } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { TextField } from "@/components/common/TextField";
import { TextAreaField } from "@/components/common/TextAreaField";
import { useMasterBrainStore } from "@/data/masterBrainStore";
import { useStudentStore } from "@/data/studentStore";
import { MASTER_BRAIN_STATUS_TONE } from "@/components/students/statusMeta";
import { REVIEW_CHECKLIST_ITEMS } from "@/types/masterBrain";

export function DocumentEditor() {
  const { submissionId, documentId } = useParams<{ submissionId: string; documentId: string }>();
  const {
    submissions,
    documents,
    editDocumentSection,
    approveDocumentSection,
    addCustomSection,
    beginFinalReview,
    approveFinal,
    publish,
  } = useMasterBrainStore();
  const { getStudentById } = useStudentStore();
  const navigate = useNavigate();

  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const submission = submissions.find((s) => s.id === submissionId);
  const document = documents.find((d) => d.id === documentId);
  const student = submission ? getStudentById(submission.studentId) : undefined;

  if (!submission || !document || !student) {
    return <Navigate to="/master-brain/submissions" replace />;
  }

  const isPublished = submission.status === "Published";
  const isFinalReview = submission.status === "Final Review";
  const isCompleted = submission.status === "Completed";
  const approvedCount = document.sections.filter((s) => s.approved).length;
  const allChecklistDone = REVIEW_CHECKLIST_ITEMS.every((item) => checklist[item]);

  return (
    <div className="flex flex-col gap-4 pb-4">
      <button
        onClick={() => navigate(`/master-brain/submissions/${submission.id}`)}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-maia-ink-soft hover:text-maia-ink"
      >
        <ArrowLeft size={16} />
        Back to Submission
      </button>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-xl font-extrabold text-maia-ink">
              {submission.businessFoundation.businessName || "Untitled Business"} — Master Brain Editor
            </h1>
            <p className="mt-1 text-sm text-maia-ink-soft">
              {student.fullName} ({student.studentId}) &middot; Document v{document.documentVersion} &middot; {approvedCount}/{document.sections.length}{" "}
              sections approved
            </p>
          </div>
          <Badge tone={MASTER_BRAIN_STATUS_TONE[submission.status]}>{submission.status}</Badge>
        </div>

        {submission.status === "Draft Ready" && (
          <Button className="mt-4" onClick={() => beginFinalReview(submission.id)}>
            SEND TO FINAL REVIEW
          </Button>
        )}
      </Card>

      {isFinalReview && (
        <Card className="border-maia-gold/40 bg-maia-gold-bg/30">
          <CardHeader title="Final Review Checklist" subtitle="Confirm every area before approving the final Brand Master Brain." />
          <div className="flex flex-col gap-2">
            {REVIEW_CHECKLIST_ITEMS.map((item) => (
              <label key={item} className="flex items-center gap-2.5 text-sm text-maia-ink">
                <input
                  type="checkbox"
                  checked={Boolean(checklist[item])}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, [item]: e.target.checked }))}
                  className="h-4 w-4 rounded border-maia-border accent-maia-gold-deep"
                />
                {item}
              </label>
            ))}
          </div>
          <Button className="mt-4" onClick={() => approveFinal(submission.id)} disabled={!allChecklistDone}>
            <CheckCircle2 size={15} />
            APPROVE MASTER BRAIN
          </Button>
        </Card>
      )}

      {isCompleted && (
        <Card className="border-maia-success/40 bg-maia-success-bg/40">
          <p className="mb-3 text-sm text-maia-ink">This Brand Master Brain is approved and ready to publish to the student.</p>
          <Button onClick={() => publish(submission.id, document.id)}>PUBLISH TO STUDENT</Button>
        </Card>
      )}

      {isPublished && (
        <Card className="border-maia-success/40 bg-maia-success-bg/40">
          <p className="text-sm text-maia-ink">
            This Brand Master Brain is published and live in the student&rsquo;s portal. Sections below are read-only.
          </p>
        </Card>
      )}

      {!isPublished && (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => setAddSectionOpen(true)}>
            <Plus size={14} />
            ADD SECTION
          </Button>
        </div>
      )}

      {document.sections.map((section) => (
        <SectionEditor
          key={section.key}
          documentId={document.id}
          sectionKey={section.key}
          title={section.title}
          content={section.content}
          bullets={section.bullets}
          approved={section.approved}
          lastEditedBy={section.lastEditedBy}
          readOnly={isPublished}
          onSave={editDocumentSection}
          onApprove={approveDocumentSection}
        />
      ))}

      <Modal
        open={addSectionOpen}
        onClose={() => setAddSectionOpen(false)}
        title="Add Section"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddSectionOpen(false)}>
              CANCEL
            </Button>
            <Button
              onClick={() => {
                addCustomSection(document.id, newSectionTitle);
                setNewSectionTitle("");
                setAddSectionOpen(false);
              }}
              disabled={!newSectionTitle.trim()}
            >
              ADD
            </Button>
          </div>
        }
      >
        <TextField label="Section Title" value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)} />
      </Modal>
    </div>
  );
}

function SectionEditor({
  documentId,
  sectionKey,
  title,
  content,
  bullets,
  approved,
  lastEditedBy,
  readOnly,
  onSave,
  onApprove,
}: {
  documentId: string;
  sectionKey: string;
  title: string;
  content: string;
  bullets: string[];
  approved: boolean;
  lastEditedBy: string | null;
  readOnly: boolean;
  onSave: (documentId: string, sectionKey: string, patch: { content?: string; bullets?: string[] }) => void;
  onApprove: (documentId: string, sectionKey: string) => void;
}) {
  const [localContent, setLocalContent] = useState(content);
  const [localBullets, setLocalBullets] = useState(bullets.join("\n"));
  const dirty = localContent !== content || localBullets !== bullets.join("\n");

  function handleSave() {
    onSave(documentId, sectionKey, {
      content: localContent,
      bullets: localBullets.split("\n").map((b) => b.trim()).filter(Boolean),
    });
  }

  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={lastEditedBy ? `Last edited by ${lastEditedBy}` : undefined}
        action={<Badge tone={approved ? "success" : "neutral"}>{approved ? "Approved" : "Not Approved"}</Badge>}
      />
      <div className="flex flex-col gap-4">
        <TextAreaField
          label="Content"
          value={localContent}
          onChange={(e) => setLocalContent(e.target.value)}
          rows={3}
          disabled={readOnly}
        />
        <TextAreaField
          label="Bullet Points"
          value={localBullets}
          onChange={(e) => setLocalBullets(e.target.value)}
          rows={3}
          hint="One point per line."
          disabled={readOnly}
        />
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={handleSave} disabled={!dirty}>
              <Save size={13} />
              SAVE
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (dirty) handleSave();
                onApprove(documentId, sectionKey);
              }}
            >
              <CheckCircle2 size={13} />
              APPROVE SECTION
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
