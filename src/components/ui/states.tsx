import { AlertCircle, Inbox, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StateProps = {
  compact?: boolean;
  className?: string;
};

export function LoadingState({ label = "Cargando información...", compact, className }: { label?: string } & StateProps) {
  return (
    <div role="status" aria-live="polite" className={cn("flex items-center justify-center gap-2 text-sm text-muted-foreground", compact ? "min-h-20" : "min-h-48", className)}>
      <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, description, action, compact, className }: { title: string; description: string; action?: React.ReactNode } & StateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 text-center", compact ? "min-h-32" : "min-h-48", className)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Inbox className="h-5 w-5" />
      </div>
      <h2 className="mt-3 text-sm font-semibold text-balance">{title}</h2>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-pretty text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message = "No pudimos cargar esta información.", onRetry, compact, className }: { message?: string; onRetry?: () => void } & StateProps) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center px-6 text-center", compact ? "min-h-32" : "min-h-48", className)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <AlertCircle className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-medium">Algo salió mal</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-pretty text-muted-foreground">{message}</p>
      {onRetry ? <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}><RefreshCw />Reintentar</Button> : null}
    </div>
  );
}
