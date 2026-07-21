/** Rejects null island and coords that are numeric but unusable for delivery/maps. */
export function isUsableWgs84Point(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if (Math.abs(lat) < 1e-5 && Math.abs(lng) < 1e-5) return false;
  return true;
}

export function shopLocationError(): string {
  return "Selecciona la ubicación en el mapa y pulsa «Aplicar ubicación» antes de guardar.";
}
