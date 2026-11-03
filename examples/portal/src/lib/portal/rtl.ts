/** Languages written right to left (server and client). */
const RTL = /^(ar|he|fa|ur|ps|yi|dv|ckb)(-|$)/i;

export const isRtl = (lang: string) => RTL.test(lang || "");
