"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { authHeaders, apiPath } from "@/lib/api";

const OrderTrackingMap = dynamic(
  () => import("@/components/OrderTrackingMap").then((m) => m.OrderTrackingMap),
  { ssr: false, loading: () => <div className="h-[320px] bg-gray-100 animate-pulse rounded-lg border border-gray-200" /> }
);

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
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-sky-100 text-sky-800",
  PREPARING: "bg-orange-100 text-orange-800",
  READY_FOR_PICKUP: "bg-teal-100 text-teal-800",
  ASSIGNED: "bg-blue-100 text-blue-800",
  ON_DELIVERY: "bg-indigo-100 text-indigo-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

type OrderItem = {
  id: string;
  productId: string;
  productName: string | null;
  quantity: number;
  price: number;
};

type Order = {
  id: string;
  status: string;
  total: number;
  deliveryAddress: string | null;
  createdAt: string;
  shopId: string | null;
  shop: { id: string; name: string } | null;
  deliveryManId: string | null;
  deliveryMan: {
    id: string;
    name: string;
    status: string;
    user: { email: string } | null;
  } | null;
  items: OrderItem[];
  customer: { id: string; email: string; name: string | null; lastName: string | null } | null;
};

type AdminOrderTracking = {
  id: string;
  status: string;
  customer: { id: string; email: string; name: string | null; lastName: string | null } | null;
  delivery: { address: string | null; lat: number | null; lng: number | null };
  shop: { id: string; name: string; address: string; lat: number | null; lng: number | null } | null;
  deliveryMan: {
    id: string;
    name: string;
    status: string;
    celphone: string | null;
    lastLat: number | null;
    lastLng: number | null;
    lastSeenAt: string | null;
    user: { email: string } | null;
  } | null;
};

const TRACKING_POLL_MS = 12000;

function canOpenTrackingModal(status: string) {
  return status === "ASSIGNED" || status === "ON_DELIVERY";
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [tracking, setTracking] = useState<AdminOrderTracking | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  const load = useCallback(() => {
    const q = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
    fetch(apiPath(`/api/admin/orders${q}`), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const fetchTracking = useCallback(async (orderId: string) => {
    const r = await fetch(apiPath(`/api/admin/orders/${orderId}/tracking`), { headers: authHeaders() });
    const data = await r.json().catch(() => null);
    if (!r.ok) {
      throw new Error(typeof data?.error === "string" ? data.error : "No se pudo cargar el seguimiento");
    }
    return data as AdminOrderTracking;
  }, []);

  useEffect(() => {
    if (!trackingOrderId) {
      setTracking(null);
      setTrackingError(null);
      setTrackingLoading(false);
      return;
    }

    let cancelled = false;
    setTracking(null);
    setTrackingError(null);
    setTrackingLoading(true);

    fetchTracking(trackingOrderId)
      .then((data) => {
        if (!cancelled) setTracking(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setTrackingError(e instanceof Error ? e.message : "Error");
        }
      })
      .finally(() => {
        if (!cancelled) setTrackingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [trackingOrderId, fetchTracking]);

  useEffect(() => {
    if (!trackingOrderId) return;
    const id = trackingOrderId;
    const interval = setInterval(() => {
      fetchTracking(id)
        .then((data) => setTracking(data))
        .catch(() => {});
    }, TRACKING_POLL_MS);
    return () => clearInterval(interval);
  }, [trackingOrderId, fetchTracking]);

  useEffect(() => {
    if (!trackingOrderId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setTrackingOrderId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trackingOrderId]);

  function formatDate(s: string) {
    const d = new Date(s);
    return d.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function customerLabel(customer: Order["customer"] | AdminOrderTracking["customer"]) {
    if (!customer) return "—";
    const name = [customer.name, customer.lastName].filter(Boolean).join(" ").trim();
    return name || customer.email || "—";
  }

  function formatSeen(iso: string | null) {
    if (!iso) return "—";
    return formatDate(iso);
  }

  function closeTrackingModal() {
    setTrackingOrderId(null);
  }

  const mapMode =
    tracking?.status === "ASSIGNED" || tracking?.status === "ON_DELIVERY"
      ? tracking.status
      : "ON_DELIVERY";

  const driverPos =
    tracking?.deliveryMan?.lastLat != null &&
    tracking?.deliveryMan?.lastLng != null &&
    Number.isFinite(tracking.deliveryMan.lastLat) &&
    Number.isFinite(tracking.deliveryMan.lastLng)
      ? { lat: tracking.deliveryMan.lastLat, lng: tracking.deliveryMan.lastLng }
      : null;

  const destAssigned =
    tracking?.shop?.lat != null &&
    tracking.shop.lng != null &&
    Number.isFinite(tracking.shop.lat) &&
    Number.isFinite(tracking.shop.lng)
      ? { lat: tracking.shop.lat, lng: tracking.shop.lng }
      : null;

  const destInProgress =
    tracking?.delivery?.lat != null &&
    tracking.delivery.lng != null &&
    Number.isFinite(tracking.delivery.lat) &&
    Number.isFinite(tracking.delivery.lng)
      ? { lat: tracking.delivery.lat, lng: tracking.delivery.lng }
      : null;

  const destination =
    mapMode === "ASSIGNED" ? destAssigned : destInProgress;

  const destinationLabel =
    mapMode === "ASSIGNED"
      ? tracking?.shop
        ? `Recogida: ${tracking.shop.name}`
        : "Recogida"
      : "Entrega";

  /** Refit map only when order, destination, or driver presence changes — not on every poll of driver GPS. */
  const mapFitBoundsKey = tracking
    ? `${tracking.id}|${tracking.status}|${destination?.lat ?? ""}|${destination?.lng ?? ""}|${driverPos ? 1 : 0}`
    : "";

  const showPickupAddressNote =
    mapMode === "ASSIGNED" &&
    tracking?.shop &&
    (tracking.shop.lat == null || tracking.shop.lng == null);

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-semibold">Pedidos</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Estado:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando…</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {orders.length === 0 ? (
            <p className="text-gray-500 text-sm p-6">No hay pedidos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Estado</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Total</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Tienda / Restaurante</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Repartidor</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Cliente</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Dirección</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Productos</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const trackable = canOpenTrackingModal(order.status);
                    return (
                      <tr
                        key={order.id}
                        className={`border-b border-gray-100 ${trackable ? "cursor-pointer hover:bg-sky-50/80" : "hover:bg-gray-50/50"}`}
                        onClick={() => {
                          if (trackable) setTrackingOrderId(order.id);
                        }}
                        title={trackable ? "Clic para ver mapa de seguimiento" : undefined}
                      >
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {formatDate(order.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {STATUS_LABELS[order.status] ?? order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          ${order.total.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {order.shop?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {order.deliveryMan ? (
                            <span title={order.deliveryMan.user?.email ?? ""}>
                              {order.deliveryMan.name || order.deliveryMan.user?.email || order.deliveryMan.id}
                              <span className="text-gray-400 text-xs ml-1">
                                ({order.deliveryMan.status})
                              </span>
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {customerLabel(order.customer)}
                          {order.customer?.email && order.customer?.name && (
                            <span className="block text-xs text-gray-500">{order.customer.email}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-[180px] truncate" title={order.deliveryAddress ?? ""}>
                          {order.deliveryAddress ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {order.items.length === 0
                            ? "—"
                            : order.items.map((i) => `${i.productName ?? "Producto"} x${i.quantity}`).join(", ")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {trackingOrderId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tracking-modal-title"
          onClick={closeTrackingModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100 bg-white">
              <h2 id="tracking-modal-title" className="text-lg font-semibold text-gray-900">
                Seguimiento del pedido
              </h2>
              <button
                type="button"
                onClick={closeTrackingModal}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cerrar
              </button>
            </div>

            <div className="p-5 space-y-4">
              {trackingLoading && !tracking ? (
                <p className="text-sm text-gray-500">Cargando mapa…</p>
              ) : null}
              {trackingError ? (
                <p className="text-sm text-red-600">{trackingError}</p>
              ) : null}

              {tracking && (tracking.status === "ASSIGNED" || tracking.status === "ON_DELIVERY") ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-gray-500">Estado:</span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[tracking.status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {STATUS_LABELS[tracking.status] ?? tracking.status}
                    </span>
                    {!trackingLoading ? (
                      <span className="text-xs text-gray-400 ml-auto">Actualización automática cada ~12 s</span>
                    ) : null}
                  </div>

                  {showPickupAddressNote ? (
                    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      Dirección de recogida (sin pin en mapa):{" "}
                      <strong>{tracking.shop?.address ?? "—"}</strong>
                    </p>
                  ) : null}

                  <OrderTrackingMap
                    mode={mapMode}
                    driver={driverPos}
                    destination={destination}
                    destinationLabel={destinationLabel}
                    fitBoundsKey={mapFitBoundsKey}
                  />

                  <div className="legend flex flex-wrap gap-4 text-xs text-gray-600">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-full bg-blue-600 border border-white shadow" />
                      Repartidor
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-full bg-green-600 border border-white shadow" />
                      {mapMode === "ASSIGNED" ? "Recogida" : "Entrega"}
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 pt-2">
                    <div className="rounded-lg border border-gray-200 p-4">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cliente (envío)</h3>
                      <p className="text-sm font-medium text-gray-900">{customerLabel(tracking.customer)}</p>
                      {tracking.customer?.email ? (
                        <p className="text-sm text-gray-600 mt-1">{tracking.customer.email}</p>
                      ) : null}
                      <p className="text-sm text-gray-600 mt-2">
                        <span className="text-gray-500">Dirección de entrega:</span>{" "}
                        {tracking.delivery.address?.trim() ? tracking.delivery.address : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-4">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Repartidor</h3>
                      {tracking.deliveryMan ? (
                        <>
                          <p className="text-sm font-medium text-gray-900">
                            {tracking.deliveryMan.name?.trim()
                              ? tracking.deliveryMan.name
                              : tracking.deliveryMan.user?.email ?? tracking.deliveryMan.id}
                          </p>
                          {tracking.deliveryMan.user?.email && tracking.deliveryMan.name?.trim() ? (
                            <p className="text-sm text-gray-600 mt-1">{tracking.deliveryMan.user.email}</p>
                          ) : null}
                          <p className="text-sm text-gray-600 mt-2">
                            Tel: {tracking.deliveryMan.celphone?.trim() ? tracking.deliveryMan.celphone : "—"}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            Estado repartidor: <span className="font-medium">{tracking.deliveryMan.status}</span>
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            Última ubicación reportada: {formatSeen(tracking.deliveryMan.lastSeenAt)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">Sin repartidor asignado</p>
                      )}
                    </div>
                  </div>
                </>
              ) : tracking && !trackingLoading ? (
                <p className="text-sm text-gray-500">Este pedido no está en seguimiento en mapa.</p>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
