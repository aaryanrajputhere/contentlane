/*
  Warnings:

  - You are about to drop the column `angles` on the `BrandProfile` table. All the data in the column will be lost.
  - You are about to drop the column `benefits` on the `BrandProfile` table. All the data in the column will be lost.
  - You are about to drop the column `offer` on the `BrandProfile` table. All the data in the column will be lost.
  - You are about to drop the column `painPoints` on the `BrandProfile` table. All the data in the column will be lost.
  - You are about to drop the column `tagline` on the `BrandProfile` table. All the data in the column will be lost.
  - You are about to drop the column `voice` on the `BrandProfile` table. All the data in the column will be lost.
  - You are about to drop the `ScriptDraft` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `audienceIdentity` to the `BrandProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `audienceStage` to the `BrandProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `product` to the `BrandProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `transformation` to the `BrandProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uniqueMechanism` to the `BrandProfile` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ScriptDraft" DROP CONSTRAINT "ScriptDraft_hookDraftId_fkey";

-- DropForeignKey
ALTER TABLE "ScriptDraft" DROP CONSTRAINT "ScriptDraft_projectId_fkey";

-- DropIndex
DROP INDEX "Project_selectedHookId_idx";

-- AlterTable
ALTER TABLE "BrandProfile" DROP COLUMN "angles",
DROP COLUMN "benefits",
DROP COLUMN "offer",
DROP COLUMN "painPoints",
DROP COLUMN "tagline",
DROP COLUMN "voice",
ADD COLUMN     "audienceIdentity" TEXT NOT NULL,
ADD COLUMN     "audienceStage" TEXT NOT NULL,
ADD COLUMN     "campaignStrategy" JSONB,
ADD COLUMN     "conversationStarters" TEXT[],
ADD COLUMN     "dailyMoments" TEXT[],
ADD COLUMN     "dreamOutcomes" TEXT[],
ADD COLUMN     "emotionalDrivers" TEXT[],
ADD COLUMN     "emotionalLanguage" TEXT[],
ADD COLUMN     "fears" TEXT[],
ADD COLUMN     "forbiddenClaims" TEXT[],
ADD COLUMN     "misconceptions" TEXT[],
ADD COLUMN     "objections" TEXT[],
ADD COLUMN     "product" TEXT NOT NULL,
ADD COLUMN     "proofPoints" TEXT[],
ADD COLUMN     "realThoughts" TEXT[],
ADD COLUMN     "socialProofMoments" TEXT[],
ADD COLUMN     "testimonials" TEXT[],
ADD COLUMN     "transformation" TEXT NOT NULL,
ADD COLUMN     "ugcScenarios" TEXT[],
ADD COLUMN     "uniqueMechanism" TEXT NOT NULL,
ADD COLUMN     "viralTriggers" TEXT[];

-- AlterTable
ALTER TABLE "HookDraft" ALTER COLUMN "targetDurationSeconds" DROP DEFAULT,
ALTER COLUMN "score" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropTable
DROP TABLE "ScriptDraft";
