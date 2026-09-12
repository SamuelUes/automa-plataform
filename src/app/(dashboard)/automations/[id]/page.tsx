"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { type Workflow, type WorkflowExecution } from "@/lib/workflow-demo-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpRight, CheckCircle2, Loader2, Play, RefreshCw, Server, TriangleAlert, XCircle } from "lucide-react";

type ExecutionSortKey = "trigger" | "status" | "duration" | "started" | "finished";

export default function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<ExecutionSortKey>("started");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const supabase = createClient();
    const { data: workflowResponse, error: workflowError } = await supabase.functions.invoke("workflows", { body: { operation: "list" } });
    if (workflowError) {
      setLoadError("No pudimos cargar el workflow. Intenta actualizar la página.");
      setLoading(false);
      return;
    }

    const item = (workflowResponse?.data || []).find((candidate: Record<string, unknown>) => String(candidate.id) === id) as Record<string, unknown> | undefined;
    if (!item) {
      setLoadError("No encontramos este workflow en tu organización.");
      setWorkflow(null);
      setLoading(false);
      return;
    }

    const runtime = (item.runtime_status || {}) as Record<string, unknown>;
    const stats = (item.stats || {}) as Record<string, unknown>;
    const runtimeStatus = ["active", "inactive", "unavailable", "unknown"].includes(String(runtime.status))
      ? String(runtime.status) as Workflow["runtimeStatus"]
      : "unknown";
    const selectedWorkflow: Workflow = {
      id: String(item.id),
      code: String(item.code),
      name: String(item.name),
      description: String(item.description || ""),
      status: runtimeStatus || "unknown",
      runtimeStatus,
      lastRun: formatLastRun(stats.last_run),
      executions: Number(stats.executions || 0).toLocaleString("es-ES"),
      errors: Number(stats.errors || 0),
      avgDuration: formatDuration(stats.avg_duration_ms),
      stats: {
        executions: Number(stats.executions || 0),
        errors: Number(stats.errors || 0),
        avgDurationMs: typeof stats.avg_duration_ms === "number" ? stats.avg_duration_ms : null,
        lastRun: typeof stats.last_run === "string" ? stats.last_run : null,
        lastStatus: typeof stats.last_status === "string" ? stats.last_status : null,
        events: Number(stats.events || 0),
      },
    };
    setWorkflow(selectedWorkflow);

    const { data: executionData, error: executionError } = await (supabase as any)
      .from("workflow_executions")
      .select("id,workflow_id,workflow_code,n8n_execution_id,status,trigger_type,started_at,finished_at,case_id")
      .or(`workflow_id.eq.${id},workflow_code.eq.${selectedWorkflow.code}`)
      .order("started_at", { ascending: false })
      .limit(25);
    if (executionError) {
      setLoadError("El workflow cargó, pero no pudimos cargar sus ejecuciones.");
      setExecutions([]);
    } else {
      setExecutions((executionData || []).map((item: Record<string, unknown>) => ({
        id: String(item.id),
        code: selectedWorkflow.code,
        trigger: String(item.trigger_type || "manual"),
        caseNumber: item.case_id ? "Caso" : "—",
        status: item.status === "success" ? "success" : item.status === "failed" ? "failed" : "running",
        duration: formatExecutionDuration(item.started_at, item.finished_at),
        started: formatDate(item.started_at),
        finished: item.finished_at ? formatDate(item.finished_at) : "En curso",
      })));
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => executions.filter((item) => item.code === workflow?.code), [executions, workflow?.code]);
  const sortedVisible = useMemo(() => [...visible].sort((a, b) => {
    const valueA = executionSortValue(a, sortKey);
    const valueB = executionSortValue(b, sortKey);
    const result = valueA.localeCompare(valueB, "es", { numeric: true });
    return sortDirection === "asc" ? result : -result;
  }), [sortDirection, sortKey, visible]);

  function changeSort(key: ExecutionSortKey, direction: "asc" | "desc") {
    setSortKey(key);
    setSortDirection(direction);
  }

  async function execute() {
    if (!workflow) return;
    setRunning(true);
    setNotice(null);
    try {
      const { error } = await createClient().functions.invoke("workflows", { body: { workflow_code: workflow.code, action_type: "execute_workflow", input_data: { trigger: "manual" } } });
      if (error) throw error;
      setNotice("Workflow enviado a n8n. Actualiza la página cuando recibas el callback.");
    } catch {
      setNotice("No se pudo iniciar el workflow. Revisa la configuración de n8n.");
    } finally {
      setRunning(false);
    }
  }

  if (loading && !workflow) return <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cargando workflow…</div>;
  if (!workflow) return <div className="space-y-6"><Link href="/automations" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />Volver a automatizaciones</Link><Card><CardContent className="p-8 text-center text-sm text-muted-foreground">{loadError || "Workflow no encontrado."}</CardContent></Card></div>;

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/automations" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />Volver a automatizaciones
      </Link>
      <Button asChild variant="outline">
        <Link href="/automations">
          <Server />Ver estado general
        </Link>
      </Button>
    </div>
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[.18em] text-muted-foreground">
          Automations / {workflow.code}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-[-.04em]">{workflow.name}</h1>
          <WorkflowStatus status={workflow.runtimeStatus} />
        </div>
        <p className="mt-1.5 text-muted-foreground">{workflow.description}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Actualizar
        </Button>
        <Button onClick={() => void execute()} disabled={running || workflow.runtimeStatus !== "active"}>
          {running ? <Loader2 className="animate-spin" /> : <Play />}
          Ejecutar ahora
        </Button>
      </div>
    </div>
    {loadError ? <div role="alert" className="rounded-md border border-warning/40 bg-warning/8 px-4 py-3 text-xs text-warning">
      {loadError}
    </div> : null}
    {notice ? <div role="status" className="flex items-center gap-2 rounded-md border bg-info/8 px-4 py-3 text-xs text-info"><Server className="h-4 w-4" />{notice}</div> : null}
    <div className="grid gap-4 sm:grid-cols-4">
      <DetailStat label="Estado" value={workflow.runtimeStatus === "active" ? "Operativo" : workflow.runtimeStatus === "inactive" ? "Inactivo" : "No disponible"} />
      <DetailStat label="Ejecuciones" value={workflow.executions} />
      <DetailStat label="Errores" value={String(workflow.errors)} danger={Boolean(workflow.errors)} />
      <DetailStat label="Duración media" value={workflow.avgDuration} />
    </div>
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-[13px] uppercase tracking-wide">Últimas ejecuciones</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Solo se muestran ejecuciones de {workflow.code}.</p>
            </div>
            <Badge variant="secondary">{sortedVisible.length} registros</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y bg-muted/30">
                  <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3 font-medium">ID</th>
                    <th className="px-3 py-3 font-medium"><SortHeader label="Trigger" column="trigger" sortKey={sortKey} sortDirection={sortDirection} onSort={changeSort} /></th>
                    <th className="px-3 py-3 font-medium">Caso</th>
                    <th className="px-3 py-3 font-medium"><SortHeader label="Estado" column="status" sortKey={sortKey} sortDirection={sortDirection} onSort={changeSort} /></th>
                    <th className="px-3 py-3 font-medium"><SortHeader label="Duración" column="duration" sortKey={sortKey} sortDirection={sortDirection} onSort={changeSort} /></th>
                    <th className="px-3 py-3 font-medium"><SortHeader label="Inicio" column="started" sortKey={sortKey} sortDirection={sortDirection} onSort={changeSort} /></th>
                    <th className="px-3 py-3 font-medium"><SortHeader label="Fin" column="finished" sortKey={sortKey} sortDirection={sortDirection} onSort={changeSort} /></th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sortedVisible.map((execution) => (
                    <tr key={execution.id} className="hover:bg-muted/25">
                      <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{execution.id}</td>
                      <td className="px-3 py-4 text-xs">{execution.trigger}</td>
                      <td className="px-3 py-4 text-xs">{execution.caseNumber}</td>
                      <td className="px-3 py-4"><ExecutionStatus status={execution.status} /></td>
                      <td className="px-3 py-4 font-mono text-xs">{execution.duration}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-xs text-muted-foreground">{execution.started}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-xs text-muted-foreground">{execution.finished}</td>
                      <td className="px-3 py-4"><ArrowUpRight className="h-4 w-4 text-muted-foreground" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sortedVisible.length === 0 && <div className="py-14 text-center text-sm text-muted-foreground">No hay ejecuciones registradas para este workflow.</div>}
          </CardContent>
        </Card>
  </div>;
}

function SortHeader({ label, column, sortKey, sortDirection, onSort }: { label: string; column: ExecutionSortKey; sortKey: ExecutionSortKey; sortDirection: "asc" | "desc"; onSort: (column: ExecutionSortKey, direction: "asc" | "desc") => void }) {
  return <span className="inline-flex items-center gap-1 normal-case">
    <span>{label}</span>
    <span className="inline-flex items-center" role="group" aria-label={`Ordenar ${label}`}>
      <button type="button" aria-label={`Ordenar ${label} ascendente`} aria-pressed={sortKey === column && sortDirection === "asc"} onClick={() => onSort(column, "asc")} className={`rounded p-1 transition-colors hover:bg-muted ${sortKey === column && sortDirection === "asc" ? "text-foreground" : "text-muted-foreground/50"}`}><ArrowUp className="h-3 w-3" /></button>
      <button type="button" aria-label={`Ordenar ${label} descendente`} aria-pressed={sortKey === column && sortDirection === "desc"} onClick={() => onSort(column, "desc")} className={`rounded p-1 transition-colors hover:bg-muted ${sortKey === column && sortDirection === "desc" ? "text-foreground" : "text-muted-foreground/50"}`}><ArrowDown className="h-3 w-3" /></button>
    </span>
  </span>;
}

function executionSortValue(execution: WorkflowExecution, key: ExecutionSortKey) {
  if (key === "trigger") return execution.trigger;
  if (key === "status") return execution.status;
  if (key === "duration") return execution.duration;
  if (key === "started") return execution.started;
  return execution.finished;
}

function WorkflowStatus({ status }: 
  { status?: Workflow["runtimeStatus"] }) { 
    if (status === "active") return 
    <Badge variant="success">
      <CheckCircle2 className="mr-1 h-3 w-3" />Operativo
    </Badge>; 
    if (status === "inactive") return 
     <Badge variant="secondary">
      <XCircle className="mr-1 h-3 w-3" />Inactivo
     </Badge>; 
    return (
     <Badge variant="danger">
      <XCircle className="mr-1 h-3 w-3" />No disponible
     </Badge>
    ); 
  }
function ExecutionStatus({ status }: 
  { status: WorkflowExecution["status"] }) 
  { if (status === "success") return 
    <Badge variant="success">
      <CheckCircle2 className="mr-1 h-3 w-3" />Correcta
    </Badge>; 
    if (status === "failed") return 
    <Badge variant="danger">
      <TriangleAlert className="mr-1 h-3 w-3" />Fallida
    </Badge>; 
    return (
    <Badge variant="info">
      <Loader2 className="mr-1 h-3 w-3 animate-spin" />En curso
    </Badge>
    ); 
  }
function DetailStat({ label, value, danger }: 
  { label: string; value: string; danger?: boolean }) 
  { return (
  <Card>
    <CardContent className="p-4">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 font-mono text-xl font-semibold tabular-nums ${danger ? "text-destructive" : ""}`}>{value}</p>
    </CardContent>
  </Card>
  ); }
function formatDate(value: unknown) {
  if (typeof value !== "string") return "—";
  return new Date(value).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
}
function formatLastRun(value: unknown) { 
  if (typeof value !== "string") return "Sin ejecuciones"; 
  const minutes = Math.floor((Date.now() - new Date(value).getTime()) / 60000); 
  if (!Number.isFinite(minutes) || minutes < 1) return "Ahora"; 
  if (minutes < 60) return `hace ${minutes} min`; 
  if (minutes < 1440) return `hace ${Math.floor(minutes / 60)} h`; 
  return `hace ${Math.floor(minutes / 1440)} d`; 
}
function formatDuration(value: unknown) { 
  if (typeof value !== "number" || !Number.isFinite(value)) return "Sin datos"; 
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`; 
}
function formatExecutionDuration(started: unknown, finished: unknown) { 
  if (typeof started !== "string" || typeof finished !== "string") return "—"; 
  const duration = new Date(finished).getTime() - new Date(started).getTime(); 
  return duration >= 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`; 
}
