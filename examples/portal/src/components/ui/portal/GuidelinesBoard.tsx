"use client";

import { useState } from "react";
import { useUi } from "src/lib/portal/ui-text-client";

export interface GuideLogo { title: string; url: string }
export interface GuideColor { title: string; hex: string }
export interface GuideShot { title: string; url: string; dont: boolean }

/** The master brand's logos, colours and photography. The assistant and the draft check are not connected. */
export function GuidelinesBoard({ logos, colors, shots }: { logos: GuideLogo[]; colors: GuideColor[]; shots: GuideShot[] }) {
  const t = useUi();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const ask = (e: React.FormEvent) => { e.preventDefault(); setAnswer(t("hubNotOnFeed")); };
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="hub-guidelines">
      <form className="hub-ask" onSubmit={ask}>
        <p>{t("hubAskGuide")}</p>
        <input value={question} placeholder={t("hubAskPlaceholder")} onChange={(e) => setQuestion(e.target.value)} aria-label={t("hubAskGuide")} />
        <button type="submit">{t("hubAskGuide")}</button>
        {answer && <p className="hub-gap">{answer}</p>}
      </form>
      <div className="hub-guide-jumps">
        {logos.length > 0 && <button type="button" onClick={() => jump("guide-logo")}>{t("hubLogo")}</button>}
        {colors.length > 0 && <button type="button" onClick={() => jump("guide-colour")}>{t("hubColour")}</button>}
        {shots.length > 0 && <button type="button" onClick={() => jump("guide-photo")}>{t("hubPhotography")}</button>}
      </div>

      <section id="guide-logo">
        <h2>{t("hubLogo")}</h2>
        {logos.length === 0 ? <p className="hub-gap">{t("hubNotOnFeed")}</p> : (
          <div className="hub-logo-row">
            {logos.map((logo) => (
              <figure key={logo.url || logo.title}>
                {logo.url ? <img src={logo.url} alt="" /> : <span className="hub-needed">{t("hubImageNeeded")}</span>}
                <figcaption>{logo.title}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      <section id="guide-colour">
        <h2>{t("hubColour")}</h2>
        {colors.length === 0 ? <p className="hub-gap">{t("hubNotOnFeed")}</p> : (
          <div className="hub-color-row">
            {colors.map((c) => (
              <figure key={c.hex || c.title}>
                <span className="swatch" style={{ background: c.hex || "transparent" }} />
                <figcaption><strong>{c.title}</strong>{c.hex && <span>{c.hex}</span>}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      <section id="guide-photo">
        <h2>{t("hubPhotography")}</h2>
        {shots.length === 0 ? <p className="hub-gap">{t("hubNotOnFeed")}</p> : (
          <div className="hub-photo-row">
            {shots.map((s) => (
              <figure key={s.url || s.title} className={s.dont ? "is-dont" : "is-do"}>
                {s.url ? <img src={s.url} alt="" /> : <span className="hub-needed">{t("hubImageNeeded")}</span>}
                <figcaption>{s.dont ? t("hubNotThis") : t("hubYesThis")} {s.title}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>

      <section className="hub-draft">
        <div>
          <h2>{t("hubDraftTitle")}</h2>
          <p>{t("hubDraftLead")}</p>
          <button type="button" onClick={() => setAnswer(t("hubNotOnFeed"))}>{t("hubTryDraft")}</button>
          <button type="button" onClick={() => setAnswer(t("hubNotOnFeed"))}>{t("hubUploadFile")}</button>
        </div>
        <aside>
          <p>{t("hubSampleDraft")}</p>
          <p className="hub-gap">{t("hubNotOnFeed")}</p>
        </aside>
      </section>
    </div>
  );
}
