import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "danger" | "default";
  /** When set, shows a required reason textarea (e.g. rejecting/voiding). */
  requireReason?: boolean;
  reasonLabel?: string;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  tone = "default",
  requireReason = false,
  reasonLabel = "Reason",
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");

  function handleConfirm() {
    if (requireReason && !reason.trim()) return;
    onConfirm(requireReason ? reason.trim() : undefined);
    setReason("");
  }

  function handleClose() {
    setReason("");
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>
            CANCEL
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={requireReason && !reason.trim()}
            className={tone === "danger" ? "!bg-maia-danger !border-maia-danger !text-white hover:!bg-maia-danger/90" : undefined}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex gap-3">
        {tone === "danger" && (
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-maia-danger-bg text-maia-danger">
            <AlertTriangle size={18} />
          </div>
        )}
        <p className="text-sm text-maia-ink-soft">{description}</p>
      </div>

      {requireReason && (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder={`${reasonLabel}...`}
          className="mt-4 w-full resize-none rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-sm text-maia-ink outline-none focus:border-maia-gold focus:ring-2 focus:ring-maia-gold/20"
        />
      )}
    </Modal>
  );
}
