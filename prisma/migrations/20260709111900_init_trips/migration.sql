-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DISCARDED');

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "traccarDeviceId" INTEGER NOT NULL,
    "startedByUserId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "distanceMeters" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastComputedFixTime" TIMESTAMP(3),
    "lastAcceptedLat" DOUBLE PRECISION,
    "lastAcceptedLon" DOUBLE PRECISION,
    "invalidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Trip_traccarDeviceId_status_idx" ON "Trip"("traccarDeviceId", "status");

-- CreateIndex
CREATE INDEX "Trip_startedAt_idx" ON "Trip"("startedAt");
