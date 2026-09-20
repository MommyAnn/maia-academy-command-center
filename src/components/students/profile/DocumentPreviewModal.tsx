import { FileWarning, FileText, ImageIcon } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { formatDateTime } from "@/utils/students";
import type { UploadedFileMeta } from "@/types/student";

export function DocumentPreviewModal({
  open,
  onClose,
  title,
  file,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  file: UploadedFileMeta | null;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {file ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-maia-gold-bg text-maia-gold-deep">
            {file.fileType === "application/pdf" ? <FileText size={28} /> : <ImageIcon size={28} />}
          </div>
          <div>
            <p className="font-semibold text-maia-ink">{file.fileName}</p>
            <p className="mt-1 text-xs text-maia-ink-soft">
              {file.fileSizeLabel} &middot; Uploaded {formatDateTime(file.uploadedAt)}
            </p>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-maia-warning-bg px-3.5 py-3 text-left text-xs text-maia-warning">
            <FileWarning size={16} className="mt-0.5 flex-shrink-0" />
            <p>
              Demo mode: only file metadata is stored right now. No secure document storage backend is
              connected yet, so the actual file cannot be previewed here.
            </p>
          </div>
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-maia-ink-soft">No file has been submitted for this requirement.</p>
      )}
    </Modal>
  );
}
