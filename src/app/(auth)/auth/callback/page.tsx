"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const next = params.get("next") || "/dashboard";

    if (!code) {
      router.replace(next);
      return;
    }

    void (async () => {
      const { error: exchangeError } = await createClient().auth.exchangeCodeForSession(code);

      if (exchangeError) {
        setError("El enlace ya no es válido. Solicita uno nuevo.");
        return;
      }

      router.replace(next);
      router.refresh();
    })();
  }, [router]);

  if (error) {
    return <main className="min-h-screen flex items-center justify-center px-6 text-sm text-destructive">{error}</main>;
  }

  return (
    <main className="min-h-screen flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      Validando sesión segura...
    </main>
  );
}
