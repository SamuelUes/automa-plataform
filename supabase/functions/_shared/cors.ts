declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
};

const allowedOrigins = [
  "http://localhost:3000",
  ...(Deno.env.get("FRONTEND_ORIGIN") || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

export function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0] || "http://localhost:3000";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Vary": "Origin",
  };
}
