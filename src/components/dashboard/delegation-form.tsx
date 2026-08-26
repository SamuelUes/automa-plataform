"use client";

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z.object({ case_id: z.string().trim().min(1, "El caso es obligatorio"), assigned_to: z.string().trim().min(1, "El responsable es obligatorio"), department_id: z.string().trim().optional(), reason: z.string().trim().max(2000).optional() });
export type DelegationFormValues = z.infer<typeof schema>;
export function DelegationForm({ onSubmit, onCancel, submitting = false }: { onSubmit: (values: DelegationFormValues) => Promise<void> | void; onCancel: () => void; submitting?: boolean }) {
  const [values, setValues] = useState<DelegationFormValues>({ 
    case_id: "", 
    assigned_to: "", 
    department_id: "", 
    reason: "" 
  });
  
  const [error, setError] = useState<string | null>(null);
  async function submit(event: React.FormEvent) { 
    event.preventDefault(); 
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
    <label className="grid gap-1.5 text-sm">Caso
      <Input value={values.case_id} onChange={(e) => setValues((v) => ({ ...v, case_id: e.target.value }))} placeholder="UUID del caso" />
    </label>
    <label className="grid gap-1.5 text-sm">Responsable
      <Input value={values.assigned_to} onChange={(e) => setValues((v) => ({ ...v, assigned_to: e.target.value }))} placeholder="UUID del responsable" />
    </label>
    <label className="grid gap-1.5 text-sm">Departamento opcional
      <Input value={values.department_id} onChange={(e) => setValues((v) => ({ ...v, department_id: e.target.value }))} placeholder="UUID del departamento" />
    </label>
    <label className="grid gap-1.5 text-sm">Motivo
      <textarea value={values.reason} onChange={(e) => setValues((v) => ({ ...v, reason: e.target.value }))} className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
    </label>
    {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
      <Button type="submit" disabled={submitting}>{submitting ? "Enviando..." : "Delegar caso"}</Button>
    </div>
  </form>
  );
}
