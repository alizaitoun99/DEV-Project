import { Suspense } from "react";
import { connection } from "next/server";
import { ProfileActions } from "@/components/auth/ProfileActions";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { EditorPreferencesSettings } from "@/components/items/EditorPreferencesSettings";
import { BillingPanel } from "@/components/billing/BillingPanel";
import { billingCancellationDate, checkoutReturnStatus } from "@/lib/billing/settings";

export const metadata = { title: "Settings | DevStash" };

async function Settings({ searchParams }: PageProps<"/settings">) {
  await connection();
  const user = await getCurrentUser();
  const details = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true, plan: true, stripeCustomerId: true, stripeSubscriptionId: true, subscriptionStatus: true },
  });
  const query = await searchParams;
  const [checkoutStatus, cancelDate] = await Promise.all([
    checkoutReturnStatus(details, query.checkout, query.session_id),
    billingCancellationDate(details),
  ]);
  const status = details.subscriptionStatus;

  return (
    <div className="w-full max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your editor preferences, account, and security.</p>
      </header>
      <BillingPanel
        plan={details.plan}
        interval={query.interval === "yearly" ? "yearly" : "monthly"}
        status={status === "past_due" ? "Payment is past due. Update your payment details to restore Pro." :
          status === "billing_conflict" ? "Billing needs attention. Contact support if the issue persists." :
          status ? `Subscription status: ${status.replaceAll("_", " ")}` : null}
        cancelDate={cancelDate}
        checkoutStatus={checkoutStatus}
        canManage={Boolean(details.stripeCustomerId)}
      />
      <EditorPreferencesSettings />
      <ProfileActions hasPassword={Boolean(details.passwordHash)} />
    </div>
  );
}

export default function SettingsPage(props: PageProps<"/settings">) {
  return (
    <div className="flex justify-center">
      <Suspense fallback={<p role="status">Loading settings…</p>}>
        <Settings {...props} />
      </Suspense>
    </div>
  );
}
