BEGIN;

ALTER TABLE "User" ADD COLUMN "billingRevision" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "StripeWebhookReceipt" (
    "eventId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeWebhookReceipt_pkey" PRIMARY KEY ("eventId")
);

CREATE TABLE "StripeCheckoutAttempt" (
    "userId" TEXT NOT NULL,
    "priceId" TEXT NOT NULL,
    "customerIdempotencyKey" TEXT NOT NULL,
    "sessionIdempotencyKey" TEXT NOT NULL,
    "customerParams" JSONB,
    "sessionParams" JSONB,
    "stripeCustomerId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeCheckoutAttempt_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX "StripeCheckoutAttempt_customerIdempotencyKey_key" ON "StripeCheckoutAttempt"("customerIdempotencyKey");
CREATE UNIQUE INDEX "StripeCheckoutAttempt_sessionIdempotencyKey_key" ON "StripeCheckoutAttempt"("sessionIdempotencyKey");
CREATE UNIQUE INDEX "StripeCheckoutAttempt_stripeCheckoutSessionId_key" ON "StripeCheckoutAttempt"("stripeCheckoutSessionId");

ALTER TABLE "StripeCheckoutAttempt" ADD CONSTRAINT "StripeCheckoutAttempt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
