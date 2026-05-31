"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authHeaders, authHeadersForUpload, getToken, apiPath, uploadsUrl } from "@/lib/api";

const PAGE_SIZE = 16;

const categoryLabels: Record<string, string> = {
  LIGHT: "Luz",
  GAS: "Gas",
  PHONE: "Teléfono",
  WATER: "Agua",
  OTHER: "Otro",
};

const CATEGORY_HEADER_BG: Record<string, string> = {
  LIGHT: "bg-emerald-700",
  GAS: "bg-orange-600",
  PHONE: "bg-sky-700",
  WATER: "bg-cyan-700",
  OTHER: "bg-gray-900",
};

type SortKey = "recent" | "name" | "transactions" | "revenue";

type Service = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  logoUrl: string | null;
  isActive: boolean;
  openingHour?: string | null;
  closingHour?: string | null;
  opening_hour?: string | null;
  closing_hour?: string | null;
  createdAt?: string;
  transactionCount?: number;
  totalRevenue?: number;
  commissionEarned?: number;
  commissionRatePercent?: number;
};

function serviceHours(s: Service): { open: string; close: string } | null {
  const open = s.openingHour ?? s.opening_hour ?? null;
  const close = s.closingHour ?? s.closing_hour ?? null;
  if (!open || !close) return null;
  return { open, close };
}

const emptyForm = () => ({
  name: "",
  description: "",
  category: "OTHER",
  logoUrl: "",
  isActive: true,
  openingHour: "",
  closingHour: "",
});

function formatMoney(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function IconChevron({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function IconDots({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 8a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4zm0 6a2 2 0 110-4 2 2 0 010 4z" />
    </svg>
  );
}

function ServiceCard({
  service,
  menuOpen,
  onToggleMenu,
  onEdit,
  onDelete,
  onToggleActive,
  togglingActive,
}: {
  service: Service;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (active: boolean) => void;
  togglingActive: boolean;
}) {
  const headerBg = CATEGORY_HEADER_BG[service.category] ?? CATEGORY_HEADER_BG.OTHER;
  const hours = serviceHours(service);
  const commissionPct = service.commissionRatePercent ?? 2.5;

  return (
    <article className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow w-full min-w-[280px] max-w-[340px] mx-auto flex flex-col">
      <div className={`relative h-[7.5rem] ${headerBg}`}>
        <div className="absolute inset-0 flex items-center justify-center p-4">
          {service.logoUrl ? (
            <img
              src={uploadsUrl(service.logoUrl)}
              alt=""
              className="max-h-full max-w-[70%] object-contain drop-shadow-sm"
            />
          ) : (
            <span className="text-2xl font-bold text-white/90">
              {service.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <span
          className={`absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold backdrop-blur-sm ${
            service.isActive
              ? "bg-white/95 text-emerald-700 ring-1 ring-emerald-200/80"
              : "bg-white/95 text-gray-600 ring-1 ring-gray-200/80"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              service.isActive ? "bg-emerald-500" : "bg-gray-400"
            }`}
          />
          {service.isActive ? "Activo" : "Inactivo"}
        </span>
        <div className="absolute top-2 right-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu();
            }}
            className="w-7 h-7 rounded-full bg-white/90 shadow border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-white"
            aria-label="Opciones"
          >
            <IconDots className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={onToggleMenu} aria-hidden />
              <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20">
                <button
                  type="button"
                  onClick={() => {
                    onToggleMenu();
                    onEdit();
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onToggleMenu();
                    onDelete();
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Eliminar
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="px-3 pt-2.5 pb-2 flex-1">
        <h2 className="text-sm font-semibold text-gray-900 truncate" title={service.name}>
          {service.name}
        </h2>
        <p className="text-[11px] font-medium text-violet-600 mt-0.5">
          {categoryLabels[service.category] ?? service.category}
        </p>
        {service.description ? (
          <p className="text-[11px] text-gray-500 mt-1.5 line-clamp-2 leading-snug">
            {service.description}
          </p>
        ) : (
          <p className="text-[11px] text-gray-400 mt-1.5 italic">Sin descripción</p>
        )}
        {hours ? (
          <p className="text-[10px] text-gray-400 mt-1 tabular-nums">
            {hours.open} – {hours.close}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-3 border-t border-gray-100 mx-3 py-2.5 gap-1 text-center">
        <div className="min-w-0 px-0.5">
          <p className="text-[10px] uppercase text-gray-400 font-medium leading-tight">
            Transacciones
          </p>
          <p className="text-sm font-bold text-gray-900 mt-1 tabular-nums">
            {service.transactionCount ?? 0}
          </p>
        </div>
        <div className="min-w-0 px-0.5">
          <p className="text-[10px] uppercase text-gray-400 font-medium leading-tight">
            Ingresos generados
          </p>
          <p className="text-[10px] font-bold text-gray-900 mt-1 tabular-nums leading-tight">
            {formatMoney(service.totalRevenue ?? 0)}
          </p>
        </div>
        <div className="min-w-0 px-0.5">
          <p className="text-[10px] uppercase text-gray-400 font-medium leading-tight">
            Comisión
          </p>
          <p className="text-sm font-bold text-gray-900 mt-1 tabular-nums">{commissionPct}%</p>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-100">
        <button
          type="button"
          role="switch"
          aria-checked={service.isActive}
          disabled={togglingActive}
          onClick={() => onToggleActive(!service.isActive)}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-50 ${
            service.isActive ? "bg-violet-600" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
              service.isActive ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
        <span className="text-xs text-gray-600">Activo</span>
      </div>
    </article>
  );
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [modal, setModal] = useState<"closed" | "create" | "edit">("closed");
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter === "active") params.set("isActive", "true");
    if (statusFilter === "inactive") params.set("isActive", "false");
    const q = params.toString() ? `?${params}` : "";
    fetch(apiPath(`/api/services${q}`), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setServices(Array.isArray(data) ? data : []))
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, sortBy]);

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = [...services];
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.description ?? "").toLowerCase().includes(q) ||
          (categoryLabels[s.category] ?? "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name, "es");
        case "transactions":
          return (b.transactionCount ?? 0) - (a.transactionCount ?? 0);
        case "revenue":
          return (b.totalRevenue ?? 0) - (a.totalRevenue ?? 0);
        case "recent":
        default: {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        }
      }
    });
    return list;
  }, [services, searchQuery, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredServices.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageServices = filteredServices.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );
  const rangeStart = filteredServices.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filteredServices.length);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.openingHour.trim() || !form.closingHour.trim()) {
      alert("Indica hora de apertura y hora de cierre.");
      return;
    }
    const url = editId ? `/api/services/${editId}` : "/api/services";
    const method = editId ? "PUT" : "POST";
    const body = {
      name: form.name,
      description: form.description || null,
      category: form.category,
      logoUrl: form.logoUrl || null,
      isActive: form.isActive,
      opening_hour: form.openingHour.trim(),
      closing_hour: form.closingHour.trim(),
    };
    const res = await fetch(apiPath(url), {
      method,
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setModal("closed");
      setEditId(null);
      setForm(emptyForm());
      load();
    } else {
      alert(typeof data?.error === "string" ? data.error : "No se pudo guardar el servicio");
    }
  }

  function openCreate() {
    setModal("create");
    setEditId(null);
    setForm(emptyForm());
  }

  function openEdit(s: Service) {
    const hours = serviceHours(s);
    setEditId(s.id);
    setForm({
      name: s.name,
      description: s.description || "",
      category: s.category,
      logoUrl: s.logoUrl || "",
      isActive: s.isActive,
      openingHour: hours?.open ?? "",
      closingHour: hours?.close ?? "",
    });
    setModal("edit");
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este servicio?")) return;
    const res = await fetch(apiPath(`/api/services/${id}`), {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) load();
  }

  async function handleToggleActive(service: Service, active: boolean) {
    setTogglingId(service.id);
    try {
      const hours = serviceHours(service);
      const res = await fetch(apiPath(`/api/services/${service.id}`), {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          isActive: active,
          ...(hours
            ? { opening_hour: hours.open, closing_hour: hours.close }
            : {}),
        }),
      });
      if (res.ok) {
        setServices((prev) =>
          prev.map((s) => (s.id === service.id ? { ...s, isActive: active } : s))
        );
      } else {
        const data = await res.json().catch(() => ({}));
        alert(typeof data?.error === "string" ? data.error : "No se pudo actualizar");
        load();
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Solo se permiten imágenes (JPEG, PNG, GIF, WebP).");
      return;
    }
    setLogoUploading(true);
    try {
      const token = getToken();
      if (!token) {
        alert("Sesión expirada. Vuelve a iniciar sesión.");
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("token", token);
      const res = await fetch(apiPath("/api/upload/service-logo"), {
        method: "POST",
        headers: {
          ...authHeadersForUpload(),
          "X-Auth-Token": token,
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Error al subir la imagen");
        return;
      }
      setForm((f) => ({ ...f, logoUrl: data.url }));
    } catch {
      alert("Error al subir la imagen");
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Servicios</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Administra los servicios de pago y utilidades integradas en la plataforma.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 shrink-0"
        >
          <IconPlus className="w-4 h-4" />
          Añadir servicio
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar servicio…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="dashboard-filter-select pl-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm shadow-sm min-w-[160px] focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        >
          <option value="">Estado: Todos</option>
          <option value="active">Estado: Activos</option>
          <option value="inactive">Estado: Inactivos</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="dashboard-filter-select pl-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm shadow-sm min-w-[200px] focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        >
          <option value="recent">Ordenar por: Más recientes</option>
          <option value="name">Ordenar por: Nombre</option>
          <option value="transactions">Ordenar por: Más transacciones</option>
          <option value="revenue">Ordenar por: Mayor ingreso</option>
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500 py-16 text-center">Cargando servicios…</p>
      ) : filteredServices.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-gray-500">
            {services.length === 0
              ? "Aún no hay servicios registrados."
              : "No hay servicios que coincidan con tu búsqueda."}
          </p>
          {services.length === 0 && (
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 text-sm font-medium text-violet-600 hover:text-violet-800"
            >
              Añadir el primer servicio
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pageServices.map((s) => (
              <ServiceCard
                key={s.id}
                service={s}
                menuOpen={openMenuId === s.id}
                onToggleMenu={() =>
                  setOpenMenuId((id) => (id === s.id ? null : s.id))
                }
                onEdit={() => openEdit(s)}
                onDelete={() => handleDelete(s.id)}
                onToggleActive={(active) => handleToggleActive(s, active)}
                togglingActive={togglingId === s.id}
              />
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-8 pt-4 border-t border-gray-200/80">
            <p className="text-sm text-gray-500">
              Mostrando {rangeStart} a {rangeEnd} de {filteredServices.length} servicio
              {filteredServices.length !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="w-9 h-9 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 flex items-center justify-center"
                aria-label="Página anterior"
              >
                <IconChevron className="w-4 h-4 rotate-180" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => {
                  if (totalPages <= 7) return true;
                  if (n === 1 || n === totalPages) return true;
                  return Math.abs(n - safePage) <= 1;
                })
                .map((n, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev != null && n - prev > 1;
                  return (
                    <span key={n} className="flex items-center gap-1">
                      {showEllipsis && (
                        <span className="px-1 text-gray-400 text-sm">…</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setPage(n)}
                        className={`min-w-[2.25rem] h-9 px-2 rounded-lg text-sm font-medium ${
                          n === safePage
                            ? "bg-violet-600 text-white"
                            : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {n}
                      </button>
                    </span>
                  );
                })}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="w-9 h-9 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 flex items-center justify-center"
                aria-label="Página siguiente"
              >
                <IconChevron className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {modal !== "closed" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-30">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {modal === "create" ? "Nuevo servicio" : "Editar servicio"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Logo del servicio</label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleLogoChange}
                  disabled={logoUploading}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-violet-50 file:text-violet-700 file:text-sm file:font-medium"
                />
                {logoUploading && <p className="mt-1 text-xs text-gray-500">Subiendo…</p>}
                {form.logoUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <img
                      src={uploadsUrl(form.logoUrl)}
                      alt="Vista previa del logo"
                      className="w-16 h-16 rounded-lg object-contain border bg-gray-100 p-1"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, logoUrl: "" }))}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Quitar logo
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Nombre</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Categoría</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="LIGHT">Luz</option>
                  <option value="GAS">Gas</option>
                  <option value="PHONE">Teléfono</option>
                  <option value="WATER">Agua</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Describe el servicio para el panel y la app…"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Horario de atención <span className="text-red-600">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Apertura</label>
                    <input
                      type="time"
                      value={form.openingHour}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, openingHour: e.target.value }))
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Cierre</label>
                    <input
                      type="time"
                      value={form.closingHour}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, closingHour: e.target.value }))
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      required
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">
                  Activo
                </label>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700"
                >
                  {modal === "create" ? "Crear" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setModal("closed")}
                  className="flex-1 border border-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
                {modal === "edit" && editId && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("¿Eliminar este servicio?")) {
                        handleDelete(editId);
                        setModal("closed");
                        setEditId(null);
                      }
                    }}
                    className="w-full text-red-600 hover:underline text-sm py-1"
                  >
                    Eliminar servicio
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
