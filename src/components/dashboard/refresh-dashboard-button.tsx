"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RefreshDashboardButton() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 500);
  }

  return (
    <Button variant="outline" className="w-full sm:w-fit" onClick={refresh} disabled={refreshing} aria-busy={refreshing}>
      <RefreshCw className={refreshing ? "animate-spin motion-reduce:animate-none" : ""} />
      {refreshing ? "Actualizando..." : "Actualizar"}
    </Button>
  );
}
