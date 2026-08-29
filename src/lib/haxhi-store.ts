export type Leader = {
  id: string;
  name: string;
  role: string;
  phone: string;
  passportNumber: string;
  note: string;
  createdAt: string;
};

export type RosterPerson = {
  id: string;
  name: string;
  extra: Record<string, string>;
};

const LEADERS_KEY = "haxhi-leaders-v1";
const ROSTER_KEY = "haxhi-roster-v1";

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export const loadLeaders = () => read<Leader>(LEADERS_KEY);
export const saveLeaders = (v: Leader[]) => write(LEADERS_KEY, v);

export const loadRoster = () => read<RosterPerson>(ROSTER_KEY);
export const saveRoster = (v: RosterPerson[]) => write(ROSTER_KEY, v);
