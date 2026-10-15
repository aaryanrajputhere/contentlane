ALTER TABLE "RenderUsageReservation" DROP CONSTRAINT "RenderUsageReservation_generationJobId_fkey";
ALTER TABLE "RenderUsageReservation" ALTER COLUMN "generationJobId" DROP NOT NULL;
ALTER TABLE "RenderUsageReservation" ADD CONSTRAINT "RenderUsageReservation_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "GenerationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
