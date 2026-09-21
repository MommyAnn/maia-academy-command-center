import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Batch } from "@/types/student";
import type { PermissionMatrix, StaffAccountStatus, StaffRecord, StaffRoleName } from "@/types/staff";
import { DEMO_STAFF } from "@/data/demoStaff";
import { ROLE_DEFAULT_PERMISSIONS } from "@/data/staffConfig";
import { generateStaffId } from "@/utils/staffTasks";

// ---------------------------------------------------------------------------
// DEMO / LOCAL PERSISTENCE ONLY
// ---------------------------------------------------------------------------
// Same caveats as src/data/studentStore.tsx and src/data/financeStore.tsx:
// this store keeps Staff records in React state and mirrors them into this
// browser's localStorage. It is NOT a real HR/identity system:
//   - Not shared across devices, browsers, or users.
//   - Not encrypted, backed up, or access-controlled.
//   - No real passwords/credentials are stored or checked anywhere here.
//   - The permission matrix stored per staff member is real, reusable data,
//     but it is NOT enforced server-side in this demo — see src/types/staff.ts.
// A real backend will replace this store in a later step.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "maia_demo_staff_v1";

function loadInitialStaff(): StaffRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StaffRecord[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // Corrupt/blocked localStorage falls back to seed demo data below.
  }
  // Persist immediately so a session's stored linkedStaffId still resolves
  // after a hard reload — see the matching comment in studentStore.tsx.
  persist(DEMO_STAFF);
  return DEMO_STAFF;
}

function persist(staff: StaffRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(staff));
  } catch {
    // Demo-only persistence — safe to ignore quota/availability errors.
  }
}

function nowParts() {
  const d = new Date();
  return {
    iso: d.toISOString(),
    date: d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }),
    time: d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" }),
  };
}

const CURRENT_DEMO_USER = "Mommy Ann";

export interface CreateStaffInput {
  fullName: string;
  email: string;
  contactNumber: string;
  role: StaffRoleName;
  customRoleLabel: string;
  assignedBatches: Batch[];
  notes: string;
}

interface StaffStoreValue {
  staff: StaffRecord[];
  getStaffById: (id: string) => StaffRecord | undefined;
  createStaff: (input: CreateStaffInput) => StaffRecord;
  updateStaffDetails: (
    id: string,
    updates: Partial<Pick<StaffRecord, "fullName" | "email" | "contactNumber" | "assignedBatches" | "notes">>,
  ) => void;
  updateStaffRole: (id: string, role: StaffRoleName, customRoleLabel: string) => void;
  updatePermissions: (id: string, permissions: PermissionMatrix) => void;
  updateAccountStatus: (id: string, status: StaffAccountStatus) => void;
  appendStaffActivity: (id: string, action: string) => void;
}

const StaffStoreContext = createContext<StaffStoreValue | undefined>(undefined);

export function StaffStoreProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<StaffRecord[]>(() => loadInitialStaff());

  const updateStaffRecord = useCallback((id: string, updater: (s: StaffRecord) => StaffRecord) => {
    setStaff((prev) => {
      const next = prev.map((s) => (s.id === id ? updater(s) : s));
      persist(next);
      return next;
    });
  }, []);

  const getStaffById = useCallback((id: string) => staff.find((s) => s.id === id), [staff]);

  const createStaff = useCallback((input: CreateStaffInput): StaffRecord => {
    const { date, time } = nowParts();
    let created!: StaffRecord;

    setStaff((prev) => {
      const staffId = generateStaffId(prev);
      const initials = input.fullName
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

      created = {
        id: crypto.randomUUID(),
        staffId,
        fullName: input.fullName,
        email: input.email,
        contactNumber: input.contactNumber,
        role: input.role,
        customRoleLabel: input.role === "Custom Role" ? input.customRoleLabel : "",
        permissions: ROLE_DEFAULT_PERMISSIONS[input.role],
        accountStatus: "Active",
        dateJoined: date,
        avatarInitials: initials || "ST",
        notes: input.notes,
        assignedBatches: input.assignedBatches,
        activity: [{ id: crypto.randomUUID(), action: "Staff account created", date, time, by: CURRENT_DEMO_USER }],
      };
      const next = [created, ...prev];
      persist(next);
      return next;
    });

    return created;
  }, []);

  const updateStaffDetails = useCallback(
    (
      id: string,
      updates: Partial<Pick<StaffRecord, "fullName" | "email" | "contactNumber" | "assignedBatches" | "notes">>,
    ) => {
      const { date, time } = nowParts();
      updateStaffRecord(id, (s) => ({
        ...s,
        ...updates,
        activity: [...s.activity, { id: crypto.randomUUID(), action: "Staff details updated", date, time, by: CURRENT_DEMO_USER }],
      }));
    },
    [updateStaffRecord],
  );

  const updateStaffRole = useCallback(
    (id: string, role: StaffRoleName, customRoleLabel: string) => {
      const { date, time } = nowParts();
      updateStaffRecord(id, (s) => ({
        ...s,
        role,
        customRoleLabel: role === "Custom Role" ? customRoleLabel : "",
        activity: [
          ...s.activity,
          {
            id: crypto.randomUUID(),
            action: `Role changed to ${role === "Custom Role" ? customRoleLabel || "Custom Role" : role}`,
            date,
            time,
            by: CURRENT_DEMO_USER,
          },
        ],
      }));
    },
    [updateStaffRecord],
  );

  const updatePermissions = useCallback(
    (id: string, permissions: PermissionMatrix) => {
      const { date, time } = nowParts();
      updateStaffRecord(id, (s) => ({
        ...s,
        permissions,
        activity: [...s.activity, { id: crypto.randomUUID(), action: "Permissions updated", date, time, by: CURRENT_DEMO_USER }],
      }));
    },
    [updateStaffRecord],
  );

  const updateAccountStatus = useCallback(
    (id: string, status: StaffAccountStatus) => {
      const { date, time } = nowParts();
      updateStaffRecord(id, (s) => ({
        ...s,
        accountStatus: status,
        activity: [
          ...s.activity,
          { id: crypto.randomUUID(), action: `Account status changed to ${status}`, date, time, by: CURRENT_DEMO_USER },
        ],
      }));
    },
    [updateStaffRecord],
  );

  const appendStaffActivity = useCallback(
    (id: string, action: string) => {
      const { date, time } = nowParts();
      updateStaffRecord(id, (s) => ({
        ...s,
        activity: [...s.activity, { id: crypto.randomUUID(), action, date, time, by: CURRENT_DEMO_USER }],
      }));
    },
    [updateStaffRecord],
  );

  const value = useMemo<StaffStoreValue>(
    () => ({
      staff,
      getStaffById,
      createStaff,
      updateStaffDetails,
      updateStaffRole,
      updatePermissions,
      updateAccountStatus,
      appendStaffActivity,
    }),
    [staff, getStaffById, createStaff, updateStaffDetails, updateStaffRole, updatePermissions, updateAccountStatus, appendStaffActivity],
  );

  return <StaffStoreContext.Provider value={value}>{children}</StaffStoreContext.Provider>;
}

export function useStaffStore() {
  const ctx = useContext(StaffStoreContext);
  if (!ctx) throw new Error("useStaffStore must be used within a StaffStoreProvider");
  return ctx;
}
