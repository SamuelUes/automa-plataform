"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { BriefcaseBusiness, FileText, Mail, Search, Users } from "lucide-react";

type SearchResults = {
  cases: Array<{ id: string; case_number: number; title: string }>;
  emails: Array<{ id: string; subject: string | null; case_id: string | null }>;
  contacts: Array<{ id: string; name: string | null; company: string | null }>;
  actions: Array<{ id: string; action_type: string; case_id: string | null }>;
};

const emptyResults: SearchResults = {
  cases: [],
  emails: [],
  contacts: [],
  actions: [],
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(emptyResults);
      return;
    }

    const timeout = window.setTimeout(() => {
      void (async () => {
        const { data } = await createClient().functions.invoke("search", {
          body: { query },
        });
        if (data?.data) setResults(data.data as SearchResults);
      })();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [query]);

  const count = Object.values(results).reduce((total, items) => total + items.length, 0);

  return (
    <div className="relative hidden md:block w-70">
      <div className="flex items-center h-9 border rounded-md px-3 gap-2 text-muted-foreground">
        <Search className="h-4 w-4" />
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar casos, correos o acciones..."
          className="border-0 shadow-none h-8 p-0 focus-visible:ring-0 text-xs"
          aria-label="Buscar casos, correos o acciones"
        />
        <kbd className="hidden xl:inline-flex pointer-events-none h-5 select-none items-center rounded border bg-muted px-1.5 font-mono text-[10px]"> K</kbd>
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute right-0 top-11 z-50 w-[min(420px,calc(100vw-2rem))] rounded-xl border bg-popover shadow-lg overflow-hidden">
          {count === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">Sin resultados para “{query}”.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <ResultGroup label="Casos" icon={<BriefcaseBusiness />}>
                {results.cases.map((item) => <Link key={item.id} href={`/cases/${item.id}`} onClick={() => setOpen(false)} className="block px-4 py-2.5 hover:bg-muted/50">
                  <p className="text-xs font-medium">{item.title}</p>
                  <p className="text-[10px] text-muted-foreground">Caso #{item.case_number}</p>
                </Link>)}
              </ResultGroup>
              <ResultGroup label="Correos" icon={<Mail />}>
                {results.emails.map((item) => <Link key={item.id} href="/emails" onClick={() => setOpen(false)} className="block px-4 py-2.5 hover:bg-muted/50">
                  <p className="text-xs font-medium">{item.subject || "Sin asunto"}</p>
                  <p className="text-[10px] text-muted-foreground">Correo relacionado</p>
                </Link>)}
              </ResultGroup>
              <ResultGroup label="Contactos" icon={<Users />}>
                {results.contacts.map((item) => <div key={item.id} className="px-4 py-2.5">
                  <p className="text-xs font-medium">{item.name || "Sin nombre"}</p>
                  <p className="text-[10px] text-muted-foreground">{item.company || "Sin empresa"}</p>
                </div>)}
              </ResultGroup>
              <ResultGroup label="Acciones" icon={<FileText />}>
                {results.actions.map((item) => <div key={item.id} className="px-4 py-2.5">
                  <p className="text-xs font-medium">{item.action_type}</p>
                  <p className="text-[10px] text-muted-foreground">Caso: {item.case_id || "Sin caso"}</p>
                </div>)}
              </ResultGroup>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="border-b last:border-0">
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/30">
      <span className="h-5 w-5 flex items-center justify-center text-muted-foreground">{icon}</span>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
    {children}
  </section>;
}
