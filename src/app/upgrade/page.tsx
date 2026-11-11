import { Suspense } from "react";
import { redirect } from "next/navigation";
import { UpgradePlans } from "@/components/billing/UpgradePlans";
import { isCheckoutAvailable } from "@/lib/billing/stripe";
import { getCurrentUser } from "@/lib/current-user";

export const metadata = { title: "Upgrade | DevStash" };

async function Upgrade({ searchParams }: PageProps<"/upgrade">) {
  const user = await getCurrentUser();
  if (user.plan === "PRO") redirect("/settings#billing");

  const { interval } = await searchParams;
  return <UpgradePlans initialInterval={interval === "yearly" ? "yearly" : "monthly"} canCheckout={isCheckoutAvailable()} />;
}

export default function UpgradePage(props: PageProps<"/upgrade">) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">Upgrade to DevStash Pro</h1>
      <Suspense fallback={<p role="status">Loading plans…</p>}>
        <Upgrade {...props} />
      </Suspense>
    </div>
  );
}
