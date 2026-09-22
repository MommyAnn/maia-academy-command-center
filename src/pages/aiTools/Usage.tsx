import { Card, CardHeader } from "@/components/common/Card";
import { SelectField } from "@/components/common/SelectField";
import { TextField } from "@/components/common/TextField";
import { useAiToolsStore } from "@/data/aiToolsStore";
import { AI_USAGE_LIMIT_MODES } from "@/types/aiTools";
import type { PackageType } from "@/types/student";

const PACKAGES: PackageType[] = ["Premium", "VIP", "Dual VIP"];

export function Usage() {
  const { usageSettings, setUsageSettings } = useAiToolsStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-lg font-bold text-maia-ink">AI Usage Limits</h1>
        <p className="text-sm text-maia-ink-soft">
          Prepared for future monetization — billing is never activated here; changing this only limits generations in this demo.
        </p>
      </div>

      <Card>
        <CardHeader title="Limit Mode" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField
            label="Mode"
            value={usageSettings.mode}
            onChange={(e) => setUsageSettings({ mode: e.target.value as typeof usageSettings.mode })}
            options={AI_USAGE_LIMIT_MODES.map((m) => ({ value: m, label: m }))}
          />
          {usageSettings.mode === "Daily Limit" && (
            <TextField label="Daily Limit (generations)" type="number" value={usageSettings.dailyLimit} onChange={(e) => setUsageSettings({ dailyLimit: Number(e.target.value) })} />
          )}
          {usageSettings.mode === "Monthly Limit" && (
            <TextField label="Monthly Limit (generations)" type="number" value={usageSettings.monthlyLimit} onChange={(e) => setUsageSettings({ monthlyLimit: Number(e.target.value) })} />
          )}
        </div>
      </Card>

      {usageSettings.mode === "Daily Limit" && (
        <Card>
          <CardHeader title="Package-Based Daily Limit Overrides" subtitle="Leave blank to use the default daily limit above." />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {PACKAGES.map((pkg) => (
              <TextField
                key={pkg}
                label={pkg}
                type="number"
                value={usageSettings.packageDailyLimitOverrides[pkg] ?? ""}
                onChange={(e) =>
                  setUsageSettings({
                    packageDailyLimitOverrides: { ...usageSettings.packageDailyLimitOverrides, [pkg]: e.target.value ? Number(e.target.value) : undefined },
                  })
                }
              />
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="AI Credits (Future Preparation)" subtitle="Never activated as real billing in this build — reference costs only." />
        <div className="mb-4 flex items-center justify-between rounded-xl border border-maia-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-maia-ink">Enable Credits</p>
            <p className="text-xs text-maia-ink-soft">Toggling this on does not charge anyone — no payment system is wired up.</p>
          </div>
          <button
            onClick={() => setUsageSettings({ creditsEnabled: !usageSettings.creditsEnabled })}
            className={`h-6 w-11 flex-shrink-0 rounded-full transition-colors ${usageSettings.creditsEnabled ? "bg-maia-gold-deep" : "bg-maia-border"}`}
          >
            <span className={`block h-5 w-5 translate-x-0.5 rounded-full bg-white transition-transform ${usageSettings.creditsEnabled ? "translate-x-[22px]" : ""}`} />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField label="Text Generation Cost" type="number" value={usageSettings.textCreditCost} onChange={(e) => setUsageSettings({ textCreditCost: Number(e.target.value) })} disabled={!usageSettings.creditsEnabled} />
          <TextField label="Image Generation Cost" type="number" value={usageSettings.imageCreditCost} onChange={(e) => setUsageSettings({ imageCreditCost: Number(e.target.value) })} disabled={!usageSettings.creditsEnabled} />
          <TextField label="Video Generation Cost" type="number" value={usageSettings.videoCreditCost} onChange={(e) => setUsageSettings({ videoCreditCost: Number(e.target.value) })} disabled={!usageSettings.creditsEnabled} />
        </div>
      </Card>
    </div>
  );
}
