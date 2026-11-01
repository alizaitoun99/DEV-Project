"use client";

import type { ComponentProps } from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = SheetPrimitive.Root;
export const SheetTitle = SheetPrimitive.Title;
export const SheetDescription = SheetPrimitive.Description;

interface SheetContentProps extends ComponentProps<typeof SheetPrimitive.Content> {
  children: React.ReactNode;
}

export function SheetContent({ children, className, ...props }: SheetContentProps) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
      <SheetPrimitive.Content className={cn("fixed inset-y-0 right-0 z-50 flex h-dvh w-full flex-col border-l bg-background shadow-xl outline-none sm:max-w-2xl data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right duration-200 motion-reduce:animate-none", className)} {...props}>
        {children}
        <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="size-5" aria-hidden="true" /><span className="sr-only">Close item details</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
