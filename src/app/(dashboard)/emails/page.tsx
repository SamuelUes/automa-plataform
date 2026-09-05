"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { demoEmails, type DemoEmail } from "@/lib/email-demo-data";
import { formatRelativeTime } from "@/lib/utils";
import { createAction, getOperationError } from "@/lib/actions";
import { isDemoId } from "@/components/dashboard/action-feedback";
import { EmailComposeForm, type EmailComposeValues } from "@/components/dashboard/email-compose-form";
import { OperationDialog, OperationDialogContent, OperationDialogDescription, OperationDialogHeader, OperationDialogTitle } from "@/components/dashboard/operation-dialog";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { PriorityBadge } from "@/components/cases/status-badge";
import { ActionCenter } from "@/components/dashboard/action-center";
import { Archive, ArrowUpRight, BriefcaseBusiness, ChevronLeft, FileCheck2, Inbox, Mail, MoreHorizontal, Paperclip, Reply, Search, SlidersHorizontal, Star } from "lucide-react";

const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function EmailsPage() {
  const router = useRouter();
  const [emails, setEmails] = useState<DemoEmail[]>(demoMode ? demoEmails : []);
  const [selectedId, setSelectedId] = useState(demoMode ? demoEmails[0].id : "");
  const [mobilePanel, setMobilePanel] = useState<"inbox" | "detail">("inbox");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [actionCenterOpen, setActionCenterOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<"new" | "reply" | "forward">("new");
  const [sending, setSending] = useState(false);
  async function sendEmail(values: EmailComposeValues) {
    setSending(true);
    try { 
      if (isDemoId(selected?.id)) toast.success("Correo simulado; no se guardó en Supabase."); 
      else { 
        await createAction("send_email", { 
          case_id: selected?.caseId || null, 
          message_id: selected?.id, 
          input_data: values 
        }); 
        toast.success("Correo enviado a procesamiento."); 
      } 
      setComposeOpen(false); 
    }
    catch (error) { toast.error(getOperationError(error)); }
    finally { setSending(false); }
  }
  useEffect(() => {
    (async () => {
      const { data } = await (createClient() as any).from("emails").select("id,subject,body_text,direction,sender,received_at,case_id,metadata").order("created_at", { ascending: false }).limit(50);
      if (!data?.length) return;
      setEmails(data.map((email: { 
        id: string; 
        subject: string | null; 
        body_text: string | null; 
        direction: DemoEmail["direction"]; 
        sender: unknown; 
        metadata: unknown; 
        received_at: string | null;
        case_id: string | null;
      }) => {
        const sender = typeof email.sender === "object" && email.sender !== null ? email.sender as Record<string, unknown> : {};
        const metadata = typeof email.metadata === "object" && email.metadata !== null ? email.metadata as Record<string, unknown> : {};
        return {
          id: email.id,
          caseId: email.case_id || undefined,
          sender: String(sender.name || sender.email || "Remitente"),
          email: String(sender.email || ""),
          subject: email.subject || "Sin asunto",
          preview: (email.body_text || "").slice(0, 80),
          receivedAt: email.received_at || new Date().toISOString(),
          priority: (metadata.priority as DemoEmail["priority"]) || "normal",
          caseNumber: Number(metadata.case_number || 0),
          company: String(metadata.company || "Cliente"),
          direction: email.direction,
          requiresApproval: Boolean(metadata.requires_approval),
          body: email.body_text || "",
        } as DemoEmail;
      }));
    })();
  }, []);
  
  const visible = useMemo(() => emails.filter((email) =>  
    (!search || `${email.subject} ${email.sender} ${email.company}`.toLowerCase().includes(search.toLowerCase())) 
  && (filter === "all" || (filter === "approval" && email.requiresApproval) 
  || filter === email.priority)), [emails, filter, search]);

  const selected = visible.find((email) => email.id === selectedId) || visible[0] || emails[0];
  return (
  <>
  <ActionCenter
    open={actionCenterOpen}
    onOpenChange={setActionCenterOpen}
    title="Acciones del correo"
    description={selected ? `${selected.subject || "Sin asunto"}. Elige una acción.` : "Selecciona un correo para continuar."}
    actions={selected ? [
      { id: "reply", label: "Responder", description: "Prepara una respuesta dirigida al remitente.", workflow: "PE07", icon: <Reply className="h-4 w-4" />, onSelect: () => { setActionCenterOpen(false); setComposeMode("reply"); setComposeOpen(true); } },
      { id: "forward", label: "Reenviar", description: "Prepara una copia del mensaje para otro destinatario.", workflow: "PE07", icon: <ArrowUpRight className="h-4 w-4" />, onSelect: () => { setActionCenterOpen(false); setComposeMode("forward"); setComposeOpen(true); } },
      { id: "case", label: "Abrir caso relacionado", description: "Navega al caso asociado al correo.", icon: <BriefcaseBusiness className="h-4 w-4" />, disabled: !selected.caseId, onSelect: () => { if (selected.caseId) router.push(`/cases/${selected.caseId}`); setActionCenterOpen(false); } },
      { id: "copy-subject", label: "Copiar asunto", description: "Copia el asunto para usarlo en otra acción.", icon: <FileCheck2 className="h-4 w-4" />, onSelect: () => { void navigator.clipboard?.writeText(selected.subject || "Sin asunto"); setActionCenterOpen(false); toast.success("Asunto copiado."); } },
    ] : []}
  />
  <OperationDialog open={composeOpen} onOpenChange={setComposeOpen}>
    <OperationDialogContent>
      <OperationDialogHeader>
        <OperationDialogTitle>{composeMode === "reply" ? "Responder correo" : composeMode === "forward" ? "Reenviar correo" : "Redactar correo"}</OperationDialogTitle>
        <OperationDialogDescription>Envía una respuesta desde el centro de operaciones.</OperationDialogDescription>
      </OperationDialogHeader>
      <EmailComposeForm 
        initial={composeMode === "reply" ? { to: selected?.email, subject: selected?.subject ? `Re: ${selected.subject}` : "", body: "" } : composeMode === "forward" ? { subject: selected?.subject ? `Fwd: ${selected.subject}` : "", body: selected?.body } : undefined} 
        onSubmit={sendEmail} 
        onCancel={() => setComposeOpen(false)} 
        submitting={sending} 
      />
    </OperationDialogContent>
  </OperationDialog>
  <div className="space-y-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[.18em] text-muted-foreground mb-3">Operations / Inbox</p>
        <h1 className="text-3xl font-semibold tracking-[-.04em]">Correos
          </h1>
           <p className="text-muted-foreground mt-1.5">Revisa, responde y convierte cada mensaje en una acción clara.</p>
      </div>
          <Button onClick={() => { setComposeMode("new"); setComposeOpen(true); }}>
            <Mail />Redactar correo
          </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative w-full min-w-0 sm:max-w-md sm:flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar en correos..." className="pl-9" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant={filter === "all" ? "secondary" : "outline"} size="sm" onClick={() => setFilter("all")}>
                  <Inbox />Todos <span className="font-mono text-[10px]">{emails.length}</span>
                </Button>
                <Button variant={filter === "urgent" ? "secondary" : "outline"} size="sm" onClick={() => setFilter("urgent")}>Urgentes</Button>
                <Button variant={filter === "approval" ? "secondary" : "outline"} size="sm" onClick={() => setFilter("approval")}>
                  <FileCheck2 />Requieren aprobación
                </Button>
                <Button variant="outline" size="sm" 
                  onClick={() => toast.info("Usa las bandejas y búsqueda para filtrar los correos.")}>
                  <SlidersHorizontal />Más filtros
                </Button>
              </div>
            </div>
            
    <Card className="overflow-hidden min-h-[calc(100vh-120px)]">
      <div className="grid min-w-0 grid-cols-1 divide-x md:grid-cols-[minmax(260px,300px)_minmax(0,1fr)]">
        <div className={`min-w-0 overflow-y-auto scrollbar-thin md:block md:h-[calc(100vh-120px)] ${mobilePanel === "inbox" ? "block" : "hidden"}`}>
          <div className="h-12 px-4 border-b flex items-center justify-between">
            <span className="text-xs font-semibold">Bandeja de entrada</span>
            <span className="text-[11px] text-muted-foreground">{visible.length} mensajes</span>
            </div>{visible.map((email) => 
            <button key={email.id} onClick={() => { setSelectedId(email.id); setMobilePanel("detail"); }} className={`w-full text-left p-4 border-b transition-colors ${selected?.id === email.id ? "bg-muted/55 border-l-2 border-l-foreground" : "hover:bg-muted/30"}`}>
              <div className="flex items-start gap-2">
                <PriorityBadge priority={email.priority} />
                <span className="ml-auto text-[10px] text-muted-foreground">{formatRelativeTime(email.receivedAt)}
                  </span>
                  </div>
                  <p className="text-xs font-medium mt-3 truncate">{email.sender}</p>
                  <p className="text-xs mt-1 truncate">{email.subject}</p>
                  <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-1">{email.preview}</p>{email.requiresApproval && 
                  <Badge variant="warning" className="mt-3">
                    <FileCheck2 className="h-3 w-3 mr-1" />Aprobación</Badge>}</button>)}
                    {visible.length === 0 ? <EmptyState compact title="Sin correos" description="No hay mensajes que coincidan con los filtros seleccionados." /> : null}
                    </div>{selected && (
                      <div className={`min-w-0 overflow-y-auto scrollbar-thin md:block md:h-162.5 ${mobilePanel === "detail" ? "block" : "hidden"}`}>
                      <div className="flex min-h-12 items-center justify-between gap-2 border-b px-3 sm:px-5">
                        <div className="flex min-w-0 items-center gap-2">
                          <Button variant="ghost" size="sm" className="shrink-0 md:hidden" onClick={() => setMobilePanel("inbox")}>
                            <ChevronLeft />Bandeja
                          </Button>
                          <span className="truncate text-xs font-mono text-muted-foreground">CASO #{selected.caseNumber}</span>
                          <Link href={`/cases/demo-${selected.caseNumber}`} className="text-xs text-muted-foreground hover:text-foreground flex items-center">Ver caso <ArrowUpRight className="h-3 w-3 ml-1" />
                          </Link>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" aria-label="Archivar" disabled title="Archivar requiere un campo de estado persistente en el backend.">
                              <Archive />
                            </Button>
                            <Button variant="ghost" size="icon" aria-label="Más opciones" onClick={() => setActionCenterOpen(true)}>
                              <MoreHorizontal />
                            </Button>
                          </div>
                          </div>
                          <div className="min-w-0 p-5 sm:p-8">
                            <div className="flex min-w-0 items-start justify-between gap-4">
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <PriorityBadge priority={selected.priority} />
                                  <span className="text-[11px] text-muted-foreground">{formatRelativeTime(selected.receivedAt)}</span>
                                </div>
                                <h2 className="text-xl font-semibold tracking-tight">{selected.subject}</h2>
                              </div>
                              <Star className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="mt-7 flex items-center gap-3 pb-6 border-b">
                              <div className="h-9 w-9 rounded-full bg-[#e4e0d8] text-[#625b4c] flex items-center justify-center text-xs font-semibold">{selected.sender.split(" ").map((n) => n[0]).join("").slice(0,2)}</div>
                              <div>
                                <p className="text-xs font-medium">{selected.sender}</p>
                                <p className="text-[11px] text-muted-foreground">{selected.email}</p>
                              </div>
                              <span className="ml-auto text-[11px] text-muted-foreground">Para tu cuenta</span>
                            </div>
                            <div className="py-7 text-sm leading-7 whitespace-pre-line">{selected.body}</div>
                            <div className="flex flex-wrap gap-2 border-t pt-5">
                              <Button className="w-full sm:w-fit" onClick={() => { setComposeMode("reply"); setComposeOpen(true); }}><Reply />
                                Responder
                              </Button>
                              <Button variant="outline" type="button" disabled title="Adjuntos aún no están configurados"><Paperclip />
                                Adjuntar
                              </Button>
                              <Button variant="outline" onClick={() => { setComposeMode("forward"); setComposeOpen(true); }}>
                                Reenviar
                              </Button>
                            </div>
                          </div>
                        </div>)}
                      </div>
                    </Card>
                  </div>
  </>
  );
}
