"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, authHeaders } from "@/lib/api";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const SLOT_LABEL: Record<string, string> = {
  NOON_3: "12–15",
  THREE_6: "15–18",
  SIX_9: "18–21",
  NINE_11: "21–23",
};

type Cell = {
  weekday: number;
  slot: string;
  claimed: number;
  target: number;
  names: string[];
};

type CoverageResponse = {
  week_start: string;
  slots: { key: string; label: string }[];
  days: number[];
  cells: Cell[];
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

export default function CourierCoveragePage() {
  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const [data, setData] = useState<CoverageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch(`/api/delivery-men/coverage?week=${encodeURIComponent(week)}`, {
      headers: authHeaders(),
    })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Error");
        setData(json);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [week]);

  useEffect(() => {
    load();
  }, [load]);

  const slots = data?.slots ?? [
    { key: "NOON_3", label: "12:00–15:00" },
    { key: "THREE_6", label: "15:00–18:00" },
    { key: "SIX_9", label: "18:00–21:00" },
    { key: "NINE_11", label: "21:00–23:00" },
  ];

  function cell(day: number, slot: string): Cell | undefined {
    return data?.cells.find((c) => c.weekday === day && c.slot === slot);
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
          <h1 className="text-2xl font-bold text-gray-900">Cobertura de horarios</h1>
          <p className="text-sm text-gray-500 mt-1">
            Semana {data?.week_start ?? week}. Rojo = faltan personas; ámbar = más de la meta.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeek(addDaysIso(week, -7))}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Semana anterior
          </button>
          <button
            type="button"
            onClick={() => setWeek(mondayOf(new Date()))}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Esta semana
          </button>
          <button
            type="button"
            onClick={() => setWeek(addDaysIso(week, 7))}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Siguiente
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <p className="text-gray-500">Cargando cobertura…</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Bloque</th>
                {DAYS.map((d) => (
                  <th key={d} className="px-3 py-3 text-gray-500 font-medium text-center">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot.key} className="border-b border-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                    {SLOT_LABEL[slot.key] ?? slot.label}
                  </td>
                  {DAYS.map((_, i) => {
                    const c = cell(i + 1, slot.key);
                    const claimed = c?.claimed ?? 0;
                    const target = c?.target ?? 0;
                    const tone =
                      claimed < target
                        ? "bg-red-50 text-red-800 border-red-100"
                        : claimed > target
                          ? "bg-amber-50 text-amber-900 border-amber-100"
                          : "bg-emerald-50 text-emerald-800 border-emerald-100";
                    return (
                      <td key={`${slot.key}-${i}`} className="px-2 py-2">
                        <div
                          className={`rounded-lg border px-2 py-2 text-center ${tone}`}
                          title={(c?.names ?? []).join(", ")}
                        >
                          <div className="font-semibold">
                            {claimed}/{target}
                          </div>
                          {c?.names?.length ? (
                            <div className="text-[11px] mt-1 truncate max-w-[110px] mx-auto">
                              {c.names.join(", ")}
                            </div>
                          ) : (
                            <div className="text-[11px] mt-1 opacity-70">Sin nadie</div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
