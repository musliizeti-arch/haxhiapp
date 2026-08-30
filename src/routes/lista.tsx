import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { ArrowLeft, CheckCircle2, ListChecks, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoginGate, useAuthed } from "@/components/LoginGate";
import { loadRoster, saveRoster, type RosterPerson } from "@/lib/haxhi-store";
import { loadRecords, type PassportRecord } from "@/lib/passport-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/lista")({
  head: () => ({
    meta: [
      { title: "Lista e emrave — HAXHI.app" },
      {
        name: "description",
        content:
          "Ngarkoni listën Excel me emrat e haxhinjve dhe krahasojeni automatikisht me pasaportat e skanuara.",
      },
      { property: "og:title", content: "Lista e emrave — HAXHI.app" },
      {
        property: "og:description",
        content: "Import i listës Excel me emra dhe përputhje me pasaportat e regjistruara.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RosterPage,
});

function RosterPage() {
  const { authed, ready, setAuthed } = useAuthed();
  return (
    <LoginGate authed={authed} ready={ready} onAuthed={setAuthed}>
      <RosterContent />
    </LoginGate>
  );
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

function RosterContent() {
  const [people, setPeople] = useState<RosterPerson[]>([]);
  const [records, setRecords] = useState<PassportRecord[]>([]);
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPeople(loadRoster());
    setRecords(loadRecords());
  }, []);

  function persist(next: RosterPerson[]) {
    setPeople(next);
    saveRoster(next);
  }

  const scannedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const r of records) {
      for (const n of [r.nameEn, r.nameSq, r.nameMk]) {
        if (n) set.add(normalize(n));
      }
    }
    return set;
  }, [records]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const book = XLSX.read(buffer, { type: "array" });
      const sheetName = book.SheetNames[0];
      if (!sheetName) throw new Error("Skedari është bosh.");
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[sheetName]!, {
        defval: "",
      });
      const imported: RosterPerson[] = [];
      const existing = new Set(people.map((p) => normalize(p.name)));
      for (const row of rows) {
        const entries = Object.entries(row).map(([k, v]) => [k, String(v ?? "").trim()] as const);
        const nameEntry =
          entries.find(([k]) => /emri|emër|name|ime/i.test(k) && !/mbiemri/i.test(k)) ??
          entries.find(([, v]) => v.length > 2);
        if (!nameEntry) continue;
        const surname = entries.find(([k]) => /mbiemri|surname|last/i.test(k));
        const name = [nameEntry[1], surname?.[1]].filter(Boolean).join(" ").trim();
        if (!name) continue;
        const key = normalize(name);
        if (existing.has(key)) continue;
        existing.add(key);
        const extra: Record<string, string> = {};
        for (const [k, v] of entries) {
          if (k === nameEntry[0] || k === surname?.[0] || !v) continue;
          extra[k] = v;
        }
        imported.push({ id: crypto.randomUUID(), name, extra });
      }
      if (!imported.length) {
        toast.warning("Nuk u gjet asnjë emër i ri në skedar.");
        return;
      }
      persist([...people, ...imported]);
      toast.success(`U importuan ${imported.length} emra.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Skedari nuk u lexua.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.name.toLowerCase().includes(q));
  }, [people, query]);

  const matched = people.filter((p) => scannedKeys.has(normalize(p.name))).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/60 to-background font-sans">
      <header className="border-b border-border bg-card/85 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Kthehu">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <ListChecks className="size-5 text-primary" /> Lista e emrave
            </h1>
            <p className="text-xs text-muted-foreground">
              Importoni listën Excel dhe shihni kush e ka pasaportën të skanuar
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <Card className="shadow-[var(--shadow-panel)]">
          <CardHeader>
            <CardTitle className="text-base">Ngarko listën Excel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Skedar .xlsx ose .csv me një kolonë “Emri” (dhe opsionalisht “Mbiemri”). Emrat e
              përsëritur anashkalohen.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              hidden
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <Button onClick={() => fileRef.current?.click()}>
              <Upload /> Ngarko Excel
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-panel)]">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              Emra në listë: <span className="tabular-nums text-primary">{people.length}</span> •
              me pasaportë: <span className="tabular-nums text-primary">{matched}</span>
            </CardTitle>
            <div className="relative w-full max-w-xs">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Kërko emrin…"
                className="pl-9"
                aria-label="Kërko emrin"
              />
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {people.length === 0 ? "Ende nuk ka listë të ngarkuar." : "Asnjë rezultat."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nr.</TableHead>
                    <TableHead>Emri</TableHead>
                    <TableHead>Pasaporta</TableHead>
                    <TableHead>Të dhëna shtesë</TableHead>
                    <TableHead className="text-right">Veprime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p, i) => {
                    const ok = scannedKeys.has(normalize(p.name));
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 text-xs",
                              ok ? "text-primary" : "text-muted-foreground",
                            )}
                          >
                            {ok && <CheckCircle2 className="size-4" />}
                            {ok ? "E skanuar" : "Pa pasaportë"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {Object.entries(p.extra)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" • ")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => persist(people.filter((x) => x.id !== p.id))}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
