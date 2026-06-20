"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isTokenExpired } from "@/lib/api";
import {
  IconAds,
  IconClose,
  IconDashboard,
  IconDrivers,
  IconDobbyLogo,
  IconIncome,
  IconMenu,
  IconNotifications,
  IconOrders,
  IconProducts,
  IconServices,
  IconShipping,
  IconShop,
  IconStats,
} from "@/components/dashboard/NavIcons";
import { OrderAlertToasts } from "@/components/dashboard/OrderAlertToasts";
import { PreRegistrationAlertToasts } from "@/components/dashboard/PreRegistrationAlertToasts";
import {
  DashboardOrderAlertsProvider,
  useDashboardOrderAlerts,
} from "@/contexts/DashboardOrderAlertsContext";
import {
  DashboardPreRegistrationAlertsProvider,
  useDashboardPreRegistrationAlerts,
} from "@/contexts/DashboardPreRegistrationAlertsContext";

type StoredUser = { email?: string; name?: string; lastName?: string };

const nav = [
  { href: "/dashboard", label: "Resumen", icon: IconDashboard, badgeKey: null as string | null },
  { href: "/dashboard/income", label: "Ingresos", icon: IconIncome, badgeKey: null },
  { href: "/dashboard/pedidos", label: "Pedidos", icon: IconOrders, badgeKey: "orders" as const },
  { href: "/dashboard/shops", label: "Tiendas", icon: IconShop, badgeKey: null },
  { href: "/dashboard/notificaciones", label: "Notificaciones", icon: IconNotifications, badgeKey: "notifications" as const },
  { href: "/dashboard/services", label: "Servicios", icon: IconServices, badgeKey: null },
  { href: "/dashboard/products", label: "Productos", icon: IconProducts, badgeKey: null },
  { href: "/dashboard/anuncios", label: "Anuncios", icon: IconAds, badgeKey: null },
  { href: "/dashboard/configuracion", label: "Tarifas de envío", icon: IconShipping, badgeKey: null },
  { href: "/dashboard/repartidores", label: "Repartidores", icon: IconDrivers, badgeKey: null },
  { href: "/dashboard/analytics", label: "Estadísticas", icon: IconStats, badgeKey: null },
];

function DashboardLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { badgeCount } = useDashboardOrderAlerts();
  const { badgeCount: notificationBadge } = useDashboardPreRegistrationAlerts();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (mediaQuery.matches) setSidebarOpen(false);
    };

    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

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
      <PreRegistrationAlertToasts />

      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-200 ease-in-out lg:static lg:max-w-none lg:translate-x-0 lg:shrink-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 min-w-0"
            onClick={() => setSidebarOpen(false)}
          >
            <IconDobbyLogo className="w-8 h-8 shrink-0" />
            <span className="font-bold text-lg text-gray-900 tracking-tight">Dobby</span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 -mr-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            aria-label="Cerrar menú"
          >
            <IconClose />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {nav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
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
                {item.badgeKey === "notifications" && notificationBadge > 0 ? (
                  <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-dobby-600 text-white text-xs font-bold flex items-center justify-center">
                    {notificationBadge > 99 ? "99+" : notificationBadge}
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

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className="p-1.5 -ml-1.5 rounded-lg text-gray-700 hover:bg-gray-100"
            aria-label={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <IconClose /> : <IconMenu />}
          </button>
          <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
            <IconDobbyLogo className="w-7 h-7 shrink-0" />
            <span className="font-bold text-base text-gray-900 tracking-tight truncate">Dobby</span>
          </Link>
        </header>
        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>
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
      <DashboardPreRegistrationAlertsProvider>
        <DashboardLayoutShell>{children}</DashboardLayoutShell>
      </DashboardPreRegistrationAlertsProvider>
    </DashboardOrderAlertsProvider>
  );
}
