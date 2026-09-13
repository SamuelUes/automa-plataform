"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Command,
  Loader2,
  Mail,
} from "lucide-react";

export default function AcceptInvitePage() {
  const router = useRouter();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void (async () => {
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();
      if (user?.email) {
        setSessionEmail(user.email);
        setEmail(user.email);
      }
      setCheckingSession(false);
    })();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    if (sessionEmail) {
      // Mode A: user has a session from the email link — set password client-side.
      const { error: updateError } = await createClient().auth.updateUser({ password });
      setLoading(false);

      if (updateError) {
        setError("No pudimos guardar la contraseña. Inténtalo nuevamente.");
        return;
      }

      setDone(true);
      window.setTimeout(() => router.push("/dashboard"), 1600);
      return;
    }

    // Mode B: no session — set password via the accept-invite edge function.
    const { error: invokeError } = await createClient().functions.invoke("accept-invite", {
      body: { email, password },
    });

    setLoading(false);

    if (invokeError) {
      let message = "No se pudo completar el registro.";
      try {
        const body = await (invokeError as any).context?.json();
        if (body?.error) message = body.error;
      } catch {}
      setError(message);
      return;
    }

    setDone(true);
    window.setTimeout(() => router.push("/login"), 2000);
  }

  if (checkingSession) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mb-12"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a iniciar sesión
        </Link>

        <div className="flex items-center gap-3 mb-10">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Command className="h-5 w-5" />
          </div>
          <span className="font-semibold tracking-tight">
            Prologistica <span className="text-muted-foreground">AI</span>
          </span>
        </div>

        {done ? (
          <div className="space-y-4">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <h1 className="text-3xl font-semibold tracking-tight">
              {sessionEmail ? "Cuenta lista" : "Contraseña creada"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {sessionEmail
                ? "Tu contraseña se guardó correctamente. Te estamos llevando al Command Center."
                : "Ya puedes iniciar sesión con tu correo y la contraseña que acabas de crear."}
            </p>
          </div>
        ) : (
          <>
            <p className="font-mono text-[11px] uppercase tracking-[.18em] text-muted-foreground mb-3">
              Accept invitation
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Acepta tu invitación</h1>
            <p className="text-sm text-muted-foreground mt-2 mb-8">
              {sessionEmail
                ? "Crea una contraseña para activar tu cuenta y acceder al Command Center."
                : "Ingresa el correo al que fuiste invitado y crea tu contraseña."}
            </p>

            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="tu@empresa.com"
                    className="pl-9"
                    disabled={!!sessionEmail}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Nueva contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmation">Confirmar contraseña</Label>
                <Input
                  id="confirmation"
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  aria-invalid={confirmation.length > 0 && password !== confirmation}
                />
                {confirmation.length > 0 && password !== confirmation && (
                  <p className="text-xs text-destructive">Las contraseñas no coinciden.</p>
                )}
                {confirmation.length > 0 && password === confirmation && (
                  <p className="text-xs text-success">Las contraseñas coinciden.</p>
                )}
              </div>

              {error && (
                <div
                  role="alert"
                  className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-10"
                disabled={loading || (!!confirmation && password !== confirmation)}
              >
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    Activar cuenta
                    <ArrowRight />
                  </>
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
