"use client";

import { useEffect, useState } from "react";
import { authHeaders, apiPath } from "@/lib/api";

type AppConfigRow = {
  id: number;
  key: string;
  value: string;
  type: "DOUBLE" | "BOOLEAN" | "STRING";
};

type FieldDef = {
  key: string;
  label: string;
  hint?: string;
  type: "DOUBLE" | "BOOLEAN";
};

type SectionDef = {
  id: string;
  title: string;
  description: string;
  fields: FieldDef[];
};

const SECTIONS: SectionDef[] = [
  {
    id: "clima",
    title: "Clima y demanda",
    description:
      "Activa la lluvia para sumar el recargo por clima en el carrito de la app. El multiplicador de demanda aumenta el envío en horas pico (1.0 = normal, 1.2 = +20%).",
    fields: [
      {
        key: "DEFAULT_IS_RAINING",
        label: "¿Está lloviendo ahora?",
        hint: "Si está activo, se aplica el recargo por clima en cada cotización de envío.",
        type: "BOOLEAN",
      },
      {
        key: "WEATHER_FEE",
        label: "Recargo por lluvia ($)",
        hint: "Monto fijo que se suma cuando llueve.",
        type: "DOUBLE",
      },
      {
        key: "DEFAULT_DEMAND_MULTIPLIER",
        label: "Multiplicador de demanda",
        hint: "Ejemplo: 1.2 sube un envío de $80 a $96.",
        type: "DOUBLE",
      },
    ],
  },
  {
    id: "tarifas",
    title: "Tarifas base",
    description: "Costo inicial del envío y precio por kilómetro recorrido (distancia en línea recta × factor de calle).",
    fields: [
      { key: "BASE_FEE", label: "Tarifa base ($)", type: "DOUBLE" },
      { key: "PRICE_PER_KM", label: "Precio por km ($)", type: "DOUBLE" },
    ],
  },
  {
    id: "zonas",
    title: "Zonas por distancia",
    description:
      "Define hasta cuántos km aplica cada zona y el extra en pesos. Zona A (0–A km) no tiene cargo extra; más allá de C km aplica la tarifa D.",
    fields: [
      { key: "ZONE_A_MAX_KM", label: "Zona A — hasta (km)", type: "DOUBLE" },
      { key: "ZONE_B_MAX_KM", label: "Zona B — hasta (km)", type: "DOUBLE" },
      { key: "ZONE_C_MAX_KM", label: "Zona C — hasta (km)", type: "DOUBLE" },
      { key: "ZONE_B_FEE", label: "Extra zona B ($)", type: "DOUBLE" },
      { key: "ZONE_C_FEE", label: "Extra zona C ($)", type: "DOUBLE" },
      { key: "ZONE_D_FEE", label: "Extra zona D ($)", type: "DOUBLE" },
    ],
  },
];

const ALL_KEYS = new Set(SECTIONS.flatMap((s) => s.fields.map((f) => f.key)));

export default function ConfiguracionPage() {
  const [rowsByKey, setRowsByKey] = useState<Record<string, AppConfigRow>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingRain, setSavingRain] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetch(apiPath("/api/admin/app-config"), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? (data as AppConfigRow[]) : [];
        const byKey: Record<string, AppConfigRow> = {};
        const d: Record<string, string> = {};
        list
          .filter((r) => ALL_KEYS.has(r.key))
          .forEach((r) => {
            byKey[r.key] = r;
            d[r.key] = r.value;
          });
        setRowsByKey(byKey);
        setDraft(d);
      })
      .catch(() => setError("No se pudo cargar la configuración"))
      .finally(() => setLoading(false));
  }

  useEffect(() => load(), []);

  async function putItems(items: { key: string; value: unknown }[]) {
    const res = await fetch(apiPath("/api/admin/app-config"), {
      method: "PUT",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error ?? "Error al guardar");
    }
    return data;
  }

  async function saveAll() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const items = Object.values(rowsByKey).map((r) => ({
        key: r.key,
        value:
          r.type === "BOOLEAN"
            ? draft[r.key] === "true"
            : Number.parseFloat(draft[r.key] ?? "0"),
      }));
      await putItems(items);
      setMessage("Tarifas guardadas. La app Dobby tomará los cambios al abrir o refrescar el carrito.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function saveRainOnly() {
    setSavingRain(true);
    setMessage(null);
    setError(null);
    try {
      await putItems([
        { key: "DEFAULT_IS_RAINING", value: draft.DEFAULT_IS_RAINING === "true" },
        { key: "WEATHER_FEE", value: Number.parseFloat(draft.WEATHER_FEE ?? "0") },
      ]);
      setMessage("Estado de lluvia actualizado en la app.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar lluvia");
    } finally {
      setSavingRain(false);
    }
  }

  const isRaining = draft.DEFAULT_IS_RAINING === "true";

  if (loading) {
    return <p className="text-gray-500">Cargando tarifas de envío…</p>;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Tarifas de envío</h1>
      <p className="text-sm text-gray-600 mb-6">
        Desde aquí ajustas los precios que usa la app Dobby al calcular el costo de envío en el carrito.
        Los cambios no afectan pedidos ya creados.
      </p>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          {message}
        </p>
      )}

      {/* Tarjeta rápida: lluvia */}
      <section className="mb-8 bg-sky-50 border border-sky-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-sky-900 mb-1">Lluvia en este momento</h2>
        <p className="text-sm text-sky-800/80 mb-4">
          Activa o desactiva el recargo por clima sin tocar el resto de tarifas.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <label className="inline-flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={isRaining}
              onChange={(e) =>
                setDraft((d) => ({ ...d, DEFAULT_IS_RAINING: e.target.checked ? "true" : "false" }))
              }
            />
            <span
              className={`relative w-12 h-7 rounded-full transition-colors ${
                isRaining ? "bg-sky-600" : "bg-gray-300"
              }`}
              aria-hidden
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  isRaining ? "translate-x-5" : ""
                }`}
              />
            </span>
            <span className="text-sm font-medium text-gray-900">
              {isRaining ? "Lloviendo — se aplica recargo" : "Sin lluvia — sin recargo"}
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <span>Recargo ($)</span>
            <input
              type="number"
              step="any"
              min={0}
              className="w-24 border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
              value={draft.WEATHER_FEE ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, WEATHER_FEE: e.target.value }))}
            />
          </label>

          <button
            type="button"
            onClick={saveRainOnly}
            disabled={savingRain}
            className="sm:ml-auto px-4 py-2 bg-sky-700 text-white text-sm rounded-lg hover:bg-sky-800 disabled:opacity-50"
          >
            {savingRain ? "Guardando…" : "Guardar lluvia"}
          </button>
        </div>
      </section>

      {SECTIONS.map((section) => (
        <section key={section.id} className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">{section.title}</h2>
          <p className="text-sm text-gray-600 mb-3">{section.description}</p>
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-100">
            {section.fields.map((field) => {
              const row = rowsByKey[field.key];
              if (!row) return null;
              if (section.id === "clima" && field.key === "DEFAULT_IS_RAINING") {
                return null;
              }
              if (section.id === "clima" && field.key === "WEATHER_FEE") {
                return null;
              }
              return (
                <label
                  key={field.key}
                  className="flex flex-col sm:flex-row sm:items-start gap-2 px-4 py-3"
                >
                  <span className="sm:w-1/2 text-sm font-medium text-gray-800">
                    {field.label}
                    {field.hint && (
                      <span className="block text-xs font-normal text-gray-500 mt-0.5">
                        {field.hint}
                      </span>
                    )}
                    <span className="block text-xs font-mono text-gray-400 mt-0.5">{field.key}</span>
                  </span>
                  {field.type === "BOOLEAN" ? (
                    <select
                      className="sm:w-1/2 border border-gray-300 rounded px-3 py-2 text-sm"
                      value={draft[field.key] ?? "false"}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [field.key]: e.target.value }))
                      }
                    >
                      <option value="false">No</option>
                      <option value="true">Sí</option>
                    </select>
                  ) : (
                    <input
                      type="number"
                      step="any"
                      className="sm:w-1/2 border border-gray-300 rounded px-3 py-2 text-sm"
                      value={draft[field.key] ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [field.key]: e.target.value }))
                      }
                    />
                  )}
                </label>
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-200">
        <button
          type="button"
          onClick={saveAll}
          disabled={saving}
          className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar todas las tarifas"}
        </button>
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
        >
          Recargar
        </button>
      </div>
    </div>
  );
}
