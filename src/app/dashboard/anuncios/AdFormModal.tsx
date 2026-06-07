"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { authHeaders, authHeadersForUpload, getToken, apiPath, uploadsUrl } from "@/lib/api";

const ShopLocationPickerMap = dynamic(
  () => import("@/components/ShopLocationPickerMap").then((m) => m.ShopLocationPickerMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] bg-gray-100 animate-pulse rounded-lg border border-gray-200" />
    ),
  }
);

export type AdStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED" | "ARCHIVED";
export type AdPlacement = "HOME_CAROUSEL" | "HOME_BANNER" | "PROMOTIONS" | "CHECKOUT";
export type AdPaymentStatus = "PENDING" | "PAID" | "PARTIAL" | "REFUNDED" | "FAILED";
export type AdButtonAction = "NONE" | "OPEN_URL" | "CALL" | "WHATSAPP" | "OPEN_STORE" | "APPLY_COUPON";

export type AdFormValues = {
  imageUrl: string;
  logoUrl: string;
  advertiserName: string;
  category: string;
  description: string;
  address: string;
  lat: number | null;
  lng: number | null;
  contactPhone: string;
  whatsapp: string;
  facebookUrl: string;
  instagramUrl: string;
  websiteUrl: string;
  email: string;
  startDate: string;
  endDate: string;
  status: AdStatus;
  priority: number;
  planType: string;
  placement: AdPlacement;
  couponCode: string;
  discountPercent: string;
  buttonText: string;
  buttonAction: AdButtonAction;
  amountPaid: string;
  paymentStatus: AdPaymentStatus;
  isActive: boolean;
  linkedStoreId: string;
};

type ShopOption = { id: string; name: string };

export const defaultAdFormValues: AdFormValues = {
  imageUrl: "",
  logoUrl: "",
  advertiserName: "",
  category: "",
  description: "",
  address: "",
  lat: null,
  lng: null,
  contactPhone: "",
  whatsapp: "",
  facebookUrl: "",
  instagramUrl: "",
  websiteUrl: "",
  email: "",
  startDate: "",
  endDate: "",
  status: "ACTIVE",
  priority: 2,
  planType: "destacado",
  placement: "HOME_CAROUSEL",
  couponCode: "",
  discountPercent: "",
  buttonText: "",
  buttonAction: "OPEN_STORE",
  amountPaid: "",
  paymentStatus: "PENDING",
  isActive: true,
  linkedStoreId: "",
};

const CATEGORIES = [
  "Restaurantes",
  "Retail",
  "Servicios",
  "Salud y bienestar",
  "Entretenimiento",
  "Automotriz",
  "Hogar",
  "Otros",
];

const STATUS_OPTIONS: { value: AdStatus; label: string; dot: string }[] = [
  { value: "ACTIVE", label: "Activo", dot: "bg-emerald-500" },
  { value: "DRAFT", label: "Borrador", dot: "bg-gray-400" },
  { value: "PAUSED", label: "Pausado", dot: "bg-amber-500" },
  { value: "EXPIRED", label: "Expirado", dot: "bg-gray-600" },
  { value: "ARCHIVED", label: "Archivado", dot: "bg-gray-500" },
];

const PRIORITY_OPTIONS = [
  { value: 0, label: "0 - Normal" },
  { value: 1, label: "1 - Elevado" },
  { value: 2, label: "2 - Destacado" },
  { value: 3, label: "3 - Premium" },
];

const PLAN_OPTIONS = [
  { value: "basico", label: "Básico", priority: 0 },
  { value: "estandar", label: "Estándar", priority: 1 },
  { value: "destacado", label: "Destacado", priority: 2 },
  { value: "premium", label: "Premium", priority: 3 },
];

const PLACEMENT_OPTIONS: { value: AdPlacement; label: string; short: string }[] = [
  { value: "HOME_CAROUSEL", label: "Inicio - Carrusel principal", short: "Inicio - Carrusel" },
  { value: "HOME_BANNER", label: "Inicio - Banner superior", short: "Inicio - Banner" },
  { value: "PROMOTIONS", label: "Promociones", short: "Promociones" },
  { value: "CHECKOUT", label: "Checkout", short: "Checkout" },
];

const PAYMENT_STATUS_OPTIONS: { value: AdPaymentStatus; label: string; dot: string }[] = [
  { value: "PENDING", label: "Pendiente", dot: "bg-orange-400" },
  { value: "PAID", label: "Pagado", dot: "bg-emerald-500" },
  { value: "PARTIAL", label: "Parcial", dot: "bg-amber-500" },
  { value: "REFUNDED", label: "Reembolsado", dot: "bg-gray-500" },
  { value: "FAILED", label: "Fallido", dot: "bg-red-500" },
];

const BUTTON_ACTION_OPTIONS: { value: AdButtonAction; label: string }[] = [
  { value: "OPEN_STORE", label: "Abrir tienda" },
  { value: "OPEN_URL", label: "Abrir enlace" },
  { value: "CALL", label: "Llamar" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "APPLY_COUPON", label: "Aplicar cupón" },
  { value: "NONE", label: "Ninguna" },
];

const MAX_DESC = 500;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

function priorityToPlan(priority: number): string {
  return PLAN_OPTIONS.find((p) => p.priority === priority)?.value ?? "destacado";
}

function planToPriority(planType: string): number {
  return PLAN_OPTIONS.find((p) => p.value === planType)?.priority ?? 2;
}

function formatSummaryDate(iso: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

function formatRange(min: number, max: number): string {
  const fmt = (n: number) => new Intl.NumberFormat("es-MX").format(n);
  return `${fmt(min)} - ${fmt(max)}`;
}

function estimatePerformance(priority: number, placement: AdPlacement) {
  const baseViews: Record<AdPlacement, number> = {
    HOME_CAROUSEL: 12000,
    HOME_BANNER: 9000,
    PROMOTIONS: 7000,
    CHECKOUT: 4500,
  };
  const mult = 1 + priority * 0.22;
  const views = baseViews[placement] * mult;
  const ctr = 0.04 + priority * 0.012;
  const viewsMin = Math.round(views * 0.85);
  const viewsMax = Math.round(views * 1.15);
  const clicksMin = Math.round(viewsMin * ctr);
  const clicksMax = Math.round(viewsMax * (ctr + 0.015));
  const ctrMin = Math.round(ctr * 100);
  const ctrMax = Math.round((ctr + 0.015) * 100);
  return { viewsMin, viewsMax, clicksMin, clicksMax, ctrMin, ctrMax };
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {children}
      {required ? <span className="text-red-500 ml-0.5">*</span> : null}
    </label>
  );
}

function inputClass(extra = "") {
  return `w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-dobby-500/30 focus:border-dobby-500 ${extra}`;
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-blue-50 text-dobby-600 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      {children}
    </section>
  );
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

function IconUpload({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    </svg>
  );
}

function IconPin({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconInfo({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconSave({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
      />
    </svg>
  );
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
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
        d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"
      />
    </svg>
  );
}

function IconTrend({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );
}

function UploadZone({
  label,
  hint,
  compact,
  uploading,
  previewUrl,
  onPick,
}: {
  label: string;
  hint: string;
  compact?: boolean;
  uploading: boolean;
  previewUrl?: string;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onPick(file);
  }

  return (
    <div>
      <FieldLabel required={!compact}>{label}</FieldLabel>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`w-full rounded-xl border-2 border-dashed transition-colors text-left ${
          compact ? "p-4" : "p-8"
        } ${dragOver ? "border-dobby-500 bg-dobby-50/40" : "border-gray-200 hover:border-dobby-300 hover:bg-gray-50"}`}
      >
        {previewUrl ? (
          <img
            src={uploadsUrl(previewUrl)}
            alt=""
            className={`object-cover rounded-lg mx-auto ${compact ? "w-16 h-16" : "w-full max-h-36"}`}
          />
        ) : (
          <div className={`flex flex-col items-center text-center ${compact ? "gap-1" : "gap-2"}`}>
            <div className={`rounded-full bg-gray-100 text-gray-400 flex items-center justify-center ${compact ? "w-10 h-10" : "w-12 h-12"}`}>
              <IconUpload className={compact ? "w-5 h-5" : "w-6 h-6"} />
            </div>
            {!compact ? (
              <>
                <p className="text-sm font-medium text-gray-700">Arrastra tu imagen aquí</p>
                <p className="text-xs text-gray-400">o haz clic para seleccionar</p>
              </>
            ) : (
              <p className="text-xs text-gray-500">Seleccionar</p>
            )}
            <p className="text-[11px] text-gray-400">{hint}</p>
          </div>
        )}
        {uploading ? <p className="text-xs text-dobby-600 mt-2 text-center">Subiendo…</p> : null}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

export function adRecordToFormValues(raw: Record<string, unknown>): AdFormValues {
  const priority = Number(raw.priority ?? 2);
  const status = (raw.status as AdStatus) ?? (raw.isActive ? "ACTIVE" : "PAUSED");
  return {
    imageUrl: String(raw.imageUrl ?? ""),
    logoUrl: String(raw.logoUrl ?? ""),
    advertiserName: String(raw.advertiserName ?? ""),
    category: String(raw.category ?? ""),
    description: String(raw.description ?? ""),
    address: String(raw.address ?? ""),
    lat: raw.lat != null && Number.isFinite(Number(raw.lat)) ? Number(raw.lat) : null,
    lng: raw.lng != null && Number.isFinite(Number(raw.lng)) ? Number(raw.lng) : null,
    contactPhone: String(raw.contactPhone ?? ""),
    whatsapp: String(raw.whatsapp ?? ""),
    facebookUrl: String(raw.facebookUrl ?? ""),
    instagramUrl: String(raw.instagramUrl ?? ""),
    websiteUrl: String(raw.websiteUrl ?? ""),
    email: String(raw.email ?? ""),
    startDate: raw.startDate ? String(raw.startDate).slice(0, 10) : "",
    endDate: raw.endDate ? String(raw.endDate).slice(0, 10) : "",
    status,
    priority,
    planType: priorityToPlan(priority),
    placement: (raw.placement as AdPlacement) ?? "HOME_CAROUSEL",
    couponCode: String(raw.couponCode ?? ""),
    discountPercent: raw.discountPercent != null ? String(raw.discountPercent) : "",
    buttonText: String(raw.buttonText ?? ""),
    buttonAction: (raw.buttonAction as AdButtonAction) ?? "OPEN_STORE",
    amountPaid: raw.amountPaid != null ? String(raw.amountPaid) : "",
    paymentStatus: (raw.paymentStatus as AdPaymentStatus) ?? "PENDING",
    isActive: raw.isActive !== false && status !== "PAUSED",
    linkedStoreId: String(raw.linkedStoreId ?? ""),
  };
}

type AdFormModalProps = {
  mode: "create" | "edit";
  editId: string | null;
  initialValues: AdFormValues;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: (id: string) => void;
};

export function AdFormModal({ mode, editId, initialValues, onClose, onSaved, onDelete }: AdFormModalProps) {
  const [form, setForm] = useState<AdFormValues>(initialValues);
  const [shops, setShops] = useState<ShopOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [mapPickerOpen, setMapPickerOpen] = useState(false);

  useEffect(() => {
    setForm(initialValues);
  }, [initialValues]);

  useEffect(() => {
    fetch(apiPath("/api/shops"), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setShops(list.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
      })
      .catch(() => setShops([]));
  }, []);

  const estimates = useMemo(
    () => estimatePerformance(form.priority, form.placement),
    [form.priority, form.placement]
  );

  const statusLabel = STATUS_OPTIONS.find((s) => s.value === form.status)?.label ?? form.status;
  const planLabel = PLAN_OPTIONS.find((p) => p.value === form.planType)?.label ?? "Destacado";
  const placementLabel =
    PLACEMENT_OPTIONS.find((p) => p.value === form.placement)?.short ?? form.placement;
  const priorityLabel = PRIORITY_OPTIONS.find((p) => p.value === form.priority)?.label ?? String(form.priority);

  async function uploadImage(file: File, field: "imageUrl" | "logoUrl") {
    const maxBytes = field === "imageUrl" ? MAX_IMAGE_BYTES : MAX_LOGO_BYTES;
    if (!file.type.startsWith("image/")) {
      alert("Solo se permiten imágenes JPG o PNG.");
      return;
    }
    if (file.size > maxBytes) {
      alert(field === "imageUrl" ? "La imagen no debe superar 5 MB." : "El logo no debe superar 2 MB.");
      return;
    }
    const token = getToken();
    if (!token) {
      alert("Sesión expirada. Vuelve a iniciar sesión.");
      return;
    }
    const setUploading = field === "imageUrl" ? setImageUploading : setLogoUploading;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("token", token);
      const res = await fetch(apiPath("/api/upload/ad-image"), {
        method: "POST",
        headers: { ...authHeadersForUpload(), "X-Auth-Token": token },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Error al subir la imagen");
        return;
      }
      setForm((f) => ({ ...f, [field]: data.url }));
    } catch {
      alert("Error al subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.advertiserName.trim()) {
      alert("El nombre del anunciante es obligatorio.");
      return;
    }
    if (!form.category) {
      alert("Selecciona una categoría.");
      return;
    }
    if (!form.description.trim()) {
      alert("La descripción es obligatoria.");
      return;
    }
    if (!form.address.trim()) {
      alert("La dirección es obligatoria.");
      return;
    }
    if (!form.contactPhone.trim()) {
      alert("El teléfono de contacto es obligatorio.");
      return;
    }
    if (!form.startDate || !form.endDate) {
      alert("Indica las fechas de inicio y fin de la campaña.");
      return;
    }

    setSaving(true);
    const url = editId ? `/api/ads/${editId}` : "/api/ads";
    const method = editId ? "PUT" : "POST";
    const body = {
      imageUrl: form.imageUrl || null,
      logoUrl: form.logoUrl || null,
      advertiserName: form.advertiserName.trim(),
      category: form.category,
      description: form.description.trim(),
      address: form.address.trim(),
      contactPhone: form.contactPhone.trim(),
      whatsapp: form.whatsapp.trim() || null,
      facebookUrl: form.facebookUrl.trim() || null,
      instagramUrl: form.instagramUrl.trim() || null,
      websiteUrl: form.websiteUrl.trim() || null,
      email: form.email.trim() || null,
      startDate: form.startDate,
      endDate: form.endDate,
      status: form.status,
      isActive: form.isActive,
      priority: form.priority,
      placement: form.placement,
      couponCode: form.couponCode.trim() || null,
      discountPercent: form.discountPercent ? Number(form.discountPercent) : null,
      buttonText: form.buttonText.trim() || null,
      buttonAction: form.buttonAction,
      amountPaid: form.amountPaid ? Number(form.amountPaid) : null,
      paymentStatus: form.paymentStatus,
      linkedStoreId: form.linkedStoreId || null,
    };

    try {
      const res = await fetch(apiPath(url), {
        method,
        headers: authHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onSaved();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Error al guardar");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-4 px-6 py-5 bg-white border-b border-gray-100 shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-dobby-600 text-white flex items-center justify-center shrink-0">
              <IconMegaphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {mode === "create" ? "Nuevo anuncio" : "Editar anuncio"}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Crea un anuncio atractivo para promocionar tu negocio en Dobby.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-xl leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-5">
                <SectionCard
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                  title="Información básica"
                >
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-4 mb-4">
                    <UploadZone
                      label="Imagen del anuncio"
                      hint="Formatos: JPG, PNG. Máx. 5MB"
                      uploading={imageUploading}
                      previewUrl={form.imageUrl || undefined}
                      onPick={(file) => uploadImage(file, "imageUrl")}
                    />
                    <UploadZone
                      label="Logo (opcional)"
                      hint="Máx. 2MB"
                      compact
                      uploading={logoUploading}
                      previewUrl={form.logoUrl || undefined}
                      onPick={(file) => uploadImage(file, "logoUrl")}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <FieldLabel required>Nombre del anunciante</FieldLabel>
                      <input
                        value={form.advertiserName}
                        onChange={(e) => setForm((f) => ({ ...f, advertiserName: e.target.value }))}
                        placeholder="Ej. Lavado Hernandez"
                        className={inputClass()}
                        required
                      />
                    </div>
                    <div>
                      <FieldLabel required>Categoría</FieldLabel>
                      <select
                        value={form.category}
                        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                        className={inputClass()}
                        required
                      >
                        <option value="">Selecciona una categoría</option>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <FieldLabel required>Descripción del anuncio</FieldLabel>
                    <textarea
                      value={form.description}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          description: e.target.value.slice(0, MAX_DESC),
                        }))
                      }
                      placeholder="Describe tu negocio, productos o servicios..."
                      rows={4}
                      className={inputClass("resize-none")}
                      required
                    />
                    <p className="text-xs text-gray-400 text-right mt-1">
                      {form.description.length}/{MAX_DESC}
                    </p>
                  </div>
                </SectionCard>

                <SectionCard icon={<IconPin className="w-4 h-4" />} title="Ubicación y contacto">
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <FieldLabel required>Dirección (se abre en Maps)</FieldLabel>
                        <button
                          type="button"
                          onClick={() => setMapPickerOpen(true)}
                          className="text-sm font-medium text-dobby-600 hover:text-dobby-800 shrink-0"
                        >
                          Seleccionar en mapa
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          value={form.address}
                          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                          placeholder="Ej. Calle Principal 123, Ciudad"
                          className={inputClass("pr-11")}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setMapPickerOpen(true)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-dobby-600 hover:bg-dobby-50 transition-colors"
                          aria-label="Abrir mapa para seleccionar ubicación"
                          title="Seleccionar en mapa"
                        >
                          <IconPin className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <FieldLabel required>Teléfono de contacto</FieldLabel>
                        <input
                          type="tel"
                          value={form.contactPhone}
                          onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                          placeholder="(999) 123-4567"
                          className={inputClass()}
                          required
                        />
                      </div>
                      <div>
                        <FieldLabel>WhatsApp</FieldLabel>
                        <div className="flex">
                          <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-gray-200 bg-gray-50 text-sm text-gray-500">
                            🇲🇽 +52
                          </span>
                          <input
                            type="tel"
                            value={form.whatsapp}
                            onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                            placeholder="999 123 4567"
                            className={inputClass("rounded-l-none")}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <FieldLabel>Facebook (URL)</FieldLabel>
                        <input
                          type="url"
                          value={form.facebookUrl}
                          onChange={(e) => setForm((f) => ({ ...f, facebookUrl: e.target.value }))}
                          placeholder="https://facebook.com/..."
                          className={inputClass()}
                        />
                      </div>
                      <div>
                        <FieldLabel>Instagram (URL)</FieldLabel>
                        <input
                          type="url"
                          value={form.instagramUrl}
                          onChange={(e) => setForm((f) => ({ ...f, instagramUrl: e.target.value }))}
                          placeholder="https://instagram.com/..."
                          className={inputClass()}
                        />
                      </div>
                      <div>
                        <FieldLabel>Sitio web (URL)</FieldLabel>
                        <input
                          type="url"
                          value={form.websiteUrl}
                          onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                          placeholder="https://tusitio.com"
                          className={inputClass()}
                        />
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Correo electrónico</FieldLabel>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="ejemplo@correo.com"
                        className={inputClass()}
                      />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                  title="Configuración de la campaña"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <FieldLabel required>Fecha de inicio</FieldLabel>
                      <input
                        type="date"
                        value={form.startDate}
                        onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                        className={inputClass()}
                        required
                      />
                    </div>
                    <div>
                      <FieldLabel required>Fecha de fin</FieldLabel>
                      <input
                        type="date"
                        value={form.endDate}
                        onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                        className={inputClass()}
                        required
                      />
                    </div>
                    <div>
                      <FieldLabel required>Estado</FieldLabel>
                      <select
                        value={form.status}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            status: e.target.value as AdStatus,
                            isActive: e.target.value === "ACTIVE",
                          }))
                        }
                        className={inputClass()}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <FieldLabel required>Prioridad</FieldLabel>
                      <select
                        value={form.priority}
                        onChange={(e) => {
                          const priority = Number(e.target.value);
                          setForm((f) => ({
                            ...f,
                            priority,
                            planType: priorityToPlan(priority),
                          }));
                        }}
                        className={inputClass()}
                      >
                        {PRIORITY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <FieldLabel required>Ubicación en la app</FieldLabel>
                      <select
                        value={form.placement}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, placement: e.target.value as AdPlacement }))
                        }
                        className={inputClass()}
                      >
                        {PLACEMENT_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <FieldLabel required>Plan / Tipo de anuncio</FieldLabel>
                      <select
                        value={form.planType}
                        onChange={(e) => {
                          const planType = e.target.value;
                          setForm((f) => ({
                            ...f,
                            planType,
                            priority: planToPriority(planType),
                          }));
                        }}
                        className={inputClass()}
                      >
                        {PLAN_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  }
                  title="Promoción (opcional)"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel>Código de cupón</FieldLabel>
                      <input
                        value={form.couponCode}
                        onChange={(e) => setForm((f) => ({ ...f, couponCode: e.target.value }))}
                        placeholder="Ej. DOBBY10"
                        className={inputClass()}
                      />
                    </div>
                    <div>
                      <FieldLabel>Descuento (%)</FieldLabel>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={form.discountPercent}
                          onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))}
                          placeholder="Ej. 10"
                          className={inputClass("pr-8")}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Texto del botón</FieldLabel>
                      <input
                        value={form.buttonText}
                        onChange={(e) => setForm((f) => ({ ...f, buttonText: e.target.value }))}
                        placeholder="Ordenar ahora"
                        className={inputClass()}
                      />
                    </div>
                    <div>
                      <FieldLabel>Acción del botón</FieldLabel>
                      <select
                        value={form.buttonAction}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, buttonAction: e.target.value as AdButtonAction }))
                        }
                        className={inputClass()}
                      >
                        {BUTTON_ACTION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  title="Información de pago"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <FieldLabel required>Monto pagado (MXN)</FieldLabel>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.amountPaid}
                        onChange={(e) => setForm((f) => ({ ...f, amountPaid: e.target.value }))}
                        placeholder="0.00"
                        className={inputClass()}
                      />
                    </div>
                    <div>
                      <FieldLabel required>Estatus de pago</FieldLabel>
                      <select
                        value={form.paymentStatus}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            paymentStatus: e.target.value as AdPaymentStatus,
                          }))
                        }
                        className={inputClass()}
                      >
                        {PAYMENT_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  }
                  title="Configuración adicional"
                >
                  <div className="space-y-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            isActive: e.target.checked,
                            status: e.target.checked ? "ACTIVE" : "PAUSED",
                          }))
                        }
                        className="mt-1 rounded border-gray-300 text-dobby-600 focus:ring-dobby-500"
                      />
                      <span>
                        <span className="block text-sm font-medium text-gray-900">Anuncio activo (visible)</span>
                        <span className="block text-xs text-gray-500 mt-0.5">
                          Los anuncios inactivos no se mostrarán en la app.
                        </span>
                      </span>
                    </label>
                    <div>
                      <FieldLabel>Tienda / Negocio relacionado (opcional)</FieldLabel>
                      <select
                        value={form.linkedStoreId}
                        onChange={(e) => setForm((f) => ({ ...f, linkedStoreId: e.target.value }))}
                        className={inputClass()}
                      >
                        <option value="">Selecciona una tienda</option>
                        {shops.map((shop) => (
                          <option key={shop.id} value={shop.id}>
                            {shop.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </SectionCard>
              </div>

              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-0">
                  <h3 className="font-semibold text-gray-900 mb-4">Resumen del anuncio</h3>
                  <dl className="space-y-3 text-sm mb-5">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-gray-500">Estado</dt>
                      <dd>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_OPTIONS.find((s) => s.value === form.status)?.dot ?? "bg-emerald-500"}`} />
                          {statusLabel}
                        </span>
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-gray-500">Plan</dt>
                      <dd className="font-medium text-gray-900">{planLabel}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-gray-500">Ubicación</dt>
                      <dd className="font-medium text-gray-900 text-right">{placementLabel}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-gray-500">Fechas</dt>
                      <dd className="font-medium text-gray-900 text-right tabular-nums">
                        {form.startDate && form.endDate
                          ? `${formatSummaryDate(form.startDate)} - ${formatSummaryDate(form.endDate)}`
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-gray-500">Prioridad</dt>
                      <dd className="font-medium text-gray-900">{priorityLabel}</dd>
                    </div>
                  </dl>

                  <div className="border-t border-gray-100 pt-4 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-1.5">
                        <IconEye className="w-4 h-4 text-gray-400" />
                        Vistas estimadas
                      </span>
                      <span className="font-semibold text-gray-900 tabular-nums">
                        {formatRange(estimates.viewsMin, estimates.viewsMax)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-1.5">
                        <IconCursor className="w-4 h-4 text-gray-400" />
                        Clics estimados
                      </span>
                      <span className="font-semibold text-gray-900 tabular-nums">
                        {formatRange(estimates.clicksMin, estimates.clicksMax)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 flex items-center gap-1.5">
                        <IconTrend className="w-4 h-4 text-gray-400" />
                        CTR estimado
                      </span>
                      <span className="font-semibold text-gray-900 tabular-nums">
                        {estimates.ctrMin}% - {estimates.ctrMax}%
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2 rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800">
                    <IconInfo className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>Las estadísticas son estimadas y pueden variar según el rendimiento real.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-6 py-4 bg-white border-t border-gray-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <div className="flex items-center gap-2">
              {mode === "edit" && editId && onDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete(editId)}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Eliminar
                </button>
              ) : null}
              <button
                type="submit"
                disabled={saving || imageUploading || logoUploading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-dobby-600 text-white text-sm font-medium hover:bg-dobby-700 disabled:opacity-60"
              >
                <IconSave className="w-4 h-4" />
                {saving ? "Guardando…" : mode === "create" ? "Crear anuncio" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {mapPickerOpen ? (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
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
      ) : null}
    </div>
  );
}
