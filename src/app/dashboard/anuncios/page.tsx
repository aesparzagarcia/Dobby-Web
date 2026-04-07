"use client";

import { useEffect, useRef, useState } from "react";
import { authHeaders, authHeadersForUpload, getToken, apiPath, uploadsUrl } from "@/lib/api";

type Ad = {
  id: string;
  imageUrl: string | null;
  advertiserName: string;
  description: string | null;
  address: string | null;
  contactPhone: string | null;
  whatsapp: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  email: string | null;
  isActive: boolean;
};

const defaultForm = {
  imageUrl: "",
  advertiserName: "",
  description: "",
  address: "",
  contactPhone: "",
  whatsapp: "",
  facebookUrl: "",
  instagramUrl: "",
  email: "",
  isActive: true,
};

function mapsUrl(address: string): string {
  if (!address?.trim()) return "#";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

function whatsappUrl(phone: string): string {
  if (!phone?.trim()) return "#";
  const num = phone.replace(/\D/g, "");
  return `https://wa.me/${num}`;
}

export default function AnunciosPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"closed" | "create" | "edit">("closed");
  const [form, setForm] = useState(defaultForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  function load() {
    fetch(apiPath("/api/ads"), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setAds(Array.isArray(data) ? data : []))
      .catch(() => setAds([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => load(), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editId ? `/api/ads/${editId}` : "/api/ads";
    const method = editId ? "PUT" : "POST";
    const body = {
      imageUrl: form.imageUrl || null,
      advertiserName: form.advertiserName.trim(),
      description: form.description.trim() || null,
      address: form.address.trim() || null,
      contactPhone: form.contactPhone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      facebookUrl: form.facebookUrl.trim() || null,
      instagramUrl: form.instagramUrl.trim() || null,
      email: form.email.trim() || null,
      isActive: form.isActive,
    };
    const res = await fetch(apiPath(url), {
      method,
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setModal("closed");
      setEditId(null);
      setForm(defaultForm);
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Error al guardar");
    }
  }

  function openEdit(ad: Ad) {
    setEditId(ad.id);
    setForm({
      imageUrl: ad.imageUrl || "",
      advertiserName: ad.advertiserName || "",
      description: ad.description || "",
      address: ad.address || "",
      contactPhone: ad.contactPhone || "",
      whatsapp: ad.whatsapp || "",
      facebookUrl: ad.facebookUrl || "",
      instagramUrl: ad.instagramUrl || "",
      email: ad.email || "",
      isActive: ad.isActive,
    });
    setModal("edit");
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Solo se permiten imágenes (JPEG, PNG, GIF, WebP).");
      return;
    }
    const token = getToken();
    if (!token) {
      alert("Sesión expirada. Vuelve a iniciar sesión.");
      return;
    }
    setImageUploading(true);
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
      setForm((f) => ({ ...f, imageUrl: data.url }));
    } catch {
      alert("Error al subir la imagen");
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este anuncio?")) return;
    const res = await fetch(apiPath(`/api/ads/${id}`), { method: "DELETE", headers: authHeaders() });
    if (res.ok) load();
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Anuncios</h1>
        <button
          onClick={() => {
            setModal("create");
            setEditId(null);
            setForm(defaultForm);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Añadir anuncio
        </button>
      </div>
      {loading ? (
        <p className="text-gray-500">Cargando…</p>
      ) : (
        <div className="bg-white rounded-lg shadow p-4">
          {ads.length === 0 ? (
            <p className="text-gray-500 text-sm">Aún no hay anuncios.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
              {ads.map((ad) => (
                <button
                  key={ad.id}
                  type="button"
                  onClick={() => openEdit(ad)}
                  className="group flex flex-col items-center rounded-md border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-blue-400 transition overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 text-left"
                >
                  <div className="w-full h-28 bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                    {ad.imageUrl ? (
                      <img
                        src={uploadsUrl(ad.imageUrl)}
                        alt={ad.advertiserName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <span className="text-gray-400 text-[10px]">Sin imagen</span>
                    )}
                  </div>
                  <div className="w-full px-1.5 py-1 flex flex-col items-center text-center min-w-0">
                    <span className="font-medium text-xs truncate w-full" title={ad.advertiserName}>
                      {ad.advertiserName}
                    </span>
                    <span
                      className={`mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        ad.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {ad.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {modal !== "closed" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 my-8">
            <h2 className="text-lg font-semibold mb-4">
              {modal === "create" ? "Nuevo anuncio" : "Editar anuncio"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600">Imagen del anuncio</label>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleImageChange}
                  disabled={imageUploading}
                  className="w-full border rounded px-3 py-2 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700"
                />
                {imageUploading && <p className="mt-1 text-xs text-gray-500">Subiendo…</p>}
                {form.imageUrl && (
                  <img
                    src={uploadsUrl(form.imageUrl)}
                    alt="Vista previa"
                    className="mt-2 w-24 h-24 rounded object-cover border"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-600">Nombre del anunciante *</label>
                <input
                  value={form.advertiserName}
                  onChange={(e) => setForm((f) => ({ ...f, advertiserName: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Descripción del anuncio</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Dirección (se abre en Maps)</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Ej: Calle Principal 123, Ciudad"
                />
                {form.address.trim() && (
                  <a
                    href={mapsUrl(form.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                  >
                    Abrir en Google Maps →
                  </a>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600">Teléfono de contacto</label>
                  <input
                    type="tel"
                    value={form.contactPhone}
                    onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600">WhatsApp</label>
                  <input
                    type="tel"
                    value={form.whatsapp}
                    onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                    className="w-full border rounded px-3 py-2"
                    placeholder="Número con código de país"
                  />
                  {form.whatsapp.trim() && (
                    <a
                      href={whatsappUrl(form.whatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-600 hover:underline mt-1 inline-block"
                    >
                      Abrir WhatsApp →
                    </a>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600">Facebook (URL)</label>
                  <input
                    type="url"
                    value={form.facebookUrl}
                    onChange={(e) => setForm((f) => ({ ...f, facebookUrl: e.target.value }))}
                    className="w-full border rounded px-3 py-2"
                    placeholder="https://facebook.com/..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Instagram (URL)</label>
                  <input
                    type="url"
                    value={form.instagramUrl}
                    onChange={(e) => setForm((f) => ({ ...f, instagramUrl: e.target.value }))}
                    className="w-full border rounded px-3 py-2"
                    placeholder="https://instagram.com/..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600">Correo electrónico</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="adActive"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                <label htmlFor="adActive" className="text-sm">
                  Anuncio activo (visible)
                </label>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  {modal === "create" ? "Crear" : "Guardar"}
                </button>
                {modal === "edit" && (
                  <button
                    type="button"
                    onClick={() => editId && handleDelete(editId)}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                  >
                    Eliminar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModal("closed")}
                  className="border px-4 py-2 rounded hover:bg-gray-50"
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
