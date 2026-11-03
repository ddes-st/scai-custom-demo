"use client";
import React, { useEffect, useState } from "react";

export interface CountdownLabels { revealIn: string; days: string; hours: string; minutes: string; seconds: string; revealed: string }

/**
 * Days, hours, minutes and seconds to the reveal, ticking every second; at zero it says it was
 * revealed. Starts from the server's clock (`serverNow`) so the first render matches the HTML.
 */
export function Countdown({ target, serverNow, labels }: { target: string; serverNow: number; labels: CountdownLabels }) {
  const end = Date.parse(target);
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  if (!Number.isFinite(end)) return null;
  const left = Math.max(0, end - now);
  if (left === 0) return <p className="au-count-done">{labels.revealed}</p>;
  const s = Math.floor(left / 1000);
  const parts: Array<[number, string]> = [[Math.floor(s / 86400), labels.days], [Math.floor((s % 86400) / 3600), labels.hours], [Math.floor((s % 3600) / 60), labels.minutes], [s % 60, labels.seconds]];
  return (
    <div className="au-count" role="timer" aria-live="off">
      <p className="au-count-label">{labels.revealIn}</p>
      <div className="au-count-cells">
        {parts.map(([n, label]) => (
          <span key={label} className="au-count-cell">
            <strong>{String(n).padStart(2, "0")}</strong>
            <span>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
