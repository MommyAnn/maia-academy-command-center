import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Eye } from "lucide-react";
import { Tabs } from "@/components/common/Tabs";
import { useAuth } from "@/context/AuthContext";
import { useStaffStore } from "@/data/staffStore";
import { useStudentStore } from "@/data/studentStore";
import { hasPermission } from "@/data/staffConfig";
import { StudentPortalProvider } from "@/context/StudentPortalContext";
import { PORTAL_NAV_ITEMS } from "@/data/portalNavigation";
import { Home } from "@/pages/portal/Home";
import { Enrollment } from "@/pages/portal/Enrollment";
import { Payments } from "@/pages/portal/Payments";
import { Requirements } from "@/pages/portal/Requirements";
import { Taobao } from "@/pages/portal/Taobao";
import { MasterBrain } from "@/pages/portal/MasterBrain";
import { Training } from "@/pages/portal/Training";
import { Courses } from "@/pages/portal/Courses";
import { Certificates } from "@/pages/portal/Certificates";
import { Announcements } from "@/pages/portal/Announcements";
import { Profile } from "@/pages/portal/Profile";
import { Support } from "@/pages/portal/Support";

const PAGE_BY_PATH: Record<string, React.ComponentType> = {
  "/portal": Home,
  "/portal/enrollment": Enrollment,
  "/portal/payments": Payments,
  "/portal/requirements": Requirements,
  "/portal/taobao": Taobao,
  "/portal/master-brain": MasterBrain,
  "/portal/training": Training,
  "/portal/courses": Courses,
  "/portal/certificates": Certificates,
  "/portal/announcements": Announcements,
  "/portal/profile": Profile,
  "/portal/support": Support,
};

const TABS = PORTAL_NAV_ITEMS.map((item) => ({ value: item.path, label: item.label }));

/**
 * Admin-only "VIEW AS STUDENT" preview (spec section 39). Reuses the exact
 * same portal page components a real student sees — via StudentPortalContext
 * with isPreview=true — so there is only one implementation of each page to
 * maintain. The content area is rendered non-interactive: this must always
 * be a read-only look-alike and must never let an admin perform an action
 * (submit a payment, resubmit a document, request an update, etc.) as the
 * student.
 */
export function AdminStudentPortalPreview() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getStaffById } = useStaffStore();
  const { getStudentById } = useStudentStore();
  const [tab, setTab] = useState<string>("/portal");

  const student = studentId ? getStudentById(studentId) : undefined;
  const currentStaff = user?.linkedStaffId ? getStaffById(user.linkedStaffId) : undefined;
  const canPreview = currentStaff ? hasPermission(currentStaff.permissions, "Students", "edit") : false;

  if (!student || !canPreview) {
    return <Navigate to={studentId ? `/students/${studentId}` : "/students/all"} replace />;
  }

  const PageComponent = PAGE_BY_PATH[tab] ?? Home;

  return (
    <div className="flex flex-col gap-4 pb-4">
      <button
        onClick={() => navigate(`/students/${student.id}`)}
        className="w-fit text-sm font-medium text-maia-ink-soft hover:text-maia-ink"
      >
        &larr; Back to Student Profile
      </button>

      <div className="flex items-start gap-3 rounded-2xl border border-maia-gold/40 bg-maia-gold-bg px-4 py-3.5">
        <Eye size={18} className="mt-0.5 flex-shrink-0 text-maia-gold-deep" />
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-maia-ink">Admin Preview Mode</p>
          <p className="mt-0.5 text-sm text-maia-ink-soft">
            You are viewing the Student Portal as <strong>{student.fullName}</strong> would see it. This is
            read-only — interactive elements are disabled so no action can be taken on the student&rsquo;s behalf.
          </p>
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="pointer-events-none select-none opacity-95">
        <StudentPortalProvider student={student} isPreview>
          <PageComponent />
        </StudentPortalProvider>
      </div>
    </div>
  );
}
