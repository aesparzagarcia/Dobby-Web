"use client";

import { useEffect, useRef, useState } from "react";
import { authHeaders, authHeadersForUpload, getToken, apiPath, uploadsUrl } from "@/lib/api";

const categoryLabels: Record<string, string> = {
  LIGHT: "Luz",
  GAS: "Gas",
  PHONE: "Teléfono",
  WATER: "Agua",
  OTHER: "Otro",
};

type Service = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  logoUrl: string | null;
  isActive: boolean;
};

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"closed" | "create" | "edit">("closed");
  const [form, setForm] = useState({ name: "", description: "", category: "OTHER", logoUrl: "", isActive: true });
  const [editId, setEditId] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  function load() {
    fetch(apiPath("/api/services"), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setServices(Array.isArray(data) ? data : []))
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => load(), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editId ? `/api/services/${editId}` : "/api/services";
    const method = editId ? "PUT" : "POST";
    const body = editId
      ? { name: form.name, description: form.description || null, category: form.category, logoUrl: form.logoUrl || null, isActive: form.isActive }
      : { ...form, logoUrl: form.logoUrl || null };
    const res = await fetch(apiPath(url), {
      method,
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setModal("closed");
      setEditId(null);
      setForm({ name: "", description: "", category: "OTHER", logoUrl: "", isActive: true });
      load();
    }
  }

  function openEdit(s: Service) {
    setEditId(s.id);
    setForm({
      name: s.name,
      description: s.description || "",
      category: s.category,
      logoUrl: s.logoUrl || "",
      isActive: s.isActive,
    });
    setModal("edit");
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este servicio?")) return;
    const res = await fetch(apiPath(`/api/services/${id}`), { method: "DELETE", headers: authHeaders() });
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
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Servicios</h1>
        <button
          onClick={() => { setModal("create"); setEditId(null); setForm({ name: "", description: "", category: "OTHER", logoUrl: "", isActive: true }); }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Añadir servicio
        </button>
      </div>
      {loading ? (
        <p className="text-gray-500">Cargando…</p>
      ) : (
        <div className="bg-white rounded-lg shadow p-4">
          {services.length === 0 ? (
            <p className="text-gray-500 text-sm">Aún no hay servicios registrados.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
              {services.map((s) => (
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
                      {categoryLabels[s.category] ?? s.category}
                    </span>
                    <span
                      className={`mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        s.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {s.isActive ? "Activo" : "Inactivo"}
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
            <h2 className="text-lg font-semibold mb-4">{modal === "create" ? "Nuevo servicio" : "Editar servicio"}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600">Logo del servicio</label>
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
                <label className="block text-sm text-gray-600">Nombre</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Categoría</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="LIGHT">Luz</option>
                  <option value="GAS">Gas</option>
                  <option value="PHONE">Teléfono</option>
                  <option value="WATER">Agua</option>
                  <option value="OTHER">Otro</option>
                </select>
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
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                <label htmlFor="isActive" className="text-sm">Activo</label>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  {modal === "create" ? "Crear" : "Guardar"}
                </button>
                <button type="button" onClick={() => setModal("closed")} className="border px-4 py-2 rounded hover:bg-gray-50">
                  Cancelar
                </button>
                {modal === "edit" && editId && (
                  <button
                    type="button"
                    onClick={() => { if (confirm("¿Eliminar este servicio?")) { handleDelete(editId); setModal("closed"); setEditId(null); } }}
                    className="ml-auto text-red-600 hover:underline text-sm"
                  >
                    Eliminar
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
