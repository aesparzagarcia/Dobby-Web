"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, authHeaders } from "@/lib/api";
import { WriteOnly } from "@/components/dashboard/WriteOnly";

type IncentiveRow = {
  id: string;
  delivery_man_id: string;
  name: string;
  weekly_level_label: string;
  active_hours_label: string;
  deliveries: number;
  acceptance_rate: number;
  weekly_bonus_pesos: number;
  weekly_status: string;
  weekend: {
    deliveries: number;
    goal: number;
    unlocked_pesos: number;
    status: string;
  };
};

type Config = {
  min_acceptance_pct: number;
  weekend_deliveries_goal: number;
  weekend_bonus_pesos: number;
  weekly_tiers: { level: string; minHours: number; minDeliveries: number; bonusPesos: number }[];
  friday_push_title: string;
  friday_push_body: string;
  sunday_push_title: string;
  sunday_push_body: string;
};

function mondayOf(d: Date) {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  const y = copy.getFullYear();
  const m = String(copy.getMonth() + 1).padStart(2, "0");
  const dd = String(copy.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "En curso",
  UNLOCKED: "Desbloqueado",
  PAID: "Pagado",
  MISSED: "No alcanzado",
};

export default function CourierIncentivesPage() {
  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const [rows, setRows] = useState<IncentiveRow[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiFetch(`/api/delivery-men/incentives?week=${encodeURIComponent(week)}`, {
        headers: authHeaders(),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Error incentivos");
        return json.rows as IncentiveRow[];
      }),
      apiFetch("/api/delivery-men/incentive-config", { headers: authHeaders() }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Error config");
        return json as Config;
      }),
    ])
      .then(([list, cfg]) => {
        setRows(list);
        setConfig(cfg);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [week]);

  useEffect(() => {
    load();
  }, [load]);

  async function markPaid(id: string, field: "weekly_paid" | "weekend_paid") {
    const res = await apiFetch(`/api/delivery-men/incentives/${id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: true }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json.error || "No se pudo marcar pagado");
      return;
    }
    load();
  }

  async function saveConfig() {
    if (!config) return;
    setSaving(true);
    const res = await apiFetch("/api/delivery-men/incentive-config", {
      method: "PUT",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      alert(json.error || "No se pudo guardar");
      return;
    }
    setConfig(json);
    alert("Configuración guardada");
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <Link
        href="/dashboard/repartidores"
        className="inline-flex text-sm text-gray-500 hover:text-dobby-600 mb-4"
      >
        ← Repartidores
      </Link>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bonos e incentivos</h1>
          <p className="text-sm text-gray-500 mt-1">Semana {week}. Desbloqueados en la app; aquí se marcan pagados.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setWeek(addDaysIso(week, -7))} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
            Anterior
          </button>
          <button type="button" onClick={() => setWeek(mondayOf(new Date()))} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
            Esta semana
          </button>
          <button type="button" onClick={() => setWeek(addDaysIso(week, 7))} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
            Siguiente
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
      ) : null}

      {loading && rows.length === 0 ? (
        <p className="text-gray-500">Cargando…</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm mb-8">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Repartidor</th>
                <th className="px-4 py-3 font-medium">Nivel</th>
                <th className="px-4 py-3 font-medium">Horas</th>
                <th className="px-4 py-3 font-medium">Pedidos</th>
                <th className="px-4 py-3 font-medium">Aceptación</th>
                <th className="px-4 py-3 font-medium">Bono semanal</th>
                <th className="px-4 py-3 font-medium">Reto fin de semana</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-3">{r.weekly_level_label}</td>
                  <td className="px-4 py-3">{r.active_hours_label}</td>
                  <td className="px-4 py-3">{r.deliveries}</td>
                  <td className="px-4 py-3">{r.acceptance_rate}%</td>
                  <td className="px-4 py-3">
                    <div>${r.weekly_bonus_pesos} · {STATUS_LABEL[r.weekly_status] ?? r.weekly_status}</div>
                    {r.weekly_status === "UNLOCKED" ? (
                      <WriteOnly>
                        <button
                          type="button"
                          onClick={() => markPaid(r.id, "weekly_paid")}
                          className="mt-1 text-xs font-medium text-dobby-600 hover:underline"
                        >
                          Marcar pagado
                        </button>
                      </WriteOnly>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      {r.weekend.deliveries}/{r.weekend.goal} · ${r.weekend.unlocked_pesos} ·{" "}
                      {STATUS_LABEL[r.weekend.status] ?? r.weekend.status}
                    </div>
                    {r.weekend.status === "UNLOCKED" ? (
                      <WriteOnly>
                        <button
                          type="button"
                          onClick={() => markPaid(r.id, "weekend_paid")}
                          className="mt-1 text-xs font-medium text-dobby-600 hover:underline"
                        >
                          Marcar pagado
                        </button>
                      </WriteOnly>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {config ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Configuración</h2>
          <div className="grid sm:grid-cols-3 gap-4 mb-4">
            <label className="text-sm text-gray-600">
              Aceptación mínima %
              <input
                type="number"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2"
                value={config.min_acceptance_pct}
                onChange={(e) => setConfig({ ...config, min_acceptance_pct: Number(e.target.value) })}
              />
            </label>
            <label className="text-sm text-gray-600">
              Meta reto (entregas)
              <input
                type="number"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2"
                value={config.weekend_deliveries_goal}
                onChange={(e) =>
                  setConfig({ ...config, weekend_deliveries_goal: Number(e.target.value) })
                }
              />
            </label>
            <label className="text-sm text-gray-600">
              Bono reto $
              <input
                type="number"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2"
                value={config.weekend_bonus_pesos}
                onChange={(e) => setConfig({ ...config, weekend_bonus_pesos: Number(e.target.value) })}
              />
            </label>
          </div>
          <div className="overflow-x-auto mb-4">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-3">Nivel</th>
                  <th className="py-2 pr-3">Horas mín.</th>
                  <th className="py-2 pr-3">Pedidos mín.</th>
                  <th className="py-2">Bono $</th>
                </tr>
              </thead>
              <tbody>
                {config.weekly_tiers.map((t, i) => (
                  <tr key={t.level}>
                    <td className="py-1 pr-3">{t.level}</td>
                    <td className="py-1 pr-3">
                      <input
                        type="number"
                        className="w-24 border border-gray-200 rounded px-2 py-1"
                        value={t.minHours}
                        onChange={(e) => {
                          const weekly_tiers = [...config.weekly_tiers];
                          weekly_tiers[i] = { ...t, minHours: Number(e.target.value) };
                          setConfig({ ...config, weekly_tiers });
                        }}
                      />
                    </td>
                    <td className="py-1 pr-3">
                      <input
                        type="number"
                        className="w-24 border border-gray-200 rounded px-2 py-1"
                        value={t.minDeliveries}
                        onChange={(e) => {
                          const weekly_tiers = [...config.weekly_tiers];
                          weekly_tiers[i] = { ...t, minDeliveries: Number(e.target.value) };
                          setConfig({ ...config, weekly_tiers });
                        }}
                      />
                    </td>
                    <td className="py-1">
                      <input
                        type="number"
                        className="w-24 border border-gray-200 rounded px-2 py-1"
                        value={t.bonusPesos}
                        onChange={(e) => {
                          const weekly_tiers = [...config.weekly_tiers];
                          weekly_tiers[i] = { ...t, bonusPesos: Number(e.target.value) };
                          setConfig({ ...config, weekly_tiers });
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <WriteOnly>
            <button
              type="button"
              disabled={saving}
              onClick={saveConfig}
              className="bg-dobby-600 hover:bg-dobby-700 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Guardar configuración"}
            </button>
          </WriteOnly>
        </div>
      ) : null}
    </div>
  );
}
