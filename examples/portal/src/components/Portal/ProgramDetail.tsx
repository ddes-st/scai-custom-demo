import React from "react";
import { Link } from "src/i18n/navigation";
import { attempt } from "src/lib/ch/portalEdge";
import { loadProduct } from "src/lib/ch/products";
import { claimFor, loadClaims, loadExperts, loadProgram, loadPrograms } from "src/lib/ch/university";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { requestContext } from "src/lib/portal/request-context";
import { SECTION_PATH } from "src/lib/portal/sections";
import { ui } from "src/lib/portal/ui-text";
import { ChImage } from "components/ui/portal/ChImage";
import { RichTextServer } from "components/ui/portal/RichTextServer";
import { TuitionEstimator } from "components/ui/portal/university/TuitionEstimator";
import { shortDate, usd, yearsFor } from "components/ui/portal/university/format";
import { pageLocale } from "components/ui/portal/sports/shared";
import { universityMissing } from "components/ui/portal/university/shared";

/**
 * One degree program (/programs/<id>, DetailKind program): description, the facts (college,
 * level, format, credit hours, CIP code, entry term, deadline), a tuition estimator, the
 * employment outcome — labelled with its verified claim when one matches — the faculty experts
 * who teach in it, and Request info (the admissions CRM's inquiry form). In the Page builder
 * (no id in the URL) the first program is the sample.
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const missing = universityMissing("programs", "Program", editing);
  if (missing !== false) return missing;
  let id = requestContext().slug;
  if (!id && editing) id = (await attempt(async () => (await loadPrograms())[0]?.id ?? "")).data ?? "";
  if (!id) return editing ? <EditorNotice title="Program">No published program yet — the live page renders the program from the URL (/programs/&lt;id&gt;).</EditorNotice> : <LoadError message="No program in the URL." missing />;
  const res = await attempt(() => loadProgram(id));
  if (res.error) return editing ? <EditorNotice title="Program">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  const p = res.data;
  if (!p) return editing ? <EditorNotice title="Program">No published program with id “{id}”.</EditorNotice> : <LoadError message="This program isn't published." missing />;
  const [detail, experts, claims] = await Promise.all([attempt(() => loadProduct(id)), attempt(() => loadExperts()), attempt(() => loadClaims())]);
  const locale = pageLocale();
  const teaching = (experts.data ?? []).filter((e) => e.programIds.includes(p.id));
  const claim = p.employmentRate != null ? claimFor(p, claims.data ?? []) : null;
  const facts: Array<[string, string]> = ([
    [ui("unCollege"), p.college?.name ?? ""], [ui("unLevel"), p.level], [ui("unDelivery"), p.delivery],
    [ui("unCredits"), p.creditHours != null ? String(p.creditHours) : ""], [ui("unEntryTerm"), p.entryTerm],
    [ui("unDeadlineLabel"), p.deadline ? shortDate(p.deadline, locale) : ""], [ui("unCip"), p.cip], [ui("unProgramCode"), p.code],
  ] as Array<[string, string]>).filter(([, v]) => v);
  return (
    <article className={`portal-detail un-program-page ${c.className}`.trim()} id={c.id}>
      <p className="portal-note"><Link href={SECTION_PATH.programs}>{ui("unAllProgramsBack")}</Link></p>
      <div className="portal-detail-head">
        {p.image && <span className="media"><ChImage links={p.imageLinks} fallback={p.image} slot="lead" alt="" loading="eager" /></span>}
        <div className="text">
          <span className="eyebrow">{[p.college?.name, p.level].filter(Boolean).join(" · ")}</span>
          <h1>{p.name}</h1>
          {p.summary && <p className="lead">{p.summary}</p>}
          <div className="actions">
            {p.requestInfoUrl && <a className="sp-buy" href={p.requestInfoUrl} target="_blank" rel="noopener noreferrer">{ui("unRequestInfo")}</a>}
            {p.college && <Link href={`${SECTION_PATH.programs}?college=${encodeURIComponent(p.college.id)}`}>{ui("unMoreFromCollege", { college: p.college.name })}</Link>}
          </div>
        </div>
      </div>
      <div className="un-columns">
        <div>
          {detail.data?.descriptionHtml && <section className="portal-section"><RichTextServer html={detail.data.descriptionHtml} /></section>}
          <section className="portal-section"><dl className="portal-facts">{facts.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl></section>
          {p.employmentRate != null && (
            <section className="portal-section un-outcome">
              <div className="portal-section-head"><h2>{ui("unOutcomes")}</h2></div>
              <p className="big"><b>{Math.round(p.employmentRate)}%</b> <span>{ui("unEmploymentRate")}</span></p>
              {claim && <p className="claim">“{claim.wording}” <span className="sub">{ui("unVerified", { source: claim.source, year: claim.dataYear })}</span></p>}
            </section>
          )}
          {teaching.length > 0 && (
            <section className="portal-section">
              <div className="portal-section-head"><h2>{ui("unFaculty")}</h2></div>
              <div className="un-expert-grid compact">
                {teaching.map((e) => (
                  <article key={e.id} className="un-expert">
                    <span className="photo">{e.portrait ? <ChImage links={e.portrait.links} fallback={e.portrait.preview} slot="tile" alt={e.name} /> : <span className="glyph">{e.name.split(/\s+/).map((w) => w.charAt(0)).slice(0, 2).join("")}</span>}</span>
                    <div className="body"><h3>{e.name}</h3>{e.title && <p className="sub">{e.title}</p>}</div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
        {(p.tuitionInState != null || p.tuitionOutOfState != null) && (
          <aside>
            <TuitionEstimator inState={p.tuitionInState} outOfState={p.tuitionOutOfState} defaultYears={yearsFor(p.level, p.creditHours)} locale={locale} />
            <p className="sub un-rates">{[p.tuitionInState != null ? `${ui("unInState")} ${usd(p.tuitionInState, locale)}` : "", p.tuitionOutOfState != null ? `${ui("unOutOfState")} ${usd(p.tuitionOutOfState, locale)}` : ""].filter(Boolean).join(" · ")}</p>
          </aside>
        )}
      </div>
    </article>
  );
};
