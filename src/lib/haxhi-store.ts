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

/* ---------- Grupe / Fluturime & Dhoma ---------- */

export type Flight = {
  id: string;
  code: string;
  date: string;
  seatBlock: string;
  note: string;
};

export type Room = {
  id: string;
  hotel: string;
  number: string;
  capacity: 2 | 3 | 4;
};

/** personId -> flightId | roomId */
export type Assignments = Record<string, string>;

const FLIGHTS_KEY = "haxhi-flights-v1";
const ROOMS_KEY = "haxhi-rooms-v1";
const FLIGHT_ASSIGN_KEY = "haxhi-flight-assign-v1";
const ROOM_ASSIGN_KEY = "haxhi-room-assign-v1";

function readMap(key: string): Assignments {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Assignments) : {};
  } catch {
    return {};
  }
}

function writeMap(key: string, value: Assignments) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export const loadFlights = () => read<Flight>(FLIGHTS_KEY);
export const saveFlights = (v: Flight[]) => write(FLIGHTS_KEY, v);
export const loadRooms = () => read<Room>(ROOMS_KEY);
export const saveRooms = (v: Room[]) => write(ROOMS_KEY, v);

export const loadFlightAssignments = () => readMap(FLIGHT_ASSIGN_KEY);
export const saveFlightAssignments = (v: Assignments) => writeMap(FLIGHT_ASSIGN_KEY, v);
export const loadRoomAssignments = () => readMap(ROOM_ASSIGN_KEY);
export const saveRoomAssignments = (v: Assignments) => writeMap(ROOM_ASSIGN_KEY, v);

/* ---------- Vaksinat ---------- */

export type VaccineEntry = {
  id: string;
  personId: string;
  personName: string;
  vaccine: string;
  date: string;
  dose: string;
  note: string;
};

const VACCINES_KEY = "haxhi-vaccines-v1";

export const loadVaccines = () => read<VaccineEntry>(VACCINES_KEY);
export const saveVaccines = (v: VaccineEntry[]) => write(VACCINES_KEY, v);

/* ---------- Regjistrimet e reja (vitet e ardhshme) ---------- */

export type Registration = {
  id: string;
  name: string;
  phone: string;
  city: string;
  year: string;
  note: string;
  createdAt: string;
  /* Nga skanimi i pasaportës (opsionale) */
  passportNumber?: string;
  birthDate?: string;
  expiryDate?: string;
  photo?: string;
};

const REGISTRATIONS_KEY = "haxhi-registrations-v1";

export const loadRegistrations = () => read<Registration>(REGISTRATIONS_KEY);
export const saveRegistrations = (v: Registration[]) => write(REGISTRATIONS_KEY, v);

