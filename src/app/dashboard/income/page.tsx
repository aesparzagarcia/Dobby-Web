"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authHeaders, apiPath, uploadsUrl } from "@/lib/api";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartGranularity = "day" | "week" | "month";

type IncomeShop = {
  shopId: string;
  shopName: string;
  logoUrl: string | null;
  productsRevenue: number;
  deliveryRevenue: number;
  revenue: number;
  orderCount: number;
  percentOfTotal: number;
};

type IncomeOrder = {
  id: string;
  createdAt: string;
  shopName: string;
  customerName: string;
  total: number;
  status: string;
};

type IncomeData = {
  period: { from: string; to: string };
  summary: {
    totalRevenue: number;
    grossTotal: number;
    completedOrders: number;
    averageTicket: number;
    platformCommissions: number;
    trends: {
      totalRevenuePct: number | null;
      completedOrdersPct: number | null;
      averageTicketPct: number | null;
      platformCommissionsPct: number | null;
    };
  };
  breakdown: {
    ordersSubtotal: number;
    discountsApplied: number;
    platformCommissions: number;
    deliveryFees: number;
    tipsForCouriers: number;
    netIncome: number;
    commissionRatePercent: number;
  };
  byDay: Record<string, number>;
  byWeek: Record<string, number>;
  byMonth: Record<string, number>;
  byShop: IncomeShop[];
  recentOrders: IncomeOrder[];
};

const STATUS_LABELS: Record<string, string> = {
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  ON_DELIVERY: "En camino",
};

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

function formatMoney(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatRangeLabel(from: string, to: string) {
  const f = new Date(`${from}T12:00:00`);
  const t = new Date(`${to}T12:00:00`);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  return `${f.toLocaleDateString("es-MX", opts)} – ${t.toLocaleDateString("es-MX", opts)}`;
}

function formatChartDay(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function formatChartTooltipDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatOrderDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        up ? "text-emerald-600" : "text-red-600"
      }`}
    >
      <span aria-hidden>{up ? "↑" : "↓"}</span>
      {Math.abs(pct)}% vs período anterior
    </span>
  );
}

function IconDownload({ className }: { className?: string }) {
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

function IconFilter({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
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

function IconInfo({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  trend,
  icon,
  iconBg,
}: {
  label: string;
  value: string;
  trend: number | null;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{value}</p>
        <div className="mt-2">
          <TrendBadge pct={trend} />
        </div>
      </div>
      <div
        className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}
      >
        {icon}
      </div>
    </div>
  );
}

export default function IncomePage() {
  const initialRange = defaultDateRange();
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [compareWith, setCompareWith] = useState("previous_period");
  const [chartGranularity, setChartGranularity] = useState<ChartGranularity>("day");
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<IncomeData | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(apiPath(`/api/analytics/income?from=${from}&to=${to}`), { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => {
        if (json?.summary && json?.breakdown) setData(json as IncomeData);
        else setData(null);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const source =
      chartGranularity === "week"
        ? data.byWeek
        : chartGranularity === "month"
          ? data.byMonth
          : data.byDay;
    return Object.entries(source)
      .map(([key, value]) => ({ key, value, label: formatChartDay(key) }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [data, chartGranularity]);

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["Período", `${data.period.from} – ${data.period.to}`],
      ["Ingreso neto", data.summary.totalRevenue],
      ["Pedidos completados", data.summary.completedOrders],
      ["Ticket promedio", data.summary.averageTicket],
      ["Comisiones", data.summary.platformCommissions],
      [],
      ["Fecha", "Ingreso"],
      ...chartData.map((r) => [r.key, r.value]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ingresos-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const s = data?.summary;
  const b = data?.breakdown;

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ingresos</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Resumen de ingresos y comisiones generadas en el período seleccionado.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={exportCsv}
            disabled={!data}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dobby-200 text-dobby-700 text-sm font-medium bg-white hover:bg-dobby-50 disabled:opacity-50"
          >
            <IconDownload className="w-4 h-4" />
            Exportar
          </button>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-dobby-600 text-white text-sm font-medium hover:bg-dobby-700"
          >
            <IconFilter className="w-4 h-4" />
            Filtros
          </button>
        </div>
      </div>

      <div
        className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6 ${
          showFilters ? "" : "md:grid-cols-2 xl:grid-cols-4"
        }`}
      >
        <div className="md:col-span-2 xl:col-span-2 flex flex-col sm:flex-row gap-3">
          <label className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
            <span className="text-xs font-medium text-gray-500 block mb-1">Rango de fechas</span>
            <div className="flex items-center gap-2">
              <IconCalendar className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-800 truncate">
                {formatRangeLabel(from, to)}
              </span>
            </div>
            <div className="flex gap-2 mt-2">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5"
              />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5"
              />
            </div>
          </label>
          <label className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
            <span className="text-xs font-medium text-gray-500 block mb-1">Comparar con</span>
            <select
              value={compareWith}
              onChange={(e) => setCompareWith(e.target.value)}
              className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-2 py-2 bg-white"
            >
              <option value="previous_period">Período anterior</option>
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500 py-12 text-center">Cargando ingresos…</div>
      ) : !data || !s || !b ? (
        <div className="text-gray-500 py-12 text-center">No hay datos para este período.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label="Ingreso total"
              value={formatMoney(s.totalRevenue)}
              trend={s.trends.totalRevenuePct}
              iconBg="bg-dobby-100 text-dobby-600"
              icon={
                <span className="text-lg font-bold" aria-hidden>
                  $
                </span>
              }
            />
            <KpiCard
              label="Pedidos completados"
              value={String(s.completedOrders)}
              trend={s.trends.completedOrdersPct}
              iconBg="bg-emerald-100 text-emerald-600"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              }
            />
            <KpiCard
              label="Ticket promedio"
              value={formatMoney(s.averageTicket)}
              trend={s.trends.averageTicketPct}
              iconBg="bg-orange-100 text-orange-600"
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              }
            />
            <KpiCard
              label="Comisiones cobradas"
              value={formatMoney(s.platformCommissions)}
              trend={s.trends.platformCommissionsPct}
              iconBg="bg-sky-100 text-sky-600"
              icon={
                <span className="text-sm font-bold" aria-hidden>
                  %
                </span>
              }
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-base font-semibold text-gray-900">Ingresos por día</h2>
              <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
                {(
                  [
                    ["day", "Día"],
                    ["week", "Semana"],
                    ["month", "Mes"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setChartGranularity(key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      chartGranularity === key
                        ? "bg-dobby-600 text-white shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {chartData.length === 0 ? (
              <p className="text-sm text-gray-500 py-16 text-center">Sin datos en el gráfico.</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f5" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#6b7280" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(124, 58, 237, 0.08)" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const row = payload[0].payload as { key: string; value: number };
                        return (
                          <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
                            <p className="text-gray-500">{formatChartTooltipDate(row.key)}</p>
                            <p className="font-semibold text-dobby-700">
                              Ingreso: {formatMoney(row.value)}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="value" fill="#7c3aed" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-1">Ingresos por tienda</h2>
              <p className="text-xs text-gray-500 mb-4">
                Productos vendidos y envíos generados por cada tienda en el período.
              </p>
              {data.byShop.length === 0 ? (
                <p className="text-sm text-gray-500">No hay pedidos entregados en este período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                        <th className="pb-3 font-medium">Tienda</th>
                        <th className="pb-3 font-medium text-right">Productos</th>
                        <th className="pb-3 font-medium text-right">Envíos</th>
                        <th className="pb-3 font-medium text-right">Pedidos</th>
                        <th className="pb-3 font-medium text-right w-36">% productos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.byShop.slice(0, 6).map((shop) => (
                        <tr key={shop.shopId}>
                          <td className="py-3 pr-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {shop.logoUrl ? (
                                <img
                                  src={uploadsUrl(shop.logoUrl)}
                                  alt=""
                                  className="w-8 h-8 rounded-full object-cover bg-gray-100"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-dobby-100 text-dobby-700 flex items-center justify-center text-xs font-bold shrink-0">
                                  {shop.shopName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className="font-medium text-gray-900 truncate">
                                {shop.shopName}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 text-right font-medium tabular-nums text-gray-900">
                            {formatMoney(shop.productsRevenue ?? shop.revenue)}
                          </td>
                          <td className="py-3 text-right font-medium tabular-nums text-sky-700">
                            {formatMoney(shop.deliveryRevenue ?? 0)}
                          </td>
                          <td className="py-3 text-right text-gray-600 tabular-nums">
                            {shop.orderCount}
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-dobby-500 rounded-full"
                                  style={{ width: `${Math.min(100, shop.percentOfTotal)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600 w-10 tabular-nums">
                                {shop.percentOfTotal}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-100 text-xs font-semibold text-gray-700">
                        <td className="pt-3">Total (mostradas)</td>
                        <td className="pt-3 text-right tabular-nums">
                          {formatMoney(
                            data.byShop
                              .slice(0, 6)
                              .reduce((s, shop) => s + (shop.productsRevenue ?? shop.revenue), 0)
                          )}
                        </td>
                        <td className="pt-3 text-right tabular-nums text-sky-700">
                          {formatMoney(
                            data.byShop.slice(0, 6).reduce((s, shop) => s + (shop.deliveryRevenue ?? 0), 0)
                          )}
                        </td>
                        <td className="pt-3 text-right tabular-nums">
                          {data.byShop.slice(0, 6).reduce((s, shop) => s + shop.orderCount, 0)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              <Link
                href="/dashboard/shops"
                className="inline-flex items-center gap-1 text-sm font-medium text-dobby-600 hover:text-dobby-800 mt-4"
              >
                Ver todas las tiendas
                <span aria-hidden>›</span>
              </Link>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Desglose de ingresos</h2>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-gray-600">
                    Subtotal de pedidos
                    <IconInfo className="w-3.5 h-3.5 text-gray-400" />
                  </span>
                  <span className="font-medium tabular-nums">{formatMoney(b.ordersSubtotal)}</span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-gray-600">
                    Descuentos aplicados
                    <IconInfo className="w-3.5 h-3.5 text-gray-400" />
                  </span>
                  <span className="font-medium text-red-600 tabular-nums">
                    {b.discountsApplied > 0 ? "−" : ""}
                    {formatMoney(b.discountsApplied)}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-gray-600">
                    Comisiones de plataforma ({b.commissionRatePercent}%)
                    <IconInfo className="w-3.5 h-3.5 text-gray-400" />
                  </span>
                  <span className="font-medium text-red-600 tabular-nums">
                    −{formatMoney(b.platformCommissions)}
                  </span>
                </li>
                {b.deliveryFees > 0 ? (
                  <li className="flex items-center justify-between gap-2">
                    <span className="text-gray-600">Tarifas de envío (pedidos)</span>
                    <span className="font-medium text-emerald-600 tabular-nums">
                      {formatMoney(b.deliveryFees)}
                    </span>
                  </li>
                ) : null}
              </ul>
              <div className="mt-5 rounded-xl bg-dobby-50 border border-dobby-100 px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-dobby-900">Ingreso total</span>
                <span className="text-lg font-bold text-dobby-700 tabular-nums">
                  {formatMoney(b.netIncome)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-base font-semibold text-gray-900">Pedidos recientes</h2>
              <Link
                href="/dashboard/pedidos"
                className="text-sm font-medium text-dobby-600 hover:text-dobby-800"
              >
                Ver todos los pedidos →
              </Link>
            </div>
            {data.recentOrders.length === 0 ? (
              <p className="text-sm text-gray-500">No hay pedidos entregados recientes.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-100">
                      <th className="pb-3 font-medium">Fecha</th>
                      <th className="pb-3 font-medium">Tienda / Restaurante</th>
                      <th className="pb-3 font-medium">Cliente</th>
                      <th className="pb-3 font-medium text-right">Total</th>
                      <th className="pb-3 font-medium text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.recentOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50/80">
                        <td className="py-3 text-gray-600 whitespace-nowrap">
                          {formatOrderDate(order.createdAt)}
                        </td>
                        <td className="py-3 font-medium text-gray-900">{order.shopName}</td>
                        <td className="py-3 text-gray-700">{order.customerName}</td>
                        <td className="py-3 text-right font-medium tabular-nums">
                          {formatMoney(order.total)}
                        </td>
                        <td className="py-3 text-right">
                          <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80">
                            {STATUS_LABELS[order.status] ?? order.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
