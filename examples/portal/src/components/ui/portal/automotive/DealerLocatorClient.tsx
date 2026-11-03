"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";

export interface LocatorShowroom { key: string; name: string; city: string; address: string; country: string; lat: number | null; lng: number | null; phone: string }
export interface LocatorDealer { id: string; name: string; marque: string; marqueSlug: string; region: string; tier: string; showrooms: LocatorShowroom[] }
export interface LocatorLabels { allMarques: string; allRegions: string; count: string; none: string; directions: string; map: string; marque: string; region: string }

const placed = (s: LocatorShowroom): s is LocatorShowroom & { lat: number; lng: number } => typeof s.lat === "number" && typeof s.lng === "number" && Number.isFinite(s.lat) && Number.isFinite(s.lng);
const text = (tag: string, value: string, className?: string) => { const el = document.createElement(tag); el.textContent = value; if (className) el.className = className; return el; };

/**
 * The dealers by marque and region: filters, a card per dealer with its showrooms (address, phone,
 * directions) and a map with a pin per showroom (Leaflet, OpenStreetMap tiles). Choosing a
 * showroom moves the map to it. The filters start from the page's ?brand= (a marque's slug).
 */
export function DealerLocatorClient({ dealers, labels, initialMarque }: { dealers: LocatorDealer[]; labels: LocatorLabels; initialMarque: string }) {
  const marques = useMemo(() => [...new Map(dealers.filter((d) => d.marqueSlug).map((d) => [d.marqueSlug, d.marque])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [dealers]);
  const regions = useMemo(() => [...new Set(dealers.map((d) => d.region).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [dealers]);
  const [marque, setMarque] = useState(marques.some(([s]) => s === initialMarque) ? initialMarque : "");
  const [region, setRegion] = useState("");
  const shown = useMemo(() => dealers.filter((d) => (!marque || d.marqueSlug === marque) && (!region || d.region === region)), [dealers, marque, region]);
  const showrooms = shown.reduce((n, d) => n + d.showrooms.length, 0);

  // the map: created once in the browser, its pins follow the filters
  const box = useRef<HTMLDivElement | null>(null);
  const map = useRef<LeafletMap | null>(null);
  const pins = useRef<LayerGroup | null>(null);
  const byKey = useRef(new Map<string, any>());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let resize: ResizeObserver | null = null;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !box.current || map.current) return;
      map.current = L.map(box.current, { scrollWheelZoom: false, worldCopyJump: true }).setView([48, 6], 4);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map.current);
      pins.current = L.layerGroup().addTo(map.current);
      // the box changes size (layout breakpoints, a resized window): Leaflet has to measure again
      resize = new ResizeObserver(() => map.current?.invalidateSize());
      resize.observe(box.current);
      setReady(true);
    })();
    return () => { cancelled = true; resize?.disconnect(); map.current?.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!ready || !map.current || !pins.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !map.current || !pins.current) return;
      pins.current.clearLayers();
      byKey.current.clear();
      const points: Array<[number, number]> = [];
      for (const d of shown) for (const s of d.showrooms.filter(placed)) {
        const label = document.createElement("span");
        label.append(text("strong", s.name || d.name), text("span", ` · ${d.name}`), document.createElement("br"), text("span", [s.address, s.city].filter(Boolean).join(", ")));
        const pin = L.circleMarker([s.lat, s.lng], { radius: 7, weight: 2, color: "#fff", fillColor: "#9528e6", fillOpacity: 1, className: "au-pin" }).bindPopup(label);
        pins.current.addLayer(pin);
        byKey.current.set(s.key, pin);
        points.push([s.lat, s.lng]);
      }
      if (points.length === 1) map.current.setView(points[0], 12);
      else if (points.length) map.current.fitBounds(points, { padding: [24, 24], maxZoom: 12 });
    })();
    return () => { cancelled = true; };
  }, [shown, ready]);
  const focus = (s: LocatorShowroom) => {
    const pin = byKey.current.get(s.key);
    if (!pin || !map.current || !placed(s)) return;
    map.current.setView([s.lat, s.lng], 13);
    pin.openPopup();
    box.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="au-locator">
      <div className="au-locator-filters" role="group">
        <label><span className="sr-only">{labels.marque}</span>
          <select value={marque} onChange={(e) => setMarque(e.target.value)} aria-label={labels.marque}>
            <option value="">{labels.allMarques}</option>
            {marques.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}
          </select>
        </label>
        <label><span className="sr-only">{labels.region}</span>
          <select value={region} onChange={(e) => setRegion(e.target.value)} aria-label={labels.region}>
            <option value="">{labels.allRegions}</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <span className="au-locator-count" aria-live="polite">{labels.count.replace("{n}", String(shown.length)).replace("{m}", String(showrooms))}</span>
      </div>
      <div className="au-locator-body">
        <div className="au-map" ref={box} role="region" aria-label={labels.map} />
        <ul className="au-dealers">
          {shown.map((d) => (
            <li key={d.id} className="au-dealer">
              <h3>{d.name}</h3>
              <p className="sub">{[d.marque, d.tier, d.region].filter(Boolean).join(" · ")}</p>
              {d.showrooms.length > 0 && (
                <ul className="au-showrooms">
                  {d.showrooms.map((s) => (
                    <li key={s.key}>
                      <button type="button" className="au-showroom" onClick={() => focus(s)} disabled={!placed(s)}>
                        <strong>{s.name || s.city}</strong>
                        <span>{[s.address, s.city].filter(Boolean).join(", ")}</span>
                      </button>
                      <span className="au-showroom-links">
                        {s.phone && <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}>{s.phone}</a>}
                        {placed(s) && <a href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`} target="_blank" rel="noopener noreferrer">{labels.directions}</a>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          {!shown.length && <li className="portal-empty">{labels.none}</li>}
        </ul>
      </div>
    </div>
  );
}
