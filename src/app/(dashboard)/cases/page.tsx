"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { demoCases, type DemoCase } from "@/lib/demo-data";
import { formatRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CaseStatusBadge, PriorityBadge, statusLabels, priorityLabels } from "@/components/cases/status-badge";
import { ArrowUpRight, LayoutGrid, List, Plus, Search, SlidersHorizontal } from "lucide-react";

const kanbanColumns = ["new", "evaluating", "waiting_approval", "in_progress", "delegated", "waiting_customer", "follow_up", "resolved"] as const;

export default function CasesPage() {
  const [cases, setCases] = useState<DemoCase[]>(demoCases);
  const [view, setView] = useState<"table" | "kanban">("table");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  
  useEffect(() => { 
    (async () => { 
      const { data } = await createClient().from("cases").select("id,case_number,title,description,status,priority,updated_at,created_at,requires_approval,requires_human").order("updated_at", { ascending: false }).limit(100); 
      if (data?.length) setCases(data.map((c) => Object.assign({}, c, { client: "Cliente", company: "—", department: "—", assignee: "—" })) as DemoCase[]); 
      setLoading(false); 
    })(); 
  }, []);
  
  const filtered = useMemo(() => cases.filter((item) => (!search || `${item.title} 
    ${item.case_number} 
    ${item.client} 
    ${item.company}`.toLowerCase().includes(search.toLowerCase())) && (priority === "all" || item.priority === priority) 
    && (status === "all" || item.status === status)), [cases, search, priority, status]);
  
  return (
  <div className="space-y-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[.18em] text-muted-foreground mb-3">Operations / Workspace</p>
        <h1 className="text-3xl font-semibold tracking-[-.04em]">Casos</h1>
        <p className="text-muted-foreground mt-1.5">Gestiona solicitudes, reclamos y asuntos que requieren seguimiento.</p>
      </div>
      <Button><Plus />Nuevo caso</Button>
    </div>

    <div className="flex flex-col xl:flex-row gap-3 justify-between">
      <div className="flex flex-1 flex-wrap gap-2">
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
        <Button variant="outline" size="sm"><SlidersHorizontal />Más filtros</Button>
      </div>
      <div className="flex items-center gap-1 border rounded-md p-1 w-fit">
        <Button size="sm" variant={view === "table" ? "secondary" : "ghost"} onClick={() => setView("table")}><List />Tabla</Button>
        <Button size="sm" variant={view === "kanban" ? "secondary" : "ghost"} onClick={() => setView("kanban")}><LayoutGrid />Kanban</Button>
      </div>
    </div>

    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{filtered.length}</span> casos encontrados {loading && <span className="animate-pulse">· sincronizando</span>}
      <span className="ml-auto flex items-center gap-1">
        <span className="h-1.5 w-1.5 bg-success rounded-full" /> Datos sincronizados
      </span>
    </div>

    {view === "table" ? <Card className="overflow-hidden">
      <div className="overflow-x-auto">
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
     
     </Card> : <div className="grid gap-4 lg:grid-cols-4 xl:grid-cols-8 overflow-x-auto pb-4">
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
    </div>}
  </div>
  );
}
