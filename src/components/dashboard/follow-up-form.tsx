"use client";

import { useCallback, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableCombobox } from "@/components/dashboard/searchable-combobox";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({ case_id: z.string().trim().min(1, "El caso es obligatorio"), scheduled_for: z.string().min(1, "La fecha y hora son obligatorias"), reason: z.string().trim().max(2000).optional() });
export type FollowUpFormValues = z.infer<typeof schema>;
export function FollowUpForm({ onSubmit, onCancel, submitting = false, defaultDate }: { onSubmit: (values: FollowUpFormValues) => 
  Promise<void> | void; onCancel: () => void; submitting?: boolean; defaultDate?: string }) {
  const [values, setValues] = useState<FollowUpFormValues>({ case_id: "", scheduled_for: defaultDate || "", reason: "" });
  const [error, setError] = useState<string | null>(null);
  const searchCases = useCallback(async (query: string) => {
    const request = (createClient() as any).from("cases").select("id,case_number,title").order("updated_at", { ascending: false }).limit(20);
    const { data } = query ? await request.ilike("title", `%${query}%`) : await request;
    return (data ?? []).map((item: any) => ({ value: item.id, label: `Caso #${item.case_number} · ${item.title}` }));
  }, []);
  async function submit(event: React.FormEvent) 
  { 
    event.preventDefault(); 
    const result = schema.safeParse(values); 
    if (!result.success || Number.isNaN(new Date(values.scheduled_for).getTime())) { 
      setError(result.success ? "La fecha no es válida." : result.error.issues[0]?.message || "Revisa los datos."); 
      return; 
    } 
    setError(null); 
    await onSubmit(result.data); 
  }

  return (
  <form onSubmit={submit} className="grid gap-4">
    <label className="grid gap-1.5 text-sm">Caso
      <SearchableCombobox value={values.case_id} onChange={(case_id) => setValues((v) => ({ ...v, case_id }))} onSearch={searchCases} placeholder="Busca por título del caso" aria-label="Caso" disabled={submitting} />
    </label>
    <label className="grid gap-1.5 text-sm">Fecha y hora
      <Input type="datetime-local" value={values.scheduled_for} onChange={(e) => setValues((v) => ({ ...v, scheduled_for: e.target.value }))} />
    </label>
    <label className="grid gap-1.5 text-sm">Motivo
      <textarea value={values.reason} onChange={(e) => setValues((v) => ({ ...v, reason: e.target.value }))} 
      className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
    </label>
    {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
      <Button type="submit" disabled={submitting}>{submitting ? "Programando..." : "Crear seguimiento"}</Button>
    </div>
  </form>
  );
}
