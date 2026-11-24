import type { PageTemplateBinding } from "../../../../tools/definitions/types";

/**
 * Almost empty page template. Insert it only under Home/lp.
 * New pages keep the site header and footer and an empty main placeholder.
 * Example pages assign their own page design (`presentation: "composed"`).
 */
export const landingPageTemplate = {
  name: "Landing Page",
  insertOnlyUnder: ["/lp"],
  presentation: "composed",
  sections: [
    {
      name: "Landing",
      fields: [{ name: "Title", type: "Single-Line Text" }],
    },
  ],
} satisfies PageTemplateBinding;
