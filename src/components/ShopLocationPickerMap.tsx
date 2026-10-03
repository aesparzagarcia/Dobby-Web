"use client";

import { memo, useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

import { isUsableWgs84Point } from "@/lib/geo";
import {
  detailsGooglePlace,
  forwardGeocodeGoogle,
  getGoogleMapsBrowserKey,
  loadGoogleMapsScript,
  onGoogleMapsAuthFailure,
  reverseGeocodeGoogle,
  suggestGooglePlaces,
  type PlaceSuggestion,
} from "@/lib/googleMaps";
import {
  getServiceAreaBounds,
  hasValidServiceAreaPolygon,
  isInsideServiceArea,
  loadServiceAreaRing,
  OUTSIDE_SERVICE_AREA_ERROR,
} from "@/lib/serviceArea";

const MAP_OPTIONS: L.MapOptions = {
  inertia: false,
  minZoom: 14,
  maxZoom: 20,
  scrollWheelZoom: false,
  doubleClickZoom: false,
  boxZoom: false,
  zoomControl: true,
};

const GOOGLE_MAP_MIN_ZOOM = 14;
const GOOGLE_MAP_MAX_ZOOM = 21;
const GOOGLE_MAP_DEFAULT_ZOOM = 18;

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

async function reverseGeocodeNominatim(lat: number, lng: number): Promise<string | null> {
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

async function searchNominatim(query: string): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const bounds = getServiceAreaBounds();
  const viewbox = bounds
    ? `&viewbox=${encodeURIComponent(`${bounds.west},${bounds.north},${bounds.east},${bounds.south}`)}&bounded=0`
    : "";
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=mx&accept-language=es&q=${encodeURIComponent(q)}${viewbox}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const data = (await res.json()) as Array<{
      lat?: string;
      lon?: string;
      display_name?: string;
      address?: NominatimAddress;
    }>;
    const hits: PlaceSuggestion[] = [];
    for (const row of data) {
      const lat = Number(row.lat);
      const lng = Number(row.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const fromParts = row.address ? formatShortAddress(row.address) : "";
      const label =
        fromParts ||
        (row.display_name ? fallbackShortFromDisplayName(row.display_name) : q);
      hits.push({
        placeId: null,
        label,
        secondary: row.display_name?.trim() || "",
        lat,
        lng,
        address: label,
      });
    }
    return hits;
  } catch {
    return [];
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const fromGoogle = await reverseGeocodeGoogle(lat, lng);
  if (fromGoogle) return fromGoogle;
  return reverseGeocodeNominatim(lat, lng);
}

function CenterPinOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center">
      <svg
        width={48}
        height={48}
        viewBox="0 0 24 24"
        className="text-dobby-600 drop-shadow-md -mt-6"
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
  const onCenterIdleRef = useRef(onCenterIdle);
  const onCenterFlushRef = useRef(onCenterFlush);

  onCenterIdleRef.current = onCenterIdle;
  onCenterFlushRef.current = onCenterFlush;

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
        onCenterIdleRef.current(lat, lng);
      }, MAP_MOVE_DEBOUNCE_MS);
    };

    const flush = () => {
      clearMoveTimer();
      const { lat, lng } = readCenter();
      onCenterFlushRef.current(lat, lng);
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
  }, [map]);

  return null;
}

/** Evita saltos de zoom cuando el modal termina de medir su tamaño. */
function MapLayoutFix() {
  const map = useMap();

  useEffect(() => {
    const fix = () => {
      if (!map.getContainer()?.isConnected) return;
      map.invalidateSize({ animate: false });
    };

    const raf = requestAnimationFrame(fix);
    const t1 = window.setTimeout(fix, 120);
    const t2 = window.setTimeout(fix, 400);

    const container = map.getContainer();
    let resizeTimer: number | null = null;
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            if (resizeTimer != null) window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(fix, 150);
          })
        : null;
    observer?.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      if (resizeTimer != null) window.clearTimeout(resizeTimer);
      observer?.disconnect();
    };
  }, [map]);

  return null;
}

function MapPanBridge({
  panToRef,
}: {
  panToRef: MutableRefObject<((lat: number, lng: number) => void) | null>;
}) {
  const map = useMap();

  useEffect(() => {
    panToRef.current = (lat, lng) => {
      map.setView([lat, lng], Math.max(map.getZoom(), 17), { animate: true });
    };
    return () => {
      panToRef.current = null;
    };
  }, [map, panToRef]);

  return null;
}

type ShopLocationMapCanvasProps = {
  initialCenter: L.LatLngTuple;
  onCenterIdle: (lat: number, lng: number) => void;
  onCenterFlush: (lat: number, lng: number) => void;
  panToRef: MutableRefObject<((lat: number, lng: number) => void) | null>;
};

function ShopLocationGoogleMapCanvas({
  initialCenter,
  onCenterIdle,
  onCenterFlush,
  panToRef,
}: ShopLocationMapCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const onCenterIdleRef = useRef(onCenterIdle);
  const onCenterFlushRef = useRef(onCenterFlush);
  const moveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  onCenterIdleRef.current = onCenterIdle;
  onCenterFlushRef.current = onCenterFlush;

  useEffect(() => {
    const host = hostRef.current;
    const apiKey = getGoogleMapsBrowserKey();
    if (!host || !apiKey) return;
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    const listeners: google.maps.MapsEventListener[] = [];

    const clearMoveTimer = () => {
      if (moveDebounceRef.current) {
        clearTimeout(moveDebounceRef.current);
        moveDebounceRef.current = null;
      }
    };

    let t1 = 0;
    let t2 = 0;

    void loadGoogleMapsScript(apiKey)
      .then(() => {
        if (cancelled || !hostRef.current) return;
        const map = new google.maps.Map(hostRef.current, {
          center: { lat: initialCenter[0], lng: initialCenter[1] },
          zoom: GOOGLE_MAP_DEFAULT_ZOOM,
          minZoom: GOOGLE_MAP_MIN_ZOOM,
          maxZoom: GOOGLE_MAP_MAX_ZOOM,
          mapTypeId: "roadmap",
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: google.maps.ControlPosition.LEFT_TOP },
          gestureHandling: "greedy",
          scrollwheel: false,
          clickableIcons: false,
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
          keyboardShortcuts: false,
        });
        mapRef.current = map;
        panToRef.current = (lat, lng) => {
          map.panTo({ lat, lng });
          const zoom = map.getZoom() ?? GOOGLE_MAP_DEFAULT_ZOOM;
          if (zoom < GOOGLE_MAP_DEFAULT_ZOOM) map.setZoom(GOOGLE_MAP_DEFAULT_ZOOM);
        };

        const readCenter = () => {
          const c = map.getCenter();
          if (!c) return null;
          return { lat: c.lat(), lng: c.lng() };
        };

        const scheduleIdle = () => {
          clearMoveTimer();
          moveDebounceRef.current = setTimeout(() => {
            moveDebounceRef.current = null;
            const c = readCenter();
            if (c) onCenterIdleRef.current(c.lat, c.lng);
          }, MAP_MOVE_DEBOUNCE_MS);
        };

        const flush = () => {
          clearMoveTimer();
          const c = readCenter();
          if (c) onCenterFlushRef.current(c.lat, c.lng);
        };

        listeners.push(map.addListener("center_changed", scheduleIdle));
        listeners.push(map.addListener("idle", flush));
        flush();

        const fixSize = () => {
          if (cancelled || !mapRef.current) return;
          google.maps.event.trigger(map, "resize");
          const c = readCenter();
          if (c) map.setCenter(c);
        };
        t1 = window.setTimeout(fixSize, 120);
        t2 = window.setTimeout(fixSize, 400);
        if (typeof ResizeObserver !== "undefined" && hostRef.current) {
          resizeObserver = new ResizeObserver(() => fixSize());
          resizeObserver.observe(hostRef.current);
        }
      })
      .catch(() => {
        mapRef.current = null;
      });

    return () => {
      cancelled = true;
      clearMoveTimer();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      listeners.forEach((l) => l.remove());
      resizeObserver?.disconnect();
      if (panToRef.current) panToRef.current = null;
      mapRef.current = null;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
  }, [initialCenter]);

  return <div ref={hostRef} className="h-full w-full" />;
}

const ShopLocationLeafletMapCanvas = memo(function ShopLocationLeafletMapCanvas({
  initialCenter,
  onCenterIdle,
  onCenterFlush,
  panToRef,
}: ShopLocationMapCanvasProps) {
  return (
    <MapContainer
      center={initialCenter}
      zoom={16}
      className="h-full w-full"
      {...MAP_OPTIONS}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        maxZoom={20}
        subdomains="abcd"
      />
      <MapLayoutFix />
      <MapPanBridge panToRef={panToRef} />
      <MapCenterTracker onCenterIdle={onCenterIdle} onCenterFlush={onCenterFlush} />
    </MapContainer>
  );
});

const ShopLocationMapCanvas = memo(function ShopLocationMapCanvas(props: ShopLocationMapCanvasProps) {
  const [useGoogle, setUseGoogle] = useState(() => Boolean(getGoogleMapsBrowserKey()));

  useEffect(() => {
    const key = getGoogleMapsBrowserKey();
    if (!key) {
      setUseGoogle(false);
      return;
    }
    const offAuth = onGoogleMapsAuthFailure(() => setUseGoogle(false));
    let cancelled = false;
    void loadGoogleMapsScript(key)
      .then(() => {
        if (!cancelled) setUseGoogle(true);
      })
      .catch(() => {
        if (!cancelled) setUseGoogle(false);
      });
    return () => {
      cancelled = true;
      offAuth();
    };
  }, []);

  if (useGoogle && getGoogleMapsBrowserKey()) {
    return <ShopLocationGoogleMapCanvas {...props} />;
  }
  return <ShopLocationLeafletMapCanvas {...props} />;
});

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
    initialLat != null &&
    initialLng != null &&
    isUsableWgs84Point(initialLat, initialLng);

  const [addressText, setAddressText] = useState(initialAddress);
  const [geocoding, setGeocoding] = useState(false);
  const [serviceAreaReady, setServiceAreaReady] = useState(false);
  const [insideServiceArea, setInsideServiceArea] = useState(true);
  const serviceAreaReadyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadServiceAreaRing().then(() => {
      if (cancelled) return;
      serviceAreaReadyRef.current = true;
      setServiceAreaReady(true);
      const c = latestCenterRef.current;
      if (c && hasValidServiceAreaPolygon()) {
        setInsideServiceArea(isInsideServiceArea(c.lat, c.lng));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
  const geocodeRequestIdRef = useRef(0);
  const panToRef = useRef<((lat: number, lng: number) => void) | null>(null);
  const placesAttrRef = useRef<HTMLDivElement | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestRequestIdRef = useRef(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const queueReverseGeocode = useCallback((nextLat: number, nextLng: number, flush: boolean) => {
    const run = async () => {
      reverseTimerRef.current = null;
      const requestId = ++geocodeRequestIdRef.current;
      setGeocoding(true);
      const name = await reverseGeocode(nextLat, nextLng);
      if (requestId !== geocodeRequestIdRef.current) return;
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

  const updateCenter = useCallback((nextLat: number, nextLng: number) => {
    latestCenterRef.current = { lat: nextLat, lng: nextLng };
    if (serviceAreaReadyRef.current && hasValidServiceAreaPolygon()) {
      const inside = isInsideServiceArea(nextLat, nextLng);
      setInsideServiceArea((prev) => (prev === inside ? prev : inside));
    }
  }, []);

  const applyHit = useCallback(
    (lat: number, lng: number, address: string) => {
      geocodeRequestIdRef.current += 1;
      if (reverseTimerRef.current) {
        clearTimeout(reverseTimerRef.current);
        reverseTimerRef.current = null;
      }
      setGeocoding(false);
      updateCenter(lat, lng);
      if (address) setAddressText(address);
      panToRef.current?.(lat, lng);
    },
    [updateCenter]
  );

  const geoBias = useCallback(() => {
    const c = latestCenterRef.current ?? {
      lat: fallbackCenter[0],
      lng: fallbackCenter[1],
    };
    return { lat: c.lat, lng: c.lng, bounds: getServiceAreaBounds() };
  }, [fallbackCenter]);

  const loadSuggestions = useCallback(
    async (raw: string) => {
      const q = raw.trim();
      const requestId = ++suggestRequestIdRef.current;
      if (q.length < 3) {
        setSuggestions([]);
        return;
      }
      const key = getGoogleMapsBrowserKey();
      let hits: PlaceSuggestion[] = [];
      if (key && window.google?.maps?.places?.AutocompleteService) {
        hits = await suggestGooglePlaces(q, geoBias());
      }
      if (requestId !== suggestRequestIdRef.current) return;
      if (hits.length === 0) {
        hits = await searchNominatim(q);
      }
      if (requestId !== suggestRequestIdRef.current) return;
      setSuggestions(hits);
      setSearchOpen(hits.length > 0);
    },
    [geoBias]
  );

  const resolveSuggestion = useCallback(
    async (hit: PlaceSuggestion): Promise<{ lat: number; lng: number; address: string } | null> => {
      if (hit.lat != null && hit.lng != null) {
        return {
          lat: hit.lat,
          lng: hit.lng,
          address: hit.address || hit.label,
        };
      }
      if (hit.placeId && placesAttrRef.current) {
        const details = await detailsGooglePlace(hit.placeId, placesAttrRef.current);
        if (details) {
          return { lat: details.lat, lng: details.lng, address: details.address || hit.label };
        }
      }
      const geo = await forwardGeocodeGoogle(hit.label, geoBias());
      if (geo) return { lat: geo.lat, lng: geo.lng, address: geo.address || hit.label };
      const nom = await searchNominatim(hit.label);
      const first = nom[0];
      if (first?.lat != null && first.lng != null) {
        return { lat: first.lat, lng: first.lng, address: first.address || first.label };
      }
      return null;
    },
    [geoBias]
  );

  const goToQuery = useCallback(
    async (raw: string, preferred?: PlaceSuggestion) => {
      const q = raw.trim();
      if (q.length < 3) {
        setSearchError("Escribe al menos 3 caracteres para buscar.");
        return;
      }
      setSearching(true);
      setSearchError(null);
      try {
        let found: { lat: number; lng: number; address: string } | null = null;
        if (preferred) {
          found = await resolveSuggestion(preferred);
        }
        if (!found) {
          const geo = await forwardGeocodeGoogle(q, geoBias());
          if (geo) found = { lat: geo.lat, lng: geo.lng, address: geo.address };
        }
        if (!found) {
          const nom = await searchNominatim(q);
          const first = nom[0];
          if (first?.lat != null && first.lng != null) {
            found = { lat: first.lat, lng: first.lng, address: first.address || first.label };
          }
        }
        if (!found) {
          setSearchError("No se encontró esa dirección. Prueba con calle, colonia y Tala.");
          return;
        }
        applyHit(found.lat, found.lng, found.address);
        setSearchOpen(false);
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    },
    [applyHit, geoBias, resolveSuggestion]
  );

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!searchBoxRef.current?.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const onCenterIdle = useCallback(
    (nextLat: number, nextLng: number) => {
      updateCenter(nextLat, nextLng);
      queueReverseGeocode(nextLat, nextLng, false);
    },
    [queueReverseGeocode, updateCenter]
  );

  const onCenterFlush = useCallback(
    (nextLat: number, nextLng: number) => {
      updateCenter(nextLat, nextLng);
      queueReverseGeocode(nextLat, nextLng, true);
    },
    [queueReverseGeocode, updateCenter]
  );

  useEffect(() => {
    return () => {
      if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
      if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-600">
        Busca la dirección o desplaza el mapa; el pin indica la ubicación. Puedes editar el texto
        antes de aplicar. Usa +/− para acercar o alejar.
      </p>
      <div ref={searchBoxRef} className="relative">
        <label className="block text-sm text-gray-600 mb-1">Buscar dirección</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              const next = e.target.value;
              setSearchQuery(next);
              setSearchError(null);
              if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
              suggestTimerRef.current = setTimeout(() => {
                void loadSuggestions(next);
              }, 280);
            }}
            onFocus={() => {
              if (suggestions.length > 0) setSearchOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void goToQuery(searchQuery, suggestions[0]);
              }
              if (e.key === "Escape") setSearchOpen(false);
            }}
            placeholder="Ej. Nicolás Bravo, San Javier, Tala"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => void goToQuery(searchQuery, suggestions[0])}
            disabled={searching}
            className="shrink-0 rounded-lg bg-dobby-600 px-3 py-2 text-sm font-medium text-white hover:bg-dobby-700 disabled:opacity-50"
          >
            {searching ? "…" : "Buscar"}
          </button>
        </div>
        {searchOpen && suggestions.length > 0 ? (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {suggestions.map((hit, i) => (
              <li key={`${hit.placeId ?? hit.label}-${i}`}>
                <button
                  type="button"
                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-dobby-50"
                  onClick={() => {
                    setSearchQuery(hit.label);
                    void goToQuery(hit.label, hit);
                  }}
                >
                  <span className="text-sm text-gray-900">{hit.label}</span>
                  {hit.secondary ? (
                    <span className="text-xs text-gray-500">{hit.secondary}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {searchError ? <p className="mt-1 text-xs text-red-600">{searchError}</p> : null}
      </div>
      <div ref={placesAttrRef} className="hidden" aria-hidden />
      <div
        className="relative h-[280px] w-full rounded-lg overflow-hidden border border-gray-200 z-0 touch-none"
        onWheelCapture={(e) => e.stopPropagation()}
      >
        <ShopLocationMapCanvas
          initialCenter={initialMapCenterRef.current}
          onCenterIdle={onCenterIdle}
          onCenterFlush={onCenterFlush}
          panToRef={panToRef}
        />
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
        {serviceAreaReady && hasValidServiceAreaPolygon() && !insideServiceArea && (
          <p className="mt-2 text-xs text-red-600">{OUTSIDE_SERVICE_AREA_ERROR}</p>
        )}
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
            if (!isUsableWgs84Point(c.lat, c.lng)) {
              alert("Mueve el mapa hasta colocar el pin sobre la ubicación real de la tienda.");
              return;
            }
            if (serviceAreaReady && hasValidServiceAreaPolygon() && !isInsideServiceArea(c.lat, c.lng)) {
              alert(OUTSIDE_SERVICE_AREA_ERROR);
              return;
            }
            onApply(c.lat, c.lng, addr);
          }}
          disabled={
            serviceAreaReady && hasValidServiceAreaPolygon() && !insideServiceArea
          }
          className="bg-dobby-600 text-white px-4 py-2 rounded hover:bg-dobby-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Aplicar ubicación
        </button>
      </div>
    </div>
  );
}
