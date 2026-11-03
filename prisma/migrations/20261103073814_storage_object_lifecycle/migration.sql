-- CreateTable
CREATE TABLE "StorageObject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "itemId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "retryAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StorageObject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StorageObject_key_key" ON "StorageObject"("key");

-- CreateIndex
CREATE UNIQUE INDEX "StorageObject_itemId_key" ON "StorageObject"("itemId");

-- CreateIndex
CREATE INDEX "StorageObject_state_retryAt_idx" ON "StorageObject"("state", "retryAt");

-- CreateIndex
CREATE INDEX "StorageObject_userId_idx" ON "StorageObject"("userId");
