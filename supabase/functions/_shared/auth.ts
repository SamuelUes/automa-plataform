declare const Deno: { env: { get(name: string): string | undefined } };

// @ts-expect-error Deno resolves URL imports at Edge Function runtime.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function getAuthedClient(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data: { user }, error } = await client.auth.getUser();
    if (user) return { client, user };
    const status = error && "status" in error ? Number(error.status) : 0;
    const retryable = status === 500 || status === 502 || status === 503 || status === 504
      || error?.name === "AuthRetryableFetchError";
    if (!retryable || attempt === 1) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("AUTH_SERVICE_UNAVAILABLE");
}
