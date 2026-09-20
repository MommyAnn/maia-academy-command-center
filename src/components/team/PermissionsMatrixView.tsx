import { useState } from "react";
import { Save, ShieldAlert } from "lucide-react";
import { Card, CardHeader } from "@/components/common/Card";
import { Button } from "@/components/common/Button";
import { PERMISSION_ACTIONS, PERMISSION_MODULES, type PermissionAction, type PermissionMatrix, type StaffRecord } from "@/types/staff";
import { useStaffStore } from "@/data/staffStore";

const ACTION_LABELS: Record<PermissionAction, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  verify: "Verify",
  export: "Export",
};

export function PermissionsMatrixView({ staff }: { staff: StaffRecord }) {
  const { updatePermissions } = useStaffStore();
  const [matrix, setMatrix] = useState<PermissionMatrix>(staff.permissions);

  const isDirty = JSON.stringify(matrix) !== JSON.stringify(staff.permissions);

  function toggle(moduleName: (typeof PERMISSION_MODULES)[number], action: PermissionAction) {
    setMatrix((prev) => ({
      ...prev,
      [moduleName]: { ...prev[moduleName], [action]: !prev[moduleName][action] },
    }));
  }

  function handleSave() {
    updatePermissions(staff.id, matrix);
  }

  return (
    <Card padded={false}>
      <div className="p-5 sm:p-6">
        <CardHeader
          title="Permission Matrix"
          subtitle={`${staff.role === "Custom Role" ? staff.customRoleLabel || "Custom Role" : staff.role} — editable per staff member`}
        />

        <div className="mb-4 flex gap-3 rounded-lg border border-maia-warning/30 bg-maia-warning-bg px-4 py-3 text-xs text-maia-warning">
          <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
          <p>
            This matrix controls what the app UI shows this staff member. It is <strong>not</strong> production security —
            a real build must also enforce every one of these checks on the server. Hiding a button here does not stop a
            determined user from acting outside it.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto border-t border-maia-border">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-maia-border bg-maia-bg/60 text-left text-xs font-semibold uppercase tracking-wide text-maia-ink-soft">
              <th className="px-4 py-3">Module</th>
              {PERMISSION_ACTIONS.map((action) => (
                <th key={action} className="px-4 py-3 text-center">
                  {ACTION_LABELS[action]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MODULES.map((moduleName) => (
              <tr key={moduleName} className="border-b border-maia-border/60 last:border-0 hover:bg-maia-bg/40">
                <td className="whitespace-nowrap px-4 py-2.5 font-medium text-maia-ink">{moduleName}</td>
                {PERMISSION_ACTIONS.map((action) => (
                  <td key={action} className="px-4 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={matrix[moduleName][action]}
                      onChange={() => toggle(moduleName, action)}
                      className="h-4 w-4 cursor-pointer accent-maia-gold-deep"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end px-5 py-4 sm:px-6">
        <Button onClick={handleSave} disabled={!isDirty}>
          <Save size={15} />
          SAVE PERMISSIONS
        </Button>
      </div>
    </Card>
  );
}
