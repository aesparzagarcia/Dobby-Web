"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

/** Avoid inertia panBy racing with React updates / fitBounds (fixes "classList" undefined on drag). */
const MAP_OPTIONS: L.MapOptions = {
  inertia: false,
};

/** 15% smaller than original 44px markers. */
const MARKER_PX = Math.round(44 * 0.85);
const MARKER_SIZE: [number, number] = [MARKER_PX, MARKER_PX];

function createMarkerIcon(iconUrl: string) {
  const half = MARKER_PX / 2;
  return L.icon({
    iconUrl,
    iconSize: MARKER_SIZE,
    iconAnchor: [half, MARKER_PX],
    popupAnchor: [0, -Math.round(MARKER_PX * 0.91)],
    className: "ewe-map-marker-icon",
  });
}

const ICONS = {
  driver: createMarkerIcon("/map-icons/ic_delivery.png"),
  shop: createMarkerIcon("/map-icons/ic_shop.png"),
  customer: createMarkerIcon("/map-icons/ic_house.png"),
};

function LiveMarker({
  lat,
  lng,
  icon,
  label,
}: {
  lat: number;
  lng: number;
  icon: L.Icon;
  label: string;
}) {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    markerRef.current?.setLatLng([lat, lng]);
  }, [lat, lng]);

  return (
    <Marker
      ref={markerRef}
      position={[lat, lng]}
      icon={icon}
      eventHandlers={{
        add: (e) => {
          markerRef.current = e.target;
        },
      }}
    >
      <Popup>{label}</Popup>
    </Marker>
  );
}

function FitBounds({ points, fitBoundsKey }: { points: L.LatLngExpression[]; fitBoundsKey: string }) {
  const map = useMap();
  const pointsRef = useRef(points);
  pointsRef.current = points;

  useEffect(() => {
    const valid = pointsRef.current.filter(
      (p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])
    ) as L.LatLngTuple[];
    if (valid.length === 0) return;

    const apply = () => {
      if (!map.getContainer()?.isConnected) return;
      if (valid.length === 1) {
        map.setView(valid[0], 15);
        return;
      }
      map.fitBounds(valid, { padding: [56, 56], maxZoom: 16 });
    };

    const id = requestAnimationFrame(() => {
      try {
        apply();
      } catch {
        /* ignore teardown races */
      }
    });
    return () => cancelAnimationFrame(id);
  }, [map, fitBoundsKey]);
  return null;
}

export type MapPoint = { lat: number; lng: number };

export type OrderTrackingMapProps = {
  driver: MapPoint | null;
  shop: (MapPoint & { name?: string }) | null;
  customer: (MapPoint & { address?: string }) | null;
  /** When this string changes, map runs fitBounds/setView (not every GPS tick). */
  fitBoundsKey: string;
};

export function OrderTrackingMap({ driver, shop, customer, fitBoundsKey }: OrderTrackingMapProps) {
  const points = useMemo(() => {
    const out: L.LatLngTuple[] = [];
    const add = (p: MapPoint | null) => {
      if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
        out.push([p.lat, p.lng]);
      }
    };
    add(driver);
    add(shop);
    add(customer);
    return out;
  }, [driver, shop, customer]);

  const center = useMemo<L.LatLngTuple>(() => {
    if (driver) return [driver.lat, driver.lng];
    if (shop) return [shop.lat, shop.lng];
    if (customer) return [customer.lat, customer.lng];
    return [19.4326, -99.1332];
  }, [driver, shop, customer]);

  if (points.length === 0) {
    return (
      <div className="h-[360px] flex items-center justify-center bg-gray-100 text-gray-600 text-sm px-4 text-center rounded-lg border border-gray-200">
        No hay coordenadas para mostrar el mapa. Verifica que la tienda y el cliente tengan ubicación y que el
        repartidor haya enviado su posición desde DobbyGo.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="h-[360px] w-full rounded-lg overflow-hidden border border-gray-200 z-0">
        <MapContainer center={center} zoom={14} className="h-full w-full" scrollWheelZoom {...MAP_OPTIONS}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={points} fitBoundsKey={fitBoundsKey} />
          {driver && Number.isFinite(driver.lat) && Number.isFinite(driver.lng) && (
            <LiveMarker lat={driver.lat} lng={driver.lng} icon={ICONS.driver} label="Repartidor" />
          )}
          {shop && Number.isFinite(shop.lat) && Number.isFinite(shop.lng) && (
            <Marker position={[shop.lat, shop.lng]} icon={ICONS.shop}>
              <Popup>{shop.name ? `Restaurante: ${shop.name}` : "Restaurante"}</Popup>
            </Marker>
          )}
          {customer && Number.isFinite(customer.lat) && Number.isFinite(customer.lng) && (
            <Marker position={[customer.lat, customer.lng]} icon={ICONS.customer}>
              <Popup>{customer.address ? `Cliente: ${customer.address}` : "Cliente (entrega)"}</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
      <ul className="flex flex-wrap gap-4 text-xs text-gray-600">
        <li className="flex items-center gap-1.5">
          <img src="/map-icons/ic_delivery.png" alt="" className="w-[20px] h-[20px] object-contain" />
          Repartidor
        </li>
        <li className="flex items-center gap-1.5">
          <img src="/map-icons/ic_shop.png" alt="" className="w-[20px] h-[20px] object-contain" />
          Restaurante
        </li>
        <li className="flex items-center gap-1.5">
          <img src="/map-icons/ic_house.png" alt="" className="w-[20px] h-[20px] object-contain" />
          Cliente
        </li>
      </ul>
    </div>
  );
}
