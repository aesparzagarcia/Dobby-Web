"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { authHeaders, authHeadersForUpload, getToken, apiPath, uploadsUrl } from "@/lib/api";

const ShopLocationPickerMap = dynamic(
  () => import("@/components/ShopLocationPickerMap").then((m) => m.ShopLocationPickerMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[200px] bg-gray-100 animate-pulse rounded-lg border border-gray-200" />
    ),
  }
);

type Shop = {
  id: string;
  name: string;
  type: string;
  address: string;
  phone: string | null;
  logoUrl: string | null;
  status: string;
  lat?: number | null;
  lng?: number | null;
  rate?: number;
  ratingCount?: number;
  createdAt?: string;
  orderCount?: number;
  totalRevenue?: number;
  openingHour?: string | null;
  closingHour?: string | null;
  opening_hour?: string | null;
  closing_hour?: string | null;
};

type SortKey = "recent" | "name" | "orders" | "revenue" | "rating";

const PAGE_SIZE = 16;

const TYPE_LABELS: Record<string, string> = {
  RESTAURANT: "Restaurante",
  SHOP: "Tienda",
  SERVICE_PROVIDER: "Servicios",
};

function shopHours(shop: Shop): { open: string; close: string } | null {
  const open = shop.openingHour ?? shop.opening_hour ?? null;
  const close = shop.closingHour ?? shop.closing_hour ?? null;
  if (!open || !close) return null;
  return { open, close };
}

function formatHoursRange(open: string, close: string) {
  return `${open} – ${close}`;
}

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

function IconLocation({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function IconStar({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden>
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
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

function ShopCard({
  shop,
  menuOpen,
  onToggleMenu,
  onEdit,
  onDelete,
  onToggleActive,
  togglingActive,
}: {
  shop: Shop;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (active: boolean) => void;
  togglingActive: boolean;
}) {
  const isActive = shop.status === "ACTIVE";
  const hours = shopHours(shop);
  const rating =
    shop.ratingCount && shop.ratingCount > 0 && shop.rate != null
      ? shop.rate.toFixed(1)
      : "—";

  return (
    <article className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow w-full min-w-[280px] max-w-[340px] mx-auto flex flex-col">
      <div className="relative h-[7.5rem] bg-gray-100">
        {shop.logoUrl ? (
          <img
            src={uploadsUrl(shop.logoUrl)}
            alt=""
            className="w-full h-full object-cover object-center"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-100 to-violet-50">
            <span className="text-2xl font-bold text-violet-300">
              {shop.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <span
          className={`absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold backdrop-blur-sm ${
            isActive
              ? "bg-white/95 text-emerald-700 ring-1 ring-emerald-200/80"
              : "bg-white/95 text-gray-600 ring-1 ring-gray-200/80"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-gray-400"}`}
          />
          {isActive ? "Activa" : "Inactiva"}
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

      <div className="px-3 pt-2.5 pb-2">
        <h2 className="text-sm font-semibold text-gray-900 truncate" title={shop.name}>
          {shop.name}
        </h2>
        <p className="text-[11px] text-gray-500 truncate mt-0.5">
          {TYPE_LABELS[shop.type] ?? shop.type}
        </p>
        <p
          className="flex items-center gap-1 text-[11px] text-gray-500 mt-1 truncate"
          title={shop.address}
        >
          <IconLocation className="w-3 h-3 text-violet-500 shrink-0" />
          <span className="truncate">{shop.address}</span>
        </p>
        {hours ? (
          <p className="text-[11px] text-gray-500 mt-0.5 tabular-nums">
            Horario: {formatHoursRange(hours.open, hours.close)}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-3 border-t border-gray-100 mx-4 py-2.5 gap-2 text-center">
        <div className="min-w-0 px-0.5">
          <p className="text-[10px] uppercase text-gray-400 font-medium leading-tight">Pedidos</p>
          <p className="text-sm font-bold text-gray-900 mt-1 tabular-nums">{shop.orderCount ?? 0}</p>
        </div>
        <div className="min-w-0 px-0.5">
          <p className="text-[10px] uppercase text-gray-400 font-medium leading-tight">
            Ingreso total
          </p>
          <p className="text-xs font-bold text-gray-900 mt-1 tabular-nums leading-tight">
            {formatMoney(shop.totalRevenue ?? 0)}
          </p>
        </div>
        <div className="min-w-0 px-0.5">
          <p className="text-[10px] uppercase text-gray-400 font-medium leading-tight">
            Calificación
          </p>
          <p className="text-sm font-bold text-gray-900 mt-1 flex items-center justify-center gap-0.5">
            {rating !== "—" ? (
              <>
                <IconStar className="w-3 h-3 text-amber-400 shrink-0" />
                {rating}
              </>
            ) : (
              "—"
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-100">
        <button
          type="button"
          role="switch"
          aria-checked={isActive}
          disabled={togglingActive}
          onClick={() => onToggleActive(!isActive)}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-50 ${
            isActive ? "bg-violet-600" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
              isActive ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
        <span className="text-xs text-gray-600">Activa</span>
      </div>
    </article>
  );
}

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [modal, setModal] = useState<"closed" | "create" | "edit">("closed");
  const [form, setForm] = useState({
    name: "",
    type: "SHOP",
    address: "",
    phone: "",
    logoUrl: "",
    status: "ACTIVE",
    lat: null as number | null,
    lng: null as number | null,
    openingHour: "",
    closingHour: "",
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const emptyForm = () => ({
    name: "",
    type: "SHOP",
    address: "",
    phone: "",
    logoUrl: "",
    status: "ACTIVE",
    lat: null as number | null,
    lng: null as number | null,
    openingHour: "",
    closingHour: "",
  });

  function load() {
    setLoading(true);
    const q = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
    fetch(apiPath(`/api/shops${q}`), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setShops(Array.isArray(data) ? data : []))
      .catch(() => setShops([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, sortBy]);

  const filteredShops = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = [...shops];
    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q) ||
          (TYPE_LABELS[s.type] ?? "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name, "es");
        case "orders":
          return (b.orderCount ?? 0) - (a.orderCount ?? 0);
        case "revenue":
          return (b.totalRevenue ?? 0) - (a.totalRevenue ?? 0);
        case "rating":
          return (b.rate ?? 0) - (a.rate ?? 0);
        case "recent":
        default: {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        }
      }
    });
    return list;
  }, [shops, searchQuery, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredShops.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageShops = filteredShops.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );
  const rangeStart = filteredShops.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filteredShops.length);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editId ? `/api/shops/${editId}` : "/api/shops";
    const method = editId ? "PUT" : "POST";
    const body = {
      name: form.name,
      type: form.type,
      address: form.address,
      phone: form.phone || null,
      logoUrl: form.logoUrl || null,
      status: form.status,
      lat: form.lat,
      lng: form.lng,
      opening_hour: form.openingHour.trim() || null,
      closing_hour: form.closingHour.trim() || null,
    };
    const res = await fetch(apiPath(url), {
      method,
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setModal("closed");
      setMapPickerOpen(false);
      setEditId(null);
      setForm(emptyForm());
      load();
    } else {
      alert(typeof data?.error === "string" ? data.error : "No se pudo guardar la tienda");
    }
  }

  function openCreate() {
    setModal("create");
    setEditId(null);
    setForm(emptyForm());
  }

  function openEdit(shop: Shop) {
    const hours = shopHours(shop);
    setEditId(shop.id);
    setForm({
      name: shop.name,
      type: shop.type,
      address: shop.address,
      phone: shop.phone || "",
      logoUrl: shop.logoUrl || "",
      status: shop.status,
      lat: shop.lat != null && Number.isFinite(Number(shop.lat)) ? Number(shop.lat) : null,
      lng: shop.lng != null && Number.isFinite(Number(shop.lng)) ? Number(shop.lng) : null,
      openingHour: hours?.open ?? "",
      closingHour: hours?.close ?? "",
    });
    setModal("edit");
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta tienda?")) return;
    const res = await fetch(apiPath(`/api/shops/${id}`), {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (res.ok) load();
  }

  async function handleToggleActive(shop: Shop, active: boolean) {
    setTogglingId(shop.id);
    const status = active ? "ACTIVE" : "INACTIVE";
    try {
      const res = await fetch(apiPath(`/api/shops/${shop.id}`), {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setShops((prev) =>
          prev.map((s) => (s.id === shop.id ? { ...s, status } : s))
        );
      } else {
        const data = await res.json().catch(() => ({}));
        alert(typeof data?.error === "string" ? data.error : "No se pudo actualizar el estado");
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
      const res = await fetch(apiPath("/api/upload/shop-logo"), {
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
          <h1 className="text-2xl font-bold text-gray-900">Tiendas</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Administra las tiendas y restaurantes registrados en la plataforma.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 shrink-0"
        >
          <IconPlus className="w-4 h-4" />
          Añadir tienda
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar tienda o restaurante…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="dashboard-filter-select pl-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm shadow-sm min-w-[160px] focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        >
          <option value="">Estado: Todos</option>
          <option value="ACTIVE">Estado: Activas</option>
          <option value="INACTIVE">Estado: Inactivas</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="dashboard-filter-select pl-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm shadow-sm min-w-[200px] focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        >
          <option value="recent">Ordenar por: Más recientes</option>
          <option value="name">Ordenar por: Nombre</option>
          <option value="orders">Ordenar por: Más pedidos</option>
          <option value="revenue">Ordenar por: Mayor ingreso</option>
          <option value="rating">Ordenar por: Mejor calificación</option>
        </select>
      </div>

      {loading ? (
        <p className="text-gray-500 py-16 text-center">Cargando tiendas…</p>
      ) : filteredShops.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-gray-500">
            {shops.length === 0
              ? "Aún no hay tiendas registradas."
              : "No hay tiendas que coincidan con tu búsqueda."}
          </p>
          {shops.length === 0 && (
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 text-sm font-medium text-violet-600 hover:text-violet-800"
            >
              Añadir la primera tienda
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pageShops.map((shop) => (
              <ShopCard
                key={shop.id}
                shop={shop}
                menuOpen={openMenuId === shop.id}
                onToggleMenu={() =>
                  setOpenMenuId((id) => (id === shop.id ? null : shop.id))
                }
                onEdit={() => openEdit(shop)}
                onDelete={() => handleDelete(shop.id)}
                onToggleActive={(active) => handleToggleActive(shop, active)}
                togglingActive={togglingId === shop.id}
              />
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-8 pt-4 border-t border-gray-200/80">
            <p className="text-sm text-gray-500">
              Mostrando {rangeStart} a {rangeEnd} de {filteredShops.length} tienda
              {filteredShops.length !== 1 ? "s" : ""}
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
              {modal === "create" ? "Nueva tienda" : "Editar tienda"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
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
                <label className="block text-sm text-gray-600 mb-1">Tipo</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="RESTAURANT">Restaurante</option>
                  <option value="SHOP">Tienda</option>
                  <option value="SERVICE_PROVIDER">Proveedor de servicios</option>
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-sm text-gray-600 m-0">Dirección</label>
                  <button
                    type="button"
                    onClick={() => setMapPickerOpen(true)}
                    className="text-sm font-medium text-violet-600 hover:text-violet-800"
                  >
                    Mapa
                  </button>
                </div>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Teléfono</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Horario de atención</label>
                <p className="text-xs text-gray-500 mb-2">
                  Opcional. Deja ambos vacíos si no aplica.
                </p>
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
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Logo de la tienda</label>
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
                      className="w-16 h-16 rounded-lg object-cover border bg-gray-100"
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
                <label className="block text-sm text-gray-600 mb-1">Estado</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700"
                >
                  {modal === "create" ? "Crear" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModal("closed");
                    setMapPickerOpen(false);
                  }}
                  className="flex-1 border border-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mapPickerOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-2">Ubicación en el mapa</h3>
            <ShopLocationPickerMap
              initialLat={form.lat}
              initialLng={form.lng}
              initialAddress={form.address}
              onClose={() => setMapPickerOpen(false)}
              onApply={(lat, lng, address) => {
                setForm((f) => ({ ...f, lat, lng, address }));
                setMapPickerOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
