"use client";

import { useEffect, useRef, useState } from "react";
import { authHeaders, authHeadersForUpload, getToken, apiPath, uploadsUrl } from "@/lib/api";

const MAX_PHOTOS = 3;

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: string | number;
  imageUrls: string[];
  hasPromotion: boolean;
  discount: number;
  isActive: boolean;
  shop: { name: string };
};

type Shop = { id: string; name: string };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"closed" | "create" | "edit">("closed");
  const [form, setForm] = useState({
    shopId: "",
    name: "",
    description: "",
    price: "",
    imageUrls: [] as string[],
    hasPromotion: false,
    discount: 0,
    isActive: true,
  });
  const [editId, setEditId] = useState<string | null>(null);
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
        }
      : {
          ...form,
          price: Number(form.price),
          discount: normalizedDiscount,
          shopId: form.shopId,
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
      });
      load();
    }
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

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este producto?")) return;
    const res = await fetch(apiPath(`/api/products/${id}`), { method: "DELETE", headers: authHeaders() });
    if (res.ok) load();
  }

  function getDiscountedPrice(price: string | number, discount: number) {
    const amount = Number(price) || 0;
    const safeDiscount = Math.min(100, Math.max(0, Number(discount) || 0));
    return amount * (1 - safeDiscount / 100);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Productos</h1>
        <button
          onClick={() => {
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
            });
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Añadir producto
        </button>
      </div>
      {loading ? (
        <p className="text-gray-500">Cargando…</p>
      ) : (
        <div className="bg-white rounded-lg shadow p-4">
          {products.length === 0 ? (
            <p className="text-gray-500 text-sm">Aún no hay productos registrados.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openEdit(p)}
                  className="group text-left rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-blue-400 transition overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                >
                  <div className="p-2">
                  <div className="relative w-full aspect-[1.12/1] rounded-[14px] bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                    {Array.isArray(p.imageUrls) && p.imageUrls.length > 0 ? (
                      <img
                        src={uploadsUrl(p.imageUrls[0])}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <span className="text-gray-400 text-xs">Sin imagen</span>
                    )}
                  </div>
                  <div className="w-full pt-2 pb-1 min-w-0">
                    {p.hasPromotion && p.discount > 0 ? (
                      <>
                        <div className="text-[20px] leading-none font-extrabold text-black">
                          ${getDiscountedPrice(p.price, p.discount).toFixed(2)}
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          <span className="inline-flex rounded px-1.5 py-0.5 text-[13px] leading-none font-extrabold bg-yellow-300 text-black">
                            -{p.discount}%
                          </span>
                          <span className="text-[11px] text-black line-through decoration-2">
                            ${Number(p.price).toFixed(2)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-[18px] leading-none font-extrabold text-black">
                        ${Number(p.price).toFixed(2)}
                      </div>
                    )}
                    <span className="mt-1 block font-semibold text-[18px] leading-[1.06] text-black line-clamp-2" title={p.name}>
                      {p.name}
                    </span>
                    <span className="mt-1 block text-[13px] font-medium text-black truncate w-full" title={p.shop?.name}>
                      {p.shop?.name ?? "—"}
                    </span>
                    <span
                      className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        p.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {p.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {modal !== "closed" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-10">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h2 className="text-lg font-semibold mb-4">{modal === "create" ? "Nuevo producto" : "Editar producto"}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              {modal === "create" && (
                <div>
                  <label className="block text-sm text-gray-600">Tienda</label>
                  <select
                    value={form.shopId}
                    onChange={(e) => setForm((f) => ({ ...f, shopId: e.target.value }))}
                    className="w-full border rounded px-3 py-2"
                    required
                  >
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-600">Nombre</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
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
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                  rows={2}
                />
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
                <label htmlFor="hasPromotion" className="text-sm">Tiene promoción</label>
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
                  className="w-full border rounded px-3 py-2 disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Fotos del producto (máx. {MAX_PHOTOS})</label>
                <input
                  ref={productImageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  onChange={handleProductImageChange}
                  disabled={imageUploading || form.imageUrls.length >= MAX_PHOTOS}
                  className="w-full border rounded px-3 py-2 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 file:text-sm file:font-medium"
                />
                {imageUploading && <p className="mt-1 text-xs text-gray-500">Subiendo…</p>}
                {form.imageUrls.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {form.imageUrls.map((url, i) => (
                      <div key={i} className="relative">
                        <img src={uploadsUrl(url)} alt="" className="w-16 h-16 rounded object-cover border bg-gray-100" />
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
                <label htmlFor="isActive" className="text-sm">Activo</label>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  {modal === "create" ? "Crear" : "Guardar"}
                </button>
                <button type="button" onClick={() => setModal("closed")} className="border px-4 py-2 rounded hover:bg-gray-50">
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
