"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    const client = createClient();
    const { data: listener } = client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setError(null);
      }
    });

    return () => listener.subscription.unsubscribe();
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
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError("No pudimos actualizar la contraseña. Solicita un nuevo enlace.");
      return;
    }

    setUpdated(true);
    window.setTimeout(() => router.push("/dashboard"), 1600);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-10">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Logo className="h-5 w-5" />
          </div>
          <span className="font-semibold tracking-tight">
            Prologistica 
            {/* <span className="text-muted-foreground">AI</span> */}
          </span>
        </div>

        {updated ? (
          <div className="space-y-4">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <h1 className="text-3xl font-semibold tracking-tight">Contraseña actualizada</h1>
            <p className="text-sm text-muted-foreground">Te estamos llevando al Command Center.</p>
          </div>
        ) : (
          <>
            <p className="font-mono text-[11px] uppercase tracking-[.18em] text-muted-foreground mb-3">Account recovery</p>
            <h1 className="text-3xl font-semibold tracking-tight">Crea una nueva contraseña</h1>
            <p className="text-sm text-muted-foreground mt-2 mb-8">Usa una contraseña de al menos 8 caracteres.</p>

            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password">Nueva contraseña</Label>
                <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmation">Confirmar contraseña</Label>
                <Input id="confirmation" type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required />
              </div>
              {error && <p role="alert" className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                Actualizar contraseña
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
