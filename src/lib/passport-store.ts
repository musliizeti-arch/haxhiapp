export type PassportRecord = {
  id: string;
  hash: string;
  fileName: string;
  thumbnail: string;
  nameEn: string;
  nameSq: string;
  nameMk: string;
  passportNumber: string;
  issueDate: string;
  expiryDate: string;
  nationality: string;
  birthDate: string;
  createdAt: string;
};

const KEY = "passport-records-v1";

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
