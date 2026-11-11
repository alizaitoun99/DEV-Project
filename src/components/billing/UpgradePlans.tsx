"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { freeFeatures, proFeatures } from "@/components/billing/plan-features";
import { useBillingRedirect } from "@/components/billing/useBillingRedirect";
import { Button } from "@/components/ui/button";
import type { BillingInterval } from "@/lib/billing/stripe";

const billingOptions = [
  { interval: "monthly", label: "Monthly", price: "$8 / month" },
  { interval: "yearly", label: "Yearly", price: "$72 / year" },
] as const;

interface UpgradePlansProps {
  initialInterval: BillingInterval;
  canCheckout: boolean;
}

function PlanFeatures({ features }: { features: string[] }) {
  return (
    <ul className="space-y-3 text-sm text-muted-foreground">
      {features.map((feature) => (
        <li key={feature} className="flex items-start gap-2">
          <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
          {feature}
        </li>
      ))}
    </ul>
  );
}

export function UpgradePlans({ initialInterval, canCheckout }: UpgradePlansProps) {
  const [interval, setInterval] = useState(initialInterval);
  const { busy, error, openBilling } = useBillingRedirect();

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="space-y-5 rounded-2xl border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold">Free</h2>
          <span className="text-sm text-muted-foreground">Current plan</span>
        </div>
        <p className="text-3xl font-semibold">$0 <span className="text-sm font-normal text-muted-foreground">/ forever</span></p>
        <PlanFeatures features={freeFeatures} />
      </section>
      <section className="space-y-5 rounded-2xl border border-blue-500/50 bg-card p-5 sm:p-6">
        <h2 className="text-2xl font-semibold">Pro</h2>
        <PlanFeatures features={proFeatures} />
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault();
          if (canCheckout && !busy) void openBilling({ action: "checkout", interval });
        }}>
          <fieldset disabled={busy} className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Billing period</legend>
            {billingOptions.map((option) => (
              <label key={option.interval} className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm has-checked:border-blue-500">
                <input type="radio" name="interval" value={option.interval} checked={interval === option.interval} onChange={() => setInterval(option.interval)} />
                <span>{option.label}</span>
                <span className="ml-auto font-medium">{option.price}</span>
                {option.interval === "yearly" && <span className="text-xs text-blue-700 dark:text-blue-300">Save 25%</span>}
              </label>
            ))}
          </fieldset>
          <Button type="submit" className="w-full" disabled={!canCheckout || busy}>{busy ? "Opening checkout…" : "Upgrade to Pro"}</Button>
          {!canCheckout && <p className="text-sm text-muted-foreground">Checkout is currently unavailable.</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </form>
      </section>
    </div>
  );
}
