"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authHeaders, apiPath } from "@/lib/api";
import { ADMIN_ORDERS_CHANGED_EVENT } from "@/contexts/DashboardOrderAlertsContext";

const OrderTrackingMap = dynamic(
  () => import("@/components/OrderTrackingMap").then((m) => m.OrderTrackingMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[320px] bg-gray-100 animate-pulse rounded-lg border border-gray-200" />
    ),
  }
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
  PENDING: "bg-amber-50 text-amber-800 ring-amber-200/80",
  CONFIRMED: "bg-sky-50 text-sky-800 ring-sky-200/80",
  PREPARING: "bg-orange-50 text-orange-800 ring-orange-200/80",
  READY_FOR_PICKUP: "bg-teal-50 text-teal-800 ring-teal-200/80",
  ASSIGNED: "bg-dobby-50 text-dobby-800 ring-dobby-200/80",
  ON_DELIVERY: "bg-indigo-50 text-indigo-800 ring-indigo-200/80",
  DELIVERED: "bg-emerald-50 text-emerald-800 ring-emerald-200/80",
  CANCELLED: "bg-gray-100 text-gray-600 ring-gray-200/80",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

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

type ShopOption = { id: string; name: string };

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

const TRACKING_POLL_MS = 5000;

function canOpenTrackingModal(status: string) {
  return status === "ASSIGNED" || status === "ON_DELIVERY";
}

function formatDate(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString("es-MX", {
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

function customerName(customer: Order["customer"] | AdminOrderTracking["customer"]) {
  if (!customer) return "—";
  const name = [customer.name, customer.lastName].filter(Boolean).join(" ").trim();
  return name || customer.email || "—";
}

function productsSummary(items: OrderItem[]) {
  if (items.length === 0) return "—";
  const text = items.map((i) => `${i.productName ?? "Producto"} x${i.quantity}`).join(", ");
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
}

function toDateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { from: toDateInputValue(start), to: toDateInputValue(end) };
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function IconBuilding({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  );
}

function IconExport({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function IconChevron({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function IconDots({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 8a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
    </svg>
  );
}

export default function PedidosPage() {
  const initialRange = defaultDateRange();
  const [orders, setOrders] = useState<Order[]>([]);
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [shopFilter, setShopFilter] = useState("");
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [tracking, setTracking] = useState<AdminOrderTracking | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
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

  useEffect(() => {
    fetch(apiPath("/api/shops"), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setShops(list.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
      })
      .catch(() => setShops([]));
  }, []);

  useEffect(() => {
    const onOrdersChanged = () => load();
    window.addEventListener(ADMIN_ORDERS_CHANGED_EVENT, onOrdersChanged);
    return () => window.removeEventListener(ADMIN_ORDERS_CHANGED_EVENT, onOrdersChanged);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, shopFilter, dateFrom, dateTo, statusFilter]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    return orders.filter((order) => {
      if (shopFilter && order.shopId !== shopFilter) return false;
      const created = new Date(order.createdAt).getTime();
      if (fromMs != null && created < fromMs) return false;
      if (toMs != null && created > toMs) return false;
      if (!q) return true;

      const haystack = [
        order.id,
        order.shop?.name,
        order.deliveryAddress,
        order.customer?.email,
        order.customer?.name,
        order.customer?.lastName,
        order.deliveryMan?.name,
        order.deliveryMan?.user?.email,
        ...order.items.map((i) => i.productName),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [orders, searchQuery, shopFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = filteredOrders.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, filteredOrders.length);
  const paginatedOrders = filteredOrders.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const fetchTracking = useCallback(async (orderId: string) => {
    const r = await fetch(apiPath(`/api/admin/orders/${orderId}/tracking`), {
      headers: authHeaders(),
    });
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
        if (!cancelled) setTrackingError(e instanceof Error ? e.message : "Error");
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

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [openMenuId]);

  function exportCsv() {
    const headers = [
      "Fecha",
      "Estado",
      "Total",
      "Tienda",
      "Repartidor",
      "Cliente",
      "Email",
      "Dirección",
      "Productos",
    ];
    const rows = filteredOrders.map((o) => [
      formatDate(o.createdAt),
      STATUS_LABELS[o.status] ?? o.status,
      o.total.toFixed(2),
      o.shop?.name ?? "",
      o.deliveryMan?.name ?? "",
      customerName(o.customer),
      o.customer?.email ?? "",
      o.deliveryAddress ?? "",
      o.items.map((i) => `${i.productName ?? "Producto"} x${i.quantity}`).join("; "),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatSeen(iso: string | null) {
    if (!iso) return "—";
    return formatDate(iso);
  }

  const driverPos =
    tracking?.deliveryMan?.lastLat != null &&
    tracking?.deliveryMan?.lastLng != null &&
    Number.isFinite(tracking.deliveryMan.lastLat) &&
    Number.isFinite(tracking.deliveryMan.lastLng)
      ? { lat: tracking.deliveryMan.lastLat, lng: tracking.deliveryMan.lastLng }
      : null;

  const shopPos =
    tracking?.shop?.lat != null &&
    tracking.shop.lng != null &&
    Number.isFinite(tracking.shop.lat) &&
    Number.isFinite(tracking.shop.lng)
      ? {
          lat: tracking.shop.lat,
          lng: tracking.shop.lng,
          name: tracking.shop.name,
        }
      : null;

  const customerPos =
    tracking?.delivery?.lat != null &&
    tracking.delivery.lng != null &&
    Number.isFinite(tracking.delivery.lat) &&
    Number.isFinite(tracking.delivery.lng)
      ? {
          lat: tracking.delivery.lat,
          lng: tracking.delivery.lng,
          address: tracking.delivery.address ?? undefined,
        }
      : null;

  const mapFitBoundsKey = tracking
    ? `${tracking.id}|${shopPos?.lat ?? ""}|${shopPos?.lng ?? ""}|${customerPos?.lat ?? ""}|${customerPos?.lng ?? ""}|${driverPos ? 1 : 0}`
    : "";

  const showPickupAddressNote =
    tracking?.shop?.address?.trim() &&
    (tracking.shop.lat == null || tracking.shop.lng == null);

  const showDeliveryAddressNote =
    tracking?.delivery.address?.trim() &&
    (tracking.delivery.lat == null || tracking.delivery.lng == null);

  const showDriverLocationNote =
    tracking?.deliveryMan != null && driverPos == null;

  const trackingOnMap =
    tracking?.status === "ASSIGNED" || tracking?.status === "ON_DELIVERY";

  const dateRangeLabel =
    dateFrom && dateTo
      ? `${new Date(`${dateFrom}T12:00:00`).toLocaleDateString("es-MX", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })} – ${new Date(`${dateTo}T12:00:00`).toLocaleDateString("es-MX", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}`
      : "Rango de fechas";

  return (
    <div className="p-6 lg:p-8 max-w-[1600px]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-[1.65rem] font-bold text-gray-900 tracking-tight">
            Pedidos
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Consulta y gestiona todos los pedidos de la plataforma.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <span className="whitespace-nowrap">Estado:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-dobby-500/30 focus:border-dobby-400 min-w-[9rem]"
            >
              <option value="">Todos</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={exportCsv}
            disabled={filteredOrders.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-dobby-600 hover:bg-dobby-700 disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-semibold px-4 py-2 shadow-sm transition-colors"
          >
            <IconExport className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
        <div className="flex flex-col xl:flex-row gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <IconSearch className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar pedido, cliente o restaurante…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50/80 pl-10 pr-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-dobby-500/25 focus:border-dobby-400 focus:bg-white"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-sm text-gray-700 min-w-[200px]">
              <IconCalendar className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent border-0 p-0 text-sm focus:outline-none w-[7.5rem]"
                aria-label="Desde"
              />
              <span className="text-gray-300">–</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent border-0 p-0 text-sm focus:outline-none w-[7.5rem]"
                aria-label="Hasta"
              />
            </div>
            <div className="relative min-w-[200px]">
              <IconBuilding className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={shopFilter}
                onChange={(e) => setShopFilter(e.target.value)}
                className="w-full appearance-none rounded-lg border border-gray-200 bg-gray-50/80 pl-10 pr-8 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-dobby-500/25 focus:border-dobby-400 focus:bg-white"
              >
                <option value="">Todos los restaurantes</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <IconChevron className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
            </div>
            <button
              type="button"
              onClick={() => setShowMoreFilters((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              Más filtros
              <IconChevron
                className={`w-4 h-4 text-gray-400 transition-transform ${showMoreFilters ? "rotate-90" : ""}`}
              />
            </button>
          </div>
        </div>
        {showMoreFilters ? (
          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter("")}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
                statusFilter === ""
                  ? "bg-dobby-600 text-white ring-dobby-600"
                  : "bg-white text-gray-600 ring-gray-200 hover:bg-gray-50"
              }`}
            >
              Todos los estados
            </button>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${
                  statusFilter === value
                    ? "bg-dobby-600 text-white ring-dobby-600"
                    : `${STATUS_COLORS[value] ?? "bg-gray-100 text-gray-700 ring-gray-200"} hover:opacity-90`
                }`}
              >
                {label}
              </button>
            ))}
            <span className="w-full text-xs text-gray-400 mt-1">{dateRangeLabel}</span>
          </div>
        ) : null}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-500">Cargando pedidos…</div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-500">No hay pedidos con estos filtros.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/90">
                  {[
                    "Fecha",
                    "Estado",
                    "Total",
                    "Tienda / Restaurante",
                    "Repartidor",
                    "Cliente",
                    "Dirección",
                    "Productos",
                    "",
                  ].map((h) => (
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
                {paginatedOrders.map((order) => {
                  const trackable = canOpenTrackingModal(order.status);
                  const dmStatus = order.deliveryMan?.status?.toUpperCase() ?? "";
                  return (
                    <tr key={order.id} className="hover:bg-dobby-50/30 transition-colors">
                      <td className="px-4 py-3.5 text-sm text-gray-700 whitespace-nowrap">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        {trackable ? (
                          <button
                            type="button"
                            onClick={() => setTrackingOrderId(order.id)}
                            title="Ver mapa: repartidor, restaurante y cliente"
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset cursor-pointer transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-dobby-500/50 ${
                              STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700 ring-gray-200"
                            }`}
                          >
                            {STATUS_LABELS[order.status] ?? order.status}
                          </button>
                        ) : (
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                              STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-700 ring-gray-200"
                            }`}
                          >
                            {STATUS_LABELS[order.status] ?? order.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-gray-900 whitespace-nowrap">
                        {formatMoney(order.total)}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-800 max-w-[160px]">
                        {order.shop?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-800 max-w-[180px]">
                        {order.deliveryMan ? (
                          <>
                            {order.deliveryMan.name || order.deliveryMan.user?.email || "—"}
                            {dmStatus ? (
                              <span
                                className={`text-xs ml-1 ${
                                  dmStatus === "ONLINE" || dmStatus === "ON_DELIVERY"
                                    ? "text-emerald-600 font-medium"
                                    : "text-gray-400"
                                }`}
                              >
                                ({order.deliveryMan.status})
                              </span>
                            ) : null}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-sm max-w-[200px]">
                        <span className="font-medium text-gray-900 block">
                          {customerName(order.customer)}
                        </span>
                        {order.customer?.email ? (
                          <span className="text-xs text-gray-500 block truncate">
                            {order.customer.email}
                          </span>
                        ) : null}
                      </td>
                      <td
                        className="px-4 py-3.5 text-sm text-gray-600 max-w-[200px] line-clamp-2"
                        title={order.deliveryAddress ?? ""}
                      >
                        {order.deliveryAddress ?? "—"}
                      </td>
                      <td
                        className="px-4 py-3.5 text-sm text-gray-600 max-w-[220px]"
                        title={order.items
                          .map((i) => `${i.productName ?? "Producto"} x${i.quantity}`)
                          .join(", ")}
                      >
                        {productsSummary(order.items)}
                      </td>
                      <td className="px-4 py-3.5 text-right relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId((id) => (id === order.id ? null : order.id));
                          }}
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                          aria-label="Acciones"
                        >
                          <IconDots className="w-5 h-5" />
                        </button>
                        {openMenuId === order.id ? (
                          <div
                            className="absolute right-4 top-full z-20 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg text-left"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {trackable ? (
                              <button
                                type="button"
                                className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setTrackingOrderId(order.id);
                                }}
                              >
                                Ver mapa en vivo
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                              onClick={() => {
                                void navigator.clipboard?.writeText(order.id);
                                setOpenMenuId(null);
                              }}
                            >
                              Copiar ID
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && filteredOrders.length > 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50/50">
            <p className="text-sm text-gray-600">
              Mostrando {pageStart} a {pageEnd} de {filteredOrders.length} pedidos
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-dobby-500/25"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n} por página
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                  aria-label="Página anterior"
                >
                  <IconChevron className="w-4 h-4 rotate-180" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum = i + 1;
                  if (totalPages > 5) {
                    if (safePage <= 3) pageNum = i + 1;
                    else if (safePage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = safePage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setPage(pageNum)}
                      className={`min-w-[2.25rem] h-9 rounded-lg text-sm font-medium ${
                        safePage === pageNum
                          ? "bg-dobby-600 text-white"
                          : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                  aria-label="Página siguiente"
                >
                  <IconChevron className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Tracking modal — unchanged logic */}
      {trackingOrderId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tracking-modal-title"
          onClick={() => setTrackingOrderId(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100 bg-white">
              <h2 id="tracking-modal-title" className="text-lg font-semibold text-gray-900">
                Seguimiento en vivo
              </h2>
              <button
                type="button"
                onClick={() => setTrackingOrderId(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cerrar
              </button>
            </div>
            <div className="p-5 space-y-4">
              {trackingLoading && !tracking ? (
                <p className="text-sm text-gray-500">Cargando mapa…</p>
              ) : null}
              {trackingError ? <p className="text-sm text-red-600">{trackingError}</p> : null}
              {tracking && trackingOnMap ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-gray-500">Estado:</span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        STATUS_COLORS[tracking.status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {STATUS_LABELS[tracking.status] ?? tracking.status}
                    </span>
                  </div>
                  {showPickupAddressNote ? (
                    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      Restaurante sin pin en el mapa: <strong>{tracking.shop?.address}</strong>
                    </p>
                  ) : null}
                  {showDeliveryAddressNote ? (
                    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      Cliente sin pin en el mapa: <strong>{tracking.delivery.address}</strong>
                    </p>
                  ) : null}
                  {showDriverLocationNote ? (
                    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      El repartidor aún no ha enviado ubicación desde DobbyGo.
                    </p>
                  ) : null}
                  <OrderTrackingMap
                    driver={driverPos}
                    shop={shopPos}
                    customer={customerPos}
                    fitBoundsKey={mapFitBoundsKey}
                  />
                  <div className="grid sm:grid-cols-3 gap-4 pt-2">
                    <div className="rounded-lg border border-gray-200 p-4">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Restaurante</h3>
                      <p className="text-sm font-medium">{tracking.shop?.name ?? "—"}</p>
                      {tracking.shop?.address ? (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-3">{tracking.shop.address}</p>
                      ) : null}
                    </div>
                    <div className="rounded-lg border border-gray-200 p-4">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Cliente</h3>
                      <p className="text-sm font-medium">{customerName(tracking.customer)}</p>
                      {tracking.delivery.address ? (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{tracking.delivery.address}</p>
                      ) : null}
                    </div>
                    <div className="rounded-lg border border-gray-200 p-4">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Repartidor</h3>
                      {tracking.deliveryMan ? (
                        <>
                          <p className="text-sm font-medium">{tracking.deliveryMan.name}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            Estado: {tracking.deliveryMan.status}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            Última ubicación: {formatSeen(tracking.deliveryMan.lastSeenAt)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500">Sin repartidor</p>
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
      ) : null}
    </div>
  );
}
