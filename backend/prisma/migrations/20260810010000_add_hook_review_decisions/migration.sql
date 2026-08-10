CREATE TYPE "ReviewDecision" AS ENUM ('LIKED', 'REJECTED');

ALTER TABLE "HookDraft" ADD COLUMN "reviewDecision" "ReviewDecision";

CREATE INDEX "HookDraft_projectId_reviewDecision_sortOrder_idx"
ON "HookDraft"("projectId", "reviewDecision", "sortOrder");
