ALTER TABLE "Project" ADD COLUMN "selectedHookId" TEXT;
CREATE INDEX "Project_selectedHookId_idx" ON "Project"("selectedHookId");
ALTER TABLE "Project" ADD CONSTRAINT "Project_selectedHookId_fkey" FOREIGN KEY ("selectedHookId") REFERENCES "HookDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
