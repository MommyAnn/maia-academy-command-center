import type { AttendancePreference, Batch, PackageType } from "@/types/student";

export interface EnrollmentFormState {
  facebookName: string;
  fullName: string;
  companionName: string;
  email: string;
  contactNumber: string;
  city: string;
  batch: Batch | "";
  package: PackageType | "";
  attendance: AttendancePreference | "";
  validIdFile: File | null;
  proofOfPaymentFile: File | null;
  termsAccepted: boolean;
}

export const INITIAL_ENROLLMENT_FORM_STATE: EnrollmentFormState = {
  facebookName: "",
  fullName: "",
  companionName: "",
  email: "",
  contactNumber: "",
  city: "",
  batch: "",
  package: "",
  attendance: "",
  validIdFile: null,
  proofOfPaymentFile: null,
  termsAccepted: false,
};

export type EnrollmentFormErrors = Partial<Record<keyof EnrollmentFormState, string>>;

export function validateStudentInfo(form: EnrollmentFormState): EnrollmentFormErrors {
  const errors: EnrollmentFormErrors = {};
  if (!form.facebookName.trim()) errors.facebookName = "Facebook Name is required.";
  if (!form.fullName.trim()) errors.fullName = "Real Full Name is required.";
  if (!form.email.trim()) {
    errors.email = "Email Address is required.";
  } else if (!/^\S+@\S+\.\S+$/.test(form.email)) {
    errors.email = "Please enter a valid email address.";
  }
  if (!form.contactNumber.trim()) errors.contactNumber = "Contact Number is required.";
  if (!form.city.trim()) errors.city = "City / Location is required.";
  return errors;
}

export function validateEnrollmentInfo(form: EnrollmentFormState): EnrollmentFormErrors {
  const errors: EnrollmentFormErrors = {};
  if (!form.batch) errors.batch = "Please select a batch.";
  if (!form.package) errors.package = "Please select a package.";
  if (!form.attendance) errors.attendance = "Please select an attendance preference.";
  return errors;
}

export function validateRequirements(form: EnrollmentFormState): EnrollmentFormErrors {
  const errors: EnrollmentFormErrors = {};
  if (!form.validIdFile) errors.validIdFile = "Please upload a valid ID photo.";
  if (!form.proofOfPaymentFile) errors.proofOfPaymentFile = "Please upload your proof of payment.";
  return errors;
}

export function validateTerms(form: EnrollmentFormState): EnrollmentFormErrors {
  const errors: EnrollmentFormErrors = {};
  if (!form.termsAccepted) errors.termsAccepted = "You must accept the Terms & Conditions to continue.";
  return errors;
}
