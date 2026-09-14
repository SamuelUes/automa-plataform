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

type DashboardContext = {
  userId: string;
  organizationId: string;
  role: string;
  userName: string;
};

type WorkflowSummary = { id: string; code: string; name: string; is_active: boolean };
type RecentActivity = {
  id: string;
  time: string;
  title: string;
  detail: string;
  tone: "warning" | "info" | "danger" | "muted";
};

async function getDashboardContext(): Promise<DashboardContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await (supabase as any)
    .from("users")
    .select("full_name,organization_id,role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.organization_id) return null;

  return {
    userId: user.id,
    organizationId: profile.organization_id,
    role: profile.role || "viewer",
    userName: profile.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuario",
  };
}

function isIndividualRole(role: string) {
  return role === "agent";
}

async function getCases(context: DashboardContext): Promise<DemoCase[]> {
  const supabase = await createClient();
  let query = supabase
    .from("cases")
    .select("id,case_number,title,description,status,priority,updated_at,created_at,requires_approval,requires_human,contacts(name,company),departments(name)")
    .eq("organization_id", context.organizationId)
    .order("updated_at", { ascending: false })
    .limit(8);

  if (isIndividualRole(context.role)) query = query.eq("assigned_to", context.userId);

  const { data } = await query;
  return (data ?? []) as unknown as DemoCase[];
}

async function getDashboardSummary(context: DashboardContext) {
  const supabase = await createClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const scope = isIndividualRole(context.role) ? { userId: context.userId } : null;

  const [emails, activeCases, approvals, assignedCases] = await Promise.all([
    supabase
      .from("emails")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", context.organizationId)
      .gte("created_at", today.toISOString()),
    (() => {
      let query = supabase
        .from("cases")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", context.organizationId)
        .not("status", "in", "(resolved,closed,cancelled)");
      if (scope) query = query.eq("assigned_to", scope.userId);
      return query;
    })(),
    (() => {
      let query = supabase
        .from("approvals")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", context.organizationId)
        .eq("status", "pending");
      if (scope) query = query.eq("requested_from", scope.userId);
      return query;
    })(),
    scope
      ? supabase.from("cases").select("id").eq("organization_id", context.organizationId).eq("assigned_to", scope.userId)
      : Promise.resolve({ data: null }),
  ]);

  let followUpQuery = supabase
    .from("follow_ups")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", context.organizationId)
    .neq("status", "completed");
  if (scope) {
    const ids = (assignedCases.data || []).map((item: { id: string }) => item.id);
    followUpQuery = ids.length ? followUpQuery.in("case_id", ids) : followUpQuery.eq("case_id", "00000000-0000-0000-0000-000000000000");
  }
  const followUps = await followUpQuery;

  return {
    emailsProcessed: emails.count ?? 0,
    activeCases: activeCases.count ?? 0,
    pendingApprovals: approvals.count ?? 0,
    openFollowUps: followUps.count ?? 0,
  };
}

async function getWorkflowSummaries(context: DashboardContext): Promise<{ workflows: WorkflowSummary[]; total: number }> {
  const supabase = await createClient();
  const { data, count } = await supabase
    .from("workflow_definitions")
    .select("id,code,name,is_active", { count: "exact" })
    .eq("organization_id", context.organizationId)
    .order("code");
  return {
    workflows: (data ?? []) as unknown as WorkflowSummary[],
    total: count ?? data?.length ?? 0,
  };
}

async function getRecentActivity(context: DashboardContext): Promise<RecentActivity[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("id,event_type,entity_type,created_at,case_id,metadata")
    .eq("organization_id", context.organizationId)
    .order("created_at", { ascending: false })
    .limit(4);

  return (data || []).map((event: { id: string; event_type: string; entity_type: string | null; created_at: string; case_id: string | null }) => ({
    id: event.id,
    time: new Date(event.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
    title: event.event_type.replaceAll("_", " "),
    detail: event.case_id ? `Caso asociado` : event.entity_type || "Actividad operativa",
    tone: event.event_type.includes("approval") ? "warning" : event.event_type.includes("error") ? "danger" : "info",
  }));
}

export default async function DashboardPage() {
  const context = await getDashboardContext();

  if (!context) {
    return null;
  }

  const [cases, summary, workflowSummary, recentActivity] = await Promise.all([
    getCases(context),
    getDashboardSummary(context),
    context.role === "owner"
      ? getWorkflowSummaries(context)
      : Promise.resolve({ workflows: [] as WorkflowSummary[], total: 0 }),
    context.role === "owner"
      ? getRecentActivity(context)
      : Promise.resolve([] as RecentActivity[]),
  ]);
  const { userName } = context;
  const workflowSummaries = workflowSummary.workflows;
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

      {context.role === "owner" ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[13px] uppercase tracking-wide">Actividad reciente</CardTitle>
          </CardHeader>

          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex gap-3">
                  <span className="font-mono text-[10px] text-muted-foreground pt-0.5 w-9">{activity.time}</span>
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      activity.tone === "warning" ? "bg-warning" : activity.tone === "info" ? "bg-info" : activity.tone === "danger" ? "bg-destructive" : "bg-muted-foreground/40"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium capitalize">{activity.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 break-words">{activity.detail}</p>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay actividad reciente en tu organización.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>

    {context.role === "owner" ? (
      <Card>
        <CardHeader className="flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-[13px] uppercase tracking-wide">
              Estado de automatizaciones
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{workflowSummary.total} {workflowSummary.total === 1 ? "workflow configurado" : "workflows configurados"} en tu operación.</p>
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
    ) : null}
    
  </div>
  );
}
