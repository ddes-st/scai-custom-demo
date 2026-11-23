"use client";

import { config, library } from "@fortawesome/fontawesome-svg-core";
import { fab } from "@fortawesome/free-brands-svg-icons";
import { far } from "@fortawesome/free-regular-svg-icons";
import { fas } from "@fortawesome/free-solid-svg-icons";
import "@fortawesome/fontawesome-svg-core/styles.css";

// CSS is imported once; avoid FA injecting a second <style> tag.
config.autoAddCss = false;

let registered = false;

/** Register Font Awesome Free 7.3.1 solid / regular / brands once. */
export function ensureFontAwesomeFree(): void {
  if (registered) return;
  library.add(fas, far, fab);
  registered = true;
}
