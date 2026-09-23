export function isAdminPanelRole(role: string | undefined | null): boolean {
  return role === "ADMIN" || role === "ADMIN_VIEWER";
}

export function canWriteAdmin(role: string | undefined | null): boolean {
  return role === "ADMIN";
}

/** Tarifas, ingresos y estadísticas: solo el dueño (ADMIN). */
export function isOwnerOnlyAdminPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname === "/dashboard/income" ||
    pathname.startsWith("/dashboard/income/") ||
    pathname === "/dashboard/configuracion" ||
    pathname.startsWith("/dashboard/configuracion/") ||
    pathname === "/dashboard/analytics" ||
    pathname.startsWith("/dashboard/analytics/")
  );
}
