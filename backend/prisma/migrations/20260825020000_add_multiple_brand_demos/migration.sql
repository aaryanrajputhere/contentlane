ALTER TABLE "Project" ADD COLUMN "defaultBrandDemoAssetId" TEXT;
ALTER TABLE "HookDraft" ADD COLUMN "assignedBrandDemoAssetId" TEXT;

CREATE INDEX "HookDraft_projectId_assignedBrandDemoAssetId_idx"
ON "HookDraft"("projectId", "assignedBrandDemoAssetId");

UPDATE "Project" p
SET "defaultBrandDemoAssetId" = (
  SELECT a."id"
  FROM "MediaAsset" a
  WHERE a."projectId" = p."id"
    AND a."scriptDraftId" IS NULL
    AND a."type" = 'VIDEO'
    AND a."metadata"->>'kind' = 'brand-demo'
  ORDER BY a."createdAt" ASC
  LIMIT 1
);
