// DEMO DATA ONLY — sample authenticated user for Step 1.
// Replace with real session/user data once authentication is implemented.

import type { AuthenticatedUser } from "@/types";

export const DEMO_OWNER_USER: AuthenticatedUser = {
  id: "owner-1",
  name: "Mommy Ann",
  email: "owner@maiaacademy.demo",
  role: "Owner",
  avatarInitials: "MA",
};
