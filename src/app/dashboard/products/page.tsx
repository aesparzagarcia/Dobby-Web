"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { authHeaders, authHeadersForUpload, getToken, apiPath, uploadsUrl } from "@/lib/api";
import {
  DEFAULT_PRODUCT_CATEGORY,
  PRODUCT_CATEGORIES,
  type ProductCategoryValue,
} from "@/lib/productCategories";

const MAX_PHOTOS = 3;
const PAGE_SIZE = 8;

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  imageUrls: string[];
  hasPromotion: boolean;
  discount: number;
  isActive: boolean;
  category?: string;
  createdAt?: string;
  shop: { name: string };
};

type Shop = { id: string; name: string };

type CategoryFilter = "all" | "bebidas" | "alcohol" | "comidas" | "postres";
type SortKey = "recent" | "name" | "price_asc" | "price_desc";
type ViewMode = "grid" | "list";

const CATEGORY_TABS: { id: CategoryFilter; label: string; icon: string }[] = [
  { id: "all", label: "Todos", icon: "▦" },
  { id: "bebidas", label: "Bebidas", icon: "🥤" },
  { id: "alcohol", label: "Alcohol", icon: "🍾" },
  { id: "comidas", label: "Comidas", icon: "🍽" },
  { id: "postres", label: "Postres", icon: "🍰" },
];

function formatMoney(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

function getDiscountedPrice(price: string | number, discount: number) {
  const amount = Number(price) || 0;
  const safeDiscount = Math.min(100, Math.max(0, Number(discount) || 0));
  return amount * (1 - safeDiscount / 100);
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

function IconGrid({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
      />
    </svg>
  );
}

function IconList({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function ProductCard({
  product: p,
  viewMode,
  onClick,
  onToggleActive,
  togglingActive,
}: {
  product: Product;
  viewMode: ViewMode;
  onClick: () => void;
  onToggleActive: (active: boolean) => void;
  togglingActive: boolean;
}) {
  const displayPrice =
    p.hasPromotion && p.discount > 0
      ? getDiscountedPrice(p.price, p.discount)
      : Number(p.price) || 0;
  const originalPrice = Number(p.price) || 0;

  const imageBlock = (
    <div
      className={`relative bg-gray-100 overflow-hidden shrink-0 ${
        viewMode === "grid" ? "aspect-square w-full rounded-xl" : "w-24 h-24 rounded-lg"
      }`}
    >
      {Array.isArray(p.imageUrls) && p.imageUrls.length > 0 ? (
        <img
          src={uploadsUrl(p.imageUrls[0])}
          alt={p.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
          Sin imagen
        </div>
      )}
      {!p.isActive && (
        <span className="absolute top-2 left-2 rounded-full bg-gray-900/70 px-2 py-0.5 text-[10px] font-medium text-white">
          Inactivo
        </span>
      )}
    </div>
  );

  const titleBlock = (
    <>
      <h3 className="font-semibold text-gray-900 truncate" title={p.name}>
        {p.name}
      </h3>
      <p className="text-sm text-gray-500 truncate mt-0.5" title={p.shop?.name}>
        {p.shop?.name ?? "—"}
      </p>
    </>
  );

  const activeToggle = (
    <div
      className="flex items-center gap-2 shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        role="switch"
        aria-checked={p.isActive}
        aria-label={p.isActive ? "Desactivar producto" : "Activar producto"}
        disabled={togglingActive}
        onClick={() => onToggleActive(!p.isActive)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400/40 disabled:opacity-50 ${
          p.isActive ? "bg-gray-900" : "bg-gray-200"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
            p.isActive ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
      <span className="text-xs text-gray-600">{p.isActive ? "Activo" : "Inactivo"}</span>
    </div>
  );

  const priceRow = (
    <div className="mt-2 flex items-center justify-between gap-3">
      <div className="flex items-baseline gap-2 flex-wrap min-w-0">
        <span className="text-lg font-bold text-gray-900 tabular-nums">
          {formatMoney(displayPrice)}
        </span>
        {p.hasPromotion && p.discount > 0 && (
          <>
            <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
              -{p.discount}%
            </span>
            <span className="text-xs text-gray-400 line-through tabular-nums">
              {formatMoney(originalPrice)}
            </span>
          </>
        )}
      </div>
      {activeToggle}
    </div>
  );

  if (viewMode === "list") {
    return (
      <article
        className={`group rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-dobby-200 transition overflow-hidden ${
          !p.isActive ? "opacity-75" : ""
        }`}
      >
        <div className="flex items-start gap-4 p-3">
          <button
            type="button"
            onClick={onClick}
            className="shrink-0 focus:outline-none focus:ring-2 focus:ring-dobby-500/40 rounded-lg"
          >
            {imageBlock}
          </button>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={onClick}
              className="w-full text-left focus:outline-none focus:ring-2 focus:ring-dobby-500/40 rounded"
            >
              {titleBlock}
            </button>
            {priceRow}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`group rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-dobby-200 transition overflow-hidden ${
        !p.isActive ? "opacity-75" : ""
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full p-3 pb-0 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-dobby-500/40"
      >
        {imageBlock}
        <div className="pt-3">{titleBlock}</div>
      </button>
      <div className="px-3 pb-3">{priceRow}</div>
    </article>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"closed" | "create" | "edit">("closed");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    shopId: "",
    name: "",
    description: "",
    price: "",
    imageUrls: [] as string[],
    hasPromotion: false,
    discount: 0,
    isActive: true,
    category: DEFAULT_PRODUCT_CATEGORY,
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const productImageInputRef = useRef<HTMLInputElement>(null);

  function load() {
    Promise.all([
      fetch(apiPath("/api/products"), { headers: authHeaders() }).then((r) => r.json()),
      fetch(apiPath("/api/shops"), { headers: authHeaders() }).then((r) => r.json()),
    ])
      .then(([prods, shopList]) => {
        setProducts(Array.isArray(prods) ? prods : []);
        setShops(Array.isArray(shopList) ? shopList : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => load(), []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, categoryFilter, sortBy]);

  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (categoryFilter !== "all") {
      list = list.filter((p) => p.category === categoryFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.shop?.name ?? "").toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name, "es");
        case "price_asc":
          return Number(a.price) - Number(b.price);
        case "price_desc":
          return Number(b.price) - Number(a.price);
        case "recent":
        default:
          return (
            new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
          );
      }
    });
    return list;
  }, [products, categoryFilter, searchQuery, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginatedProducts = filteredProducts.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalizedDiscount = Number(form.discount);
    if (!Number.isInteger(normalizedDiscount) || normalizedDiscount < 0 || normalizedDiscount > 100) {
      alert("El descuento debe ser un entero entre 0 y 100.");
      return;
    }
    const url = editId ? `/api/products/${editId}` : "/api/products";
    const method = editId ? "PUT" : "POST";
    const body = editId
      ? {
          name: form.name,
          description: form.description || null,
          price: form.price ? Number(form.price) : undefined,
          imageUrls: form.imageUrls,
          hasPromotion: form.hasPromotion,
          discount: normalizedDiscount,
          isActive: form.isActive,
          category: form.category,
        }
      : {
          shopId: form.shopId,
          name: form.name,
          description: form.description || null,
          price: Number(form.price),
          imageUrls: form.imageUrls,
          hasPromotion: form.hasPromotion,
          discount: normalizedDiscount,
          isActive: form.isActive,
          category: form.category,
        };
    const res = await fetch(apiPath(url), {
      method,
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setModal("closed");
      setEditId(null);
      setForm({
        shopId: shops[0]?.id || "",
        name: "",
        description: "",
        price: "",
        imageUrls: [],
        hasPromotion: false,
        discount: 0,
        isActive: true,
        category: DEFAULT_PRODUCT_CATEGORY,
      });
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "No se pudo guardar el producto");
    }
  }

  function openCreate() {
    setModal("create");
    setEditId(null);
    setForm({
      shopId: shops[0]?.id || "",
      name: "",
      description: "",
      price: "",
      imageUrls: [],
      hasPromotion: false,
      discount: 0,
      isActive: true,
      category: DEFAULT_PRODUCT_CATEGORY,
    });
  }

  function openEdit(p: Product) {
    setEditId(p.id);
    setForm({
      shopId: "",
      name: p.name,
      description: p.description || "",
      price: String(p.price),
      imageUrls: Array.isArray(p.imageUrls) ? [...p.imageUrls] : [],
      hasPromotion: !!p.hasPromotion,
      discount: Number.isFinite(Number(p.discount)) ? Number(p.discount) : 0,
      isActive: p.isActive,
      category: (PRODUCT_CATEGORIES.some((c) => c.value === p.category)
        ? p.category
        : DEFAULT_PRODUCT_CATEGORY) as ProductCategoryValue,
    });
    setModal("edit");
  }

  async function handleProductImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    const token = getToken();
    if (!token) {
      alert("Sesión expirada. Vuelve a iniciar sesión.");
      return;
    }
    const currentCount = form.imageUrls.length;
    const slotsLeft = MAX_PHOTOS - currentCount;
    if (slotsLeft <= 0) {
      alert(`Máximo ${MAX_PHOTOS} fotos.`);
      e.target.value = "";
      return;
    }
    const toUpload = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, slotsLeft);
    if (toUpload.length === 0) {
      alert("Solo se permiten imágenes (JPEG, PNG, GIF, WebP).");
      e.target.value = "";
      return;
    }
    setImageUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of toUpload) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("token", token);
        const res = await fetch(apiPath("/api/upload/product-image"), {
          method: "POST",
          headers: { ...authHeadersForUpload(), "X-Auth-Token": token },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Error al subir la imagen");
          break;
        }
        newUrls.push(data.url);
      }
      if (newUrls.length > 0) {
        setForm((f) => ({ ...f, imageUrls: [...f.imageUrls, ...newUrls].slice(0, MAX_PHOTOS) }));
      }
    } catch {
      alert("Error al subir la imagen");
    } finally {
      setImageUploading(false);
      if (productImageInputRef.current) productImageInputRef.current.value = "";
    }
  }

  function removeProductImage(index: number) {
    setForm((f) => ({ ...f, imageUrls: f.imageUrls.filter((_, i) => i !== index) }));
  }

  async function handleToggleActive(product: Product, active: boolean) {
    setTogglingId(product.id);
    try {
      const res = await fetch(apiPath(`/api/products/${product.id}`), {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ isActive: active }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((item) => (item.id === product.id ? { ...item, isActive: active } : item))
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

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Explora nuestro catálogo de alimentos y bebidas
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 bg-dobby-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-dobby-700 transition shrink-0"
        >
          <IconPlus className="w-5 h-5" />
          Añadir producto
        </button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_TABS.map((tab) => {
            const active = categoryFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition ${
                  active
                    ? "bg-dobby-600 text-white border-dobby-600 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:border-dobby-300 hover:text-dobby-700"
                }`}
              >
                <span aria-hidden className="text-base leading-none">
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] sm:min-w-[240px]">
            <IconSearch className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar productos..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-dobby-500/30 focus:border-dobby-400"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-dobby-500/30"
          >
            <option value="recent">Más recientes</option>
            <option value="name">Nombre A–Z</option>
            <option value="price_asc">Precio: menor a mayor</option>
            <option value="price_desc">Precio: mayor a menor</option>
          </select>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-2 ${viewMode === "grid" ? "bg-dobby-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              aria-label="Vista en cuadrícula"
            >
              <IconGrid className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-2 ${viewMode === "list" ? "bg-dobby-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              aria-label="Vista en lista"
            >
              <IconList className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 py-12 text-center">Cargando…</p>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <p className="text-gray-500 text-sm">
            {products.length === 0
              ? "Aún no hay productos registrados."
              : "No hay productos que coincidan con tu búsqueda."}
          </p>
          {products.length === 0 && (
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 text-sm font-medium text-dobby-600 hover:text-dobby-700"
            >
              Crear el primero →
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
                : "flex flex-col gap-3"
            }
          >
            {paginatedProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                viewMode={viewMode}
                onClick={() => openEdit(p)}
                onToggleActive={(active) => handleToggleActive(p, active)}
                togglingActive={togglingId === p.id}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`min-w-[2.25rem] h-9 px-2 rounded-lg text-sm font-medium transition ${
                    page === n
                      ? "bg-dobby-600 text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:border-dobby-300"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-dobby-300 disabled:opacity-40"
                aria-label="Página siguiente"
              >
                →
              </button>
            </div>
          )}
        </>
      )}

      {modal !== "closed" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-10">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">
              {modal === "create" ? "Nuevo producto" : "Editar producto"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              {modal === "create" && (
                <div>
                  <label className="block text-sm text-gray-600">Tienda</label>
                  <select
                    value={form.shopId}
                    onChange={(e) => setForm((f) => ({ ...f, shopId: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  >
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-600">Nombre</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Precio</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Categoría</label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value as ProductCategoryValue }))
                  }
                  className="w-full border rounded-lg px-3 py-2"
                  required
                >
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasPromotion"
                  checked={form.hasPromotion}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      hasPromotion: e.target.checked,
                      discount: e.target.checked ? f.discount : 0,
                    }))
                  }
                />
                <label htmlFor="hasPromotion" className="text-sm">
                  Tiene promoción
                </label>
              </div>
              <div>
                <label className="block text-sm text-gray-600">Descuento (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.discount}
                  onChange={(e) => setForm((f) => ({ ...f, discount: Number(e.target.value) }))}
                  disabled={!form.hasPromotion}
                  className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">
                  Fotos del producto (máx. {MAX_PHOTOS})
                </label>
                <input
                  ref={productImageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  onChange={handleProductImageChange}
                  disabled={imageUploading || form.imageUrls.length >= MAX_PHOTOS}
                  className="w-full border rounded-lg px-3 py-2 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-dobby-50 file:text-dobby-700 file:text-sm file:font-medium"
                />
                {imageUploading && <p className="mt-1 text-xs text-gray-500">Subiendo…</p>}
                {form.imageUrls.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {form.imageUrls.map((url, i) => (
                      <div key={i} className="relative">
                        <img
                          src={uploadsUrl(url)}
                          alt=""
                          className="w-16 h-16 rounded-lg object-cover border bg-gray-100"
                        />
                        <button
                          type="button"
                          onClick={() => removeProductImage(i)}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs leading-none"
                          title="Quitar"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                <label htmlFor="isActive" className="text-sm">
                  Activo
                </label>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="bg-dobby-600 text-white px-4 py-2 rounded-lg hover:bg-dobby-700"
                >
                  {modal === "create" ? "Crear" : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setModal("closed")}
                  className="border px-4 py-2 rounded-lg hover:bg-gray-50"
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
