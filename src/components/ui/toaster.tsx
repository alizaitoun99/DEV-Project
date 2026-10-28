"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return <SonnerToaster theme="dark" position="top-right" duration={3000} richColors closeButton />;
}
