"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { type Workflow } from "@/lib/workflow-demo-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, ArrowUpRight, CheckCircle2, Clock3, Filter, GitBranch, Loader2, MoreHorizontal, PauseCircle, RefreshCw, Server, TriangleAlert, XCircle } from "lucide-react";

type WorkflowFilter = "active" | "all" | "non_operational" | "inactive" | "unavailable";

export default function AutomationsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [filter, setFilter] = useState<WorkflowFilter>("active");
  const [syncing, setSyncing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setSyncing(true);
    setLoadError(false);
    const { data, error } = await createClient().functions.invoke("workflows", { body: { operation: "list" } });
    setLoadError(Boolean(error));
    setWorkflows(data?.data?.length ? data.data.map((item: Record<string, unknown>) => {
      const runtime = (item.runtime_status || {}) as Record<string, unknown>;
      const rawStats = (item.stats || {}) as Record<string, unknown>;
      const runtimeStatus = ["active", "inactive", "unavailable", "unknown"].includes(String(runtime.status))
        ? String(runtime.status) as Workflow["runtimeStatus"]
        : "unknown";
      return {
        ...item,
        id: String(item.id),
        code: String(item.code),
        name: String(item.name),
        description: String(item.description || ""),
        status: runtimeStatus === "active" ? "active" : runtimeStatus,
        runtimeStatus,
        lastSyncedAt: typeof runtime.last_synced_at === "string" ? runtime.last_synced_at : null,
        lastRun: formatLastRun(rawStats.last_run),
        executions: Number(rawStats.executions || 0).toLocaleString("es-ES"),
        errors: Number(rawStats.errors || 0),
        avgDuration: formatDuration(rawStats.avg_duration_ms),
        stats: {
          executions: Number(rawStats.executions || 0),
          errors: Number(rawStats.errors || 0),
          avgDurationMs: typeof rawStats.avg_duration_ms === "number" ? rawStats.avg_duration_ms : null,
          lastRun: typeof rawStats.last_run === "string" ? rawStats.last_run : null,
          lastStatus: typeof rawStats.last_status === "string" ? rawStats.last_status : null,
          events: Number(rawStats.events || 0),
        },
      };
    }) as Workflow[] : []);
    setSyncing(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const operational = workflows.filter((workflow) => workflow.runtimeStatus === "active").length;
  const nonOperational = workflows.filter((workflow) => workflow.runtimeStatus !== "active");
  const totalErrors = workflows.reduce((sum, workflow) => sum + (workflow.stats?.errors || 0), 0);
  const totalExecutions = workflows.reduce((sum, workflow) => sum + (workflow.stats?.executions || 0), 0);
  const visibleWorkflows = workflows.filter((workflow) => {
    if (filter === "all") return true;
    if (filter === "active") return workflow.runtimeStatus === "active";
    if (filter === "non_operational") return workflow.runtimeStatus !== "active";
    return workflow.runtimeStatus === filter;
  });

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[.18em] text-muted-foreground">Operations / Orchestration</p>
          <h1 className="text-3xl font-semibold tracking-[-.04em]">Automatizaciones</h1>
          <p className="mt-1.5 text-muted-foreground">Observa el motor operativo que conecta agentes, n8n y Supabase.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={syncing}>
          {syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Sincronizar estado
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={<Server />} value={<>{operational}<span className="text-sm font-normal text-muted-foreground">/{workflows.length}</span></>} label="Workflows operativos" />
        <Stat icon={<TriangleAlert />} value={totalErrors.toLocaleString("es-ES")} label="Errores últimos 30 días" tone="warning" />
        <Stat icon={<Activity />} value={totalExecutions.toLocaleString("es-ES")} label="Ejecuciones últimos 30 días" tone="info" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Filtrar workflows</p>
              <p className="text-xs text-muted-foreground">Selecciona qué estados quieres revisar.</p>
            </div>
          </div>
          <Select value={filter} onValueChange={(value) => setFilter(value as WorkflowFilter)}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Operativos ({operational})</SelectItem>
              <SelectItem value="all">Todos ({workflows.length})</SelectItem>
              <SelectItem value="non_operational">No operativos ({nonOperational.length})</SelectItem>
              <SelectItem value="inactive">Inactivos ({workflows.filter((workflow) => workflow.runtimeStatus === "inactive").length})</SelectItem>
              <SelectItem value="unavailable">No disponibles ({workflows.filter((workflow) => workflow.runtimeStatus === "unavailable").length})</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loadError ? <Card><ErrorState compact message="No pudimos sincronizar las automatizaciones." onRetry={() => void load()} /></Card> : null}
      {!loadError && !syncing && workflows.length === 0 ? <Card><EmptyState compact title="Sin automatizaciones" description="No hay workflows configurados para esta organización." /></Card> : null}

      {visibleWorkflows.length > 0 ? (
        <section className="space-y-3" aria-labelledby="workflow-list-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="workflow-list-title" className="text-lg font-semibold">{filter === "active" ? "Workflows operativos" : "Workflows"}</h2>
            <span className="text-xs text-muted-foreground">{visibleWorkflows.length} mostrados</span>
          </div>
          <WorkflowGrid workflows={visibleWorkflows} />
        </section>
      ) : !loadError && !syncing && workflows.length > 0 ? (
        <Card><EmptyState compact title="Sin resultados" description="No hay workflows que coincidan con el filtro seleccionado." /></Card>
      ) : null}

      {filter === "active" && nonOperational.length > 0 ? (
        <section className="space-y-3" aria-labelledby="non-operational-title">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.18em] text-warning">Revisión requerida</p>
              <h2 id="non-operational-title" className="mt-1 text-lg font-semibold">Workflows no operativos</h2>
              <p className="text-sm text-muted-foreground">Estos flujos no están disponibles o están inactivos en n8n.</p>
            </div>
            <Badge variant="warning">{nonOperational.length} pendientes</Badge>
          </div>
          <WorkflowGrid workflows={nonOperational} />
        </section>
      ) : null}
    </div>
  );
}

function WorkflowGrid({ workflows }: { workflows: Workflow[] }) {
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{workflows.map((workflow) => <Card key={workflow.id} className={`group transition-colors hover:border-foreground/30 ${workflow.runtimeStatus !== "active" ? "border-warning/35" : ""}`}>
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"><GitBranch className="h-4 w-4 text-muted-foreground" /></div>
          <div><p className="font-mono text-[10px] text-muted-foreground">{workflow.code}</p><h3 className="mt-0.5 text-sm font-semibold">{workflow.name}</h3></div>
        </div>
        <button aria-label="Más opciones" className="text-muted-foreground"><MoreHorizontal className="h-4 w-4" /></button>
      </div>
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">{workflow.description}</p>
      <div className="mt-5 flex items-center justify-between">
        <WorkflowStatus status={workflow.runtimeStatus} />
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock3 className="h-3 w-3" />
          {workflow.lastRun}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-4">
        <Metric value={workflow.executions} label="Ejecuciones" />
        <Metric value={workflow.errors} label="Errores" danger={Boolean(workflow.errors)} />
        <Metric value={workflow.avgDuration} label="Promedio" />
      </div>
      <Link href={`/automations/${workflow.id}`} className="mt-4 flex items-center justify-between text-sm font-bold text-foreground hover:text-foreground">
        <span>Ver ejecuciones</span>
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </CardContent>
  </Card>)}</div>;
}

function WorkflowStatus({ status }: { status?: Workflow["runtimeStatus"] }) {
  if (status === "active") return <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" />Operativo</Badge>;
  if (status === "inactive") return <Badge variant="secondary"><PauseCircle className="mr-1 h-3 w-3" />Inactivo</Badge>;
  return <Badge variant="danger"><XCircle className="mr-1 h-3 w-3" />No disponible</Badge>;
}

function formatLastRun(value: unknown) {
  if (typeof value !== "string") return "Sin ejecuciones";
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return "Reciente";
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

function formatDuration(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Sin datos";
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
}

function Stat({ icon, value, label, tone = "success" }: { icon: React.ReactNode; value: React.ReactNode; label: string; tone?: string }) {
  return <Card><CardContent className="flex items-center gap-3 p-4"><div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone === "warning" ? "bg-warning/10 text-warning" : tone === "info" ? "bg-info/10 text-info" : "bg-success/10 text-success"}`}>{icon}</div><div><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>;
}

function Metric({ value, label, danger }: { value: React.ReactNode; label: string; danger?: boolean }) {
  return <div><p className={`font-mono text-sm tabular-nums ${danger ? "text-destructive" : ""}`}>{value}</p><p className="mt-1 text-[10px] text-muted-foreground">{label}</p></div>;
}
