export type LatLng = { lat: number; lng: number };

export const OUTSIDE_SERVICE_AREA_ERROR =
  "Esta ubicación está fuera del área de entrega. Mueve el pin dentro del polígono permitido.";

let cachedRing: LatLng[] | null | undefined;
let loadPromise: Promise<LatLng[] | null> | null = null;

function stripXmlComments(xml: string): string {
  return xml.replace(/<!--[\s\S]*?-->/g, "");
}

function parseFirstClosedRing(xml: string): LatLng[] | null {
  const startTag = xml.search(/<coordinates\b/i);
  if (startTag < 0) return null;
  const contentStart = xml.indexOf(">", startTag);
  if (contentStart < 0) return null;
  const endTag = xml.search(/<\/coordinates>/i);
  if (endTag < 0 || endTag <= contentStart) return null;
  const inner = xml.slice(contentStart + 1, endTag).trim();
  if (!inner) return null;

  const lonFirst = parseLonLatOrder(inner, true);
  if (lonFirst && lonFirst.length >= 3) return closeRing(lonFirst);
  const latFirst = parseLonLatOrder(inner, false);
  if (latFirst && latFirst.length >= 3) return closeRing(latFirst);
  return null;
}

function parseLonLatOrder(inner: string, lonFirst: boolean): LatLng[] | null {
  const points: LatLng[] = [];
  for (const token of inner.split(/\s+/)) {
    if (!token.trim()) continue;
    const parts = token.split(",");
    if (parts.length < 2) continue;
    const a = Number(parts[0]?.trim());
    const b = Number(parts[1]?.trim());
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const lat = lonFirst ? b : a;
    const lng = lonFirst ? a : b;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    points.push({ lat, lng });
  }
  return points.length >= 3 ? points : null;
}

function closeRing(points: LatLng[]): LatLng[] {
  const out = [...points];
  const first = out[0]!;
  const last = out[out.length - 1]!;
  if (first.lat !== last.lat || first.lng !== last.lng) {
    out.push({ lat: first.lat, lng: first.lng });
  }
  return out;
}

export async function loadServiceAreaRing(): Promise<LatLng[] | null> {
  if (cachedRing !== undefined) return cachedRing;
  if (!loadPromise) {
    loadPromise = fetch("/service_area.kml")
      .then((res) => (res.ok ? res.text() : ""))
      .then((raw) => {
        const xml = stripXmlComments(raw.replace(/^\uFEFF/, ""));
        cachedRing = parseFirstClosedRing(xml);
        return cachedRing;
      })
      .catch(() => {
        cachedRing = null;
        return cachedRing;
      });
  }
  return loadPromise;
}

export function pointInPolygon(lat: number, lng: number, vertices: LatLng[]): boolean {
  if (vertices.length < 3) return false;
  let inside = false;
  let j = vertices.length - 1;
  for (let i = 0; i < vertices.length; i++) {
    const vi = vertices[i]!;
    const vj = vertices[j]!;
    const intersect =
      vi.lng > lng !== vj.lng > lng &&
      lat < ((vj.lat - vi.lat) * (lng - vi.lng)) / (vj.lng - vi.lng) + vi.lat;
    if (intersect) inside = !inside;
    j = i;
  }
  return inside;
}

export function hasValidServiceAreaPolygon(): boolean {
  return cachedRing != null && cachedRing.length >= 3;
}

export function isInsideServiceArea(lat: number, lng: number): boolean {
  if (!cachedRing || cachedRing.length < 3) return true;
  return pointInPolygon(lat, lng, cachedRing);
}
