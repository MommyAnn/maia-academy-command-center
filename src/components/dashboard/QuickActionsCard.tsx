import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Boxes, ClipboardPlus, ExternalLink, ListChecks, Plus, UserPlus, Wallet } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { RecordPaymentModal } from "@/components/finance/RecordPaymentModal";
import { ExpenseModal } from "@/components/finance/ExpenseModal";

export function QuickActionsCard() {
  const navigate = useNavigate();
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);

  const actions = [
    { key: "add-student", label: "+ ADD STUDENT", icon: <UserPlus size={16} />, onClick: () => window.open("/enroll", "_blank") },
    { key: "record-payment", label: "+ RECORD PAYMENT", icon: <Plus size={16} />, onClick: () => setRecordPaymentOpen(true) },
    { key: "add-expense", label: "+ ADD EXPENSE", icon: <Plus size={16} />, onClick: () => setAddExpenseOpen(true) },
    { key: "create-task", label: "+ CREATE TASK", icon: <ClipboardPlus size={16} />, onClick: () => navigate("/team/tasks") },
    { key: "add-inventory", label: "+ ADD INVENTORY", icon: <Boxes size={16} />, onClick: () => navigate("/inventory/all-items") },
    { key: "open-enrollment", label: "OPEN ENROLLMENT FORM", icon: <ExternalLink size={16} />, onClick: () => window.open("/enroll", "_blank") },
    { key: "view-receivables", label: "VIEW RECEIVABLES", icon: <Wallet size={16} />, onClick: () => navigate("/finance/receivables") },
    {
      key: "review-master-brain",
      label: "REVIEW MASTER BRAIN",
      icon: <ListChecks size={16} />,
      onClick: () => navigate(`/students/all?masterBrain=${encodeURIComponent("Submitted")}`),
    },
  ];

  return (
    <Card>
      <CardHeader title="Quick Actions" />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => (
          <button
            key={action.key}
            onClick={action.onClick}
            className="flex items-center gap-2 rounded-lg border border-maia-border bg-maia-surface px-3.5 py-2.5 text-left text-xs font-bold tracking-wide text-maia-ink transition-colors hover:border-maia-gold hover:bg-maia-gold-bg/40"
          >
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-maia-gold-bg text-maia-gold-deep">
              {action.icon}
            </span>
            {action.label}
          </button>
        ))}
      </div>

      <RecordPaymentModal open={recordPaymentOpen} onClose={() => setRecordPaymentOpen(false)} />
      <ExpenseModal open={addExpenseOpen} onClose={() => setAddExpenseOpen(false)} />
    </Card>
  );
}

