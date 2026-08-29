export type FieldKey =
  | "nameEn"
  | "nameSq"
  | "nameMk"
  | "passportNumber"
  | "issueDate"
  | "expiryDate"
  | "nationality"
  | "birthDate";

export type PhotoBox = { x: number; y: number; w: number; h: number };

export type PassportRecord = {
  id: string;
  hash: string;
  fileName: string;
  thumbnail: string;
  photo?: string;
  photoBox?: PhotoBox | null;
  nameEn: string;
  nameSq: string;
  nameMk: string;
  passportNumber: string;
  issueDate: string;
  expiryDate: string;
  nationality: string;
  birthDate: string;
  createdAt: string;
  confidence?: Partial<Record<FieldKey, number>>;
  rawText?: Partial<Record<FieldKey, string>>;
  scannedBy?: string;
};

const KEY = "passport-records-v1";
const AUTH_KEY = "haxhi-auth-v1";
const SESSION_KEY = "haxhi-session-v1";

export function loadRecords(): PassportRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PassportRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveRecords(records: PassportRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(records));
}

/* ---------- Kredencialet (lokale) ---------- */

export type Credentials = { username: string; password: string };

const DEFAULT_CREDENTIALS: Credentials = { username: "admin", password: "haxhi" };

export function loadCredentials(): Credentials {
  if (typeof window === "undefined") return DEFAULT_CREDENTIALS;
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as Credentials) : DEFAULT_CREDENTIALS;
  } catch {
    return DEFAULT_CREDENTIALS;
  }
}

export function saveCredentials(creds: Credentials) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_KEY, JSON.stringify(creds));
}

export function isSignedIn(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(SESSION_KEY) === "1";
}

export function signIn(username: string, password: string): boolean {
  const creds = loadCredentials();
  if (username.trim() === creds.username && password === creds.password) {
    window.sessionStorage.setItem(SESSION_KEY, "1");
    return true;
  }
  return false;
}

export function signOut() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SESSION_KEY);
}

/* ---------- Ndihmës ---------- */

export function monthsUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44);
}

export function isExpiringSoon(record: PassportRecord): boolean {
  const m = monthsUntil(record.expiryDate);
  return m !== null && m < 3;
}

export async function hashDataUrl(dataUrl: string): Promise<string> {
  const bytes = new TextEncoder().encode(dataUrl);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Nuk u lexua fotoja"));
    reader.readAsDataURL(file);
  });
}

export async function shrinkImage(dataUrl: string, maxSize = 1600): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
  });
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}
