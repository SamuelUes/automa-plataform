"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TABLES = ["cases", "approvals", "actions", "messages", "workflow_executions"];

export function RealtimeBridge() {
  const router = useRouter();
  useEffect(() => {
    const client = createClient();
    const channels = TABLES.map((table) => client.channel(`app-realtime-${table}`).on("postgres_changes", { event: "*", schema: "public", table }, () => router.refresh()).subscribe());
    return () => { channels.forEach((channel) => { void client.removeChannel(channel); }); };
  }, [router]);
  return null;
}
