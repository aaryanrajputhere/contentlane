CREATE TABLE "HookTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "templateType" TEXT NOT NULL,
    "sceneDurationSeconds" INTEGER NOT NULL DEFAULT 2,
    "scenes" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HookTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HookTemplate_isActive_sortOrder_idx" ON "HookTemplate"("isActive", "sortOrder");
CREATE INDEX "HookTemplate_sortOrder_idx" ON "HookTemplate"("sortOrder");
