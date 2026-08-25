CREATE TYPE "RenderUsageStatus" AS ENUM ('RESERVED', 'CONSUMED', 'RELEASED');

ALTER TABLE "Subscription" ADD COLUMN "scheduledDodoProductId" TEXT;

CREATE TABLE "RenderUsageReservation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "generationJobId" TEXT NOT NULL,
    "billingPeriodStart" TIMESTAMP(3) NOT NULL,
    "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "requestedCount" INTEGER NOT NULL,
    "consumedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "RenderUsageStatus" NOT NULL DEFAULT 'RESERVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RenderUsageReservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RenderUsageReservation_generationJobId_key" ON "RenderUsageReservation"("generationJobId");
CREATE INDEX "RenderUsageReservation_userId_billingPeriodStart_billingPeriodEnd_status_idx" ON "RenderUsageReservation"("userId", "billingPeriodStart", "billingPeriodEnd", "status");

ALTER TABLE "RenderUsageReservation" ADD CONSTRAINT "RenderUsageReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RenderUsageReservation" ADD CONSTRAINT "RenderUsageReservation_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "GenerationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
