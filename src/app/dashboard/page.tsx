"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, authHeaders } from "@/lib/api";
import { useAdminAccess } from "@/contexts/AdminAccessContext";

export default function DashboardOverview() {
  const { canWrite } = useAdminAccess();
  const [income, setIncome] = useState<{ total: number } | null>(null);
  const [counts, setCounts] = useState<{ shops: number; services: number; products: number; delivery: number } | null>(null);

  useEffect(() => {
    const from = new Date();
    from.setMonth(from.getMonth() - 1);
    const to = new Date();
    const q = `?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`;
    const requests: Promise<unknown>[] = [
      apiFetch("/api/shops", { headers: authHeaders() }).then((r) => r.json()),
      apiFetch("/api/services", { headers: authHeaders() }).then((r) => r.json()),
      apiFetch("/api/products", { headers: authHeaders() }).then((r) => r.json()),
      apiFetch("/api/delivery-men", { headers: authHeaders() }).then((r) => r.json()),
    ];
    if (canWrite) {
      requests.unshift(
        apiFetch(`/api/analytics/income${q}`, { headers: authHeaders() }).then((r) => r.json())
      );
    }
    Promise.all(requests)
      .then((results) => {
        const incomeData = canWrite ? results[0] : null;
        const [shops, services, products, deliveryMen] = canWrite
          ? results.slice(1)
          : results;
        setIncome(
          canWrite && incomeData && typeof (incomeData as { total?: number }).total === "number"
            ? (incomeData as { total: number })
            : null
        );
        setCounts({
          shops: Array.isArray(shops) ? shops.length : 0,
          services: Array.isArray(services) ? services.length : 0,
          products: Array.isArray(products) ? products.length : 0,
          delivery: Array.isArray(deliveryMen) ? deliveryMen.length : 0,
        });
      })
      .catch(() => {});
  }, [canWrite]);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Resumen</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {canWrite ? (
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-500">Ingresos (últimos 30 días)</p>
            <p className="text-xl font-semibold">
              {income != null ? `$${Number(income.total).toFixed(2)}` : "—"}
            </p>
            <Link href="/dashboard/income" className="text-sm text-dobby-600 hover:underline">
              Ver detalles →
            </Link>
          </div>
        ) : null}
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Tiendas</p>
          <p className="text-xl font-semibold">{counts?.shops ?? "—"}</p>
          <Link href="/dashboard/shops" className="text-sm text-dobby-600 hover:underline">
            {canWrite ? "Gestionar →" : "Ver →"}
          </Link>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Servicios</p>
          <p className="text-xl font-semibold">{counts?.services ?? "—"}</p>
          <Link href="/dashboard/services" className="text-sm text-dobby-600 hover:underline">
            {canWrite ? "Gestionar →" : "Ver →"}
          </Link>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Repartidores</p>
          <p className="text-xl font-semibold">{counts?.delivery ?? "—"}</p>
          <Link href="/dashboard/repartidores" className="text-sm text-dobby-600 hover:underline">
            Ver →
          </Link>
        </div>
      </div>
      {canWrite ? (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-medium mb-2">Enlaces rápidos</h2>
          <ul className="space-y-1 text-sm">
            <li><Link href="/dashboard/income" className="text-dobby-600 hover:underline">Ingresos</Link></li>
            <li><Link href="/dashboard/analytics" className="text-dobby-600 hover:underline">Más vendidos y servicios más solicitados</Link></li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
