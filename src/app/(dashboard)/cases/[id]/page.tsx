"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { demoCases, type DemoCase } from "@/lib/demo-data";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";
import { findCaseConversation, loadConversationMessages, type ConversationMessage } from "@/lib/conversations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CaseStatusBadge, PriorityBadge } from "@/components/cases/status-badge";
import { ArrowLeft, Bot, CalendarClock, Check, ChevronRight, CircleCheck, FileText, Mail, MoreHorizontal, Send, ShieldCheck, Sparkles, UserRound } from "lucide-react";

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<DemoCase>(demoCases.find((c) => c.id === id) || demoCases[0]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageNotice, setMessageNotice] = useState<string | null>(null);
  useEffect(() => { 
    if (id?.startsWith("demo-")) return; 
    (async () => { 
      const { data } = await createClient().from("cases").select("id,case_number,title,description,status,priority,updated_at,created_at,requires_approval,requires_human").eq("id", id).single(); 
      if (data) setItem(Object.assign({}, data, { 
        client: "Cliente", 
        company: "—", 
        department: "—", 
        assignee: "—" 
      }) as DemoCase); 
    })(); 
  }, [id]);
  
  useEffect(() => {
    if (!id || id.startsWith("demo-")) return;
    (async () => {
      try {
        const conversation = await findCaseConversation(id);
        if (!conversation?.id) return;
        setConversationId(conversation.id);
        setMessages(await loadConversationMessages(conversation.id));
      } catch { setMessageNotice("No se pudo cargar la conversación del caso."); }
    })();
  }, [id]);
  async function sendCaseMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = messageInput.trim();
    if (!content || !id || id.startsWith("demo-") || sendingMessage) return;
    setSendingMessage(true); setMessageNotice(null); setMessageInput("");
    try {
      const { data, error } = await createClient().functions.invoke("case-messages", { body: { case_id: id, conversation_id: conversationId, content } });
      if (error) throw error;
      if (data?.conversation_id) setConversationId(data.conversation_id);
      if (data?.conversation_id) setMessages(await loadConversationMessages(data.conversation_id));
      setMessageNotice(data?.status === "failed" ? "El mensaje se guardó, pero n8n no pudo procesarlo." : "Mensaje enviado a procesamiento.");
    } catch { setMessageNotice("No se pudo enviar el mensaje. Inténtalo de nuevo."); }
    finally { setSendingMessage(false); }
  }
  
  return (
  <div className="space-y-6">
    <Link href="/cases" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-3.5 w-3.5" />Volver a casos
    </Link>
    
    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="font-mono text-xs text-muted-foreground">CASO #{item.case_number}</span>
          <PriorityBadge priority={item.priority} />
          <CaseStatusBadge status={item.status} />
        </div>
        <h1 className="text-3xl font-semibold tracking-[-.04em] max-w-3xl">{item.title}</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">{item.description}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline"><MoreHorizontal />Más acciones</Button>
        <Button><Check />Resolver caso</Button>
      </div>
    </div>
    
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-[13px] uppercase tracking-wide">Línea de tiempo
              </CardTitle>
              <span className="text-xs text-muted-foreground">{formatRelativeTime(item.updated_at)}
                </span>
                </CardHeader>
                <CardContent>
                  <div className="relative pl-7 space-y-7 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border">
                    <div className="relative">
                    <span className="absolute -left-6.5 top-0 h-4.25 w-4.25 rounded-full bg-info/15 text-info flex items-center justify-center">
                    <Mail className="h-3 w-3" />
                    </span>
                    <p className="text-sm font-medium">Correo recibido</p>
                    <p className="text-xs text-muted-foreground mt-1">Mariana López envió una solicitud relacionada con este caso.</p>
                    <p className="font-mono text-[10px] text-muted-foreground mt-2">Hoy · 09:42</p>
                  </div>
                  <div className="relative">
                    <span className="absolute -left-6.5 top-0 h-4.25 w-4.25 rounded-full bg-[#d7e7e2] text-[#28584e] flex items-center justify-center">
                      <Bot className="h-3 w-3" />
                    </span>
                    <p className="text-sm font-medium">Agente evaluó el caso</p>
                    <p className="text-xs text-muted-foreground mt-1">Clasificado como urgente y requiere aprobación humana.</p>
                    <p className="font-mono text-[10px] text-muted-foreground mt-2">Hoy · 09:43</p>
                  </div>
                  <div className="relative">
                    <span className="absolute -left-6.5 top-0 h-4.25 w-4.25 rounded-full bg-warning/15 text-warning flex items-center justify-center">
                      <FileText className="h-3 w-3" />
                    </span>
                    <p className="text-sm font-medium">Aprobación solicitada</p>
                    <p className="text-xs text-muted-foreground mt-1">El borrador de respuesta está listo para revisión.</p>
                    <p className="font-mono text-[10px] text-muted-foreground mt-2">Hoy · 09:45</p>
                  </div>
                </div>
              </CardContent>
            </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-[13px] uppercase tracking-wide">Análisis del agente</CardTitle>
          <Badge variant="info">
            <Sparkles className="h-3 w-3 mr-1" />IA
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted/45 p-4">
            <div className="flex flex-wrap gap-3 mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Prioridad detectada</p>
                <div className="mt-1">
                  <PriorityBadge priority="urgent" />
                </div>
              </div>
              <div className="border-l pl-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Decisión</p>
                <p className="text-xs font-medium mt-1">Requiere aprobación humana</p>
              </div>
              <div className="border-l pl-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Confianza</p>
                <p className="text-xs font-semibold mt-1">94%</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed">El cliente solicita una autorización comercial con un límite de tiempo inferior a 48 horas.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cliente</p>
              <p className="text-xs font-medium mt-1">{item.company}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Monto</p>
              <p className="text-xs font-medium mt-1">$12,500</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fecha límite</p>
              <p className="text-xs font-medium mt-1">25 ago 2026</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-[13px] uppercase tracking-wide">Conversación</CardTitle>
        </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              {messages.length === 0 && <p className="text-xs text-muted-foreground">Aún no hay mensajes en esta conversación.</p>}
              {messages.map((message) => <div key={message.id} className={`flex gap-3 ${message.sender_type === "human" ? "justify-end" : ""}`}>
                <div className={`rounded-lg p-3 max-w-[80%] ${message.sender_type === "human" ? "bg-primary text-primary-foreground" : "bg-muted/50"}`}>
                  <p className="text-xs leading-relaxed">{message.content || ""}</p>
                  <p className="text-[10px] opacity-60 mt-2">{message.sender_type === "ai" ? "Agente IA" : message.sender_type === "system" ? "Sistema" : "Usuario"} · {formatDateTime(message.created_at)}</p>
                </div>
                {message.sender_type !== "human" && <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0"><Bot className="h-3.5 w-3.5" /></div>}
              </div>)}
            </div>
            <form className="flex gap-2 mt-6" onSubmit={sendCaseMessage}>
              <input aria-label="Escribe un mensaje" value={messageInput} onChange={(event) => setMessageInput(event.target.value)} disabled={sendingMessage} className="h-9 flex-1 rounded-md border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-ring" placeholder="Añadir una nota al caso..." />
              <Button type="submit" size="icon" aria-label="Enviar nota" disabled={sendingMessage || !messageInput.trim()}><Send /></Button>
            </form>
            {messageNotice && <p role="status" className="text-xs text-muted-foreground mt-2">{messageNotice}</p>}
          </CardContent>
        </Card>
      </div>
       <aside className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-[13px] uppercase tracking-wide">Información del caso</CardTitle> 
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <UserRound className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cliente</p>
                <p className="text-xs font-medium mt-1">{item.client}</p>
                <p className="text-[11px] text-muted-foreground">{item.company}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Responsable</p>
                <p className="text-xs font-medium mt-1">{item.assignee}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CircleCheck className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Departamento</p>
                <p className="text-xs font-medium mt-1">{item.department}</p>
              </div>
            </div>
            <div className="border-t pt-4 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Creado</span>
              <span>{formatDateTime(item.created_at)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Actualizado</span>
              <span>{formatDateTime(item.updated_at)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>

          <CardHeader>
            <CardTitle className="text-[13px] uppercase tracking-wide">Acciones pendientes</CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              <FileText />Revisar aprobación <ChevronRight className="ml-auto" />
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <UsersIcon />Delegar caso <ChevronRight className="ml-auto" />
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <CalendarClock />Crear seguimiento <ChevronRight className="ml-auto" />
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  </div>
  );
}

function UsersIcon() { return <UserRound className="h-4 w-4" />; }
