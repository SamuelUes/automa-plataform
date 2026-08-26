import { LoaderCircle } from "lucide-react";

export function isDemoId(id: string | null | undefined) {
  return Boolean(id && /^(demo-|case-|email-|delegation-|follow-|activity-)/.test(id));
}

export function operationMessage(data: unknown) {
  const result = data as { n8n?: { success?: boolean }; action?: { status?: string } } | null;
  if (result?.n8n?.success === false) return "La acción se creó, pero el workflow está pendiente.";
  if (result?.action?.status === "queued") return "La acción fue enviada a procesamiento.";
  return "La operación se completó.";
}

export function ActionFeedback({ processing, label = "Procesando..." }: { processing: boolean; label?: string }) {
  if (!processing) return null;
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
      <LoaderCircle className="animate-spin" />{label}
    </span>
  );
}
