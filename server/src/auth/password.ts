import bcrypt from "bcryptjs";

// bcryptjs (pure JS, no native compile step — reliable across hosting
// environments) with a real work factor. NEVER store, log, or return a
// plaintext password or its hash to the frontend anywhere in this codebase.
const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

const MIN_PASSWORD_LENGTH = 10;

export function validatePasswordStrength(plain: string): string | null {
  if (plain.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (!/[a-z]/.test(plain) || !/[A-Z]/.test(plain)) return "Password must include both uppercase and lowercase letters.";
  if (!/[0-9]/.test(plain)) return "Password must include at least one number.";
  return null;
}
