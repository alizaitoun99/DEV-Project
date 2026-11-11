"use client";

import { useState } from "react";
import type { BillingInterval } from "@/lib/billing/stripe";

type BillingRequest = { action: "checkout"; interval: BillingInterval } | { action: "portal" };

export function useBillingRedirect() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function openBilling(request: BillingRequest) {
    setBusy(true);
    setError("");
    try {
      let response = await fetch(`/api/billing/${request.action}`, {
        method: "POST",
        ...(request.action === "checkout" && {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interval: request.interval }),
        }),
      });
      let data = await response.json();
      if (request.action === "checkout" && response.ok && data.manage === true) {
        response = await fetch("/api/billing/portal", { method: "POST" });
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

  return { busy, error, openBilling };
}
