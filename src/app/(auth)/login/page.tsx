"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowRight, Command, Loader2, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [redirectPath, setRedirectPath] = useState("/dashboard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const redirect = new URLSearchParams(window.location.search).get("redirect");
    if (redirect) setRedirectPath(redirect);
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(null);
    const { error: authError } = await createClient().auth.signInWithPassword({ email, password });
    if (authError) { setError("No pudimos iniciar sesión. Revisa tus credenciales."); setLoading(false); return; }
    router.push(redirectPath); router.refresh();
  }

  return (
  <main className="min-h-screen bg-background flex">
    <section className="hidden lg:flex lg:w-[53%] bg-[#1b2028] text-white p-12 flex-col justify-between relative overflow-hidden">
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      <div className="relative flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-white text-[#1b2028] flex items-center justify-center">
          <Command className="h-5 w-5" />
        </div>
        <span className="text-white/45 ">Pro 
          <span className="text-white/85 font-semibold tracking-tight">logistica</span>
        </span>
      </div>
      
      <div className="relative max-w-lg">
        <p className="font-mono text-[11px] uppercase tracking-[.22em] text-white/45 mb-5">Executive operations / 01</p>
        <h1 className="text-5xl font-semibold tracking-[-.045em] leading-[1.06]">La inteligencia <br /> que mantiene <br />
        <span className="text-white/45">todo en movimiento.</span>
        </h1>
        <p className="mt-7 text-white/55 text-base leading-relaxed max-w-md">Un centro de control para convertir cada correo, decisión y seguimiento en operaciones claras.</p>
      </div>
      
      <div className="relative flex items-center gap-2 text-xs text-white/45">
        <ShieldCheck className="h-4 w-4" /> Entorno seguro · Datos protegidos por Supabase
      </div>
    </section>
   
    <section className="flex-1 flex items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-95">
        <div className="lg:hidden flex items-center gap-3 mb-16">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Command className="h-5 w-5" />
          </div>
          <span className="font-semibold">Prologistica 
            <span className="text-muted-foreground">AI
              </span>
            </span>
          </div>
      <p className="font-mono text-[11px] uppercase tracking-[.2em] text-muted-foreground mb-4">Command Center
        </p>
        <h2 className="text-3xl font-semibold tracking-[-.035em]">Bienvenida de vuelta</h2>
        <p className="text-muted-foreground mt-2 mb-8">Accede a tu espacio de operaciones.</p>
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@empresa.com" required autoComplete="email" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="password">Contraseña</Label>
            <a href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground transition-colors">¿La olvidaste?</a>
          </div>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
        </div>
        {error && <div role="alert" className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>}
        <Button type="submit" className="w-full h-10" disabled={loading}>
          {loading ? <Loader2 className="animate-spin" /> : <>Entrar al Command Center <ArrowRight /></>}
        </Button>
      </form>
      <div className="mt-8 space-y-4">
        <p className="text-center text-xs text-muted-foreground">¿Necesitas acceso? 
          <span className="text-foreground">Contacta a tu administrador.</span>
        </p>
        <p className="text-center text-xs text-muted-foreground">
          ¿Recibiste una invitación?{" "}
          <Link href="/accept-invite" className="text-foreground font-medium hover:underline transition-colors">
            Acepta tu invitación
          </Link>
        </p>
      </div>
      </div>
    </section>
  </main>
  );
}
