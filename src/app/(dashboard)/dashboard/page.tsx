import Link from "next/link";
import { ArrowUpRight, ChevronRight, Clock3, FileCheck2, Inbox, MoreHorizontal, OctagonAlert, Sparkles, Workflow } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { type DemoCase } from "@/lib/demo-data";
import { formatRelativeTime, getGreeting } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge, CaseStatusBadge } from "@/components/cases/status-badge";
import { EmptyState } from "@/components/ui/states";
import { RefreshDashboardButton } from "@/components/dashboard/refresh-dashboard-button";

async function getCurrentUserName() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "Usuario";

  const { data: profile } = await (supabase as any)
    .from("users")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuario";
}

async function getCases(): Promise<DemoCase[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("cases").select("id,case_number,title,description,status,priority,updated_at,created_at,requires_approval,requires_human,contacts(name,company),departments(name)").order("updated_at", { ascending: false }).limit(8);
    return (data ?? []) as unknown as DemoCase[];
  } catch { return []; }
}

type WorkflowSummary = { id: string; code: string; name: string; is_active: boolean };

async function getDashboardSummary() {
  const supabase = await createClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [emails, activeCases, approvals, followUps] = await Promise.all([
    supabase.from("emails").select("id", { count: "exact", head: true }).gte("created_at", today.toISOString()),
    supabase.from("cases").select("id", { count: "exact", head: true }).not("status", "in", "(resolved,closed,cancelled)"),
    supabase.from("approvals").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("follow_ups").select("id", { count: "exact", head: true }).neq("status", "completed"),
  ]);
  return {
    emailsProcessed: emails.count ?? 0,
    activeCases: activeCases.count ?? 0,
    pendingApprovals: approvals.count ?? 0,
    openFollowUps: followUps.count ?? 0,
  };
}

async function getWorkflowSummaries(): Promise<WorkflowSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("workflow_definitions").select("id,code,name,is_active").order("code").limit(12);
  return (data ?? []) as unknown as WorkflowSummary[];
}

export default async function DashboardPage() {
  const [cases, userName, summary, workflowSummaries] = await Promise.all([
    getCases(),
    getCurrentUserName(),
    getDashboardSummary(),
    getWorkflowSummaries(),
  ]);
  const attention = cases.filter((c) => ["waiting_approval", "waiting_human", "waiting_verification", "follow_up"].includes(c.status as string)).slice(0, 4);
  return (
  <div className="min-w-0 space-y-8">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="font-mono text-[11px] uppercase tracking-[.18em] text-muted-foreground mb-3">
          {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
        <h1 className="text-3xl sm:text-[34px] font-semibold tracking-[-.04em]">{getGreeting()}, {userName}</h1>
        <p className="mt-1.5 text-muted-foreground">Esto es lo que requiere tu atención.</p>
      </div>
      <RefreshDashboardButton />
    </div>

    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[13px] font-semibold tracking-wide uppercase">Atención requerida</h2>
          <p className="text-xs text-muted-foreground mt-1">Asuntos que esperan una decisión humana.</p>
        </div>
        <Link href="/cases?filter=attention" className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1">Ver todos <ArrowUpRight className="h-3.5 w-3.5" /></Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {attention.map((item) => (
          <Card key={item.id} className="group hover:border-foreground/25 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <PriorityBadge priority={item.priority as any} />
                <button aria-label="Más opciones" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <Link href={`/cases/${item.id}`} className="block mt-4">
                <h3 className="font-medium text-sm leading-snug group-hover:underline underline-offset-4">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-1.5 truncate">
                  {(item as any).contacts?.company || (item as any).company || "Cliente empresarial"}
                </p>
              </Link>
              <p className="text-xs text-muted-foreground/80 mt-4 line-clamp-2 leading-relaxed">{item.description}</p>
              <div className="mt-4 pt-3 border-t flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock3 className="h-3 w-3" />
                  {formatRelativeTime(item.updated_at)}
                </span>
                <CaseStatusBadge status={item.status as any} />
              </div>
            </CardContent>
          </Card>
        ))}
        {attention.length === 0 ? <Card className="sm:col-span-2 xl:col-span-4"><EmptyState compact title="Todo está al día" description="No hay casos que requieran una decisión humana en este momento." /></Card> : null}
      </div>
    </section>

    <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-[13px] uppercase tracking-wide">Resumen del día</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Estado operativo en tiempo real.</p>
          </div>
          <Sparkles className="h-4 w-4 text-muted-foreground" />
        </CardHeader>

        <CardContent className="grid grid-cols-2 gap-y-5 sm:grid-cols-4 sm:gap-y-0">
          <div className="min-w-0 border-b border-r pb-4 pr-4 sm:border-b-0 sm:pb-0">
            <Inbox className="mb-3 h-4 w-4 text-muted-foreground" />
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{summary.emailsProcessed.toLocaleString("es-ES")}</p>
            <p className="text-xs text-muted-foreground mt-1">Correos procesados</p>
          </div>
          <div className="min-w-0 border-b pb-4 pl-4 sm:border-b-0 sm:border-r sm:pb-0">
            <FileCheck2 className="mb-3 h-4 w-4 text-muted-foreground" />
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{summary.activeCases.toLocaleString("es-ES")}</p>
            <p className="text-xs text-muted-foreground mt-1">Casos activos</p>
          </div>
          <div className="min-w-0 border-r pr-4 sm:px-4">
            <OctagonAlert className="mb-3 h-4 w-4 text-warning" />
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{summary.pendingApprovals.toLocaleString("es-ES")}</p>
            <p className="text-xs text-muted-foreground mt-1">Aprobaciones</p>
          </div>
          <div className="min-w-0 pl-4">
            <Clock3 className="mb-3 h-4 w-4 text-muted-foreground" />
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{summary.openFollowUps.toLocaleString("es-ES")}</p>
            <p className="text-xs text-muted-foreground mt-1">Seguimientos</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[13px] uppercase tracking-wide">Actividad reciente</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {[
              ["09:45", "Aprobación solicitada", "Caso #184", "warning"],
              ["09:44", "Borrador generado", "PE03 · Reply Orchestrator", "info"],
              ["09:43", "Agente clasificó como urgente", "Caso #184", "danger"],
              ["09:42", "Correo recibido", "Mariana López", "muted"],
            ].map(([time, title, detail, tone]) => (
              <div key={time} className="flex gap-3">
                <span className="font-mono text-[10px] text-muted-foreground pt-0.5 w-9">{time}</span>
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    tone === "warning" ? "bg-warning" : tone === "info" ? "bg-info" : tone === "danger" ? "bg-destructive" : "bg-muted-foreground/40"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium">{title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 break-words">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader className="flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-[13px] uppercase tracking-wide">Estado de automatizaciones</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{workflowSummaries.length} workflows configurados en tu operación.</p>
        </div>
        <Link href="/automations" className="text-xs text-muted-foreground hover:text-foreground flex gap-1 items-center">
          Ver automatizaciones <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {workflowSummaries.map((workflow) => (
            <div key={workflow.id} className="flex items-center gap-3 py-2.5 border-b last:border-0">
              <span className="font-mono text-[10px] text-muted-foreground w-8">{workflow.code}</span>
              <Workflow className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium flex-1 truncate">{workflow.name}</span>
              <Badge variant={workflow.is_active ? "success" : "secondary"}>{workflow.is_active ? "Activo" : "Pausado"}</Badge>
            </div>
          ))}
          {workflowSummaries.length === 0 ? <EmptyState compact title="Sin automatizaciones" description="No hay workflows configurados para esta organización." /> : null}
        </div>
      </CardContent>
    </Card>
    
  </div>
  );
}
