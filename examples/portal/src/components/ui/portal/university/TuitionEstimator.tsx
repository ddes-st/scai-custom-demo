"use client";
import { useState } from "react";
import { useUi } from "src/lib/portal/ui-text-client";
import { usd } from "./format";

/** Residency × years → yearly and total tuition (published rates; fees, housing and aid excluded). */
export function TuitionEstimator({ inState, outOfState, defaultYears, locale }: { inState: number | null; outOfState: number | null; defaultYears: number; locale: string }) {
  const t = useUi();
  const [resident, setResident] = useState(inState != null);
  const [years, setYears] = useState(defaultYears);
  const rate = resident ? inState : outOfState;
  return (
    <div className="un-estimator">
      <h3>{t("unTuitionEstimator")}</h3>
      <div className="row" role="group" aria-label={t("unResidency")}>
        {inState != null && <button type="button" className={resident ? "active" : undefined} aria-pressed={resident} onClick={() => setResident(true)}>{t("unInState")}</button>}
        {outOfState != null && <button type="button" className={!resident ? "active" : undefined} aria-pressed={!resident} onClick={() => setResident(false)}>{t("unOutOfState")}</button>}
      </div>
      <label className="years">{t("unYears")}
        <input type="number" min={1} max={10} value={years} onChange={(e) => setYears(Math.min(10, Math.max(1, Number(e.target.value) || 1)))} />
      </label>
      <dl>
        <div><dt>{t("unPerYear")}</dt><dd>{usd(rate, locale)}</dd></div>
        <div className="total"><dt>{t("unTotal", { years })}</dt><dd>{rate == null ? "–" : usd(rate * years, locale)}</dd></div>
      </dl>
      <p className="note">{t("unEstimateNote")}</p>
    </div>
  );
}
