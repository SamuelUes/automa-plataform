"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export function useRealtimeTable(table: string, onChange: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void) {
  useEffect(() => {
    const channel = createClient().channel(`realtime-${table}-${crypto.randomUUID()}`).on("postgres_changes", { event: "*", schema: "public", table }, onChange).subscribe();
    return () => { void createClient().removeChannel(channel); };
  }, [table, onChange]);
}
