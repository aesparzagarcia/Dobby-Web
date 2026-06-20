"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiPath, authHeaders } from "@/lib/api";
import {
  ADMIN_PRE_REGISTRATIONS_CHANGED_EVENT,
  useDashboardPreRegistrationAlerts,
} from "@/contexts/DashboardPreRegistrationAlertsContext";

const POLL_MS = 12_000;

type NotificationRow = {
  id: string;
  kind: "RESTAURANT" | "SHOP" | "COURIER";
  shopType: "RESTAURANT" | "SHOP" | "SERVICE_PROVIDER" | null;
  name: string;
  address: string | null;
  phone: string | null;
  openingHour: string | null;
  closingHour: string | null;
  email: string;
  vehicleType: string | null;
  status: "PENDING" | "REVIEWED" | "DISMISSED" | "ACCEPTED";
  readAt: string | null;
  createdShopId: string | null;
  createdDeliveryManId: string | null;
  createdAt: string;
  isUnread: boolean;
};

const KIND_LABELS: Record<NotificationRow["kind"], string> = {
  RESTAURANT: "Pre-registro restaurante",
  SHOP: "Pre-registro comercio",
  COURIER: "Pre-registro repartidor",
};

const SHOP_TYPE_LABELS: Record<string, string> = {
  RESTAURANT: "Restaurante",
  SHOP: "Tienda",
  SERVICE_PROVIDER: "Proveedor de servicios",
};

const STATUS_LABELS: Record<NotificationRow["status"], string> = {
  PENDING: "Pendiente",
  REVIEWED: "Revisado",
  DISMISSED: "Descartado",
  ACCEPTED: "Aceptado",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function isShopPreRegistration(item: NotificationRow) {
  return item.kind === "RESTAURANT" || item.kind === "SHOP";
}

export default function NotificacionesPage() {
  const { refreshNow } = useDashboardPreRegistrationAlerts();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const q = filter === "unread" ? "?unreadOnly=true" : "";
      const res = await fetch(apiPath(`/api/admin/notifications${q}`), {
        headers: authHeaders(),
      });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      void load({ silent: true });
    }, POLL_MS);

    const onChanged = () => {
      void load({ silent: true });
    };
    window.addEventListener(ADMIN_PRE_REGISTRATIONS_CHANGED_EVENT, onChanged);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void load({ silent: true });
        refreshNow();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener(ADMIN_PRE_REGISTRATIONS_CHANGED_EVENT, onChanged);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load, refreshNow]);

  async function markRead(id: string) {
    setBusyId(id);
    setActionError(null);
    try {
      await fetch(apiPath(`/api/admin/notifications/${id}/read`), {
        method: "PATCH",
        headers: authHeaders(),
      });
      await load();
      refreshNow();
    } finally {
      setBusyId(null);
    }
  }

  async function setStatus(id: string, status: NotificationRow["status"]) {
    setBusyId(id);
    setActionError(null);
    try {
      const res = await fetch(apiPath(`/api/admin/notifications/${id}/status`), {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(typeof data.error === "string" ? data.error : "No se pudo actualizar.");
        return;
      }
      await load();
      refreshNow();
    } finally {
      setBusyId(null);
    }
  }

  async function acceptPreRegistration(id: string) {
    setBusyId(id);
    setActionError(null);
    try {
      const res = await fetch(apiPath(`/api/admin/notifications/${id}/accept`), {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(typeof data.error === "string" ? data.error : "No se pudo aceptar.");
        return;
      }
      await load();
      refreshNow();
    } finally {
      setBusyId(null);
    }
  }

  async function acceptCourierPreRegistration(id: string) {
    setBusyId(id);
    setActionError(null);
    try {
      const res = await fetch(apiPath(`/api/admin/notifications/${id}/accept-courier`), {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(typeof data.error === "string" ? data.error : "No se pudo crear el repartidor.");
        return;
      }
      await load();
      refreshNow();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
          <p className="mt-1 text-sm text-gray-500">
            Pre-registros de aliados y repartidores desde la web pública.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              filter === "all"
                ? "bg-dobby-600 text-white"
                : "bg-white border border-gray-200 text-gray-600"
            }`}
          >
            Todas
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              filter === "unread"
                ? "bg-dobby-600 text-white"
                : "bg-white border border-gray-200 text-gray-600"
            }`}
          >
            Sin leer
          </button>
        </div>
      </div>

      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Cargando…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
          No hay notificaciones{filter === "unread" ? " sin leer" : ""}.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const open = expandedId === item.id;
            return (
              <li
                key={item.id}
                className={`rounded-xl border bg-white overflow-hidden ${
                  item.isUnread ? "border-dobby-300 ring-1 ring-dobby-100" : "border-gray-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setExpandedId(open ? null : item.id);
                    setActionError(null);
                    if (item.isUnread) void markRead(item.id);
                  }}
                  className="flex w-full items-start gap-3 p-4 text-left hover:bg-gray-50"
                >
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                      item.isUnread ? "bg-dobby-500" : "bg-gray-300"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900">{item.name}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        {KIND_LABELS[item.kind]}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          item.status === "PENDING"
                            ? "bg-amber-50 text-amber-700"
                            : item.status === "REVIEWED"
                              ? "bg-blue-50 text-blue-700"
                              : item.status === "ACCEPTED"
                                ? "bg-green-50 text-green-700"
                                : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {STATUS_LABELS[item.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{formatDate(item.createdAt)}</p>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-2 text-sm">
                    <dl className="grid gap-2 sm:grid-cols-2">
                      <Detail label="Correo" value={item.email} />
                      <Detail label="Teléfono" value={item.phone ?? "—"} />
                      {item.shopType && (
                        <Detail
                          label="Tipo de negocio"
                          value={SHOP_TYPE_LABELS[item.shopType] ?? item.shopType}
                        />
                      )}
                      {item.address && <Detail label="Dirección" value={item.address} />}
                      {(item.openingHour || item.closingHour) && (
                        <Detail
                          label="Horario"
                          value={[item.openingHour, item.closingHour]
                            .filter(Boolean)
                            .join(" – ")}
                        />
                      )}
                      {item.vehicleType && (
                        <Detail label="Vehículo" value={item.vehicleType} />
                      )}
                    </dl>

                    {item.status === "ACCEPTED" && item.createdShopId && (
                      <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
                        Tienda creada correctamente.{" "}
                        <Link
                          href="/dashboard/shops"
                          className="font-medium underline hover:text-green-900"
                        >
                          Ver en Tiendas
                        </Link>
                      </p>
                    )}

                    {item.status === "ACCEPTED" && item.createdDeliveryManId && (
                      <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
                        Repartidor creado correctamente.{" "}
                        <Link
                          href="/dashboard/repartidores"
                          className="font-medium underline hover:text-green-900"
                        >
                          Ver en Repartidores
                        </Link>
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {item.status === "PENDING" && (
                        <>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => setStatus(item.id, "REVIEWED")}
                            className="rounded-lg bg-dobby-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-dobby-700 disabled:opacity-50"
                          >
                            Marcar revisado
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => setStatus(item.id, "DISMISSED")}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Descartar
                          </button>
                        </>
                      )}

                      {item.status === "REVIEWED" && isShopPreRegistration(item) && (
                        <>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => acceptPreRegistration(item.id)}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            Aceptar
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => setStatus(item.id, "DISMISSED")}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Descartar
                          </button>
                        </>
                      )}

                      {item.status === "REVIEWED" && item.kind === "COURIER" && (
                        <>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => acceptCourierPreRegistration(item.id)}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            Crear repartidor
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => setStatus(item.id, "DISMISSED")}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Descartar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-gray-800">{value}</dd>
    </div>
  );
}
