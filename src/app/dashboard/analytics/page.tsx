"use client";

import { useEffect, useState } from "react";
import { authHeaders, apiPath } from "@/lib/api";

const defaultFrom = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
};
const defaultTo = () => new Date().toISOString().slice(0, 10);

export default function AnalyticsPage() {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [bestShops, setBestShops] = useState<Array<{ shopName: string; revenue: number; orderCount: number }>>([]);
  const [bestProducts, setBestProducts] = useState<Array<{ productName: string; shopName: string; quantitySold: number; revenue: number }>>([]);
  const [mostRequested, setMostRequested] = useState<Array<{ serviceName: string; category: string; requestCount: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = `?from=${from}&to=${to}&limit=10`;
    Promise.all([
      fetch(apiPath(`/api/analytics/best-shops${q}`), { headers: authHeaders() }).then((r) => r.json()),
      fetch(apiPath(`/api/analytics/best-products${q}`), { headers: authHeaders() }).then((r) => r.json()),
      fetch(apiPath(`/api/analytics/most-requested-services${q}`), { headers: authHeaders() }).then((r) => r.json()),
    ])
      .then(([shops, products, services]) => {
        setBestShops(Array.isArray(shops) ? shops : []);
        setBestProducts(Array.isArray(products) ? products : []);
        setMostRequested(Array.isArray(services) ? services : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [from, to]);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Estadísticas</h1>
      <div className="flex flex-wrap gap-4 items-center mb-6">
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Desde</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Hasta</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border rounded px-2 py-1"
          />
        </label>
      </div>
      {loading ? (
        <p className="text-gray-500">Cargando…</p>
      ) : (
        <div className="space-y-8">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-3">Tiendas más vendidas</h2>
            {bestShops.length === 0 ? (
              <p className="text-gray-500">No hay datos en este período.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-2">Tienda</th>
                    <th className="pb-2">Pedidos</th>
                    <th className="pb-2">Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {bestShops.map((s, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2">{s.shopName}</td>
                      <td className="py-2">{s.orderCount}</td>
                      <td className="py-2">${s.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-3">Productos más vendidos</h2>
            {bestProducts.length === 0 ? (
              <p className="text-gray-500">No hay datos en este período.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-2">Producto</th>
                    <th className="pb-2">Tienda</th>
                    <th className="pb-2">Cant. vendida</th>
                    <th className="pb-2">Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {bestProducts.map((p, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2">{p.productName}</td>
                      <td className="py-2">{p.shopName}</td>
                      <td className="py-2">{p.quantitySold}</td>
                      <td className="py-2">${p.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-3">Servicios más solicitados</h2>
            {mostRequested.length === 0 ? (
              <p className="text-gray-500">No hay datos en este período.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-2">Servicio</th>
                    <th className="pb-2">Categoría</th>
                    <th className="pb-2">Solicitudes</th>
                  </tr>
                </thead>
                <tbody>
                  {mostRequested.map((s, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2">{s.serviceName}</td>
                      <td className="py-2">{s.category === "LIGHT" ? "Luz" : s.category === "GAS" ? "Gas" : s.category === "PHONE" ? "Teléfono" : s.category === "WATER" ? "Agua" : "Otro"}</td>
                      <td className="py-2">{s.requestCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
