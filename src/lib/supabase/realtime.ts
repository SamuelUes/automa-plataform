"use client";

import { useEffect, useId } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type RealtimeFilter = {
  column: string;
  value: string;
};

export function useRealtimeTable(table: string, onChange: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void, filter?: RealtimeFilter) {
  const instanceId = useId().replaceAll(":", "");

  useEffect(() => {
    const client = createClient();
    const channel = client
      .channel(`realtime-${table}-${instanceId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table,
        ...(filter ? { filter: `${filter.column}=eq.${filter.value}` } : {}),
      }, onChange)
      .subscribe();

    return () => { void client.removeChannel(channel); };
  }, [filter, instanceId, onChange, table]);
}
