/*
  Warnings:

  - You are about to drop the column `gaApiKey` on the `AnalyticsConfig` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "AnalyticsConfig" DROP COLUMN "gaApiKey";
