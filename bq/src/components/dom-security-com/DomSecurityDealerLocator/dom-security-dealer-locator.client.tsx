'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { DEMO_PROFILE } from '../_demo/demo-account';
import {
  pushDealerCallbackRequest,
  pushDealerPostalToProfile,
  trackDealerClick,
  trackDealerDetailView,
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

const DEALER_CALLBACK_ENDPOINT =
  'https://webhooks.eu.workato.com/webhooks/rest/99427827-2367-4264-88c3-eb6701fe0d85/dealer-callback-request';

function dealerPinIcon(L: any, active: boolean) {
  const fill = active ? '#d51130' : '#ffffff';
  const ring = active ? '#a50d25' : '#cfcfcf';
  return L.divIcon({
    className: 'dealer-map-pin',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<span style="display:block;width:20px;height:20px;border-radius:50%;background:${fill};border:2px solid ${ring};box-shadow:0 0 10px rgba(0,0,0,.22)"></span>`,
  });
}

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
  const [callbackSending, setCallbackSending] = useState(false);
  const [callbackError, setCallbackError] = useState('');
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

  const selectDealer = useCallback((dealer: DealerRecord) => {
    setActiveId(dealer.id);
    trackDealerClick(dealer.id, dealer.title);
    trackDealerDetailView(dealer.id, dealer.title);
    const marker = markersRef.current.get(dealer.id);
    try {
      marker?.openPopup?.();
      if (isValidLatLng(dealer.latitude, dealer.longitude)) {
        mapRef.current?.setView?.([dealer.latitude, dealer.longitude], SEARCH_ZOOM, {
          animate: true,
        });
      }
    } catch {
      /* ignore map interaction errors in editor */
    }
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
        const marker = L.marker([d.latitude, d.longitude], {
          icon: dealerPinIcon(L, false),
        })
          .bindPopup(
            `<strong>${escapeHtml(d.title)}</strong><br/>${escapeHtml(d.address)}<br/>${escapeHtml(d.address2)}`,
          )
          .on('click', () => selectDealer(d));
        marker.addTo(map);
        markersRef.current.set(d.id, marker);
        bounds.push([d.latitude, d.longitude]);
      } catch {
        /* skip bad marker */
      }
    }

    if (origin && isValidLatLng(origin.lat, origin.lng)) {
      focusMapOnOrigin(map, origin);
      return;
    }

    safeFitBounds(map, L, bounds);
  }, [filtered, mapReady, origin, selectDealer]);

  // Highlight active marker without rebuilding the whole layer group.
  useEffect(() => {
    const leaflet = typeof window !== 'undefined' ? (window as any).L : null;
    if (!leaflet) return;
    const selectedId = activeId ?? filtered[0]?.id ?? null;
    markersRef.current.forEach((marker, id) => {
      if (id === '__origin') return;
      try {
        marker.setIcon?.(dealerPinIcon(leaflet, id === selectedId));
      } catch {
        /* ignore */
      }
    });
  }, [activeId, filtered]);

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
    setCallbackError('');
    setCallbackSending(false);
  };

  const submitCallback = async (event: FormEvent) => {
    event.preventDefault();
    if (!callbackDealer || callbackSending) return;
    const payload = {
      dealerId: callbackDealer.id,
      dealerName: callbackDealer.title,
      phone: callbackPhone,
      postalCode: query.trim() || undefined,
    };
    setCallbackError('');
    setCallbackSending(true);
    try {
      const response = await fetch(DEALER_CALLBACK_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setCallbackError('We could not send your request. Please try again.');
        return;
      }
      pushDealerCallbackRequest(payload);
      setCallbackSent(true);
    } catch {
      setCallbackError('We could not send your request. Please try again.');
    } finally {
      setCallbackSending(false);
    }
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

  const selectedId = activeId ?? filtered[0]?.id ?? null;

  return (
    <div className="find-a-dealer font-[Source_Sans_Pro] text-[#333]">
      <style>{`.dealer-map-pin{background:transparent!important;border:none!important;}`}</style>
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

      <div className="mb-6 grid gap-8 lg:grid-cols-[320px_1fr]">
        <div className="lg:border-r lg:border-[#cac9c9] lg:pr-[27px]">
          <h3 className="m-0 text-[13px] font-semibold uppercase tracking-normal text-black">
            {searchPlaceholder}
          </h3>
          <div className="relative mt-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-[50px] w-full border border-[#cac9c9] bg-white py-[9px] pr-12 pl-5 text-[20px] text-black outline-none focus:border-[#00a0de]"
            />
            <button
              type="button"
              aria-label="Search"
              onClick={handleSearch}
              className="absolute top-0 right-0 flex h-[50px] w-12 items-center justify-center text-[#7e7c7c]"
            >
              <SearchIcon />
            </button>
          </div>
          <button
            type="button"
            onClick={handleUseLocation}
            className="mt-[15px] block text-[18px] font-semibold text-[#00a0de] no-underline"
          >
            {useMyLocationLabel}
          </button>
          {geoError ? (
            <p className="mt-1 text-sm text-[#d51130]">{locationError}</p>
          ) : null}
        </div>

        <div>
          <h3 className="m-0 text-[13px] font-semibold uppercase tracking-normal text-black">
            {selectDealersLabel}
          </h3>
          <ul className="m-0 mt-3 list-none space-y-3 p-0">
            <li>
              <label className="inline-flex items-center gap-2 text-[14.4px] text-[#333]">
                <input
                  type="checkbox"
                  checked={mechanical}
                  onChange={(e) => setMechanical(e.target.checked)}
                  className="h-[18px] w-[18px] shrink-0 accent-[#5ac50b]"
                />
                <TypeIcon kind="mechanical" />
                <span>{mechanicalLabel}</span>
              </label>
            </li>
            <li>
              <label className="inline-flex items-center gap-2 text-[14.4px] text-[#333]">
                <input
                  type="checkbox"
                  checked={digital}
                  onChange={(e) => setDigital(e.target.checked)}
                  className="h-[18px] w-[18px] shrink-0 accent-[#5ac50b]"
                />
                <TypeIcon kind="digital" />
                <span>{digitalLabel}</span>
              </label>
            </li>
          </ul>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-2">
        <div className="relative mt-[18px] min-h-[180px] bg-[#e9e9e9] lg:min-h-[500px]">
          <div ref={mapEl} className="absolute inset-0 z-0 h-full w-full" />
          {!mapReady ? (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#f5f5f5] p-6 text-center">
              <h3 className="m-0 text-[1.2rem] font-light">{mapCookieTitle}</h3>
              <p className="m-0 max-w-sm text-sm text-[#646363]">{mapCookieBody}</p>
            </div>
          ) : null}
        </div>

        <ul className="m-0 max-h-[518px] list-none overflow-y-auto py-0 pr-2 pl-[27px]">
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
              const isActive = selectedId === d.id;
              return (
                <li
                  key={d.id}
                  className="relative my-[18px] min-h-[180px] bg-white px-[27px] py-[27px] shadow-[0_0_20px_-10px_rgba(0,0,0,0.2)]"
                >
                  <span
                    aria-hidden="true"
                    className={`absolute top-[25px] -left-[12px] h-[23px] w-[23px] rounded-full ${
                      isActive
                        ? 'bg-[#d51130]'
                        : 'bg-white shadow-[0_0_20px_3px_rgba(0,0,0,0.1)]'
                    }`}
                  />
                  {keystone ? (
                    <span className="absolute top-0 right-0 inline-flex items-center gap-1 bg-[#fdc300] px-[11px] py-[4px] text-[10.6px] font-semibold uppercase text-[#333]">
                      <span aria-hidden="true">★</span>
                      {d.label || 'Keystone Partner'}
                    </span>
                  ) : d.label ? (
                    <span className="absolute top-0 right-0 text-[10.6px] font-semibold uppercase text-[#d51130]">
                      {d.label}
                    </span>
                  ) : null}
                  {distanceKm != null ? (
                    <span className="absolute top-5 right-[18px] max-w-[210px] text-right text-[13px] leading-tight font-normal uppercase text-[#979696]">
                      {Math.max(1, Math.round(distanceKm))} kilometers from your location
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="block max-w-[58%] text-left"
                    onClick={() => selectDealer(d)}
                  >
                    <h3 className="m-0 text-[18px] leading-6 font-semibold text-black">{d.title}</h3>
                    <p className="m-0 text-[16px] leading-[1.35] font-light text-[#646363]">
                      {d.address}
                      {d.address2 ? (
                        <>
                          <br />
                          {d.address2}
                        </>
                      ) : null}
                      {d.phone ? (
                        <>
                          <br />
                          <em>T: </em>
                          {d.phone}
                        </>
                      ) : null}
                      {d.fax ? (
                        <>
                          <br />
                          <em>F: </em>
                          {d.fax}
                        </>
                      ) : null}
                    </p>
                  </button>
                  {d.email ? (
                    <a
                      href={`mailto:${d.email}`}
                      className="block max-w-[58%] text-[16px] font-light text-[#00a0de] no-underline"
                    >
                      {d.email}
                    </a>
                  ) : null}
                  {d.website ? (
                    <a
                      href={d.website}
                      target="_blank"
                      rel="noreferrer"
                      className="block max-w-[58%] text-[16px] font-light text-[#00a0de] no-underline"
                    >
                      {d.website}
                    </a>
                  ) : null}
                  {isLoggedIn && isActive ? (
                    <button
                      type="button"
                      className="mt-3 inline-flex h-9 items-center bg-[#d51130] px-4 text-[0.85rem] font-normal text-white hover:bg-[#a50d25]"
                      onClick={() => openCallback(d)}
                    >
                      Request a callback
                    </button>
                  ) : null}
                  {hasMech || hasDig ? (
                    <ul className="absolute top-[103px] right-[9px] m-0 w-[190px] list-none p-0">
                      {hasMech ? (
                        <li className="my-[9px] flex items-center gap-[7px] text-[15px] text-[#333]">
                          <TypeIcon kind="mechanical" />
                          <span>{mechanicalLabel}</span>
                        </li>
                      ) : null}
                      {hasDig ? (
                        <li className="my-[9px] flex items-center gap-[7px] text-[15px] text-[#333]">
                          <TypeIcon kind="digital" />
                          <span>{digitalLabel}</span>
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
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
                {callbackError ? (
                  <p className="m-0 text-sm text-[#d51130]">{callbackError}</p>
                ) : null}
                <button
                  type="submit"
                  disabled={callbackSending}
                  className="mt-2 inline-flex h-11 items-center justify-center bg-[#d51130] px-5 text-[0.95rem] text-white hover:bg-[#a50d25] disabled:opacity-60"
                >
                  {callbackSending ? 'Sending…' : 'Send request'}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M16 16.5L20 20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TypeIcon({ kind }: { kind: 'mechanical' | 'digital' }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full bg-[#7e7c7c] text-white"
    >
      {kind === 'mechanical' ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14.5 3a3.5 3.5 0 0 0-3.45 4.1L4 14.15V20h5.85l1.2-1.2-1.55-1.55 1.4-1.4 1.55 1.55 1.4-1.4-1.55-1.55 2.05-2.05A3.5 3.5 0 1 0 14.5 3Zm0 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
        </svg>
      ) : (
        <svg width="12" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 2 4 14h7l-1 8 10-14h-7l0-6Z" />
        </svg>
      )}
    </span>
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
