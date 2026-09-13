import { AppShell } from "@/components/layout/app-shell";
import { RealtimeBridge } from "@/components/providers/realtime-bridge";
import { createClient } from "@/lib/supabase/server";
import { Building2 } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await (supabase as any)
        .from("users")
        .select("id,organization_id,full_name,email,avatar_url,role,is_active,settings")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const navBadges: { cases?: string; approvals?: string } = {};
  if (user && profile?.organization_id && profile.is_active) {
    const [activeCases, pendingApprovals] = await Promise.all([
      (supabase as any)
        .from("cases")
        .select("id", { count: "exact", head: true })
        .not("status", "in", '("resolved","closed","cancelled")'),
      (supabase as any)
        .from("approvals")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);
    if (activeCases.count) navBadges.cases = String(activeCases.count);
    if (pendingApprovals.count) navBadges.approvals = String(pendingApprovals.count);
  }

  if (!user || !profile?.organization_id || !profile.is_active) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
            <Building2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight mt-5">
            Cuenta pendiente de configuración
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mt-3">
            Tu cuenta aún no ha sido configurada para una organización. Contacta a un administrador para solicitar acceso.
          </p>
          <div className="mt-6">
            <SignOutButton />
          </div>
        </div>
      </main>
    );
  }

  const fullName =
    profile.full_name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Usuario";

  return (
    <AppShell
      currentUser={{
        fullName,
        email: profile.email || user.email || "",
        role: profile.role || "agent",
        avatarUrl: profile.avatar_url,
      }}
      navBadges={navBadges}
    >
      <RealtimeBridge />
      {children}
    </AppShell>
  );
}
