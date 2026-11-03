import React from "react";
import { attempt } from "src/lib/ch/portalEdge";
import { loadPrograms } from "src/lib/ch/university";
import { chrome, isEditing, type PortalComponentProps } from "src/lib/portal/component";
import { EditorNotice, LoadError } from "src/lib/portal/editor";
import { requestContext } from "src/lib/portal/request-context";
import { ProgramBrowser } from "components/ui/portal/university/ProgramBrowser";
import { pageLocale } from "components/ui/portal/sports/shared";
import { universityMissing } from "components/ui/portal/university/shared";

/**
 * The program finder: every degree program (products with an admissions program code) as a
 * card — college, level, format, deadline and "applications up x%" when the CRM reports more
 * than 5% over last year — with level / college / format filters and an interest search.
 * `?college=<family id>` opens on one college (the program page's college link).
 */
export const Default = async (props: PortalComponentProps) => {
  const editing = isEditing(props.page);
  const c = chrome(props);
  const missing = universityMissing("programs", "Program finder", editing);
  if (missing !== false) return missing;
  const res = await attempt(() => loadPrograms());
  if (res.error) return editing ? <EditorNotice title="Program finder">{res.error}</EditorNotice> : <LoadError message={res.error} />;
  const programs = res.data ?? [];
  if (!programs.length) return editing ? <EditorNotice title="Program finder">No degree programs are published (products with slate_ProgramCode).</EditorNotice> : null;
  let college = "";
  try { const s = requestContext().search as Record<string, unknown>; college = typeof s?.college === "string" ? s.college : ""; } catch { /* no request */ }
  return (
    <div className={c.className || undefined} id={c.id}>
      <ProgramBrowser
        programs={programs.map((p) => ({ id: p.id, name: p.name, summary: p.summary, image: p.image, imageLinks: p.imageLinks, college: p.college, level: p.level, delivery: p.delivery, deadline: p.deadline, applicationsVsLastYear: p.applicationsVsLastYear }))}
        locale={pageLocale()}
        initialCollege={programs.some((p) => p.college?.id === college) ? college : ""}
      />
    </div>
  );
};
