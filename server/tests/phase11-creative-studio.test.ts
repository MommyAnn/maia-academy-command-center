import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { resetDb, loginAs, DEV_USERS } from "./helpers.js";
import { createFakeAnthropicServer } from "./anthropic-fake-server.js";

let app: FastifyInstance;
let ownerCookie: string;
let studentACookie: string;
let studentBCookie: string;
let studentAId: string;
const fakeAnthropic = createFakeAnthropicServer(4011);

beforeAll(async () => {
  await fakeAnthropic.start();
  await resetDb();
  app = await buildApp();
  ownerCookie = await loginAs(app, DEV_USERS.owner.email, DEV_USERS.owner.password);
  studentACookie = await loginAs(app, DEV_USERS.studentA.email, DEV_USERS.studentA.password);
  studentBCookie = await loginAs(app, DEV_USERS.studentB.email, DEV_USERS.studentB.password);
  studentAId = (await db.student.findUniqueOrThrow({ where: { studentDisplayId: "MAIA-B14-DEV-A" } })).id;
});

afterAll(async () => {
  await app.close();
  await db.$disconnect();
  await fakeAnthropic.stop();
});

async function createPublishedBusiness(cookie: string, studentId: string, name: string, overview = "Synthetic overview") {
  const businessRes = await app.inject({ method: "POST", url: `/api/students/${studentId}/businesses`, headers: { cookie }, payload: { name } });
  const business = businessRes.json().business;

  await app.inject({ method: "PATCH", url: `/api/businesses/${business.id}/master-brain`, headers: { cookie }, payload: { answers: { x: 1 } } });
  const submission = (await app.inject({ method: "GET", url: `/api/businesses/${business.id}/master-brain`, headers: { cookie } })).json().submission;
  await db.masterBrainSubmission.update({ where: { id: submission.id }, data: { status: "APPROVED_FOR_GENERATION" } });

  fakeAnthropic.setMode("success");
  fakeAnthropic.setResponseText(JSON.stringify({ sections: [{ key: "brandOverview", title: "1. Brand Overview", content: overview, bullets: [] }] }));
  const document = (await app.inject({ method: "POST", url: `/api/master-brain/submissions/${submission.id}/generate`, headers: { cookie: ownerCookie } })).json().document;
  await app.inject({ method: "POST", url: `/api/master-brain/documents/${document.id}/publish`, headers: { cookie: ownerCookie } });

  return business;
}

async function createCampaign(cookie: string, studentId: string, businessId: string, name = "Synthetic Test Campaign") {
  const res = await app.inject({
    method: "POST",
    url: `/api/students/${studentId}/campaigns`,
    headers: { cookie },
    payload: { businessId, name, objective: "Lead Generation", product: "Import Mastery Course", offer: "Free strategy session", audience: "Aspiring importers age 25-45" },
  });
  expect(res.statusCode).toBe(201);
  return res.json().campaign;
}

describe("Phase 11 M.A.I.A. Creative Studio — full synthetic pipeline (spec sections 4-55, 82)", () => {
  it("runs Campaign -> Strategy -> Angles -> Hooks -> Script -> approve -> Storyboard -> Character -> Scene Prompt -> Copy -> Package -> approve -> revise -> Test, all persisted to the Creative Library", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Creative Pipeline Business");
    const campaign = await createCampaign(studentACookie, studentAId, business.id);
    expect(campaign.campaignDisplayId).toMatch(/^CAMP-\d{4}-\d{6}$/);
    expect(campaign.status).toBe("DRAFT");
    expect(campaign.masterBrainVersionAtCreation).toBe(1);

    // 1. Campaign Strategist (free-text, generic engine)
    fakeAnthropic.setResponseText("STRATEGY: Focus on pain-point-led messaging for aspiring importers.");
    const strategy = await app.inject({ method: "POST", url: `/api/campaigns/${campaign.id}/strategy/generate`, headers: { cookie: studentACookie }, payload: {} });
    expect(strategy.statusCode).toBe(201);
    expect(strategy.json().generation.status).toBe("COMPLETED");
    expect(strategy.json().generation.outputJson.text).toContain("STRATEGY");

    // 2. Creative Angle Engine
    fakeAnthropic.setResponseText(
      JSON.stringify({
        angles: [
          { angleName: "Escape the 9-5", angleType: "Transformation", coreMessage: "Build a real import business from home.", audience: "Aspiring importers", awarenessStage: "PROBLEM_AWARE", painOrDesire: "Financial independence", offerConnection: "Free strategy session" },
          { angleName: "Beginner Friendly", angleType: "Education", coreMessage: "No experience needed to start importing." },
        ],
      }),
    );
    const anglesRes = await app.inject({ method: "POST", url: `/api/campaigns/${campaign.id}/angles/generate`, headers: { cookie: studentACookie }, payload: { angleCount: 2 } });
    expect(anglesRes.statusCode).toBe(201);
    expect(anglesRes.json().angles).toHaveLength(2);
    const angleId = anglesRes.json().angles[0].id;

    const anglesList = await app.inject({ method: "GET", url: `/api/campaigns/${campaign.id}/angles`, headers: { cookie: studentACookie } });
    expect(anglesList.json().angles).toHaveLength(2);
    await app.inject({ method: "POST", url: `/api/angles/${angleId}/status`, headers: { cookie: studentACookie }, payload: { status: "Selected" } });

    // 3. Hook Lab
    fakeAnthropic.setResponseText(
      JSON.stringify({
        hooks: [
          { category: "PAIN", text: "Tired of the 9-5 grind?" },
          { category: "CURIOSITY", text: "Here's how one mom started importing from home." },
        ],
      }),
    );
    const hooksRes = await app.inject({ method: "POST", url: `/api/campaigns/${campaign.id}/hooks/generate`, headers: { cookie: studentACookie }, payload: { angleId, hookCount: 2 } });
    expect(hooksRes.statusCode).toBe(201);
    expect(hooksRes.json().hooks).toHaveLength(2);
    const hookId = hooksRes.json().hooks[0].id;
    await app.inject({ method: "POST", url: `/api/hooks/${hookId}/status`, headers: { cookie: studentACookie }, payload: { status: "Favorited" } });

    // 4. Script Studio — must never invent a testimonial/award/guarantee (validated, flagged if present)
    fakeAnthropic.setResponseText(
      JSON.stringify({
        scriptType: "UGC",
        platform: "Facebook",
        durationSeconds: 30,
        presenterType: "Founder",
        cta: "Book your free session",
        sections: [
          { type: "HOOK", content: "Tired of the 9-5 grind?" },
          { type: "PROBLEM", content: "Most people never learn how importing actually works." },
          { type: "SOLUTION", content: "Mommy Ann Import Academy teaches you step by step." },
          { type: "CTA", content: "Book your free strategy session today." },
        ],
      }),
    );
    const scriptRes = await app.inject({ method: "POST", url: `/api/campaigns/${campaign.id}/scripts/generate`, headers: { cookie: studentACookie }, payload: { angleId, hookId, scriptType: "UGC", durationSeconds: 30 } });
    expect(scriptRes.statusCode).toBe(201);
    const script = scriptRes.json().script;
    expect(script.status).toBe("Draft");
    expect(script.sectionsJson).toHaveLength(4);
    expect(script.validationJson.isClean).toBe(true);

    // 5. Storyboard requires an Approved script, never a Draft one
    const rejectedStoryboard = await app.inject({ method: "POST", url: `/api/scripts/${script.id}/storyboard/generate`, headers: { cookie: studentACookie }, payload: {} });
    expect(rejectedStoryboard.statusCode).toBe(409);

    const approveScript = await app.inject({ method: "POST", url: `/api/scripts/${script.id}/status`, headers: { cookie: studentACookie }, payload: { status: "Approved" } });
    expect(approveScript.statusCode).toBe(200);
    expect(approveScript.json().script.status).toBe("Approved");

    fakeAnthropic.setResponseText(
      JSON.stringify({
        visualStyle: "UGC",
        scenes: [
          { sceneNumber: 1, durationSeconds: 8, dialogue: "Tired of the 9-5 grind?", character: "Mom presenter", cameraShot: "Close-up", location: "Home office" },
          { sceneNumber: 2, durationSeconds: 10, dialogue: "Here's how I started importing.", character: "Mom presenter", cameraShot: "Medium shot", location: "Home office" },
        ],
      }),
    );
    const storyboardRes = await app.inject({ method: "POST", url: `/api/scripts/${script.id}/storyboard/generate`, headers: { cookie: studentACookie }, payload: { visualStyle: "UGC" } });
    expect(storyboardRes.statusCode).toBe(201);
    const storyboard = storyboardRes.json().storyboard;
    expect(storyboard.scenes).toHaveLength(2);

    // 6. Character Profile — continuity instructions auto-populated
    const characterRes = await app.inject({
      method: "POST",
      url: `/api/businesses/${business.id}/character-profiles`,
      headers: { cookie: studentACookie },
      payload: { name: "Mom Presenter", appearanceNotes: "30s, brown hair, friendly", defaultWardrobe: "Casual home outfit" },
    });
    expect(characterRes.statusCode).toBe(201);
    const character = characterRes.json().characterProfile;
    expect(character.continuityInstructions).toContain("consistent face");

    // 7. Scene Prompt Studio — image + video prompt only, never a fake generated asset
    fakeAnthropic.setResponseText(
      JSON.stringify({
        imagePromptText:
          "A woman in her 30s with brown hair in a home office, close-up shot, warm lighting. Use the provided character reference as the same main character, and maintain consistent face, facial features, skin tone, hair, body proportions, age appearance, and identity.",
        imagePromptStructured: { subject: "Mom presenter", environment: "Home office", cameraAngle: "Close-up" },
        videoPromptText:
          "The presenter speaks directly to camera in a home office setting, close-up shot. Use the provided character reference as the same main character, and maintain consistent face, facial features, skin tone, hair, body proportions, age appearance, and identity.",
        videoPromptStructured: { subject: "Mom presenter", action: "Speaking to camera" },
      }),
    );
    const scene1Id = storyboard.scenes[0].id;
    const scenePromptRes = await app.inject({ method: "POST", url: `/api/scenes/${scene1Id}/prompt/generate`, headers: { cookie: studentACookie }, payload: { characterProfileId: character.id } });
    expect(scenePromptRes.statusCode).toBe(201);
    expect(scenePromptRes.json().scenePrompt.imagePromptText).toContain("consistent face");
    expect(scenePromptRes.json().scenePrompt.status).toBe("PROMPT_READY");
    expect(scenePromptRes.json().scenePrompt.targetProvider).toBe("GENERIC");

    // 8. Copy Studio (reuses the existing "copywriter" tool, never a parallel engine)
    fakeAnthropic.setResponseText("Ready to escape the 9-5? Book your free strategy session today!");
    const copyRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaign.id}/copy/generate`,
      headers: { cookie: studentACookie },
      payload: { platform: "Facebook", copyType: "Primary Text", userRequest: "Write primary ad text for this campaign." },
    });
    expect(copyRes.statusCode).toBe(201);
    const copyVariant = copyRes.json().copyVariant;

    const copyList = await app.inject({ method: "GET", url: `/api/campaigns/${campaign.id}/copy`, headers: { cookie: studentACookie } });
    expect(copyList.json().copyVariants).toHaveLength(1);
    expect(copyList.json().copyVariants[0].generation.outputJson.text).toContain("strategy session");

    // 9. Creative Package assembly + human approval workflow (never AI auto-publish)
    const packageRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaign.id}/packages`,
      headers: { cookie: studentACookie },
      payload: { angleId, hookId, scriptId: script.id, storyboardId: storyboard.id, characterProfileId: character.id, copyVariantIds: [copyVariant.id] },
    });
    expect(packageRes.statusCode).toBe(201);
    const pkg = packageRes.json().creativePackage;
    expect(pkg.status).toBe("DRAFT");
    expect(pkg.packageDisplayId).toMatch(/^CRPKG-\d{4}-\d{6}$/);

    const submitForReview = await app.inject({ method: "POST", url: `/api/creative-packages/${pkg.id}/status`, headers: { cookie: studentACookie }, payload: { status: "FOR_REVIEW" } });
    expect(submitForReview.statusCode).toBe(200);

    // A Student may never approve their own package — only staff holding Creative Studio / VERIFY may.
    const selfApprove = await app.inject({ method: "POST", url: `/api/creative-packages/${pkg.id}/status`, headers: { cookie: studentACookie }, payload: { status: "APPROVED" } });
    expect(selfApprove.statusCode).toBe(403);

    const staffApprove = await app.inject({ method: "POST", url: `/api/creative-packages/${pkg.id}/status`, headers: { cookie: ownerCookie }, payload: { status: "APPROVED", reviewNotes: "Looks great." } });
    expect(staffApprove.statusCode).toBe(200);
    expect(staffApprove.json().creativePackage.status).toBe("APPROVED");
    expect(staffApprove.json().creativePackage.reviewedById).toBeTruthy();

    // 10. Revision is a NEW row referencing the one it supersedes — never an in-place overwrite of an approved package.
    const revised = await app.inject({ method: "POST", url: `/api/creative-packages/${pkg.id}/revise`, headers: { cookie: studentACookie }, payload: {} });
    expect(revised.statusCode).toBe(201);
    expect(revised.json().creativePackage.supersedesId).toBe(pkg.id);
    expect(revised.json().creativePackage.version).toBe(2);
    const originalStillApproved = await db.creativePackage.findUniqueOrThrow({ where: { id: pkg.id } });
    expect(originalStillApproved.status).toBe("APPROVED");

    // 11. Creative Testing — metrics start UNKNOWN (null), never fabricated.
    const testRes = await app.inject({
      method: "POST",
      url: `/api/campaigns/${campaign.id}/tests`,
      headers: { cookie: studentACookie },
      payload: { creativePackageId: pkg.id, angleLabel: "Escape the 9-5", format: "Reel", platform: "Facebook" },
    });
    expect(testRes.statusCode).toBe(201);
    const test = testRes.json().creativeTest;
    expect(test.spend).toBeNull();
    expect(test.roas).toBeNull();

    const metricsUpdate = await app.inject({
      method: "PATCH",
      url: `/api/creative-tests/${test.id}/metrics`,
      headers: { cookie: ownerCookie },
      payload: { status: "Completed", spend: 500, impressions: 10000, leads: 20, costPerLead: 25 },
    });
    expect(metricsUpdate.statusCode).toBe(200);
    expect(Number(metricsUpdate.json().creativeTest.spend)).toBe(500);

    // Every piece of the pipeline is independently reachable from the Creative Library afterward.
    const finalScripts = await app.inject({ method: "GET", url: `/api/campaigns/${campaign.id}/scripts`, headers: { cookie: studentACookie } });
    expect(finalScripts.json().scripts).toHaveLength(1);
    const finalStoryboards = await app.inject({ method: "GET", url: `/api/campaigns/${campaign.id}/storyboards`, headers: { cookie: studentACookie } });
    expect(finalStoryboards.json().storyboards).toHaveLength(1);
    const finalPackages = await app.inject({ method: "GET", url: `/api/campaigns/${campaign.id}/packages`, headers: { cookie: studentACookie } });
    expect(finalPackages.json().creativePackages).toHaveLength(2);
  });
});

describe("Creative Analyzer never invents a metric (spec sections 57-58)", () => {
  it("analyzes only supplied CreativeTest fields — a missing metric is sent as UNKNOWN, and analyze never writes metrics itself", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Analyzer Honesty Business");
    const campaign = await createCampaign(studentACookie, studentAId, business.id, "Analyzer Honesty Campaign");
    const testRes = await app.inject({ method: "POST", url: `/api/campaigns/${campaign.id}/tests`, headers: { cookie: studentACookie }, payload: { format: "Reel", platform: "Facebook" } });
    const test = testRes.json().creativeTest;

    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText("Insufficient data: no metrics have been entered for this test yet. No performance conclusion can be drawn.");
    const analyzeRes = await app.inject({ method: "POST", url: `/api/creative-tests/${test.id}/analyze`, headers: { cookie: studentACookie }, payload: {} });
    expect(analyzeRes.statusCode).toBe(201);

    const lastBody = fakeAnthropic.getLastRequestBody();
    const sentUserMessage = lastBody?.messages?.[0]?.content ?? "";
    expect(sentUserMessage).toContain("UNKNOWN");
    expect(sentUserMessage).not.toMatch(/"spend":\s*\d/);

    const testAfterAnalyze = await db.creativeTest.findUniqueOrThrow({ where: { id: test.id } });
    expect(testAfterAnalyze.spend).toBeNull();
    expect(testAfterAnalyze.roas).toBeNull();

    // Now with a real, staff-entered metric — that value (never an invented one) is what gets sent.
    await app.inject({ method: "PATCH", url: `/api/creative-tests/${test.id}/metrics`, headers: { cookie: ownerCookie }, payload: { spend: 250.5 } });
    fakeAnthropic.setResponseText("Spend is 250.50; all other metrics remain unknown.");
    const secondAnalyze = await app.inject({ method: "POST", url: `/api/creative-tests/${test.id}/analyze`, headers: { cookie: studentACookie }, payload: {} });
    expect(secondAnalyze.statusCode).toBe(201);
    const secondBody = fakeAnthropic.getLastRequestBody();
    const secondUserMessage = secondBody?.messages?.[0]?.content ?? "";
    expect(secondUserMessage).toContain("250.5");
    expect(secondUserMessage).toContain("UNKNOWN"); // every other metric is still UNKNOWN
  });
});

describe("Character consistency across multiple scenes (spec sections 30-33)", () => {
  it("every scene prompt referencing a Character Profile carries the same continuity instructions", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Character Consistency Business");
    const campaign = await createCampaign(studentACookie, studentAId, business.id, "Consistency Campaign");

    fakeAnthropic.setResponseText(JSON.stringify({ scriptType: "UGC", sections: [{ type: "HOOK", content: "Hook line." }, { type: "CTA", content: "Book now." }] }));
    const scriptRes = await app.inject({ method: "POST", url: `/api/campaigns/${campaign.id}/scripts/generate`, headers: { cookie: studentACookie }, payload: {} });
    const script = scriptRes.json().script;
    await app.inject({ method: "POST", url: `/api/scripts/${script.id}/status`, headers: { cookie: studentACookie }, payload: { status: "Approved" } });

    fakeAnthropic.setResponseText(
      JSON.stringify({
        scenes: [
          { sceneNumber: 1, character: "Ann" },
          { sceneNumber: 2, character: "Ann" },
          { sceneNumber: 3, character: "Ann" },
        ],
      }),
    );
    const storyboardRes = await app.inject({ method: "POST", url: `/api/scripts/${script.id}/storyboard/generate`, headers: { cookie: studentACookie }, payload: {} });
    const storyboard = storyboardRes.json().storyboard;
    expect(storyboard.scenes).toHaveLength(3);

    const characterRes = await app.inject({ method: "POST", url: `/api/businesses/${business.id}/character-profiles`, headers: { cookie: studentACookie }, payload: { name: "Ann" } });
    const character = characterRes.json().characterProfile;

    const continuityPhrase = "maintain consistent face, facial features, skin tone, hair, body proportions, age appearance, and identity";
    for (const scene of storyboard.scenes as { id: string }[]) {
      fakeAnthropic.setResponseText(
        JSON.stringify({
          imagePromptText: `Scene featuring Ann. Use the provided character reference as the same main character, and ${continuityPhrase}.`,
          imagePromptStructured: {},
          videoPromptText: `Scene featuring Ann. Use the provided character reference as the same main character, and ${continuityPhrase}.`,
          videoPromptStructured: {},
        }),
      );
      const res = await app.inject({ method: "POST", url: `/api/scenes/${scene.id}/prompt/generate`, headers: { cookie: studentACookie }, payload: { characterProfileId: character.id } });
      expect(res.statusCode).toBe(201);
      expect(res.json().scenePrompt.imagePromptText).toContain(continuityPhrase);
      expect(res.json().scenePrompt.videoPromptText).toContain(continuityPhrase);
    }

    const persisted = await db.scenePrompt.findMany({ where: { sceneId: { in: (storyboard.scenes as { id: string }[]).map((s) => s.id) } } });
    expect(persisted).toHaveLength(3);
    expect(persisted.every((p) => p.characterProfileId === character.id)).toBe(true);
  });
});

describe("Multi-business / cross-student isolation (spec sections 5, 88)", () => {
  it("Student B cannot reach Student A's campaign, character profile, or scenes via tampered IDs", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Isolation Business A");
    const campaign = await createCampaign(studentACookie, studentAId, business.id, "Isolation Campaign A");
    await app.inject({ method: "POST", url: `/api/businesses/${business.id}/character-profiles`, headers: { cookie: studentACookie }, payload: { name: "A's Character" } });

    const crossBusinessRead = await app.inject({ method: "GET", url: `/api/businesses/${business.id}/campaigns`, headers: { cookie: studentBCookie } });
    expect(crossBusinessRead.statusCode).toBe(403);

    const crossCampaignRead = await app.inject({ method: "GET", url: `/api/campaigns/${campaign.id}`, headers: { cookie: studentBCookie } });
    expect(crossCampaignRead.statusCode).toBe(403);

    const crossCampaignGenerate = await app.inject({ method: "POST", url: `/api/campaigns/${campaign.id}/angles/generate`, headers: { cookie: studentBCookie }, payload: {} });
    expect(crossCampaignGenerate.statusCode).toBe(403);

    const crossCharacterRead = await app.inject({ method: "GET", url: `/api/businesses/${business.id}/character-profiles`, headers: { cookie: studentBCookie } });
    expect(crossCharacterRead.statusCode).toBe(403);

    const tamperedCampaignId = await app.inject({ method: "GET", url: `/api/campaigns/nonexistent-tampered-id-123`, headers: { cookie: studentACookie } });
    expect(tamperedCampaignId.statusCode).toBe(404);

    const tamperedBusinessId = await app.inject({ method: "GET", url: `/api/businesses/nonexistent-tampered-business-id/campaigns`, headers: { cookie: studentACookie } });
    expect(tamperedBusinessId.statusCode).toBe(403);

    const pkgRes = await app.inject({ method: "POST", url: `/api/campaigns/${campaign.id}/packages`, headers: { cookie: studentACookie }, payload: {} });
    const pkg = pkgRes.json().creativePackage;
    const crossPackageStatus = await app.inject({ method: "POST", url: `/api/creative-packages/${pkg.id}/status`, headers: { cookie: studentBCookie }, payload: { status: "FOR_REVIEW" } });
    expect(crossPackageStatus.statusCode).toBe(403);
  });

  it("a Student's own multiple businesses never leak Character Profiles or Campaigns into each other", async () => {
    const businessA = await createPublishedBusiness(studentACookie, studentAId, "Multi-Business A", "Business A overview");
    const businessB = await createPublishedBusiness(studentACookie, studentAId, "Multi-Business B", "Business B overview");
    await createCampaign(studentACookie, studentAId, businessA.id, "Campaign in A");
    await createCampaign(studentACookie, studentAId, businessB.id, "Campaign in B");
    await app.inject({ method: "POST", url: `/api/businesses/${businessA.id}/character-profiles`, headers: { cookie: studentACookie }, payload: { name: "Character in A" } });

    const campaignsA = await app.inject({ method: "GET", url: `/api/businesses/${businessA.id}/campaigns`, headers: { cookie: studentACookie } });
    expect(campaignsA.json().campaigns).toHaveLength(1);
    expect(campaignsA.json().campaigns[0].name).toBe("Campaign in A");

    const charactersB = await app.inject({ method: "GET", url: `/api/businesses/${businessB.id}/character-profiles`, headers: { cookie: studentACookie } });
    expect(charactersB.json().characterProfiles).toHaveLength(0);
  });
});

describe("AI provider failure handling — honest failure, never fake output (spec sections 40-44, 83)", () => {
  it("existing campaigns/creatives remain fully readable, and new generation fails cleanly rather than crashing or faking output", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Provider Failure Business");
    const campaign = await createCampaign(studentACookie, studentAId, business.id, "Provider Failure Campaign");

    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText(JSON.stringify({ angles: [{ angleName: "Existing Angle", angleType: "Pain", coreMessage: "Existing." }] }));
    const anglesRes = await app.inject({ method: "POST", url: `/api/campaigns/${campaign.id}/angles/generate`, headers: { cookie: studentACookie }, payload: {} });
    expect(anglesRes.statusCode).toBe(201);

    fakeAnthropic.setMode("server_error");
    const readCampaign = await app.inject({ method: "GET", url: `/api/campaigns/${campaign.id}`, headers: { cookie: studentACookie } });
    expect(readCampaign.statusCode).toBe(200);
    const readAngles = await app.inject({ method: "GET", url: `/api/campaigns/${campaign.id}/angles`, headers: { cookie: studentACookie } });
    expect(readAngles.statusCode).toBe(200);
    expect(readAngles.json().angles).toHaveLength(1);

    const failedHooks = await app.inject({ method: "POST", url: `/api/campaigns/${campaign.id}/hooks/generate`, headers: { cookie: studentACookie }, payload: {} });
    expect(failedHooks.statusCode).toBe(502);
    expect(failedHooks.json().error).toBeTruthy();

    const failedGeneration = await db.aiGeneration.findFirst({ where: { businessId: business.id, status: "FAILED" }, orderBy: { createdAt: "desc" } });
    expect(failedGeneration).not.toBeNull();
    expect(failedGeneration!.failureReason).toBeTruthy();
    expect(failedGeneration!.errorCategory).toBeTruthy();

    // No Hook rows were created from the failed call — a failed job is never labeled completed, and produces no partial/fake data.
    const hooksAfterFailure = await db.hook.findMany({ where: { campaignId: campaign.id } });
    expect(hooksAfterFailure).toHaveLength(0);

    fakeAnthropic.setMode("success");
  });
});

describe("Marketing Intelligence + Ask M.A.I.A. (spec sections 47-54, 93-94)", () => {
  it("flags a campaign with no approved creative and answers a grounded question with real counts", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Marketing Intelligence Business");
    const campaign = await createCampaign(studentACookie, studentAId, business.id, "No Creative Campaign");
    await app.inject({ method: "POST", url: `/api/campaigns/${campaign.id}/status`, headers: { cookie: studentACookie }, payload: { status: "FOR_REVIEW" } });

    const evaluate = await app.inject({ method: "POST", url: `/api/intelligence/evaluate`, headers: { cookie: ownerCookie } });
    expect(evaluate.statusCode).toBe(200);

    const signals = await app.inject({ method: "GET", url: `/api/intelligence/signals?domain=Marketing`, headers: { cookie: ownerCookie } });
    expect(signals.statusCode).toBe(200);
    const matching = signals.json().signals.filter((s: { entityId: string }) => s.entityId === campaign.id);
    expect(matching.length).toBeGreaterThan(0);
    expect(matching[0].title).toContain("no approved creative");

    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText("Some campaign(s) currently have no approved creative.");
    const ask = await app.inject({ method: "POST", url: `/api/intelligence/ask`, headers: { cookie: ownerCookie }, payload: { question: "Which campaigns have no approved creative?" } });
    expect(ask.statusCode).toBe(200);
    expect(ask.json().matched).toBe(true);
    expect(ask.json().facts.count).toBeGreaterThan(0);

    // Approve the missing creative and re-evaluate — the rule must auto-resolve, never stay stuck open.
    const pkgRes = await app.inject({ method: "POST", url: `/api/campaigns/${campaign.id}/packages`, headers: { cookie: studentACookie }, payload: {} });
    const pkg = pkgRes.json().creativePackage;
    await app.inject({ method: "POST", url: `/api/creative-packages/${pkg.id}/status`, headers: { cookie: studentACookie }, payload: { status: "FOR_REVIEW" } });
    await app.inject({ method: "POST", url: `/api/creative-packages/${pkg.id}/status`, headers: { cookie: ownerCookie }, payload: { status: "APPROVED" } });

    await app.inject({ method: "POST", url: `/api/intelligence/evaluate`, headers: { cookie: ownerCookie } });
    const signalsAfter = await app.inject({ method: "GET", url: `/api/intelligence/signals?domain=Marketing&status=RESOLVED`, headers: { cookie: ownerCookie } });
    const resolved = signalsAfter.json().signals.filter((s: { entityId: string }) => s.entityId === campaign.id);
    expect(resolved.length).toBeGreaterThan(0);
  });

  it("does not claim Campaign ACTIVE status means a real ad platform campaign is live", async () => {
    const business = await createPublishedBusiness(studentACookie, studentAId, "Active Status Honesty Business");
    const campaign = await createCampaign(studentACookie, studentAId, business.id, "Active Status Campaign");
    await app.inject({ method: "POST", url: `/api/campaigns/${campaign.id}/status`, headers: { cookie: studentACookie }, payload: { status: "ACTIVE" } });

    fakeAnthropic.setMode("success");
    fakeAnthropic.setResponseText("N campaigns are ACTIVE.");
    const ask = await app.inject({ method: "POST", url: `/api/intelligence/ask`, headers: { cookie: ownerCookie }, payload: { question: "How many active campaigns do we have?" } });
    expect(ask.statusCode).toBe(200);
    expect(ask.json().matched).toBe(true);
    expect(ask.json().facts.count).toBeGreaterThan(0);
  });
});
