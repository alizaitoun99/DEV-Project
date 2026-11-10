import "server-only";

import Stripe from "stripe";

export type BillingInterval = "monthly" | "yearly";

let stripe: Stripe | undefined;
const secretKeyPattern = /^(?:sk|rk)_(?:test|live)_[A-Za-z0-9]+$/;

function readSetting(name: string, pattern: RegExp): string {
  const value = process.env[name];
  if (!value || !pattern.test(value)) {
    throw new Error(`Missing or invalid billing setting: ${name}`);
  }
  return value;
}

export function getStripeClient(): Stripe {
  stripe ??= new Stripe(readSetting("STRIPE_SECRET_KEY", secretKeyPattern));
  return stripe;
}

export function isStripeLiveMode(): boolean {
  return readSetting("STRIPE_SECRET_KEY", secretKeyPattern).includes("_live_");
}

export function isCheckoutAvailable(): boolean {
  try {
    getBillingOrigin();
    getStripePriceId("monthly");
    return !isStripeLiveMode() || process.env.STRIPE_LIVE_CHECKOUT_ENABLED === "true";
  } catch {
    return false;
  }
}

export function getStripeWebhookSecret(): string {
  return readSetting("STRIPE_WEBHOOK_SECRET", /^whsec_[A-Za-z0-9]+$/);
}

export function getStripePriceId(interval: BillingInterval): string {
  if (interval !== "monthly" && interval !== "yearly") {
    throw new Error("Invalid billing interval");
  }

  const monthly = readSetting("STRIPE_PRICE_MONTHLY_ID", /^price_[A-Za-z0-9]+$/);
  const yearly = readSetting("STRIPE_PRICE_YEARLY_ID", /^price_[A-Za-z0-9]+$/);
  if (monthly === yearly) {
    throw new Error("Stripe monthly and yearly prices must be distinct");
  }

  return interval === "monthly" ? monthly : yearly;
}

export function getBillingOrigin(): string {
  const configured = process.env.APP_URL || process.env.AUTH_URL;
  const url = configured ? URL.parse(configured) : null;
  if (url && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash) {
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol === "https:" || (loopback && url.protocol === "http:")) {
      return url.origin;
    }
  }
  throw new Error("Set APP_URL or AUTH_URL to a valid billing origin");
}
