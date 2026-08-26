"use client";

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z.object({ to: z.string().trim().email("Introduce un correo válido"), cc: z.string().trim().email("El CC no es válido").optional().or(z.literal("")), subject: z.string().trim().min(1, "El asunto es obligatorio"), body: z.string().trim().min(1, "El mensaje es obligatorio") });
export type EmailComposeValues = z.infer<typeof schema>;

export function EmailComposeForm({ initial, onSubmit, onCancel, submitting = false }: { initial?: Partial<EmailComposeValues>; onSubmit: (values: EmailComposeValues) => Promise<void> | void; onCancel: () => void; submitting?: boolean }) {
  const [values, setValues] = useState<EmailComposeValues>({ 
    to: initial?.to || "", 
    cc: initial?.cc || "", 
    subject: initial?.subject || "", 
    body: initial?.body || "" 
  });
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) { event.preventDefault(); 
    const result = schema.safeParse(values); 
    if (!result.success) { 
      setError(result.error.issues[0]?.message || "Revisa los datos."); 
      return; 
    } 
    setError(null); 
    await onSubmit(result.data); 
  }
  
  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="grid gap-1.5 text-sm">Para
        <Input value={values.to} onChange={(e) => setValues((v) => ({ ...v, to: e.target.value }))} />
      </label>
      <label className="grid gap-1.5 text-sm">CC
        <Input value={values.cc} onChange={(e) => setValues((v) => ({ ...v, cc: e.target.value }))} />
      </label>
      <label className="grid gap-1.5 text-sm">Asunto
        <Input value={values.subject} onChange={(e) => setValues((v) => ({ ...v, subject: e.target.value }))} />
      </label>
      <label className="grid gap-1.5 text-sm">Mensaje
        <textarea value={values.body} onChange={(e) => setValues((v) => ({ ...v, body: e.target.value }))} className="min-h-32 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
      </label>
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Enviando..." : "Enviar correo"}</Button>
      </div>
    </form>
  );
}
