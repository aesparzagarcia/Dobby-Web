"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch, authHeaders, uploadsUrl } from "@/lib/api";

type DeliveryRow = {
  id: string;
  deliveryFee: number;
  total: number;
  serviceFee: number;
  deliveryAddress: string | null;
  deliveredAt: string | null;
  createdAt: string;
  onDeliveryStartedAt: string | null;
  deliveryRating: number | null;
  shopId: string | null;
  shopName: string;
  earned: number;
};

type EarningsResponse = {
  deliveryMan: {
    id: string;
    name: string;
    profilePhotoUrl: string | null;
    status: string;
    totalDeliveries: number;
    email: string;
  };
  date: string;
  summary: {
    deliveryCount: number;
    totalEarned: number;
    totalOrderValue: number;
  };
  deliveries: DeliveryRow[];
};

function toDateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateLabel(isoDate: string) {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DriverEarningsPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [date, setDate] = useState(() => toDateInputValue(new Date()));
  const [data, setData] = useState<EarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (day: string) => {
      if (!id) return;
      setLoading(true);
      setError(null);
      apiFetch(`/api/delivery-men/${id}/earnings?date=${encodeURIComponent(day)}`, {
        headers: authHeaders(),
      })
        .then(async (r) => {
          const body = await r.json().catch(() => ({}));
          if (!r.ok) {
            throw new Error(body.error || "No se pudo cargar el historial");
          }
          return body as EarningsResponse;
        })
        .then(setData)
        .catch((e: Error) => {
          setData(null);
          setError(e.message || "Error al cargar");
        })
        .finally(() => setLoading(false));
    },
    [id]
  );

  useEffect(() => {
    load(date);
  }, [date, load]);

  const today = toDateInputValue(new Date());

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="mb-6">
        <Link
          href="/dashboard/repartidores"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-dobby-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver a repartidores
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-4 min-w-0">
          {data?.deliveryMan.profilePhotoUrl ? (
            <img
              src={uploadsUrl(data.deliveryMan.profilePhotoUrl)}
              alt={data.deliveryMan.name}
              className="w-14 h-14 rounded-full object-cover border border-gray-200 shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-xs shrink-0">
              Sin foto
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 truncate">
              {data?.deliveryMan.name ?? (loading ? "Cargando…" : "Repartidor")}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5 truncate">
              {data?.deliveryMan.email ?? "Entregas y generado del día"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <span className="whitespace-nowrap">Día:</span>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dobby-500/30 focus:border-dobby-400"
            />
          </label>
          {date !== today ? (
            <button
              type="button"
              onClick={() => setDate(today)}
              className="text-sm font-medium text-dobby-600 hover:text-dobby-700 px-3 py-2 rounded-lg hover:bg-dobby-50 transition-colors"
            >
              Ver hoy
            </button>
          ) : null}
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4 capitalize">{formatDateLabel(date)}</p>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <p className="text-gray-500 mt-6">Cargando historial…</p>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">Generado</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatMoney(data.summary.totalEarned)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Suma de tarifas de envío del día</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">Entregas</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{data.summary.deliveryCount}</p>
              <p className="text-xs text-gray-500 mt-1">Pedidos entregados ese día</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">Valor pedidos</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatMoney(data.summary.totalOrderValue)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Total cobrado a clientes</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Registro de entregas</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Dirección, hora y lo generado por cada entrega
              </p>
            </div>

            {data.deliveries.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-gray-500">
                No hay entregas registradas para este día.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100 bg-gray-50/80">
                      <th className="px-5 py-3 font-medium">Hora</th>
                      <th className="px-5 py-3 font-medium">Tienda</th>
                      <th className="px-5 py-3 font-medium">Dirección</th>
                      <th className="px-5 py-3 font-medium text-right">Envío</th>
                      <th className="px-5 py-3 font-medium text-right">Pedido</th>
                      <th className="px-5 py-3 font-medium text-center">Calif.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.deliveries.map((row) => (
                      <tr key={row.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                        <td className="px-5 py-3 text-gray-700 whitespace-nowrap font-medium">
                          {formatTime(row.deliveredAt)}
                        </td>
                        <td className="px-5 py-3 text-gray-900 max-w-[160px] truncate" title={row.shopName}>
                          {row.shopName}
                        </td>
                        <td
                          className="px-5 py-3 text-gray-600 max-w-[280px] truncate"
                          title={row.deliveryAddress ?? undefined}
                        >
                          {row.deliveryAddress || "—"}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                          {formatMoney(row.earned)}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-600 whitespace-nowrap">
                          {formatMoney(row.total)}
                        </td>
                        <td className="px-5 py-3 text-center text-gray-700">
                          {row.deliveryRating != null ? row.deliveryRating : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50/80 border-t border-gray-100">
                      <td colSpan={3} className="px-5 py-3 text-sm font-medium text-gray-700">
                        Total del día ({data.summary.deliveryCount} entrega
                        {data.summary.deliveryCount !== 1 ? "s" : ""})
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-gray-900 whitespace-nowrap">
                        {formatMoney(data.summary.totalEarned)}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-gray-700 whitespace-nowrap">
                        {formatMoney(data.summary.totalOrderValue)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
