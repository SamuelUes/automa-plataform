"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { demoEmails, type DemoEmail } from "@/lib/email-demo-data";
import { formatRelativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PriorityBadge } from "@/components/cases/status-badge";
import { Archive, ArrowUpRight, FileCheck2, Inbox, Mail, MoreHorizontal, Paperclip, Reply, Search, SlidersHorizontal, Star } from "lucide-react";

export default function EmailsPage() {
  const [emails, setEmails] = useState<DemoEmail[]>(demoEmails);
  const [selectedId, setSelectedId] = useState(demoEmails[0].id);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
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
        received_at: string | null 
      }) => {
        const sender = typeof email.sender === "object" && email.sender !== null ? email.sender as Record<string, unknown> : {};
        const metadata = typeof email.metadata === "object" && email.metadata !== null ? email.metadata as Record<string, unknown> : {};
        return {
          id: email.id,
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
  <div className="space-y-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[.18em] text-muted-foreground mb-3">Operations / Inbox</p>
        <h1 className="text-3xl font-semibold tracking-[-.04em]">Correos
          </h1>
           <p className="text-muted-foreground mt-1.5">Revisa, responde y convierte cada mensaje en una acción clara.</p>
      </div>
          <Button><Mail />Redactar correo</Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-md">
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
                <Button variant="outline" size="sm"><SlidersHorizontal />Más filtros</Button>
              </div>
            </div>
    <Card className="overflow-hidden min-h-[calc(100vh-120px)]">
      <div className="grid lg:grid-cols-[300px_1fr_285px] divide-x">
        <div className="lg:h-[calc(100vh-120px)] overflow-y-auto scrollbar-thin">
          <div className="h-12 px-4 border-b flex items-center justify-between">
            <span className="text-xs font-semibold">Bandeja de entrada</span>
            <span className="text-[11px] text-muted-foreground">{visible.length} mensajes</span>
            </div>{visible.map((email) => 
            <button key={email.id} onClick={() => setSelectedId(email.id)} className={`w-full text-left p-4 border-b transition-colors ${selected?.id === email.id ? "bg-muted/55 border-l-2 border-l-foreground" : "hover:bg-muted/30"}`}>
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
                    </div>{selected && (
                      <div className="lg:h-162.5 overflow-y-auto scrollbar-thin">
                      <div className="h-12 px-5 border-b flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">CASO #{selected.caseNumber}</span>
                          <Link href={`/cases/demo-${selected.caseNumber}`} className="text-xs text-muted-foreground hover:text-foreground flex items-center">Ver caso <ArrowUpRight className="h-3 w-3 ml-1" />
                          </Link>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" aria-label="Archivar">
                              <Archive />
                              </Button>
                              <Button variant="ghost" size="icon" aria-label="Más opciones">
                                <MoreHorizontal />
                                </Button>
                                </div>
                                </div>
                                <div className="p-5 sm:p-8">
                                  <div className="flex items-start justify-between gap-4">
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
                                        <div className="border-t pt-5 flex flex-wrap gap-2">
                                          <Button><Reply />Responder</Button>
                                          <Button variant="outline"><Paperclip />Adjuntar</Button>
                                          <Button variant="outline">Reenviar</Button>
                                        </div>
                                      </div>
                                    </div>)}
                              </div>
                            </Card>
                          </div>
  );
}
