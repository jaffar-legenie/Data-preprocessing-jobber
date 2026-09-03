import Papa from "papaparse";
import libphonenumber from "google-libphonenumber";

const { PhoneNumberUtil, PhoneNumberFormat } = libphonenumber;

export const COL_JOBBER_ID = "J-ID";
export const COL_FIRST_NAME = "First Name";
export const COL_LAST_NAME = "Last Name";
export const COL_EMAIL = "E-mails";
export const COL_TAGS = "Tags";

export const COL_MAIN_PHONE = "Main Phone #s";
export const COL_WORK_PHONE = "Work Phone #s";
export const COL_MOBILE_PHONE = "Mobile Phone #s";
export const COL_HOME_PHONE = "Home Phone #s";
export const COL_OTHER_PHONE = "Other Phone #s";
export const COL_TEXT_PHONE = "Text Message Enabled Phone #";

export const COL_PREF_ENGLISH = "CFB[Preferred language English]";
export const COL_ONLY_ENGLISH = "CFB[Speak only English]";
export const COL_ARCHIVED = "Archived";

export const FINAL_COLUMNS = [
  "Jobber Client ID",
  "First Name",
  "Last Name",
  "Phone",
  "Email",
  "Preferred Language",
  "Speak Only English",
  "Tags",
  "Import Status",
  "Data Quality Notes",
] as const;

export type FinalColumn = typeof FINAL_COLUMNS[number];

export const REQUIRED_SOURCE_COLUMNS = [
  COL_JOBBER_ID,
  COL_FIRST_NAME,
  COL_LAST_NAME,
  COL_EMAIL,
  COL_TAGS,
  COL_MAIN_PHONE,
  COL_MOBILE_PHONE,
  COL_TEXT_PHONE,
  COL_PREF_ENGLISH,
  COL_ONLY_ENGLISH,
  COL_ARCHIVED,
];

export const PHONE_PRIORITY = [
  COL_TEXT_PHONE,
  COL_MOBILE_PHONE,
  COL_MAIN_PHONE,
  COL_HOME_PHONE,
  COL_WORK_PHONE,
  COL_OTHER_PHONE,
];

const TRUE_VALUES = new Set([
  "1", "true", "yes", "y", "oui", "o", "checked", "check",
  "x", "vrai", "on",
]);

const FALSE_VALUES = new Set([
  "0", "false", "no", "n", "non", "unchecked", "faux", "off",
]);

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const phoneUtil = PhoneNumberUtil.getInstance();

export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value).replace(/\ufeff/g, "").trim();
  return text.replace(/[ \t]+/g, " ");
}

export function normalizeJobberId(value: unknown): string {
  return cleanText(value);
}

export function normalizeBoolean(value: unknown): boolean | null {
  const text = cleanText(value).toLowerCase();
  if (text === "") return null;
  if (TRUE_VALUES.has(text)) return true;
  if (FALSE_VALUES.has(text)) return false;
  return null;
}

export function splitContactValues(value: unknown): string[] {
  const text = cleanText(value);
  if (!text) return [];
  const parts = text.split(/[\n\r;|,]+/);
  return parts.map(cleanText).filter(Boolean);
}

export function normalizeEmail(value: unknown): [string, string[]] {
  const notes: string[] = [];
  const validEmails: string[] = [];

  for (const candidate of splitContactValues(value)) {
    const email = candidate.toLowerCase().trim();
    if (EMAIL_RE.test(email)) {
      validEmails.push(email);
    }
  }

  // Deduplicate while preserving order
  const uniqueEmails = Array.from(new Set(validEmails));

  if (uniqueEmails.length > 1) {
    notes.push(`Multiple valid emails found: ${uniqueEmails.length}`);
  }

  if (uniqueEmails.length > 0) {
    return [uniqueEmails[0], notes];
  }

  if (cleanText(value)) {
    notes.push("No valid email");
  }

  return ["", notes];
}

export function fallbackNormalizeNanpPhone(raw: string): string | null {
  const text = cleanText(raw);
  if (!text) return null;
  const digits = text.replace(/\D/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return null;
}

export function normalizePhone(raw: unknown): string | null {
  const text = cleanText(raw);
  if (!text) return null;

  // Strip extensions before parsing
  const cleanPhoneCandidate = text.split(/\b(?:ext|extension|x)\b/i)[0].trim();

  try {
    const number = phoneUtil.parse(cleanPhoneCandidate, "CA");
    if (
      phoneUtil.isPossibleNumber(number) &&
      phoneUtil.isValidNumber(number) &&
      number.getCountryCode() === 1
    ) {
      return phoneUtil.format(number, PhoneNumberFormat.E164);
    }
  } catch {
    // ignore parsing errors and use fallback
  }

  return fallbackNormalizeNanpPhone(cleanPhoneCandidate);
}

export function chooseBestPhone(row: Record<string, string>): [string, string[]] {
  const notes: string[] = [];

  for (const sourceCol of PHONE_PRIORITY) {
    const rawVal = cleanText(row[sourceCol]);
    if (!rawVal) continue;

    for (const candidate of splitContactValues(rawVal)) {
      const normalized = normalizePhone(candidate);
      if (normalized) {
        if (sourceCol !== COL_TEXT_PHONE) {
          notes.push(`Phone selected from ${sourceCol}`);
        }
        return [normalized, notes];
      }
    }
  }

  notes.push("No valid SMS phone");
  return ["", notes];
}

export function detectTagDelimiter(samples: string[]): "newline" | "semicolon" | "pipe" | "single" {
  let newlineCount = 0;
  let semicolonCount = 0;
  let pipeCount = 0;

  for (const raw of samples) {
    const text = raw || "";
    if (text.includes("\n") || text.includes("\r")) newlineCount++;
    if (text.includes(";")) semicolonCount++;
    if (text.includes("|")) pipeCount++;
  }

  if (newlineCount === 0 && semicolonCount === 0 && pipeCount === 0) {
    return "single";
  }

  if (newlineCount >= semicolonCount && newlineCount >= pipeCount) {
    return "newline";
  }
  if (semicolonCount >= newlineCount && semicolonCount >= pipeCount) {
    return "semicolon";
  }
  return "pipe";
}

export function parseTags(value: unknown, delimiterMode: string): string[] {
  const text = (value !== null && value !== undefined ? String(value) : "")
    .replace(/\ufeff/g, "")
    .trim();

  if (!text) return [];

  let parts: string[];
  if (delimiterMode === "newline") {
    parts = text.split(/[\r\n]+/);
  } else if (delimiterMode === "semicolon") {
    parts = text.split(";");
  } else if (delimiterMode === "pipe") {
    parts = text.split("|");
  } else {
    parts = [text];
  }

  const result: string[] = [];
  const seen = new Set<string>();

  for (const rawTag of parts) {
    const tag = rawTag.trim();
    if (!tag) continue;
    if (!seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
    }
  }

  return result;
}

export function mergeTags(tagLists: string[][]): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const tagList of tagLists) {
    for (const tag of tagList) {
      if (!seen.has(tag)) {
        seen.add(tag);
        merged.push(tag);
      }
    }
  }

  return merged;
}

export function serializeTags(tags: string[]): string {
  return tags.join("; ");
}

export function firstNonEmpty(values: string[]): string {
  for (const val of values) {
    const cleaned = cleanText(val);
    if (cleaned) return cleaned;
  }
  return "";
}

export function hasConflictingNonEmptyValues(values: string[]): boolean {
  const unique = new Set(values.map(cleanText).filter(Boolean));
  return unique.size > 1;
}

export function buildIdentityKey(row: Record<string, string>, rowIndex: number): string {
  const jobberId = normalizeJobberId(row[COL_JOBBER_ID]);
  if (jobberId) return `jid:${jobberId}`;

  const [phone] = chooseBestPhone(row);
  if (phone) return `phone:${phone}`;

  const [email] = normalizeEmail(row[COL_EMAIL]);
  if (email) return `email:${email}`;

  return `row:${rowIndex}`;
}

export function looksLikeTestRecord(row: Record<string, string>): boolean {
  const fullName = `${cleanText(row[COL_FIRST_NAME])} ${cleanText(row[COL_LAST_NAME])}`.trim().toLowerCase();
  const obviousTestNames = new Set([
    "test",
    "testing",
    "dummy",
    "sample contact",
    "fake contact",
    "asdf",
    "do not use",
  ]);
  return obviousTestNames.has(fullName);
}

export interface ContactRecord {
  "Jobber Client ID": string;
  "First Name": string;
  "Last Name": string;
  "Phone": string;
  "Email": string;
  "Preferred Language": string;
  "Speak Only English": string;
  "Tags": string;
  "Import Status": "READY" | "REVIEW" | "REJECT";
  "Data Quality Notes": string;
}

export function mergeContactGroup(
  group: Record<string, string>[],
  tagDelimiterMode: string,
  defaultLanguage: string = "French"
): ContactRecord {
  const notes: string[] = [];

  // Jobber ID
  const jobberIds = group.map((r) => normalizeJobberId(r[COL_JOBBER_ID])).filter(Boolean);
  const uniqueJobberIds = Array.from(new Set(jobberIds));
  let identityConflict = uniqueJobberIds.length > 1;
  const jobberId = uniqueJobberIds[0] || "";

  if (identityConflict) {
    notes.push("Conflicting Jobber IDs");
  }

  // Name
  const firstValues = group.map((r) => cleanText(r[COL_FIRST_NAME]));
  const lastValues = group.map((r) => cleanText(r[COL_LAST_NAME]));
  const firstName = firstNonEmpty(firstValues);
  const lastName = firstNonEmpty(lastValues);

  if (hasConflictingNonEmptyValues(firstValues)) {
    notes.push("Conflicting first names in duplicate rows");
    identityConflict = true;
  }
  if (hasConflictingNonEmptyValues(lastValues)) {
    notes.push("Conflicting last names in duplicate rows");
    identityConflict = true;
  }

  // Phone
  let phone = "";
  for (const row of group) {
    const [candidate, phoneNotes] = chooseBestPhone(row);
    if (candidate) {
      phone = candidate;
      notes.push(...phoneNotes);
      break;
    }
  }
  if (!phone) {
    notes.push("No valid SMS phone");
  }

  // Email
  const allValidEmails: string[] = [];
  for (const row of group) {
    const [emailCandidate, emailNotes] = normalizeEmail(row[COL_EMAIL]);
    notes.push(...emailNotes);
    if (emailCandidate) allValidEmails.push(emailCandidate);
  }
  const uniqueEmails = Array.from(new Set(allValidEmails));
  const email = uniqueEmails[0] || "";

  if (uniqueEmails.length > 1) {
    notes.push(`Multiple emails across duplicate rows: ${uniqueEmails.length}`);
  }

  // Language
  const prefValues = group.map((r) => r[COL_PREF_ENGLISH]);
  const onlyValues = group.map((r) => r[COL_ONLY_ENGLISH]);

  const prefBools = prefValues.map(normalizeBoolean).filter((b): b is boolean => b !== null);
  const onlyBools = onlyValues.map(normalizeBoolean).filter((b): b is boolean => b !== null);

  const languageHasUnknown =
    prefValues.some((v) => cleanText(v) && normalizeBoolean(v) === null) ||
    onlyValues.some((v) => cleanText(v) && normalizeBoolean(v) === null);

  let preferredLanguage: string;
  let speakOnlyEnglish: string;

  if (languageHasUnknown) {
    preferredLanguage = "REVIEW";
    speakOnlyEnglish = "Review";
    notes.push("Preferred language unclear");
  } else if (onlyBools.includes(true)) {
    preferredLanguage = "English";
    speakOnlyEnglish = "Yes";
  } else if (prefBools.includes(true)) {
    preferredLanguage = "English";
    speakOnlyEnglish = "No";
  } else {
    preferredLanguage = defaultLanguage;
    speakOnlyEnglish = "No";
  }

  // Tags
  const tagLists = group.map((r) => parseTags(r[COL_TAGS], tagDelimiterMode));
  const mergedTags = mergeTags(tagLists);

  // Archived
  const archivedFlags = group.map((r) => normalizeBoolean(r[COL_ARCHIVED])).filter((b): b is boolean => b !== null);
  const archived = archivedFlags.includes(true);
  if (archived) {
    notes.push("Archived Jobber contact");
  }

  // Duplicates merged
  if (group.length > 1) {
    notes.push(`Duplicate rows merged: ${group.length}`);
  }

  // Obvious junk / test
  const isTest = group.some(looksLikeTestRecord);

  // Status
  let status: "READY" | "REVIEW" | "REJECT";
  if (isTest) {
    status = "REJECT";
    notes.push("Obvious test/junk record");
  } else if (
    !phone ||
    preferredLanguage === "REVIEW" ||
    archived ||
    identityConflict ||
    !jobberId ||
    !firstName
  ) {
    status = "REVIEW";
    if (!jobberId) notes.push("Missing Jobber ID");
    if (!firstName) notes.push("Missing first name");
  } else {
    status = "READY";
  }

  // Deduplicate notes while preserving order
  const uniqueNotes = Array.from(new Set(notes.filter(Boolean)));

  return {
    "Jobber Client ID": jobberId,
    "First Name": firstName,
    "Last Name": lastName,
    "Phone": phone,
    "Email": email,
    "Preferred Language": preferredLanguage,
    "Speak Only English": speakOnlyEnglish,
    "Tags": serializeTags(mergedTags),
    "Import Status": status,
    "Data Quality Notes": uniqueNotes.join("; "),
  };
}

export function parseCSVWithDuplicateHeaders(csvText: string): {
  rows: Record<string, string>[];
  headerMap: Record<string, string[]>;
  headers: string[];
} {
  const parsed = Papa.parse<string[]>(csvText.trim(), {
    header: false,
    skipEmptyLines: true,
  });

  if (!parsed.data || parsed.data.length === 0) {
    throw new Error("The CSV file is empty.");
  }

  const rawHeaders = parsed.data[0];
  const counts = new Map<string, number>();
  const uniqueHeaders: string[] = [];
  const headerMap: Record<string, string[]> = {};

  for (const raw of rawHeaders) {
    const original = cleanText(raw);
    const count = (counts.get(original) || 0) + 1;
    counts.set(original, count);

    const internal = count === 1 ? original : `${original}__dup${count}`;
    uniqueHeaders.push(internal);
    if (!headerMap[original]) headerMap[original] = [];
    headerMap[original].push(internal);
  }

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < parsed.data.length; i++) {
    const rowData = parsed.data[i];
    const rowObj: Record<string, string> = {};
    for (let j = 0; j < uniqueHeaders.length; j++) {
      rowObj[uniqueHeaders[j]] = rowData[j] !== undefined ? String(rowData[j]) : "";
    }
    rows.push(rowObj);
  }

  return { rows, headerMap, headers: uniqueHeaders };
}

export function buildTagInventory(records: ContactRecord[]): { Tag: string; Count: number }[] {
  const counts = new Map<string, number>();

  for (const r of records) {
    const raw = r["Tags"] || "";
    const tags = raw.split(";").map((t) => t.trim()).filter(Boolean);
    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  const items = Array.from(counts.entries()).map(([Tag, Count]) => ({ Tag, Count }));
  items.sort((a, b) => b.Count - a.Count || a.Tag.localeCompare(b.Tag));
  return items;
}

export function toCSV(records: ContactRecord[]): string {
  return Papa.unparse(records, {
    columns: [...FINAL_COLUMNS],
    quotes: true,
  });
}

export interface PreprocessOutput {
  raw_rows: number;
  total_contacts: number;
  ready_count: number;
  review_count: number;
  reject_count: number;
  tag_delimiter_mode: string;
  status_counts: Record<string, number>;
  ready_sample: ContactRecord[];
  review_sample: ContactRecord[];
  rejected_sample: ContactRecord[];
  tag_inventory: { Tag: string; Count: number }[];
  total_tags: number;
  ghl_import_ready_csv: string;
  report: string;
}

export function preprocessJobberCSV(
  csvText: string,
  defaultLanguage: string = "French"
): PreprocessOutput {
  const { rows, headerMap } = parseCSVWithDuplicateHeaders(csvText);

  // Validate required columns
  const firstRowCols = new Set(Object.keys(rows[0] || {}));
  const missing = REQUIRED_SOURCE_COLUMNS.filter((c) => !firstRowCols.has(c));
  if (missing.length > 0) {
    throw new Error(`Missing required source columns:\n- ${missing.join("\n- ")}`);
  }

  const tagDelimiterMode = detectTagDelimiter(rows.map((r) => r[COL_TAGS]));

  // Group by identity key
  const groups = new Map<string, Record<string, string>[]>();
  rows.forEach((row, idx) => {
    const key = buildIdentityKey(row, idx);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  });

  // Merge each group
  const cleanRecords: ContactRecord[] = [];
  for (const group of groups.values()) {
    cleanRecords.push(mergeContactGroup(group, tagDelimiterMode, defaultLanguage));
  }

  // Post-merge duplicate phone & email detection
  const phoneCounts = new Map<string, number>();
  const emailCounts = new Map<string, number>();

  for (const r of cleanRecords) {
    if (r["Phone"]) phoneCounts.set(r["Phone"], (phoneCounts.get(r["Phone"]) || 0) + 1);
    if (r["Email"]) emailCounts.set(r["Email"], (emailCounts.get(r["Email"]) || 0) + 1);
  }

  const duplicatePhones = new Set(
    Array.from(phoneCounts.entries()).filter(([_, count]) => count > 1).map(([phone]) => phone)
  );
  const duplicateEmails = new Set(
    Array.from(emailCounts.entries()).filter(([_, count]) => count > 1).map(([email]) => email)
  );

  for (const r of cleanRecords) {
    const notes = r["Data Quality Notes"] ? r["Data Quality Notes"].split(";").map((s) => s.trim()).filter(Boolean) : [];
    let status = r["Import Status"];

    if (r["Phone"] && duplicatePhones.has(r["Phone"])) {
      notes.push("Duplicate phone across final contacts");
      if (status === "READY") status = "REVIEW";
    }

    if (r["Email"] && duplicateEmails.has(r["Email"])) {
      notes.push("Duplicate email across final contacts");
      if (status === "READY") status = "REVIEW";
    }

    const uniqueNotes = Array.from(new Set(notes));
    r["Import Status"] = status;
    r["Data Quality Notes"] = uniqueNotes.join("; ");
  }

  // Split into Ready, Review, Reject
  const readyRecords = cleanRecords.filter((r) => r["Import Status"] === "READY");
  const reviewRecords = cleanRecords.filter((r) => r["Import Status"] === "REVIEW");
  const rejectRecords = cleanRecords.filter((r) => r["Import Status"] === "REJECT");

  const tagInventory = buildTagInventory(cleanRecords);

  const statusCounts = {
    READY: readyRecords.length,
    REVIEW: reviewRecords.length,
    REJECT: rejectRecords.length,
  };

  const report = [
    "JOBBER -> GHL PREPROCESSING REPORT",
    "=======================================================",
    `Raw rows: ${rows.length}`,
    `Final unique contacts: ${cleanRecords.length}`,
    `READY contacts: ${readyRecords.length}`,
    `REVIEW contacts: ${reviewRecords.length}`,
    `REJECT contacts: ${rejectRecords.length}`,
    `Contacts with valid phone: ${cleanRecords.filter((r) => r["Phone"]).length}`,
    `Contacts without valid phone: ${cleanRecords.filter((r) => !r["Phone"]).length}`,
    `Contacts missing Jobber ID: ${cleanRecords.filter((r) => !r["Jobber Client ID"]).length}`,
    `Unique exact tags: ${tagInventory.length}`,
    `Detected source tag delimiter mode: ${tagDelimiterMode}`,
  ].join("\n");

  const ghlImportReadyCsv = toCSV(readyRecords);

  return {
    raw_rows: rows.length,
    total_contacts: cleanRecords.length,
    ready_count: readyRecords.length,
    review_count: reviewRecords.length,
    reject_count: rejectRecords.length,
    tag_delimiter_mode: tagDelimiterMode,
    status_counts: statusCounts,
    ready_sample: readyRecords.slice(0, 100),
    review_sample: reviewRecords.slice(0, 100),
    rejected_sample: rejectRecords.slice(0, 100),
    tag_inventory: tagInventory.slice(0, 100),
    total_tags: tagInventory.length,
    ghl_import_ready_csv: ghlImportReadyCsv,
    report,
  };
}
