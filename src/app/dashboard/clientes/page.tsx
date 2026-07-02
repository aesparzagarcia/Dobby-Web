"use client";

import { useEffect, useMemo, useState } from "react";
import { authHeaders, apiPath } from "@/lib/api";

type Client = {
  id: string;
  name: string | null;
  lastName: string | null;
  createdAt: string;
  dobbyXp: number;
  orderStreakDays: number;
  levelKey: string;
  levelName: string;
  addressCount: number;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
};

const PAGE_SIZE = 16;

function displayName(client: Client) {
  const name = [client.name, client.lastName].filter(Boolean).join(" ").trim();
  return name || "Sin nombre";
}

function formatDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function ClientesPage() {
  const [list, setList] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "orders" | "spent" | "xp">("recent");
  const [page, setPage] = useState(1);

  function load() {
    setLoading(true);
    fetch(apiPath("/api/clients"), { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => load(), []);

  useEffect(() => {
    setPage(1);
  }, [search, sortBy]);

  const filtered = useMemo(() => {
    let items = [...list];
    const q = search.trim().toLowerCase();
    if (q) {
      items = items.filter((c) => displayName(c).toLowerCase().includes(q));
    }
    items.sort((a, b) => {
      if (sortBy === "name") return displayName(a).localeCompare(displayName(b), "es");
      if (sortBy === "orders") return b.orderCount - a.orderCount;
      if (sortBy === "spent") return b.totalSpent - a.totalSpent;
      if (sortBy === "xp") return b.dobbyXp - a.dobbyXp;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return items;
  }, [list, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Usuarios registrados en la app. Se muestra información general y de actividad, sin datos sensibles
          como correo, teléfono ni direcciones.
        </p>
      </div>

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
            placeholder="Buscar por nombre..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-dobby-500/30 focus:border-dobby-400"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <span className="whitespace-nowrap">Ordenar por:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm min-w-[150px] focus:outline-none focus:ring-2 focus:ring-dobby-500/30"
          >
            <option value="recent">Más recientes</option>
            <option value="name">Nombre</option>
            <option value="orders">Más pedidos</option>
            <option value="spent">Mayor gasto</option>
            <option value="xp">Más XP</option>
          </select>
        </label>
      </div>

      {!loading && list.length > 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          {list.length} cliente{list.length !== 1 ? "s" : ""} registrado{list.length !== 1 ? "s" : ""}
        </p>
      ) : null}

      {loading ? (
        <p className="text-gray-500 mt-10">Cargando clientes…</p>
      ) : filtered.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500 text-sm">
            {list.length === 0
              ? "Aún no hay clientes registrados en la app."
              : "No hay clientes que coincidan con tu búsqueda."}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/90">
                  {[
                    "Cliente",
                    "Nivel",
                    "XP",
                    "Racha",
                    "Pedidos",
                    "Gasto total",
                    "Último pedido",
                    "Registro",
                    "Direcciones",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pageItems.map((client) => (
                  <tr key={client.id} className="hover:bg-dobby-50/30 transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-medium text-gray-900">{displayName(client)}</p>
                      <p className="text-xs text-gray-400 mt-0.5 font-mono truncate max-w-[140px]" title={client.id}>
                        {client.id.slice(0, 8)}…
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-700 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-dobby-50 text-dobby-700 text-xs font-medium">
                        {client.levelName}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-700 whitespace-nowrap">{client.dobbyXp}</td>
                    <td className="px-4 py-3.5 text-sm text-gray-700 whitespace-nowrap">
                      {client.orderStreakDays > 0 ? (
                        <span>{client.orderStreakDays} día{client.orderStreakDays !== 1 ? "s" : ""}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-900 font-medium whitespace-nowrap">
                      {client.orderCount}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-700 whitespace-nowrap">
                      {client.totalSpent > 0 ? formatMoney(client.totalSpent) : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-700 whitespace-nowrap">
                      {formatDate(client.lastOrderAt)}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-700 whitespace-nowrap">
                      {formatDate(client.createdAt)}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-700 whitespace-nowrap">
                      {client.addressCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              Mostrando {rangeStart} a {rangeEnd} de {filtered.length} cliente
              {filtered.length !== 1 ? "s" : ""}
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
    </div>
  );
}
