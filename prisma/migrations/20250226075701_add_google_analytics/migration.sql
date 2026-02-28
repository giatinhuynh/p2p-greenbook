-- AlterTable
ALTER TABLE "AnalyticsConfig" ADD COLUMN     "gaApiKey" TEXT,
ADD COLUMN     "gaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gaPropertyId" TEXT,
ADD COLUMN     "posthogApiKey" TEXT;
