"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlanBadge } from "@/components/billing/PlanBadge";
import { Button } from "@/components/ui/button";
import { useBillingRedirect } from "@/components/billing/useBillingRedirect";
import type { Plan } from "@/generated/prisma/enums";

type Interval = "monthly" | "yearly";
export type CheckoutStatus = "canceled" | "pending" | "confirmed" | "failed";

const checkoutMessages: Record<CheckoutStatus, string> = {
  canceled: "Checkout was canceled.",
  pending: "Waiting for Stripe to confirm your subscription.",
  confirmed: "Your Pro subscription is confirmed.",
  failed: "We couldn’t verify this Checkout return. Check your plan or try again.",
};

interface BillingPanelProps {
  plan: Plan;
  interval: Interval;
  status: string | null;
  cancelDate: string | null;
  checkoutStatus?: CheckoutStatus;
  canManage: boolean;
}

export function BillingPanel({ plan, interval, status, cancelDate, checkoutStatus, canManage }: BillingPanelProps) {
  const router = useRouter();
  const [refreshes, setRefreshes] = useState(0);
  const { busy, error, openBilling } = useBillingRedirect();

  useEffect(() => {
    if (checkoutStatus !== "pending" || refreshes >= 5) return;
    const timer = window.setTimeout(() => {
      setRefreshes((count) => count + 1);
      router.refresh();
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [checkoutStatus, refreshes, router]);

  return (
    <section id="billing" aria-labelledby="billing-title" className="space-y-4 rounded-lg border p-5">
      <div className="space-y-1">
        <h2 id="billing-title" className="text-lg font-semibold">Billing</h2>
        <p className="flex items-center gap-2">Current plan <PlanBadge plan={plan} /></p>
        {status && <p className="text-sm text-muted-foreground">{status}</p>}
        {cancelDate && <p className="text-sm text-muted-foreground">Pro access ends {cancelDate}.</p>}
      </div>
      {checkoutStatus && <p role="status">{checkoutMessages[checkoutStatus]}</p>}
      {checkoutStatus === "pending" && <Button type="button" variant="outline" onClick={() => router.refresh()}>Check again</Button>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {plan === "FREE" && checkoutStatus !== "pending" && (
        <Button asChild><Link href={interval === "yearly" ? "/upgrade?interval=yearly" : "/upgrade"}>View upgrade options</Link></Button>
      )}
      {canManage && <Button type="button" variant="outline" disabled={busy} onClick={() => void openBilling({ action: "portal" })}>Manage billing</Button>}
    </section>
  );
}
