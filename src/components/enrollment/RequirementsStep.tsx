import { FileUploadField, validateUploadFile } from "./FileUploadField";
import { SectionTitle } from "./StudentInfoStep";
import type { EnrollmentFormErrors, EnrollmentFormState } from "./formState";

export function RequirementsStep({
  form,
  errors,
  onChange,
  onFileError,
}: {
  form: EnrollmentFormState;
  errors: EnrollmentFormErrors;
  onChange: (patch: Partial<EnrollmentFormState>) => void;
  onFileError: (field: "validIdFile" | "proofOfPaymentFile", message: string | null) => void;
}) {
  function handleSelect(field: "validIdFile" | "proofOfPaymentFile", file: File) {
    const error = validateUploadFile(file);
    if (error) {
      onFileError(field, error);
      return;
    }
    onFileError(field, null);
    onChange({ [field]: file } as Partial<EnrollmentFormState>);
  }

  return (
    <div>
      <SectionTitle title="Requirements" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FileUploadField
          label="Valid ID Photo *"
          file={form.validIdFile}
          error={errors.validIdFile}
          onSelect={(file) => handleSelect("validIdFile", file)}
          onClear={() => onChange({ validIdFile: null })}
        />
        <FileUploadField
          label="Proof of Payment *"
          file={form.proofOfPaymentFile}
          error={errors.proofOfPaymentFile}
          onSelect={(file) => handleSelect("proofOfPaymentFile", file)}
          onClear={() => onChange({ proofOfPaymentFile: null })}
        />
      </div>
    </div>
  );
}
