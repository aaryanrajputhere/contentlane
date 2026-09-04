CREATE TABLE "ComplimentaryAccess" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "reason" TEXT,
  "grantedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplimentaryAccess_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ComplimentaryAccess_planId_check" CHECK ("planId" IN ('starter', 'pro'))
);

CREATE UNIQUE INDEX "ComplimentaryAccess_userId_key" ON "ComplimentaryAccess"("userId");
CREATE INDEX "ComplimentaryAccess_startsAt_expiresAt_revokedAt_idx" ON "ComplimentaryAccess"("startsAt", "expiresAt", "revokedAt");
ALTER TABLE "ComplimentaryAccess" ADD CONSTRAINT "ComplimentaryAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComplimentaryAccess" ADD CONSTRAINT "ComplimentaryAccess_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
