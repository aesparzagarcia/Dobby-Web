"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, authHeaders } from "@/lib/api";
import { WriteOnly } from "@/components/dashboard/WriteOnly";

type TaxRecentOrder = {
  id: string;
  created_at: string;
  shop_name: string;
  service_fee_net: number;
  service_fee_iva: number;
  service_fee: number;
  iva_rate: number;
  total: number;
};

type TaxData = {
  period: { from: string; to: string };
  iva_rate: number;
  iva_rate_percent: number;
  summary: {
    delivered_orders: number;
    service_fee_net: number;
    service_fee_iva: number;
    service_fee_total: number;
    courier_commission?: number;
    courier_commission_iva?: number;
    iva_to_declare?: number;
  };
  recent_orders: TaxRecentOrder[];
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

function formatOrderDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-400">{hint}</p> : null}
    </div>
  );
}

export default function ImpuestosPage() {
  const defaults = defaultDateRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [data, setData] = useState<TaxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ivaPercentDraft, setIvaPercentDraft] = useState("16");
  const [savingRate, setSavingRate] = useState(false);
  const [rateMessage, setRateMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ from, to });
      const res = await apiFetch(`/api/admin/taxes?${q}`, {
        headers: authHeaders(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo cargar impuestos");
      }
      const json = (await res.json()) as TaxData;
      setData(json);
      setIvaPercentDraft(String(json.iva_rate_percent));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveIvaRate() {
    setSavingRate(true);
    setRateMessage(null);
    try {
      const res = await apiFetch("/api/admin/taxes/iva-rate", {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ iva_rate: Number(ivaPercentDraft) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "No se pudo guardar la tasa");
      }
      setRateMessage(`Tasa actualizada a ${body.iva_rate_percent}%`);
      await load();
    } catch (e) {
      setRateMessage(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingRate(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">
            <Link href="/dashboard" className="hover:text-gray-800">
              Resumen
            </Link>{" "}
            / Impuestos
          </p>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Impuestos (IVA)</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            IVA cobrado solo sobre la tarifa de uso de la app. Los productos y el envío no
            se incluyen en este cálculo.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex-1 text-sm">
            <span className="text-gray-600 font-medium">Desde</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
            />
          </label>
          <label className="flex-1 text-sm">
            <span className="text-gray-600 font-medium">Hasta</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-semibold hover:bg-gray-800"
          >
            Actualizar
          </button>
        </div>
      </div>

      <WriteOnly>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Tasa de IVA (super admin)</h2>
          <p className="text-sm text-gray-500">
            Se aplica a pedidos nuevos. Los pedidos ya creados conservan la tasa con la que
            se cobraron.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <label className="text-sm sm:w-48">
              <span className="text-gray-600 font-medium">IVA (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={ivaPercentDraft}
                onChange={(e) => setIvaPercentDraft(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2"
              />
            </label>
            <button
              type="button"
              disabled={savingRate}
              onClick={() => void saveIvaRate()}
              className="rounded-xl bg-dobby-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-dobby-700 disabled:opacity-60"
            >
              {savingRate ? "Guardando…" : "Guardar tasa"}
            </button>
          </div>
          {rateMessage ? (
            <p className="text-sm text-gray-600">{rateMessage}</p>
          ) : null}
        </div>
      </WriteOnly>

      {loading ? (
        <p className="text-gray-500">Cargando…</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="IVA a declarar"
              value={formatMoney(data.summary.iva_to_declare ?? data.summary.service_fee_iva)}
              hint={`Service fee + comisión del repartidor · tasa ${data.iva_rate_percent}%`}
            />
            <KpiCard
              label="Tarifa neta (sin IVA)"
              value={formatMoney(data.summary.service_fee_net)}
            />
            <KpiCard
              label="Tarifa total cobrada"
              value={formatMoney(data.summary.service_fee_total)}
              hint="Neto + IVA"
            />
            <KpiCard
              label="Pedidos entregados"
              value={String(data.summary.delivered_orders)}
            />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Desglose reciente</h2>
              <p className="text-sm text-gray-500">Últimos pedidos entregados del periodo</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Negocio</th>
                    <th className="px-4 py-3 font-medium text-right">Tarifa neta</th>
                    <th className="px-4 py-3 font-medium text-right">IVA</th>
                    <th className="px-4 py-3 font-medium text-right">Tarifa total</th>
                    <th className="px-4 py-3 font-medium text-right">Tasa</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                        No hay pedidos entregados en este periodo
                      </td>
                    </tr>
                  ) : (
                    data.recent_orders.map((o) => (
                      <tr key={o.id} className="border-t border-gray-100">
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {formatOrderDate(o.created_at)}
                        </td>
                        <td className="px-4 py-3 text-gray-900">{o.shop_name}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatMoney(o.service_fee_net)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium text-amber-700">
                          {formatMoney(o.service_fee_iva)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatMoney(o.service_fee)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                          {Math.round(o.iva_rate * 10000) / 100}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
