import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { PassportRecord } from "@/lib/passport-store";

export const personName = (r: PassportRecord) => r.nameSq || r.nameEn || r.nameMk || r.fileName;

/** Kërkim i shpejtë i haxhinjve dhe shtim me një klik. */
export function PersonSearch({
  records,
  exclude,
  onPick,
  placeholder = "Kërko haxhiun për ta shtuar…",
}: {
  records: PassportRecord[];
  exclude: Set<string>;
  onPick: (id: string) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return records
      .filter((r) => !exclude.has(r.id))
      .filter((r) =>
        [r.nameSq, r.nameEn, r.nameMk, r.passportNumber].join(" ").toLowerCase().includes(t),
      )
      .slice(0, 8);
  }, [q, records, exclude]);

  return (
    <div className="relative">
      <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="h-9 pl-8 text-sm"
      />
      {results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary"
              onClick={() => {
                onPick(r.id);
                setQ("");
              }}
            >
              {r.photo && <img src={r.photo} alt="" className="size-6 rounded object-cover" />}
              <span className="flex-1 truncate">{personName(r)}</span>
              <span className="text-xs text-muted-foreground">{r.passportNumber}</span>
              <Plus className="size-4 text-primary" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
