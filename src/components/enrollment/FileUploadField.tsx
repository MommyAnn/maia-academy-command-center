import { useRef } from "react";
import { AlertCircle, CheckCircle2, FileText, ImageIcon, UploadCloud, X } from "lucide-react";
import {
  ACCEPTED_UPLOAD_EXTENSIONS,
  ACCEPTED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
} from "@/data/enrollmentConfig";
import { formatFileSize } from "@/utils/students";

export function validateUploadFile(file: File): string | null {
  const extensionOk = ACCEPTED_UPLOAD_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
  const mimeOk = ACCEPTED_UPLOAD_MIME_TYPES.includes(file.type) || file.type === "";
  if (!extensionOk || !mimeOk) {
    return "Please upload a JPG, PNG, or PDF file.";
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return "File is too large. Maximum size is 10 MB.";
  }
  return null;
}

export function FileUploadField({
  label,
  file,
  error,
  onSelect,
  onClear,
}: {
  label: string;
  file: File | null;
  error?: string | null;
  onSelect: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-maia-ink">{label}</label>
      <p className="mb-2 text-xs text-maia-ink-soft">Accepted formats: JPG, PNG, PDF (max 10 MB).</p>

      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-maia-border bg-maia-bg px-4 py-8 text-center transition-colors hover:border-maia-gold hover:bg-maia-gold-bg/40"
        >
          <UploadCloud size={24} className="text-maia-gold-deep" />
          <span className="text-sm font-medium text-maia-ink">Tap to upload a file</span>
          <span className="text-xs text-maia-ink-soft">or drag and drop</span>
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-maia-border bg-maia-surface px-4 py-3.5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-maia-gold-bg text-maia-gold-deep">
            {file.type === "application/pdf" ? <FileText size={18} /> : <ImageIcon size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-maia-ink">{file.name}</p>
            <p className="flex items-center gap-1 text-xs text-maia-success">
              <CheckCircle2 size={12} />
              {formatFileSize(file.size)} &middot; ready to submit
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="flex-shrink-0 rounded-lg p-1.5 text-maia-ink-soft hover:bg-maia-bg hover:text-maia-danger"
            aria-label={`Remove ${label}`}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_UPLOAD_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          if (selected) onSelect(selected);
          e.target.value = "";
        }}
      />

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-maia-danger">
          <AlertCircle size={13} />
          {error}
        </p>
      )}

      <p className="mt-2 text-[11px] text-maia-ink-soft/70">
        Demo mode: this file is not uploaded to a secure server yet. Only its name and size are recorded.
      </p>
    </div>
  );
}
