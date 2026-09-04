"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeTable } from "@/lib/supabase/realtime";
import { type Activity } from "@/lib/phase5-demo-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Activity as ActivityIcon, CalendarDays, ChevronDown, FileCheck2, Mail, Search, Send, Users, XCircle, Zap } from "lucide-react";

const iconFor = (event: string) => event.includes("Workflow") ? XCircle : event.includes("Aprobación") ? FileCheck2 : event.includes("email") ? Send : event.includes("Cliente") ? Mail : event.includes("delegado") ? Users : Zap;
const toneFor = (event: string): Activity["tone"] => /error|failed|rechaz/i.test(event) ? "danger" : /approval|aprobación|waiting|deleg/i.test(event) ? "warning" : /sent|complete|resolv|closed|cread/i.test(event) ? "success" : "info";
export default function ActivityPage() {
  const [items, setItems] = useState<Activity[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const load = useCallback(async () => {
    setLoadError(false);
    const { data, error } = await (createClient() as any).from("audit_logs").select("id,event_type,user_id,case_id,entity_type,created_at,metadata,new_data").order("created_at", { ascending: false }).limit(50);
    setLoading(false);
    setLoadError(Boolean(error));
    setItems(data?.map((item: any) => ({
      id: item.id,
      event: item.event_type,
      actor: item.user_id ? "Usuario del equipo" : "Sistema",
      detail: item.case_id ? `Caso ${item.case_id}` : item.entity_type || "Actividad del sistema",
      time: new Date(item.created_at).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      createdAt: item.created_at,
      tone: toneFor(item.event_type),
    })) ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useRealtimeTable("audit_logs", load);
  const visible = useMemo(() => items.filter((item) => {
    const date = item.createdAt ? new Date(item.createdAt) : null;
    const after = !fromDate || (date && date >= new Date(`${fromDate}T00:00:00`));
    const before = !toDate || (date && date <= new Date(`${toDate}T23:59:59`));
    return (filter === "all" || item.tone === filter) && after && before && (
      !search || `${item.event} ${item.actor} ${item.detail}`.toLowerCase().includes(search.toLowerCase())
    );
  }), [filter, items, search, fromDate, toDate]);
  
  return (
  <div className="space-y-7">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="font-mono text-[11px] uppercase tracking-[.18em] text-muted-foreground mb-3">Operations / Trace</p>
      <h1 className="text-3xl font-semibold tracking-[-.04em]">Actividad</h1>
      <p className="text-muted-foreground mt-1.5">Una línea de tiempo completa de las decisiones y movimientos del sistema.</p>
      </div><Button variant="outline" onClick={() => void load()}>
        <ActivityIcon />Actualizar actividad</Button>
      </div>
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en actividad..." className="pl-9" aria-label="Buscar en actividad" />
        </div>
        <div className="flex flex-wrap gap-2">
          {[["all", "Todos"], ["success", "Éxito"], ["info", "Operativo"], ["warning", "Revisión"], ["danger", "Errores"]].map(([key, label]) => <Button key={key} size="sm" variant={filter === key ? "secondary" : "outline"} onClick={() => setFilter(key)}>{label}</Button>)}
        </div>
        <Button variant="outline" size="sm" onClick={() => setDateOpen((open) => !open)}>
          <CalendarDays />Fecha <ChevronDown />
        </Button>
        {dateOpen && <div className="flex items-end gap-2 rounded-md border bg-background p-2 text-xs">
          <label className="grid gap-1">Desde
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 rounded-md border px-2" />
          </label>
          <label className="grid gap-1">Hasta
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 rounded-md border px-2" />
          </label>
          <Button variant="ghost" size="sm" onClick={() => { setFromDate(""); setToDate(""); }}>Limpiar</Button>
        </div>}
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide">Timeline global</p>
              <p className="text-[11px] text-muted-foreground mt-1">{visible.length} eventos registrados</p>
            </div>
            <Badge variant="secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-success mr-1.5" />Audit log activo
            </Badge>
          </div>
          {loading ? <LoadingState compact label="Cargando actividad..." /> : null}
          {loadError ? <ErrorState compact message="No pudimos cargar el registro de actividad." onRetry={() => void load()} /> : null}
          <div className={loading || loadError ? "hidden" : "divide-y"}>
            {visible.map((item) => {
              const Icon = iconFor(item.event);
              return (
                <div key={item.id} className="flex gap-4 px-5 py-4 hover:bg-muted/20">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${item.tone === "success" ? "bg-success/10 text-success" : item.tone === "danger" ? "bg-destructive/10 text-destructive" : item.tone === "warning" ? "bg-warning/10 text-warning" : "bg-info/10 text-info"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{item.event}</p>
                      <span className="text-[11px] text-muted-foreground">por {item.actor}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{item.detail}</p>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">{item.time}</span>
                </div>
              );
            })}
          </div>
          {!loading && !loadError && visible.length === 0 ? <EmptyState compact title="Sin actividad" description="No encontramos eventos con los filtros seleccionados." /> : null}
        </CardContent>
      </Card>
    </div>
  );
}
