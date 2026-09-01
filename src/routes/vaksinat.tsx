import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { ArrowLeft, FileSpreadsheet, Search, Syringe, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoginGate, useAuthed } from "@/components/LoginGate";
import { loadRecords } from "@/lib/passport-store";
import { loadRoster } from "@/lib/haxhi-store";
import { loadVaccines, saveVaccines, type VaccineEntry } from "@/lib/haxhi-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vaksinat")({
  head: () => ({
    meta: [
      { title: "Vaksinat — HAXHI.app" },
      {
        name: "description",
        content:
          "Regjistroni vaksinat e haxhinjve: lloji i vaksinës, data, doza dhe statusi, me eksport në Excel.",
      },
      { property: "og:title", content: "Vaksinat — HAXHI.app" },
      {
        property: "og:description",
        content: "Ndjekja e vaksinimit për çdo haxhi, me kërkim dhe eksport Excel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VaccinesPage,
});

const VACCINE_TYPES = ["Meningokok ACWY", "Gripi sezonal", "COVID-19", "Poliomielit", "Tjetër"];

function VaccinesPage() {
  const { authed, ready, setAuthed } = useAuthed();
  return (
    <LoginGate authed={authed} ready={ready} onAuthed={setAuthed}>
      <VaccinesContent />
    </LoginGate>
  );
}

function VaccinesContent() {
  const [people, setPeople] = useState<{ id: string; name: string; passportNumber: string }[]>([]);
  const [entries, setEntries] = useState<VaccineEntry[]>([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    personId: "",
    vaccine: VACCINE_TYPES[0]!,
    date: "",
    dose: "1",
    note: "",
  });

  useEffect(() => {
    const records = loadRecords().map((r) => ({
      id: r.id,
      name: r.nameSq || r.nameEn || r.nameMk || r.fileName,
      passportNumber: r.passportNumber,
    }));
    const roster = loadRoster().map((p) => ({ id: p.id, name: p.name, passportNumber: "" }));
    const seen = new Set(records.map((r) => r.name.toLowerCase()));
    setPeople([...records, ...roster.filter((p) => !seen.has(p.name.toLowerCase()))]);
    setEntries(loadVaccines());
  }, []);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  function persist(next: VaccineEntry[]) {
    setEntries(next);
    saveVaccines(next);
  }

  function add() {
    const person = byId.get(form.personId);
    if (!person) {
      toast.error("Zgjidhni personin.");
      return;
    }
    persist([
      {
        id: crypto.randomUUID(),
        personId: person.id,
        personName: person.name,
        vaccine: form.vaccine,
        date: form.date,
        dose: form.dose,
        note: form.note,
      },
      ...entries,
    ]);
    setForm({ ...form, personId: "", date: "", note: "" });
    toast.success("Vaksina u regjistrua.");
  }

  function exportExcel() {
    if (!entries.length) {
      toast.error("Nuk ka të dhëna.");
      return;
    }
    const rows = entries.map((e, i) => ({
      "Nr.": i + 1,
      Emri: e.personName,
      Pasaporta: byId.get(e.personId)?.passportNumber ?? "",
      Vaksina: e.vaccine,
      Data: e.date,
      Doza: e.dose,
      Shënim: e.note,
    }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Vaksinat");
    XLSX.writeFile(book, "vaksinat.xlsx");
    toast.success("Excel-i u shkarkua.");
  }

  const filtered = entries.filter((e) =>
    [e.personName, e.vaccine].join(" ").toLowerCase().includes(query.trim().toLowerCase()),
  );
  const vaccinated = new Set(entries.map((e) => e.personId)).size;

  return (
    <div className="min-h-screen bg-background font-sans">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-card/80 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Kthehu">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <Syringe className="size-5 text-primary" /> Vaksinat
            </h1>
            <p className="text-xs text-muted-foreground">
              Regjistrimi i vaksinave për çdo haxhi
            </p>
          </div>
          <Button variant="outline" className="ml-auto" onClick={exportExcel}>
            <FileSpreadsheet /> Excel
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-panel)]">
          <CardHeader>
            <CardTitle className="text-base">Shto vaksinë</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label>Personi</Label>
              <Select
                value={form.personId}
                onValueChange={(v) => setForm({ ...form, personId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Zgjidh…" />
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vaksina</Label>
              <Select value={form.vaccine} onValueChange={(v) => setForm({ ...form, vaccine: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VACCINE_TYPES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Doza</Label>
              <Input
                value={form.dose}
                onChange={(e) => setForm({ ...form, dose: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={add}>
                <Syringe /> Regjistro
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-panel)]">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Regjistri i vaksinave</CardTitle>
            <div className="relative w-full max-w-xs">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Kërko emrin ose vaksinën…"
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Ende nuk ka vaksina të regjistruara.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nr.</TableHead>
                    <TableHead>Emri</TableHead>
                    <TableHead>Vaksina</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Doza</TableHead>
                    <TableHead className="text-right">Veprime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e, i) => (
                    <TableRow key={e.id}>
                      <TableCell className="tabular-nums">{i + 1}</TableCell>
                      <TableCell className="font-medium">{e.personName}</TableCell>
                      <TableCell>{e.vaccine}</TableCell>
                      <TableCell className="tabular-nums">{e.date}</TableCell>
                      <TableCell>{e.dose}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => persist(entries.filter((x) => x.id !== e.id))}
                          aria-label="Fshi"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-4 text-sm">
              <span className="font-semibold">
                Gjithsej regjistrime:{" "}
                <span className="tabular-nums text-primary">{entries.length}</span>
              </span>
              <span className={cn("text-muted-foreground")}>
                Persona të vaksinuar: <span className="tabular-nums">{vaccinated}</span> /{" "}
                {people.length}
              </span>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
