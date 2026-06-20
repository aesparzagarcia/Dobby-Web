"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { apiPath, authHeaders } from "@/lib/api";

type PendingPreRegistration = {
  id: string;
  name: string;
  kind: "RESTAURANT" | "SHOP" | "COURIER";
  status: string;
  readAt: string | null;
  vehicleType?: string | null;
};

type ToastAlert = {
  id: string;
  message: string;
  preRegistrationId: string;
  kind: PendingPreRegistration["kind"];
};

type DashboardPreRegistrationAlertsContextValue = {
  badgeCount: number;
  toasts: ToastAlert[];
  dismissToast: (id: string) => void;
  acknowledgePending: () => void;
  refreshNow: () => void;
};

const DashboardPreRegistrationAlertsContext =
  createContext<DashboardPreRegistrationAlertsContextValue | null>(null);

const POLL_MS = 12_000;
const TOAST_TTL_MS = 8_000;

export const ADMIN_PRE_REGISTRATIONS_CHANGED_EVENT =
  "dobby-admin-pre-registrations-changed";

const KIND_LABELS: Record<PendingPreRegistration["kind"], string> = {
  RESTAURANT: "restaurante",
  SHOP: "tienda",
  COURIER: "repartidor",
};

function formatToastMessage(row: PendingPreRegistration): string {
  const kind = KIND_LABELS[row.kind] ?? "aliado";
  if (row.kind === "COURIER" && row.vehicleType?.trim()) {
    return `Nuevo pre-registro de ${kind}: ${row.name} · ${row.vehicleType.trim()}`;
  }
  return `Nuevo pre-registro de ${kind}: ${row.name}`;
}

function isPendingUnread(row: PendingPreRegistration) {
  return row.status === "PENDING" && row.readAt == null;
}

export function DashboardPreRegistrationAlertsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [badgeCount, setBadgeCount] = useState(0);
  const [toasts, setToasts] = useState<ToastAlert[]>([]);
  const knownPendingIdsRef = useRef<Set<string> | null>(null);
  const acknowledgedIdsRef = useRef<Set<string>>(new Set());
  const pollingRef = useRef(false);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const acknowledgePending = useCallback(() => {
    const known = knownPendingIdsRef.current;
    if (known) {
      acknowledgedIdsRef.current = new Set(known);
    }
    setBadgeCount(0);
  }, []);

  const pushToast = useCallback((row: PendingPreRegistration) => {
    const message = formatToastMessage(row);
    const toastId = `${row.id}-${Date.now()}`;
    setToasts((prev) => [
      ...prev.slice(-4),
      { id: toastId, message, preRegistrationId: row.id, kind: row.kind },
    ]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, TOAST_TTL_MS);

    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification("Nuevo pre-registro en Dobby", {
          body: message,
          tag: `pre-reg-${row.id}`,
        });
      } catch {
        /* ignore */
      }
    }
  }, []);

  const poll = useCallback(async () => {
    if (pollingRef.current) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    pollingRef.current = true;
    try {
      const res = await fetch(apiPath("/api/admin/notifications?unreadOnly=true"), {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = (await res.json()) as PendingPreRegistration[];
      const pending = (Array.isArray(data) ? data : []).filter(isPendingUnread);
      const currentIds = new Set(pending.map((row) => row.id));

      if (knownPendingIdsRef.current === null) {
        knownPendingIdsRef.current = currentIds;
        const isOnNotificaciones = pathname?.startsWith("/dashboard/notificaciones") ?? false;
        if (isOnNotificaciones) {
          acknowledgedIdsRef.current = new Set(currentIds);
          setBadgeCount(0);
        } else {
          setBadgeCount(pending.length);
        }
        return;
      }

      const isOnNotificaciones = pathname?.startsWith("/dashboard/notificaciones") ?? false;
      let hasNew = false;
      for (const row of pending) {
        if (!knownPendingIdsRef.current.has(row.id)) {
          hasNew = true;
          pushToast(row);
        }
      }
      if (hasNew && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(ADMIN_PRE_REGISTRATIONS_CHANGED_EVENT));
      }

      knownPendingIdsRef.current = currentIds;

      if (isOnNotificaciones) {
        acknowledgedIdsRef.current = new Set(currentIds);
        setBadgeCount(0);
      } else {
        const unacked = pending.filter((row) => !acknowledgedIdsRef.current.has(row.id)).length;
        setBadgeCount(unacked);
      }
    } catch {
      /* ignore network errors between polls */
    } finally {
      pollingRef.current = false;
    }
  }, [pathname, pushToast]);

  const refreshNow = useCallback(() => {
    void poll();
  }, [poll]);

  useEffect(() => {
    void poll();
    const interval = setInterval(() => void poll(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  useEffect(() => {
    if (pathname?.startsWith("/dashboard/notificaciones")) {
      acknowledgePending();
    }
  }, [pathname, acknowledgePending]);

  return (
    <DashboardPreRegistrationAlertsContext.Provider
      value={{
        badgeCount,
        toasts,
        dismissToast,
        acknowledgePending,
        refreshNow,
      }}
    >
      {children}
    </DashboardPreRegistrationAlertsContext.Provider>
  );
}

export function useDashboardPreRegistrationAlerts(): DashboardPreRegistrationAlertsContextValue {
  const ctx = useContext(DashboardPreRegistrationAlertsContext);
  if (!ctx) {
    throw new Error(
      "useDashboardPreRegistrationAlerts must be used within DashboardPreRegistrationAlertsProvider",
    );
  }
  return ctx;
}
