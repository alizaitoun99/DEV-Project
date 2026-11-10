"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Interval = "monthly" | "yearly";
export type CheckoutStatus = "canceled" | "pending" | "confirmed" | "failed";

const checkoutMessages: Record<CheckoutStatus, string> = {
  canceled: "Checkout was canceled.",
  pending: "Waiting for Stripe to confirm your subscription.",
  confirmed: "Your Pro subscription is confirmed.",
  failed: "We couldn’t verify this Checkout return. Check your plan or try again.",
};

interface BillingPanelProps {
  plan: "FREE" | "PRO";
  interval: Interval;
  status: string | null;
  cancelDate: string | null;
  checkoutStatus?: CheckoutStatus;
  canCheckout: boolean;
  canManage: boolean;
}

export function BillingPanel({ plan, interval, status, cancelDate, checkoutStatus, canCheckout, canManage }: BillingPanelProps) {
  const router = useRouter();
  const [selected, setSelected] = useState(interval);
  const [refreshes, setRefreshes] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (checkoutStatus !== "pending" || refreshes >= 5) return;
    const timer = window.setTimeout(() => {
      setRefreshes((count) => count + 1);
      router.refresh();
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [checkoutStatus, refreshes, router]);

  async function openBilling(action: "checkout" | "portal") {
    setBusy(true);
    setError("");
    try {
      const submit = (kind: "checkout" | "portal") => fetch(`/api/billing/${kind}`, {
        method: "POST",
        ...(kind === "checkout" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interval: selected }) } : {}),
      });
      let response = await submit(action);
      let data = await response.json();
      if (response.ok && data.manage === true) {
        response = await submit("portal");
        data = await response.json();
      }
      if (!response.ok || typeof data.url !== "string") {
        setError(data.error || "Billing is temporarily unavailable.");
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("Billing is temporarily unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="billing" aria-labelledby="billing-title" className="space-y-4 rounded-lg border p-5">
      <div className="space-y-1">
        <h2 id="billing-title" className="text-lg font-semibold">Billing</h2>
        <p>Current plan <strong>{plan === "PRO" ? "Pro" : "Free"}</strong></p>
        {status && <p className="text-sm text-muted-foreground">{status}</p>}
        {cancelDate && <p className="text-sm text-muted-foreground">Pro access ends {cancelDate}.</p>}
      </div>
      {checkoutStatus && <p role="status">{checkoutMessages[checkoutStatus]}</p>}
      {checkoutStatus === "pending" && <Button type="button" variant="outline" onClick={() => router.refresh()}>Check again</Button>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {plan === "FREE" && canCheckout && checkoutStatus !== "pending" && (
        <fieldset disabled={busy} className="space-y-3">
          <legend className="text-sm font-medium">Choose a Pro billing interval</legend>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2"><input type="radio" name="billing-interval" checked={selected === "monthly"} onChange={() => setSelected("monthly")} /> $8/month</label>
            <label className="flex items-center gap-2"><input type="radio" name="billing-interval" checked={selected === "yearly"} onChange={() => setSelected("yearly")} /> $72/year</label>
          </div>
          <Button type="button" onClick={() => void openBilling("checkout")}>Continue to Checkout</Button>
        </fieldset>
      )}
      {canManage && <Button type="button" variant="outline" disabled={busy} onClick={() => void openBilling("portal")}>Manage billing</Button>}
    </section>
  );
}
