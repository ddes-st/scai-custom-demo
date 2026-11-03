import "server-only";
import React from "react";
import { env } from "src/lib/ch/env";
import { universityModel, type UniversityRole } from "src/lib/ch/university";
import { EditorNotice } from "src/lib/portal/editor";

/** Live, a university component without its data renders nothing; in the Page builder it says why. `role` "programs" needs no model entry. */
export function universityMissing(role: UniversityRole | "programs", title: string, editing: boolean): React.ReactNode | false {
  if (!env.edgeToken) return editing ? <EditorNotice title={title}>This component reads Experience Edge for Content Hub, which isn&apos;t connected (EDGE_TOKEN).</EditorNotice> : null;
  if (role !== "programs" && !universityModel(role)) return editing ? <EditorNotice title={title}>This portal&apos;s industry model has no {role} (PORTAL_MODEL — set by the Demo Builder&apos;s SitecoreAI deploy for a university demo).</EditorNotice> : null;
  return false;
}
