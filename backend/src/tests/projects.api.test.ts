import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import test, { after, before, beforeEach } from "node:test";
import prisma from "../lib/prisma";
import { createUserAccount, signupAndGetCookie } from "./test-helpers";

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://ContentLane:ContentLane@localhost:5432/ContentLane?schema=public";
process.env.FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? "error";
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? "test-secret-at-least-32-characters-long";
process.env.CLOUDINARY_CLOUD_NAME = "";
process.env.CLOUDINARY_API_KEY = "";
process.env.CLOUDINARY_API_SECRET = "";

let createApp: typeof import("../app.js").createApp;

before(async () => {
  ({ createApp } = await import("../app.js"));
});

const testWebsitePrefix = "https://lean-";

beforeEach(async () => {
  await prisma.project.deleteMany({
    where: { website: { startsWith: testWebsitePrefix } },
  });
  await prisma.allowedEmail.deleteMany({
    where: { email: { startsWith: "project-" } },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: "project-" } },
  });
  await prisma.creator.deleteMany({
    where: { name: { startsWith: "Project Mix Test" } },
  });
});

after(async () => {
  await prisma.creator.deleteMany({
    where: { name: { startsWith: "Project Mix Test" } },
  });
});

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app = createApp();
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function waitForBrandProfile(baseUrl: string, projectId: string, cookie: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/v1/projects/${projectId}`, { headers: { cookie } });
    assert.equal(response.status, 200);
    const payload = (await response.json()) as { project: { brandProfile: unknown } };
    if (payload.project.brandProfile) return payload.project;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail("Project analysis did not complete in time");
}

function buildBrandDemoFormData() {
  const form = new FormData();
  form.append(
    "demo",
    new Blob(["brand demo upload"], { type: "video/mp4" }),
    "brand-demo.mp4",
  );
  return form;
}

test("project lifecycle is authenticated and scoped to the signed-in beta user", async () => {
  await withServer(async (baseUrl) => {
    const ownerCookie = await signupAndGetCookie(baseUrl, {
      email: "project-owner@example.com",
      password: "password123",
      name: "Owner",
    });

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const createResponse = await fetch(`${baseUrl}/api/v1/projects`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ownerCookie },
      body: JSON.stringify({ website: `https://lean-${suffix}.example.com` }),
    });
    assert.equal(createResponse.status, 201);
    const created = (await createResponse.json()) as {
      project: { id: string; brandProfile: unknown };
      job: { id: string };
    };
    assert.ok(created.project.id);
    assert.ok(created.job.id);
    const analyzedProject = await waitForBrandProfile(baseUrl, created.project.id, ownerCookie);
    assert.ok(analyzedProject.brandProfile);

    const preDemoConceptsResponse = await fetch(
      `${baseUrl}/api/v1/projects/${created.project.id}/concepts`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: ownerCookie },
        body: JSON.stringify({ count: 4 }),
      },
    );
    assert.equal(preDemoConceptsResponse.status, 200);
    const automaticallyGenerated = (await preDemoConceptsResponse.json()) as {
      project: {
        concepts: Array<{ id: string }>;
      };
    };
    assert.equal(automaticallyGenerated.project.concepts.length, 4);

    const brandDemoResponse = await fetch(
      `${baseUrl}/api/v1/projects/${created.project.id}/brand-demo`,
      {
        method: "POST",
        headers: { cookie: ownerCookie },
        body: buildBrandDemoFormData(),
      },
    );
    assert.equal(brandDemoResponse.status, 201);

    const brandDemoSnapshot = (await (
      await fetch(`${baseUrl}/api/v1/projects/${created.project.id}`, {
        headers: { cookie: ownerCookie },
      })
    ).json()) as {
      project: {
        concepts: Array<{ id: string }>;
        selectedConceptId: string | null;
        selectedCharacterId: string | null;
        mediaAssets: Array<{
          id: string;
          conceptId: string | null;
          type: "IMAGE" | "VIDEO";
          url: string;
          metadata: { kind?: string; originalName?: string } | null;
        }>;
      };
    };
    assert.equal(brandDemoSnapshot.project.selectedConceptId, null);
    assert.equal(brandDemoSnapshot.project.selectedCharacterId, null);
    assert.equal(brandDemoSnapshot.project.concepts.length, 4);
    assert.equal(brandDemoSnapshot.project.mediaAssets.length, 1);
    assert.equal(
      brandDemoSnapshot.project.mediaAssets[0]?.metadata?.kind,
      "brand-demo",
    );

    const conceptsResponse = await fetch(
      `${baseUrl}/api/v1/projects/${created.project.id}/concepts`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: ownerCookie },
        body: JSON.stringify({ count: 4 }),
      },
    );
    assert.equal(conceptsResponse.status, 200);

    const conceptsProject = (await (
      await fetch(`${baseUrl}/api/v1/projects/${created.project.id}`, {
        headers: { cookie: ownerCookie },
      })
    ).json()) as {
      project: {
        concepts: Array<{ id: string; targetDurationLabel: string }>;
        selectedConceptId: string | null;
      };
    };
    assert.equal(conceptsProject.project.concepts.length, 4);
    assert.equal(
      conceptsProject.project.concepts[0]?.targetDurationLabel,
      "4-5s",
    );

    const selectedConceptId = conceptsProject.project.concepts[0]?.id;
    assert.ok(selectedConceptId);

    const selectionResponse = await fetch(
      `${baseUrl}/api/v1/projects/${created.project.id}/concepts/selection`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: ownerCookie },
        body: JSON.stringify({ conceptId: selectedConceptId }),
      },
    );
    assert.equal(selectionResponse.status, 200);

    const characterResponse = await fetch(
      `${baseUrl}/api/v1/projects/${created.project.id}/character`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: ownerCookie },
        body: JSON.stringify({
          character: {
            id: "creator-test-founder",
            source: "preset",
            name: "Test Founder",
            persona: "Direct founder energy with a concise delivery.",
            appearance:
              "Minimal black tee, clean background, soft studio light.",
            voice: "Confident, practical, fast-paced.",
            prompt: "A direct founder-led creator with a premium clean look.",
          },
        }),
      },
    );
    assert.equal(characterResponse.status, 200);

    const mediaResponse = await fetch(
      `${baseUrl}/api/v1/projects/${created.project.id}/media`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: ownerCookie },
        body: JSON.stringify({
          conceptId: selectedConceptId,
          forceRegenerate: true,
        }),
      },
    );
    assert.equal(mediaResponse.status, 200);

    const snapshot = (await (
      await fetch(`${baseUrl}/api/v1/projects/${created.project.id}`, {
        headers: { cookie: ownerCookie },
      })
    ).json()) as {
      project: {
        selectedConceptId: string | null;
        selectedCharacterId: string | null;
        selectedCharacter: {
          id: string;
          source: "preset" | "custom";
          name: string;
          persona: string;
          appearance: string;
          voice: string;
          prompt: string;
        } | null;
        creatorSelection: {
          mode: "single" | "mix";
          characters: Array<{ id: string; name: string }>;
        } | null;
        concepts: Array<{
          id: string;
          generatedImageUrl: string | null;
          generatedVideoUrl: string | null;
        }>;
        mediaAssets: Array<{
          id: string;
          conceptId: string | null;
          type: "IMAGE" | "VIDEO";
          url: string;
        }>;
        exportState: unknown;
      };
    };
    assert.equal(snapshot.project.selectedConceptId, selectedConceptId);
    assert.equal(snapshot.project.selectedCharacterId, "creator-test-founder");
    assert.equal(snapshot.project.selectedCharacter?.name, "Test Founder");
    assert.equal(snapshot.project.creatorSelection?.mode, "single");
    assert.equal(snapshot.project.creatorSelection?.characters[0]?.id, "creator-test-founder");
    assert.equal(
      snapshot.project.concepts[0]?.generatedImageUrl !== null,
      true,
    );
    assert.equal(
      snapshot.project.concepts[0]?.generatedVideoUrl !== null,
      true,
    );
    assert.equal(snapshot.project.mediaAssets.length, 3);

    const exportResponse = await fetch(
      `${baseUrl}/api/v1/projects/${created.project.id}/export`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: ownerCookie },
        body: JSON.stringify({
          settings: {
            selectedConceptId,
            selectedCharacterId: "creator-test-founder",
            selectedCharacterName: "Test Founder",
            selectedCharacterSource: "preset",
            selectedCreatorClipId: null,
            selectedImageId: null,
            selectedVideoId: null,
            creatorOverlayText: "If askelexy is this that",
            brandDemoOverlayText: "then ASklexy help you do that",
            overlayText: "Publish this",
            notes: "Smoke test",
          },
        }),
      },
    );
    assert.equal(exportResponse.status, 200);

    await Promise.all(["Mia", "Jake"].map((name, index) => prisma.creator.create({
      data: {
        name: `Project Mix Test ${name}`,
        description: `${name} test creator`,
        baseImageUrl: `https://example.com/${name.toLowerCase()}.jpg`,
        baseImageProvider: "test",
        baseImageMimeType: "image/jpeg",
        sortOrder: 10_000 + index,
        clips: {
          create: {
            title: `${name} hook`,
            url: `https://example.com/${name.toLowerCase()}.mp4`,
            provider: "test",
            mimeType: "video/mp4",
            tags: ["founder", "hook"],
            sortOrder: 0,
          },
        },
      },
    })));
    const mixResponse = await fetch(
      `${baseUrl}/api/v1/projects/${created.project.id}/character`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: ownerCookie },
        body: JSON.stringify({ selection: { mode: "mix" } }),
      },
    );
    assert.equal(mixResponse.status, 200);
    const mixed = (await mixResponse.json()) as {
      project: {
        creatorSelection: { mode: "single" | "mix"; characters: Array<{ id: string }> } | null;
        concepts: Array<{ generatedImageUrl: string | null; generatedVideoUrl: string | null }>;
        mediaAssets: Array<{ metadata: { kind?: string } | null }>;
        exportState: unknown;
      };
    };
    assert.equal(mixed.project.creatorSelection?.mode, "mix");
    assert.equal(mixed.project.creatorSelection?.characters.length >= 2, true);
    assert.equal(mixed.project.concepts.length, 4);
    assert.equal(mixed.project.concepts.every((concept) => concept.generatedImageUrl === null && concept.generatedVideoUrl === null), true);
    assert.equal(mixed.project.mediaAssets.every((asset) => asset.metadata?.kind === "brand-demo"), true);
    assert.equal(mixed.project.exportState, null);

    const jobResponse = await fetch(
      `${baseUrl}/api/v1/jobs/${created.job.id}`,
      { headers: { cookie: ownerCookie } },
    );
    assert.equal(jobResponse.status, 200);

    await createUserAccount({
      email: "project-viewer@example.com",
      password: "password123",
      name: "Viewer",
    });
    const viewerCookie = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "project-viewer@example.com",
        password: "password123",
      }),
    }).then(async (response) => {
      assert.equal(response.status, 200);
      return (response.headers.get("set-cookie") ?? "").split(";", 1)[0];
    });

    const forbiddenProjectResponse = await fetch(
      `${baseUrl}/api/v1/projects/${created.project.id}`,
      { headers: { cookie: viewerCookie } },
    );
    assert.equal(forbiddenProjectResponse.status, 404);

    const forbiddenJobResponse = await fetch(
      `${baseUrl}/api/v1/jobs/${created.job.id}`,
      { headers: { cookie: viewerCookie } },
    );
    assert.equal(forbiddenJobResponse.status, 404);
  });
});

test("hook preferences accept a complete review and reject invalid decision sets", async () => {
  await withServer(async (baseUrl) => {
    const cookie = await signupAndGetCookie(baseUrl, {
      email: `project-preferences-${Date.now()}@example.com`,
      password: "password123",
      name: "Hook Reviewer",
    });
    const createProject = async (suffix: string) => {
      const createdResponse = await fetch(`${baseUrl}/api/v1/projects`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ website: `${testWebsitePrefix}${suffix}.example.com` }),
      });
      assert.equal(createdResponse.status, 201);
      const created = (await createdResponse.json()) as { project: { id: string } };
      await waitForBrandProfile(baseUrl, created.project.id, cookie);
      const conceptsResponse = await fetch(`${baseUrl}/api/v1/projects/${created.project.id}/concepts`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ count: 8 }),
      });
      assert.equal(conceptsResponse.status, 200);
      const generated = (await conceptsResponse.json()) as { project: { concepts: Array<{ id: string }> } };
      assert.equal(generated.project.concepts.length, 8);
      return { projectId: created.project.id, conceptIds: generated.project.concepts.map(({ id }) => id) };
    };
    const primary = await createProject(`preferences-${Date.now()}`);
    const foreign = await createProject(`preferences-foreign-${Date.now()}`);
    const preferenceUrl = `${baseUrl}/api/v1/projects/${primary.projectId}/concepts/preferences`;
    const patchPreferences = (body: unknown) => fetch(preferenceUrl, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    });
    const expectError = async (body: unknown, status: number, message: RegExp) => {
      const response = await patchPreferences(body);
      assert.equal(response.status, status);
      const payload = (await response.json()) as { error: { message: string } };
      assert.match(payload.error.message, message);
    };

    const accepted = await patchPreferences({
      likedConceptIds: primary.conceptIds.slice(0, 5),
      rejectedConceptIds: primary.conceptIds.slice(5, 8),
    });
    assert.equal(accepted.status, 200, await accepted.clone().text());
    const acceptedPayload = (await accepted.json()) as {
      project: { hookPreferences: { liked: unknown[]; rejected: unknown[] } };
    };
    assert.equal(acceptedPayload.project.hookPreferences.liked.length, 5);
    assert.equal(acceptedPayload.project.hookPreferences.rejected.length, 3);

    await expectError({ likedConceptIds: [], rejectedConceptIds: [] }, 400, /At least one hook decision/);
    await expectError({ likedConceptIds: [primary.conceptIds[0], primary.conceptIds[0]], rejectedConceptIds: [] }, 400, /cannot be repeated/);
    await expectError({ likedConceptIds: [primary.conceptIds[0]], rejectedConceptIds: [primary.conceptIds[0]] }, 400, /both liked and rejected/);
    await expectError({ likedConceptIds: primary.conceptIds.slice(0, 5), rejectedConceptIds: [...primary.conceptIds.slice(5), foreign.conceptIds[0]] }, 400, /At most eight hook decisions/);
    await expectError({ likedConceptIds: [foreign.conceptIds[0]], rejectedConceptIds: [] }, 404, /do not belong to this project/);

    const legacy = await patchPreferences({ conceptIds: primary.conceptIds.slice(0, 2) });
    assert.equal(legacy.status, 200);
    const legacyPayload = (await legacy.json()) as {
      project: { hookPreferences: { liked: unknown[]; rejected: unknown[] } };
    };
    assert.equal(legacyPayload.project.hookPreferences.liked.length, 2);
    assert.equal(legacyPayload.project.hookPreferences.rejected.length, 0);

    const reviewUrl = `${baseUrl}/api/v1/projects/${primary.projectId}/concepts/${primary.conceptIds[0]}/review`;
    const review = await fetch(reviewUrl, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ decision: "LIKED" }),
    });
    assert.equal(review.status, 200);
    const reviewed = (await review.json()) as { project: { concepts: Array<{ id: string; reviewDecision: string | null }> } };
    assert.equal(reviewed.project.concepts.find(({ id }) => id === primary.conceptIds[0])?.reviewDecision, "LIKED");

    const changedDecision = await fetch(reviewUrl, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ decision: "REJECTED" }),
    });
    assert.equal(changedDecision.status, 409);

    const foreignReview = await fetch(`${baseUrl}/api/v1/projects/${primary.projectId}/concepts/${foreign.conceptIds[0]}/review`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ decision: "LIKED" }),
    });
    assert.equal(foreignReview.status, 404);

    const reset = await fetch(`${baseUrl}/api/v1/projects/${primary.projectId}/concepts/review/reset`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({}),
    });
    assert.equal(reset.status, 200);
    const resetPayload = (await reset.json()) as { project: { concepts: Array<{ reviewDecision: string | null }> } };
    assert.equal(resetPayload.project.concepts.every(({ reviewDecision }) => reviewDecision === null), true);
  });
});

test("hook batches prefetch after five selections and stop at 24 hooks", async () => {
  await withServer(async (baseUrl) => {
    const cookie = await signupAndGetCookie(baseUrl, {
      email: `project-prefetch-${Date.now()}@example.com`,
      password: "password123",
      name: "Hook Prefetch Reviewer",
    });
    const createdResponse = await fetch(`${baseUrl}/api/v1/projects`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ website: `${testWebsitePrefix}prefetch-${Date.now()}.example.com` }),
    });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()) as { project: { id: string } };
    await waitForBrandProfile(baseUrl, created.project.id, cookie);

    const conceptsUrl = `${baseUrl}/api/v1/projects/${created.project.id}/concepts`;
    const generate = (append = false) => fetch(conceptsUrl, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ count: 8, append }),
    });
    const review = (conceptId: string, decision: "LIKED" | "REJECTED") => fetch(
      `${conceptsUrl}/${conceptId}/review`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ decision }),
      },
    );

    const initialResponse = await generate();
    assert.equal(initialResponse.status, 200);
    const initial = (await initialResponse.json()) as { project: { concepts: Array<{ id: string }> } };
    assert.equal(initial.project.concepts.length, 8);

    const earlyAppend = await generate(true);
    assert.equal(earlyAppend.status, 200);
    const early = (await earlyAppend.json()) as { project: { concepts: Array<{ id: string }> } };
    assert.equal(early.project.concepts.length, 16);

    for (const concept of initial.project.concepts.slice(0, 5)) {
      const response = await review(concept.id, "LIKED");
      assert.equal(response.status, 200);
    }

    const prefetchedResponse = await generate(true);
    assert.equal(prefetchedResponse.status, 200);
    const prefetched = (await prefetchedResponse.json()) as { project: { concepts: Array<{ id: string; reviewDecision: string | null }> } };
    assert.equal(prefetched.project.concepts.length, 24);

    const unreviewed = prefetched.project.concepts.filter((concept) => concept.reviewDecision === null);
    for (const concept of unreviewed.slice(0, 8)) {
      const response = await review(concept.id, "REJECTED");
      assert.equal(response.status, 200);
    }

    const finalBatchResponse = await generate(true);
    assert.equal(finalBatchResponse.status, 200);
    const finalBatch = (await finalBatchResponse.json()) as { project: { concepts: Array<{ id: string }> } };
    assert.equal(finalBatch.project.concepts.length, 32);

    const overLimitResponse = await generate(true);
    assert.equal(overLimitResponse.status, 200);
    const nextBatch = (await overLimitResponse.json()) as { project: { concepts: Array<{ id: string }> } };
    assert.equal(nextBatch.project.concepts.length, 40);
  });
});

test("project routes reject anonymous requests", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ website: "https://lean-anon.example.com" }),
    });
    assert.equal(response.status, 401);
  });
});
