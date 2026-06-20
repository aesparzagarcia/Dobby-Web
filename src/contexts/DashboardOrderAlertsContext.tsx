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

export type PendingOrderAlert = {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  shopName: string | null;
  customerName: string | null;
};

type ToastAlert = {
  id: string;
  message: string;
  orderId: string;
};

type DashboardOrderAlertsContextValue = {
  badgeCount: number;
  toasts: ToastAlert[];
  dismissToast: (id: string) => void;
  acknowledgePendingOrders: () => void;
  refreshNow: () => void;
};

const DashboardOrderAlertsContext = createContext<DashboardOrderAlertsContextValue | null>(
  null
);

const POLL_MS = 12_000;
const TOAST_TTL_MS = 8_000;

export const ADMIN_ORDERS_CHANGED_EVENT = "dobby-admin-orders-changed";

function formatOrderSuffix(orderId: string): string {
  const compact = orderId.replace(/-/g, "").toUpperCase();
  return compact.slice(-4) || orderId.slice(0, 4);
}

function formatMoney(total: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(total);
}

export function DashboardOrderAlertsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [badgeCount, setBadgeCount] = useState(0);
  const [toasts, setToasts] = useState<ToastAlert[]>([]);
  const knownPendingIdsRef = useRef<Set<string> | null>(null);
  const acknowledgedIdsRef = useRef<Set<string>>(new Set());
  const pollingRef = useRef(false);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const acknowledgePendingOrders = useCallback(() => {
    const known = knownPendingIdsRef.current;
    if (known) {
      acknowledgedIdsRef.current = new Set(known);
    }
    setBadgeCount(0);
  }, []);

  const pushToast = useCallback((order: PendingOrderAlert) => {
    const suffix = formatOrderSuffix(order.id);
    const shop = order.shopName?.trim() || "Tienda";
    const customer = order.customerName?.trim();
    const message = customer
      ? `Nuevo pedido #${suffix} · ${shop} · ${customer} · ${formatMoney(order.total)}`
      : `Nuevo pedido #${suffix} · ${shop} · ${formatMoney(order.total)}`;
    const toastId = `${order.id}-${Date.now()}`;
    setToasts((prev) => [...prev.slice(-4), { id: toastId, message, orderId: order.id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, TOAST_TTL_MS);

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("Nuevo pedido en Dobbi", {
          body: message,
          tag: `order-${order.id}`,
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
      const res = await fetch(apiPath("/api/admin/orders/notifications/summary"), {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        pending?: PendingOrderAlert[];
        pendingCount?: number;
      };
      const pending = Array.isArray(data.pending) ? data.pending : [];
      const currentIds = new Set(pending.map((o) => o.id));

      if (knownPendingIdsRef.current === null) {
        knownPendingIdsRef.current = currentIds;
        return;
      }

      const isOnPedidos = pathname?.startsWith("/dashboard/pedidos") ?? false;
      let hasNew = false;
      for (const order of pending) {
        if (!knownPendingIdsRef.current.has(order.id)) {
          hasNew = true;
          pushToast(order);
        }
      }
      if (hasNew && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(ADMIN_ORDERS_CHANGED_EVENT));
      }

      knownPendingIdsRef.current = currentIds;

      if (isOnPedidos) {
        acknowledgedIdsRef.current = new Set(currentIds);
        setBadgeCount(0);
      } else {
        const unacked = pending.filter((o) => !acknowledgedIdsRef.current.has(o.id)).length;
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
    if (typeof window === "undefined") return;
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

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
    if (pathname?.startsWith("/dashboard/pedidos")) {
      acknowledgePendingOrders();
    }
  }, [pathname, acknowledgePendingOrders]);

  return (
    <DashboardOrderAlertsContext.Provider
      value={{
        badgeCount,
        toasts,
        dismissToast,
        acknowledgePendingOrders,
        refreshNow,
      }}
    >
      {children}
    </DashboardOrderAlertsContext.Provider>
  );
}

export function useDashboardOrderAlerts(): DashboardOrderAlertsContextValue {
  const ctx = useContext(DashboardOrderAlertsContext);
  if (!ctx) {
    throw new Error("useDashboardOrderAlerts must be used within DashboardOrderAlertsProvider");
  }
  return ctx;
}
