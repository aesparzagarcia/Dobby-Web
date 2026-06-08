"use client";

import { useEffect, useMemo, useState } from "react";
import { authHeaders, apiPath, uploadsUrl } from "@/lib/api";
import {
  AdFormModal,
  adRecordToFormValues,
  defaultAdFormValues,
  type AdFormValues,
} from "./AdFormModal";

type AdStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED" | "ARCHIVED";

type Ad = {
  id: string;
  imageUrl: string | null;
  logoUrl: string | null;
  advertiserName: string;
  description: string | null;
  address: string | null;
  contactPhone: string | null;
  whatsapp: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  email: string | null;
  websiteUrl: string | null;
  category: string | null;
  status: AdStatus;
  isActive: boolean;
  clicksCount: number;
  conversionsCount: number;
  amountPaid: number | string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  priority: number;
  placement: string;
  linkedStoreId: string | null;
  couponCode: string | null;
  discountPercent: number | null;
  buttonText: string | null;
  buttonAction: string | null;
  paymentStatus: string | null;
};

type FilterTab = "todos" | "activos" | "programados" | "pausados" | "finalizados";
type SortOption = "recent" | "oldest" | "clicks" | "priority";
type DisplayStatus = "activo" | "programado" | "pausado" | "finalizado";

const PAGE_SIZE = 4;

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "activos", label: "Activos" },
  { id: "programados", label: "Programados" },
  { id: "pausados", label: "Pausados" },
  { id: "finalizados", label: "Finalizados" },
];

const STATUS_BADGE: Record<DisplayStatus, { label: string; className: string }> = {
  activo: { label: "Activo", className: "bg-emerald-500 text-white" },
  programado: { label: "Programado", className: "bg-orange-500 text-white" },
  pausado: { label: "Pausado", className: "bg-amber-500 text-white" },
  finalizado: { label: "Finalizado", className: "bg-gray-700 text-white" },
};

function formatNumber(n: number) {
  return new Intl.NumberFormat("es-MX").format(n);
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPeriod(start: string | null, end: string | null): string {
  const fmt = (d: string) =>
    new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" }).format(new Date(d));
  if (start && end) return `${fmt(start)} - ${fmt(end)}`;
  if (start) return `Desde ${fmt(start)}`;
  if (end) return `Hasta ${fmt(end)}`;
  return "Sin límite";
}

function parseAmount(v: number | string | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number.parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function getDisplayStatus(ad: Ad): DisplayStatus {
  const now = Date.now();
  if (ad.status === "EXPIRED" || ad.status === "ARCHIVED") return "finalizado";
  if (ad.endDate && new Date(ad.endDate).getTime() < now) return "finalizado";
  if (ad.status === "PAUSED") return "pausado";
  if (ad.startDate && new Date(ad.startDate).getTime() > now) return "programado";
  if (ad.status === "ACTIVE" || ad.isActive) return "activo";
  if (ad.status === "DRAFT") return "programado";
  return "pausado";
}

function matchesFilter(ad: Ad, filter: FilterTab): boolean {
  const ds = getDisplayStatus(ad);
  switch (filter) {
    case "todos":
      return true;
    case "activos":
      return ds === "activo";
    case "programados":
      return ds === "programado";
    case "pausados":
      return ds === "pausado";
    case "finalizados":
      return ds === "finalizado";
  }
}

function normalizeAd(raw: Record<string, unknown>): Ad {
  return {
    id: String(raw.id ?? ""),
    imageUrl: (raw.imageUrl as string | null) ?? null,
    logoUrl: (raw.logoUrl as string | null) ?? null,
    advertiserName: String(raw.advertiserName ?? ""),
    description: (raw.description as string | null) ?? null,
    address: (raw.address as string | null) ?? null,
    contactPhone: (raw.contactPhone as string | null) ?? null,
    whatsapp: (raw.whatsapp as string | null) ?? null,
    facebookUrl: (raw.facebookUrl as string | null) ?? null,
    instagramUrl: (raw.instagramUrl as string | null) ?? null,
    email: (raw.email as string | null) ?? null,
    websiteUrl: (raw.websiteUrl as string | null) ?? null,
    category: (raw.category as string | null) ?? null,
    status: (raw.status as AdStatus) ?? (raw.isActive ? "ACTIVE" : "PAUSED"),
    isActive: raw.isActive !== false && raw.status !== "PAUSED",
    clicksCount: Number(raw.clicksCount ?? 0),
    conversionsCount: Number(raw.conversionsCount ?? 0),
    amountPaid: (raw.amountPaid as number | string | null) ?? null,
    startDate: (raw.startDate as string | null) ?? null,
    endDate: (raw.endDate as string | null) ?? null,
    createdAt: String(raw.createdAt ?? ""),
    priority: Number(raw.priority ?? 0),
    placement: String(raw.placement ?? "HOME_CAROUSEL"),
    linkedStoreId: (raw.linkedStoreId as string | null) ?? null,
    couponCode: (raw.couponCode as string | null) ?? null,
    discountPercent: raw.discountPercent != null ? Number(raw.discountPercent) : null,
    buttonText: (raw.buttonText as string | null) ?? null,
    buttonAction: (raw.buttonAction as string | null) ?? null,
    paymentStatus: (raw.paymentStatus as string | null) ?? null,
  };
}

function IconMegaphone({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
      />
    </svg>
  );
}

function IconCursor({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M3.14 13.657l2.898.777M7.188 21.761l-.777-2.898M12.864 7.965l2.898-.777M20.86 13.657l-2.898.777"
      />
    </svg>
  );
}

function IconDollar({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function IconChart({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6m6 0h6m-6 0H5m14 0v-10a2 2 0 012-2h2a2 2 0 012 2v10m-6 0h6" />
    </svg>
  );
}

function IconPencil({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}

function IconPause({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconPlay({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconDoc({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
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
        strokeWidth={1.75}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  subtitle,
  icon,
  iconBg,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{value}</p>
        {subtitle ? <p className="text-xs text-gray-400 mt-2">{subtitle}</p> : null}
      </div>
      <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
    </div>
  );
}

function AdMetric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="text-center min-w-0">
      <div className="flex items-center justify-center gap-1 text-gray-900 font-semibold text-sm tabular-nums">
        <span className="text-gray-400 shrink-0">{icon}</span>
        <span className="truncate">{value}</span>
      </div>
      <p className="text-[11px] text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

export default function AnunciosPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"closed" | "create" | "edit">("closed");
  const [statsAd, setStatsAd] = useState<Ad | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<AdFormValues>(defaultAdFormValues);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("todos");
  const [sort, setSort] = useState<SortOption>("recent");
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch(apiPath("/api/ads"), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data.map((row) => normalizeAd(row as Record<string, unknown>)) : [];
        setAds(list);
      })
      .catch(() => setAds([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => load(), []);

  useEffect(() => {
    setPage(1);
  }, [search, filter, sort]);

  const kpis = useMemo(() => {
    const activeCount = ads.filter((ad) => getDisplayStatus(ad) === "activo").length;
    const totalClicks = ads.reduce((s, ad) => s + ad.clicksCount, 0);
    const totalRevenue = ads.reduce((s, ad) => s + parseAmount(ad.amountPaid), 0);
    return { activeCount, totalClicks, totalRevenue };
  }, [ads]);

  const filteredAds = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = ads.filter((ad) => matchesFilter(ad, filter));
    if (q) {
      list = list.filter(
        (ad) =>
          ad.advertiserName.toLowerCase().includes(q) ||
          (ad.description?.toLowerCase().includes(q) ?? false)
      );
    }
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "oldest":
          return a.createdAt.localeCompare(b.createdAt);
        case "clicks":
          return b.clicksCount - a.clicksCount;
        case "priority":
          return b.priority - a.priority;
        case "recent":
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
    return list;
  }, [ads, search, filter, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredAds.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageAds = filteredAds.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeFrom = filteredAds.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeTo = Math.min(currentPage * PAGE_SIZE, filteredAds.length);

  function closeModal() {
    setModal("closed");
    setEditId(null);
    setFormInitialValues(defaultAdFormValues);
  }

  function openCreate() {
    setEditId(null);
    setFormInitialValues(defaultAdFormValues);
    setModal("create");
  }

  function openEdit(ad: Ad) {
    setEditId(ad.id);
    setFormInitialValues(adRecordToFormValues(ad as unknown as Record<string, unknown>));
    setModal("edit");
    setOpenMenuId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este anuncio?")) return;
    const res = await fetch(apiPath(`/api/ads/${id}`), { method: "DELETE", headers: authHeaders() });
    if (res.ok) {
      setOpenMenuId(null);
      if (editId === id) closeModal();
      load();
    }
  }

  async function updateAdStatus(ad: Ad, status: AdStatus) {
    const res = await fetch(apiPath(`/api/ads/${ad.id}`), {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ status, isActive: status === "ACTIVE" }),
    });
    if (res.ok) load();
    else alert("No se pudo actualizar el estado");
  }

  function handlePrimaryAction(ad: Ad) {
    const ds = getDisplayStatus(ad);
    if (ds === "activo") updateAdStatus(ad, "PAUSED");
    else if (ds === "programado" || ds === "pausado") updateAdStatus(ad, "ACTIVE");
    else openEdit(ad);
  }

  function primaryActionLabel(ad: Ad): { label: string; icon: React.ReactNode } {
    const ds = getDisplayStatus(ad);
    if (ds === "activo") return { label: "Pausar", icon: <IconPause className="w-4 h-4" /> };
    if (ds === "programado" || ds === "pausado") return { label: "Activar", icon: <IconPlay className="w-4 h-4" /> };
    return { label: "Ver resumen", icon: <IconDoc className="w-4 h-4" /> };
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]" onClick={() => setOpenMenuId(null)}>
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Anuncios</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Promociona negocios, productos y servicios dentro de Dobby.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 shrink-0 bg-dobby-600 hover:bg-dobby-700 text-white font-medium px-5 py-2.5 rounded-xl shadow-sm transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          Añadir anuncio
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        <KpiCard
          label="Activos"
          value={String(kpis.activeCount)}
          subtitle="campañas activas"
          icon={<IconMegaphone className="w-5 h-5" />}
          iconBg="bg-blue-100 text-blue-600"
        />
        <KpiCard
          label="Clicks"
          value={formatNumber(kpis.totalClicks)}
          subtitle="total acumulado"
          icon={<IconCursor className="w-5 h-5" />}
          iconBg="bg-sky-100 text-sky-600"
        />
        <KpiCard
          label="Ingresos"
          value={formatMoney(kpis.totalRevenue)}
          subtitle="total acumulado"
          icon={<IconDollar className="w-5 h-5" />}
          iconBg="bg-emerald-100 text-emerald-600"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="relative flex-1 min-w-0">
            <IconSearch className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar anuncio..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-dobby-500/30 focus:border-dobby-500"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === tab.id
                    ? "bg-dobby-600 text-white shadow-sm"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-dobby-500/30 shrink-0"
          >
            <option value="recent">Más recientes</option>
            <option value="oldest">Más antiguos</option>
            <option value="clicks">Más clicks</option>
            <option value="priority">Mayor prioridad</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-500">
          Cargando anuncios…
        </div>
      ) : filteredAds.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-gray-500">No hay anuncios que coincidan con tu búsqueda.</p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-4 text-dobby-600 hover:text-dobby-700 text-sm font-medium"
          >
            Crear el primer anuncio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {pageAds.map((ad) => {
            const displayStatus = getDisplayStatus(ad);
            const badge = STATUS_BADGE[displayStatus];
            const action = primaryActionLabel(ad);
            return (
              <article
                key={ad.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
              >
                <div className="relative h-44 bg-gray-100">
                  {ad.imageUrl ? (
                    <img
                      src={uploadsUrl(ad.imageUrl)}
                      alt={ad.advertiserName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                      Sin imagen
                    </div>
                  )}
                  <span
                    className={`absolute top-3 right-3 px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {ad.logoUrl ? (
                        <img src={uploadsUrl(ad.logoUrl)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-dobby-600">
                          {ad.advertiserName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{ad.advertiserName}</h3>
                      <p className="text-sm text-gray-500 line-clamp-2 mt-0.5">
                        {ad.description || "Sin descripción"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-3 border-y border-gray-100 mb-4">
                    <AdMetric
                      icon={<IconCursor className="w-3.5 h-3.5" />}
                      value={formatNumber(ad.clicksCount)}
                      label="Clicks"
                    />
                    <AdMetric
                      icon={<IconCalendar className="w-3.5 h-3.5" />}
                      value={formatPeriod(ad.startDate, ad.endDate)}
                      label="Periodo"
                    />
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setStatsAd(ad)}
                      className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-dobby-600 transition-colors"
                    >
                      <IconChart className="w-4 h-4" />
                      Ver estadísticas
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(ad)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <IconPencil className="w-4 h-4" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrimaryAction(ad)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {action.icon}
                        {action.label}
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId((id) => (id === ad.id ? null : ad.id));
                          }}
                          className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                          aria-label="Más opciones"
                        >
                          ⋮
                        </button>
                        {openMenuId === ad.id ? (
                          <div
                            className="absolute right-0 bottom-full mb-1 w-40 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-10"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => openEdit(ad)}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(ad.id)}
                              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              Eliminar
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading && filteredAds.length > 0 ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6">
          <p className="text-sm text-gray-500">
            Mostrando {rangeFrom} a {rangeTo} de {filteredAds.length} anuncios
          </p>
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="w-9 h-9 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`w-9 h-9 rounded-lg text-sm font-medium ${
                  n === currentPage
                    ? "bg-dobby-600 text-white shadow-sm"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="w-9 h-9 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
            >
              ›
            </button>
          </div>
        </div>
      ) : null}

      {statsAd ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Estadísticas</h2>
            <p className="text-sm text-gray-500 mb-5">{statsAd.advertiserName}</p>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-gray-50 rounded-xl p-3">
                <dt className="text-gray-500">Clicks</dt>
                <dd className="text-xl font-bold tabular-nums">{formatNumber(statsAd.clicksCount)}</dd>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <dt className="text-gray-500">Conversiones</dt>
                <dd className="text-xl font-bold tabular-nums">{formatNumber(statsAd.conversionsCount)}</dd>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                <dt className="text-gray-500">Ingreso pagado</dt>
                <dd className="text-xl font-bold tabular-nums">{formatMoney(parseAmount(statsAd.amountPaid))}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => setStatsAd(null)}
              className="mt-6 w-full py-2.5 rounded-xl bg-dobby-600 text-white font-medium hover:bg-dobby-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}

      {modal !== "closed" ? (
        <AdFormModal
          mode={modal}
          editId={editId}
          initialValues={formInitialValues}
          onClose={closeModal}
          onSaved={() => {
            closeModal();
            load();
          }}
          onDelete={(id) => handleDelete(id)}
        />
      ) : null}
    </div>
  );
}
