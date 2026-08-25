"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check, FileCheck2, Mail, TriangleAlert, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeTable } from "@/lib/supabase/realtime";
import type { Notification } from "@/types/notifications";
import { Button } from "@/components/ui/button";

function notificationIcon(type: Notification["notification_type"]) {
  if (type === "approval_required") return FileCheck2;
  if (type === "workflow_failed" || type === "urgent_case" || type === "system_error") return TriangleAlert;
  if (type === "delegation_received") return Users;
  return Mail;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const load = useCallback(async () => {
    const { data } = await createClient().functions.invoke("notifications", {
      body: {},
    });

    if (data?.data) {
      setNotifications(data.data as Notification[]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshOnChange = useCallback(() => {
    void load();
  }, [load]);

  useRealtimeTable("notifications", refreshOnChange);

  const unreadCount = notifications.filter((item) => !item.read_at).length;

  async function markRead(notification: Notification) {
    if (notification.read_at) return;

    await createClient().functions.invoke("notifications", {
      body: {
        operation: "mark_read",
        id: notification.id,
      },
    });

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id
          ? { ...item, read_at: new Date().toISOString() }
          : item
      )
    );
  }

  async function markAllRead() {
    await createClient().functions.invoke("notifications", {
      body: { operation: "mark_all_read" },
    });

    setNotifications((current) =>
      current.map((item) => ({
        ...item,
        read_at: item.read_at || new Date().toISOString(),
      }))
    );
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Notificaciones${unreadCount ? `, ${unreadCount} sin leer` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="relative"
      >
        <Bell />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 min-w-1.5 h-1.5 rounded-full bg-destructive" />
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(360px,calc(100vw-2rem))] rounded-xl border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Notificaciones</p>
              <p className="text-[11px] text-muted-foreground">{unreadCount} sin leer</p>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button onClick={() => void markAllRead()} className="text-[11px] text-muted-foreground hover:text-foreground">
                  Marcar todas
                </button>
              )}
              <button aria-label="Cerrar notificaciones" onClick={() => setOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-90 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                No tienes notificaciones nuevas.
              </div>
            ) : (
              notifications.map((notification) => {
                const Icon = notificationIcon(notification.notification_type);
                return (
                  <button
                    key={notification.id}
                    onClick={() => void markRead(notification)}
                    className={`w-full flex gap-3 px-4 py-3 text-left border-b last:border-0 hover:bg-muted/40 ${!notification.read_at ? "bg-muted/25" : ""}`}
                  >
                    <span className="h-7 w-7 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium">{notification.title}</span>
                      <span className="block text-[11px] text-muted-foreground mt-1 line-clamp-2">{notification.body}</span>
                    </span>
                    {!notification.read_at && <span className="h-1.5 w-1.5 rounded-full bg-info mt-1.5 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t px-4 py-3">
            <Link href="/activity" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <Check className="h-3.5 w-3.5" />
              Ver actividad completa
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
