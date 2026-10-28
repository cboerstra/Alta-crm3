// CSV parsing and column matching for contact imports.
//
// Splitting on "\n" and "," breaks on the files people actually export: a
// brokerage named "Smith, Jones & Co." in quotes, a note with a line break,
// Excel's byte-order mark, Windows line endings. This follows RFC 4180.

/** Rows of cells. Handles quoted fields, "" escapes, CRLF/LF/CR and a BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Blank lines (a trailing newline, spacer rows) are not records.
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Header text reduced to letters and digits, so "E-mail Address" matches "emailaddress". */
export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type ContactField =
  | "firstName"
  | "lastName"
  | "fullName"
  | "email"
  | "phone"
  | "brokerage"
  | "licenseNumber"
  | "city"
  | "state";

/** Header spellings seen in MLS rosters, CRM exports and hand-made sheets. */
const ALIASES: Record<ContactField, string[]> = {
  firstName: ["firstname", "first", "fname", "givenname", "memberfirstname", "agentfirstname"],
  lastName: ["lastname", "last", "lname", "surname", "familyname", "memberlastname", "agentlastname"],
  fullName: ["name", "fullname", "agentname", "membername", "contactname", "contact", "agent", "realtor"],
  email: ["email", "emailaddress", "memberemail", "agentemail", "workemail", "primaryemail", "mail"],
  phone: [
    "phone", "phonenumber", "mobile", "mobilephone", "cell", "cellphone", "memberphone",
    "agentphone", "directphone", "officephone", "workphone", "primaryphone", "telephone",
  ],
  brokerage: ["brokerage", "company", "office", "officename", "broker", "brokeragename", "firm", "agency"],
  licenseNumber: ["license", "licensenumber", "licenseno", "licno", "memberlicense", "realestatelicense"],
  city: ["city", "membercity", "officecity", "town"],
  state: ["state", "st", "memberstate", "officestate", "province"],
};

export type ColumnMap = Partial<Record<ContactField, number>>;

/**
 * Which column holds which field. The first header matching a field wins, so
 * a sheet with both "Mobile" and "Office Phone" uses whichever comes first.
 */
export function matchColumns(headers: readonly string[]): ColumnMap {
  const map: ColumnMap = {};
  const normalized = headers.map(normalizeHeader);
  for (const field of Object.keys(ALIASES) as ContactField[]) {
    const index = normalized.findIndex((h) => ALIASES[field].includes(h));
    if (index !== -1) map[field] = index;
  }
  return map;
}

export interface ImportedContact {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  brokerage?: string;
  licenseNumber?: string;
  city?: string;
  state?: string;
}

export interface ContactImport {
  headers: string[];
  columns: ColumnMap;
  contacts: ImportedContact[];
  /** Data rows dropped for having no usable email address, by 1-based line. */
  skippedRows: number[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "Jane Q. Smith" → first "Jane", last "Q. Smith"; "Smith, Jane" → "Jane" / "Smith". */
function splitFullName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  if (trimmed.includes(",")) {
    const [last, first] = trimmed.split(",", 2).map((s) => s.trim());
    return { firstName: first || "", lastName: last || "" };
  }
  const parts = trimmed.split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

/** Parse a CSV into contacts, matching columns by their headers. */
export function readContactCsv(text: string): ContactImport {
  const [headerRow = [], ...rows] = parseCsv(text);
  const headers = headerRow.map((h) => h.trim());
  const columns = matchColumns(headers);
  const contacts: ImportedContact[] = [];
  const skippedRows: number[] = [];

  rows.forEach((cells, i) => {
    const get = (field: ContactField) => {
      const index = columns[field];
      return index === undefined ? "" : (cells[index] ?? "").trim();
    };
    const email = get("email").toLowerCase();
    if (!EMAIL.test(email)) {
      skippedRows.push(i + 2); // +1 for the header, +1 for 1-based
      return;
    }
    let firstName = get("firstName");
    let lastName = get("lastName");
    if (!firstName && !lastName && get("fullName")) ({ firstName, lastName } = splitFullName(get("fullName")));
    const state = get("state").toUpperCase();
    contacts.push({
      firstName: firstName || "Unknown",
      lastName,
      email,
      phone: get("phone") || undefined,
      brokerage: get("brokerage") || undefined,
      licenseNumber: get("licenseNumber") || undefined,
      city: get("city") || undefined,
      // The column is two letters; "Utah" or blank becomes the default.
      state: /^[A-Z]{2}$/.test(state) ? state : undefined,
    });
  });

  return { headers, columns, contacts, skippedRows };
}

/** Tag text as stored: trimmed, inner whitespace collapsed, at most 64 characters. */
export function cleanTag(tag: string): string {
  return tag.trim().replace(/\s+/g, " ").slice(0, 64);
}
