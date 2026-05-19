"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isTokenExpired } from "@/lib/api";

const nav = [
  { href: "/dashboard", label: "Resumen" },
  { href: "/dashboard/income", label: "Ingresos" },
  { href: "/dashboard/pedidos", label: "Pedidos" },
  { href: "/dashboard/shops", label: "Tiendas" },
  { href: "/dashboard/services", label: "Servicios" },
  { href: "/dashboard/products", label: "Productos" },
  { href: "/dashboard/anuncios", label: "Anuncios" },
  { href: "/dashboard/configuracion", label: "Tarifas de envío" },
  { href: "/dashboard/delivery-men", label: "Repartidores" },
  { href: "/dashboard/analytics", label: "Estadísticas" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const logoutRef = useRef<() => void>(() => {});

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    document.cookie = "ewe_token=; path=/; max-age=0";
    router.replace("/login");
    router.refresh();
  }

  logoutRef.current = logout;

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.replace("/login");
      return;
    }
    if (isTokenExpired()) {
      logout();
      return;
    }
    setMounted(true);

    const interval = setInterval(() => {
      if (isTokenExpired()) {
        clearInterval(interval);
        logoutRef.current();
      }
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [router]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-gray-800 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <Link href="/dashboard" className="font-semibold text-lg">
            Ewe Delivery
          </Link>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded text-sm ${
                pathname === item.href
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t border-gray-700">
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 rounded text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
