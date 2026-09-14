"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hasRole } from "@/lib/permissions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BriefcaseBusiness, FileCheck2, Inbox, LayoutDashboard, Mail, Search, Settings, Users, Workflow, X } from "lucide-react";

type SearchResults = {
  cases: Array<{ id: string; case_number: number; title: string }>;
  emails: Array<{ id: string; subject: string | null; case_id: string | null }>;
  contacts: Array<{ id: string; name: string | null; company: string | null }>;
  actions: Array<{ id: string; action_type: string; case_id: string | null }>;
};

type SearchItem = {
  id: string;
  label: string;
  meta: string;
  href: string;
  icon: typeof Search;
};

const emptyResults: SearchResults = { cases: [], emails: [], contacts: [], actions: [] };
const commands: SearchItem[] = [
  { id: "nav-dashboard", label: "Ir al inicio", meta: "Navegación", href: "/dashboard", icon: LayoutDashboard },
  { id: "nav-cases", label: "Ver casos", meta: "Operaciones", href: "/cases", icon: BriefcaseBusiness },
  { id: "nav-emails", label: "Abrir correos", meta: "Operaciones", href: "/emails", icon: Inbox },
  { id: "nav-approvals", label: "Revisar aprobaciones", meta: "Decisiones", href: "/approvals", icon: FileCheck2 },
  { id: "nav-automations", label: "Ver automatizaciones", meta: "Sistema", href: "/automations", icon: Workflow },
  { id: "nav-settings", label: "Abrir configuración", meta: "Sistema", href: "/settings", icon: Settings },
];

export function GlobalSearch() {
  const router = useRouter();
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [role, setRole] = useState("viewer");

  useEffect(() => {
    void (async () => {
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();
      if (!user) return;
      const { data: profile } = await (client as any)
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role) setRole(profile.role);
    })();
  }, []);

  const visibleCommands = useMemo(
    () => commands.filter((item) => {
      if (item.id === "nav-automations" || item.id === "nav-settings") return role === "owner";
      if (item.id === "nav-cases") return hasRole(role, "manager");
      if (item.id === "nav-emails" || item.id === "nav-approvals") return hasRole(role, "agent");
      return true;
    }),
    [role]
  );

  const items = useMemo<SearchItem[]>(() => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 2) return visibleCommands.filter((item) => !normalized || `${item.label} ${item.meta}`.toLowerCase().includes(normalized));
    return [
      ...results.cases.map((item) => ({ id: `case-${item.id}`, label: item.title, meta: `Caso #${item.case_number}`, href: `/cases/${item.id}`, icon: BriefcaseBusiness })),
      ...results.emails.map((item) => ({ id: `email-${item.id}`, label: item.subject || "Sin asunto", meta: "Correo", href: item.case_id ? `/cases/${item.case_id}` : "/emails", icon: Mail })),
      ...results.contacts.map((item) => ({ id: `contact-${item.id}`, label: item.name || "Sin nombre", meta: item.company || "Contacto", href: `/cases?search=${encodeURIComponent(item.name || item.company || "")}`, icon: Users })),
      ...results.actions.map((item) => ({ id: `action-${item.id}`, label: item.action_type, meta: "Acción", href: item.case_id ? `/cases/${item.case_id}` : "/activity", icon: FileCheck2 })),
    ];
  }, [query, results, visibleCommands]);

  const focusSearch = useCallback(() => {
    const input = window.matchMedia("(min-width: 768px)").matches ? desktopInputRef.current : mobileInputRef.current;
    window.setTimeout(() => input?.focus(), 0);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        focusSearch();
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusSearch]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(emptyResults);
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    const timeout = window.setTimeout(() => {
      void (async () => {
        const { data, error: searchError } = await createClient().functions.invoke("search", { body: { query } });
        setLoading(false);
        setError(Boolean(searchError));
        setResults(data?.data ? data.data as SearchResults : emptyResults);
      })();
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => setActiveIndex(0), [query, items.length]);

  function selectItem(index: number) {
    const item = items[index];
    if (!item) return;
    setOpen(false);
    setQuery("");
    router.push(item.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectItem(activeIndex);
    }
  }

  return (
    <div className="relative md:w-70">
      <Button variant="ghost" size="icon" className="md:hidden" aria-label="Abrir búsqueda global" aria-expanded={open} onClick={() => { setOpen(true); focusSearch(); }}><Search /></Button>
      <div className="hidden h-9 items-center gap-2 rounded-md border px-3 text-muted-foreground md:flex">
        <Search className="h-4 w-4" />
        <Input 
         ref={desktopInputRef} 
         value={query} 
         onChange={(event) => { setQuery(event.target.value); setOpen(true); }} 
         onFocus={() => setOpen(true)} 
         onKeyDown={onInputKeyDown} 
         placeholder="Buscar o ir a..." 
         className="h-8 border-0 p-0 text-xs shadow-none focus-visible:ring-0" 
         aria-label="Buscar casos, correos o acciones" 
         aria-controls="global-search-results" 
         aria-activedescendant={items[activeIndex]?.id} />
        <kbd className="pointer-events-none hidden h-5 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px] xl:inline-flex">⌘+K</kbd>
      </div>

      {open ? <div className="fixed inset-x-3 top-3 z-50 overflow-hidden rounded-xl border bg-popover shadow-lg md:absolute md:inset-x-auto md:right-0 md:top-11 md:w-[min(440px,calc(100vw-2rem))]">
        <div className="flex items-center gap-2 border-b p-2 md:hidden">
          <Search className="ml-2 h-4 w-4 text-muted-foreground" />
          <Input 
           ref={mobileInputRef} 
           value={query} 
           onChange={(event) => setQuery(event.target.value)} 
           onKeyDown={onInputKeyDown} 
           placeholder="Buscar o ir a..." 
           className="border-0 shadow-none focus-visible:ring-0" 
           aria-label="Buscar casos, correos o acciones" 
           aria-controls="global-search-results" 
           aria-activedescendant={items[activeIndex]?.id} />
          <Button variant="ghost" size="icon" aria-label="Cerrar búsqueda" onClick={() => setOpen(false)}><X /></Button>
        </div>
        <div id="global-search-results" role="listbox" className="max-h-[min(70dvh,28rem)] overflow-y-auto p-2">
          {loading ? <p role="status" className="px-3 py-8 text-center text-xs text-muted-foreground">Buscando...</p> : error ? <p role="alert" className="px-3 py-8 text-center text-xs text-destructive">No se pudo completar la búsqueda.</p> : items.length === 0 ? <p className="px-3 py-8 text-center text-xs text-muted-foreground">Sin resultados para “{query}”.</p> : items.map((item, index) => {
            const Icon = item.icon;
            return <button id={item.id} role="option" aria-selected={index === activeIndex} key={item.id} onMouseEnter={() => setActiveIndex(index)} onClick={() => selectItem(index)} className={`flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left transition-colors ${index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"}`}>
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.label}</span><span className="block truncate text-[11px] text-muted-foreground">{item.meta}</span></span>
            </button>;
          })}
        </div>
        <div className="hidden items-center justify-between border-t px-3 py-2 text-[10px] text-muted-foreground md:flex"><span>↑↓ Seleccionar</span><span>Enter Abrir</span><span>Esc Cerrar</span></div>
      </div> : null}
    </div>
  );
}
