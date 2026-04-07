"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/** Avoid inertia panBy racing with React updates / fitBounds (fixes "classList" undefined on drag). */
const MAP_OPTIONS: L.MapOptions = {
  inertia: false,
};

const driverIcon = L.divIcon({
  className: "ewe-map-pin ewe-map-pin-driver",
  html: '<span style="display:block;width:14px;height:14px;background:#2563eb;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const destinationIcon = L.divIcon({
  className: "ewe-map-pin ewe-map-pin-dest",
  html: '<span style="display:block;width:14px;height:14px;background:#16a34a;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

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
      map.fitBounds(valid, { padding: [48, 48], maxZoom: 16 });
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

export type OrderTrackingMapProps = {
  mode: "ASSIGNED" | "ON_DELIVERY";
  driver: { lat: number; lng: number } | null;
  destination: { lat: number; lng: number } | null;
  destinationLabel: string;
  /** When this string changes, map runs fitBounds/setView (order, dest, or driver presence — not every GPS tick). */
  fitBoundsKey: string;
};

export function OrderTrackingMap({ mode, driver, destination, destinationLabel, fitBoundsKey }: OrderTrackingMapProps) {
  const center = useMemo<L.LatLngTuple>(() => {
    if (driver) return [driver.lat, driver.lng];
    if (destination) return [destination.lat, destination.lng];
    return [19.4326, -99.1332];
  }, [driver, destination]);

  const points = useMemo(() => {
    const out: L.LatLngTuple[] = [];
    if (driver && Number.isFinite(driver.lat) && Number.isFinite(driver.lng)) {
      out.push([driver.lat, driver.lng]);
    }
    if (destination && Number.isFinite(destination.lat) && Number.isFinite(destination.lng)) {
      out.push([destination.lat, destination.lng]);
    }
    return out;
  }, [driver, destination]);

  const showLine = points.length === 2;

  if (points.length === 0) {
    return (
      <div className="h-[320px] flex items-center justify-center bg-gray-100 text-gray-600 text-sm px-4 text-center rounded-lg border border-gray-200">
        No hay coordenadas disponibles para mostrar el mapa. El repartidor aún no ha enviado ubicación o falta la
        dirección de {mode === "ASSIGNED" ? "recogida" : "entrega"} en el sistema.
      </div>
    );
  }

  return (
    <div className="h-[320px] w-full rounded-lg overflow-hidden border border-gray-200 z-0">
      <MapContainer
        center={center}
        zoom={14}
        className="h-full w-full"
        scrollWheelZoom
        {...MAP_OPTIONS}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} fitBoundsKey={fitBoundsKey} />
        {driver && Number.isFinite(driver.lat) && Number.isFinite(driver.lng) && (
          <Marker position={[driver.lat, driver.lng]} icon={driverIcon}>
            <Popup>Repartidor</Popup>
          </Marker>
        )}
        {destination && Number.isFinite(destination.lat) && Number.isFinite(destination.lng) && (
          <Marker position={[destination.lat, destination.lng]} icon={destinationIcon}>
            <Popup>{destinationLabel}</Popup>
          </Marker>
        )}
        {showLine && <Polyline positions={points} pathOptions={{ color: "#64748b", weight: 3, opacity: 0.85 }} />}
      </MapContainer>
    </div>
  );
}
