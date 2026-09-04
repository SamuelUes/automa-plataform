"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createAction, getOperationError } from "@/lib/actions";
import { FollowUpForm, type FollowUpFormValues } from "@/components/dashboard/follow-up-form";
import { OperationDialog, OperationDialogContent, OperationDialogDescription, OperationDialogHeader, OperationDialogTitle } from "@/components/dashboard/operation-dialog";
import { type FollowUp } from "@/lib/phase5-demo-data";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { CalendarClock, Check, Clock3, MoreHorizontal, Play, Plus } from "lucide-react";

const statusLabel = { overdue: "Vencido", today: "Hoy", upcoming: "Próximo", completed: "Completado" };
function getFollowUpStatus(status: string, scheduledFor: string): FollowUp["status"] {
  if (status === "completed") return "completed";
  const scheduled = new Date(scheduledFor);
  const now = new Date();
  if (scheduled.getTime() < now.getTime()) return "overdue";
  if (scheduled.toDateString() === now.toDateString()) return "today";
  return "upcoming";
}
export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [filter, setFilter] = useState("all");
  const [processing, setProcessing] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  async function createFollowUp(values: FollowUpFormValues) {
    setProcessing("new");
    try { await createAction("schedule_follow_up", { 
      case_id: values.case_id, 
      input_data: { 
        ...values, 
        scheduled_for: new Date(values.scheduled_for).toISOString() 
      } 
    }); toast.success("Seguimiento enviado a procesamiento."); setDialogOpen(false); }
    catch (error) { toast.error(getOperationError(error)); }
    finally { setProcessing(null); }
  }
  useEffect(() => { 
    (async () => { 
      const { data, error } = await (createClient() as any).from("follow_ups").select("id,case_id,scheduled_for,reason,status,created_at,cases(case_number,title,contacts(company),users(full_name))").order("scheduled_for");
      setLoading(false);
      setLoadError(Boolean(error));
      setFollowUps(data?.map((item: any) => {
        const relatedCase = Array.isArray(item.cases) ? item.cases[0] : item.cases;
        const contact = Array.isArray(relatedCase?.contacts) ? relatedCase.contacts[0] : relatedCase?.contacts;
        const owner = Array.isArray(relatedCase?.users) ? relatedCase.users[0] : relatedCase?.users;
        return {
          ...item,
          caseId: item.case_id,
          caseNumber: relatedCase?.case_number || 0,
          title: relatedCase?.title || "Seguimiento de caso",
          company: contact?.company || "Cliente sin empresa",
          reason: item.reason || "Seguimiento pendiente",
          scheduledFor: item.scheduled_for,
          owner: owner?.full_name || "Sin responsable",
          status: getFollowUpStatus(item.status, item.scheduled_for),
        };
      }) ?? []);
    })(); 
  }, []);
  const visible = useMemo(() => followUps.filter((item) => filter === "all" || item.status === filter), [followUps, filter]);
  async function runAction(item: FollowUp, action: "schedule_follow_up" | "resolve_case") { setProcessing(item.id); 
    try { await createAction(action, { 
      case_id: item.caseId || undefined, 
      input_data: { follow_up_id: item.id } 
    }); 
    if (action === "resolve_case") setFollowUps((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "completed" } : entry)); 
    } finally { setProcessing(null); } }
  
  return (
  <div className="space-y-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[.18em] text-muted-foreground mb-3">Operations / Cadence</p>
        <h1 className="text-3xl font-semibold tracking-[-.04em]">Seguimientos</h1>
        <p className="text-muted-foreground mt-1.5">No dejes que una promesa importante se pierda en el tiempo.</p>
      </div>
      <Button onClick={() => setDialogOpen(true)}><Plus />Nuevo seguimiento</Button>
      
       <OperationDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <OperationDialogContent>
          <OperationDialogHeader>
            <OperationDialogTitle>Nuevo seguimiento</OperationDialogTitle>
            <OperationDialogDescription>Programa una acción para un caso.</OperationDialogDescription>
          </OperationDialogHeader>
          <FollowUpForm onSubmit={createFollowUp} onCancel={() => setDialogOpen(false)} submitting={processing === "new"} />
        </OperationDialogContent>
       </OperationDialog>
      </div>
        
       <div className="flex flex-wrap gap-2">{[["all", "Todos"], 
          ["overdue", "Vencidos"], 
          ["today", "Hoy"], 
          ["upcoming", "Próximos"], 
          ["completed", "Completados"]].map(([key, label]) => <Button key={key} size="sm" variant={filter === key ? "secondary" : "outline"} 
         onClick={() => setFilter(key)}>{label}
         <span className="font-mono text-[10px] ml-1"> {key === "all" ? followUps.length : followUps.filter((item) => item.status === key).length}</span>
          </Button>)}
       </div>
       {loading ? 
       <Card>
         <LoadingState compact label="Cargando seguimientos..." />
       </Card> : null}
       {loadError ? 
       <Card>
         <ErrorState compact message="No pudimos cargar los seguimientos." />
       </Card> : null}
       <div className={loading || loadError ? "hidden" : "space-y-3"}>
        {visible.map((item) => 
        <Card key={item.id} className={item.status === "overdue" ? "border-destructive/30" : ""}>
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${item.status === "overdue" ? "bg-destructive/10 text-destructive" : item.status === "completed" ? "bg-success/10 text-success" : "bg-info/10 text-info"}`}>
                <CalendarClock className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10px] text-muted-foreground">CASO #{item.caseNumber}</span>
                  <Badge variant={item.status === "overdue" ? "danger" : item.status === "completed" ? "success" : item.status === "today" ? "warning" : "info"}>
                    {item.status === "overdue" ? <Clock3 className="h-3 w-3 mr-1" /> : item.status === "completed" ? <Check className="h-3 w-3 mr-1" /> : null}
                    {statusLabel[item.status]}
                  </Badge>
                </div>
                <h2 className="text-sm font-semibold mt-2">{item.title}</h2>
                <p className="text-xs text-muted-foreground mt-1">{item.company} · {item.reason}</p>
              </div>
              <div className="flex items-center gap-2 lg:w-52.5">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Programado</p>
                  <p className="text-xs font-medium mt-1">{formatDateTime(item.scheduledFor)}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{item.owner}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 lg:ml-auto">
                {item.status !== "completed" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => void runAction(item, "schedule_follow_up")} disabled={processing === item.id}>
                      <Play />Ejecutar ahora
                    </Button>
                    <Button size="sm" onClick={() => void runAction(item, "resolve_case")} disabled={processing === item.id}>
                      <Check />Completar
                    </Button>
                  </>
                )}
                <Button size="icon" variant="ghost" aria-label="Más opciones" 
                  onClick={() => toast.info("No hay acciones adicionales disponibles para este seguimiento.")}>
                  <MoreHorizontal />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>)}
        </div>
        {!loading && !loadError && visible.length === 0 ? 
        <Card>
          <EmptyState compact title="Sin seguimientos" description="No hay seguimientos en esta vista." />
        </Card> : null}
      </div>
  );
}
