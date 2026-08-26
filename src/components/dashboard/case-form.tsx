"use client";

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z.object({ title: z.string().trim().min(1, "El título es obligatorio").max(500), description: z.string().trim().max(5000).optional(), priority: z.enum(["low", "normal", "high", "urgent"]) });
export type CaseFormValues = z.infer<typeof schema>;

export function CaseForm({ onSubmit, onCancel, submitting = false }: { onSubmit: (values: CaseFormValues) => Promise<void> | void; onCancel: () => void; submitting?: boolean }) {
  const [values, setValues] = useState<CaseFormValues>({ title: "", description: "", priority: "normal" });
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = schema.safeParse(values);
    if (!result.success) { setError(result.error.issues[0]?.message || "Revisa los datos."); return; }
    setError(null); await onSubmit(result.data);
  }
  return (
    <form onSubmit={submit} className="grid gap-4">
    <label className="grid gap-1.5 text-sm">Título
      <Input value={values.title} onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))} aria-invalid={Boolean(error)} /></label>
    <label className="grid gap-1.5 text-sm">Descripción
      <textarea value={values.description} onChange={(e) => setValues((v) => ({ 
        ...v, 
        description: e.target.value 
      }))} className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" /></label>
    
    <label className="grid gap-1.5 text-sm">Prioridad
      <select value={values.priority} onChange={(e) => setValues((v) => ({ 
        ...v, 
        priority: e.target.value as CaseFormValues["priority"] 
      }))} className="h-9 rounded-md border bg-background px-3 text-sm">
        <option value="low">Baja</option>
        <option value="normal">Normal</option>
        <option value="high">Alta</option>
        <option value="urgent">Urgente</option>
      </select>
    </label>

    {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
      <Button type="submit" disabled={submitting}>{submitting ? "Guardando..." : "Crear caso"}</Button>
    </div>
  </form>
  );
}
