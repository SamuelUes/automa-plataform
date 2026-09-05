"use client";

import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type OperationStatusValue = "idle" | "submitting" | "queued" | "success" | "error";

export function OperationStatus({ status, message, onRetry, className }: { 
  status: OperationStatusValue; 
  message?: string; 
  onRetry?: () => void; 
  className?: string 
}) {
  if (status === "idle") return null;
  if (status === "error") {
    return (
      <div role="alert" className={cn("flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive", className)}>
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">No se pudo completar la acción</p>
          <p className="mt-0.5 text-destructive/80">{message || "Revisa los datos e inténtalo de nuevo."}</p>
        </div>
        {onRetry ? (
          <Button variant="ghost" size="sm" className="-mr-2 -mt-1 shrink-0 text-destructive hover:text-destructive" onClick={onRetry}>
            <RefreshCw />Reintentar
          </Button>
        ) : null}
      </div>
    );
  }
  const isComplete = status === "success";
  return (
    <div role="status" aria-live="polite" className={cn("flex items-center gap-2 text-xs", isComplete ? "text-success" : "text-muted-foreground", className)}>
      {isComplete ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" />}
      <span>
        {message || (status === "queued" ? "Acción en cola para procesamiento." : status === "submitting" ? "Validando y enviando..." : "Acción completada.")}
      </span>
    </div>
  );
}
