"use client";
import { useEffect, useState } from "react";
import { useUi } from "src/lib/portal/ui-text-client";

/** "Starts in 3 d 4 h 12 min" up to the puck drop, then "Under way" (refreshes every 30 s). */
export function Countdown({ start }: { start: string }) {
  const t = useUi();
  const target = Date.parse(start);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  // rendered after hydration only (the server's clock would differ from the visitor's)
  if (now == null || Number.isNaN(target)) return <span className="sp-countdown" aria-hidden="true" />;
  const left = target - now;
  if (left <= 0) return <span className="sp-countdown live">{t("spUnderway")}</span>;
  const d = Math.floor(left / 86_400_000), h = Math.floor((left % 86_400_000) / 3_600_000), m = Math.floor((left % 3_600_000) / 60_000);
  return (
    <span className="sp-countdown" role="timer">
      <span className="label">{t("spStartsIn")}</span>
      {d > 0 && <span className="unit"><b>{d}</b> {t("spDays")}</span>}
      <span className="unit"><b>{h}</b> {t("spHours")}</span>
      <span className="unit"><b>{m}</b> {t("spMinutes")}</span>
    </span>
  );
}
