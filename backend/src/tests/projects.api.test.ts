import assert from "node:assert/strict";
import { AddressInfo } from "node:net";
import test, { before, beforeEach } from "node:test";
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
    assert.ok(created.project.brandProfile);
    assert.ok(created.job.id);

    const preDemoConceptsResponse = await fetch(
      `${baseUrl}/api/v1/projects/${created.project.id}/concepts`,
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: ownerCookie },
        body: JSON.stringify({ count: 4 }),
      },
    );
    assert.equal(preDemoConceptsResponse.status, 200);

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
