-- Persist the campaign's single-creator or mixed creator roster.
ALTER TABLE "Project"
ADD COLUMN "creatorSelection" JSONB;
