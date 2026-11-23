'use client';

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { DEMO_PROFILE } from '../_demo/demo-account';
import {
  pushDealerCallbackRequest,
  pushDealerPostalToProfile,
} from '../_demo/demo-cdp';
import { useDemoSession } from '../_demo/demo-session';

export type DealerRecord = {
  id: string;
  title: string;
  label: string;
  address: string;
  address2: string;
  phone: string;
  fax: string;
  email: string;
  website: string;
  latitude: number;
  longitude: number;
  types: string[];
};

type DealerLocatorChromeProps = {
  dealers: DealerRecord[];
  searchPlaceholder: string;
  useMyLocationLabel: string;
  locationError: string;
  noResultsMessage: string;
  searchCriteriaLabel: string;
  selectDealersLabel: string;
  mechanicalLabel: string;
  digitalLabel: string;
  mapCookieTitle: string;
  mapCookieBody: string;
};

type DealerWithDistance = DealerRecord & { distanceKm?: number };

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function parsePostalHint(query: string): { lat: number; lng: number } | null {
  // Lightweight BE postal centroids for demo (not exhaustive).
  const beCentroids: Record<string, [number, number]> = {
    '1000': [50.8467, 4.3499],
    '1500': [50.811, 4.214],
    '1800': [50.928, 4.428],
    '1910': [50.937, 4.549], // Kampenhout
    '2000': [51.2194, 4.4025],
    '2800': [51.0259, 4.4776],
    '3000': [50.8798, 4.7005],
    '3500': [50.9307, 5.3325],
    '4000': [50.6326, 5.5797],
    '5000': [50.4674, 4.872],
    '6000': [50.4108, 4.4446],
    '7000': [50.4542, 3.9567],
    '8000': [51.2093, 3.2247],
    '8400': [51.2154, 2.9286],
    '9000': [51.0543, 3.7174],
    '9300': [50.9378, 4.0409],
  };
  const digits = String(query || '').replace(/\D/g, '').slice(0, 4);
  if (digits.length < 4) return null;
  const exact = beCentroids[digits];
  if (exact) return { lat: exact[0], lng: exact[1] };
  // Nearest known prefix bucket (e.g. 19xx → 1910/1800/1000).
  const candidates = Object.keys(beCentroids)
    .map((code) => ({
      code,
      dist: Math.abs(Number(code) - Number(digits)),
    }))
    .sort((a, b) => a.dist - b.dist);
  const nearest = candidates[0];
  if (!nearest || nearest.dist > 500) {
    const prefix = `${digits[0]}000`;
    const approx = beCentroids[prefix];
    return approx ? { lat: approx[0], lng: approx[1] } : null;
  }
  const hit = beCentroids[nearest.code];
  return hit ? { lat: hit[0], lng: hit[1] } : null;
}

/** Zoom level after postcode / geolocation search (street–neighborhood scale). */
const SEARCH_ZOOM = 12;

function safeFitBounds(map: any, L: any, points: [number, number][]) {
  if (!map || !L || !points.length) return;
  try {
    map.invalidateSize(false);
    if (points.length === 1) {
      map.setView(points[0], SEARCH_ZOOM, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(points);
    if (!bounds || typeof bounds.isValid !== 'function' || !bounds.isValid()) {
      return;
    }
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 12, animate: false });
  } catch {
    // Leaflet throws "Cannot read properties of undefined (reading 'x')" when the
    // map pane/size is not ready (common in Pages editor). Ignore and keep UI usable.
  }
}

/** Center + zoom on the searched postcode / geolocation. */
function focusMapOnOrigin(
  map: any,
  origin: { lat: number; lng: number },
) {
  if (!map || !isValidLatLng(origin.lat, origin.lng)) return;
  try {
    map.invalidateSize(false);
    map.setView([origin.lat, origin.lng], SEARCH_ZOOM, { animate: true });
  } catch {
    /* ignore map focus errors in editor */
  }
}

export default function DealerLocatorChrome({
  dealers,
  searchPlaceholder,
  useMyLocationLabel,
  locationError,
  noResultsMessage,
  searchCriteriaLabel,
  selectDealersLabel,
  mechanicalLabel,
  digitalLabel,
  mapCookieTitle,
  mapCookieBody,
}: DealerLocatorChromeProps) {
  const [query, setQuery] = useState('');
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [mechanical, setMechanical] = useState(true);
  const [digital, setDigital] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [callbackDealer, setCallbackDealer] = useState<DealerRecord | null>(
    null,
  );
  const [callbackPhone, setCallbackPhone] = useState('');
  const [callbackSent, setCallbackSent] = useState(false);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const originMarkerRef = useRef<any>(null);
  const appliedUrlPostal = useRef(false);
  const callbackTitleId = useId();
  const { isLoggedIn, profile } = useDemoSession();

  // Dealer Finder passes ?postal=… — apply once on mount.
  useEffect(() => {
    if (appliedUrlPostal.current || typeof window === 'undefined') return;
    appliedUrlPostal.current = true;
    const params = new URLSearchParams(window.location.search);
    const postal = (params.get('postal') || params.get('q') || '').trim();
    if (!postal) return;
    setQuery(postal);
    pushDealerPostalToProfile(postal);
    const hint = parsePostalHint(postal);
    if (hint && isValidLatLng(hint.lat, hint.lng)) {
      setOrigin(hint);
      setActiveId(null);
    }
  }, []);

  const validDealers = useMemo(
    () => dealers.filter((d) => isValidLatLng(d.latitude, d.longitude)),
    [dealers],
  );

  const filtered: DealerWithDistance[] = useMemo(() => {
    // No type filter selected → empty list/map (match capture UX).
    if (!mechanical && !digital) return [];
    const withTypes = validDealers.filter((d) => {
      const types = Array.isArray(d.types) ? d.types : [];
      const hasMech = types.some((t) => /mechanical|mécanique|mechanisch/i.test(t));
      const hasDig = types.some((t) => /digital|elektron|électron/i.test(t));
      if (mechanical && hasMech) return true;
      if (digital && hasDig) return true;
      return false;
    });
    if (!origin || !isValidLatLng(origin.lat, origin.lng)) return withTypes;
    return [...withTypes]
      .map((d) => ({
        ...d,
        distanceKm: haversineKm(origin.lat, origin.lng, d.latitude, d.longitude),
      }))
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }, [validDealers, mechanical, digital, origin]);

  useEffect(() => {
    let cancelled = false;
    const ensureLeaflet = async () => {
      if (typeof window === 'undefined') return;
      const w = window as any;
      if (!w.L) {
        await new Promise<void>((resolve, reject) => {
          if (!document.querySelector('link[data-bq-leaflet]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            link.setAttribute('data-bq-leaflet', '1');
            document.head.appendChild(link);
          }
          const existing = document.querySelector(
            'script[data-bq-leaflet]',
          ) as HTMLScriptElement | null;
          if (existing) {
            if (w.L) resolve();
            else existing.addEventListener('load', () => resolve(), { once: true });
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.setAttribute('data-bq-leaflet', '1');
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Leaflet failed to load'));
          document.body.appendChild(script);
        });
      }
      if (cancelled || !mapEl.current || !w.L) return;

      // Container was remounted (Pages editor) — drop stale map instance.
      if (mapRef.current && mapRef.current.getContainer?.() !== mapEl.current) {
        try {
          mapRef.current.remove();
        } catch {
          /* ignore */
        }
        mapRef.current = null;
        markersRef.current.clear();
        originMarkerRef.current = null;
      }

      if (!mapRef.current) {
        // Avoid Leaflet's "Map container is already initialized" on remount.
        if ((mapEl.current as any)._leaflet_id) {
          delete (mapEl.current as any)._leaflet_id;
        }
        mapRef.current = w.L.map(mapEl.current, {
          scrollWheelZoom: false,
          fadeAnimation: false,
          zoomAnimation: false,
        }).setView([50.8549541, 4.3053504], 8);
        w.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 18,
        }).addTo(mapRef.current);
      }
      setMapReady(true);
      requestAnimationFrame(() => {
        try {
          mapRef.current?.invalidateSize?.(false);
        } catch {
          /* ignore */
        }
      });
    };
    ensureLeaflet().catch(() => setMapReady(false));
    return () => {
      cancelled = true;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {
          /* ignore */
        }
        mapRef.current = null;
      }
      markersRef.current.clear();
      originMarkerRef.current = null;
    };
  }, []);

  // Sync dealer markers + origin (not active highlight — that is style-only).
  useEffect(() => {
    const w = typeof window !== 'undefined' ? (window as any) : null;
    const map = mapRef.current;
    const L = w?.L;
    if (!mapReady || !map || !L) return;

    markersRef.current.forEach((m) => {
      try {
        map.removeLayer(m);
      } catch {
        /* ignore */
      }
    });
    markersRef.current.clear();
    if (originMarkerRef.current) {
      try {
        map.removeLayer(originMarkerRef.current);
      } catch {
        /* ignore */
      }
      originMarkerRef.current = null;
    }

    const bounds: [number, number][] = [];
    for (const d of filtered) {
      if (!isValidLatLng(d.latitude, d.longitude)) continue;
      try {
        const marker = L.circleMarker([d.latitude, d.longitude], {
          radius: 6,
          color: '#d51130',
          fillColor: '#d51130',
          fillOpacity: 0.9,
          weight: 2,
        })
          .bindPopup(
            `<strong>${escapeHtml(d.title)}</strong><br/>${escapeHtml(d.address)}<br/>${escapeHtml(d.address2)}`,
          )
          .on('click', () => setActiveId(d.id));
        marker.addTo(map);
        markersRef.current.set(d.id, marker);
        bounds.push([d.latitude, d.longitude]);
      } catch {
        /* skip bad marker */
      }
    }

    if (origin && isValidLatLng(origin.lat, origin.lng)) {
      try {
        const originMarker = L.circleMarker([origin.lat, origin.lng], {
          radius: 7,
          color: '#111',
          fillColor: '#fdc300',
          fillOpacity: 1,
          weight: 2,
        }).bindPopup('Search origin');
        originMarker.addTo(map);
        originMarkerRef.current = originMarker;
      } catch {
        /* ignore */
      }
      // Postcode / geolocation: zoom in with the search point centered.
      focusMapOnOrigin(map, origin);
      return;
    }

    safeFitBounds(map, L, bounds);
  }, [filtered, mapReady, origin]);

  // Highlight active marker without rebuilding the whole layer group.
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      if (id === '__origin') return;
      try {
        marker.setStyle?.({
          radius: activeId === id ? 9 : 6,
          fillColor: activeId === id ? '#00a0de' : '#d51130',
          color: '#d51130',
        });
      } catch {
        /* ignore */
      }
    });
  }, [activeId]);

  const handleSearch = () => {
    setGeoError(false);
    const trimmed = query.trim();
    if (trimmed) {
      pushDealerPostalToProfile(trimmed);
    }
    const hint = parsePostalHint(query);
    if (hint && isValidLatLng(hint.lat, hint.lng)) {
      setOrigin(hint);
      setActiveId(null);
    }
  };

  const openCallback = (dealer: DealerRecord) => {
    setCallbackDealer(dealer);
    setCallbackPhone(profile?.phone || DEMO_PROFILE.phone);
    setCallbackSent(false);
  };

  const submitCallback = (event: FormEvent) => {
    event.preventDefault();
    if (!callbackDealer) return;
    pushDealerCallbackRequest({
      dealerId: callbackDealer.id,
      dealerName: callbackDealer.title,
      postalCode: query.trim() || undefined,
      phone: callbackPhone,
    });
    setCallbackSent(true);
  };

  const handleUseLocation = () => {
    setGeoError(false);
    if (!navigator.geolocation) {
      setGeoError(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        if (isValidLatLng(next.lat, next.lng)) {
          setOrigin(next);
          setActiveId(null);
        } else {
          setGeoError(true);
        }
      },
      () => setGeoError(true),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  };

  return (
    <div className="find-a-dealer font-[Source_Sans_Pro] text-[#333]">
      <button
        type="button"
        className="mb-4 inline-block border border-[#cac9c9] px-4 py-2 text-[0.9rem] text-[#333] lg:hidden"
        onClick={(e) => {
          const panel = (e.currentTarget.nextElementSibling as HTMLElement) || null;
          if (panel) panel.classList.toggle('hidden');
        }}
      >
        {searchCriteriaLabel}
      </button>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-[1.1rem] font-light">{searchPlaceholder}</h3>
          <div className="relative mb-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-11 w-full rounded-[3px] border border-[#cac9c9] px-3 pr-12 text-base outline-none focus:border-[#00a0de]"
            />
            <button
              type="button"
              aria-label="Search"
              onClick={handleSearch}
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center bg-[#d51130] text-white"
            >
              ⌕
            </button>
          </div>
          <button
            type="button"
            onClick={handleUseLocation}
            className="text-[0.95rem] font-normal text-[#00a0de] underline"
          >
            {useMyLocationLabel}
          </button>
          {geoError ? (
            <p className="mt-1 text-sm text-[#d51130]">{locationError}</p>
          ) : null}
        </div>

        <div>
          <h3 className="mb-2 text-[1.1rem] font-light">{selectDealersLabel}</h3>
          <ul className="m-0 list-none space-y-2 p-0">
            <li>
              <label className="inline-flex items-center gap-2 text-[0.95rem]">
                <input
                  type="checkbox"
                  checked={mechanical}
                  onChange={(e) => setMechanical(e.target.checked)}
                  className="shrink-0"
                />
                <span
                  aria-hidden="true"
                  className="inline-flex w-5 shrink-0 items-center justify-center text-[#d51130]"
                >
                  ⚙
                </span>
                <span>{mechanicalLabel}</span>
              </label>
            </li>
            <li>
              <label className="inline-flex items-center gap-2 text-[0.95rem]">
                <input
                  type="checkbox"
                  checked={digital}
                  onChange={(e) => setDigital(e.target.checked)}
                  className="shrink-0"
                />
                <span
                  aria-hidden="true"
                  className="inline-flex w-5 shrink-0 items-center justify-center text-[#f5a623]"
                >
                  ⚡
                </span>
                <span>{digitalLabel}</span>
              </label>
            </li>
          </ul>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-2">
        <div className="relative min-h-[180px] bg-[#e9e9e9] lg:min-h-[500px]">
          <div ref={mapEl} className="absolute inset-0 z-0 h-full w-full" />
          {!mapReady ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#f5f5f5] p-6 text-center">
              <h3 className="m-0 text-[1.2rem] font-light">{mapCookieTitle}</h3>
              <p className="m-0 max-w-sm text-sm text-[#646363]">{mapCookieBody}</p>
            </div>
          ) : null}
        </div>

        <ul className="m-0 max-h-[518px] list-none overflow-y-auto p-0 lg:pl-6">
          {filtered.length === 0 ? (
            <li className="border border-[#d51130] bg-[#fff5f5] p-4 text-[#d51130]">
              {noResultsMessage}
            </li>
          ) : (
            filtered.map((d) => {
              const distanceKm = d.distanceKm;
              const hasMech = dealerHasMechanical(d.types);
              const hasDig = dealerHasDigital(d.types);
              const keystone = isKeystonePartner(d.label);
              return (
                <li
                  key={d.id}
                  className={`border-b border-[#e9e9e9] px-1 py-4 ${
                    activeId === d.id ? 'bg-[#f7f7f7]' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[#d51130] ${
                        activeId === d.id ? 'bg-[#d51130]' : 'bg-white'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => {
                            setActiveId(d.id);
                            const marker = markersRef.current.get(d.id);
                            try {
                              marker?.openPopup?.();
                              if (isValidLatLng(d.latitude, d.longitude)) {
                                mapRef.current?.setView?.(
                                  [d.latitude, d.longitude],
                                  SEARCH_ZOOM,
                                  { animate: true },
                                );
                              }
                            } catch {
                              /* ignore map interaction errors in editor */
                            }
                          }}
                        >
                          <h3 className="m-0 text-[1.15rem] font-semibold leading-tight text-[#111]">
                            {d.title}
                          </h3>
                          <p className="mt-2 mb-0 whitespace-pre-line text-[0.9rem] leading-relaxed text-[#646363]">
                            {d.address}
                            {d.address2 ? `\n${d.address2}` : ''}
                            {d.phone ? `\nT: ${d.phone}` : ''}
                            {d.fax ? `\nF: ${d.fax}` : ''}
                          </p>
                        </button>
                        <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
                          {keystone ? (
                            <span className="inline-flex items-center gap-1 bg-[#fdc300] px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-[#111]">
                              <span aria-hidden="true">★</span>
                              {d.label || 'Keystone Partner'}
                            </span>
                          ) : d.label ? (
                            <span className="text-[0.75rem] font-semibold uppercase text-[#d51130]">
                              {d.label}
                            </span>
                          ) : null}
                          {distanceKm != null ? (
                            <span className="max-w-[9.5rem] text-[0.7rem] font-semibold uppercase leading-snug tracking-wide text-[#7e7c7c]">
                              {Math.max(1, Math.round(distanceKm))} kilometers
                              from your location
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {d.email ? (
                        <a
                          href={`mailto:${d.email}`}
                          className="mt-2 mr-3 inline-block text-[0.9rem] text-[#00a0de] underline"
                        >
                          {d.email}
                        </a>
                      ) : null}
                      {d.website ? (
                        <a
                          href={d.website}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block text-[0.9rem] text-[#00a0de] underline"
                        >
                          {d.website}
                        </a>
                      ) : null}
                      {isLoggedIn && activeId === d.id ? (
                        <button
                          type="button"
                          className="mt-3 inline-flex h-9 items-center bg-[#d51130] px-4 text-[0.85rem] font-normal text-white hover:bg-[#a50d25]"
                          onClick={() => openCallback(d)}
                        >
                          Request a callback
                        </button>
                      ) : null}
                      {hasMech || hasDig ? (
                        <ul className="mt-3 flex list-none flex-col items-end gap-2 p-0 sm:flex-row sm:flex-wrap sm:justify-end">
                          {hasMech ? (
                            <li className="inline-flex items-center gap-2 text-[0.8rem] text-[#333]">
                              <span
                                aria-hidden="true"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#ececec] text-[#646363]"
                              >
                                ⚙
                              </span>
                              <span>{mechanicalLabel}</span>
                            </li>
                          ) : null}
                          {hasDig ? (
                            <li className="inline-flex items-center gap-2 text-[0.8rem] text-[#333]">
                              <span
                                aria-hidden="true"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#ececec] text-[#f5a623]"
                              >
                                ⚡
                              </span>
                              <span>{digitalLabel}</span>
                            </li>
                          ) : null}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>

      {callbackDealer ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 font-[Source_Sans_Pro]"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setCallbackDealer(null);
              setCallbackSent(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={callbackTitleId}
            className="w-full max-w-md border border-[#e9e9e9] bg-white p-6 text-[#333] shadow-[0_12px_40px_rgba(0,0,0,0.2)]"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2
                id={callbackTitleId}
                className="m-0 text-[1.25rem] font-light text-black"
              >
                {callbackSent
                  ? 'Callback requested'
                  : `Request a callback from ${callbackDealer.title}`}
              </h2>
              <button
                type="button"
                className="text-2xl leading-none text-[#646363]"
                aria-label="Close"
                onClick={() => {
                  setCallbackDealer(null);
                  setCallbackSent(false);
                }}
              >
                ×
              </button>
            </div>
            {callbackSent ? (
              <p className="m-0 text-[0.95rem] text-[#646363]">
                Thanks — {callbackDealer.title} will call you back within one
                workday on {callbackPhone || 'your number'}.
              </p>
            ) : (
              <form onSubmit={submitCallback} className="flex flex-col gap-3">
                <p className="m-0 text-[0.85rem] text-[#646363]">
                  We&apos;ll ask this dealer to call you back within one workday.
                </p>
                <label className="block text-[0.8rem] font-semibold text-black">
                  Phone number
                  <input
                    type="tel"
                    value={callbackPhone}
                    onChange={(e) => setCallbackPhone(e.target.value)}
                    required
                    className="mt-1 block h-10 w-full border border-[#cac9c9] px-3 text-[0.95rem] outline-none focus:border-[#00a0de]"
                  />
                </label>
                <button
                  type="submit"
                  className="mt-2 inline-flex h-11 items-center justify-center bg-[#d51130] px-5 text-[0.95rem] text-white hover:bg-[#a50d25]"
                >
                  Send request
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function dealerHasMechanical(types: string[]): boolean {
  return types.some((t) => /mechanical|mécanique|mechanisch/i.test(t));
}

function dealerHasDigital(types: string[]): boolean {
  return types.some((t) => /digital|elektron|électron/i.test(t));
}

function isKeystonePartner(label: string): boolean {
  return /keystone/i.test(label);
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
