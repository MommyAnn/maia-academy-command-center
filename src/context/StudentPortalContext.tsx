import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { StudentRecord } from "@/types/student";

// The Student Portal's single source of "who am I looking at". Every portal
// page reads the current student through this context instead of looking
// at auth or a URL param directly — that way the exact same page
// components work for a real student's own session AND for an Admin's
// "VIEW AS STUDENT" preview (src/pages/students/AdminStudentPortalPreview.tsx),
// which is the only other place allowed to populate this with someone
// else's record. Real portal routes always populate it from the logged-in
// student's own linked record — see src/layouts/PortalLayout.tsx.

interface StudentPortalContextValue {
  student: StudentRecord;
  /** True only inside an Admin's "VIEW AS STUDENT" preview — never true for a real student session. */
  isPreview: boolean;
}

const StudentPortalContext = createContext<StudentPortalContextValue | undefined>(undefined);

export function StudentPortalProvider({
  student,
  isPreview = false,
  children,
}: {
  student: StudentRecord;
  isPreview?: boolean;
  children: ReactNode;
}) {
  const value = useMemo<StudentPortalContextValue>(() => ({ student, isPreview }), [student, isPreview]);
  return <StudentPortalContext.Provider value={value}>{children}</StudentPortalContext.Provider>;
}

export function useStudentPortal() {
  const ctx = useContext(StudentPortalContext);
  if (!ctx) throw new Error("useStudentPortal must be used within a StudentPortalProvider");
  return ctx;
}
