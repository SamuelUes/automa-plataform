"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeTable } from "@/lib/supabase/realtime";
import { demoWorkflowDefinitions, type Workflow } from "@/lib/workflow-demo-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, ArrowUpRight, CheckCircle2, Clock3, GitBranch, Loader2, MoreHorizontal, RefreshCw, Server, TriangleAlert, XCircle } from "lucide-react";

export default function AutomationsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>(demoWorkflowDefinitions);
  const [syncing, setSyncing] = useState(false);
  const load = useCallback(async () => {
    setSyncing(true);
    const { data } = await createClient().functions.invoke("workflows", { body: { operation: "list" } });
    if (data?.data?.length) {
      setWorkflows(data.data.map((item: Record<string, unknown>) => ({ ...item, id: String(item.id), code: String(item.code), name: String(item.name), description: String(item.description || ""), status: "success", lastRun: "sin datos", executions: "—", errors: 0, avgDuration: "—" })) as Workflow[]);
    }
    setSyncing(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const handleRealtime = useCallback(() => { void load(); }, [load]);
  useRealtimeTable("workflow_executions", handleRealtime);
  const operational = workflows.filter((workflow) => workflow.status === "success").length;

  return (
  <div className="space-y-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="font-mono text-[11px] uppercase tracking-[.18em] text-muted-foreground mb-3">Operations / Orchestration</p><h1 className="text-3xl font-semibold tracking-[-.04em]">Automatizaciones</h1><p className="text-muted-foreground mt-1.5">Observa el motor operativo que conecta agentes, n8n y Supabase.</p></div><Button variant="outline" onClick={() => void load()} disabled={syncing}>{syncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}Sincronizar estado</Button></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Stat icon={<Server />} value={<>{operational}
      <span className="text-sm font-normal text-muted-foreground">/{workflows.length}</span></>} label="Workflows operativos" />
      <Stat icon={<TriangleAlert />} value={workflows.reduce((sum, workflow) => sum + workflow.errors, 0)} label="Errores recientes" tone="warning" />
      <Stat icon={<Activity />} value="7,557" label="Ejecuciones este mes" tone="info" />
    </div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{workflows.map((workflow) => <Card key={workflow.id} className={`group hover:border-foreground/30 transition-colors ${workflow.status === "failed" ? "border-destructive/35" : ""}`}>
     <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center"><GitBranch className="h-4 w-4 text-muted-foreground" /></div>
          <div>
            <p className="font-mono text-[10px] text-muted-foreground">{workflow.code}</p>
            <h2 className="text-sm font-semibold mt-0.5">{workflow.name}</h2>
          </div>
        </div>
        <button aria-label="Más opciones" className="text-muted-foreground"><MoreHorizontal className="h-4 w-4" /></button>
      </div>
      <p className="text-xs text-muted-foreground mt-5 leading-relaxed">{workflow.description}</p>
      <div className="mt-5 flex items-center justify-between">
        {workflow.status === "failed" ? <Badge variant="danger"><XCircle className="h-3 w-3 mr-1" />Requiere atención</Badge> : <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1" />Operativo</Badge>}
        <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock3 className="h-3 w-3" />{workflow.lastRun}</span>
      </div>
      <div className="grid grid-cols-3 border-t mt-4 pt-4 gap-2">
        <Metric value={workflow.executions} label="Ejecuciones" />
        <Metric value={workflow.errors} label="Errores" danger={Boolean(workflow.errors)} />
        <Metric value={workflow.avgDuration} label="Promedio" />
      </div>
      <Link href={`/automations/${workflow.id}`} className="mt-4 flex items-center justify-between text-xs text-muted-foreground hover:text-foreground">
        <span>Ver ejecuciones</span>
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </CardContent>
  </Card>)}</div>
  </div> 
  );
}
function Stat({ icon, value, label, tone = "success" }: { icon: React.ReactNode; value: React.ReactNode; label: string; tone?: string }) 
{ 
  return <Card>
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`h-9 w-9 rounded-lg bg-${tone}/12 text-${tone} flex items-center justify-center`}>{icon}</div>
      <div>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </CardContent>
  </Card>; 
}
function Metric({ value, label, danger }: { value: React.ReactNode; label: string; danger?: boolean }) 
{ return <div><p className={`font-mono text-sm ${danger ? "text-destructive" : ""}`}>{value}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
          </div>; }
