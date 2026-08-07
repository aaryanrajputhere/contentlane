ALTER TABLE "User" ADD COLUMN "dodoCustomerId" TEXT;

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dodoCustomerId" TEXT NOT NULL,
    "dodoSubscriptionId" TEXT NOT NULL,
    "dodoProductId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtNextBillingDate" BOOLEAN NOT NULL DEFAULT false,
    "latestProviderEventAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DodoWebhookEvent" (
    "webhookId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DodoWebhookEvent_pkey" PRIMARY KEY ("webhookId")
);

CREATE UNIQUE INDEX "User_dodoCustomerId_key" ON "User"("dodoCustomerId");
CREATE UNIQUE INDEX "Subscription_dodoSubscriptionId_key" ON "Subscription"("dodoSubscriptionId");
CREATE INDEX "Subscription_userId_dodoProductId_status_idx" ON "Subscription"("userId", "dodoProductId", "status");
CREATE INDEX "Subscription_dodoCustomerId_idx" ON "Subscription"("dodoCustomerId");
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
