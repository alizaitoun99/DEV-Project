"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertDialog } from "radix-ui";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { changePassword, deleteAccount } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ProfileActionsProps { hasPassword: boolean }

export function ProfileActions({ hasPassword }: ProfileActionsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  function submit(form: HTMLFormElement, deleting: boolean) {
    const data = Object.fromEntries(new FormData(form));
    setError("");
    startTransition(async () => {
      try {
        const result = deleting ? await deleteAccount({ ...data, password: data.password ?? "" }) : await changePassword(data);
        if (!result.success) { const message = result.error ?? "Unable to save changes."; setError(message); toast.error(message); return; }
        if (deleting) {
          setDeleted(true);
          await signOut({ redirect: false });
          window.location.replace("/sign-in");
        } else { form.reset(); toast.success("Password updated."); }
      } catch { setError("Unable to finish. Please try again."); }
    });
  }
  return <section className="space-y-6 rounded-2xl border bg-card p-6 sm:p-8" aria-labelledby="actions-heading">
    <h2 id="actions-heading" className="text-xl font-semibold">Account actions</h2>
    {hasPassword && <form className="max-w-md space-y-4" onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget, false); }}>
      <h3 className="font-medium">Change password</h3>
      <label className="block space-y-2 text-sm"><span>Current password</span><Input name="currentPassword" type="password" autoComplete="current-password" required maxLength={72} disabled={pending} /></label>
      <label className="block space-y-2 text-sm"><span>New password</span><Input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} disabled={pending} /></label>
      <p className="text-xs text-muted-foreground">Use at least 8 characters, up to 72 bytes.</p>
      <label className="block space-y-2 text-sm"><span>Confirm new password</span><Input name="confirmPassword" type="password" autoComplete="new-password" required maxLength={72} disabled={pending} /></label>
      <Button disabled={pending} type="submit">{pending ? "Saving…" : "Change password"}</Button>
      <p className="text-sm"><Link href="/forgot-password" className="text-primary underline underline-offset-4">Forgot password?</Link></p>
    </form>}
    {!open && error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="space-y-3 border-t pt-6">
      <h3 className="font-medium">Delete account</h3>
      <p className="text-sm text-muted-foreground">Permanently delete your account and all your items, collections, and tags.</p>
      <AlertDialog.Root open={open} onOpenChange={(value) => { if (!pending && !deleted) { setOpen(value); setError(""); } }}>
        <AlertDialog.Trigger asChild><Button variant="destructive" disabled={pending}>Delete account</Button></AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[70] bg-black/70" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[80] max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-xl border bg-card p-6 shadow-xl">
            <AlertDialog.Title className="text-xl font-semibold">Delete your account?</AlertDialog.Title>
            <AlertDialog.Description className="text-sm text-muted-foreground">This permanently deletes your account and saved content. This cannot be undone.</AlertDialog.Description>
            {deleted ? <p role="status">Account deleted. <a href="/sign-in" className="underline">Continue to sign in</a></p> : <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget, true); }}>
              <label className="block space-y-2 text-sm"><span>Type DELETE to confirm</span><Input name="confirmation" required pattern="DELETE" autoComplete="off" disabled={pending} /></label>
              {hasPassword && <label className="block space-y-2 text-sm"><span>Current password</span><Input name="password" type="password" autoComplete="current-password" required maxLength={72} disabled={pending} /></label>}
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <div className="flex flex-wrap justify-end gap-3"><AlertDialog.Cancel asChild><Button variant="outline" type="button" disabled={pending}>Cancel</Button></AlertDialog.Cancel><Button variant="destructive" type="submit" disabled={pending}>{pending ? "Deleting…" : "Permanently delete account"}</Button></div>
            </form>}
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  </section>;
}
