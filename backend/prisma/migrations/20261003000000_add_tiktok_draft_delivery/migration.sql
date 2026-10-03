CREATE TYPE "SocialPublicationDeliveryMode" AS ENUM ('DIRECT', 'TIKTOK_DRAFT');

ALTER TYPE "SocialPublicationStatus" ADD VALUE 'DELIVERED_TO_TIKTOK';

ALTER TABLE "SocialPublication"
ADD COLUMN "deliveryMode" "SocialPublicationDeliveryMode" NOT NULL DEFAULT 'DIRECT',
ADD COLUMN "deliveredAt" TIMESTAMP(3);
