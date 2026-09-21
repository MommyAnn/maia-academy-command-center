import { AlertTriangle, ShieldCheck, ShoppingBag } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Badge } from "@/components/common/Badge";
import { useStudentPortal } from "@/context/StudentPortalContext";
import { TAOBAO_STATUS_TONE } from "@/components/students/statusMeta";
import { formatDateTime } from "@/utils/students";

const INSTRUCTIONS: Record<string, { title: string; body: string }> = {
  "Not Yet Created": {
    title: "Your Taobao account hasn't been created yet",
    body: "The Academy will begin setting up your Taobao account once your enrollment is confirmed and your payment is verified. Check back here for updates.",
  },
  "For Account Creation": {
    title: "Your Taobao account is being created",
    body: "The Academy team is currently setting up your dedicated Taobao account. This usually takes a few business days.",
  },
  "Login Details Ready": {
    title: "Your Taobao account is ready",
    body: "Your account has been created and is ready to be handed over. The Academy will share your login details with you shortly.",
  },
  "Login Details Given to Student": {
    title: "Your Taobao account is active",
    body: "Your Taobao account details have been shared with you directly by the Academy (e.g., via Messenger). Use the username below together with the password you were given.",
  },
};

export function Taobao() {
  const { student } = useStudentPortal();
  const info = INSTRUCTIONS[student.taobao.status];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Taobao Account Status"
          subtitle="Taobao access lives on your Academy record — there's no separate Taobao module."
          action={<Badge tone={TAOBAO_STATUS_TONE[student.taobao.status]}>{student.taobao.status}</Badge>}
        />

        <div className="flex items-start gap-3 rounded-xl bg-maia-bg px-4 py-3.5">
          <ShoppingBag size={18} className="mt-0.5 flex-shrink-0 text-maia-gold-deep" />
          <div>
            <p className="text-sm font-semibold text-maia-ink">{info.title}</p>
            <p className="mt-1 text-sm text-maia-ink-soft">{info.body}</p>
          </div>
        </div>

        {student.taobao.status === "Login Details Given to Student" && (
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">Taobao Username</dt>
              <dd className="mt-1 text-sm font-medium text-maia-ink">{student.taobao.username || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">Given To You On</dt>
              <dd className="mt-1 text-sm font-medium text-maia-ink">
                {student.taobao.dateGiven ? formatDateTime(student.taobao.dateGiven) : "—"}
              </dd>
            </div>
          </dl>
        )}
      </Card>

      <Card className="border-maia-danger/30 bg-maia-danger-bg/40">
        <div className="flex items-start gap-3">
          <ShieldCheck size={18} className="mt-0.5 flex-shrink-0 text-maia-danger" />
          <div>
            <p className="text-sm font-semibold text-maia-ink">Your password is never shown here</p>
            <p className="mt-1 text-sm text-maia-ink-soft">
              For your security, the Student Portal never displays, stores, or requests your Taobao password. Your
              password is shared with you directly and privately by the Academy team. Never share your Taobao
              password with anyone, including anyone claiming to be from the Academy through the Portal.
            </p>
          </div>
        </div>
      </Card>

      {student.taobao.status !== "Login Details Given to Student" && (
        <Card>
          <div className="flex items-start gap-3">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-maia-warning" />
            <p className="text-sm text-maia-ink-soft">
              Need help with your Taobao account? Use <strong>Need Help / Support</strong> in the sidebar and select
              the &ldquo;Taobao&rdquo; category.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
