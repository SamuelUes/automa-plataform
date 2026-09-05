"use client";

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z.object({
  to: z.string().trim().email("Introduce un correo válido"),
  cc: z.string().trim().email("El CC no es válido").optional().or(z.literal("")),
  bcc: z.string().trim().email("El BCC no es válido").optional().or(z.literal("")),
  subject: z.string().trim().min(1, "El asunto es obligatorio"),
  body: z.string().trim().min(1, "El mensaje es obligatorio"),
});

export type EmailComposeValues = z.infer<typeof schema>;

export function EmailComposeForm({ initial, onSubmit, onCancel, submitting = false }: { initial?: Partial<EmailComposeValues>; onSubmit: (values: EmailComposeValues) => Promise<void> | void; onCancel: () => void; submitting?: boolean }) {
  const [values, setValues] = useState<EmailComposeValues>({ 
    to: initial?.to || "", 
    cc: initial?.cc || "", 
    bcc: initial?.bcc || "",
    subject: initial?.subject || "", 
    body: initial?.body || "" 
  });
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [showBcc, setShowBcc] = useState(Boolean(initial?.bcc));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = schema.safeParse(values);
    if (!result.success) {
      setError(result.error.issues[0]?.message || "Revisa los datos.");
      setReviewing(false);
      return;
    }
    setError(null);
    if (!reviewing) {
      setReviewing(true);
      return;
    }
    await onSubmit(result.data);
  }

  function update(field: keyof EmailComposeValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (error) setError(null);
  }

  if (reviewing) {
    return <div className="grid gap-4">
      <div className="rounded-md border bg-muted/20 p-4 text-sm">
        <p className="font-medium">Revisa el envío</p>
        <dl className="mt-3 grid gap-2 text-xs">
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-muted-foreground">Para</dt>
            <dd className="min-w-0 break-words">{values.to}</dd>
          </div>
          {values.cc ? (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-muted-foreground">CC</dt>
              <dd className="min-w-0 break-words">{values.cc}</dd>
            </div>
          ) : null}
          {values.bcc ? (
            <div className="flex gap-2">
              <dt className="w-16 shrink-0 text-muted-foreground">BCC</dt>
              <dd className="min-w-0 break-words">{values.bcc}</dd>
            </div>
          ) : null}
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-muted-foreground">Asunto</dt>
            <dd className="min-w-0 break-words font-medium">{values.subject}</dd>
          </div>
        </dl>
      </div>
      <div className="max-h-48 overflow-y-auto rounded-md border p-4 text-sm leading-relaxed whitespace-pre-line">{values.body}</div>
      <p className="text-xs text-muted-foreground">El mensaje se enviará a procesamiento y puede requerir aprobación según la política del caso.</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => setReviewing(false)} disabled={submitting}>
          Volver a editar
        </Button>
        <Button type="button" onClick={() => void onSubmit(values)} disabled={submitting}>
          {submitting ? "Enviando..." : "Confirmar y enviar"}
        </Button>
      </div>
    </div>;
  }

  return <form onSubmit={submit} className="grid gap-4">
    <label className="grid gap-1.5 text-sm">Para
      <Input type="email" value={values.to} onChange={(e) => update("to", e.target.value)} autoComplete="email" />
    </label>
    <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
      <label className="grid gap-1.5 text-sm">CC
        <Input type="email" value={values.cc} onChange={(e) => update("cc", e.target.value)} />
      </label>
      <Button type="button" variant="ghost" size="sm" onClick={() => setShowBcc((current) => !current)}>
        {showBcc ? "Ocultar BCC" : "Añadir BCC"}
      </Button>
    </div>
    {showBcc ? <label className="grid gap-1.5 text-sm">BCC
      <Input type="email" value={values.bcc} onChange={(e) => update("bcc", e.target.value)} />
    </label> : null}
    <label className="grid gap-1.5 text-sm">Asunto
      <Input value={values.subject} onChange={(e) => update("subject", e.target.value)} />
    </label>
    <label className="grid gap-1.5 text-sm">Mensaje
      <textarea value={values.body} onChange={(e) => update("body", e.target.value)} className="min-h-32 rounded-md border bg-background px-3 py-2 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring" />
    </label>
    {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Validando..." : "Revisar envío"}
      </Button>
    </div>
  </form>;
}
