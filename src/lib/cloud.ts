import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export const PASSPORTS_KEY = "passport-records-v1";

/** Çelësat lokalë që ruhen në tabelën app_state. */
export const STATE_KEYS = [
  "haxhi-leaders-v1",
  "haxhi-roster-v1",
  "haxhi-flights-v1",
  "haxhi-rooms-v1",
  "haxhi-flight-assign-v1",
  "haxhi-room-assign-v1",
  "haxhi-vaccines-v1",
  "haxhi-registrations-v1",
  "haxhi-vip-v1",
] as const;

let hydrating: Promise<void> | null = null;

function localJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isEmpty(v: unknown) {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v as object).length === 0;
  return false;
}

/** Merr të dhënat nga databaza dhe i vendos lokalisht (një herë për ngarkim faqeje). */
export function hydrateCloud(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      const [stateRes, passRes] = await Promise.all([
        supabase.from("app_state").select("key,data"),
        supabase.from("passports").select("id,data"),
      ]);

      const rows = stateRes.data ?? [];
      const byKey = new Map(rows.map((r) => [r.key, r.data]));
      for (const key of STATE_KEYS) {
        const remote = byKey.get(key);
        if (remote !== undefined && !isEmpty(remote)) {
          window.localStorage.setItem(key, JSON.stringify(remote));
        } else {
          const local = localJson(key);
          if (!isEmpty(local)) pushState(key, local);
        }
      }

      const remoteRecords = (passRes.data ?? []).map((r) => r.data);
      if (remoteRecords.length > 0) {
        window.localStorage.setItem(PASSPORTS_KEY, JSON.stringify(remoteRecords));
      } else {
        const local = localJson(PASSPORTS_KEY);
        if (Array.isArray(local) && local.length > 0) pushPassports(local as { id: string }[]);
      }
    } catch {
      /* offline — vazhdo me të dhënat lokale */
    }
  })();
  return hydrating;
}

/** Ruaj një listë të thjeshtë në databazë. */
export function pushState(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  void supabase
    .from("app_state")
    .upsert({ key, data: value as Json }, { onConflict: "key" })
    .then(({ error }) => {
      if (error) console.warn("[cloud] app_state", key, error.message);
    });
}

/** Ruaj pasaportat: përditëso rreshtat dhe fshi ato që janë hequr. */
export function pushPassports(records: { id: string }[]) {
  if (typeof window === "undefined") return;
  void (async () => {
    try {
      if (records.length > 0) {
        const rows = records.map((r) => ({ id: r.id, data: r as unknown as Json }));
        for (let i = 0; i < rows.length; i += 20) {
          const { error } = await supabase.from("passports").upsert(rows.slice(i, i + 20));
          if (error) console.warn("[cloud] passports", error.message);
        }
      }
      const { data } = await supabase.from("passports").select("id");
      const keep = new Set(records.map((r) => r.id));
      const stale = (data ?? []).map((r) => r.id).filter((id) => !keep.has(id));
      if (stale.length > 0) await supabase.from("passports").delete().in("id", stale);
    } catch (e) {
      console.warn("[cloud] passports sync", e);
    }
  })();
}
