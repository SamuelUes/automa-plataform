"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function OperationDialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>{children}</DialogPrimitive.Root>;
}

export const OperationDialogTrigger = DialogPrimitive.Trigger;

export function OperationDialogContent({ className, children, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/35 data-[state=open]:animate-in data-[state=closed]:animate-out" />
      <DialogPrimitive.Content className={cn("fixed left-1/2 top-1/2 z-50 grid max-h-[min(80dvh,560px)] w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 gap-3 overflow-y-auto rounded-lg border bg-background p-4 shadow-lg sm:p-5", className)} {...props}>
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring" aria-label="Cerrar">
          <X />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const OperationDialogHeader = ({ className, ...props }: ComponentProps<"div">) => 
<div className={cn("flex flex-col gap-1.5", className)} {...props} />;

export const OperationDialogTitle = DialogPrimitive.Title;

export const OperationDialogDescription = DialogPrimitive.Description;

export const OperationDialogFooter = ({ className, ...props }: ComponentProps<"div">) => 
<div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
