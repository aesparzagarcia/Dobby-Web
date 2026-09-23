export function isAdminPanelRole(role: string | undefined | null): boolean {
  return role === "ADMIN" || role === "ADMIN_VIEWER";
}

export function canWriteAdmin(role: string | undefined | null): boolean {
  return role === "ADMIN";
}
