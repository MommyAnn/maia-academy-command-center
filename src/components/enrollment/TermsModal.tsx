import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { TERMS_AND_CONDITIONS_TEXT } from "@/data/enrollmentConfig";

export function TermsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="M.A.I.A. Enrollment Terms & Conditions"
      footer={
        <Button className="w-full justify-center" onClick={onClose}>
          CLOSE
        </Button>
      }
    >
      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-maia-ink-soft">
        {TERMS_AND_CONDITIONS_TEXT}
      </pre>
    </Modal>
  );
}
