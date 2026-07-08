CREATE TABLE "WebsiteAnalysis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "rootDomain" TEXT NOT NULL,
    "discoveredUrls" JSONB NOT NULL,
    "rankedPages" JSONB NOT NULL,
    "selectedPages" JSONB NOT NULL,
    "crawlSummary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebsiteAnalysis_projectId_key" ON "WebsiteAnalysis"("projectId");

ALTER TABLE "WebsiteAnalysis" ADD CONSTRAINT "WebsiteAnalysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
