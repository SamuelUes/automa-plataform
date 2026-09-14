"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { demoEmails, type DemoEmail, type EmailDraftSummary } from "@/lib/email-demo-data";
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
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useRealtimeTable } from "@/lib/supabase/realtime";
import { Archive, ArrowUpRight, BriefcaseBusiness, ChevronLeft, Code2, FileCheck2, Inbox, Mail, MoreHorizontal, Paperclip, RefreshCw, Reply, Search, SlidersHorizontal, Sparkles, Star } from "lucide-react";

const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (typeof value === "object" && value !== null) return value as T;
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function sanitizeEmailHtml(html: string) {
  if (typeof DOMParser === "undefined") return "";
  const document = new DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll("script, iframe, object, embed, form, meta, link, style").forEach((element) => element.remove());
  document.querySelectorAll("*").forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on") || ((name === "href" || name === "src") && /^(javascript|data):/i.test(value))) {
        element.removeAttribute(attribute.name);
      }
    });
  });
  return document.body.innerHTML;
}

function formatEmailBody(body: string) {
  return body
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");

  // if (!bodyHtml || body.includes("\n")) return decodeEntities(body);

  // const document = new DOMParser().parseFromString(bodyHtml, "text/html");
  // const blockTags = new Set(["ADDRESS", "ARTICLE", "DIV", "LI", "P", "SECTION", "TD", "TR"]);
  // const lines: string[] = [];

  // function visit(node: Node) {
  //   if (node.nodeType === Node.TEXT_NODE) {
  //     lines.push(node.textContent || "");
  //     return;
  //   }
  //   if (!(node instanceof Element)) return;
  //   if (node.tagName === "BR") lines.push("\n");
  //   if (node.tagName === "LI") lines.push("\n- ");
  //   for (const child of Array.from(node.childNodes)) visit(child);
  //   if (blockTags.has(node.tagName)) lines.push("\n");
  // }

  // visit(document.body);
  // return lines.join("")
  //   .replace(/[ \t]+/g, " ")
  //   .replace(/\n[ \t]+/g, "\n")
  //   .replace(/\n{3,}/g, "\n\n")
  //   .trim();
}

export default function EmailsPage() {
  const router = useRouter();
  const [emails, setEmails] = useState<DemoEmail[]>(demoMode ? demoEmails : []);
  const [emailDrafts, setEmailDrafts] = useState<Record<string, EmailDraftSummary>>({});
  const [selectedId, setSelectedId] = useState(demoMode ? demoEmails[0].id : "");
  const [mobilePanel, setMobilePanel] = useState<"inbox" | "detail">("inbox");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [actionCenterOpen, setActionCenterOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<"new" | "reply" | "forward">("new");
  const [sending, setSending] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [discardingDraft, setDiscardingDraft] = useState(false);
  const [usingDraft, setUsingDraft] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showRawBody, setShowRawBody] = useState(false);
  const waitingForSyncRef = useRef(false);
  const previousIdsRef = useRef<Set<string>>(new Set());
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadEmails = useCallback(async (): Promise<DemoEmail[]> => {
    const client = createClient() as any;
    const { data, error } = await client
      .from("emails")
      .select("id,subject,body_text,body_html,direction,evaluation,sender,received_at,case_id,metadata")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    if (!data?.length) {
      setEmails([]);
      setEmailDrafts({});
      return [];
    }

    const { data: drafts, error: draftsError } = await client
      .from("email_drafts")
      .select("id,email_id,subject,body,status,created_at")
      .in("email_id", data.map((email: { id: string }) => email.id))
      .in("status", ["draft", "pending_review", "approved"])
      .order("created_at", { ascending: false });
    if (draftsError) throw draftsError;

    const latestDrafts = (drafts || []).reduce((result: Record<string, EmailDraftSummary>, draft: { id: string; email_id: string | null; subject: string | null; body: string; status: string; created_at: string }) => {
      if (draft.email_id && !result[draft.email_id]) {
        result[draft.email_id] = {
          id: draft.id,
          subject: draft.subject,
          body: draft.body,
          status: draft.status,
          createdAt: draft.created_at,
        };
      }
      return result;
    }, {});
    setEmailDrafts(latestDrafts);

    const mappedEmails = data.map((email: {
      id: string;
      subject: string | null;
      body_text: string | null;
      body_html: string | null;
      direction: DemoEmail["direction"];
      evaluation: DemoEmail["priority"] | null;

      sender: unknown;
      metadata: unknown;
      received_at: string | null;
      case_id: string | null;
    }) => {
      const sender = parseJsonValue<Record<string, unknown>>(email.sender, {});
      const metadata = parseJsonValue<Record<string, unknown>>(email.metadata, {});
      return {
        id: email.id,
        caseId: email.case_id || undefined,
        sender: String(sender.name || sender.email || "Remitente"),
        email: String(sender.email || ""),
        subject: email.subject || "Sin asunto",
        preview: (email.body_text || "").slice(0, 80),
        receivedAt: email.received_at || new Date().toISOString(),
        priority: email.evaluation || (metadata.priority as DemoEmail["priority"]) || "normal",
        caseNumber: Number(metadata.case_number || 0),
        company: String(metadata.company || "Cliente"),
        direction: email.direction,
        requiresApproval: Boolean(metadata.requires_approval),
        body: email.body_text || "",
        bodyHtml: email.body_html || undefined,
        draft: latestDrafts[email.id],
      } as DemoEmail;
    });
    setEmails(mappedEmails);
    return mappedEmails;
  }, []);

  const finishInboxRefresh = useCallback(async () => {
    if (!waitingForSyncRef.current) return;
    waitingForSyncRef.current = false;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = null;
    try {
      const updatedEmails = await loadEmails();
      const newCount = updatedEmails.filter((email) => !previousIdsRef.current.has(email.id)).length;
      if (newCount === 0) toast.info("No hay correos nuevos para mostrar.");
      else toast.success(`${newCount} correo${newCount === 1 ? "" : "s"} nuevo${newCount === 1 ? "" : "s"} encontrado${newCount === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(getOperationError(error));
    } finally {
      setRefreshing(false);
    }
  }, [loadEmails]);

  const handleEmailRealtimeChange = useCallback((payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
    if (payload.eventType !== "INSERT" || !waitingForSyncRef.current) return;
    const emailId = typeof payload.new.id === "string" ? payload.new.id : "";
    if (!emailId || previousIdsRef.current.has(emailId)) return;
    void finishInboxRefresh();
  }, [finishInboxRefresh]);

  useRealtimeTable("emails", handleEmailRealtimeChange);

  const handleDraftRealtimeChange = useCallback(() => {
    if (!demoMode) void loadEmails().catch((error) => toast.error(getOperationError(error)));
  }, [loadEmails]);

  useRealtimeTable("email_drafts", handleDraftRealtimeChange);

  useEffect(() => () => {
    waitingForSyncRef.current = false;
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
  }, []);

  async function refreshInbox() {
    if (refreshing) return;
    previousIdsRef.current = new Set(emails.map((email) => email.id));
    waitingForSyncRef.current = true;
    setRefreshing(true);
    syncTimeoutRef.current = setTimeout(() => {
      void finishInboxRefresh();
    }, 15000);
    try {
      await createAction("execute_workflow", {
        workflow_code: "PE05",
        input_data: { mode: "inbound_sync", lookback_hours: 72 },
        idempotency_key: `pe05:inbound_sync:${crypto.randomUUID()}`,
      });
    } catch (error) {
      waitingForSyncRef.current = false;
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
      setRefreshing(false);
      toast.error(getOperationError(error));
    }
  }

  async function createEmailDraft() {
    if (!selected || creatingDraft) return;
    if (isDemoId(selected.id)) {
      toast.info("Los correos simulados no generan borradores en Supabase.");
      return;
    }

    setCreatingDraft(true);
    try {
      await createAction("create_email_draft", {
        case_id: selected.caseId || null,
        input_data: { email_id: selected.id },
        idempotency_key: `email-draft:${selected.id}:${crypto.randomUUID()}`,
      });
      toast.success("Solicitud de borrador enviada. Aparecerá aquí cuando termine.");
    } catch (error) {
      toast.error(getOperationError(error));
    } finally {
      setCreatingDraft(false);
    }
  }

  async function discardEmailDraft() {
    if (!selected || !selectedDraft || discardingDraft) return;
    setDiscardingDraft(true);
    try {
      await createAction("discard_email_draft", {
        input_data: { draft_id: selectedDraft.id, email_id: selected.id },
        idempotency_key: `discard-email-draft:${selectedDraft.id}`,
      });
      setDraftOpen(false);
      toast.success("Borrador descartado.");
      await loadEmails();
    } catch (error) {
      toast.error(getOperationError(error));
    } finally {
      setDiscardingDraft(false);
    }
  }

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
    if (!demoMode) void loadEmails().catch((error) => toast.error(getOperationError(error)));
  }, [loadEmails]);
  
  const visible = useMemo(() => emails.filter((email) =>  
    (!search || `${email.subject} ${email.sender} ${email.company}`.toLowerCase().includes(search.toLowerCase())) 
  && (filter === "all" || (filter === "approval" && email.requiresApproval) 
  || filter === email.priority)), [emails, filter, search]);

  const selected = visible.find((email) => email.id === selectedId) || visible[0] || emails[0];
  const selectedDraft = selected ? emailDrafts[selected.id] : undefined;
  const selectedBodyHtml = useMemo(() => selected?.bodyHtml ? sanitizeEmailHtml(selected.bodyHtml) : "", [selected?.bodyHtml]);
  
  return (
  <>
  <ActionCenter
    open={actionCenterOpen}
    onOpenChange={setActionCenterOpen}
    title="Acciones del correo"
    description={selected ? `${selected.subject || "Sin asunto"}. Elige una acción.` : "Selecciona un correo para continuar."}
    actions={selected ? [
      { id: "reply", label: "Responder", description: "Prepara una respuesta dirigida al remitente.", workflow: "PE07", icon: <Reply className="h-4 w-4" />, onSelect: () => { setActionCenterOpen(false); setUsingDraft(false); setComposeMode("reply"); setComposeOpen(true); } },
      { id: "forward", label: "Reenviar", description: "Prepara una copia del mensaje para otro destinatario.", workflow: "PE07", icon: <ArrowUpRight className="h-4 w-4" />, onSelect: () => { setActionCenterOpen(false); setUsingDraft(false); setComposeMode("forward"); setComposeOpen(true); } },
      { id: "case", label: "Abrir caso relacionado", description: "Navega al caso asociado al correo.", icon: <BriefcaseBusiness className="h-4 w-4" />, disabled: !selected.caseId, onSelect: () => { if (selected.caseId) router.push(`/cases/${selected.caseId}`); setActionCenterOpen(false); } },
      { id: "copy-subject", label: "Copiar asunto", description: "Copia el asunto para usarlo en otra acción.", icon: <FileCheck2 className="h-4 w-4" />, onSelect: () => { void navigator.clipboard?.writeText(selected.subject || "Sin asunto"); setActionCenterOpen(false); toast.success("Asunto copiado."); } },
    ] : []}
  />
  <OperationDialog open={composeOpen} onOpenChange={setComposeOpen}>
    <OperationDialogContent>
      <OperationDialogHeader>
        <OperationDialogTitle>{composeMode === "reply" ? "Responder correo" : composeMode === "forward" ? "Reenviar correo" : "Redactar correo"}</OperationDialogTitle>
        <OperationDialogDescription>
          Envía una respuesta desde el centro de operaciones.
        </OperationDialogDescription>
      </OperationDialogHeader>
      <EmailComposeForm
        key={`${selected?.id || "email"}:${composeMode}:${usingDraft ? selectedDraft?.id || "draft" : "empty"}`}
        initial={composeMode === "reply" ? { to: selected?.email, subject: selectedDraft?.subject || (selected?.subject ? `Re: ${selected.subject}` : ""), body: usingDraft ? selectedDraft?.body || "" : "" } : composeMode === "forward" ? { subject: selected?.subject ? `Fwd: ${selected.subject}` : "", body: selected?.body } : undefined}
        onSubmit={sendEmail} 
        onCancel={() => { setUsingDraft(false); setComposeOpen(false); }}
        submitting={sending} 
      />
    </OperationDialogContent>
  </OperationDialog>
  <Sheet open={draftOpen} onOpenChange={setDraftOpen}>
    <SheetContent className="w-[calc(100%-1rem)] max-w-md overflow-y-auto border-l p-5 sm:p-7">
      {selectedDraft && (
        <div className="flex min-h-full flex-col gap-6 pr-1">
          <div className="border-b pb-5">
            <div className="flex items-center gap-2">
              <Sparkles className="text-muted-foreground" />
              <p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">
                Borrador generado
              </p>
              <Badge className="ml-auto" variant={selectedDraft.status === "draft" ? "secondary" : "warning"}>{selectedDraft.status}</Badge>
            </div>
            <SheetTitle className="mt-4 pr-6 text-xl tracking-tight">{selectedDraft.subject || `Re: ${selected.subject}`}</SheetTitle>
            <p className="mt-2 text-xs text-muted-foreground">Generado con el contexto autorizado de este correo.</p>
          </div>
          <div className="whitespace-pre-wrap text-sm leading-7 text-foreground">{selectedDraft.body}</div>
          <div className="mt-auto grid gap-2 border-t pt-5 sm:grid-cols-2">
            <Button
              type="button"
              onClick={() => { setUsingDraft(true); setDraftOpen(false); setComposeMode("reply"); setComposeOpen(true); }}
            >
              <Reply />Utilizar borrador
            </Button>
            <Button type="button" variant="outline" onClick={() => void discardEmailDraft()} disabled={discardingDraft}>
              {discardingDraft ? "Descartando…" : "Descartar borrador"}
            </Button>
          </div>
        </div>
      )}
    </SheetContent>
  </Sheet>
  <div className="space-y-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[.18em] text-muted-foreground mb-3">Operations / Inbox</p>
        <h1 className="text-3xl font-semibold tracking-[-.04em]">Correos
          </h1>
           <p className="text-muted-foreground mt-1.5">Revisa, responde y convierte cada mensaje en una acción clara.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={refreshInbox} disabled={refreshing}>
          <RefreshCw className={refreshing ? "animate-spin" : undefined} />
          {refreshing ? "Esperando correos…" : "Buscar correos nuevos"}
        </Button>
        <Button onClick={() => { setUsingDraft(false); setComposeMode("new"); setComposeOpen(true); }}>
          <Mail />Redactar correo
        </Button>
      </div>
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
        <Button variant="outline" size="sm" onClick={() => toast.info("Usa las bandejas y búsqueda para filtrar los correos.")}>
          <SlidersHorizontal />Más filtros
        </Button>
      </div>
    </div>
            
      <Card className="overflow-hidden">
      <div className="grid min-w-0 grid-cols-1 divide-x md:grid-cols-[minmax(260px,300px)_minmax(0,1fr)]">
        <div className={`min-w-0 md:block ${mobilePanel === "inbox" ? "block" : "hidden"}`}>
          <div className="h-12 px-4 border-b flex items-center justify-between">
            <span className="text-xs font-semibold">Bandeja de entrada</span>
            <span className="text-[11px] text-muted-foreground">{visible.length} mensajes</span>
            </div>{visible.map((email) => 
            <button key={email.id} onClick={() => { setSelectedId(email.id); setMobilePanel("detail"); }} className={`w-full text-left p-4 border-b transition-colors ${selected?.id === email.id ? "bg-muted/55 border-l-2 border-l-foreground" : "hover:bg-muted/30"}`}>
              <div className="flex items-start gap-2">
                <PriorityBadge priority={email.priority} />
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {formatRelativeTime(email.receivedAt)}
                </span>
              </div>
              <p className="text-xs font-medium mt-3 truncate">{email.sender}</p>
              <p className="text-xs mt-1 truncate">{email.subject}</p>
              <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-1">{email.preview}</p>{email.requiresApproval && 
                <Badge variant="warning" className="mt-3">
                  <FileCheck2 className="h-3 w-3 mr-1" />Aprobación</Badge>}</button>)}
                {visible.length === 0 ? <EmptyState compact title="Sin correos" description="No hay mensajes que coincidan con los filtros seleccionados." /> : null}
              </div>{selected && (
                <div className={`min-w-0 md:block ${mobilePanel === "detail" ? "block" : "hidden"}`}>
                  <div className="flex min-h-12 items-center justify-between gap-2 border-b px-3 sm:px-5">
                    <div className="flex min-w-0 items-center gap-2">
                      <Button variant="ghost" size="sm" className="shrink-0 md:hidden" onClick={() => setMobilePanel("inbox")}>
                        <ChevronLeft />Bandeja
                      </Button>

                      <span className="truncate text-xs font-mono text-muted-foreground">CASO #{selected.caseNumber}</span>
                      <Link href={`/cases/demo-${selected.caseNumber}`} className="text-xs text-muted-foreground hover:text-foreground flex items-center">
                        <span>Ver caso</span>
                        <ArrowUpRight className="h-3 w-3 ml-1" />
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

                    <div className="flex items-center gap-3 pb-6 border-b">
                      <div className="h-9 w-9 rounded-full bg-[#e4e0d8] text-[#625b4c] flex items-center justify-center text-xs font-semibold">
                        {selected.sender.split(" ").map((n) => n[0]).join("").slice(0,2)}
                      </div>
                      <div>
                        <p className="text-xs font-medium">{selected.sender}</p>
                        <p className="text-[11px] text-muted-foreground">{selected.email}</p>
                      </div>
                      <span className="ml-auto text-[11px] text-muted-foreground">Para tu cuenta</span>
                    </div>


                    <div className="flex min-w-0 items-start mt-3 justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <PriorityBadge priority={selected.priority} />
                          <span className="text-[11px] text-muted-foreground">{formatRelativeTime(selected.receivedAt)}</span>
                        </div>
                        <h2 className="text-xl font-semibold tracking-tight">{selected.subject}</h2>
                      </div>
                      <Star className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="max-w-3xl py-7">
                      {selected.bodyHtml && (
                        <div className="mb-4 flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowRawBody((visible) => !visible)}
                          >
                            <Code2 />
                            {showRawBody ? "Mostrar HTML" : "Mostrar texto sin formato"}
                          </Button>
                        </div>
                      )}
                      {selectedBodyHtml && !showRawBody ? (
                        <div
                          aria-label={`Contenido de ${selected.subject}`}
                          className="email-html-content w-full overflow-visible rounded-md border bg-background p-4 text-sm leading-6 break-words [&_a]:break-words [&_img]:h-auto [&_img]:max-w-full [&_table]:max-w-full"
                          dangerouslySetInnerHTML={{ __html: selectedBodyHtml }}
                        />
                      ) : (
                        <div className="rounded-md border bg-muted/20 p-4 text-sm leading-7 whitespace-pre-wrap break-words">{formatEmailBody(selected.body)}</div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 border-t pt-5">
                      <Button className="w-full sm:w-fit" onClick={() => void createEmailDraft()} disabled={creatingDraft}>
                        <Sparkles />{creatingDraft ? "Creando borrador…" : selectedDraft ? "Actualizar borrador" : "Crear borrador"}
                      </Button>
                      {selectedDraft && (
                        <Button
                          type="button"
                          variant="secondary"
                          className="w-full border border-zinc-300 bg-gradient-to-br from-white via-purple-200 to-zinc-600 text-zinc-900 shadow-sm hover:from-white hover:via-purple-300 hover:to-zinc-600 sm:w-fit"
                          onClick={() => setDraftOpen(true)}
                          aria-label="Abrir borrador generado"
                        >
                          <Sparkles />
                          Ver borrador
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => { setUsingDraft(false); setComposeMode("reply"); setComposeOpen(true); }}><Reply />
                        Responder
                      </Button>
                      <Button variant="outline" type="button" disabled title="Adjuntos aún no están configurados"><Paperclip />
                        Adjuntar
                      </Button>
                      <Button variant="outline" onClick={() => { setUsingDraft(false); setComposeMode("forward"); setComposeOpen(true); }}>
                        Reenviar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </>
    );
  }

