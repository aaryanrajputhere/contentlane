-- Retarget the media asset foreign key so concept-linked assets resolve through HookDraft/HookConcept.
ALTER TABLE "MediaAsset" DROP CONSTRAINT IF EXISTS "MediaAsset_scriptDraftId_fkey";
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_scriptDraftId_fkey" FOREIGN KEY ("scriptDraftId") REFERENCES "HookDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
