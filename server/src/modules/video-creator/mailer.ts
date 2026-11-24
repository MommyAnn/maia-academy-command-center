// Optional transactional email (Resend HTTP API). When RESEND_API_KEY is not
// set, nothing is sent and callers fall back to admin-issued reset links.

import { env } from "../../env.js";

export function isEmailConfigured(): boolean {
  return !!env.RESEND_API_KEY && !!env.EMAIL_FROM;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html }),
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function resetLink(token: string): string {
  return `${env.APP_PUBLIC_URL.replace(/\/$/, "")}/studio/reset-password?token=${encodeURIComponent(token)}`;
}

export async function sendPasswordResetEmail(to: string, fullName: string, token: string): Promise<boolean> {
  const link = resetLink(token);
  return sendEmail(
    to,
    "Reset your M.A.I.A. AI Video Creator password",
    `<div style="font-family:Arial,sans-serif;background:#0A0908;color:#EDEAEC;padding:32px">
      <h2 style="color:#D6A524;margin:0 0 16px">M.A.I.A. AI Video Creator</h2>
      <p>Hi ${fullName.replace(/[<>&"]/g, "")},</p>
      <p>We received a request to reset your password. This link is valid for 1 hour:</p>
      <p><a href="${link}" style="display:inline-block;background:#C29646;color:#0A0908;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Reset my password</a></p>
      <p style="color:#9a958c;font-size:13px">If you didn't ask for this, you can ignore this email.</p>
    </div>`,
  );
}
