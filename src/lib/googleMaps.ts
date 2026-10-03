/** Browser key for Maps JavaScript + Geocoding. Empty = no Google map. */
export function getGoogleMapsBrowserKey(): string {
  return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "").trim();
}

let mapsLoader: Promise<void> | null = null;
const authFailureListeners = new Set<() => void>();
let authFailureInstalled = false;
let googleMapsAuthFailed = false;

export function didGoogleMapsAuthFail(): boolean {
  return googleMapsAuthFailed;
}

/** Google llama `gm_authFailure` cuando la key está bloqueada para web (ApiTargetBlockedMapError). */
export function onGoogleMapsAuthFailure(listener: () => void): () => void {
  installGoogleMapsAuthFailureHook();
  authFailureListeners.add(listener);
  return () => {
    authFailureListeners.delete(listener);
  };
}

function notifyGoogleMapsAuthFailure() {
  googleMapsAuthFailed = true;
  mapsLoader = null;
  authFailureListeners.forEach((cb) => {
    try {
      cb();
    } catch {
      /* ignore */
    }
  });
}

function installGoogleMapsAuthFailureHook() {
  if (typeof window === "undefined" || authFailureInstalled) return;
  authFailureInstalled = true;
  const previous = window.gm_authFailure;
  window.gm_authFailure = () => {
    notifyGoogleMapsAuthFailure();
    if (typeof previous === "function") previous();
  };
}

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

export function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps solo corre en el navegador."));
  }
  installGoogleMapsAuthFailureHook();
  if (googleMapsAuthFailed) {
    return Promise.reject(new Error("Google Maps rechazó la API key (web bloqueada)."));
  }
  if (window.google?.maps?.Map) return Promise.resolve();
  if (mapsLoader) return mapsLoader;

  mapsLoader = new Promise((resolve, reject) => {
    const existing = document.getElementById("google-maps-js");
    if (existing) {
      if (window.google?.maps?.Map) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("No se pudo cargar Google Maps.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-js";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&language=es&region=MX&v=weekly&libraries=places`;
    script.onload = () => resolve();
    script.onerror = () => {
      mapsLoader = null;
      reject(new Error("No se pudo cargar Google Maps."));
    };
    document.head.appendChild(script);
  });

  return mapsLoader;
}

type AddressPart = { long_name: string; types: string[] };

function component(parts: AddressPart[], type: string): string {
  return parts.find((p) => p.types.includes(type))?.long_name?.trim() ?? "";
}

/** Calle y número, colonia y ciudad (sin país, CP ni estado). */
export function formatGoogleShortAddress(result: {
  address_components?: AddressPart[];
  formatted_address?: string;
}): string {
  const parts = result.address_components ?? [];
  const house = component(parts, "street_number");
  const road = component(parts, "route");
  let street = "";
  if (road && house) street = `${road} ${house}`;
  else if (road) street = road;
  else if (house) street = house;

  const col =
    component(parts, "sublocality_level_1") ||
    component(parts, "sublocality") ||
    component(parts, "neighborhood");

  const city =
    component(parts, "locality") ||
    component(parts, "administrative_area_level_2");

  const short = [street, col, city].filter((p) => p.length > 0).join(", ");
  if (short) return short;

  const formatted = result.formatted_address?.trim() ?? "";
  if (!formatted) return "";
  return formatted
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");
}

export async function reverseGeocodeGoogle(lat: number, lng: number): Promise<string | null> {
  return new Promise((resolve) => {
    if (!window.google?.maps?.Geocoder) {
      resolve(null);
      return;
    }
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status !== "OK" || !results?.[0]) {
        resolve(null);
        return;
      }
      const name = formatGoogleShortAddress(results[0]);
      resolve(name.length > 0 ? name : null);
    });
  });
}

export type PlaceSearchHit = {
  lat: number;
  lng: number;
  address: string;
  label: string;
};

export type PlaceSuggestion = {
  placeId: string | null;
  label: string;
  secondary: string;
  lat?: number;
  lng?: number;
  address?: string;
};

type GeoBias = {
  lat: number;
  lng: number;
  bounds?: { south: number; west: number; north: number; east: number } | null;
};

function googleLocationBias(bias?: GeoBias): google.maps.GeocoderRequest {
  const req: google.maps.GeocoderRequest = {
    componentRestrictions: { country: "MX" },
    region: "mx",
    language: "es",
  };
  if (bias?.bounds) {
    req.bounds = bias.bounds;
  }
  return req;
}

export async function suggestGooglePlaces(
  query: string,
  bias?: GeoBias
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (!q || !window.google?.maps?.places?.AutocompleteService) return [];
  const location = bias
    ? new google.maps.LatLng(bias.lat, bias.lng)
    : undefined;
  const bounds = bias?.bounds
    ? new google.maps.LatLngBounds(
        { lat: bias.bounds.south, lng: bias.bounds.west },
        { lat: bias.bounds.north, lng: bias.bounds.east }
      )
    : undefined;
  return new Promise((resolve) => {
    const svc = new google.maps.places.AutocompleteService();
    svc.getPlacePredictions(
      {
        input: q,
        componentRestrictions: { country: "mx" },
        language: "es",
        ...(location ? { location, radius: 15_000 } : {}),
        ...(bounds ? { bounds } : {}),
      },
      (predictions, status) => {
        if (
          status !== google.maps.places.PlacesServiceStatus.OK ||
          !predictions?.length
        ) {
          resolve([]);
          return;
        }
        resolve(
          predictions.slice(0, 6).map((p) => ({
            placeId: p.place_id ?? null,
            label: p.structured_formatting?.main_text || p.description,
            secondary: p.structured_formatting?.secondary_text || "",
          }))
        );
      }
    );
  });
}

export async function detailsGooglePlace(
  placeId: string,
  attrContainer: HTMLDivElement
): Promise<PlaceSearchHit | null> {
  if (!window.google?.maps?.places?.PlacesService) return null;
  return new Promise((resolve) => {
    const svc = new google.maps.places.PlacesService(attrContainer);
    svc.getDetails(
      {
        placeId,
        fields: ["geometry", "address_components", "formatted_address", "name"],
        language: "es",
      },
      (place, status) => {
        const loc = place?.geometry?.location;
        if (status !== google.maps.places.PlacesServiceStatus.OK || !loc) {
          resolve(null);
          return;
        }
        const address =
          (place ? formatGoogleShortAddress(place) : "") ||
          place?.formatted_address?.trim() ||
          place?.name?.trim() ||
          "";
        resolve({
          lat: loc.lat(),
          lng: loc.lng(),
          address,
          label: address || place?.name || "",
        });
      }
    );
  });
}

export async function forwardGeocodeGoogle(
  query: string,
  bias?: GeoBias
): Promise<PlaceSearchHit | null> {
  const q = query.trim();
  if (!q || !window.google?.maps?.Geocoder) return null;
  return new Promise((resolve) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode(
      {
        address: q,
        ...googleLocationBias(bias),
      },
      (results, status) => {
        if (status !== "OK" || !results?.[0]?.geometry?.location) {
          resolve(null);
          return;
        }
        const loc = results[0].geometry.location;
        const address = formatGoogleShortAddress(results[0]);
        resolve({
          lat: loc.lat(),
          lng: loc.lng(),
          address: address || results[0].formatted_address || q,
          label: address || results[0].formatted_address || q,
        });
      }
    );
  });
}
