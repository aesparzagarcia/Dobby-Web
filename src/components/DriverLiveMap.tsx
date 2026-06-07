"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

const MAP_OPTIONS: L.MapOptions = { inertia: false };

const driverIcon = L.divIcon({
  className: "ewe-map-pin ewe-map-pin-driver",
  html: '<span style="display:block;width:14px;height:14px;background:#0061FF;border:2px solid #fff;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.35)"></span>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function LiveDriverMarker({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    markerRef.current?.setLatLng([lat, lng]);
  }, [lat, lng]);

  useEffect(() => {
    markerRef.current?.setPopupContent(label);
  }, [label]);

  return (
    <Marker
      ref={markerRef}
      position={[lat, lng]}
      icon={driverIcon}
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

function CenterOnDriver({ lat, lng, fitKey }: { lat: number; lng: number; fitKey: string }) {
  const map = useMap();
  const posRef = useRef({ lat, lng });
  posRef.current = { lat, lng };

  useEffect(() => {
    const { lat: la, lng: ln } = posRef.current;
    const id = requestAnimationFrame(() => {
      if (!map.getContainer()?.isConnected) return;
      try {
        map.setView([la, ln], 15);
      } catch {
        /* teardown */
      }
    });
    return () => cancelAnimationFrame(id);
  }, [map, fitKey]);
  return null;
}

export type DriverLiveMapProps = {
  lat: number;
  lng: number;
  driverName: string;
  /** Changes when coords first appear — triggers initial centering. */
  fitKey: string;
};

export function DriverLiveMap({ lat, lng, driverName, fitKey }: DriverLiveMapProps) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return (
      <div className="h-[280px] flex items-center justify-center bg-gray-100 text-gray-600 text-sm px-4 text-center rounded-lg border border-gray-200">
        Aún no hay ubicación GPS reportada por este repartidor.
      </div>
    );
  }

  return (
    <div className="h-[280px] w-full rounded-lg overflow-hidden border border-gray-200 z-0">
      <MapContainer center={[lat, lng]} zoom={15} className="h-full w-full" scrollWheelZoom {...MAP_OPTIONS}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CenterOnDriver lat={lat} lng={lng} fitKey={fitKey} />
        <LiveDriverMarker lat={lat} lng={lng} label={driverName} />
      </MapContainer>
    </div>
  );
}
