"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeTable } from "@/lib/supabase/realtime";
import { demoExecutions, demoWorkflowDefinitions, type Workflow, type WorkflowExecution } from "@/lib/workflow-demo-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowUpRight, CheckCircle2, Loader2, Play, RefreshCw, Server, TriangleAlert, XCircle } from "lucide-react";

export default function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [workflow] = useState<Workflow>(demoWorkflowDefinitions.find((item) => item.id === id) || demoWorkflowDefinitions[1]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>(demoExecutions);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await (createClient() as any).from("workflow_executions").select("id,n8n_execution_id,status,trigger_type,started_at,finished_at,case_id").order("started_at", { ascending: false }).limit(25);
    if (data?.length) {
      setExecutions(data.map((item: any) => ({ id: item.id, code: workflow.code, trigger: item.trigger_type || "manual", caseNumber: item.case_id ? "Caso" : "—", status: item.status === "success" ? "success" : item.status === "failed" ? "failed" : "running", duration: "—", started: item.started_at, finished: item.finished_at || "En curso" })));
    }
  }, [workflow.code]);

  useEffect(() => { void load(); }, [load]);
  useRealtimeTable("workflow_executions", load);

  const visible = useMemo(() => executions.filter((item) => item.code === workflow.code), [executions, workflow.code]);

  async function execute() {
    setRunning(true); setNotice(null);
    try {
      const { error } = await createClient().functions.invoke("workflows", { body: { workflow_code: workflow.code, action_type: "execute_workflow", input_data: { trigger: "manual" } } });
      if (error) throw error;
      setNotice("Workflow enviado a n8n. La ejecución aparecerá aquí al recibir el evento.");
    } catch { setNotice("No se pudo iniciar el workflow. Revisa la configuración de n8n."); }
    finally { setRunning(false); }
  }

  return <div className="space-y-6">
    <Link href="/automations" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />Volver a automatizaciones</Link>
    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
      <div><p className="font-mono text-[11px] uppercase tracking-[.18em] text-muted-foreground mb-3">Automations / {workflow.code}</p><div className="flex items-center gap-3"><h1 className="text-3xl font-semibold tracking-[-.04em]">{workflow.name}</h1>{workflow.status === "failed" ? <Badge variant="danger"><XCircle className="h-3 w-3 mr-1" />Requiere atención</Badge> : <Badge variant="success"><CheckCircle2 className="h-3 w-3 mr-1" />Operativo</Badge>}</div><p className="text-muted-foreground mt-1.5">{workflow.description}</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => void load()}><RefreshCw />Actualizar</Button><Button onClick={() => void execute()} disabled={running}>{running ? <Loader2 className="animate-spin" /> : <Play />}Ejecutar ahora</Button></div>
    </div>
    {notice && <div role="status" className="rounded-md border bg-info/8 text-info px-4 py-3 text-xs flex items-center gap-2"><Server className="h-4 w-4" />{notice}</div>}
    <div className="grid gap-4 sm:grid-cols-4">{[["Estado", workflow.status === "failed" ? "Degradado" : "Operational"], ["Ejecuciones", workflow.executions], ["Errores", String(workflow.errors)], ["Duración media", workflow.avgDuration]].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className={`text-xl font-semibold font-mono mt-2 ${label === "Errores" && workflow.errors ? "text-destructive" : ""}`}>{value}</p></CardContent></Card>)}</div>
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="text-[13px] uppercase tracking-wide">Últimas ejecuciones</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Actualización en tiempo real desde Supabase.</p>
        </div>
        <Badge variant="secondary"><span className="h-1.5 w-1.5 rounded-full bg-success mr-1.5" />Live</Badge>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-y bg-muted/30">
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">ID</th>
                <th className="px-3 py-3 font-medium">Trigger</th>
                <th className="px-3 py-3 font-medium">Caso</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Duration</th>
                <th className="px-3 py-3 font-medium">Started</th>
                <th className="px-3 py-3 font-medium">Finished</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((execution) => (
                <tr key={execution.id} className="hover:bg-muted/25">
                  <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{execution.id}</td>
                  <td className="px-3 py-4 text-xs">{execution.trigger}</td>
                  <td className="px-3 py-4 text-xs">{execution.caseNumber}</td>
                  <td className="px-3 py-4">
                    {execution.status === "success" ? (
                      <Badge variant="success">
                        <CheckCircle2 className="h-3 w-3 mr-1" />Success
                      </Badge>
                    ) : execution.status === "failed" ? (
                      <Badge variant="danger">
                        <TriangleAlert className="h-3 w-3 mr-1" />Failed
                      </Badge>
                    ) : (
                      <Badge variant="info">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />Running
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-4 font-mono text-xs">{execution.duration}</td>
                  <td className="px-3 py-4 text-xs text-muted-foreground whitespace-nowrap">{execution.started}</td>
                  <td className="px-3 py-4 text-xs text-muted-foreground whitespace-nowrap">{execution.finished}</td>
                  <td className="px-3 py-4">
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && <div className="py-14 text-center text-sm text-muted-foreground">No hay ejecuciones registradas para este workflow.</div>}
      </CardContent>
    </Card>
  </div>;
}
