"use client";

import { useCallback, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { SearchableCombobox } from "@/components/dashboard/searchable-combobox";
import { createClient } from "@/lib/supabase/client";

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
  const searchCases = useCallback(async (query: string) => {
    const supabase = createClient();
    const request = (supabase as any).from("cases").select("id,case_number,title").order("updated_at", { ascending: false }).limit(20);
    const { data } = query ? await request.ilike("title", `%${query}%`) : await request;
    return (data ?? []).map((item: any) => ({ value: item.id, label: `Caso #${item.case_number} · ${item.title}` }));
  }, []);
  const searchUsers = useCallback(async (query: string) => {
    const request = (createClient() as any).from("users").select("id,full_name,email").eq("is_active", true).order("full_name").limit(20);
    const { data } = query ? await request.or(`full_name.ilike.%${query}%,email.ilike.%${query}%`) : await request;
    return (data ?? []).map((item: any) => ({ value: item.id, label: item.full_name || item.email || "Usuario sin nombre", description: item.email || undefined }));
  }, []);
  const searchDepartments = useCallback(async (query: string) => {
    const request = (createClient() as any).from("departments").select("id,name").eq("is_active", true).order("name").limit(20);
    const { data } = query ? await request.ilike("name", `%${query}%`) : await request;
    return (data ?? []).map((item: any) => ({ value: item.id, label: item.name }));
  }, []);
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
      <SearchableCombobox value={values.case_id} onChange={(case_id) => setValues((v) => ({ ...v, case_id }))} onSearch={searchCases} placeholder="Busca por título del caso" aria-label="Caso" disabled={submitting} />
    </label>
    <label className="grid gap-1.5 text-sm">Responsable
      <SearchableCombobox value={values.assigned_to} onChange={(assigned_to) => setValues((v) => ({ ...v, assigned_to }))} onSearch={searchUsers} placeholder="Busca por nombre o correo" aria-label="Responsable" disabled={submitting} />
    </label>
    <label className="grid gap-1.5 text-sm">Departamento opcional
      <SearchableCombobox value={values.department_id || ""} onChange={(department_id) => setValues((v) => ({ ...v, department_id }))} onSearch={searchDepartments} placeholder="Busca un departamento" aria-label="Departamento" disabled={submitting} />
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
