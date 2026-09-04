"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { demoCases, type DemoCase } from "@/lib/demo-data";
import { formatRelativeTime } from "@/lib/utils";
import { isDemoId } from "@/components/dashboard/action-feedback";
import { CaseForm, type CaseFormValues } from "@/components/dashboard/case-form";
import { OperationDialog, OperationDialogContent, OperationDialogDescription, OperationDialogHeader, OperationDialogTitle } from "@/components/dashboard/operation-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { CaseStatusBadge, PriorityBadge, statusLabels, priorityLabels } from "@/components/cases/status-badge";
import { ArrowUpRight, LayoutGrid, List, Plus, Search, SlidersHorizontal } from "lucide-react";

const kanbanColumns = ["new", "evaluating", "waiting_approval", "in_progress", "delegated", "waiting_customer", "follow_up", "resolved"] as const;
type CaseRow = DemoCase & {
  contacts?: { name: string | null; company: string | null } | Array<{ name: string | null; company: string | null }> | null;
  departments?: { name: string | null } | Array<{ name: string | null }> | null;
};
const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function CasesPage() {
  const [cases, setCases] = useState<DemoCase[]>(demoMode ? demoCases : []);
  const [view, setView] = useState<"table" | "kanban">("table");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [caseDialogOpen, setCaseDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState("all");
  const [requiresHuman, setRequiresHuman] = useState("all");
  
  useEffect(() => { 
    (async () => { 
      const { data, error } = await createClient().from("cases").select("id,case_number,title,description,status,priority,updated_at,created_at,requires_approval,requires_human,contacts(name,company),departments(name)").order("updated_at", { ascending: false }).limit(100);
      setLoadError(Boolean(error));
      if (data) setCases((data as unknown as CaseRow[]).map((item) => {
        const contact = Array.isArray(item.contacts) ? item.contacts[0] : item.contacts;
        const department = Array.isArray(item.departments) ? item.departments[0] : item.departments;
        return Object.assign({}, item, { client: contact?.name || "Sin contacto", company: contact?.company || "Sin empresa", department: department?.name || "Sin departamento", assignee: "Sin asignar" });
      }) as unknown as DemoCase[]);
      setLoading(false); 
    })(); 
  }, []);
  
  const filtered = useMemo(() => cases.filter((item) => (!search || `${item.title} ${item.case_number} ${item.client} ${item.company}`.toLowerCase().includes(search.toLowerCase())) && (priority === "all" || item.priority === priority) && (status === "all" || item.status === status) && (requiresApproval === "all" || String(item.requires_approval) === requiresApproval) && (requiresHuman === "all" || String(item.requires_human) === requiresHuman)), [cases, search, priority, status, requiresApproval, requiresHuman]);
  async function createCase(values: CaseFormValues) {
    setSaving(true);
    try {
      if (isDemoId(cases[0]?.id)) {
        const demo = { 
          id: `demo-case-${Date.now()}`, 
          case_number: Math.max(0, ...cases.map((entry) => entry.case_number)) + 1, 
          ...values, 
          description: values.description || null, 
          status: "new", 
          requires_approval: false, 
          requires_human: false, 
          client: "Cliente nuevo", 
          company: "—", 
          department: "—", 
          assignee: "—", 
          created_at: new Date().toISOString(), 
          updated_at: new Date().toISOString() 
        } as DemoCase;
        setCases((current) => [demo, ...current]); setCaseDialogOpen(false); toast.success("Caso añadido a la vista demo; no se guardó en Supabase."); return;
      }
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();
      if (!user) throw new Error("Sesión no disponible.");
      const { data: profile, error: profileError } = await (client as any).from("users").select("organization_id").eq("id", user.id).single();
      if (profileError || !profile?.organization_id) throw profileError || new Error("No se encontró la organización.");
      const { error } = await (client as any).from("cases").insert({
        organization_id: profile.organization_id,
        title: values.title,
        description: values.description || null,
        priority: values.priority
      }).select("id").single();
      if (error) throw error;
      setCaseDialogOpen(false); toast.success("Caso creado.");
      const { data } = await createClient().from("cases").select("id,case_number,title,description,status,priority,updated_at,created_at,requires_approval,requires_human").order("updated_at", { ascending: false }).limit(100);
      if (data?.length) setCases(data.map((entry) => Object.assign({}, entry, { 
        client: "Cliente", 
        company: "—", 
        department: "—", 
        assignee: "—" 
      })) as DemoCase[]);
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo crear el caso."); }
    finally { setSaving(false); }
  }
  
  return (
  <div className="space-y-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[.18em] text-muted-foreground mb-3">Operations / Workspace</p>
        <h1 className="text-3xl font-semibold tracking-[-.04em]">Casos</h1>
        <p className="text-muted-foreground mt-1.5">Gestiona solicitudes, reclamos y asuntos que requieren seguimiento.</p>
      </div>
      <Button onClick={() => setCaseDialogOpen(true)} className="w-full sm:w-fit"><Plus />Nuevo caso</Button>
    </div>
    <OperationDialog open={caseDialogOpen} onOpenChange={setCaseDialogOpen}>
      <OperationDialogContent>
        <OperationDialogHeader>
          <OperationDialogTitle>Nuevo caso</OperationDialogTitle>
          <OperationDialogDescription>Registra una solicitud para iniciar su gestión.</OperationDialogDescription>
        </OperationDialogHeader>
        <CaseForm onSubmit={createCase} onCancel={() => setCaseDialogOpen(false)} submitting={saving} />
      </OperationDialogContent>
    </OperationDialog>

    <div className="flex min-w-0 flex-col gap-3 justify-between xl:flex-row">
      <div className="flex min-w-0 flex-1 flex-wrap gap-2">
        <div className="relative w-full sm:w-70">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título o cliente..." className="pl-9" />
        </div>
        <select aria-label="Filtrar por estado" value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-xs">
          <option value="all">Todos los estados</option>
          {Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <select aria-label="Filtrar por prioridad" value={priority} onChange={(e) => setPriority(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-xs">
          <option value="all">Todas las prioridades</option>
          {Object.entries(priorityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={() => setMoreFiltersOpen((open) => !open)}>
          <SlidersHorizontal />Más filtros
        </Button>
      </div>
      {moreFiltersOpen && <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 p-3 text-xs">
        <span className="text-muted-foreground">Requisitos:</span>
        <select aria-label="Filtrar aprobación" value={requiresApproval} onChange={(e) => setRequiresApproval(e.target.value)} className="h-8 rounded-md border bg-background px-2">
          <option value="all">Cualquier aprobación</option>
          <option value="true">Requiere aprobación</option>
          <option value="false">Sin aprobación</option>
        </select>
        <select aria-label="Filtrar atención humana" value={requiresHuman} onChange={(e) => setRequiresHuman(e.target.value)} className="h-8 rounded-md border bg-background px-2">
          <option value="all">Cualquier atención</option>
          <option value="true">Requiere humano</option>
          <option value="false">Automático</option>
        </select>
        <Button variant="ghost" size="sm" onClick={() => { setRequiresApproval("all"); setRequiresHuman("all"); }}>Limpiar</Button>
      </div>}
      <div className="flex w-full items-center gap-1 rounded-md border p-1 sm:w-fit">
        <Button className="flex-1 sm:flex-none" size="sm" variant={view === "table" ? "secondary" : "ghost"} onClick={() => setView("table")}><List />Tabla</Button>
        <Button className="flex-1 sm:flex-none" size="sm" variant={view === "kanban" ? "secondary" : "ghost"} onClick={() => setView("kanban")}><LayoutGrid />Kanban</Button>
      </div>
    </div>

    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{filtered.length}</span> casos encontrados {loading && <span className="animate-pulse">· sincronizando</span>}
      <span className="ml-auto flex items-center gap-1">
        <span className="h-1.5 w-1.5 bg-success rounded-full" /> Datos sincronizados
      </span>
    </div>

    {loading ? <Card><LoadingState compact label="Cargando casos..." /></Card> : null}
    {loadError ? <Card><ErrorState compact message="No pudimos cargar los casos." /></Card> : null}
    <div className={loading || loadError ? "hidden" : "block"}>
    {view === "table" ? <Card className="overflow-hidden">
      <div className="md:hidden">
        {filtered.map((item) => <Link key={item.id} href={`/cases/${item.id}`} className="block border-b p-4 last:border-b-0">
          <div className="flex items-start justify-between gap-3">
            <PriorityBadge priority={item.priority} />
            <CaseStatusBadge status={item.status} />
          </div>
          <p className="mt-3 text-sm font-medium leading-snug">{item.title}</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">#{item.case_number}</p>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{item.client}</span>
            <span>{item.company}</span>
            <span>{item.assignee}</span>
            <span>{formatRelativeTime(item.updated_at)}</span>
          </div>
        </Link>)}
        {filtered.length === 0 && <div className="px-4 py-12 text-center text-sm text-muted-foreground">No encontramos casos con esos filtros.</div>}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/35 border-b">
            <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">Prioridad</th>
              <th className="px-3 py-3 font-medium min-w-70">Caso</th>
              <th className="px-3 py-3 font-medium">Cliente</th>
              <th className="px-3 py-3 font-medium">Estado</th>
              <th className="px-3 py-3 font-medium">Responsable</th>
              <th className="px-3 py-3 font-medium">Actualizado</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>

          <tbody className="divide-y">
            {filtered.map((item) => <tr key={item.id} className="group hover:bg-muted/25 transition-colors">
              <td className="px-5 py-4"><PriorityBadge priority={item.priority} /></td>
              <td className="px-3 py-4">
                <Link href={`/cases/${item.id}`} className="font-medium hover:underline underline-offset-4">{item.title}</Link>
                <p className="text-[11px] text-muted-foreground font-mono mt-1">#{item.case_number}</p>
              </td>
              <td className="px-3 py-4">
                <p className="text-xs">{item.client}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{item.company}</p>
              </td>
              <td className="px-3 py-4"><CaseStatusBadge status={item.status} /></td>
              <td className="px-3 py-4 text-xs text-muted-foreground">{item.assignee}</td>
              <td className="px-3 py-4 text-xs text-muted-foreground whitespace-nowrap">{formatRelativeTime(item.updated_at)}</td>
              <td className="px-3 py-4"><ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" /></td>
            </tr>)}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && <div className="py-16 text-center text-sm text-muted-foreground">No encontramos casos con esos filtros.</div>}
     
     </Card> : <div className="w-full min-w-0 overflow-x-auto pb-4">
      <div className="grid min-w-max gap-4 lg:min-w-0 lg:grid-cols-4 xl:grid-cols-8">
      {kanbanColumns.map((column) => <div key={column} className="min-w-55">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
            <h3 className="text-xs font-semibold">{statusLabels[column]}</h3>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">{filtered.filter((item) => item.status === column).length}</span>
        </div>
        
        <div className="space-y-2">
          {filtered.filter((item) => item.status === column).map((item) => <Link key={item.id} href={`/cases/${item.id}`}>
            <Card className="hover:border-foreground/30 transition-colors">
              <CardContent className="p-3">
                <PriorityBadge priority={item.priority} />
                <p className="text-xs font-medium mt-3 leading-snug">{item.title}</p>
                <p className="text-[11px] text-muted-foreground mt-2">#{item.case_number} · {item.company}</p>
                <div className="mt-3 pt-2 border-t text-[10px] text-muted-foreground">{formatRelativeTime(item.updated_at)}</div>
              </CardContent>
            </Card>
          </Link>)}
        </div>
      </div>)}
      </div>
    </div>}
    </div>
  </div>
  );
}
