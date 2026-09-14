"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/logo";
import { ArrowLeft, ArrowRight, CheckCircle2, Command, Loader2, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error: resetError } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);

    if (resetError) {
      setError("No pudimos enviar el enlace. Revisa el correo e inténtalo nuevamente.");
      return;
    }

    setSent(true);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/login" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mb-12">
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a iniciar sesión
        </Link>

        <div className="flex items-center gap-3 mb-10">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Logo className="h-5 w-5" />
          </div>
          <span className="font-semibold tracking-tight">Prologistica <span className="text-muted-foreground">AI</span></span>
        </div>

        {sent ? (
          <div className="space-y-5">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <h1 className="text-3xl font-semibold tracking-tight">Revisa tu correo</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Enviamos un enlace para restablecer tu contraseña a <span className="text-foreground font-medium">{email}</span>.
            </p>
            <Link href="/login" className="inline-flex items-center gap-2 text-sm font-medium hover:underline">
              Volver al login
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <>
            <p className="font-mono text-[11px] uppercase tracking-[.18em] text-muted-foreground mb-3">Account recovery</p>
            <h1 className="text-3xl font-semibold tracking-tight">Restablece tu contraseña</h1>
            <p className="text-sm text-muted-foreground mt-2 mb-8">Te enviaremos un enlace seguro para recuperar el acceso.</p>

            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu@empresa.com" className="pl-9" required />
                </div>
              </div>

              {error && <p role="alert" className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                Enviar enlace
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
