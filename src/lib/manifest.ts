import type { PassportRecord } from "@/lib/passport-store";

export type Lang = "sq" | "en" | "mk";

export type ManifestCol =
  | "no"
  | "given"
  | "family"
  | "nationality"
  | "sex"
  | "birthDate"
  | "docType"
  | "docNo"
  | "from"
  | "to"
  | "expiryDate";

export const MANIFEST_COLS: ManifestCol[] = [
  "no",
  "given",
  "family",
  "nationality",
  "sex",
  "birthDate",
  "docType",
  "docNo",
  "from",
  "to",
  "expiryDate",
];

export const HEADERS: Record<Lang, Record<ManifestCol, string>> = {
  en: {
    no: "No.",
    given: "Given Name (s)",
    family: "Family Name(s)",
    nationality: "Nationality",
    sex: "Sex",
    birthDate: "Date of Birth",
    docType: "Document Type",
    docNo: "Document No",
    from: "Departure Port",
    to: "Arrival Port",
    expiryDate: "Date Of Passport Validity",
  },
  mk: {
    no: "Бр.",
    given: "Име",
    family: "Презиме",
    nationality: "Државјанство",
    sex: "Пол",
    birthDate: "Датум на раѓање",
    docType: "Вид на документ",
    docNo: "Број на документ",
    from: "Заминува од",
    to: "Пристигнува во",
    expiryDate: "Датум на валидност на ПИ",
  },
  sq: {
    no: "Nr.",
    given: "Emri",
    family: "Mbiemri",
    nationality: "Shtetësia",
    sex: "Gjinia",
    birthDate: "Data e lindjes",
    docType: "Lloji i dokumentit",
    docNo: "Numri i dokumentit",
    from: "Niset nga",
    to: "Arrin në",
    expiryDate: "Data e skadimit të DU",
  },
};

export const LANG_LABEL: Record<Lang, string> = {
  sq: "Shqip",
  en: "English",
  mk: "Македонски",
};

/* ---------- Cilësimet e manifestit (porte parazgjedhur) ---------- */

export type ManifestDefaults = {
  departurePort: string;
  arrivalPort: string;
  docType: string;
  nationality: string;
};

const DEFAULTS_KEY = "haxhi-manifest-defaults-v1";

export const FALLBACK_DEFAULTS: ManifestDefaults = {
  departurePort: "SKP",
  arrivalPort: "JED",
  docType: "Passport",
  nationality: "MKD",
};

export function loadManifestDefaults(): ManifestDefaults {
  if (typeof window === "undefined") return FALLBACK_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(DEFAULTS_KEY);
    return raw
      ? { ...FALLBACK_DEFAULTS, ...(JSON.parse(raw) as Partial<ManifestDefaults>) }
      : FALLBACK_DEFAULTS;
  } catch {
    return FALLBACK_DEFAULTS;
  }
}

export function saveManifestDefaults(v: ManifestDefaults) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEFAULTS_KEY, JSON.stringify(v));
}

/* ---------- Ndihmës ---------- */

export function splitName(full: string): { given: string; family: string } {
  const parts = (full || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { given: "", family: "" };
  if (parts.length === 1) return { given: parts[0]!, family: "" };
  return { given: parts.slice(0, -1).join(" "), family: parts.at(-1)! };
}

export function formatDate(value: string): string {
  if (!value) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  return value;
}

export function nameForLang(record: PassportRecord, lang: Lang): string {
  if (lang === "en") return record.nameEn || record.nameSq || record.nameMk;
  if (lang === "mk") return record.nameMk || record.nameEn || record.nameSq;
  return record.nameSq || record.nameEn || record.nameMk;
}

export function manifestValue(
  record: PassportRecord,
  lang: Lang,
  col: ManifestCol,
  defaults: ManifestDefaults,
): string {
  const override = record.manifest?.[lang];
  const auto = splitName(nameForLang(record, lang));
  switch (col) {
    case "given":
      return override?.given ?? auto.given;
    case "family":
      return override?.family ?? auto.family;
    case "nationality":
      return record.nationality || defaults.nationality;
    case "sex":
      return record.sex ?? "";
    case "birthDate":
      return formatDate(record.birthDate);
    case "docType":
      return record.docType ?? defaults.docType;
    case "docNo":
      return record.passportNumber;
    case "from":
      return record.departurePort ?? defaults.departurePort;
    case "to":
      return record.arrivalPort ?? defaults.arrivalPort;
    case "expiryDate":
      return formatDate(record.expiryDate);
    default:
      return "";
  }
}

export function setManifestValue(
  record: PassportRecord,
  lang: Lang,
  col: ManifestCol,
  value: string,
): PassportRecord {
  switch (col) {
    case "given":
    case "family":
      return {
        ...record,
        manifest: {
          ...record.manifest,
          [lang]: { ...record.manifest?.[lang], [col]: value },
        },
      };
    case "nationality":
      return { ...record, nationality: value };
    case "sex":
      return { ...record, sex: value };
    case "docType":
      return { ...record, docType: value };
    case "docNo":
      return { ...record, passportNumber: value };
    case "from":
      return { ...record, departurePort: value };
    case "to":
      return { ...record, arrivalPort: value };
    case "birthDate":
      return { ...record, birthDate: value };
    case "expiryDate":
      return { ...record, expiryDate: value };
    default:
      return record;
  }
}
