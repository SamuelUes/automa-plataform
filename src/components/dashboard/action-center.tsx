"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OperationDialog, OperationDialogContent, OperationDialogDescription, OperationDialogHeader, OperationDialogTitle } from "@/components/dashboard/operation-dialog";
import { cn } from "@/lib/utils";

export type ActionCenterItem = {
  id: string;
  label: string;
  description: string;
  workflow?: string;
  requiresApproval?: boolean;
  icon: ReactNode;
  tone?: "default" | "warning" | "danger";
  disabled?: boolean;
  onSelect: () => void;
};

export function ActionCenter({
  open,
  onOpenChange,
  title = "Más acciones",
  description = "Elige una acción para continuar.",
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  actions: ActionCenterItem[];
}) {
  return (
    <OperationDialog open={open} onOpenChange={onOpenChange}>
      <OperationDialogContent className="max-w-xl">
        <OperationDialogHeader>
          <OperationDialogTitle>{title}</OperationDialogTitle>
          <OperationDialogDescription>{description}</OperationDialogDescription>
        </OperationDialogHeader>

        <div className="grid gap-2">
          {actions.map((action) => (
            <Button
              key={action.id}
              type="button"
              variant="outline"
              disabled={action.disabled}
              onClick={action.onSelect}
              className={cn(
                "group h-auto min-h-14 w-full justify-start gap-4 px-4 py-3 text-left transition-colors",
                action.tone === "warning" &&
                  "border-warning/30 hover:border-warning/50 hover:bg-warning/5",
                action.tone === "danger" &&
                  "border-destructive/30 text-destructive hover:border-destructive/50 hover:bg-destructive/5"
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
                  action.tone === "warning" && "bg-warning/15 text-warning",
                  action.tone === "danger" && "bg-destructive/15 text-destructive"
                )}
              >
                {action.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{action.label}</span>
                  {action.workflow && (
                    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {action.workflow}
                    </span>
                  )}
                  {action.requiresApproval && (
                    <span className="inline-flex items-center rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                      Requiere aprobación
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {action.description}
                </span>
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
                aria-hidden="true"
              />
            </Button>
          ))}
        </div>
      </OperationDialogContent>
    </OperationDialog>
  );
}
