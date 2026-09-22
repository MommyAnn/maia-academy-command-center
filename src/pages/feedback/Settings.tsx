import { Card, CardHeader } from "@/components/common/Card";
import { useFeedbackStore } from "@/data/feedbackStore";
import { DEFAULT_QUESTION_BANK } from "@/data/feedbackConfig";
import type { FeedbackAutomationSettings } from "@/types/feedback";

const TRIGGER_LABELS: { key: keyof FeedbackAutomationSettings; label: string; description: string; wired: boolean }[] = [
  { key: "onCourseCompleted", label: "Course Completed", description: "Send a feedback request automatically when a student completes a course.", wired: true },
  { key: "onTrainingCompleted", label: "Training Completed", description: "Send a feedback request automatically when a student's training session is marked complete.", wired: false },
  { key: "onMasterclassCompleted", label: "Masterclass Completed", description: "Send a feedback request automatically after a masterclass.", wired: false },
  { key: "onFreeWebinarAttended", label: "Free Webinar Attended", description: "Send a feedback request automatically once a Free Webinar session is marked Completed and has at least one attended registration.", wired: true },
  { key: "onFullProgramCompleted", label: "Full Program Completed", description: "Send a feedback request automatically when a student's full program is complete.", wired: false },
];

export function Settings() {
  const { automationSettings, setAutomationSettings } = useFeedbackStore();

  function toggle(key: keyof FeedbackAutomationSettings) {
    setAutomationSettings({ ...automationSettings, [key]: !automationSettings[key] });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-bold text-maia-ink">Feedback Settings</h2>
        <p className="text-sm text-maia-ink-soft">Automation triggers and the default question bank.</p>
      </div>

      <Card>
        <CardHeader title="Automatic Feedback Request Triggers" subtitle="All configurable — duplicate requests for the same person/source are always prevented." />
        <div className="flex flex-col gap-3">
          {TRIGGER_LABELS.map((t) => (
            <div key={t.key} className="flex items-center justify-between gap-3 rounded-xl border border-maia-border px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-maia-ink">{t.label}</p>
                <p className="text-xs text-maia-ink-soft">{t.description}</p>
                {!t.wired && <p className="mt-0.5 text-[11px] font-semibold text-maia-warning">Not yet wired to a live event in this build.</p>}
              </div>
              <button
                onClick={() => toggle(t.key)}
                disabled={!t.wired}
                className={`h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:opacity-40 ${automationSettings[t.key] ? "bg-maia-gold-deep" : "bg-maia-border"}`}
              >
                <span
                  className={`block h-5 w-5 translate-x-0.5 rounded-full bg-white transition-transform ${automationSettings[t.key] ? "translate-x-[22px]" : ""}`}
                />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Default Question Bank" subtitle="Copied onto every new Feedback Request, then fully editable per-request." />
        <div className="flex flex-col gap-2">
          {DEFAULT_QUESTION_BANK.map((q) => (
            <div key={q.id} className="rounded-lg bg-maia-bg px-3.5 py-2.5 text-sm text-maia-ink">
              {q.text}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
