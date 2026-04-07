"use client";

import { useEffect, useRef, useState } from "react";
import { authHeaders, authHeadersForUpload, getToken, apiPath, uploadsUrl } from "@/lib/api";

type Shop = {
  id: string;
  name: string;
  type: string;
  address: string;
  phone: string | null;
  logoUrl: string | null;
  status: string;
};

export default function ShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"closed" | "create" | "edit">("closed");
  const [form, setForm] = useState({ name: "", type: "SHOP", address: "", phone: "", logoUrl: "", status: "ACTIVE" });
  const [editId, setEditId] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  function load() {
    fetch(apiPath("/api/shops"), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setShops(Array.isArray(data) ? data : []))
      .catch(() => setShops([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => load(), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editId ? `/api/shops/${editId}` : "/api/shops";
    const method = editId ? "PUT" : "POST";
    const body = editId
      ? { name: form.name, type: form.type, address: form.address, phone: form.phone || null, logoUrl: form.logoUrl || null, status: form.status }
      : { ...form, logoUrl: form.logoUrl || null };
    const res = await fetch(apiPath(url), {
      method,
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setModal("closed");
      setEditId(null);
      setForm({ name: "", type: "SHOP", address: "", phone: "", logoUrl: "", status: "ACTIVE" });
      load();
    }
  }

  function openEdit(shop: Shop) {
    setEditId(shop.id);
    setForm({
      name: shop.name,
      type: shop.type,
      address: shop.address,
      phone: shop.phone || "",
      logoUrl: shop.logoUrl || "",
      status: shop.status,
    });
    setModal("edit");
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta tienda?")) return;
    const res = await fetch(apiPath(`/api/shops/${id}`), { method: "DELETE", headers: authHeaders() });
    if (res.ok) load();
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
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Tiendas</h1>
        <button
          onClick={() => { setModal("create"); setEditId(null); setForm({ name: "", type: "SHOP", address: "", phone: "", logoUrl: "", status: "ACTIVE" }); }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Añadir tienda
        </button>
      </div>
      {loading ? (
        <p className="text-gray-500">Cargando…</p>
      ) : (
        <div className="bg-white rounded-lg shadow p-4">
          {shops.length === 0 ? (
            <p className="text-gray-500 text-sm">Aún no hay tiendas registradas.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
              {shops.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => openEdit(s)}
                  className="group flex flex-col items-center rounded-md border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-blue-400 transition overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                >
                  <div className="w-full h-28 bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                    {s.logoUrl ? (
                      <img
                        src={uploadsUrl(s.logoUrl)}
                        alt={s.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <span className="text-gray-400 text-[10px]">Sin logo</span>
                    )}
                  </div>
                  <div className="w-full px-1.5 py-1 flex flex-col items-center text-center min-w-0">
                    <span className="font-medium text-xs truncate w-full" title={s.name}>
                      {s.name}
                    </span>
                    <span className="text-[10px] text-gray-500 truncate w-full">
                      {s.type === "RESTAURANT"
                        ? "Restaurante"
                        : s.type === "SHOP"
                        ? "Tienda"
                        : "Servicios"}
                    </span>
                    <span
                      className={`mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        s.status === "ACTIVE"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {s.status === "ACTIVE" ? "Activa" : "Inactiva"}
                    </span>
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
            <h2 className="text-lg font-semibold mb-4">{modal === "create" ? "Nueva tienda" : "Editar tienda"}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
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
                <label className="block text-sm text-gray-600">Tipo</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="RESTAURANT">Restaurante</option>
                  <option value="SHOP">Tienda</option>
                  <option value="SERVICE_PROVIDER">Proveedor de servicios</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600">Dirección</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Teléfono</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Logo de la tienda</label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleLogoChange}
                  disabled={logoUploading}
                  className="w-full border rounded px-3 py-2 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 file:text-sm file:font-medium"
                />
                {logoUploading && <p className="mt-1 text-xs text-gray-500">Subiendo…</p>}
                {form.logoUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <img
                      src={uploadsUrl(form.logoUrl)}
                      alt="Vista previa del logo"
                      className="w-16 h-16 rounded object-cover border bg-gray-100"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <span className="text-xs text-gray-500">Vista previa</span>
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
                <label className="block text-sm text-gray-600">Estado</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="ACTIVE">Activo</option>
                  <option value="INACTIVE">Inactivo</option>
                </select>
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
