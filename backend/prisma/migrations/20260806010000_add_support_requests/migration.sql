CREATE TYPE "SupportRequestStatus" AS ENUM ('NEW', 'OPEN', 'RESOLVED');

CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportRequest_status_createdAt_idx" ON "SupportRequest"("status", "createdAt");
CREATE INDEX "SupportRequest_email_idx" ON "SupportRequest"("email");
CREATE INDEX "SupportRequest_userId_idx" ON "SupportRequest"("userId");
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
