// Role/Permission architecture for Step 5. This is real, reusable data — any
// page can call hasPermission()/getRoleDefaultPermissions() to decide what a
// staff member should see. It is NOT itself an access-control system: a
// production build must enforce every one of these checks server-side too.
// Hiding a sidebar link or button here only improves the UI, it does not
// secure anything.

import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  STAFF_ROLES,
  type PermissionAction,
  type PermissionMatrix,
  type PermissionModule,
  type StaffRoleName,
} from "@/types/staff";

/** Builds a full permission matrix (every module × every action) defaulting to false, then applies per-module allowed-action overrides. */
export function buildPermissionMatrix(allowed: Partial<Record<PermissionModule, PermissionAction[]>>): PermissionMatrix {
  const matrix = {} as PermissionMatrix;
  for (const mod of PERMISSION_MODULES) {
    const actions = {} as Record<PermissionAction, boolean>;
    for (const action of PERMISSION_ACTIONS) {
      actions[action] = (allowed[mod] ?? []).includes(action);
    }
    matrix[mod] = actions;
  }
  return matrix;
}

const ALL_ACTIONS: PermissionAction[] = [...PERMISSION_ACTIONS];
const VIEW_ONLY: PermissionAction[] = ["view"];
const VIEW_EDIT: PermissionAction[] = ["view", "create", "edit"];

function fullAccessMatrix(): PermissionMatrix {
  const allowed: Partial<Record<PermissionModule, PermissionAction[]>> = {};
  for (const mod of PERMISSION_MODULES) allowed[mod] = ALL_ACTIONS;
  return buildPermissionMatrix(allowed);
}

/** Sensible starting-point permissions per role, used when creating a new staff account. Fully editable per-staff afterward. */
export const ROLE_DEFAULT_PERMISSIONS: Record<StaffRoleName, PermissionMatrix> = {
  Owner: fullAccessMatrix(),
  Administrator: fullAccessMatrix(),
  "Finance Officer": buildPermissionMatrix({
    Dashboard: VIEW_ONLY,
    Students: VIEW_ONLY,
    "Finance - Payments": ALL_ACTIONS,
    "Finance - Expenses": ALL_ACTIONS,
    "Finance - Reports": ["view", "export"],
    Batches: VIEW_ONLY,
    Tasks: VIEW_EDIT,
    Calendar: VIEW_ONLY,
    Reports: ["view", "export"],
  }),
  "Enrollment Officer": buildPermissionMatrix({
    Dashboard: VIEW_ONLY,
    Students: VIEW_EDIT,
    Enrollment: ALL_ACTIONS,
    Batches: VIEW_ONLY,
    Training: VIEW_ONLY,
    Tasks: VIEW_EDIT,
    Calendar: VIEW_ONLY,
  }),
  "Student Success Coordinator": buildPermissionMatrix({
    Dashboard: VIEW_ONLY,
    Students: VIEW_EDIT,
    "Master Brain": VIEW_EDIT,
    Taobao: VIEW_EDIT,
    Batches: VIEW_ONLY,
    Tasks: VIEW_EDIT,
    Calendar: VIEW_ONLY,
    Announcements: VIEW_ONLY,
  }),
  "Training Coordinator": buildPermissionMatrix({
    Dashboard: VIEW_ONLY,
    Students: VIEW_ONLY,
    Training: ALL_ACTIONS,
    Certificates: ALL_ACTIONS,
    Batches: VIEW_ONLY,
    Tasks: VIEW_EDIT,
    Calendar: VIEW_EDIT,
  }),
  "Inventory Officer": buildPermissionMatrix({
    Dashboard: VIEW_ONLY,
    Inventory: ALL_ACTIONS,
    Tasks: VIEW_EDIT,
    Calendar: VIEW_ONLY,
  }),
  "Marketing Staff": buildPermissionMatrix({
    Dashboard: VIEW_ONLY,
    Announcements: ALL_ACTIONS,
    Reports: VIEW_ONLY,
    Tasks: VIEW_EDIT,
    Calendar: VIEW_ONLY,
  }),
  "Support Staff": buildPermissionMatrix({
    Dashboard: VIEW_ONLY,
    Students: VIEW_ONLY,
    Tasks: VIEW_EDIT,
    Calendar: VIEW_ONLY,
  }),
  "Custom Role": buildPermissionMatrix({
    Dashboard: VIEW_ONLY,
    Tasks: VIEW_EDIT,
    Calendar: VIEW_ONLY,
  }),
};

export function hasPermission(
  permissions: PermissionMatrix,
  moduleName: PermissionModule,
  action: PermissionAction,
): boolean {
  return Boolean(permissions[moduleName]?.[action]);
}

export { STAFF_ROLES };
