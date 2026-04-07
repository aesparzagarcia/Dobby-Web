"use client";

import { useEffect, useState } from "react";
import { authHeaders, apiPath } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function IncomePage() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<{ total: number; byDay: Record<string, number> } | null>(null);

  useEffect(() => {
    fetch(
      apiPath(`/api/analytics/income?from=${from}&to=${to}`),
      { headers: authHeaders() }
    )
      .then((r) => r.json())
      .then((data) => setData(data && typeof data.total === "number" ? data : null))
      .catch(() => setData(null));
  }, [from, to]);

  const chartData = data?.byDay
    ? Object.entries(data.byDay)
        .map(([day, value]) => ({ day, value }))
        .sort((a, b) => a.day.localeCompare(b.day))
    : [];

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Ingresos</h1>
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
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <p className="text-sm text-gray-500">Ingreso total</p>
        <p className="text-2xl font-semibold">
          {data != null ? `$${Number(data.total).toFixed(2)}` : "—"}
        </p>
      </div>
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#2563eb" name="Ingreso" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
