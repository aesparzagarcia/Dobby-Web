"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, authHeaders } from "@/lib/api";

type AddressRow = {
  id: string;
  label: string;
  description: string | null;
  address: string;
  lat: number;
  lng: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
};

type OrderItemRow = {
  id: string;
  quantity: number;
  price: number;
  productId: string;
  productName: string;
};

type ServiceRequestRow = {
  id: string;
  serviceNumber: string;
  amount: number;
  serviceId: string;
  serviceName: string;
};

type OrderRow = {
  id: string;
  status: string;
  orderType: string;
  total: number;
  serviceFee: number;
  deliveryFee: number;
  deliveryAddress: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  shopId: string | null;
  shopName: string | null;
  deliveryManId: string | null;
  deliveryManName: string | null;
  items: OrderItemRow[];
  serviceRequests: ServiceRequestRow[];
};

type ClientDetail = {
  id: string;
  email: string;
  phone: string | null;
  name: string | null;
  lastName: string | null;
  createdAt: string;
  updatedAt: string;
  dobbyXp: number;
  orderStreakDays: number;
  lastOrderStreakDate: string | null;
  levelKey: string;
  levelName: string;
  addressCount: number;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  addresses: AddressRow[];
  orders: OrderRow[];
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  PREPARING: "En preparación",
  READY_FOR_PICKUP: "Listo para recoger",
  ASSIGNED: "Asignado",
  ON_DELIVERY: "En camino",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 ring-amber-200/80",
  CONFIRMED: "bg-sky-50 text-sky-800 ring-sky-200/80",
  PREPARING: "bg-orange-50 text-orange-800 ring-orange-200/80",
  READY_FOR_PICKUP: "bg-teal-50 text-teal-800 ring-teal-200/80",
  ASSIGNED: "bg-dobby-50 text-dobby-800 ring-dobby-200/80",
  ON_DELIVERY: "bg-indigo-50 text-indigo-800 ring-indigo-200/80",
  DELIVERED: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
  CANCELLED: "bg-gray-100 text-gray-600 ring-gray-200/80",
};

function displayName(client: Pick<ClientDetail, "name" | "lastName" | "email">) {
  const name = [client.name, client.lastName].filter(Boolean).join(" ").trim();
  return name || client.email || "Sin nombre";
}

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

export default function ClienteDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [data, setData] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    apiFetch(`/api/clients/${encodeURIComponent(id)}`, { headers: authHeaders() })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(body.error || "No se pudo cargar el cliente");
        }
        return body as ClientDetail;
      })
      .then(setData)
      .catch((e: Error) => {
        setData(null);
        setError(e.message || "Error al cargar");
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="mb-6">
        <Link
          href="/dashboard/clientes"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-dobby-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver a clientes
        </Link>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <p className="text-gray-500">Cargando cliente…</p>
      ) : data ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 truncate">{displayName(data)}</h1>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-dobby-50 text-dobby-700 text-xs font-medium">
                  {data.levelName}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1 font-mono break-all">{data.id}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">Pedidos</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.orderCount}</p>
              <p className="text-xs text-gray-500 mt-1">Último: {formatDate(data.lastOrderAt)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">Gasto total</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatMoney(data.totalSpent)}</p>
              <p className="text-xs text-gray-500 mt-1">Solo pedidos entregados</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">XP / Racha</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.dobbyXp}</p>
              <p className="text-xs text-gray-500 mt-1">
                {data.orderStreakDays > 0
                  ? `${data.orderStreakDays} día${data.orderStreakDays !== 1 ? "s" : ""} de racha`
                  : "Sin racha activa"}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">Direcciones</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.addressCount}</p>
              <p className="text-xs text-gray-500 mt-1">Registrado {formatDate(data.createdAt)}</p>
            </div>
          </div>

          <section className="bg-white rounded-xl border border-gray-200 shadow-sm mb-8 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Información del cliente</h2>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 p-5 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400 font-medium">Nombre</dt>
                <dd className="mt-1 text-gray-900">{displayName(data)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400 font-medium">Correo</dt>
                <dd className="mt-1 text-gray-900 break-all">{data.email}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400 font-medium">Teléfono</dt>
                <dd className="mt-1 text-gray-900">{data.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400 font-medium">Nivel</dt>
                <dd className="mt-1 text-gray-900">
                  {data.levelName} ({data.dobbyXp} XP)
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400 font-medium">Registro</dt>
                <dd className="mt-1 text-gray-900">{formatDateTime(data.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-400 font-medium">Última actualización</dt>
                <dd className="mt-1 text-gray-900">{formatDateTime(data.updatedAt)}</dd>
              </div>
            </dl>
          </section>

          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Direcciones</h2>
              <span className="text-sm text-gray-500">{data.addresses.length}</span>
            </div>
            {data.addresses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
                Este cliente aún no tiene direcciones guardadas.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
                <table className="w-full min-w-[700px] text-left">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/90">
                      {["Etiqueta", "Dirección", "Estado", "Creada"].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.addresses.map((addr) => (
                      <tr key={addr.id} className="align-top">
                        <td className="px-4 py-3.5 text-sm whitespace-nowrap">
                          <p className="font-medium text-gray-900">{addr.label || "Sin etiqueta"}</p>
                          {addr.isDefault ? (
                            <span className="mt-1 inline-flex text-[11px] font-medium text-dobby-700 bg-dobby-50 px-1.5 py-0.5 rounded">
                              Predeterminada
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-gray-700 max-w-md">
                          <p>{addr.address}</p>
                          {addr.description ? (
                            <p className="text-xs text-gray-500 mt-1">{addr.description}</p>
                          ) : null}
                          <p className="text-[11px] text-gray-400 mt-1 font-mono">
                            {addr.lat.toFixed(5)}, {addr.lng.toFixed(5)}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-sm whitespace-nowrap">
                          {addr.isActive ? (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md text-xs font-medium">
                              Activa
                            </span>
                          ) : (
                            <span className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md text-xs font-medium">
                              Inactiva
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-gray-700 whitespace-nowrap">
                          {formatDate(addr.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Pedidos</h2>
              <span className="text-sm text-gray-500">
                {data.orders.length}
                {data.orderCount > data.orders.length ? ` de ${data.orderCount}` : ""}
              </span>
            </div>
            {data.orders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
                Este cliente aún no tiene pedidos.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/90">
                      {["Pedido", "Tienda / Servicio", "Estado", "Total", "Fecha", ""].map((h) => (
                        <th
                          key={h || "actions"}
                          className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.orders.map((order) => {
                      const expanded = expandedOrderId === order.id;
                      const statusColor = STATUS_COLORS[order.status] ?? STATUS_COLORS.CANCELLED;
                      const title =
                        order.shopName ||
                        order.serviceRequests[0]?.serviceName ||
                        (order.orderType === "SERVICE_PAYMENT" ? "Pago de servicio" : "Sin tienda");
                      return (
                        <Fragment key={order.id}>
                          <tr className="hover:bg-gray-50/60">
                            <td className="px-4 py-3.5 text-sm">
                              <p className="font-mono text-xs text-gray-500" title={order.id}>
                                {order.id.slice(0, 10)}…
                              </p>
                              {order.deliveryAddress ? (
                                <p
                                  className="text-xs text-gray-400 mt-1 max-w-[220px] truncate"
                                  title={order.deliveryAddress}
                                >
                                  {order.deliveryAddress}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3.5 text-sm text-gray-900">{title}</td>
                            <td className="px-4 py-3.5 text-sm whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${statusColor}`}
                              >
                                {STATUS_LABELS[order.status] ?? order.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-sm font-medium text-gray-900 whitespace-nowrap">
                              {formatMoney(order.total)}
                            </td>
                            <td className="px-4 py-3.5 text-sm text-gray-700 whitespace-nowrap">
                              {formatDateTime(order.createdAt)}
                            </td>
                            <td className="px-4 py-3.5 text-sm whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setExpandedOrderId(expanded ? null : order.id)}
                                className="text-dobby-600 hover:text-dobby-700 font-medium text-xs"
                              >
                                {expanded ? "Ocultar" : "Detalle"}
                              </button>
                            </td>
                          </tr>
                          {expanded ? (
                            <tr className="bg-gray-50/80">
                              <td colSpan={6} className="px-4 py-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-2">
                                      Resumen
                                    </p>
                                    <ul className="space-y-1 text-gray-700">
                                      <li>Envío: {formatMoney(order.deliveryFee)}</li>
                                      <li>Servicio: {formatMoney(order.serviceFee)}</li>
                                      <li>Repartidor: {order.deliveryManName || "—"}</li>
                                      <li>Entregado: {formatDateTime(order.deliveredAt)}</li>
                                      {order.cancelledAt ? (
                                        <li>Cancelado: {formatDateTime(order.cancelledAt)}</li>
                                      ) : null}
                                    </ul>
                                  </div>
                                  <div>
                                    <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-2">
                                      Artículos
                                    </p>
                                    {order.items.length > 0 ? (
                                      <ul className="space-y-1 text-gray-700">
                                        {order.items.map((it) => (
                                          <li key={it.id}>
                                            {it.quantity}× {it.productName} —{" "}
                                            {formatMoney(it.price * it.quantity)}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : order.serviceRequests.length > 0 ? (
                                      <ul className="space-y-1 text-gray-700">
                                        {order.serviceRequests.map((sr) => (
                                          <li key={sr.id}>
                                            {sr.serviceName} · Ref. {sr.serviceNumber || "—"} —{" "}
                                            {formatMoney(sr.amount)}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-gray-500">Sin artículos</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
