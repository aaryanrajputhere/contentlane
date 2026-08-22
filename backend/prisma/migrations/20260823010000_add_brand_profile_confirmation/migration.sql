ALTER TABLE "Project" ADD COLUMN "brandProfileConfirmedAt" TIMESTAMP(3);

-- Existing projects have already progressed without this confirmation step.
UPDATE "Project" p
SET "brandProfileConfirmedAt" = COALESCE(p."updatedAt", NOW())
WHERE EXISTS (
  SELECT 1 FROM "BrandProfile" b WHERE b."projectId" = p."id"
);
