import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, MapPin, Plus, Trash2, UserRound, X } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppShell } from "@/components/AppShell";
import { LoginGate, useAuthed } from "@/components/LoginGate";
import { PersonSearch, personName } from "@/components/PersonSearch";
import { loadRecords, type PassportRecord } from "@/lib/passport-store";
import { loadRegions, saveRegions, type Region } from "@/lib/haxhi-store";

export const Route = createFileRoute("/krahinat")({
  head: () => ({
    meta: [
      { title: "Rradhitja sipas krahinave — HAXHI.app" },
      { name: "description", content: "Krahinat me udhëheqësin dhe haxhinjtë e secilës krahinë." },
      { property: "og:title", content: "Rradhitja sipas krahinave — HAXHI.app" },
      { property: "og:description", content: "Grupimi manual i haxhinjve sipas krahinave." },
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

function Content() {
  const [records, setRecords] = useState<PassportRecord[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [newName, setNewName] = useState("");
  useEffect(() => {
    setRecords(loadRecords());
    setRegions(loadRegions());
  }, []);

  const byId = useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);
  const assigned = useMemo(() => new Set(regions.flatMap((r) => r.memberIds)), [regions]);

  function persist(next: Region[]) {
    setRegions(next);
    saveRegions(next);
  }
  const update = (id: string, patch: Partial<Region>) =>
    persist(regions.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  function addRegion() {
    const name = newName.trim();
    if (!name) return;
    if (regions.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Kjo krahinë ekziston.");
      return;
    }
    persist([...regions, { id: crypto.randomUUID(), name, leader: "", memberIds: [] }]);
    setNewName("");
  }

  function exportExcel() {
    const rows = regions.flatMap((g) =>
      g.memberIds.map((id, i) => {
        const r = byId.get(id);
        return {
          Krahina: g.name,
          Udhëheqësi: g.leader,
          "Nr.": i + 1,
          Emri: r ? personName(r) : "",
          "Nr. pasaportës": r?.passportNumber ?? "",
          Datëlindja: r?.birthDate ?? "",
        };
      }),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Krahinat");
    XLSX.writeFile(book, "krahinat.xlsx");
  }

  return (
    <AppShell
      title="Rradhitja sipas krahinave"
      subtitle={`${regions.length} krahina • ${assigned.size} nga ${records.length} haxhinj të ndarë`}
      actions={
        <Button className="rounded-full" onClick={exportExcel} disabled={!regions.length}>
          <FileSpreadsheet /> Excel
        </Button>
      }
    >
      <div className="mb-5 flex max-w-md gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addRegion()}
          placeholder="Emri i krahinës (p.sh. Gostivar)"
        />
        <Button onClick={addRegion}>
          <Plus /> Shto krahinë
        </Button>
      </div>

      {regions.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Shtoni krahinën e parë më lart.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {regions.map((g) => (
            <Card key={g.id}>
              <CardHeader className="space-y-3 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MapPin className="size-4 text-primary" /> {g.name}
                  <span className="ml-auto text-sm tabular-nums text-primary">{g.memberIds.length}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Fshi krahinën"
                    onClick={() => confirm(`Të fshihet krahina ${g.name}?`) && persist(regions.filter((r) => r.id !== g.id))}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <UserRound className="size-4 text-muted-foreground" />
                  <Input
                    className="h-9"
                    placeholder="Emri i udhëheqësit të krahinës"
                    defaultValue={g.leader}
                    onBlur={(e) => e.target.value !== g.leader && update(g.id, { leader: e.target.value })}
                  />
                </div>
                <PersonSearch
                  records={records}
                  exclude={assigned}
                  onPick={(id) => update(g.id, { memberIds: [...g.memberIds, id] })}
                />
              </CardHeader>
              <CardContent className="space-y-1.5">
                {g.memberIds.map((id, i) => {
                  const r = byId.get(id);
                  return (
                    <div key={id} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-secondary">
                      <span className="w-6 text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                      {r?.photo && <img src={r.photo} alt="" className="size-7 rounded object-cover" />}
                      <span className="min-w-0 flex-1 truncate text-sm">{r ? personName(r) : "—"}</span>
                      <span className="text-xs text-muted-foreground">{r?.passportNumber}</span>
                      <button
                        type="button"
                        aria-label="Hiq"
                        onClick={() => update(g.id, { memberIds: g.memberIds.filter((x) => x !== id) })}
                      >
                        <X className="size-4 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
