import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import {
  Camera,
  FileSpreadsheet,
  Images,
  ListChecks,
  Loader2,
  Pencil,
  Plane,
  Plus,
  Search,
  Settings,
  Syringe,
  Trash2,
  TriangleAlert,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CameraScanner } from "@/components/CameraScanner";
import { RecordEditor } from "@/components/RecordEditor";
import { SplashScreen } from "@/components/SplashScreen";
import { LoginGate, useAuthed } from "@/components/LoginGate";
import { extractPassport } from "@/lib/passport.functions";
import { openPhotoSheet } from "@/lib/photo-sheet";
import { cn } from "@/lib/utils";
import {
  HEADERS,
  LANG_LABEL,
  MANIFEST_COLS,
  formatDate,
  loadManifestDefaults,
  manifestValue,
  saveManifestDefaults,
  setManifestValue,
  type Lang,
  type ManifestCol,
  type ManifestDefaults,
} from "@/lib/manifest";
import {
  cropPhoto,
  fileToDataUrl,
  hashDataUrl,
  isExpiringSoon,
  loadRecords,
  monthsUntil,
  saveRecords,
  shrinkImage,
  type PassportRecord,
} from "@/lib/passport-store";
import logo from "@/assets/haxhi-logo.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HAXHI.app — Manifesti i pasaportave dhe eksport në Excel" },
      {
        name: "description",
        content:
          "HAXHI.app skanon pasaporta me kamerë ose foto dhe i shfaq si manifest fluturimi në shqip, anglisht e maqedonisht, me eksport në Excel.",
      },
      { property: "og:title", content: "HAXHI.app — Manifesti i pasaportave" },
      {
        property: "og:description",
        content:
          "Manifest fluturimi me tre gjuhë, redaktim manual i rubrikave, alarm skadimi dhe eksport në Excel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexPage,
});

type ExportLang = Lang | "all";

const COL_WIDTH: Partial<Record<ManifestCol, string>> = {
  no: "w-14",
  sex: "w-16",
  from: "w-24",
  to: "w-24",
};

function IndexPage() {
  const { authed, ready, setAuthed } = useAuthed();
  return (
    <>
      <SplashScreen />
      <LoginGate authed={authed} ready={ready} onAuthed={setAuthed}>
        <Index />
      </LoginGate>
    </>
  );
}

function Index() {
  const [records, setRecords] = useState<PassportRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState<Lang>("sq");
  const [defaults, setDefaults] = useState<ManifestDefaults>(() => ({
    departurePort: "SKP",
    arrivalPort: "JED",
    docType: "Passport",
    nationality: "MKD",
  }));
  const [cameraOpen, setCameraOpen] = useState(false);
  const [editing, setEditing] = useState<PassportRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const runExtract = useServerFn(extractPassport);

  useEffect(() => {
    setRecords(loadRecords());
    setDefaults(loadManifestDefaults());
  }, []);

  function persist(next: PassportRecord[]) {
    setRecords(next);
    saveRecords(next);
  }

  function updateDefaults(patch: Partial<ManifestDefaults>) {
    const next = { ...defaults, ...patch };
    setDefaults(next);
    saveManifestDefaults(next);
  }

  /** Lexon një foto dhe e kthen si regjistrim; hedh gabim nëse dështon. */
  async function buildRecord(rawDataUrl: string, fileName: string, seen: Set<string>) {
    const imageDataUrl = await shrinkImage(rawDataUrl);
    const hash = await hashDataUrl(imageDataUrl);
    if (seen.has(hash)) return null;
    const data = await runExtract({ data: { imageDataUrl } });
    const photo = await cropPhoto(imageDataUrl, data.photoBox);
    seen.add(hash);
    const record: PassportRecord = {
      id: crypto.randomUUID(),
      hash,
      fileName,
      thumbnail: await shrinkImage(imageDataUrl, 220),
      createdAt: new Date().toISOString(),
      ...data,
      ...(photo ? { photo } : {}),
    };
    return record;
  }

  async function process(rawDataUrl: string, fileName: string) {
    setBusy(true);
    try {
      const existing = loadRecords();
      const seen = new Set(existing.map((r) => r.hash));
      const record = await buildRecord(rawDataUrl, fileName, seen);
      if (!record) {
        toast.warning("Kjo foto është skanuar më parë — u anashkalua.");
        return;
      }
      persist([record, ...existing]);
      toast.success(`U lexua: ${record.nameEn || "pasaportë e re"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gabim gjatë leximit");
    } finally {
      setBusy(false);
    }
  }

  /** Ngarkim masiv — pa limit fotosh, me deduplikim sipas së njëjtës foto. */
  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files);
    setBusy(true);
    setProgress({ done: 0, total: list.length });
    const existing = loadRecords();
    const seen = new Set(existing.map((r) => r.hash));
    const added: PassportRecord[] = [];
    let duplicates = 0;
    let failed = 0;

    const CONCURRENCY = 3;
    let cursor = 0;
    async function worker() {
      while (cursor < list.length) {
        const index = cursor++;
        const file = list[index]!;
        try {
          const dataUrl = await fileToDataUrl(file);
          const record = await buildRecord(dataUrl, file.name, seen);
          if (record) added.push(record);
          else duplicates++;
        } catch {
          failed++;
        }
        setProgress({ done: index + 1, total: list.length });
        const snapshot = [...added].reverse();
        setRecords([...snapshot, ...existing]);
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker));

    persist([...[...added].reverse(), ...existing]);
    setProgress(null);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    toast.success(
      `U shtuan ${added.length} pasaporta` +
        (duplicates ? ` • ${duplicates} të dyfishta u anashkaluan` : "") +
        (failed ? ` • ${failed} dështuan` : ""),
    );
  }

  function exportPhotos() {
    const items = records
      .map((r) => ({
        src: r.photo || r.thumbnail,
        name: r.nameSq || r.nameEn || r.nameMk || "—",
        subtitle: r.passportNumber,
      }))
      .filter((i) => !!i.src);
    if (!items.length) {
      toast.warning("Nuk ka fotografi për eksport.");
      return;
    }
    const ok = openPhotoSheet(items);
    if (!ok) toast.error("Shfletuesi bllokoi skedën e re. Lejoni dritaret pop-up.");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      [r.nameEn, r.nameSq, r.nameMk, r.passportNumber]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q)),
    );
  }, [records, query]);

  const expiringCount = records.filter(isExpiringSoon).length;

  function updateCell(record: PassportRecord, col: ManifestCol, value: string) {
    const updated = setManifestValue(record, lang, col, value);
    persist(records.map((r) => (r.id === record.id ? updated : r)));
  }

  function addEmptyRow() {
    const blank: PassportRecord = {
      id: crypto.randomUUID(),
      hash: `manual-${crypto.randomUUID()}`,
      fileName: "manual",
      thumbnail: "",
      nameEn: "",
      nameSq: "",
      nameMk: "",
      passportNumber: "",
      issueDate: "",
      expiryDate: "",
      nationality: defaults.nationality,
      birthDate: "",
      createdAt: new Date().toISOString(),
    };
    persist([...records, blank]);
    toast.success("U shtua një rresht bosh — plotësojeni manualisht.");
  }

  function exportExcel(target: ExportLang) {
    if (!records.length) return;
    const langs: Lang[] = target === "all" ? ["en", "mk", "sq"] : [target];
    const header = MANIFEST_COLS.map((c) => langs.map((l) => HEADERS[l][c]).join("\n"));
    const body = records.map((r, i) =>
      MANIFEST_COLS.map((c) =>
        c === "no"
          ? i + 1
          : c === "given" || c === "family"
            ? langs.map((l) => manifestValue(r, l, c, defaults)).filter(Boolean).join(" / ")
            : manifestValue(r, langs[0]!, c, defaults),
      ),
    );
    const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
    sheet["!cols"] = MANIFEST_COLS.map((c) => ({ wch: c === "no" ? 6 : 20 }));
    const book = XLSX.utils.book_new();
    const label = target === "all" ? "3-gjuhe" : LANG_LABEL[target];
    XLSX.utils.book_append_sheet(book, sheet, label.slice(0, 30));
    XLSX.writeFile(book, `manifesti-${label}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Skedari Excel u shkarkua.");
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-primary/10 to-transparent" />

      <header className="sticky top-0 z-30 border-b border-border/70 bg-card/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <img src={logo.url} alt="Logo HAXHI.app" className="size-10 object-contain" />
            <div>
              <h1 className="text-lg font-bold tracking-tight">HAXHI.app</h1>
              <p className="text-xs text-muted-foreground">
                Muftinia e BFI Gostivar • Manifest fluturimi
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <nav className="mr-1 flex flex-wrap items-center gap-1 rounded-full bg-secondary/70 p-1">
              <NavLink to="/lista" icon={<ListChecks className="size-4" />} label="Lista" />
              <NavLink to="/grupet" icon={<Plane className="size-4" />} label="Grupe" />
              <NavLink to="/vaksinat" icon={<Syringe className="size-4" />} label="Vaksinat" />
              <NavLink to="/udheheqesit" icon={<Users className="size-4" />} label="Udhëheqësit" />
            </nav>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={exportPhotos}
              disabled={!records.length}
            >
              <Images /> Fotot
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="rounded-full" disabled={!records.length}>
                  <FileSpreadsheet /> Excel
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Zgjidh gjuhën</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportExcel("sq")}>Vetëm shqip</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportExcel("en")}>Vetëm anglisht</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportExcel("mk")}>
                  Vetëm maqedonisht
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportExcel("all")}>
                  Të 3 gjuhët bashkë
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" className="rounded-full" asChild>
              <Link to="/settings" aria-label="Cilësimet">
                <Settings />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 px-6 py-8">
        <section className="grid gap-4 md:grid-cols-3">
          <ActionCard
            title="Skano me kamerë"
            text="Fotografoni faqen e të dhënave të pasaportës."
            action={
              <Button className="w-full rounded-xl" onClick={() => setCameraOpen(true)} disabled={busy}>
                <Camera /> Hap kamerën
              </Button>
            }
          />
          <ActionCard
            title="Ngarko foto"
            text="Ngarkim masiv pa limit; fotot e njëjta anashkalohen."
            action={
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => onFiles(e.target.files)}
                />
                <Button
                  variant="secondary"
                  className="w-full rounded-xl"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                >
                  <Upload /> Zgjidh fotot
                </Button>
              </>
            }
          />
          <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-panel)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Parazgjedhjet e manifestit</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Niset nga</Label>
                <Input
                  value={defaults.departurePort}
                  onChange={(e) => updateDefaults({ departurePort: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Arrin në</Label>
                <Input
                  value={defaults.arrivalPort}
                  onChange={(e) => updateDefaults({ arrivalPort: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Lloji i dokumentit</Label>
                <Input
                  value={defaults.docType}
                  onChange={(e) => updateDefaults({ docType: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Shtetësia</Label>
                <Input
                  value={defaults.nationality}
                  onChange={(e) => updateDefaults({ nationality: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <Stat label="Pasaporta gjithsej" value={records.length} />
          <Stat label="Të shfaqura" value={filtered.length} />
          <Stat label="Me afat nën 3 muaj" value={expiringCount} danger={expiringCount > 0} />
        </section>

        {busy && (
          <div className="space-y-2 rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              {progress
                ? `Duke lexuar ${progress.done}/${progress.total} pasaporta…`
                : "Duke lexuar pasaportën…"}
            </div>
            {progress && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        )}

        <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-panel)]">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <CardTitle className="text-base">Manifesti</CardTitle>
              <Tabs value={lang} onValueChange={(v) => setLang(v as Lang)}>
                <TabsList className="rounded-full">
                  <TabsTrigger value="sq" className="rounded-full">
                    {LANG_LABEL.sq}
                  </TabsTrigger>
                  <TabsTrigger value="en" className="rounded-full">
                    {LANG_LABEL.en}
                  </TabsTrigger>
                  <TabsTrigger value="mk" className="rounded-full">
                    {LANG_LABEL.mk}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full max-w-xs">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Kërko emrin ose numrin…"
                  className="rounded-full pl-9"
                  aria-label="Kërko pasaportë"
                />
              </div>
              <Button variant="outline" className="rounded-full" onClick={addEmptyRow}>
                <Plus /> Rresht manual
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {records.length === 0
                  ? "Ende nuk ka të dhëna. Skanoni ose ngarkoni një pasaportë."
                  : "Asnjë rezultat për këtë kërkim — kjo pasaportë nuk është skanuar ende."}
              </p>
            ) : (
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow className="bg-secondary/60">
                    {MANIFEST_COLS.map((c) => (
                      <TableHead
                        key={c}
                        className={cn("align-bottom text-xs whitespace-pre-line", COL_WIDTH[c])}
                      >
                        {HEADERS[lang][c]}
                      </TableHead>
                    ))}
                    <TableHead className="text-right text-xs">Veprime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r, i) => {
                    const soon = isExpiringSoon(r);
                    const m = monthsUntil(r.expiryDate);
                    return (
                      <TableRow
                        key={r.id}
                        className={cn(soon && "bg-destructive/10 text-destructive")}
                      >
                        <TableCell className="tabular-nums">{i + 1}</TableCell>
                        {MANIFEST_COLS.filter((c) => c !== "no").map((c) => (
                          <TableCell key={c} className="p-1">
                            <input
                              value={manifestValue(r, lang, c, defaults)}
                              onChange={(e) => updateCell(r, c, e.target.value)}
                              className={cn(
                                "w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm outline-none focus:border-ring focus:bg-card",
                                (c === "given" || c === "family") && "font-medium",
                                c === "docNo" && "font-mono text-xs",
                                soon && c === "expiryDate" && "font-semibold",
                              )}
                            />
                            {c === "expiryDate" && soon && m !== null && (
                              <p className="flex items-center gap-1 px-2 text-[11px]">
                                <TriangleAlert className="size-3" />
                                {m < 0 ? "E skaduar" : `${Math.max(0, Math.round(m))} muaj`}
                              </p>
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setDeleteId(r.id)}>
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
              Rubrikat janë të redaktueshme — shkruani direkt në tabelë. Datat shfaqen si{" "}
              {formatDate("2033-05-04")}.
            </p>
          </CardContent>
        </Card>
      </main>

      <CameraScanner
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={(dataUrl) => process(dataUrl, `kamera-${Date.now()}.jpg`)}
      />

      <RecordEditor
        record={editing}
        onClose={() => setEditing(null)}
        onSave={(updated) => {
          persist(records.map((r) => (r.id === updated.id ? updated : r)));
          setEditing(null);
          toast.success("Të dhënat u ruajtën.");
        }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fshij regjistrimin?</AlertDialogTitle>
            <AlertDialogDescription>
              Ky veprim nuk mund të kthehet. Pas fshirjes mund ta ngarkoni sërish të njëjtën foto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulo</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                persist(records.filter((r) => r.id !== deleteId));
                setDeleteId(null);
                toast.success("U fshi.");
              }}
            >
              Fshij
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NavLink({
  to,
  icon,
  label,
}: {
  to: "/lista" | "/grupet" | "/vaksinat" | "/udheheqesit";
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Button variant="ghost" size="sm" className="rounded-full" asChild>
      <Link to={to} activeProps={{ className: "bg-card shadow-sm" }}>
        {icon} {label}
      </Link>
    </Button>
  );
}

function ActionCard({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-panel)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{text}</p>
        {action}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[var(--shadow-panel)]",
        danger && "border-destructive/40 bg-destructive/5",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums", danger ? "text-destructive" : "text-primary")}>
        {value}
      </p>
    </div>
  );
}
