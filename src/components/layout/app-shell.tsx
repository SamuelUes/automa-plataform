"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn, getInitials } from "@/lib/utils";
import { NotificationBell } from "@/components/layout/notification-bell";
import { GlobalSearch } from "@/components/layout/global-search";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CurrentUserProvider } from "@/components/providers/current-user-context";
import { Logo } from "@/components/brand/logo";
import { canAccessPath } from "@/lib/permissions";
import { Bot, BriefcaseBusiness, ChevronRight, CircleHelp, FileText, Inbox, LayoutDashboard, LogOut, Menu, Moon, PanelLeft, Settings, Sun, Users, Workflow, Zap } from "lucide-react";
import { useTheme } from "next-themes";

const mainNav = [
  { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { href: "/cases", label: "Casos", icon: BriefcaseBusiness },
  { href: "/emails", label: "Correos", icon: Inbox },
  { href: "/approvals", label: "Aprobaciones", icon: FileText },
];
const operationsNav = [
  { href: "/delegations", label: "Delegaciones", icon: Users },
  { href: "/follow-ups", label: "Seguimientos", icon: Zap },
  { href: "/assistant", label: "Conversaciones", icon: Bot },
  { href: "/automations", label: "Automatizaciones", icon: Workflow },
];
const systemNav = [{ href: "/activity", label: "Actividad", icon: PanelLeft }, { href: "/settings", label: "Configuración", icon: Settings }];

function NavContent({ collapsed, onNavigate, badges, role }: { collapsed: boolean; onNavigate?: () => void; badges?: { cases?: string; approvals?: string }; role: string }) {
  const pathname = usePathname();
  const navGroup = (items: typeof mainNav, title: string) => {
    const visible = items.filter((item) => canAccessPath(role, item.href));
    if (!visible.length) return null;

  return <div className="mb-6">
    <p className={cn("px-3 mb-2 font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground/65", collapsed && "sr-only")}>{title} </p>
    
    {visible.map(({ href, label, icon: Icon }) => {
      const badge = badges && href === "/cases" ? badges.cases : badges && href === "/approvals" ? badges.approvals : undefined;
      const active = pathname === href || pathname.startsWith(href + "/"); 
    
    return (
    
    <Link key={href} href={href} onClick={onNavigate} title={collapsed ? label : undefined} className={cn("group flex items-center gap-3 h-9 rounded-md px-3 text-[13px] transition-colors", active ? "bg-sidebar-accent text-foreground font-medium" : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground", collapsed && "justify-center px-0") }>
      <Icon className={cn("h-4.25 w-4.25 shrink-0", active ? "text-foreground" : "text-muted-foreground/80")} />
      <span className={cn("flex-1 truncate", collapsed && "hidden")}>{label}
        {badge && !collapsed && 
         <span className="min-w-5 h-5 px-1.5 rounded-full bg-foreground/8 text-[10px] font-mono text-muted-foreground flex items-center justify-center">{badge}
         </span>}
      </span>
      </Link>
    );
  })}
  </div>;
  };

  return <>
  <div className="flex items-center gap-3 h-12 mb-8 px-2">
    <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
      <Logo className="h-5 w-5" />
    </div>
    {!collapsed && <div className="font-semibold text-sm tracking-tight">Prologistica 
      <span className="text-muted-foreground font-normal">AI</span>
    </div>}
  </div>
  {navGroup(mainNav, "Command Center")}
  {navGroup(operationsNav, "Operaciones")}
  {navGroup(systemNav, "Sistema")}
  </>;
}

type CurrentUser = {
  fullName: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
};

function Sidebar({
  collapsed,
  setCollapsed,
  currentUser,
  badges,
}: {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  currentUser: CurrentUser;
  badges?: { cases?: string; approvals?: string };
}) {
  const router = useRouter();
  async function signOut() { 
    await createClient().auth.signOut(); 
    router.push("/login"); 
    router.refresh(); 
  }
    
  return (
  <aside className={cn("hidden lg:flex flex-col border-r bg-sidebar border-sidebar-border p-3 transition-[width] duration-200", collapsed ? "w-18" : "w-61")}>
    <NavContent collapsed={collapsed} badges={badges} role={currentUser.role} />
    <div className="mt-auto">
      <div className={cn("border-t border-sidebar-border pt-3", collapsed && "flex flex-col items-center")}>
        <button className={cn("w-full flex items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-sidebar-accent transition-colors", collapsed && "justify-center")}>
          <Avatar className="h-8 w-8">
            {currentUser.avatarUrl && <AvatarImage src={currentUser.avatarUrl} alt={currentUser.fullName} />}
            <AvatarFallback className="bg-[#d7e7e2] text-[#28584e] text-xs font-semibold">{getInitials(currentUser.fullName)}</AvatarFallback>
          </Avatar>
          {!collapsed && <div className="min-w-0"><div className="text-xs font-medium truncate">{currentUser.fullName}</div><div className="text-[11px] text-muted-foreground truncate">{currentUser.role}</div></div>}
        </button>
        {!collapsed && <div className="flex items-center gap-2 px-3 mt-3 text-[11px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> Conectado <span className="ml-auto font-mono text-[10px]">v0.1</span>
        </div>}
        <button onClick={signOut} title="Cerrar sesión" className={cn("mt-2 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-2 py-2", collapsed && "justify-center")}>
          <LogOut className="h-4 w-4" />
          {!collapsed && "Cerrar sesión"}
        </button>
      </div>
    </div>
    <button aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"} onClick={() => setCollapsed(!collapsed)} className="absolute -right-3 top-14 h-6 w-6 rounded-full border bg-background flex items-center justify-center shadow-sm hover:bg-accent">
      <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", !collapsed && "rotate-180")} />
    </button>
  </aside>
  );
}

export function AppShell({
  children,
  currentUser,
  navBadges,
}: {
  children: React.ReactNode;
  currentUser: CurrentUser;
  navBadges?: { cases?: string; approvals?: string };
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const currentSection = pathname.split("/")[1] || "inicio";
  const { theme, setTheme } = useTheme();
  useEffect(() => setMounted(true), []);
  return (
  <CurrentUserProvider value={currentUser}>
  <div className="min-h-screen flex min-w-0 bg-background">
    <div className="relative">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        currentUser={currentUser}
        badges={navBadges}
      />
    </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex min-h-16 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur sm:gap-3 sm:px-7">
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" aria-label="Abrir menú"><Menu /></Button>
            </SheetTrigger>
            <div className="min-w-0 flex-1 sm:flex-none">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="truncate font-medium text-foreground">Command Center</span>
                <ChevronRight className="hidden h-3 w-3 shrink-0 sm:block" />
                <span className="hidden capitalize sm:block">{currentSection}</span>
              </div>
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1.5">
              <GlobalSearch />
              <Button variant="ghost" size="icon" aria-label="Ayuda">
                <CircleHelp />
              </Button>
              <NotificationBell />
              <Button variant="ghost" size="icon" aria-label="Cambiar tema" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {mounted ? (theme === "dark" ? <Sun /> : <Moon />) : <Sun className="opacity-0" />}
              </Button>
              <div className="hidden h-7 w-px bg-border sm:ml-1 sm:block" />
              <Avatar className="h-8 w-8 sm:hidden">
                {currentUser.avatarUrl && <AvatarImage src={currentUser.avatarUrl} alt={currentUser.fullName} />}
                <AvatarFallback className="bg-[#d7e7e2] text-[#28584e] text-xs">{getInitials(currentUser.fullName)}</AvatarFallback>
              </Avatar>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-auto">
            <div className="mx-auto max-w-360 px-3 py-5 sm:px-7 sm:py-7 lg:px-10">{children}</div>
          </main>
        </div>
        <SheetContent side="left" className="w-[min(17rem,calc(100vw-1rem))] bg-sidebar p-3">
          <SheetTitle className="sr-only">Navegación principal</SheetTitle>
          <NavContent collapsed={false} onNavigate={() => setMobileOpen(false)} badges={navBadges} role={currentUser.role} />
        </SheetContent>
      </Sheet>
    </div>
  </CurrentUserProvider>
  );
}
