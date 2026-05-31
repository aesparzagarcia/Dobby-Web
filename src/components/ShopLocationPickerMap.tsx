"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

const MAP_OPTIONS: L.MapOptions = { inertia: false };

/** Igual que en Dobby Android: debounce al mover la cámara antes de geocodificar. */
const MAP_MOVE_DEBOUNCE_MS = 550;
const REVERSE_GEO_IDLE_MS = 450;

/** Centro por defecto del mapa (región solicitada). */
export const DEFAULT_SHOP_MAP_CENTER: [number, number] = [20.649348, -103.702294];

type NominatimAddress = Partial<Record<string, string>>;

/** Calle y número, colonia y ciudad (sin país, CP ni estado). */
function formatShortAddress(addr: NominatimAddress): string {
  const house = addr.house_number?.trim() ?? "";
  const road = (
    addr.road || addr.pedestrian || addr.footway || addr.residential || addr.path || ""
  ).trim();

  let street = "";
  if (road && house) street = `${road} ${house}`.trim();
  else if (road) street = road;
  else if (house) street = house;

  const col = (
    addr.neighbourhood ||
    addr.suburb ||
    addr.quarter ||
    addr.city_district ||
    addr.district ||
    ""
  ).trim();

  const city = (addr.city || addr.town || addr.village || addr.municipality || "").trim();

  const parts = [street, col, city].filter((p) => p.length > 0);
  return parts.join(", ");
}

function fallbackShortFromDisplayName(displayName: string): string {
  const parts = displayName
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.slice(0, 3).join(", ");
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lng))}&accept-language=es`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: NominatimAddress; display_name?: string };
    const fromParts = data.address ? formatShortAddress(data.address) : "";
    if (fromParts.length > 0) return fromParts;
    const dn = data.display_name?.trim();
    if (dn) return fallbackShortFromDisplayName(dn);
    return null;
  } catch {
    return null;
  }
}

function CenterPinOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center">
      <svg
        width={48}
        height={48}
        viewBox="0 0 24 24"
        className="text-blue-600 drop-shadow-md -mt-6"
        fill="currentColor"
        aria-hidden
      >
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
      </svg>
    </div>
  );
}

type MapCenterTrackerProps = {
  onCenterIdle: (lat: number, lng: number) => void;
  onCenterFlush: (lat: number, lng: number) => void;
};

/**
 * Lee el centro del mapa (donde apunta el pin fijo) al desplazar, con debounce como MapLocationScreen en Android.
 */
function MapCenterTracker({ onCenterIdle, onCenterFlush }: MapCenterTrackerProps) {
  const map = useMap();
  const moveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearMoveTimer = () => {
      if (moveDebounceRef.current) {
        clearTimeout(moveDebounceRef.current);
        moveDebounceRef.current = null;
      }
    };

    const readCenter = () => {
      const c = map.getCenter();
      return { lat: c.lat, lng: c.lng };
    };

    const scheduleIdle = () => {
      clearMoveTimer();
      moveDebounceRef.current = setTimeout(() => {
        moveDebounceRef.current = null;
        const { lat, lng } = readCenter();
        onCenterIdle(lat, lng);
      }, MAP_MOVE_DEBOUNCE_MS);
    };

    const flush = () => {
      clearMoveTimer();
      const { lat, lng } = readCenter();
      onCenterFlush(lat, lng);
    };

    const onReady = () => {
      flush();
    };

    map.whenReady(onReady);
    map.on("move", scheduleIdle);
    map.on("moveend", flush);

    return () => {
      clearMoveTimer();
      map.off("move", scheduleIdle);
      map.off("moveend", flush);
    };
  }, [map, onCenterIdle, onCenterFlush]);

  return null;
}

export type ShopLocationPickerMapProps = {
  initialLat: number | null;
  initialLng: number | null;
  initialAddress: string;
  /** Centro inicial cuando la tienda aún no tiene coordenadas guardadas. */
  fallbackCenter?: [number, number];
  onApply: (lat: number, lng: number, address: string) => void;
  onClose: () => void;
};

export function ShopLocationPickerMap({
  initialLat,
  initialLng,
  initialAddress,
  fallbackCenter = DEFAULT_SHOP_MAP_CENTER,
  onApply,
  onClose,
}: ShopLocationPickerMapProps) {
  const hasInitialCoords =
    initialLat != null && initialLng != null && Number.isFinite(initialLat) && Number.isFinite(initialLng);

  const [lat, setLat] = useState<number>(() => (hasInitialCoords ? initialLat! : fallbackCenter[0]));
  const [lng, setLng] = useState<number>(() => (hasInitialCoords ? initialLng! : fallbackCenter[1]));
  const [addressText, setAddressText] = useState(initialAddress);
  const [geocoding, setGeocoding] = useState(false);

  /** Centro actual del mapa (sincronizado al mover); al aplicar se persisten estas coords en el formulario de la tienda. */
  const latestCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  if (latestCenterRef.current === null) {
    latestCenterRef.current = {
      lat: hasInitialCoords ? initialLat! : fallbackCenter[0],
      lng: hasInitialCoords ? initialLng! : fallbackCenter[1],
    };
  }

  const initialMapCenterRef = useRef<L.LatLngTuple | null>(null);
  if (initialMapCenterRef.current === null) {
    initialMapCenterRef.current = hasInitialCoords ? [initialLat!, initialLng!] : fallbackCenter;
  }

  const reverseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queueReverseGeocode = useCallback((nextLat: number, nextLng: number, flush: boolean) => {
    const run = async () => {
      reverseTimerRef.current = null;
      setGeocoding(true);
      const name = await reverseGeocode(nextLat, nextLng);
      setGeocoding(false);
      if (name) setAddressText(name);
    };

    if (reverseTimerRef.current) {
      clearTimeout(reverseTimerRef.current);
      reverseTimerRef.current = null;
    }

    if (flush) {
      void run();
    } else {
      reverseTimerRef.current = setTimeout(() => void run(), REVERSE_GEO_IDLE_MS);
    }
  }, []);

  const onCenterIdle = useCallback(
    (nextLat: number, nextLng: number) => {
      latestCenterRef.current = { lat: nextLat, lng: nextLng };
      setLat(nextLat);
      setLng(nextLng);
      queueReverseGeocode(nextLat, nextLng, false);
    },
    [queueReverseGeocode]
  );

  const onCenterFlush = useCallback(
    (nextLat: number, nextLng: number) => {
      latestCenterRef.current = { lat: nextLat, lng: nextLng };
      setLat(nextLat);
      setLng(nextLng);
      queueReverseGeocode(nextLat, nextLng, true);
    },
    [queueReverseGeocode]
  );

  useEffect(() => {
    return () => {
      if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-600">
        Desplaza el mapa; el pin indica la ubicación. La dirección se actualiza según el centro del mapa.
      </p>
      <div className="relative h-[280px] w-full rounded-lg overflow-hidden border border-gray-200 z-0">
        <MapContainer
          center={initialMapCenterRef.current}
          zoom={16}
          className="h-full w-full"
          scrollWheelZoom
          {...MAP_OPTIONS}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapCenterTracker onCenterIdle={onCenterIdle} onCenterFlush={onCenterFlush} />
        </MapContainer>
        <CenterPinOverlay />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Dirección (puedes editarla antes de aplicar)</label>
        <textarea
          value={addressText}
          onChange={(e) => setAddressText(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm min-h-[72px]"
          rows={3}
        />
        {geocoding && <p className="mt-1 text-xs text-gray-500">Buscando dirección…</p>}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="border px-4 py-2 rounded hover:bg-gray-50 text-sm">
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            const addr = addressText.trim();
            if (!addr) {
              alert("Indica una dirección o espera a que se cargue desde el mapa.");
              return;
            }
            const c = latestCenterRef.current!;
            onApply(c.lat, c.lng, addr);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
        >
          Aplicar ubicación
        </button>
      </div>
    </div>
  );
}
