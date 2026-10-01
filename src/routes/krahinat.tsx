import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, MapPin } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppShell } from "@/components/AppShell";
import { LoginGate, useAuthed } from "@/components/LoginGate";
import { loadRecords, saveRecords, type PassportRecord } from "@/lib/passport-store";

export const Route = createFileRoute("/krahinat")({
  head: () => ({
    meta: [
      { title: "Rradhitja sipas krahinave — HAXHI.app" },
      { name: "description", content: "Haxhinjtë e grupuar sipas vendbanimit të lexuar nga pasaporta." },
      { property: "og:title", content: "Rradhitja sipas krahinave — HAXHI.app" },
      { property: "og:description", content: "Grupimi i haxhinjve sipas vendbanimeve." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { authed, ready, setAuthed } = useAuthed();
  return (
    <LoginGate authed={authed} ready={ready} onAuthed={setAuthed}>
      <Content />
    </LoginGate>
  );
}

const UNKNOWN = "Pa vendbanim";

function Content() {
  const [records, setRecords] = useState<PassportRecord[]>([]);
  useEffect(() => setRecords(loadRecords()), []);

  const groups = useMemo(() => {
    const map = new Map<string, PassportRecord[]>();
    for (const r of records) {
      const k = (r.residence ?? "").trim() || UNKNOWN;
      const key = k === UNKNOWN ? k : k.charAt(0).toUpperCase() + k.slice(1).toLowerCase();
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()].sort((a, b) =>
      a[0] === UNKNOWN ? 1 : b[0] === UNKNOWN ? -1 : a[0].localeCompare(b[0], "sq"),
    );
  }, [records]);

  function setResidence(id: string, residence: string) {
    const next = records.map((r) => (r.id === id ? { ...r, residence } : r));
    setRecords(next);
    saveRecords(next);
  }

  function exportExcel() {
    const rows = groups.flatMap(([place, list]) =>
      list.map((r) => ({
        Vendbanimi: place,
        Emri: r.nameSq || r.nameEn,
        "Nr. pasaportës": r.passportNumber,
        Datëlindja: r.birthDate,
      })),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Krahinat");
    XLSX.writeFile(book, "krahinat.xlsx");
  }

  return (
    <AppShell
      title="Rradhitja sipas krahinave"
      subtitle={`${groups.length} vendbanime • ${records.length} haxhinj`}
      actions={
        <Button className="rounded-full" onClick={exportExcel} disabled={!records.length}>
          <FileSpreadsheet /> Excel
        </Button>
      }
    >
      {records.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Ende nuk ka haxhinj të skanuar.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map(([place, list]) => (
            <Card key={place}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="size-4 text-primary" /> {place}
                  <span className="ml-auto text-sm tabular-nums text-primary">{list.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {list.map((r) => (
                  <div key={r.id} className="flex items-center gap-2">
                    {r.photo && <img src={r.photo} alt="" className="size-8 rounded object-cover" />}
                    <span className="min-w-0 flex-1 truncate text-sm">{r.nameSq || r.nameEn}</span>
                    <Input
                      className="h-8 w-36 text-xs"
                      placeholder="Vendbanimi"
                      defaultValue={r.residence ?? ""}
                      onBlur={(e) => e.target.value !== (r.residence ?? "") && setResidence(r.id, e.target.value)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
