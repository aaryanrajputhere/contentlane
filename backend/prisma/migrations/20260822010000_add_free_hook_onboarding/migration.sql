ALTER TABLE "User"
ADD COLUMN "freeHookLimit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "freeAccessEndedAt" TIMESTAMP(3);

ALTER TABLE "Project" ADD COLUMN "freeOnboardingOwnerId" TEXT;

CREATE UNIQUE INDEX "Project_freeOnboardingOwnerId_key"
ON "Project"("freeOnboardingOwnerId");

ALTER TABLE "Project"
ADD CONSTRAINT "Project_freeOnboardingOwnerId_fkey"
FOREIGN KEY ("freeOnboardingOwnerId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing accounts intentionally retain a zero allowance. Prisma creates new
-- accounts with the schema default after this migration is deployed.
ALTER TABLE "User" ALTER COLUMN "freeHookLimit" SET DEFAULT 24;
