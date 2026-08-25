"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createAction } from "@/lib/actions";
import { formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, CheckCircle2, FileCheck2, Mail, MoreHorizontal, Pencil, ShieldAlert, Sparkles, X } from "lucide-react";

type Approval = { id: string; caseId: string; caseNumber: number; title: string; company: string; requestedAt: string; draft: string; reason: string; priority: "urgent" | "high"; status: "pending" | "approved" | "rejected" };
const initialApprovals: Approval[] = [{ id: "approval-184", caseId: "demo-184", caseNumber: 184, title: "Respuesta a propuesta comercial", company: "ABC Corporation", requestedAt: new Date(Date.now() - 12 * 60000).toISOString(), draft: "Estimada Mariana,\n\nGracias por compartir la propuesta. Confirmamos que podemos autorizar el monto de $12,500 bajo las condiciones indicadas. Nuestro equipo dará seguimiento a los siguientes pasos.", reason: "La respuesta contiene una autorización comercial y requiere validación humana antes del envío.", priority: "urgent", status: "pending" }, { id: "approval-181", caseId: "demo-181", caseNumber: 181, title: "Confirmación de contrato marco", company: "Vértice SA", requestedAt: new Date(Date.now() - 2 * 3600000).toISOString(), draft: "Hola Andrés,\n\nHemos revisado la última versión del contrato marco y confirmamos que está lista para firma.", reason: "El documento fue revisado por el agente y está listo para confirmación.", priority: "high", status: "pending" }, { id: "approval-180", caseId: "demo-180", caseNumber: 180, title: "Respuesta sobre datos fiscales", company: "Atlas Trading", requestedAt: new Date(Date.now() - 5 * 3600000).toISOString(), draft: "Hola Lucía,\n\nHemos recibido correctamente los documentos fiscales. Procederemos con la actualización de la cuenta.", reason: "La respuesta modifica información de cuenta del cliente.", priority: "high", status: "pending" }];

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState(initialApprovals);
  const [selectedId, setSelectedId] = useState(initialApprovals[0].id);
  const [processing, setProcessing] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  useEffect(() => { (async () => { const { data } = await (createClient() as any).from("approvals").select("id,case_id,status,requested_at,decision,comment").eq("status", "pending").order("requested_at", { ascending: true }); if (data?.length) setApprovals(data.map((row: any) => 
    ({ id: row.id, 
      caseId: row.case_id, 
      caseNumber: 0, 
      title: "Aprobación pendiente", 
      company: "Cliente", 
      requestedAt: row.requested_at, 
      draft: "Borrador disponible en el correo relacionado.", 
      reason: "Requiere validación humana.", 
      priority: "high", 
      status: "pending" 
    }))); })(); }, []);

  const selected = approvals.find((approval) => approval.id === selectedId) || approvals[0];
  async function decide(approval: Approval, decision: "approve_email" | "reject_approval") {
    setProcessing(approval.id); 
    setFeedback(null); 
    try { 
      await createAction(decision, { case_id: approval.caseId.startsWith("demo-") ? undefined : approval.caseId, approval_id: approval.id, input_data: { decision } }); 
      setApprovals((current) => current.map((item) => item.id === approval.id ? { ...item, status: decision === "approve_email" ? "approved" : "rejected" } : item)); 
      setFeedback(decision === "approve_email" ? "Aprobación creada. PE03 procesará el envío." : "Aprobación rechazada. El caso permanece sin cambios."); 
    } catch { 
      setFeedback("No se pudo ejecutar la acción. El caso permanece sin cambios."); 
    } finally { 
      setProcessing(null); 
    } 
  }
  return (
  <div className="space-y-7">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[.18em] text-muted-foreground mb-3">Operations / Human loop</p>
        <h1 className="text-3xl font-semibold tracking-[-.04em]">Aprobaciones pendientes</h1>
        <p className="text-muted-foreground mt-1.5">Revisa las recomendaciones de los agentes antes de que se conviertan en acciones.</p>
      </div>
        <Badge variant="warning">
          <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
          {approvals.filter((a) => a.status === "pending").length} requieren tu atención
        </Badge>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
        <div className="space-y-3">{approvals.map((approval) => 
          <Card key={approval.id} className={`transition-colors ${selected?.id === approval.id ? "border-foreground/35" : ""} ${approval.status !== "pending" ? "opacity-65" : ""}`}>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-warning/12 text-warning flex items-center justify-center shrink-0">
                  <FileCheck2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-2 flex-wrap">
                   <span className="font-mono text-[10px] text-muted-foreground">CASO #{approval.caseNumber}</span>
                   <Badge variant={approval.priority === "urgent" ? "danger" : "warning"}>
                     {approval.priority === "urgent" ? "Urgente" : "Alta"}
                   </Badge>{approval.status !== "pending" && <Badge variant="success">
                     <CheckCircle2 className="h-3 w-3 mr-1" />
                     {approval.status === "approved" ? "Aprobada" : "Rechazada"}</Badge>}
                </div>
              <h2 className="font-medium text-sm mt-2">{approval.title}</h2>
              <p className="text-xs text-muted-foreground mt-1">{approval.company} · solicitada {formatRelativeTime(approval.requestedAt)}</p>
              </div>
              <button aria-label="Más opciones">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </button>
              </div>
              <div className="mt-5 rounded-md bg-muted/40 border-l-2 border-warning/50 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Motivo del agente</p>
                  <p className="text-xs leading-relaxed">{approval.reason}</p>
              </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedId(approval.id)}>
                    <Pencil />Revisar borrador
                  </Button>{approval.status === "pending" && <>
                  <Button size="sm" onClick={() => decide(approval, "approve_email")} disabled={processing === approval.id}>
                    <Check />{processing === approval.id ? "Enviando..." : "Aprobar y enviar"}
                  </Button>
                  
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => decide(approval, "reject_approval")} disabled={processing === approval.id}>
                    <X />Rechazar
                  </Button></>}
                  
                  </div>
                  
                  </CardContent>
                   </Card>)}
                    </div>{selected && <Card className="h-fit sticky top-24">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 pb-4 border-b">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-xs font-semibold">Borrador de respuesta</p>
                            <p className="text-[11px] text-muted-foreground">Caso #{selected.caseNumber} · {selected.company}</p>
                          </div>
                        </div>
                        <div className="mt-5">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Contenido propuesto</p>
                          <div className="rounded-md border bg-muted/20 p-4 text-xs leading-6 whitespace-pre-line">{selected.draft}</div>
                        </div>
                        <div className="mt-5 rounded-md border bg-[#d7e7e2]/35 p-3">
                          <div className="flex gap-2">
                            <Sparkles className="h-4 w-4 text-[#28584e] shrink-0" />
                            <p className="text-xs leading-relaxed text-[#28584e]">La IA ha validado el tono, los datos del cliente y la intención de respuesta. No se muestra razonamiento interno.</p>
                          </div>
                        </div>
                        <div className="mt-5 flex gap-2">
                          <Button variant="outline" className="flex-1">
                            <Pencil />Editar
                          </Button>
                          <Link href={`/cases/${selected.caseId}`} className="flex-1">
                            <Button variant="outline" className="w-full">
                              <ArrowUpRightIcon />Ver caso
                            </Button>
                          </Link>
                        </div>
                        {feedback && (
                          <p role="status" className="text-xs text-muted-foreground mt-4 flex gap-2">
                            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                            {feedback}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  }
                </div>
              </div>
  );
}

function ArrowUpRightIcon() { return <span className="text-sm">↗</span>; }
