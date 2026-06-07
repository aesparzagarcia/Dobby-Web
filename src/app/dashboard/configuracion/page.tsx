"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { authHeaders, apiPath } from "@/lib/api";
import {
  calculateDeliveryFee,
  draftToSettings,
  roundMoney,
  type DeliveryPricingBreakdown,
} from "@/lib/deliveryPricingCalculator";

type AppConfigRow = {
  id: number;
  key: string;
  value: string;
  type: "DOUBLE" | "BOOLEAN" | "STRING";
};

const CONFIG_KEYS = [
  "BASE_FEE",
  "PRICE_PER_KM",
  "WEATHER_FEE",
  "DEFAULT_DEMAND_MULTIPLIER",
  "DEFAULT_IS_RAINING",
  "ZONE_A_MAX_KM",
  "ZONE_B_MAX_KM",
  "ZONE_C_MAX_KM",
  "ZONE_B_FEE",
  "ZONE_C_FEE",
  "ZONE_D_FEE",
] as const;

const DEMAND_OPTIONS = [1, 1.1, 1.2, 1.3, 1.4, 1.5];

function formatMoney(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function numDraft(draft: Record<string, string>, key: string, fallback = 0) {
  const v = Number.parseFloat(draft[key] ?? "");
  return Number.isFinite(v) ? v : fallback;
}

function IconBack({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function IconTruck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M9 17a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0zM3 11h11V7l4 4-4 4v-3H3v-2z"
      />
    </svg>
  );
}

function IconHelp({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function IconSave({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
      />
    </svg>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  accentClass,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accentClass: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${accentClass}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900 tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
  aside,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2">
        <div className="p-6 lg:p-7">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 rounded-lg bg-dobby-50 text-dobby-600 flex items-center justify-center">
              {icon}
            </div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          </div>
          {children}
        </div>
        {aside ? (
          <div className="bg-gradient-to-br from-dobby-50/80 to-sky-50/60 border-t lg:border-t-0 lg:border-l border-gray-100 p-6 lg:p-7 flex flex-col justify-center">
            {aside}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BreakdownList({ rows }: { rows: { label: string; value: string; highlight?: boolean }[] }) {
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((row) => (
        <li
          key={row.label}
          className={`flex justify-between gap-3 ${row.highlight ? "font-semibold text-dobby-700" : "text-gray-600"}`}
        >
          <span>{row.label}</span>
          <span className="tabular-nums">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}

function ZoneCard({
  label,
  range,
  badge,
  badgeClass,
  gradient,
  kmField,
  feeField,
  draft,
  setDraft,
}: {
  label: string;
  range: string;
  badge: string;
  badgeClass: string;
  gradient: string;
  kmField?: string;
  feeField?: string;
  draft: Record<string, string>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  return (
    <div className={`rounded-2xl overflow-hidden border border-white/60 shadow-sm ${gradient}`}>
      <div className="p-4 pb-3 min-h-[140px] flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-gray-900">{label}</p>
            <p className="text-xs text-gray-700/80 mt-0.5">{range}</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${badgeClass}`}>
            {badge}
          </span>
        </div>
        <div className="mt-auto pt-4 flex justify-center opacity-90" aria-hidden>
          <svg viewBox="0 0 80 48" className="w-20 h-12 text-gray-800/70">
            <ellipse cx="40" cy="42" rx="28" ry="4" fill="currentColor" opacity="0.15" />
            <path
              d="M12 32h38l8-12h12l4 8v4H12v-4z"
              fill="currentColor"
              opacity="0.35"
            />
            <circle cx="22" cy="36" r="5" fill="currentColor" opacity="0.5" />
            <circle cx="54" cy="36" r="5" fill="currentColor" opacity="0.5" />
          </svg>
        </div>
      </div>
      {(kmField || feeField) && (
        <div className="bg-white/70 backdrop-blur px-3 py-2.5 flex gap-2 text-xs">
          {kmField ? (
            <label className="flex-1 flex flex-col gap-0.5">
              <span className="text-gray-500">Hasta (km)</span>
              <input
                type="number"
                step="any"
                min={0}
                className="w-full border border-gray-200 rounded-lg px-2 py-1 bg-white"
                value={draft[kmField] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [kmField]: e.target.value }))}
              />
            </label>
          ) : null}
          {feeField ? (
            <label className="flex-1 flex flex-col gap-0.5">
              <span className="text-gray-500">Extra ($)</span>
              <input
                type="number"
                step="any"
                min={0}
                className="w-full border border-gray-200 rounded-lg px-2 py-1 bg-white"
                value={draft[feeField] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [feeField]: e.target.value }))}
              />
            </label>
          ) : null}
        </div>
      )}
    </div>
  );
}

function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-3">¿Cómo funciona?</h3>
        <div className="text-sm text-gray-600 space-y-3">
          <p>
            Dobby calcula el envío así: <strong>tarifa base + (km × precio/km) + recargo de zona + lluvia</strong>,
            y luego aplica el <strong>multiplicador de demanda</strong>.
          </p>
          <p>
            Las zonas suman un extra fijo según la distancia. La lluvia es un monto fijo cuando está activa.
            El multiplicador (1.0–1.5) simula horas pico.
          </p>
          <p className="text-gray-500">
            Los cambios aplican en la app al abrir o refrescar el carrito. No afectan pedidos ya creados.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-xl bg-dobby-600 text-white text-sm font-medium hover:bg-dobby-700"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

export default function ConfiguracionPage() {
  const [rowsByKey, setRowsByKey] = useState<Record<string, AppConfigRow>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const [simDistance, setSimDistance] = useState(5);
  const [simRain, setSimRain] = useState(false);
  const [simDemand, setSimDemand] = useState(1.2);

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
          .filter((r) => (CONFIG_KEYS as readonly string[]).includes(r.key))
          .forEach((r) => {
            byKey[r.key] = r;
            d[r.key] = r.value;
          });
        setRowsByKey(byKey);
        setDraft(d);
        setSimRain(d.DEFAULT_IS_RAINING === "true");
        setSimDemand(Number.parseFloat(d.DEFAULT_DEMAND_MULTIPLIER ?? "1") || 1);
      })
      .catch(() => setError("No se pudo cargar la configuración"))
      .finally(() => setLoading(false));
  }

  useEffect(() => load(), []);

  const settings = useMemo(() => draftToSettings(draft), [draft]);
  const isRaining = draft.DEFAULT_IS_RAINING === "true";
  const demandMultiplier = numDraft(draft, "DEFAULT_DEMAND_MULTIPLIER", 1);

  const exampleMain = useMemo(() => {
    const km = 3;
    return calculateDeliveryFee(
      { distanceKm: km, demandMultiplier: 1, isRaining: false },
      settings
    );
  }, [settings]);

  const exampleRain = useMemo(() => {
    const normal = 80;
    const rainExtra = settings.weatherFee;
    return { normal, rainExtra, total: normal + rainExtra };
  }, [settings.weatherFee]);

  const exampleDemand = useMemo(() => {
    const base = 80;
    const mult = demandMultiplier;
    return { base, mult, total: roundMoney(base * mult) };
  }, [demandMultiplier]);

  const simulatorBreakdown: DeliveryPricingBreakdown = useMemo(
    () =>
      calculateDeliveryFee(
        {
          distanceKm: simDistance,
          demandMultiplier: simDemand,
          isRaining: simRain,
        },
        settings
      ),
    [simDistance, simDemand, simRain, settings]
  );

  const demandExtra = roundMoney(
    simulatorBreakdown.finalDeliveryFee - simulatorBreakdown.deliverySubtotal
  );

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
      const res = await fetch(apiPath("/api/admin/app-config"), {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Error al guardar");
      setMessage("Cambios guardados. La app Dobby los tomará al refrescar el carrito.");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[40vh]">
        <p className="text-gray-500">Cargando tarifas de envío…</p>
      </div>
    );
  }

  const zoneA = settings.zoneAMaxKm;
  const zoneB = settings.zoneBMaxKm;
  const zoneC = settings.zoneCMaxKm;

  return (
    <div className="p-6 lg:p-8 max-w-[1100px] mx-auto pb-16">
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-8">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Link
            href="/dashboard"
            className="mt-1 w-9 h-9 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-50 shrink-0"
            aria-label="Volver al resumen"
          >
            <IconBack className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-dobby-600 text-white flex items-center justify-center shrink-0">
                <IconTruck className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Tarifas de envío</h1>
            </div>
            <p className="text-sm text-gray-500 mt-2 max-w-xl">
              Configura cómo Dobby calcula el costo de envío para los clientes.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-dobby-200 text-dobby-700 text-sm font-medium bg-white hover:bg-dobby-50 shrink-0 self-start"
        >
          <IconHelp className="w-4 h-4" />
          ¿Cómo funciona?
        </button>
      </div>

      {error && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}
      {message && (
        <p className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          {message}
        </p>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          label="Tarifa base"
          value={formatMoney(settings.baseFee)}
          accentClass="bg-dobby-100 text-dobby-600"
          icon={<span className="text-lg font-bold">$</span>}
        />
        <SummaryCard
          label="Precio por km"
          value={`${formatMoney(settings.pricePerKm)} / km`}
          accentClass="bg-sky-100 text-sky-600"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <SummaryCard
          label="Demanda actual"
          value={`×${demandMultiplier}`}
          accentClass="bg-violet-100 text-violet-600"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
        <SummaryCard
          label="Lluvia"
          value={isRaining ? "ON" : "OFF"}
          accentClass={isRaining ? "bg-sky-100 text-sky-600" : "bg-gray-100 text-gray-500"}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          }
        />
      </div>

      <div className="space-y-5">
        {/* Rain surcharge */}
        <SectionCard
          title="Recargo por lluvia"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          }
          aside={
            <div>
              <p className="text-xs font-semibold text-dobby-600 uppercase tracking-wide mb-3">
                Ejemplo de cálculo
              </p>
              <BreakdownList
                rows={[
                  { label: "Envío normal", value: formatMoney(exampleRain.normal) },
                  { label: "Lluvia activa", value: `+${formatMoney(exampleRain.rainExtra)}` },
                  {
                    label: "Total con lluvia",
                    value: formatMoney(exampleRain.total),
                    highlight: true,
                  },
                ]}
              />
            </div>
          }
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Estado de lluvia</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isRaining ? "Activo — se aplica recargo en la app" : "Desactivado"}
                </p>
              </div>
              <label className="inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={isRaining}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      DEFAULT_IS_RAINING: e.target.checked ? "true" : "false",
                    }))
                  }
                />
                <span
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    isRaining ? "bg-dobby-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                      isRaining ? "translate-x-5" : ""
                    }`}
                  />
                </span>
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Recargo adicional</span>
              <div className="mt-2 flex items-center gap-2 max-w-[200px]">
                <span className="text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  step="any"
                  min={0}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                  value={draft.WEATHER_FEE ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, WEATHER_FEE: e.target.value }))}
                />
              </div>
            </label>
          </div>
        </SectionCard>

        {/* Dynamic demand */}
        <SectionCard
          title="Demanda dinámica"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
          aside={
            <div>
              <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide mb-3">
                Ejemplo de cálculo
              </p>
              <p className="text-sm text-gray-700">
                Un envío de {formatMoney(exampleDemand.base)} costará:{" "}
                <strong className="text-violet-700">{formatMoney(exampleDemand.total)}</strong>{" "}
                <span className="text-gray-500">
                  ({formatMoney(exampleDemand.base)} × {exampleDemand.mult})
                </span>
              </p>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>1.0</span>
              <span className="inline-flex px-3 py-1 rounded-full bg-violet-100 text-violet-700 font-semibold text-sm">
                Actual: ×{demandMultiplier}
              </span>
              <span>1.5</span>
            </div>
            <input
              type="range"
              min={1}
              max={1.5}
              step={0.1}
              value={demandMultiplier}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  DEFAULT_DEMAND_MULTIPLIER: e.target.value,
                }))
              }
              className="w-full h-2 rounded-full appearance-none bg-violet-100 accent-violet-600 cursor-pointer"
            />
            <p className="text-xs text-gray-500">
              1.0 = normal · 1.2 = +20% en horas pico
            </p>
          </div>
        </SectionCard>

        {/* Main calculation */}
        <SectionCard
          title="Cálculo principal"
          icon={<IconTruck className="w-5 h-5" />}
          aside={
            <div>
              <p className="text-xs font-semibold text-dobby-600 uppercase tracking-wide mb-3">
                Ejemplo (3 km)
              </p>
              <BreakdownList
                rows={[
                  { label: "Tarifa base", value: formatMoney(exampleMain.baseFee) },
                  {
                    label: `Distancia (3 km × ${formatMoney(settings.pricePerKm)})`,
                    value: formatMoney(exampleMain.distanceFee),
                  },
                  ...(exampleMain.zoneFee > 0
                    ? [{ label: "Zona", value: formatMoney(exampleMain.zoneFee) }]
                    : []),
                  {
                    label: "Total estimado",
                    value: formatMoney(exampleMain.deliverySubtotal),
                    highlight: true,
                  },
                ]}
              />
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Tarifa base</span>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-gray-500">$</span>
                <input
                  type="number"
                  step="any"
                  min={0}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                  value={draft.BASE_FEE ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, BASE_FEE: e.target.value }))}
                />
              </div>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Precio por km recorrido</span>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-gray-500">$</span>
                <input
                  type="number"
                  step="any"
                  min={0}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                  value={draft.PRICE_PER_KM ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, PRICE_PER_KM: e.target.value }))}
                />
                <span className="text-sm text-gray-500">/ km</span>
              </div>
            </label>
          </div>
        </SectionCard>

        {/* Distance zones */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:p-7">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 rounded-lg bg-dobby-50 text-dobby-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900">Zonas por distancia</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <ZoneCard
              label="Zona A"
              range={`0 – ${zoneA} km`}
              badge="Sin recargo"
              badgeClass="bg-emerald-100 text-emerald-800"
              gradient="bg-gradient-to-br from-emerald-50 to-green-100"
              kmField="ZONE_A_MAX_KM"
              draft={draft}
              setDraft={setDraft}
            />
            <ZoneCard
              label="Zona B"
              range={`${zoneA} – ${zoneB} km`}
              badge={`+ ${formatMoney(settings.zoneBFee)}`}
              badgeClass="bg-amber-100 text-amber-900"
              gradient="bg-gradient-to-br from-amber-50 to-yellow-100"
              kmField="ZONE_B_MAX_KM"
              feeField="ZONE_B_FEE"
              draft={draft}
              setDraft={setDraft}
            />
            <ZoneCard
              label="Zona C"
              range={`${zoneB} – ${zoneC} km`}
              badge={`+ ${formatMoney(settings.zoneCFee)}`}
              badgeClass="bg-orange-100 text-orange-900"
              gradient="bg-gradient-to-br from-orange-50 to-amber-100"
              kmField="ZONE_C_MAX_KM"
              feeField="ZONE_C_FEE"
              draft={draft}
              setDraft={setDraft}
            />
            <ZoneCard
              label="Zona D"
              range={`${zoneC}+ km`}
              badge={`+ ${formatMoney(settings.zoneDFee)}`}
              badgeClass="bg-red-100 text-red-800"
              gradient="bg-gradient-to-br from-red-50 to-orange-100"
              feeField="ZONE_D_FEE"
              draft={draft}
              setDraft={setDraft}
            />
          </div>
          <p className="mt-4 text-xs text-gray-500 flex items-center gap-1.5">
            <IconHelp className="w-3.5 h-3.5 shrink-0" />
            Los recargos de zona se suman al costo final del envío.
          </p>
        </div>

        {/* Simulator */}
        <SectionCard
          title="Simulador de envío"
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          }
          aside={
            <div>
              <BreakdownList
                rows={[
                  { label: "Tarifa base", value: formatMoney(simulatorBreakdown.baseFee) },
                  {
                    label: `Distancia (${simDistance} km × ${formatMoney(settings.pricePerKm)})`,
                    value: formatMoney(simulatorBreakdown.distanceFee),
                  },
                  ...(simulatorBreakdown.zoneFee > 0
                    ? [{ label: "Zona", value: formatMoney(simulatorBreakdown.zoneFee) }]
                    : []),
                  ...(simulatorBreakdown.weatherFee > 0
                    ? [{ label: "Lluvia", value: formatMoney(simulatorBreakdown.weatherFee) }]
                    : []),
                  ...(demandExtra > 0
                    ? [
                        {
                          label: `Demanda (×${simDemand})`,
                          value: `+${formatMoney(demandExtra)}`,
                        },
                      ]
                    : []),
                  {
                    label: "TOTAL ESTIMADO",
                    value: formatMoney(simulatorBreakdown.finalDeliveryFee),
                    highlight: true,
                  },
                ]}
              />
            </div>
          }
        >
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Distancia</span>
              <div className="mt-2 flex items-center gap-2 max-w-[180px]">
                <input
                  type="number"
                  step="any"
                  min={0}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                  value={simDistance}
                  onChange={(e) =>
                    setSimDistance(Number.parseFloat(e.target.value) || 0)
                  }
                />
                <span className="text-sm text-gray-500">km</span>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={simRain}
                onChange={(e) => setSimRain(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-dobby-600"
              />
              <span className="text-sm font-medium text-gray-700">Lluvia</span>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Demanda</span>
              <select
                className="mt-2 w-full max-w-[180px] border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"
                value={simDemand}
                onChange={(e) => setSimDemand(Number.parseFloat(e.target.value))}
              >
                {DEMAND_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    ×{v}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </SectionCard>
      </div>

      {/* Save */}
      <div className="mt-10 flex justify-center">
        <button
          type="button"
          onClick={saveAll}
          disabled={saving}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-dobby-600 text-white text-sm font-semibold shadow-lg shadow-dobby-600/25 hover:bg-dobby-700 disabled:opacity-50 transition-colors"
        >
          <IconSave className="w-5 h-5" />
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
