"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createAction, getOperationError } from "@/lib/actions";
import { ActionCenter } from "@/components/dashboard/action-center";
import { DelegationForm, type DelegationFormValues } from "@/components/dashboard/delegation-form";
import { OperationDialog, OperationDialogContent, OperationDialogDescription, OperationDialogHeader, OperationDialogTitle } from "@/components/dashboard/operation-dialog";
import { type Delegation } from "@/lib/phase5-demo-data";
import { formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { BriefcaseBusiness, Check, MoreHorizontal, Plus, UserRound } from "lucide-react";

export default function DelegationsPage() {
  const router = useRouter();
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [actionItem, setActionItem] = useState<Delegation | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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
  useEffect(() => { void (async () => {
    const { data, error } = await (createClient() as any).from("delegations").select("id,case_id,assigned_to,assigned_by,department_id,reason,status,created_at,cases(case_number,title),users!delegations_assigned_to_fkey(full_name),departments(name)").order("created_at", { ascending: false });
    setLoading(false);
    setLoadError(Boolean(error));
    setDelegations(data?.map((item: any) => {
      const relatedCase = Array.isArray(item.cases) ? item.cases[0] : item.cases;
      const assignee = Array.isArray(item.users) ? item.users[0] : item.users;
      const department = Array.isArray(item.departments) ? item.departments[0] : item.departments;
      return {
        ...item,
        caseId: item.case_id,
        caseNumber: relatedCase?.case_number || 0,
        title: relatedCase?.title || "Caso delegado",
        assignee: assignee?.full_name || "Sin responsable",
        department: department?.name || "Sin departamento",
        delegatedBy: "Equipo de operaciones",
        createdAt: item.created_at,
        status: item.status === "completed" ? "completed" : "active",
      };
    }) ?? []);
  })(); }, []);
  
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
      setActionItem(null);
    } catch (error) { toast.error(getOperationError(error)); } finally { setProcessing(null); } }
  
  return ( 
  <>
  <ActionCenter
    open={Boolean(actionItem)}
    onOpenChange={(open) => { if (!open) setActionItem(null); }}
    title="Opciones de la delegación"
    description={actionItem ? `${actionItem.title}. Elige una acción.` : "Elige una acción."}
    actions={actionItem ? [
      { id: "complete", label: "Completar delegación", description: "Confirma que la responsabilidad ya fue atendida.",
        workflow: "PE04",
        icon: <Check className="h-4 w-4" />,
        onSelect: () => void complete(actionItem) },
      { id: "case", label: "Abrir caso", description: "Consulta el contexto completo del asunto delegado.",
        icon: <BriefcaseBusiness className="h-4 w-4" />,
        onSelect: () => { router.push(`/cases/${actionItem.caseId}`); setActionItem(null); } },
      { id: "reassign", label: "Preparar reasignación", description: "Abre el formulario para transferir la responsabilidad.",
        workflow: "PE04",
        icon: <UserRound className="h-4 w-4" />,
        onSelect: () => { setActionItem(null); setDialogOpen(true); } },
    ] : []}
  />
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
              {loading ? <Card><LoadingState compact label="Cargando delegaciones..." /></Card> : null}
              {loadError ? <Card><ErrorState compact message="No pudimos cargar las delegaciones." /></Card> : null}
              {!loading && !loadError && visible.length === 0 ? <Card><EmptyState compact title="Sin delegaciones" description="No hay delegaciones en esta vista." /></Card> : null}
              <Card className={`hidden overflow-hidden md:block ${loading || loadError || visible.length === 0 ? "md:hidden" : ""}`}>
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
                              <button aria-label="Más opciones" onClick={() => setActionItem(item)}>
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
                  {visible.map((item) => (
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
  </>
            );
}
