"use client";

import Link from "next/link";
import { useDashboardPreRegistrationAlerts } from "@/contexts/DashboardPreRegistrationAlertsContext";

const KIND_ICONS = {
  RESTAURANT: "🍽️",
  SHOP: "🏪",
  COURIER: "🛵",
} as const;

export function PreRegistrationAlertToasts() {
  const { toasts, dismissToast } = useDashboardPreRegistrationAlerts();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[min(100vw-2rem,22rem)]"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="rounded-xl border border-dobby-200 bg-white shadow-lg p-4 flex gap-3"
          role="alert"
        >
          <div className="w-10 h-10 rounded-full bg-dobby-100 text-dobby-700 flex items-center justify-center shrink-0 text-lg">
            {KIND_ICONS[toast.kind]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">
              {toast.kind === "COURIER" ? "Nuevo repartidor" : "Nuevo pre-registro"}
            </p>
            <p className="text-sm text-gray-600 mt-0.5 leading-snug">{toast.message}</p>
            <div className="mt-2 flex items-center gap-3">
              <Link
                href="/dashboard/notificaciones"
                className="text-sm font-medium text-dobby-600 hover:text-dobby-800"
                onClick={() => dismissToast(toast.id)}
              >
                Ver notificaciones
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
