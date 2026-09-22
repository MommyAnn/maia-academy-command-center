// Template rendering (spec sections 46-48). A template may ONLY reference
// the variable names it declared on itself (variablesJson) — anything else
// in the body is left as literal `{{...}}` text rather than silently
// interpolated, so a template can never accidentally leak a field it
// wasn't explicitly authored to use.

import { db } from "../../db.js";

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function renderTemplateBody(body: string, declaredVariables: string[] | null | undefined, values: Record<string, string>): string {
  const declared = declaredVariables ?? [];
  return body.replace(VARIABLE_PATTERN, (match, varName: string) => {
    if (!declared.includes(varName)) return match;
    return values[varName] ?? "";
  });
}

/** Fixed synthetic sample data (spec section 48) — a preview NEVER reads a real contact's fields. */
export function sampleValues(): Record<string, string> {
  return {
    firstName: "Sample",
    lastName: "Student",
    fullName: "Sample Student",
    email: "sample.preview@example.com",
    phone: "09170000000",
    batch: "B14",
    package: "Premium",
    pipelineStage: "INTERESTED",
    webinarDate: "2026-01-01",
  };
}

export async function resolvePersonValues(personId: string): Promise<Record<string, string>> {
  const [person, lead, student] = await Promise.all([
    db.person.findUnique({ where: { id: personId } }),
    db.lead.findUnique({ where: { personId } }),
    db.student.findUnique({ where: { personId }, include: { batch: true, package: true } }),
  ]);
  const [firstName, ...rest] = (person?.fullName ?? "").trim().split(/\s+/);
  return {
    firstName: firstName ?? "",
    lastName: rest.join(" "),
    fullName: person?.fullName ?? "",
    email: person?.email ?? "",
    phone: person?.contactNumber ?? "",
    batch: student?.batch.code ?? "",
    package: student?.package.name ?? "",
    pipelineStage: lead?.pipelineStage ?? "",
  };
}
