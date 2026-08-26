"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createAction, getOperationError } from "@/lib/actions";
import { DelegationForm, type DelegationFormValues } from "@/components/dashboard/delegation-form";
import { OperationDialog, OperationDialogContent, OperationDialogDescription, OperationDialogHeader, OperationDialogTitle } from "@/components/dashboard/operation-dialog";
import { demoDelegations, type Delegation } from "@/lib/phase5-demo-data";
import { formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BriefcaseBusiness, Check, MoreHorizontal, Plus } from "lucide-react";

export default function DelegationsPage() {
  const [delegations, setDelegations] = useState<Delegation[]>(demoDelegations);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "completed">("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const visible = useMemo(() => delegations.filter((item) => item.status === filter), [delegations, filter]);
  async function createDelegation(values: DelegationFormValues) {
    setSaving(true);
    try { await createAction("delegate_case", { case_id: values.case_id, input_data: values }); toast.success("Delegación enviada a procesamiento."); setDialogOpen(false); }
    catch (error) { toast.error(getOperationError(error)); }
    finally { setSaving(false); }
  }
  useEffect(() => { (async () => { const { data } = await (createClient() as any).from("delegations").select("id,case_id,assigned_to,assigned_by,department_id,reason,status,created_at").order("created_at", { ascending: false }); 
  if (data?.length) setDelegations(data.map((item: any) => ({ 
    ...item, 
    caseId: item.case_id, 
    caseNumber: 0, 
    title: "Caso delegado", 
    assignee: "Responsable", 
    department: "Departamento", 
    delegatedBy: "Usuario", 
    createdAt: item.created_at, 
    status: item.status === "completed" ? "completed" : "active" 
  }))); })(); }, []);
  
  async function complete(item: Delegation) { setProcessing(item.id); 
    try { 
      if (item.id.startsWith("delegation-")) { 
        setDelegations((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "completed" } : entry)); 
        toast.success("Delegación completada en la vista demo; no se guardó en Supabase."); 
      } else { 
        await createAction("delegate_case", { case_id: item.caseId || undefined, input_data: { delegation_id: item.id, status: "completed" } }); 
        setDelegations((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "completed" } : entry)); 
        toast.success("Delegación completada."); 
      } 
    } catch (error) { toast.error(getOperationError(error)); } finally { setProcessing(null); } }
  
  return ( 
  <div className="space-y-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="font-mono text-[11px] uppercase tracking-[.18em] text-muted-foreground mb-3">Operations / Ownership</p>
       <h1 className="text-3xl font-semibold tracking-[-.04em]">Delegaciones</h1>
        
        <p className="text-muted-foreground mt-1.5">Mantén claro quién tiene cada asunto y por qué.</p>
        
        </div>
        
         <Button onClick={() => setDialogOpen(true)}>
          <Plus />Delegar caso
         </Button>
         
         <OperationDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <OperationDialogContent>
            <OperationDialogHeader>
              <OperationDialogTitle>Delegar caso</OperationDialogTitle>
              <OperationDialogDescription>Asigna un caso a un responsable.</OperationDialogDescription>
            </OperationDialogHeader>
            <DelegationForm onSubmit={createDelegation} onCancel={() => setDialogOpen(false)} submitting={saving} />
          </OperationDialogContent>
         </OperationDialog>
         
         </div>
         <div className="flex gap-2">
          <Button variant={filter === "active" ? "secondary" : "outline"} size="sm" onClick={() => setFilter("active")}>Activas 
            <span className="font-mono text-[10px] ml-1">{delegations.filter((item) => item.status === "active").length}</span>
          </Button>
          
          <Button variant={filter === "completed" ? "secondary" : "outline"} size="sm" onClick={() => setFilter("completed")}>Completadas 
            <span className="font-mono text-[10px] ml-1">{delegations.filter((item) => item.status === "completed").length}</span>
          </Button>
             </div>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/30">
                     <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 py-3 font-medium">Caso</th>
                      <th className="px-3 py-3 font-medium">Responsable</th>
                      <th className="px-3 py-3 font-medium">Departamento</th>
                      <th className="px-3 py-3 font-medium">Quién delegó</th>
                      <th className="px-3 py-3 font-medium">Fecha</th>
                      <th className="px-3 py-3 font-medium">Estado</th>
                      <th />

                      </tr>
                      </thead>
                       <tbody className="divide-y">{visible.map((item) => <tr key={item.id} className="group hover:bg-muted/25">
                         <td className="px-5 py-4 min-w-65">
                          <p className="text-xs font-medium">{item.title}</p>
                          <p className="text-[11px] text-muted-foreground font-mono mt-1">Caso #{item.caseNumber}</p>
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="h-6 w-6 rounded-full bg-[#d7e7e2] text-[#28584e] flex items-center justify-center text-[10px] font-semibold">
                                {item.assignee.split(" ").map((part) => part[0]).join("").slice(0, 2)}
                              </span>
                              {item.assignee}
                            </div>
                          </td>
                          <td className="px-3 py-4 text-xs text-muted-foreground">{item.department}</td>
                          <td className="px-3 py-4 text-xs text-muted-foreground">{item.delegatedBy}</td>
                          <td className="px-3 py-4 text-xs text-muted-foreground whitespace-nowrap">{formatRelativeTime(item.createdAt)}</td>
                          <td className="px-3 py-4">
                            {item.status === "active" ? 
                              <Badge variant="info">Activa</Badge> : 
                              <Badge variant="success">
                                <Check className="h-3 w-3 mr-1" />
                                Completada
                              </Badge>
                            }
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                              {item.status === "active" && (
                                <Button size="sm" variant="outline" onClick={() => void complete(item)} disabled={processing === item.id}>
                                  {processing === item.id ? "Guardando..." : "Completar"}
                                </Button>
                              )}
                              <button aria-label="Más opciones" 
                                onClick={() => toast.info("No hay acciones adicionales disponibles para esta delegación.")}>
                                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                              </button>
                            </div>
                          </td>
                        </tr>)}
                      </tbody>
                    </table>
                  </div>
                </Card>
                <div className="grid gap-3 md:grid-cols-3">
                  {delegations.map((item) => (
                    <Card key={`reason-${item.id}`} className="md:hidden">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                          <BriefcaseBusiness className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono text-[10px] text-muted-foreground">CASO #{item.caseNumber}</span>
                        </div>
                        <p className="text-sm font-medium mt-3">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-2">{item.reason}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
}
