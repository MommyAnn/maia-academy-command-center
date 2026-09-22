import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Tabs } from "@/components/common/Tabs";
import { ProfileHeader } from "@/components/students/profile/ProfileHeader";
import { OverviewTab } from "@/components/students/profile/OverviewTab";
import { RequirementsTab } from "@/components/students/profile/RequirementsTab";
import { PaymentTab } from "@/components/students/profile/PaymentTab";
import { TaobaoTab } from "@/components/students/profile/TaobaoTab";
import { MasterBrainTab } from "@/components/students/profile/MasterBrainTab";
import { TasksTab } from "@/components/students/profile/TasksTab";
import { TrainingTab } from "@/components/students/profile/TrainingTab";
import { CertificatesTab } from "@/components/students/profile/CertificatesTab";
import { LearningTab } from "@/components/students/profile/LearningTab";
import { NotesTab } from "@/components/students/profile/NotesTab";
import { ActivityTab } from "@/components/students/profile/ActivityTab";
import { PortalTab } from "@/components/students/profile/PortalTab";
import { useStudentStore } from "@/data/studentStore";
import { CommunicationsPanel } from "@/components/communications/CommunicationsPanel";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "requirements", label: "Requirements" },
  { value: "payment", label: "Payment" },
  { value: "taobao", label: "Taobao" },
  { value: "master-brain", label: "Master Brain" },
  { value: "tasks", label: "Tasks" },
  { value: "training", label: "Training" },
  { value: "certificates", label: "Certificates" },
  { value: "learning", label: "Learning" },
  { value: "portal", label: "Student Portal" },
  { value: "communications", label: "Communications" },
  { value: "notes", label: "Admin Notes" },
  { value: "activity", label: "Activity History" },
];

export function StudentProfile() {
  const { studentId } = useParams<{ studentId: string }>();
  const { getStudentById } = useStudentStore();
  const [tab, setTab] = useState("overview");

  const student = studentId ? getStudentById(studentId) : undefined;

  if (!student) {
    return <Navigate to="/students/all" replace />;
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      <ProfileHeader student={student} />

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "overview" && <OverviewTab student={student} />}
      {tab === "requirements" && <RequirementsTab student={student} />}
      {tab === "payment" && <PaymentTab student={student} />}
      {tab === "taobao" && <TaobaoTab key={student.id} student={student} />}
      {tab === "master-brain" && <MasterBrainTab student={student} />}
      {tab === "tasks" && <TasksTab student={student} />}
      {tab === "training" && <TrainingTab student={student} />}
      {tab === "certificates" && <CertificatesTab student={student} />}
      {tab === "learning" && <LearningTab student={student} />}
      {tab === "portal" && <PortalTab student={student} />}
      {tab === "communications" && <CommunicationsPanel personType="Student" personId={student.id} />}
      {tab === "notes" && <NotesTab student={student} />}
      {tab === "activity" && <ActivityTab student={student} />}
    </div>
  );
}
