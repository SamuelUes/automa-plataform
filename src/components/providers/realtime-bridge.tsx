"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

const QUERY_KEYS: Record<string, string[]> = {
  cases: ["cases", "dashboard", "search"],
  approvals: ["approvals", "dashboard", "notifications"],
  actions: ["actions", "activity", "dashboard"],
  messages: ["messages", "conversations", "emails"],
  workflow_executions: ["workflows", "activity", "dashboard"],
};

export function RealtimeBridge() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const client = createClient();
    const channels = Object.entries(QUERY_KEYS).map(([table, queryKeys]) => client
      .channel(`app-realtime-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        queryKeys.forEach((queryKey) => {
          void queryClient.invalidateQueries({ queryKey: [queryKey] });
        });
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => router.refresh(), 200);
      })
      .subscribe());

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      channels.forEach((channel) => { void client.removeChannel(channel); });
    };
  }, [queryClient, router]);

  return null;
}
