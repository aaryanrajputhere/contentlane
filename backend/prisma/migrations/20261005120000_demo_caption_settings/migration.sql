BEGIN;
ALTER TABLE "Project" ADD COLUMN "brandDemoCaptionsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "HookDraft" ADD COLUMN "demoCaptionsEnabled" BOOLEAN;
COMMIT;
