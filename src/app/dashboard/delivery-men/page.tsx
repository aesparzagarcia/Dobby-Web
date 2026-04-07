"use client";

import { useEffect, useRef, useState } from "react";
import { authHeaders, authHeadersForUpload, getToken, apiPath, uploadsUrl } from "@/lib/api";

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
  user: { id: string; email: string };
};

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
  status: "OFFLINE" as const,
};

export default function DeliveryMenPage() {
  const [list, setList] = useState<DeliveryMan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"closed" | "create" | "edit">("closed");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [profilePhotoUploading, setProfilePhotoUploading] = useState(false);
  const [idFrontUploading, setIdFrontUploading] = useState(false);
  const [idBackUploading, setIdBackUploading] = useState(false);
  const profilePhotoRef = useRef<HTMLInputElement>(null);
  const idFrontRef = useRef<HTMLInputElement>(null);
  const idBackRef = useRef<HTMLInputElement>(null);

  function load() {
    fetch(apiPath("/api/delivery-men"), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => load(), []);

  function openEdit(d: DeliveryMan) {
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
      status: (d.status === "ONLINE" || d.status === "ON_DELIVERY" ? d.status : "OFFLINE") as "OFFLINE" | "ONLINE" | "ON_DELIVERY",
    });
    setModal("edit");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editId) {
      const res = await fetch(apiPath(`/api/delivery-men/${editId}`), {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          name: form.name,
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Error al guardar");
        return;
      }
    } else {
      const res = await fetch(apiPath("/api/delivery-men"), {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          name: form.name,
          profilePhotoUrl: form.profilePhotoUrl || undefined,
          address: form.address || undefined,
          celphone: form.celphone || undefined,
          idImageFrontUrl: form.idImageFrontUrl || undefined,
          idImageBackUrl: form.idImageBackUrl || undefined,
          referenceName: form.referenceName || undefined,
          referencePhone: form.referencePhone || undefined,
          referenceAddress: form.referenceAddress || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Error al crear repartidor");
        return;
      }
    }
    setModal("closed");
    setEditId(null);
    setForm(defaultForm);
    load();
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
      setForm((f) => (side === "front" ? { ...f, idImageFrontUrl: data.url } : { ...f, idImageBackUrl: data.url }));
    } catch {
      alert("Error al subir la imagen");
    } finally {
      if (side === "front") setIdFrontUploading(false);
      else setIdBackUploading(false);
      if (side === "front" && idFrontRef.current) idFrontRef.current.value = "";
      if (side === "back" && idBackRef.current) idBackRef.current.value = "";
    }
  }

  const statusColor: Record<string, string> = {
    OFFLINE: "bg-gray-200 text-gray-700",
    ONLINE: "bg-green-100 text-green-800",
    ON_DELIVERY: "bg-amber-100 text-amber-800",
  };

  const statusLabel: Record<string, string> = {
    OFFLINE: "Desconectado",
    ONLINE: "En línea",
    ON_DELIVERY: "En reparto",
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Repartidores</h1>
        <button
          type="button"
          onClick={() => { setModal("create"); setEditId(null); setForm({ ...defaultForm, status: "OFFLINE" }); }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Añadir repartidor
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Lista de personal de reparto. Haz clic en una tarjeta para editar. El estado se puede cambiar al editar.
      </p>
      {loading ? (
        <p className="text-gray-500">Cargando…</p>
      ) : (
        <div className="bg-white rounded-lg shadow p-4">
          {list.length === 0 ? (
            <p className="text-gray-500 text-sm">Aún no hay repartidores. Usa &quot;Añadir repartidor&quot; para registrar uno.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
              {list.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => openEdit(d)}
                  className="group flex flex-col items-center rounded-md border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-blue-400 transition overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                >
                  <div className="w-full h-28 bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                    {d.profilePhotoUrl ? (
                      <img
                        src={uploadsUrl(d.profilePhotoUrl)}
                        alt={d.name}
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <span className="text-gray-400 text-[10px]">Sin foto</span>
                    )}
                  </div>
                  <div className="w-full px-1.5 py-1 flex flex-col items-center text-center min-w-0">
                    <span className="font-medium text-xs truncate w-full" title={d.name}>
                      {d.name || "—"}
                    </span>
                    <span className="text-[10px] text-gray-500 truncate w-full" title={d.user?.email}>
                      {d.user?.email ?? "—"}
                    </span>
                    <span
                      className={`mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        statusColor[d.status] || "bg-gray-100"
                      }`}
                    >
                      {statusLabel[d.status] || d.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {(modal === "create" || modal === "edit") && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6 my-8">
            <h2 className="text-lg font-semibold mb-4">{modal === "create" ? "Nuevo repartidor" : "Editar repartidor"}</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600">Foto de perfil</label>
                <input
                  ref={profilePhotoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={(e) => e.target.files?.[0] && handleProfilePhotoUpload(e.target.files[0])}
                  disabled={profilePhotoUploading}
                  className="w-full border rounded px-3 py-2 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700"
                />
                {profilePhotoUploading && <p className="mt-1 text-xs text-gray-500">Subiendo…</p>}
                {form.profilePhotoUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={uploadsUrl(form.profilePhotoUrl)} alt="Foto de perfil" className="w-16 h-16 rounded-full object-cover border bg-gray-100" />
                    <button type="button" onClick={() => setForm((f) => ({ ...f, profilePhotoUrl: "" }))} className="text-xs text-red-600 hover:underline">Quitar</button>
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
                <label className="block text-sm text-gray-600">Celular</label>
                <input
                  type="tel"
                  value={form.celphone}
                  onChange={(e) => setForm((f) => ({ ...f, celphone: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-gray-600">Dirección</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              {modal === "create" ? (
                <>
                  <div>
                    <label className="block text-sm text-gray-600">Correo</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full border rounded px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Contraseña inicial</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      className="w-full border rounded px-3 py-2"
                      required
                      minLength={6}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-gray-600">Correo</label>
                    <input
                      type="email"
                      value={form.email}
                      readOnly
                      className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600"
                    />
                    <p className="text-xs text-gray-500 mt-0.5">El correo no se puede cambiar.</p>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Estado</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "OFFLINE" | "ONLINE" | "ON_DELIVERY" }))}
                      className="w-full border rounded px-3 py-2"
                    >
                      <option value="OFFLINE">Desconectado</option>
                      <option value="ONLINE">En línea</option>
                      <option value="ON_DELIVERY">En reparto</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm text-gray-600">Identificación (anverso)</label>
                <input
                  ref={idFrontRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={(e) => e.target.files?.[0] && handleIdUpload("front", e.target.files[0])}
                  disabled={idFrontUploading}
                  className="w-full border rounded px-3 py-2 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700"
                />
                {idFrontUploading && <p className="mt-1 text-xs text-gray-500">Subiendo…</p>}
                {form.idImageFrontUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={uploadsUrl(form.idImageFrontUrl)} alt="ID anverso" className="w-20 h-14 rounded object-cover border bg-gray-100" />
                    <button type="button" onClick={() => setForm((f) => ({ ...f, idImageFrontUrl: "" }))} className="text-xs text-red-600 hover:underline">Quitar</button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-600">Identificación (reverso)</label>
                <input
                  ref={idBackRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={(e) => e.target.files?.[0] && handleIdUpload("back", e.target.files[0])}
                  disabled={idBackUploading}
                  className="w-full border rounded px-3 py-2 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700"
                />
                {idBackUploading && <p className="mt-1 text-xs text-gray-500">Subiendo…</p>}
                {form.idImageBackUrl && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={uploadsUrl(form.idImageBackUrl)} alt="ID reverso" className="w-20 h-14 rounded object-cover border bg-gray-100" />
                    <button type="button" onClick={() => setForm((f) => ({ ...f, idImageBackUrl: "" }))} className="text-xs text-red-600 hover:underline">Quitar</button>
                  </div>
                )}
              </div>

              <div className="sm:col-span-2 border-t pt-3 mt-1">
                <p className="text-sm font-medium text-gray-700 mb-2">Referencia</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600">Nombre</label>
                    <input
                      value={form.referenceName}
                      onChange={(e) => setForm((f) => ({ ...f, referenceName: e.target.value }))}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600">Teléfono</label>
                    <input
                      type="tel"
                      value={form.referencePhone}
                      onChange={(e) => setForm((f) => ({ ...f, referencePhone: e.target.value }))}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-600">Dirección</label>
                    <input
                      value={form.referenceAddress}
                      onChange={(e) => setForm((f) => ({ ...f, referenceAddress: e.target.value }))}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2 flex gap-2 pt-2">
                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  {modal === "create" ? "Crear repartidor" : "Guardar"}
                </button>
                <button type="button" onClick={() => { setModal("closed"); setEditId(null); setForm(defaultForm); }} className="border px-4 py-2 rounded hover:bg-gray-50">
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
