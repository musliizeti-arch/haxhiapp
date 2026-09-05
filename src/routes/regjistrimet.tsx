import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { Camera, Download, Loader2, Plus, ScanLine, Search, Trash2, Upload, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { CameraScanner } from "@/components/CameraScanner";
import { LoginGate, useAuthed } from "@/components/LoginGate";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { loadRegistrations, saveRegistrations, type Registration } from "@/lib/haxhi-store";
import { extractPassport } from "@/lib/passport.functions";
import { cropPhoto, fileToDataUrl, shrinkImage } from "@/lib/passport-store";

export const Route = createFileRoute("/regjistrimet")({
  head: () => ({
    meta: [
      { title: "Regjistrimet e reja — HAXHI.app" },
      {
        name: "description",
        content:
          "Regjistroni një nga një ose ngarkoni listën e personave që planifikojnë haxhin për vitet e ardhshme.",
      },
      { property: "og:title", content: "Regjistrimet e reja — HAXHI.app" },
      {
        property: "og:description",
        content: "Lista e para-regjistrimeve për haxhin e viteve të ardhshme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegistrationsPage,
});

function RegistrationsPage() {
  const { authed, ready, setAuthed } = useAuthed();
  return (
    <LoginGate authed={authed} ready={ready} onAuthed={setAuthed}>
      <RegistrationsContent />
    </LoginGate>
  );
}

const nextYear = String(new Date().getFullYear() + 1);
type Form = {
  name: string;
  phone: string;
  city: string;
  year: string;
  note: string;
  passportNumber: string;
  birthDate: string;
  expiryDate: string;
  photo?: string;
};
const EMPTY: Form = {
  name: "",
  phone: "",
  city: "",
  year: nextYear,
  note: "",
  passportNumber: "",
  birthDate: "",
  expiryDate: "",
};

function norm(v: string) {
  return v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
}

function RegistrationsContent() {
  const [items, setItems] = useState<Registration[]>([]);
  const [form, setForm] = useState<Form>(EMPTY);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const passportRef = useRef<HTMLInputElement>(null);
  const runExtract = useServerFn(extractPassport);

  useEffect(() => setItems(loadRegistrations()), []);

  function persist(next: Registration[]) {
    setItems(next);
    saveRegistrations(next);
  }

  /** Lexon pasaportën, pret portretin dhe mbush formularin automatikisht. */
  async function scanPassport(rawDataUrl: string) {
    setScanning(true);
    try {
      const imageDataUrl = await shrinkImage(rawDataUrl);
      const data = await runExtract({ data: { imageDataUrl } });
      const photo = await cropPhoto(imageDataUrl, data.photoBox);
      const name = data.nameSq || data.nameEn || data.nameMk;
      setForm((f) => ({
        ...f,
        name: name || f.name,
        passportNumber: data.passportNumber || f.passportNumber,
        birthDate: data.birthDate || f.birthDate,
        expiryDate: data.expiryDate || f.expiryDate,
        ...(photo ? { photo } : {}),
      }));
      toast.success(name ? `U lexua: ${name} — kontrolloni dhe shtypni "Shto".` : "Pasaporta u lexua pjesërisht.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gabim gjatë leximit të pasaportës.");
    } finally {
      setScanning(false);
      if (passportRef.current) passportRef.current.value = "";
    }
  }

  function add() {
    if (!form.name.trim()) {
      toast.warning("Shkruani emrin e personit.");
      return;
    }
    if (form.passportNumber && items.some((i) => i.passportNumber && i.passportNumber === form.passportNumber)) {
      toast.warning("Kjo pasaportë është regjistruar më parë.");
      return;
    }
    persist([{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...form }, ...items]);
    setForm({ ...EMPTY, year: form.year });
    toast.success("Personi u regjistrua.");
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      let rows: Record<string, unknown>[] = [];
      if (ext === "txt") {
        rows = (await file.text())
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => ({ Emri: l }));
      } else if (ext === "json") {
        const data = JSON.parse(await file.text());
        const list = Array.isArray(data) ? data : [];
        rows = list.map((i: unknown) => (typeof i === "string" ? { Emri: i } : (i as Record<string, unknown>)));
      } else {
        const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const sheet = book.Sheets[book.SheetNames[0]!];
        if (!sheet) throw new Error("Skedari është bosh.");
        rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      }
      const existing = new Set(items.map((i) => norm(i.name)));
      const imported: Registration[] = [];
      for (const row of rows) {
        const e = Object.entries(row).map(([k, v]) => [k, String(v ?? "").trim()] as const);
        const nameE =
          e.find(([k]) => /emri|emër|name|ime/i.test(k) && !/mbiemri/i.test(k)) ??
          e.find(([, v]) => v.length > 2);
        if (!nameE) continue;
        const surname = e.find(([k]) => /mbiemri|surname|last/i.test(k))?.[1] ?? "";
        const name = [nameE[1], surname].filter(Boolean).join(" ").trim();
        if (!name || existing.has(norm(name))) continue;
        existing.add(norm(name));
        imported.push({
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          name,
          phone: e.find(([k]) => /tel|phone|mob/i.test(k))?.[1] ?? "",
          city: e.find(([k]) => /qytet|vend|city|fshat/i.test(k))?.[1] ?? "",
          year: e.find(([k]) => /vit|year/i.test(k))?.[1] || form.year,
          note: e.find(([k]) => /shenim|shënim|note|koment/i.test(k))?.[1] ?? "",
        });
      }
      if (!imported.length) {
        toast.warning("Nuk u gjet asnjë person i ri në skedar.");
        return;
      }
      persist([...imported, ...items]);
      toast.success(`U importuan ${imported.length} persona.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Skedari nuk u lexua.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function exportExcel() {
    if (!items.length) {
      toast.warning("Nuk ka regjistrime për eksport.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(
      items.map((i, n) => ({
        "Nr.": n + 1,
        Emri: i.name,
        Telefoni: i.phone,
        Qyteti: i.city,
        Viti: i.year,
        "Nr. pasaportës": i.passportNumber ?? "",
        Datëlindja: i.birthDate ?? "",
        Skadimi: i.expiryDate ?? "",
        Shënim: i.note,
        "Regjistruar më": new Date(i.createdAt).toLocaleDateString("sq-AL"),
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Regjistrimet");
    XLSX.writeFile(wb, "regjistrimet.xlsx");
  }

  const filtered = useMemo(() => {
    const q = norm(query);
    if (!q) return items;
    return items.filter((i) => norm(`${i.name} ${i.phone} ${i.city} ${i.year}`).includes(q));
  }, [items, query]);

  const allSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));

  function toggleAll() {
    const next = new Set(selected);
    if (allSelected) filtered.forEach((i) => next.delete(i.id));
    else filtered.forEach((i) => next.add(i.id));
    setSelected(next);
  }

  function deleteSelected() {
    if (!selected.size) return;
    persist(items.filter((i) => !selected.has(i.id)));
    toast.success(`U fshinë ${selected.size} regjistrime.`);
    setSelected(new Set());
  }

  const actions = (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.ods,.csv,.tsv,.txt,.json"
        hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <Button variant="outline" onClick={() => fileRef.current?.click()}>
        <Upload /> Ngarko listë
      </Button>
      <Button variant="outline" onClick={exportExcel}>
        <Download /> Excel
      </Button>
    </>
  );

  return (
    <AppShell title="Regjistrimet e reja" subtitle="Para-regjistrime për haxhin e viteve të ardhshme" actions={actions}>
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="shadow-[var(--shadow-panel)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlus className="size-4 text-primary" /> Regjistro person
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={passportRef}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) await scanPassport(await fileToDataUrl(f));
              }}
            />
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3">
              <ScanLine className="size-8 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Skano pasaportën — plotësohet automatikisht</p>
                <p className="text-xs text-muted-foreground">Emri, nr. i pasaportës, datëlindja, skadimi dhe fotoja e personit.</p>
              </div>
              <Button type="button" size="lg" onClick={() => setCameraOpen(true)} disabled={scanning}>
                {scanning ? <Loader2 className="animate-spin" /> : <Camera />} Skano me kamerë
              </Button>
              <Button type="button" size="lg" variant="outline" onClick={() => passportRef.current?.click()} disabled={scanning}>
                <Upload /> Ngarko foto pasaporte
              </Button>
            </div>
            <form
              className="grid gap-3 md:grid-cols-6"
              onSubmit={(e) => {
                e.preventDefault();
                add();
              }}
            >
              {form.photo && (
                <div className="flex items-center gap-3 md:col-span-6">
                  <img src={form.photo} alt="Portreti" className="h-20 w-[62px] rounded-md border border-border object-cover" />
                  <Button type="button" size="sm" variant="ghost" onClick={() => setForm({ ...form, photo: undefined })}>
                    Hiq foton
                  </Button>
                </div>
              )}
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="r-name">Emri dhe mbiemri</Label>
                <Input id="r-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-phone">Telefoni</Label>
                <Input id="r-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-city">Qyteti / Fshati</Label>
                <Input id="r-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-year">Viti i haxhit</Label>
                <Input id="r-year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-note">Shënim</Label>
                <Input id="r-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="r-pass">Nr. i pasaportës</Label>
                <Input id="r-pass" value={form.passportNumber} onChange={(e) => setForm({ ...form, passportNumber: e.target.value })} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="r-birth">Datëlindja</Label>
                <Input id="r-birth" type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="r-exp">Skadimi i pasaportës</Label>
                <Input id="r-exp" type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
              </div>
              <div className="md:col-span-6">
                <Button type="submit">
                  <Plus /> Shto
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <CameraScanner open={cameraOpen} onOpenChange={setCameraOpen} onCapture={(d) => void scanPassport(d)} />

        <Card className="shadow-[var(--shadow-panel)]">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              Të regjistruar: <span className="tabular-nums text-primary">{items.length}</span>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {selected.size > 0 && (
                <Button variant="destructive" size="sm" onClick={deleteSelected}>
                  <Trash2 /> Fshi ({selected.size})
                </Button>
              )}
              <div className="relative w-full max-w-xs">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Kërko…"
                  className="pl-9"
                  aria-label="Kërko"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {items.length === 0 ? "Ende nuk ka regjistrime." : "Asnjë rezultat."}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Zgjidh të gjithë" />
                    </TableHead>
                    <TableHead>Nr.</TableHead>
                    <TableHead>Emri</TableHead>
                    <TableHead>Telefoni</TableHead>
                    <TableHead>Qyteti</TableHead>
                    <TableHead>Viti</TableHead>
                    <TableHead>Shënim</TableHead>
                    <TableHead className="text-right">Veprime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((i, n) => (
                    <TableRow key={i.id} data-state={selected.has(i.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(i.id)}
                          onCheckedChange={(c) => {
                            const next = new Set(selected);
                            c ? next.add(i.id) : next.delete(i.id);
                            setSelected(next);
                          }}
                          aria-label={`Zgjidh ${i.name}`}
                        />
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{n + 1}</TableCell>
                      <TableCell className="font-medium">{i.name}</TableCell>
                      <TableCell>{i.phone}</TableCell>
                      <TableCell>{i.city}</TableCell>
                      <TableCell className="tabular-nums">{i.year}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{i.note}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => persist(items.filter((x) => x.id !== i.id))}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
