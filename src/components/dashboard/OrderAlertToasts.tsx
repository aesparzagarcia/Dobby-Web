"use client";

import Link from "next/link";
import { useDashboardOrderAlerts } from "@/contexts/DashboardOrderAlertsContext";

export function OrderAlertToasts() {
  const { toasts, dismissToast } = useDashboardOrderAlerts();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[min(100vw-2rem,22rem)]"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="rounded-xl border border-violet-200 bg-white shadow-lg p-4 flex gap-3"
          role="alert"
        >
          <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 text-lg">
            🛒
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Nuevo pedido</p>
            <p className="text-sm text-gray-600 mt-0.5 leading-snug">{toast.message}</p>
            <div className="mt-2 flex items-center gap-3">
              <Link
                href="/dashboard/pedidos"
                className="text-sm font-medium text-violet-600 hover:text-violet-800"
                onClick={() => dismissToast(toast.id)}
              >
                Ver pedidos
              </Link>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
