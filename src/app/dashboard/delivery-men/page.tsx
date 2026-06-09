"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API, authHeaders, authHeadersForUpload, getToken, apiPath, uploadsUrl } from "@/lib/api";

const DriverLiveMap = dynamic(
  () => import("@/components/DriverLiveMap").then((m) => m.DriverLiveMap),
  { ssr: false, loading: () => <div className="h-[280px] bg-gray-100 animate-pulse rounded-lg border border-gray-200" /> }
);

const LOCATION_POLL_MS = 5000;

type DeliveryStatus = "OFFLINE" | "ONLINE" | "ON_DELIVERY";

type DeliveryMan = {
  id: string;
  name: string;
  profilePhotoUrl: string | null;
  address: string | null;
  celphone: string | null;
  idImageFrontUrl: string | null;
  idImageBackUrl: string | null;
  referenceName: string | null;
  referencePhone: string | null;
  referenceAddress: string | null;
  status: string;
  lastSeenAt: string | null;
  createdAt: string;
  totalDeliveries: number;
  rating: number | null;
  ratingCount: number;
  deliverySuccessRate: number | null;
  user: { id: string; email: string };
};

const PAGE_SIZE = 16;

type DriverLocation = {
  id: string;
  name: string;
  status: string;
  lat: number | null;
  lng: number | null;
  lastSeenAt: string | null;
};

/** Ubicación visible si el repartidor está conectado (en línea o en reparto). */
function canViewLocation(status: string) {
  return status === "ONLINE" || status === "ON_DELIVERY";
}

const defaultForm = {
  name: "",
  profilePhotoUrl: "",
  address: "",
  celphone: "",
  email: "",
  password: "",
  idImageFrontUrl: "",
  idImageBackUrl: "",
  referenceName: "",
  referencePhone: "",
  referenceAddress: "",
  status: "OFFLINE" as DeliveryStatus,
};

const STATUS_LABELS: Record<string, string> = {
  OFFLINE: "Desconectado",
  ONLINE: "En línea",
  ON_DELIVERY: "En reparto",
};

const STATUS_BADGE: Record<string, string> = {
  OFFLINE: "bg-gray-800/75 text-white",
  ONLINE: "bg-emerald-500/95 text-white",
  ON_DELIVERY: "bg-amber-500/95 text-white",
};

function StarIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

export default function DeliveryMenPage() {
  const [list, setList] = useState<DeliveryMan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"closed" | "create" | "edit">("closed");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "deliveries" | "rating">("recent");
  const [page, setPage] = useState(1);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [locationTarget, setLocationTarget] = useState<DeliveryMan | null>(null);
  const [locationData, setLocationData] = useState<DriverLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [profilePhotoUploading, setProfilePhotoUploading] = useState(false);
  const [idFrontUploading, setIdFrontUploading] = useState(false);
  const [idBackUploading, setIdBackUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const profilePhotoRef = useRef<HTMLInputElement>(null);
  const idFrontRef = useRef<HTMLInputElement>(null);
  const idBackRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function load() {
    setLoading(true);
    fetch(apiPath("/api/delivery-men"), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => load(), []);

  const fetchLocation = useCallback(async (id: string) => {
    const r = await fetch(apiPath(`/api/delivery-men/${id}/location`), { headers: authHeaders() });
    const data = await r.json().catch(() => null);
    if (!r.ok) {
      throw new Error(typeof data?.error === "string" ? data.error : "No se pudo cargar la ubicación");
    }
    return data as DriverLocation;
  }, []);

  useEffect(() => {
    if (!locationTarget) {
      setLocationData(null);
      setLocationError(null);
      setLocationLoading(false);
      return;
    }

    let cancelled = false;
    setLocationData(null);
    setLocationError(null);
    setLocationLoading(true);

    fetchLocation(locationTarget.id)
      .then((data) => {
        if (!cancelled) setLocationData(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setLocationError(e instanceof Error ? e.message : "Error");
        }
      })
      .finally(() => {
        if (!cancelled) setLocationLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [locationTarget, fetchLocation]);

  useEffect(() => {
    if (!locationTarget) return;
    const id = locationTarget.id;
    const interval = setInterval(() => {
      fetchLocation(id)
        .then((data) => setLocationData(data))
        .catch(() => {});
    }, LOCATION_POLL_MS);
    return () => clearInterval(interval);
  }, [locationTarget, fetchLocation]);

  useEffect(() => {
    if (!locationTarget) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLocationTarget(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locationTarget]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortBy]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    let items = [...list];
    const q = search.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.user?.email?.toLowerCase().includes(q) ||
          d.celphone?.toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      items = items.filter((d) => d.status === statusFilter);
    }
    items.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name, "es");
      if (sortBy === "deliveries") return b.totalDeliveries - a.totalDeliveries;
      if (sortBy === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return items;
  }, [list, search, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);

  function validateDeliveryForm(isCreate: boolean): string | null {
    const name = form.name.trim();
    if (!name) return "El nombre es obligatorio.";
    if (isCreate) {
      const email = form.email.trim();
      if (!email) return "El correo es obligatorio.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return "Ingresa un correo válido (ej. repartidor@ejemplo.com).";
      }
      if (!form.password) return "La contraseña inicial es obligatoria.";
      if (form.password.length < 6) {
        return "La contraseña debe tener al menos 6 caracteres.";
      }
    }
    const celphone = form.celphone.trim();
    if (isCreate && !celphone) {
      return "El celular es obligatorio: el repartidor inicia sesión en la app con OTP por SMS.";
    }
    if (profilePhotoUploading || idFrontUploading || idBackUploading) {
      return "Espera a que terminen de subirse las imágenes antes de guardar.";
    }
    return null;
  }

  function openEdit(d: DeliveryMan) {
    setFormError(null);
    setSuccessMessage(null);
    setEditId(d.id);
    setForm({
      name: d.name || "",
      profilePhotoUrl: d.profilePhotoUrl || "",
      address: d.address || "",
      celphone: d.celphone || "",
      email: d.user?.email || "",
      password: "",
      idImageFrontUrl: d.idImageFrontUrl || "",
      idImageBackUrl: d.idImageBackUrl || "",
      referenceName: d.referenceName || "",
      referencePhone: d.referencePhone || "",
      referenceAddress: d.referenceAddress || "",
      status:
        d.status === "ONLINE" || d.status === "ON_DELIVERY" ? d.status : "OFFLINE",
    });
    setModal("edit");
    setMenuOpenId(null);
  }

  function openCreate() {
    setFormError(null);
    setSuccessMessage(null);
    setModal("create");
    setEditId(null);
    setForm({ ...defaultForm, status: "OFFLINE" });
  }

  function openLocation(d: DeliveryMan) {
    if (!canViewLocation(d.status)) return;
    setLocationTarget(d);
    setMenuOpenId(null);
  }

  function formatSeen(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-MX", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!getToken()) {
      setFormError("Sesión expirada. Cierra sesión e inicia de nuevo.");
      return;
    }
    if (!API && typeof window !== "undefined") {
      setFormError(
        "El panel no tiene configurada NEXT_PUBLIC_API_URL. En Render, añádela al frontend y vuelve a desplegar."
      );
      return;
    }

    const validationError = validateDeliveryForm(!editId);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        const res = await fetch(apiPath(`/api/delivery-men/${editId}`), {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({
            name: form.name.trim(),
            profilePhotoUrl: form.profilePhotoUrl || null,
            address: form.address || undefined,
            celphone: form.celphone || undefined,
            idImageFrontUrl: form.idImageFrontUrl || null,
            idImageBackUrl: form.idImageBackUrl || null,
            referenceName: form.referenceName || undefined,
            referencePhone: form.referencePhone || undefined,
            referenceAddress: form.referenceAddress || undefined,
            status: form.status,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFormError(typeof data?.error === "string" ? data.error : "Error al guardar");
          return;
        }
        setSuccessMessage("Repartidor actualizado.");
      } else {
        const res = await fetch(apiPath("/api/delivery-men"), {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            email: form.email.trim(),
            password: form.password,
            name: form.name.trim(),
            profilePhotoUrl: form.profilePhotoUrl || undefined,
            address: form.address || undefined,
            celphone: form.celphone.trim(),
            idImageFrontUrl: form.idImageFrontUrl || undefined,
            idImageBackUrl: form.idImageBackUrl || undefined,
            referenceName: form.referenceName || undefined,
            referencePhone: form.referencePhone || undefined,
            referenceAddress: form.referenceAddress || undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFormError(typeof data?.error === "string" ? data.error : "Error al crear repartidor");
          return;
        }
        setSuccessMessage("Repartidor creado correctamente.");
      }
      setModal("closed");
      setEditId(null);
      setForm(defaultForm);
      load();
    } catch {
      setFormError(
        "No se pudo conectar con el servidor. Revisa NEXT_PUBLIC_API_URL y CORS_ORIGINS en Render."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleProfilePhotoUpload(file: File) {
    if (!file?.type.startsWith("image/")) {
      alert("Solo se permiten imágenes (JPEG, PNG, GIF, WebP).");
      return;
    }
    const token = getToken();
    if (!token) {
      alert("Sesión expirada. Vuelve a iniciar sesión.");
      return;
    }
    setProfilePhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("token", token);
      const res = await fetch(apiPath("/api/upload/delivery-profile"), {
        method: "POST",
        headers: { ...authHeadersForUpload(), "X-Auth-Token": token },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Error al subir la imagen");
        return;
      }
      setForm((f) => ({ ...f, profilePhotoUrl: data.url }));
    } catch {
      alert("Error al subir la imagen");
    } finally {
      setProfilePhotoUploading(false);
      if (profilePhotoRef.current) profilePhotoRef.current.value = "";
    }
  }

  async function handleIdUpload(side: "front" | "back", file: File) {
    if (!file?.type.startsWith("image/")) {
      alert("Solo se permiten imágenes (JPEG, PNG, GIF, WebP).");
      return;
    }
    const token = getToken();
    if (!token) {
      alert("Sesión expirada. Vuelve a iniciar sesión.");
      return;
    }
    if (side === "front") setIdFrontUploading(true);
    else setIdBackUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("token", token);
      formData.append("side", side);
      const res = await fetch(apiPath("/api/upload/delivery-id"), {
        method: "POST",
        headers: { ...authHeadersForUpload(), "X-Auth-Token": token },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Error al subir la imagen");
        return;
      }
      setForm((f) =>
        side === "front" ? { ...f, idImageFrontUrl: data.url } : { ...f, idImageBackUrl: data.url }
      );
    } catch {
      alert("Error al subir la imagen");
    } finally {
      if (side === "front") setIdFrontUploading(false);
      else setIdBackUploading(false);
      if (side === "front" && idFrontRef.current) idFrontRef.current.value = "";
      if (side === "back" && idBackRef.current) idBackRef.current.value = "";
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Repartidores</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            Lista de personal de reparto. Usa el menú ⋮ para editar. Ver ubicación cuando esté en línea.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 shrink-0 bg-dobby-600 hover:bg-dobby-700 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          Añadir repartidor
        </button>
      </div>

      {successMessage && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      )}

      <div className="mt-6 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1 max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar repartidor..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dobby-500/30 focus:border-dobby-400"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <span className="whitespace-nowrap">Estado:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="dashboard-filter-select bg-white border border-gray-200 rounded-lg pl-3 py-2.5 text-sm min-w-[120px] focus:outline-none focus:ring-2 focus:ring-dobby-500/30"
            >
              <option value="">Todos</option>
              <option value="ONLINE">En línea</option>
              <option value="OFFLINE">Desconectado</option>
              <option value="ON_DELIVERY">En reparto</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <span className="whitespace-nowrap">Ordenar por:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="dashboard-filter-select bg-white border border-gray-200 rounded-lg pl-3 py-2.5 text-sm min-w-[150px] focus:outline-none focus:ring-2 focus:ring-dobby-500/30"
            >
              <option value="recent">Más recientes</option>
              <option value="name">Nombre</option>
              <option value="deliveries">Más pedidos</option>
              <option value="rating">Mejor calificación</option>
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 mt-10">Cargando repartidores…</p>
      ) : filtered.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500 text-sm">
            {list.length === 0
              ? 'Aún no hay repartidores. Usa "Añadir repartidor" para registrar uno.'
              : "No hay repartidores que coincidan con tu búsqueda."}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pageItems.map((d) => {
              const locationEnabled = canViewLocation(d.status);
              return (
              <article
                key={d.id}
                className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow w-full min-w-[280px] max-w-[340px] mx-auto"
              >
                <div className="relative h-[7.5rem] bg-gray-100">
                  {d.profilePhotoUrl ? (
                    <img
                      src={uploadsUrl(d.profilePhotoUrl)}
                      alt={d.name}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-[11px]">
                      Sin foto
                    </div>
                  )}
                  <span
                    className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-semibold backdrop-blur-sm ${
                      STATUS_BADGE[d.status] ?? STATUS_BADGE.OFFLINE
                    }`}
                  >
                    {STATUS_LABELS[d.status] ?? d.status}
                  </span>
                  <div className="absolute top-2 right-2" ref={menuOpenId === d.id ? menuRef : undefined}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === d.id ? null : d.id);
                      }}
                      className="w-7 h-7 rounded-full bg-white/90 shadow border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-white"
                      aria-label="Opciones"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zm0 4a2 2 0 110-4 2 2 0 010 4zm0 4a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                    {menuOpenId === d.id ? (
                      <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-10">
                        <button
                          type="button"
                          onClick={() => openEdit(d)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Editar
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="px-3 pt-2.5 pb-2">
                  <h2 className="text-sm font-semibold text-gray-900 truncate" title={d.name}>
                    {d.name || "—"}
                  </h2>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5" title={d.user?.email}>
                    {d.user?.email ?? "—"}
                  </p>
                </div>

                <div className="grid grid-cols-3 border-t border-gray-100 mx-4 py-2.5 gap-2 text-center">
                  <div className="min-w-0 px-0.5">
                    <p className="text-[10px] uppercase text-gray-400 font-medium leading-tight">Pedidos</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">{d.totalDeliveries}</p>
                  </div>
                  <div className="min-w-0 px-0.5">
                    <p className="text-[10px] uppercase text-gray-400 font-medium leading-tight">Calificación</p>
                    <p className="text-sm font-bold text-gray-900 mt-1 flex items-center justify-center gap-0.5">
                      {d.rating != null ? (
                        <>
                          <StarIcon className="w-3 h-3 text-amber-400 shrink-0" />
                          {d.rating.toFixed(1)}
                        </>
                      ) : (
                        "—"
                      )}
                    </p>
                  </div>
                  <div className="min-w-0 px-0.5">
                    <p className="text-[10px] uppercase text-gray-400 font-medium leading-tight">Entregas</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      {d.deliverySuccessRate != null ? `${d.deliverySuccessRate}%` : "—"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!locationEnabled}
                  onClick={() => openLocation(d)}
                  title={
                    locationEnabled
                      ? "Ver ubicación en tiempo real"
                      : "Disponible cuando el repartidor está en línea o en reparto"
                  }
                  className={`w-full flex items-center justify-center gap-1 py-2 text-xs font-medium border-t border-gray-100 transition-colors ${
                    locationEnabled
                      ? "text-dobby-600 hover:bg-dobby-50"
                      : "text-gray-400 cursor-not-allowed bg-gray-50/80"
                  }`}
                >
                  Ver ubicación
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </article>
            );
            })}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              Mostrando {rangeStart} a {rangeEnd} de {filtered.length} repartidor
              {filtered.length !== 1 ? "es" : ""}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
                aria-label="Página anterior"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => totalPages <= 7 || Math.abs(n - currentPage) <= 2 || n === 1 || n === totalPages)
                .map((n, idx, arr) => {
                  const prev = arr[idx - 1];
                  const showEllipsis = prev != null && n - prev > 1;
                  return (
                    <span key={n} className="flex items-center">
                      {showEllipsis ? <span className="px-1 text-gray-400">…</span> : null}
                      <button
                        type="button"
                        onClick={() => setPage(n)}
                        className={`min-w-[36px] h-9 px-2 rounded-lg text-sm font-medium ${
                          n === currentPage
                            ? "bg-dobby-600 text-white"
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
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
                aria-label="Página siguiente"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}

      {locationTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="location-modal-title"
          onClick={() => setLocationTarget(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-100 bg-white">
              <h2 id="location-modal-title" className="text-lg font-semibold text-gray-900">
                Ubicación en vivo
              </h2>
              <button
                type="button"
                onClick={() => setLocationTarget(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                Cerrar
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="font-medium text-gray-900">{locationTarget.name}</p>
                <p className="text-sm text-gray-500">{locationTarget.user?.email}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Última señal: {formatSeen(locationData?.lastSeenAt ?? null)}
                  {!locationLoading ? " · actualización cada ~5 s" : ""}
                </p>
              </div>
              {locationLoading && !locationData ? (
                <p className="text-sm text-gray-500">Cargando mapa…</p>
              ) : null}
              {locationError ? <p className="text-sm text-red-600">{locationError}</p> : null}
              {locationData &&
              locationData.lat != null &&
              locationData.lng != null &&
              Number.isFinite(locationData.lat) &&
              Number.isFinite(locationData.lng) ? (
                <DriverLiveMap
                  lat={locationData.lat}
                  lng={locationData.lng}
                  driverName={locationData.name || locationTarget.name}
                  fitKey={locationData.id}
                />
              ) : locationData && !locationLoading ? (
                <div className="h-[280px] flex items-center justify-center bg-gray-100 text-gray-600 text-sm px-4 text-center rounded-lg border border-gray-200">
                  El repartidor está en línea pero aún no ha enviado su ubicación GPS.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {(modal === "create" || modal === "edit") && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {modal === "create" ? "Nuevo repartidor" : "Editar repartidor"}
            </h2>
            <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {formError && (
                <div className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Foto de perfil</label>
                <input
                  ref={profilePhotoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={(e) => e.target.files?.[0] && handleProfilePhotoUpload(e.target.files[0])}
                  disabled={profilePhotoUploading}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-dobby-50 file:text-dobby-700"
                />
                {profilePhotoUploading && <p className="mt-1 text-xs text-gray-500">Subiendo…</p>}
                {form.profilePhotoUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={uploadsUrl(form.profilePhotoUrl)}
                      alt="Foto de perfil"
                      className="w-16 h-16 rounded-full object-cover border bg-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, profilePhotoUrl: "" }))}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Nombre</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-dobby-500/30 focus:border-dobby-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Celular {modal === "create" ? <span className="text-red-600">*</span> : null}
                </label>
                <input
                  type="tel"
                  value={form.celphone}
                  onChange={(e) => setForm((f) => ({ ...f, celphone: e.target.value }))}
                  placeholder="ej. +52 55 1234 5678"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-dobby-500/30 outline-none"
                />
                {modal === "create" && (
                  <p className="text-xs text-gray-500 mt-1">
                    Obligatorio: la app repartidor inicia sesión con OTP a este número.
                  </p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600 mb-1">Dirección</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-dobby-500/30 outline-none"
                />
              </div>
              {modal === "create" ? (
                <>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Correo</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-dobby-500/30 outline-none"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Contraseña inicial</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-dobby-500/30 outline-none"
                      autoComplete="new-password"
                    />
                    <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres.</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Correo</label>
                    <input
                      type="email"
                      value={form.email}
                      readOnly
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-600"
                    />
                    <p className="text-xs text-gray-500 mt-0.5">El correo no se puede cambiar.</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Estado</label>
                    <select
                      value={form.status}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, status: e.target.value as DeliveryStatus }))
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-dobby-500/30 outline-none"
                    >
                      <option value="OFFLINE">Desconectado</option>
                      <option value="ONLINE">En línea</option>
                      <option value="ON_DELIVERY">En reparto</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm text-gray-600 mb-1">Identificación (anverso)</label>
                <input
                  ref={idFrontRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={(e) => e.target.files?.[0] && handleIdUpload("front", e.target.files[0])}
                  disabled={idFrontUploading}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-dobby-50 file:text-dobby-700"
                />
                {idFrontUploading && <p className="mt-1 text-xs text-gray-500">Subiendo…</p>}
                {form.idImageFrontUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={uploadsUrl(form.idImageFrontUrl)}
                      alt="ID anverso"
                      className="w-20 h-14 rounded object-cover border bg-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, idImageFrontUrl: "" }))}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Identificación (reverso)</label>
                <input
                  ref={idBackRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={(e) => e.target.files?.[0] && handleIdUpload("back", e.target.files[0])}
                  disabled={idBackUploading}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-dobby-50 file:text-dobby-700"
                />
                {idBackUploading && <p className="mt-1 text-xs text-gray-500">Subiendo…</p>}
                {form.idImageBackUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={uploadsUrl(form.idImageBackUrl)}
                      alt="ID reverso"
                      className="w-20 h-14 rounded object-cover border bg-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, idImageBackUrl: "" }))}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                )}
              </div>

              <div className="sm:col-span-2 border-t border-gray-100 pt-3 mt-1">
                <p className="text-sm font-medium text-gray-700 mb-2">Referencia</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Nombre</label>
                    <input
                      value={form.referenceName}
                      onChange={(e) => setForm((f) => ({ ...f, referenceName: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-dobby-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Teléfono</label>
                    <input
                      type="tel"
                      value={form.referencePhone}
                      onChange={(e) => setForm((f) => ({ ...f, referencePhone: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-dobby-500/30"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-600 mb-1">Dirección</label>
                    <input
                      value={form.referenceAddress}
                      onChange={(e) => setForm((f) => ({ ...f, referenceAddress: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-dobby-500/30"
                    />
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2 flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-dobby-600 hover:bg-dobby-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-medium transition-colors"
                >
                  {saving
                    ? "Guardando…"
                    : modal === "create"
                      ? "Crear repartidor"
                      : "Guardar"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setModal("closed");
                    setEditId(null);
                    setForm(defaultForm);
                    setFormError(null);
                  }}
                  className="border border-gray-200 px-5 py-2 rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
