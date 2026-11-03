import React from "react";
import { RichText } from "./RichText";

/**
 * The product data editor's sheet (Content Hub's productDataSheet Json): sections of
 * key-value tables, simple and complex tables and text. Diagrams and images stay in
 * Content Hub's editor.
 */
type Cell = string | number | { value?: string | number } | null | undefined;
const cell = (c: Cell) => (c == null ? "" : typeof c === "object" ? String(c.value ?? "") : String(c));

export function DataSheet({ sheet }: { sheet: any }) {
  const sections: any[] = [...(sheet?.sections ?? [])].sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0));
  return (
    <div className="portal-datasheet">
      {sections.map((s, si) => (
        <section key={s?.id ?? si}>
          <h3>{String(s?.title ?? "")}</h3>
          {(s?.content ?? []).map((b: any, bi: number) => {
            const key = b?.id ?? bi;
            if (b?.type === "key-value-table") {
              return (
                <div key={key} className="portal-table-wrap">
                  <table className="portal-table">
                    {b.title && <caption>{b.title}</caption>}
                    <tbody>
                      {(b.entries ?? []).map((e: any, i: number) => (
                        <tr key={i}>
                          <th>{String(e?.key ?? "")}</th>
                          <td>
                            {cell(e?.value)}
                            {e?.unit ? ` ${e.unit}` : ""}
                            {e?.standard ? <span className="muted"> · {e.standard}</span> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }
            if (b?.type === "simple-table" || b?.type === "complex-table") {
              const cols: any[] = b.columns ?? [];
              const groups: Array<{ header?: string; rows: any[] }> = b.type === "simple-table" ? [{ rows: b.rows ?? [] }] : (b.groups ?? []).map((g: any) => ({ header: g?.header, rows: g?.rows ?? [] }));
              return (
                <div key={key} className="portal-table-wrap">
                  <table className="portal-table grid">
                    {b.title && <caption>{b.title}</caption>}
                    <thead>
                      <tr>{cols.map((c) => <th key={c.key}>{String(c.label ?? c.key)}</th>)}</tr>
                    </thead>
                    <tbody>
                      {groups.map((g, gi) => (
                        <React.Fragment key={gi}>
                          {g.header && <tr className="group"><th colSpan={Math.max(1, cols.length)}>{g.header}</th></tr>}
                          {g.rows.map((r, i) => (
                            <tr key={i}>{cols.map((c) => <td key={c.key}>{cell(r?.cells?.[c.key])}</td>)}</tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                  {b.caption && <p className="portal-table-note">{b.caption}</p>}
                  {Array.isArray(b.footnotes) && b.footnotes.map((f: string, i: number) => <p key={i} className="portal-table-note">{i + 1}. {f}</p>)}
                </div>
              );
            }
            if (b?.type === "text" && typeof b.content === "string") return <RichText key={key} html={b.content} />;
            return null;
          })}
        </section>
      ))}
    </div>
  );
}
