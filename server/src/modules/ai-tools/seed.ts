// Real backend seeding for the AI Tool Library (spec sections 8-9, 24-26)
// — called from both the dev seed script and the test suite's resetDb(),
// so every environment always has the same 18 real AiTool + PromptVersion
// rows, never left for a route to lazily create.

import type { Prisma } from "@prisma/client";
import { db } from "../../db.js";
import { AI_TOOL_SEED_DEFS, buildSystemInstruction, fieldsToJsonSchema } from "./seed-data.js";

const MODEL_CONFIGS = [
  { configKey: "reasoning", provider: "ANTHROPIC", model: "claude-opus-5", purpose: "Reasoning-heavy strategy/planning tools", maxOutputTokens: 8000, supportsStructuredOutput: true, fallbackConfigKey: "default" },
  { configKey: "default", provider: "ANTHROPIC", model: "claude-sonnet-5", purpose: "General-purpose generation tools", maxOutputTokens: 6000, supportsStructuredOutput: true, fallbackConfigKey: null },
  { configKey: "structured-analytical", provider: "ANTHROPIC", model: "claude-sonnet-5", purpose: "Strict, low-temperature structured analysis", maxOutputTokens: 4000, temperature: 0.2, supportsStructuredOutput: true, fallbackConfigKey: "default" },
  { configKey: "master-brain-generation", provider: "ANTHROPIC", model: "claude-opus-5", purpose: "Brand Master Brain draft generation", maxOutputTokens: 8000, supportsStructuredOutput: true, fallbackConfigKey: null },
] as const;

export async function seedAiModelConfigs() {
  for (const config of MODEL_CONFIGS) {
    await db.aiModelConfig.upsert({
      where: { configKey: config.configKey },
      update: {},
      create: { ...config },
    });
  }
}

export async function seedAiProviderConfigs() {
  for (const provider of ["ANTHROPIC", "OPENAI", "GOOGLE"] as const) {
    await db.aiProviderConfig.upsert({ where: { provider }, update: {}, create: { provider, updatedAt: new Date() } });
  }
}

export async function seedAiToolLibrary(actorUserId: string) {
  await seedAiModelConfigs();
  await seedAiProviderConfigs();

  for (const def of AI_TOOL_SEED_DEFS) {
    const modelConfig = await db.aiModelConfig.findUniqueOrThrow({ where: { configKey: def.modelConfigKey } });

    const tool = await db.aiTool.upsert({
      where: { toolKey: def.toolKey },
      update: {
        name: def.name,
        description: def.description,
        category: def.category,
        displayOrder: def.displayOrder,
        modelConfigId: modelConfig.id,
        inputSchemaJson: fieldsToJsonSchema(def.inputFields) as Prisma.InputJsonValue,
      },
      create: {
        toolKey: def.toolKey,
        name: def.name,
        description: def.description,
        category: def.category,
        displayOrder: def.displayOrder,
        modelConfigId: modelConfig.id,
        inputSchemaJson: fieldsToJsonSchema(def.inputFields) as Prisma.InputJsonValue,
      },
    });

    const existingActive = await db.promptVersion.findFirst({ where: { toolId: tool.id, status: "ACTIVE" } });
    if (!existingActive) {
      await db.promptVersion.create({
        data: {
          toolId: tool.id,
          name: `${def.name} — v1`,
          version: 1,
          systemInstruction: buildSystemInstruction(def),
          status: "ACTIVE",
          changeNotes: "Initial seeded prompt version.",
          updatedById: actorUserId,
          publishedAt: new Date(),
        },
      });
    }
  }

  // Default package access (spec section 61) — every seeded Package gets
  // every tool; staff can narrow this later via AiPackageAccess CRUD.
  const packages = await db.package.findMany();
  for (const pkg of packages) {
    for (const def of AI_TOOL_SEED_DEFS) {
      await db.aiPackageAccess.upsert({
        where: { packageId_toolKey: { packageId: pkg.id, toolKey: def.toolKey } },
        update: {},
        create: { packageId: pkg.id, toolKey: def.toolKey },
      });
    }
  }
}
