import { fileExtension } from "./format";

export type FileKind =
  | "presentation"
  | "document"
  | "spreadsheet"
  | "pdf"
  | "web"
  | "image"
  | "vector"
  | "archive"
  | "video"
  | "font"
  | "generic";

export interface FileTypeMeta {
  /** Uppercase extension, e.g. "PPTX". */
  ext: string;
  /** Human label for the media type, e.g. "PowerPoint presentation". */
  label: string;
  /** Drives the colour treatment of the file glyph. */
  kind: FileKind;
}

const BY_EXT: Record<string, { label: string; kind: FileKind }> = {
  pptx: { label: "PowerPoint presentation", kind: "presentation" },
  ppt: { label: "PowerPoint presentation", kind: "presentation" },
  potx: { label: "PowerPoint template", kind: "presentation" },
  key: { label: "Keynote presentation", kind: "presentation" },
  docx: { label: "Word document", kind: "document" },
  doc: { label: "Word document", kind: "document" },
  dotx: { label: "Word template", kind: "document" },
  rtf: { label: "Rich text document", kind: "document" },
  txt: { label: "Plain text", kind: "document" },
  xlsx: { label: "Excel workbook", kind: "spreadsheet" },
  xls: { label: "Excel workbook", kind: "spreadsheet" },
  csv: { label: "Comma-separated values", kind: "spreadsheet" },
  pdf: { label: "PDF document", kind: "pdf" },
  html: { label: "HTML template", kind: "web" },
  htm: { label: "HTML template", kind: "web" },
  css: { label: "Stylesheet", kind: "web" },
  js: { label: "Script", kind: "web" },
  png: { label: "PNG image", kind: "image" },
  jpg: { label: "JPEG image", kind: "image" },
  jpeg: { label: "JPEG image", kind: "image" },
  gif: { label: "GIF image", kind: "image" },
  webp: { label: "WebP image", kind: "image" },
  tif: { label: "TIFF image", kind: "image" },
  tiff: { label: "TIFF image", kind: "image" },
  psd: { label: "Photoshop document", kind: "image" },
  svg: { label: "SVG vector", kind: "vector" },
  ai: { label: "Illustrator artwork", kind: "vector" },
  eps: { label: "EPS vector", kind: "vector" },
  indd: { label: "InDesign document", kind: "vector" },
  sketch: { label: "Sketch document", kind: "vector" },
  fig: { label: "Figma document", kind: "vector" },
  zip: { label: "Archive", kind: "archive" },
  rar: { label: "Archive", kind: "archive" },
  "7z": { label: "Archive", kind: "archive" },
  mp4: { label: "Video", kind: "video" },
  mov: { label: "Video", kind: "video" },
  webm: { label: "Video", kind: "video" },
  woff: { label: "Web font", kind: "font" },
  woff2: { label: "Web font", kind: "font" },
  ttf: { label: "Font", kind: "font" },
  otf: { label: "Font", kind: "font" },
};

export function fileTypeMeta(fileName: string): FileTypeMeta {
  const ext = fileExtension(fileName);
  const hit = BY_EXT[ext.toLowerCase()];
  return { ext, label: hit?.label || `${ext} file`, kind: hit?.kind || "generic" };
}
