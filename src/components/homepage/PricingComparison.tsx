"use client";

import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { freeFeatures, proFeatures } from "@/components/billing/plan-features";

const plans = [
  { name: "Free", label: "THE ESSENTIALS", summary: "A home for your everyday knowledge.", features: freeFeatures },
  { name: "Pro", label: "ROOM TO GROW", summary: "For a brain that never stops collecting.", features: proFeatures },
];

export function PricingComparison({ freeAction, signedIn }: { freeAction: ReactNode; signedIn: boolean }) {
  const [yearly, setYearly] = useState(false);

  return (
    <>
      <div role="group" aria-label="Pro billing period" className="mx-auto mt-7 flex w-fit flex-wrap justify-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        <Button variant="ghost" type="button" aria-pressed={!yearly} onClick={() => setYearly(false)} className="aria-pressed:bg-white/15">
          Monthly
        </Button>
        <Button variant="ghost" type="button" aria-pressed={yearly} onClick={() => setYearly(true)} className="aria-pressed:bg-white/15">
          Yearly <span className="rounded bg-blue-400/15 px-1.5 text-xs text-blue-200">Save 25%</span>
        </Button>
      </div>
      <div className="mx-auto mt-9 grid max-w-3xl gap-5 sm:grid-cols-2">
        {plans.map(({ name, label, summary, features }) => {
          const isPro = name === "Pro";
          return (
            <article key={name} className={`rounded-2xl border p-6 sm:p-8 ${isPro ? "border-blue-400/55 bg-gradient-to-br from-blue-950/65 to-[#111322]" : "border-white/10 bg-[#11131e]"}`}>
              <p className="font-mono text-xs tracking-widest text-blue-300">{label}</p>
              <h3 className="mt-2 text-3xl font-bold">{name}</h3>
              <p className="mt-2 text-sm text-slate-300">{summary}</p>
              <div aria-live={isPro ? "polite" : undefined} aria-atomic={isPro ? true : undefined} className="mt-6 min-h-23">
                <p className="text-4xl font-bold">
                  {isPro ? (yearly ? "$72" : "$8") : "$0"}
                  <span className="ml-2 text-sm font-normal text-slate-300">{isPro ? (yearly ? "/ year" : "/ month") : "/ forever"}</span>
                </p>
                <p className="mt-2 text-xs text-slate-300">
                  {isPro ? (yearly ? "$6/month, billed yearly. Save $24 a year." : "$8/month, billed monthly.") : "No trial or credit card required."}
                </p>
              </div>
              {isPro ? (
                <Button asChild className="h-10 w-full bg-[#3b82f6] font-bold text-[#080e1b] hover:bg-blue-400">
                  <Link href={signedIn ? `/upgrade?interval=${yearly ? "yearly" : "monthly"}` : "/register"}>
                    {signedIn ? "View Pro plans" : "Create an account"}
                  </Link>
                </Button>
              ) : freeAction}
              <ul className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm text-slate-300">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2"><Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-blue-300" />{feature}</li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </>
  );
}
