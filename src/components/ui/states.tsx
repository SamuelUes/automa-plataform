import { AlertCircle, Inbox, Loader2 } from "lucide-react";

export function LoadingState({ label = "Cargando información..." }: { label?: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
      <Inbox className="h-7 w-7 text-muted-foreground/60" />
      <h2 className="mt-3 text-sm font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

export function ErrorState({ message = "No pudimos cargar esta información." }: { message?: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
      <AlertCircle className="h-7 w-7 text-destructive/80" />
      <p className="mt-3 text-sm font-medium">Algo salió mal</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
