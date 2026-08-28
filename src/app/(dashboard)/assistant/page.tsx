"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createAction } from "@/lib/actions";
import { loadConversationMessages } from "@/lib/conversations";
import { initialAssistantMessages, type AssistantMessage } from "@/lib/assistant-demo-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bot, Check, Clock3, Command, FileCheck2, Loader2, MessageSquare, Plus, Send, ShieldCheck, Sparkles, UserRound, X } from "lucide-react";

export default function AssistantPage() {
  const [messages, setMessages] = useState<AssistantMessage[]>(initialAssistantMessages);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { (async () => { const { data } = await (createClient() as any).from("conversations").select("id,title,updated_at").eq("conversation_type", "assistant").order("updated_at", { ascending: false }).limit(1).maybeSingle(); if (data?.id) { setConversationId(data.id); const stored = await loadConversationMessages(data.id); setMessages(stored.map((message) => ({ id: message.id, role: message.role === "user" ? "user" : "assistant", content: message.content || "", createdAt: new Date(message.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) }))); } })(); }, []);
  async function sendMessage(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const content = input.trim(); if (!content || sending) return; setInput(""); 
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
      if (data?.conversation_id) setConversationId(data.conversation_id);
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
      <Button variant="outline" onClick={() => setMessages(initialAssistantMessages)}><Plus />Nueva conversación</Button>
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
                    <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/50"}`}>{message.content}
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
                    {message.role === "user" && <div className="h-8 w-8 rounded-full bg-[#d7e7e2] text-[#28584e] flex items-center justify-center shrink-0"><UserRound className="h-4 w-4" /></div>}
                  </div>
                )}
                {sending && <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="bg-muted/50 rounded-xl px-4 py-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Analizando contexto...
                  </div>
                </div>}
                <div ref={bottomRef} />
              </div>
              <div className="border-t p-4 sm:px-8">
                <form onSubmit={sendMessage} className="flex items-end gap-2">
                  <textarea 
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
                    className="min-h-10 max-h-28 flex-1 resize-none rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" 
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
            <aside className="hidden lg:block border-l bg-muted/15 p-4">
              <p className="text-[10px] uppercase tracking-[.15em] text-muted-foreground mb-4">Contexto disponible</p>
              <div className="space-y-2">
                {[
                  ["Casos", "24 activos", MessageSquare],
                  ["Aprobaciones", "3 pendientes", FileCheck2],
                  ["Seguimientos", "7 abiertos", Clock3],
                  ["Automatizaciones", "11 operativas", Sparkles]
                ].map(([label, value, Icon]) => (
                  <div key={label as string} className="rounded-lg border bg-background p-3">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-md bg-muted flex items-center justify-center">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                      <div>
                        <p className="text-xs font-medium">{label as string}</p>
                        <p className="text-[10px] text-muted-foreground">{value as string}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 rounded-lg border bg-background p-3">
                <Sparkles className="h-4 w-4 text-muted-foreground mb-2" />
                <p className="text-xs font-medium">Prueba una instrucción</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                  “¿Qué tengo pendiente?” o “Aprueba el primero”.
                </p>
              </div>
            </aside>
          </Card>
        </div>
);

}
