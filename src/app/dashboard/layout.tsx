"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isTokenExpired } from "@/lib/api";
import {
  IconAds,
  IconDashboard,
  IconDrivers,
  IconDobbyLogo,
  IconIncome,
  IconOrders,
  IconProducts,
  IconServices,
  IconShipping,
  IconShop,
  IconStats,
} from "@/components/dashboard/NavIcons";
import { OrderAlertToasts } from "@/components/dashboard/OrderAlertToasts";
import {
  DashboardOrderAlertsProvider,
  useDashboardOrderAlerts,
} from "@/contexts/DashboardOrderAlertsContext";

type StoredUser = { email?: string; name?: string; lastName?: string };

const nav = [
  { href: "/dashboard", label: "Resumen", icon: IconDashboard, badgeKey: null as string | null },
  { href: "/dashboard/income", label: "Ingresos", icon: IconIncome, badgeKey: null },
  { href: "/dashboard/pedidos", label: "Pedidos", icon: IconOrders, badgeKey: "orders" as const },
  { href: "/dashboard/shops", label: "Tiendas", icon: IconShop, badgeKey: null },
  { href: "/dashboard/services", label: "Servicios", icon: IconServices, badgeKey: null },
  { href: "/dashboard/products", label: "Productos", icon: IconProducts, badgeKey: null },
  { href: "/dashboard/anuncios", label: "Anuncios", icon: IconAds, badgeKey: null },
  { href: "/dashboard/configuracion", label: "Tarifas de envío", icon: IconShipping, badgeKey: null },
  { href: "/dashboard/delivery-men", label: "Repartidores", icon: IconDrivers, badgeKey: null },
  { href: "/dashboard/analytics", label: "Estadísticas", icon: IconStats, badgeKey: null },
];

function DashboardLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { badgeCount } = useDashboardOrderAlerts();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
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
    try {
      const raw = localStorage.getItem("user");
      if (raw) setUser(JSON.parse(raw) as StoredUser);
    } catch {
      setUser(null);
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
      <div className="min-h-screen flex items-center justify-center bg-dobby-page">
        <p className="text-gray-500">Cargando…</p>
      </div>
    );
  }

  const displayName =
    [user?.name, user?.lastName].filter(Boolean).join(" ").trim() || "Admin Dobby";

  return (
    <div className="min-h-screen flex bg-dobby-page">
      <OrderAlertToasts />
      <aside className="w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-5 border-b border-gray-100">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <IconDobbyLogo className="w-8 h-8 shrink-0" />
            <span className="font-bold text-lg text-gray-900 tracking-tight">Dobby</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {nav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-dobby-50 text-dobby-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 ${active ? "text-dobby-600" : "text-gray-400"}`}
                />
                <span className="flex-1">{item.label}</span>
                {item.badgeKey === "orders" && badgeCount > 0 ? (
                  <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-dobby-600 text-white text-xs font-bold flex items-center justify-center">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-100 space-y-2">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-9 h-9 rounded-full bg-dobby-100 text-dobby-700 flex items-center justify-center text-sm font-semibold shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email ?? ""}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardOrderAlertsProvider>
      <DashboardLayoutShell>{children}</DashboardLayoutShell>
    </DashboardOrderAlertsProvider>
  );
}
