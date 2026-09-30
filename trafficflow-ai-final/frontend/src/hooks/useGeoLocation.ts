/**
 * useGeoLocation — shared hook that returns the user's real GPS coordinates.
 *
 * - Requests location once on mount via navigator.geolocation
 * - Falls back to Chennai city centre if denied / unsupported / timed-out
 * - Exposes `status` so any component can show a badge or message
 */
import { useEffect, useRef, useState } from "react";

export type GeoStatus = "detecting" | "found" | "denied" | "unsupported";

export type GeoCoords = {
  lat: number;
  lon: number;
};

// Chennai city centre — used as fallback when GPS is unavailable
export const FALLBACK_COORDS: GeoCoords = { lat: 13.0827, lon: 80.2707 };

export function useGeoLocation() {
  const [coords, setCoords]   = useState<GeoCoords>(FALLBACK_COORDS);
  const [status, setStatus]   = useState<GeoStatus>("detecting");
  const resolvedRef            = useRef(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus("unsupported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (resolvedRef.current) return;
        resolvedRef.current = true;
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setStatus("found");
      },
      () => {
        if (resolvedRef.current) return;
        resolvedRef.current = true;
        // Keep FALLBACK_COORDS already set in useState
        setStatus("denied");
      },
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false },
    );
  }, []);

  return { coords, status };
}
