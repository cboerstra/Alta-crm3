import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../../server/routers";

/** Display helpers for the payroll screens. Money arrives from the server as integer cents. */

export type PayrollOutputs = inferRouterOutputs<AppRouter>["payroll"];

export const usd = (cents: number | null | undefined) =>
  ((cents ?? 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export const toCents = (s: string) => Math.round((Number(s) || 0) * 100);
export const fromCents = (c: number | null | undefined) => (c ? (c / 100).toFixed(2) : "");

export const fmtDate = (d: Date | string | null | undefined) => {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(`${d.slice(0, 10)}T00:00:00Z`) : d;
  return date.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
};

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const AGENCY_LABELS = {
  irs_941: "IRS — Form 941 (EFTPS)",
  irs_940: "IRS — Form 940 FUTA (EFTPS)",
  utah_withholding: "Utah withholding (TAP)",
  utah_ui: "Utah unemployment (DWS)",
} as const;

export const CLASSIFICATION_LABELS = {
  s_corp: "LLC taxed as S-corp",
  c_corp: "LLC taxed as C-corp",
  partnership: "Multi-member LLC (partnership)",
  disregarded: "Single-member LLC (disregarded)",
} as const;

export const FILING_STATUS_LABELS = {
  single: "Single or married filing separately",
  married_joint: "Married filing jointly",
  head_of_household: "Head of household",
} as const;

/** Print one element in a clean window (keeps the sidebar and buttons off the page). */
export function printElement(id: string, title: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title}</title><style>
    body{font-family:system-ui,sans-serif;font-size:12px;color:#111;margin:24px}
    h2,h3{margin:16px 0 6px} table{border-collapse:collapse;width:100%;margin-bottom:12px}
    td,th{border:1px solid #ccc;padding:4px 6px;text-align:left} td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
    .no-print,button{display:none!important} .muted{color:#666}
  </style></head><body>${el.innerHTML}</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}
