import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createAnalysisJsonRecorder } from "../lib/analysis-json";

const run = {
  website: "https://www.OurForeverPage.com/path",
  projectId: "project_123",
  analysisJobId: "job_456",
  startedAt: new Date("2026-08-04T12:34:56.789Z"),
};

test("analysis JSON recorder creates domain-scoped, addressable artifacts", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "contentlane-analysis-json-"));
  try {
    const recorder = createAnalysisJsonRecorder(run, outputRoot);
    const filePath = await recorder.write("Brand Profile", {
      brandName: "Our Forever Page",
      value: 10n,
    });

    assert.ok(filePath);
    assert.equal(path.dirname(filePath), path.join(outputRoot, "ourforeverpage-com"));
    assert.equal(
      path.basename(filePath),
      "2026-08-04T12-34-56-789Z_project-123_job-456_brand-profile.json",
    );
    assert.deepEqual(JSON.parse(await readFile(filePath, "utf8")), {
      brandName: "Our Forever Page",
      value: "10",
    });
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test("analysis JSON recorder preserves separate runs and sanitizes artifact names", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "contentlane-analysis-json-"));
  try {
    const first = createAnalysisJsonRecorder(run, outputRoot);
    const second = createAnalysisJsonRecorder({
      ...run,
      analysisJobId: "job_789",
      startedAt: new Date("2026-08-04T13:00:00.000Z"),
    }, outputRoot);

    await first.write("../../hooks attempt 1", { hooks: ["first"] });
    await second.write("../../hooks attempt 1", { hooks: ["second"] });

    const files = await readdir(path.join(outputRoot, "ourforeverpage-com"));
    assert.equal(files.length, 2);
    assert.equal(files.every((file) => file.endsWith("_hooks-attempt-1.json")), true);
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test("analysis JSON write failures do not fail the generation flow", async () => {
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), "contentlane-analysis-json-"));
  try {
    const blockedPath = path.join(outputRoot, "blocked");
    await writeFile(blockedPath, "not a directory", "utf8");
    const recorder = createAnalysisJsonRecorder(run, blockedPath);
    assert.equal(await recorder.write("brand-profile", { ok: true }), null);
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});
