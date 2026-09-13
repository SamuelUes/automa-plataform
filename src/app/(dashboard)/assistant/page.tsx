"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createAction } from "@/lib/actions";
import { getMessageText, loadConversationMessages, type ConversationMessage } from "@/lib/conversations";
import { useRealtimeTable } from "@/lib/supabase/realtime";
import { type AssistantMessage } from "@/lib/assistant-demo-data";
import { MarkdownMessage } from "@/components/format-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bot, Check, Clock3, Command, FileCheck2, Loader2, MessageSquare, Plus, Send, ShieldCheck, Sparkles, UserRound, X } from "lucide-react";
import { useCurrentUser } from "@/components/providers/current-user-context";

const welcomeMessages: AssistantMessage[] = [{ id: "welcome", role: "assistant", content: "Puedo ayudarte a consultar la operación y preparar acciones. Las acciones sensibles siempre requieren tu confirmación.", createdAt: "ahora" }];
const quickCommands = ["¿Qué requiere mi atención?", "Muéstrame los seguimientos vencidos", "Resume los casos urgentes"];

type ConversationSummary = { id: string; title: string | null; updated_at: string };
type ProgressState = { status: string; label: string } | null;

function orderAssistantMessages(messages: ConversationMessage[]) {
  return [...messages].sort((left, right) => {
    const leftRequest = left.metadata?.request_id;
    const rightRequest = right.metadata?.request_id;
    if (typeof leftRequest === "string" && leftRequest === rightRequest && left.sender_type !== right.sender_type) {
      return left.sender_type === "human" ? -1 : 1;
    }
    return left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id);
  });
}

export default function AssistantPage() {
  const currentUser = useCurrentUser();
  const [messages, setMessages] = useState<AssistantMessage[]>(welcomeMessages);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [recentConversations, setRecentConversations] = useState<ConversationSummary[]>([]);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<ProgressState>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [conversationStatus, setConversationStatus] = useState<"active" | "paused" | "closed">("active");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`;
  }, [input]);
  const refreshMessages = useCallback(async () => {
    if (!conversationId) return;
    try {
      const stored = await loadConversationMessages(conversationId);
      const { data: conversation } = await (createClient() as any).from("conversations").select("status").eq("id", conversationId).maybeSingle();
      const { data: latestProgress } = await (createClient() as any).from("assistant_request_progress").select("request_id,status,label").eq("conversation_id", conversationId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (latestProgress) setProgress({ status: latestProgress.status, label: latestProgress.label });
      if (conversation?.status === "active" || 
        conversation?.status === "paused" || 
        conversation?.status === "closed") setConversationStatus(conversation.status);
      setMessages(orderAssistantMessages(stored).map((message) => ({ 
        id: message.id, 
        role: message.role === "user" ? "user" : "assistant", 
        content: getMessageText(message), 
        createdAt: new Date(message.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) 
      })));
    } catch { setNotice("No se pudo actualizar la conversación."); }
  }, [conversationId]);
  useRealtimeTable("messages", refreshMessages, conversationId ? { column: "conversation_id", value: conversationId } : undefined);
  useRealtimeTable("assistant_request_progress", refreshMessages, conversationId ? { column: "conversation_id", value: conversationId } : undefined);
  const loadConversation = useCallback(async (id: string) => {
    const stored = await loadConversationMessages(id);
    setConversationId(id);
    const { data: conversation } = await (createClient() as any).from("conversations").select("status").eq("id", id).maybeSingle();
    setConversationStatus(conversation?.status === "paused" 
      || conversation?.status === "closed" ? conversation.status : "active");
    setMessages(orderAssistantMessages(stored).map((message) => ({ id: message.id, role: message.role === "user" ? "user" : "assistant", content: getMessageText(message), createdAt: new Date(message.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) })));
  }, []);
  const loadRecentConversations = useCallback(async () => {
    const { data, error } = await createClient().from("conversations").select("id,title,updated_at").eq("conversation_type", "assistant").order("updated_at", { ascending: false }).limit(12);
    if (error) throw error;
    setRecentConversations((data || []) as ConversationSummary[]);
  }, []);
  useEffect(() => {
    (async () => {
      try {
        await loadRecentConversations();
        const { data } = await (createClient() as any).from("conversations").select("id").eq("conversation_type", "assistant").order("updated_at", { ascending: false }).limit(1).maybeSingle() as { data: { id: string } | null };
        if (data?.id) await loadConversation(data.id);
      } catch { setNotice("No se pudieron cargar tus conversaciones."); }
    })();
  }, [loadConversation, loadRecentConversations]);
  async function waitForAssistantResponse(id: string) {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const stored = await loadConversationMessages(id);
      setMessages(orderAssistantMessages(stored).map((message) => ({ id: message.id, role: message.role === "user" ? "user" : "assistant", content: getMessageText(message), createdAt: new Date(message.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) })));
      if (stored.some((message) => message.sender_type === "ai" && message.content)) return true;
    }
    return false;
  }
  async function updateConversation(operation: "resume" | "close") {
    if (!conversationId) return;
    const { data, error } = await createClient().functions.invoke("conversation-control", 
      { body: { operation, conversation_id: conversationId } });
    if (error) { setNotice("No se pudo actualizar la conversación."); return; }
    setConversationStatus(operation === "close" ? "closed" : "active");
    setNotice(operation === "close" ? "Conversación finalizada." : "Conversación reanudada.");
    await refreshMessages();
    return data;
  }
  async function sendMessage(event: FormEvent<HTMLFormElement>) { event.preventDefault(); 
    const content = input.trim(); 
    if (!content || sending) return; 
    setInput(""); 
    setNotice(null); 
    setMessages((current) => [...current, { id: crypto.randomUUID(), 
      role: "user", 
      content, 
      createdAt: "ahora" 
    }]); 
    setSending(true); 
    try { 
      const { data, error } = await createClient().functions.invoke("assistant", { body: { content, conversation_id: conversationId } }); 
      if (error) throw error; 
      if (data?.conversation_id) {
        setConversationId(data.conversation_id);
        setProgress({ status: "classifying", label: "Entendiendo tu solicitud..." });
        await loadRecentConversations();
      }
      if (data?.conversation_id && data?.status === "queued") {
        const received = await waitForAssistantResponse(data.conversation_id);
        if (!received) setNotice("La solicitud fue aceptada, pero la respuesta está tardando más de lo esperado.");
      }
      const proposedAction = data?.message?.action || data?.decision?.action ? {
        intent: data.message?.action?.intent || data.decision.action,
        label: data.message?.action?.label || data.decision.reason,
        requiresConfirmation: Boolean(data.message?.action?.requiresConfirmation || data.decision?.requires_approval),
        caseId: data.message?.action?.case_id || data.decision?.case_id || undefined,
      } : undefined;
      if (data?.message || data?.decision) setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message?.content || data.decision?.reason || "La solicitud requiere una decisión adicional.",
        createdAt: "ahora",
        action: proposedAction,
      }]); 
    } catch { 
      setMessages((current) => [...current, { 
        id: crypto.randomUUID(), 
        role: "assistant", 
        content: "No pude conectar con el Command Center. Inténtalo de nuevo en unos segundos.", 
        createdAt: "ahora" 
      }]); 
    } finally { 
      setSending(false); 
    } 
  }
  async function confirmAction(message: AssistantMessage) { 
    if (!message.action) return; 
    setConfirming(message.id); 
    setNotice(null); 
    try { 
      const actionTypeMap: Record<string, string> = {
        APPROVE_EMAIL: "approve_email",
        REJECT_APPROVAL: "reject_approval",
        DELEGATE_CASE: "delegate_case",
        SEND_EMAIL: "send_email",
        SCHEDULE_FOLLOW_UP: "schedule_follow_up",
        RESOLVE_CASE: "resolve_case",
        VERIFY_CASE: "verify_case",
        CLOSE_CASE: "close_case",
      };
      await createAction((actionTypeMap[message.action.intent] || message.action.intent) as any,
        { case_id: message.action.caseId, conversation_id: conversationId, input_data: { source: "assistant_confirmation" } }); 
      setNotice("Acción creada y enviada a n8n para su procesamiento."); 
    } catch { 
      setNotice("No se pudo crear la acción. No se realizó ningún cambio."); 
    } finally { 
      setConfirming(null); 
    } 
  }
  return (
  <div className="h-[calc(100vh-9.5rem)] min-h-155 flex flex-col">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[.18em] text-muted-foreground mb-3">Command Center / AI</p>
        <h1 className="text-3xl font-semibold tracking-[-.04em]">AI Command Center</h1>
        <p className="text-muted-foreground mt-1.5">Tu contexto operativo, disponible para conversar y actuar.</p>
      </div>
      <Button variant="outline" onClick={() => { setMessages(welcomeMessages); setConversationId(null); setConversationStatus("active"); setNotice(null); }}>
        <Plus />Nueva conversación
      </Button>
    </div>
    <Card className="flex-1 min-h-0 overflow-hidden grid lg:grid-cols-[1fr_260px]">
      <div className="flex min-h-0 flex-col">
        <div className="h-14 px-5 border-b flex items-center gap-3">
              <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
                <Command className="h-3.5 w-3.5" />
              </div>
                <div>
                  <p className="text-xs font-semibold">Asistente ejecutivo</p>
                  <p className="text-[10px] text-success flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />Contexto conectado
                  </p>
                </div>
                <Badge variant="secondary" className="ml-auto">
                  <ShieldCheck className="h-3 w-3 mr-1" />Human-in-the-loop
                </Badge>
                </div>
                <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 scrollbar-thin">{messages.map((message) => 
                  <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>{message.role === "assistant" && 
                   <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0"><Bot className="h-4 w-4" /></div>}
                   <div className={`max-w-[min(650px,85%)] ${message.role === "user" ? "items-end" : ""}`}>
                    <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${message.role === "user" ? "bg-[#106353] text-primary-foreground" : "bg-muted/50"}`}><MarkdownMessage content={message.content} />
                    </div>
                    <p className={`mt-1.5 text-[10px] text-muted-foreground ${message.role === "user" ? "text-right" : ""}`}>{message.createdAt}</p>
                    {message.action?.requiresConfirmation && <div className="mt-3 rounded-lg border border-warning/40 bg-warning/8 p-3"><div className="flex items-start gap-2">
                      <FileCheck2 className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold">Confirmación requerida</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{message.action.label}</p>
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" onClick={() => confirmAction(message)} disabled={confirming === message.id}>
                            <Check />
                            {confirming === message.id ? "Creando acción..." : "Confirmar acción"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setNotice("Acción cancelada. No se realizó ningún cambio.")}>
                            <X />
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>}
                    </div>
                    {message.role === "user" && 
                    <div className="h-8 w-8 rounded-full bg-[#d7e7e2] text-[#28584e] flex items-center justify-center shrink-0 overflow-hidden">
                      {currentUser?.avatarUrl
                        ? <img src={currentUser.avatarUrl} alt={currentUser.fullName} className="h-full w-full object-cover" />
                        : <UserRound className="h-4 w-4" />}
                    </div>}
                  </div>
                )}
                {sending && <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-muted/50 rounded-xl px-4 py-3 flex items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {progress?.label || "Entendiendo tu solicitud..."}
                  </div>
                </div>}
                {conversationStatus === "closed" && <div className="rounded-xl border border-border bg-muted/40 p-4">
                  <p className="text-sm font-semibold">El chat se finalizó</p>
                  <p className="mt-1 text-xs text-muted-foreground">Envía un nuevo mensaje para reactivarlo.</p>
                </div>}
                {conversationStatus === "paused" && 
                <div className="rounded-xl border border-warning/40 bg-gray-100 p-4">
                  <p className="text-sm font-semibold">Conversación pausada por inactividad</p>
                  <p className="mt-1 text-xs text-muted-foreground">No hubo actividad durante el tiempo establecido. Puedes reanudarla o finalizarla.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" style={{ backgroundColor: "#75d48d" }} onClick={() => void updateConversation("resume")}>
                      <MessageSquare />Reanudar conversación
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => void updateConversation("close")}>
                      <X />Finalizar conversación
                    </Button>
                  </div>
                </div>}
                <div ref={bottomRef} />
              </div>
              <div className="border-t p-4 sm:px-8">
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                  {quickCommands.map((command) => <Button key={command} type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setInput(command)}>{command}</Button>)}
                </div>
                <form onSubmit={sendMessage} className="flex items-end gap-2">
                  <textarea 
                    ref={textareaRef}
                    value={input} 
                    onChange={(e) => setInput(e.target.value)} 
                    onKeyDown={(e) => { 
                      if (e.key === "Enter" && !e.shiftKey) { 
                        e.preventDefault(); 
                        e.currentTarget.form?.requestSubmit(); 
                      } 
                    }} 
                    rows={1} 
                    aria-label="Escribe una instrucción" 
                    placeholder="Escribe una instrucción..." 
                    className="min-h-10 max-h-28 flex-1 resize-none overflow-y-auto rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" 
                  />
                  <Button type="submit" size="icon" aria-label="Enviar mensaje" disabled={sending || !input.trim()}>
                    <Send />
                  </Button>
                </form>
                <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Las acciones sensibles siempre requieren confirmación humana.
                </p>
                {notice && <p role="status" className="text-xs text-success mt-2 flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" />
                  {notice}
                </p>}
              </div>
            </div>
            <aside className="hidden lg:block border-l bg-muted/15 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] uppercase tracking-[.15em] text-muted-foreground">Chats recientes</p>
                <span className="text-[10px] text-muted-foreground">{recentConversations.length}</span>
              </div>
              <div className="space-y-1.5">
                {recentConversations.length ? recentConversations.map((conversation) => (
                  <button key={conversation.id} type="button" onClick={() => loadConversation(conversation.id)} className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-muted/50 ${conversation.id === conversationId ? "border-primary/40 bg-primary/5" : "border-transparent bg-background/70"}`}>
                    <p className="truncate text-xs font-medium">{conversation.title || "Conversación sin título"}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{new Date(conversation.updated_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</p>
                  </button>
                )) : <p className="rounded-lg border border-dashed p-3 text-[11px] text-muted-foreground">Tus conversaciones aparecerán aquí.</p>}
              </div>
              <p className="mt-8 text-[10px] uppercase tracking-[.15em] text-muted-foreground mb-3">Contexto disponible</p>
              <div className="space-y-2">
                {[
                  ["Casos", "/cases", MessageSquare],
                  ["Aprobaciones", "/approvals", FileCheck2],
                  ["Seguimientos", "/follow-ups", Clock3],
                  ["Automatizaciones", "/automations", Sparkles]
                ].map(([label, href, Icon]) => (
                  <Link key={label as string} href={href as string} className="flex min-h-11 items-center gap-2 rounded-lg border bg-background p-3 transition-colors hover:bg-muted/40">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted"><Icon className="h-3.5 w-3.5 text-muted-foreground" /></span>
                    <span className="text-xs font-medium">{label as string}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">Abrir</span>
                  </Link>
                ))}
              </div>
            </aside>
          </Card>
        </div>
);

}
