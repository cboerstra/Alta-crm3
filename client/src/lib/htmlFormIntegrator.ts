/**
 * HTML Form Integrator
 * ─────────────────────────────────────────────────────────────────────────────
 * Detects forms in user-uploaded HTML (e.g. produced by Claude design), maps
 * each input to a known CRM field by heuristic, and produces a transformed
 * HTML string that auto-wires to /api/website-lead via alta-form-embed.js.
 *
 * Pure browser code — uses DOMParser. No network calls.
 */

export type TargetField =
  | "firstName"
  | "lastName"
  | "fullName"
  | "email"
  | "phone"
  | "message"
  | "smsConsent"
  | "loanType"
  | "ignore";

export const TARGET_FIELD_LABELS: Record<TargetField, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  fullName: "Full Name (auto-splits)",
  email: "Email",
  phone: "Phone",
  message: "Message / Notes",
  smsConsent: "SMS Consent",
  loanType: "Loan Type",
  ignore: "— Do not map —",
};

export type DetectedInput = {
  /** Stable id so React can key rows even when the user changes mappings. */
  id: string;
  /** Original `name` attribute (may be empty). */
  originalName: string;
  /** The `<input>`/`<textarea>`/`<select>` tag name. */
  tag: "input" | "textarea" | "select";
  /** Input type, where applicable. */
  type: string | null;
  /** Placeholder text or nearby label text, used to show context in the UI. */
  context: string;
  /** Auto-detected target. User can override before applying. */
  suggested: TargetField;
};

export type DetectedForm = {
  /** Index of the form in document order. */
  index: number;
  /** Number of inputs found. */
  inputCount: number;
  /** First few inputs for UI preview. */
  inputs: DetectedInput[];
  /** Existing `action` attribute (for context only). */
  action: string | null;
};

export type DetectionResult = {
  forms: DetectedForm[];
  /** If the document already has <script src="...alta-form-embed.js">. */
  hasEmbedScript: boolean;
  parseError: string | null;
};

/**
 * Heuristic: map an input's name/id/placeholder/type/label to a known CRM
 * field. Returns "ignore" when nothing matches.
 */
export function suggestTargetField(hints: {
  name: string;
  id: string;
  type: string | null;
  placeholder: string;
  labelText: string;
  tag: string;
}): TargetField {
  const haystack = [
    hints.name,
    hints.id,
    hints.placeholder,
    hints.labelText,
  ]
    .join(" ")
    .toLowerCase();

  if (hints.type === "email" || /\bemail\b|\be-?mail\b/.test(haystack)) {
    return "email";
  }
  if (hints.type === "tel" || /\bphone\b|\bmobile\b|\bcell\b|\btel\b/.test(haystack)) {
    return "phone";
  }
  if (hints.type === "checkbox") {
    if (/sms|text|consent|opt.?in|agree/.test(haystack)) return "smsConsent";
    return "ignore";
  }
  if (hints.tag === "textarea" || /\bmessage\b|\bnote\b|\bcomment\b|\bquestion\b/.test(haystack)) {
    return "message";
  }
  if (/\bfirst.?name\b|\bfname\b|\bgiven\b/.test(haystack)) return "firstName";
  if (/\blast.?name\b|\blname\b|\bsurname\b|\bfamily\b/.test(haystack)) return "lastName";
  if (/\bfull.?name\b|^\s*name\s*$|\byour.?name\b|\bcontact.?name\b/.test(haystack)) {
    return "fullName";
  }
  if (/\bloan\b|\bproduct\b|\bprogram\b/.test(haystack)) return "loanType";

  // Single bare "name" input → treat as fullName
  if (hints.name.toLowerCase() === "name") return "fullName";

  return "ignore";
}

function getLabelTextFor(el: Element, doc: Document): string {
  const id = el.getAttribute("id");
  if (id) {
    const label = doc.querySelector(`label[for="${cssEscape(id)}"]`);
    if (label) return label.textContent?.trim() ?? "";
  }
  // Walk up to an ancestor <label>
  let node: Element | null = el.parentElement;
  while (node) {
    if (node.tagName === "LABEL") return node.textContent?.trim() ?? "";
    node = node.parentElement;
  }
  return "";
}

function cssEscape(v: string): string {
  if (typeof (window as any).CSS?.escape === "function") {
    return (window as any).CSS.escape(v);
  }
  return v.replace(/["\\]/g, "\\$&");
}

export function detectForms(html: string): DetectionResult {
  if (typeof DOMParser === "undefined") {
    return { forms: [], hasEmbedScript: false, parseError: "DOMParser not available" };
  }
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch (err: any) {
    return { forms: [], hasEmbedScript: false, parseError: err?.message ?? "Failed to parse HTML" };
  }

  const hasEmbedScript = !!doc.querySelector('script[src*="alta-form-embed.js"]');

  const formEls = Array.from(doc.querySelectorAll("form"));
  const forms: DetectedForm[] = formEls.map((formEl, index) => {
    const inputEls = Array.from(
      formEl.querySelectorAll("input, textarea, select")
    ).filter((el) => {
      const type = (el.getAttribute("type") || "").toLowerCase();
      return !["submit", "button", "reset", "hidden", "image"].includes(type);
    });

    const inputs: DetectedInput[] = inputEls.map((el, i) => {
      const tag = el.tagName.toLowerCase() as "input" | "textarea" | "select";
      const type = el.getAttribute("type");
      const name = el.getAttribute("name") ?? "";
      const id = el.getAttribute("id") ?? "";
      const placeholder = el.getAttribute("placeholder") ?? "";
      const labelText = getLabelTextFor(el, doc);

      const suggested = suggestTargetField({
        name,
        id,
        type,
        placeholder,
        labelText,
        tag,
      });

      const contextParts = [labelText, placeholder].filter(Boolean);
      return {
        id: `${index}:${i}`,
        originalName: name,
        tag,
        type,
        context: contextParts.join(" — "),
        suggested,
      };
    });

    return {
      index,
      inputCount: inputs.length,
      inputs,
      action: formEl.getAttribute("action"),
    };
  });

  return { forms, hasEmbedScript, parseError: null };
}

export type MappingDecision = {
  /** Which form to wire — currently always the first selected. */
  formIndex: number;
  /** inputId → target field (or "ignore"). */
  mapping: Record<string, TargetField>;
  apiKey: string;
  /** Base origin for the embed script, e.g. "https://crm.yourdomain.com". Empty = same origin. */
  scriptOrigin: string;
  /** Tag this lead source — e.g. "webinar_form". */
  source: string;
  /** Optional: hard-code loan type if no form field maps to it. */
  loanType?: string;
  /** Optional: redirect URL after success. */
  successRedirect?: string;
  /** Optional: success message shown inline. */
  successMessage?: string;
};

export type TransformResult = {
  html: string;
  /** Human-readable summary of changes, shown in the UI after apply. */
  changes: string[];
  warnings: string[];
};

export function applyIntegration(
  html: string,
  detection: DetectionResult,
  decision: MappingDecision
): TransformResult {
  const changes: string[] = [];
  const warnings: string[] = [];

  const doc = new DOMParser().parseFromString(html, "text/html");
  const formEls = Array.from(doc.querySelectorAll("form"));
  const formEl = formEls[decision.formIndex];
  if (!formEl) {
    return {
      html,
      changes: [],
      warnings: [`Form #${decision.formIndex + 1} was not found in the HTML.`],
    };
  }

  // 1. Tag the form.
  if (!formEl.hasAttribute("data-alta-form")) {
    formEl.setAttribute("data-alta-form", "");
    changes.push("Added data-alta-form to the form element.");
  }
  formEl.setAttribute("data-api-key", decision.apiKey);
  if (decision.source) formEl.setAttribute("data-source", decision.source);
  else formEl.removeAttribute("data-source");
  if (decision.loanType) formEl.setAttribute("data-loan-type", decision.loanType);
  else formEl.removeAttribute("data-loan-type");
  if (decision.successRedirect) formEl.setAttribute("data-success-redirect", decision.successRedirect);
  else formEl.removeAttribute("data-success-redirect");
  if (decision.successMessage) formEl.setAttribute("data-success-message", decision.successMessage);
  else formEl.removeAttribute("data-success-message");

  // Remove any existing action/method that would intercept the submit.
  if (formEl.hasAttribute("action")) {
    formEl.removeAttribute("action");
    changes.push("Removed stale action attribute from the form.");
  }
  if (formEl.hasAttribute("method")) {
    formEl.removeAttribute("method");
  }

  // 2. Rename input `name` attributes according to the mapping.
  const inputEls = Array.from(
    formEl.querySelectorAll("input, textarea, select")
  ).filter((el) => {
    const type = (el.getAttribute("type") || "").toLowerCase();
    return !["submit", "button", "reset", "hidden", "image"].includes(type);
  });

  const detectionForm = detection.forms[decision.formIndex];
  const mappedTargets = new Set<TargetField>();
  let renamed = 0;

  inputEls.forEach((el, i) => {
    const detected = detectionForm?.inputs[i];
    if (!detected) return;
    const target = decision.mapping[detected.id] ?? detected.suggested;
    if (target === "ignore") return;
    const currentName = el.getAttribute("name") ?? "";
    if (currentName !== target) {
      el.setAttribute("name", target);
      renamed += 1;
    }
    mappedTargets.add(target);
  });
  if (renamed > 0) changes.push(`Renamed ${renamed} input name attribute${renamed === 1 ? "" : "s"} to CRM field names.`);

  // 3. Warnings for required fields that aren't mapped.
  const required: TargetField[] = ["firstName", "lastName", "email"];
  const hasFullName = mappedTargets.has("fullName");
  for (const req of required) {
    if (mappedTargets.has(req)) continue;
    if (req !== "email" && hasFullName) continue;
    warnings.push(`No input mapped to ${TARGET_FIELD_LABELS[req]}. Submissions may be rejected.`);
  }

  // 4. Inject <script src=".../alta-form-embed.js" defer> before </body> if missing.
  const scriptSrc = decision.scriptOrigin
    ? `${decision.scriptOrigin.replace(/\/+$/, "")}/alta-form-embed.js`
    : "/alta-form-embed.js";
  const existing = doc.querySelector('script[src*="alta-form-embed.js"]');
  if (existing) {
    if (existing.getAttribute("src") !== scriptSrc) {
      existing.setAttribute("src", scriptSrc);
      changes.push("Updated embed script src.");
    }
    existing.setAttribute("defer", "");
  } else {
    const script = doc.createElement("script");
    script.setAttribute("src", scriptSrc);
    script.setAttribute("defer", "");
    (doc.body ?? doc.documentElement).appendChild(script);
    changes.push(`Inserted <script src="${scriptSrc}" defer>.`);
  }

  // Serialize back. Preserve doctype if present in original.
  const hasDoctype = /^\s*<!doctype/i.test(html);
  const serialized = doc.documentElement.outerHTML;
  const output = hasDoctype ? `<!DOCTYPE html>\n${serialized}` : serialized;

  return { html: output, changes, warnings };
}
