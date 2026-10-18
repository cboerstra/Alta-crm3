// ─── Wage upload files ───────────────────────────────────────────────────────
// Fixed-width, 512-character records with CR/LF line endings:
//   • SSA EFW2 (Pub 42-007) — W-2s / W-3 uploaded to Business Services Online.
//     Run the file through SSA's AccuWage Online before submitting.
//   • Utah TAP W-2 upload — EFW2 plus an RS record per W-2 (TC TI-03): state
//     code 49, withholding account (no hyphens) at 248-267. No RV record.
//   • Utah DWS quarterly wage list (MMREF RE/RS/RT): quarter at RE 222-223,
//     DWS registration number at RE 224-233, reporting period at RS 197-202,
//     wages at RS 214-224. Remaining positions follow the EFW2 RS layout.
// Built in the browser so full SSNs are never sent to or stored on the server.
// All money is integer cents.

const RECORD_LENGTH = 512;
const EOL = "\r\n";

type Field = [start: number, end: number, value: string | number, kind?: "money" | "num"];

/** Lay fields out by their 1-based inclusive positions; everything else is blank. */
function record(id: string, fields: Field[]): string {
  const buf = Array<string>(RECORD_LENGTH).fill(" ");
  const put = (start: number, end: number, text: string) => {
    const len = end - start + 1;
    if (text.length > len) throw new Error(`${id} ${start}-${end}: "${text}" is longer than ${len}`);
    for (let i = 0; i < text.length; i++) buf[start - 1 + i] = text[i];
  };
  put(1, 2, id);
  for (const [start, end, value, kind] of fields) {
    const len = end - start + 1;
    if (kind === "money" || kind === "num") {
      const n = Math.round(Number(value));
      if (n < 0) throw new Error(`${id} ${start}-${end}: negative amount`);
      put(start, end, String(n).padStart(len, "0")); // money is cents with no decimal point
    } else {
      put(start, end, String(value).slice(0, len));
    }
  }
  return buf.join("");
}

/** Names and addresses: upper case, letters/digits/space/hyphen/apostrophe only. */
const clean = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9 '\-]/g, "").replace(/\s+/g, " ").trim();
const nameOnly = (s: string | null | undefined) => clean(s).replace(/[0-9]/g, "");
const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

export interface FileCompany {
  name: string;
  ein: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  utahWithholdingAccount: string | null;
  utahUiAccount: string | null;
}

export interface FileEmployee {
  firstName: string;
  lastName: string;
  ssn: string; // full 9 digits, typed in at download time
}

export interface W2Amounts {
  box1: number; box2: number; box3: number; box4: number; box5: number; box6: number;
  box12D: number; box13Retirement: boolean; box16: number; box17: number;
}

export interface SubmitterInfo {
  bsoUserId: string;  // SSA Business Services Online user ID, 8 characters
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

/** Problems that would make the agency reject the file — shown before download. */
export function validateInputs(company: FileCompany, employees: FileEmployee[], submitter?: SubmitterInfo): string[] {
  const errors: string[] = [];
  if (digits(company.ein).length !== 9) errors.push("Company EIN must be 9 digits.");
  if (!clean(company.address) || !clean(company.city) || !/^[A-Z]{2}$/.test(clean(company.state)) || digits(company.zip).length < 5) {
    errors.push("Company street address, city, state and ZIP are required (Companies tab → Edit).");
  }
  for (const e of employees) {
    const ssn = digits(e.ssn);
    if (ssn.length !== 9 || /^(000|666|9)/.test(ssn) || ssn.slice(3, 5) === "00" || ssn.slice(5) === "0000") {
      errors.push(`${e.firstName} ${e.lastName}: enter a valid 9-digit SSN.`);
    }
    if (!nameOnly(e.firstName) || !nameOnly(e.lastName)) errors.push(`${e.firstName} ${e.lastName}: first and last name are required.`);
  }
  if (submitter) {
    if (!/^[A-Z0-9]{8}$/i.test(submitter.bsoUserId.trim())) errors.push("SSA BSO User ID is 8 letters/numbers.");
    if (!clean(submitter.contactName)) errors.push("Contact name is required.");
    if (digits(submitter.contactPhone).length < 10) errors.push("Contact phone needs 10 digits.");
    if (!/^\S+@\S+\.\S+$/.test(submitter.contactEmail.trim())) errors.push("Contact email is required.");
  }
  return errors;
}

function addressFields(c: FileCompany, nameStart: number) {
  // Name (57), location address (22), delivery address (22), city (22), state (2), ZIP (5), ZIP+4 (4)
  const zip = digits(c.zip);
  const at = nameStart;
  return [
    [at, at + 56, clean(c.name)],
    [at + 57, at + 78, ""],
    [at + 79, at + 100, clean(c.address)],
    [at + 101, at + 122, clean(c.city)],
    [at + 123, at + 124, clean(c.state)],
    [at + 125, at + 129, zip.slice(0, 5)],
    [at + 130, at + 133, zip.slice(5, 9)],
  ] as Field[];
}

// ─── EFW2 records ────────────────────────────────────────────────────────────
function raRecord(c: FileCompany, s: SubmitterInfo): string {
  return record("RA", [
    [3, 11, digits(c.ein)],
    [12, 19, s.bsoUserId.trim().toUpperCase()],
    [29, 29, "0"],   // not a resubmission
    [36, 37, "98"],  // software code: in-house program
    ...addressFields(c, 38),  // company: 38-171
    ...addressFields(c, 217), // submitter (same company): 217-350
    [396, 422, clean(s.contactName)],
    [423, 437, digits(s.contactPhone)],
    [446, 485, s.contactEmail.trim()],
    [500, 500, "L"], // preparer code: self-prepared
  ]);
}

function reRecord(c: FileCompany, year: number, s: SubmitterInfo): string {
  return record("RE", [
    [3, 6, year],
    [8, 16, digits(c.ein)],
    [26, 26, "0"], // not a terminating business
    ...addressFields(c, 40), // 40-173
    [174, 174, "N"], // kind of employer: none of the special kinds apply
    [219, 219, "R"], // employment code: regular (Form 941)
    [221, 221, "0"], // no third-party sick pay
    [222, 248, clean(s.contactName)],
    [249, 263, digits(s.contactPhone)],
    [279, 318, s.contactEmail.trim()],
  ]);
}

function nameFields(e: FileEmployee, ssnStart: number): Field[] {
  // SSN (9), first (15), middle (15), last (20), suffix (4)
  const a = ssnStart;
  return [
    [a, a + 8, digits(e.ssn)],
    [a + 9, a + 23, nameOnly(e.firstName)],
    [a + 24, a + 38, ""],
    [a + 39, a + 58, nameOnly(e.lastName)],
  ];
}

function rwRecord(e: FileEmployee, w: W2Amounts): string {
  const zero = (start: number) => [start, start + 10, 0, "money"] as Field;
  return record("RW", [
    ...nameFields(e, 3),
    [188, 198, w.box1, "money"],
    [199, 209, w.box2, "money"],
    [210, 220, w.box3, "money"],
    [221, 231, w.box4, "money"],
    [232, 242, w.box5, "money"],
    [243, 253, w.box6, "money"],
    zero(254),                    // social security tips
    zero(276),                    // dependent care benefits
    [287, 297, w.box12D, "money"], // code D: 401(k) elective deferrals
    zero(298), zero(309), zero(320), zero(331),
    zero(353), zero(364), zero(375), zero(386),
    zero(408), zero(419), zero(430), zero(441), zero(452), zero(463), zero(474),
    [486, 486, "0"], // statutory employee
    [488, 488, w.box13Retirement ? "1" : "0"],
    [489, 489, "0"], // third-party sick pay
  ]);
}

function rtRecord(ws: W2Amounts[]): string {
  const total = (k: keyof W2Amounts) => ws.reduce((a, w) => a + Number(w[k]), 0);
  const zero = (start: number) => [start, start + 14, 0, "money"] as Field;
  return record("RT", [
    [3, 9, ws.length, "num"],
    [10, 24, total("box1"), "money"],
    [25, 39, total("box2"), "money"],
    [40, 54, total("box3"), "money"],
    [55, 69, total("box4"), "money"],
    [70, 84, total("box5"), "money"],
    [85, 99, total("box6"), "money"],
    zero(100), zero(130),
    [145, 159, total("box12D"), "money"],
    zero(160), zero(175), zero(190), zero(205),
    zero(235), zero(250), zero(265), zero(280), zero(295), zero(310), zero(325), zero(340), zero(355), zero(370), zero(385), zero(400),
  ]);
}

const rfRecord = (count: number) => record("RF", [[8, 16, count, "num"]]);

/** Utah RS record for one W-2 (TI-03). Unemployment fields are left blank. */
function utahW2RsRecord(c: FileCompany, e: FileEmployee, w: W2Amounts): string {
  return record("RS", [
    [3, 4, "49"],
    ...nameFields(e, 10),
    [248, 267, clean(c.utahWithholdingAccount).replace(/[^A-Z0-9]/g, "")],
    [274, 275, "49"],
    [276, 286, w.box16, "money"],
    [287, 297, w.box17, "money"],
  ]);
}

export interface W2FileInput {
  company: FileCompany;
  year: number;
  submitter: SubmitterInfo;
  w2s: { employee: FileEmployee; amounts: W2Amounts }[];
}

/** SSA file: RA, RE, RW per employee, RT, RF. */
export function buildSsaW2File(input: W2FileInput): string {
  const { company, year, submitter, w2s } = input;
  const lines = [
    raRecord(company, submitter),
    reRecord(company, year, submitter),
    ...w2s.map((w) => rwRecord(w.employee, w.amounts)),
    rtRecord(w2s.map((w) => w.amounts)),
    rfRecord(w2s.length),
  ];
  return lines.join(EOL) + EOL;
}

/** Utah TAP file: same as SSA with an RS record after each RW. */
export function buildUtahW2File(input: W2FileInput): string {
  const { company, year, submitter, w2s } = input;
  const lines = [
    raRecord(company, submitter),
    reRecord(company, year, submitter),
    ...w2s.flatMap((w) => [rwRecord(w.employee, w.amounts), utahW2RsRecord(company, w.employee, w.amounts)]),
    rtRecord(w2s.map((w) => w.amounts)),
    rfRecord(w2s.length),
  ];
  return lines.join(EOL) + EOL;
}

// ─── Utah DWS quarterly wage list (MMREF RE/RS/RT) ───────────────────────────
export interface DwsFileInput {
  company: FileCompany;
  year: number;
  quarter: number;
  wages: { employee: FileEmployee; wagesCents: number }[];
}

export function buildDwsWageFile(input: DwsFileInput): string {
  const { company, year, quarter, wages } = input;
  const lastMonth = String(quarter * 3).padStart(2, "0");
  const re = record("RE", [
    [3, 6, year],
    [8, 16, digits(company.ein)],
    [26, 26, "0"],
    ...addressFields(company, 40),
    [219, 219, "R"],
    [221, 221, "0"],
    [222, 223, lastMonth],
    [224, 233, digits(company.utahUiAccount).padStart(10, "0")],
  ]);
  const rs = wages.map((w) => record("RS", [
    [3, 4, "49"],
    ...nameFields(w.employee, 10),
    [197, 202, `${lastMonth}${year}`],
    [203, 213, w.wagesCents, "money"],
    [214, 224, w.wagesCents, "money"],
    [274, 275, "49"],
  ]));
  const rt = record("RT", [
    [3, 9, wages.length, "num"],
    [10, 24, wages.reduce((a, w) => a + w.wagesCents, 0), "money"],
  ]);
  return [re, ...rs, rt].join(EOL) + EOL;
}
