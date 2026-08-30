import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { Camera, FileSpreadsheet, Images, ListChecks, Loader2, Pencil, Plane, Search, Settings, Trash2, TriangleAlert, Upload, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { RecordEditor, ConfidenceBadge } from "@/components/RecordEditor";
import { SplashScreen } from "@/components/SplashScreen";
import { LoginGate, useAuthed } from "@/components/LoginGate";
import { extractPassport } from "@/lib/passport.functions";
import { openPhotoSheet } from "@/lib/photo-sheet";
import { cn } from "@/lib/utils";
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
      { title: "HAXHI.app — Skanim pasaportash dhe eksport në Excel" },
      {
        name: "description",
        content:
          "HAXHI.app skanon pasaporta me kamerë ose foto, lexon emrat në shqip, anglisht e maqedonisht, datat dhe numrin, dhe i eksporton në Excel.",
      },
      { property: "og:title", content: "HAXHI.app — Skanim pasaportash" },
      {
        property: "og:description",
        content:
          "Lexim automatik i pasaportave me besueshmëri për çdo fushë, kërkim, alarm skadimi dhe eksport në Excel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexPage,
});

type ExportLang = "sq" | "en" | "mk" | "all";

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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [editing, setEditing] = useState<PassportRecord | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const runExtract = useServerFn(extractPassport);

  useEffect(() => setRecords(loadRecords()), []);

  function persist(next: PassportRecord[]) {
    setRecords(next);
    saveRecords(next);
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

  function exportExcel(lang: ExportLang) {
    if (!records.length) return;
    const nameCols = (r: PassportRecord) => {
      if (lang === "sq") return { "Emri (Shqip)": r.nameSq };
      if (lang === "en") return { "Emri (Anglisht)": r.nameEn };
      if (lang === "mk") return { "Emri (Maqedonisht)": r.nameMk };
      return {
        "Emri (Shqip)": r.nameSq,
        "Emri (Anglisht)": r.nameEn,
        "Emri (Maqedonisht)": r.nameMk,
      };
    };
    const rows = records.map((r, i) => ({
      "Nr.": i + 1,
      ...nameCols(r),
      "Nr. i pasaportës": r.passportNumber,
      "Data e lëshimit": r.issueDate,
      "Data e skadimit": r.expiryDate,
      Shtetësia: r.nationality,
      Datëlindja: r.birthDate,
      Statusi: isExpiringSoon(r) ? "Skadon < 3 muaj" : "Në rregull",
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = Object.keys(rows[0] ?? {}).map(() => ({ wch: 22 }));
    const book = XLSX.utils.book_new();
    const label =
      lang === "sq" ? "Shqip" : lang === "en" ? "Anglisht" : lang === "mk" ? "Maqedonisht" : "3-gjuhe";
    XLSX.utils.book_append_sheet(book, sheet, label.slice(0, 30));
    XLSX.writeFile(book, `pasaportat-${label}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Skedari Excel u shkarkua.");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/60 to-background font-sans">
      <header className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <img src={logo.url} alt="Logo HAXHI.app" className="size-10 object-contain" />
            <div>
              <h1 className="text-lg font-bold tracking-tight">HAXHI.app</h1>
              <p className="text-xs text-muted-foreground">
                Muftinia e BFI Gostivar • Shqip / Anglisht / Maqedonisht
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <nav className="mr-2 flex flex-wrap items-center gap-1">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/lista">
                  <ListChecks /> Lista e emrave
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/grupet">
                  <Plane /> Grupe / Fluturime
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/udheheqesit">
                  <Users /> Udhëheqësit fetarë
                </Link>
              </Button>
            </nav>
            <Button variant="outline" onClick={exportPhotos} disabled={!records.length}>
              <Images /> Eksporto fotot
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={!records.length}>
                  <FileSpreadsheet /> Konverto në Excel
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
            <Button variant="ghost" size="icon" asChild>
              <Link to="/settings" aria-label="Cilësimet">
                <Settings />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-[var(--shadow-panel)]">
              <CardHeader>
                <CardTitle className="text-base">Skano me kamerë</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Hapni kamerën dhe fotografoni faqen e të dhënave të pasaportës.
                </p>
                <Button className="w-full" onClick={() => setCameraOpen(true)} disabled={busy}>
                  <Camera /> Hap kamerën
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-[var(--shadow-panel)]">
              <CardHeader>
                <CardTitle className="text-base">Ngarko foto të skanuara</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Ngarkim masiv pa limit — zgjidhni sa foto të doni njëherësh. Fotot e njëjta
                  anashkalohen automatikisht.
                </p>
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
                  className="w-full"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                >
                  <Upload /> Ngarko foto
                </Button>
              </CardContent>
            </Card>
          </div>

          {busy && (
            <div className="space-y-2 rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
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

          <Card className="shadow-[var(--shadow-panel)]">
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Të dhënat e lexuara</CardTitle>
              <div className="relative w-full max-w-xs">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Kërko emrin ose nr. e pasaportës…"
                  className="pl-9"
                  aria-label="Kërko pasaportë"
                />
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {filtered.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {records.length === 0
                    ? "Ende nuk ka të dhëna. Skanoni ose ngarkoni një pasaportë."
                    : "Asnjë rezultat për këtë kërkim — kjo pasaportë nuk është skanuar ende."}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Foto</TableHead>
                      <TableHead>Anglisht</TableHead>
                      <TableHead>Shqip</TableHead>
                      <TableHead>Maqedonisht</TableHead>
                      <TableHead>Nr. pasaportës</TableHead>
                      <TableHead>Lëshuar</TableHead>
                      <TableHead>Skadon</TableHead>
                      <TableHead className="text-right">Veprime</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const soon = isExpiringSoon(r);
                      const m = monthsUntil(r.expiryDate);
                      return (
                        <TableRow
                          key={r.id}
                          className={cn(soon && "bg-destructive/10 text-destructive")}
                        >
                          <TableCell>
                            <img
                              src={r.thumbnail}
                              alt={`Pasaporta e ${r.nameEn || "personit"}`}
                              className="h-10 w-16 rounded border border-border object-cover"
                            />
                          </TableCell>
                          <Cell value={r.nameEn} conf={r.confidence?.nameEn} raw={r.rawText?.nameEn} bold />
                          <Cell value={r.nameSq} conf={r.confidence?.nameSq} raw={r.rawText?.nameSq} />
                          <Cell value={r.nameMk} conf={r.confidence?.nameMk} raw={r.rawText?.nameMk} />
                          <Cell
                            value={r.passportNumber}
                            conf={r.confidence?.passportNumber}
                            raw={r.rawText?.passportNumber}
                            mono
                          />
                          <Cell value={r.issueDate} conf={r.confidence?.issueDate} />
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {soon && <TriangleAlert className="size-4" />}
                              <span className={cn(soon && "font-semibold")}>{r.expiryDate}</span>
                            </div>
                            {soon && m !== null && (
                              <p className="text-[11px]">
                                {m < 0 ? "E skaduar" : `Skadon për ${Math.max(0, Math.round(m))} muaj`}
                              </p>
                            )}
                          </TableCell>
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

              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-4 text-sm">
                <span className="font-semibold">
                  Gjithsej pasaporta të skanuara:{" "}
                  <span className="tabular-nums text-primary">{records.length}</span>
                </span>
                <span className="text-muted-foreground">
                  Të shfaqura: <span className="tabular-nums">{filtered.length}</span>
                </span>
                <span className={cn(expiringCount > 0 && "font-semibold text-destructive")}>
                  Me afat nën 3 muaj: <span className="tabular-nums">{expiringCount}</span>
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden text-center shadow-[var(--shadow-panel)]">
            <CardContent className="space-y-3 p-6">
              <img
                src={logo.url}
                alt="Logo e Muftinisë së BFI Gostivar"
                className="mx-auto size-32 object-contain"
              />
              <p className="text-sm font-semibold text-primary">HAXHI.app</p>
              <p className="text-xs text-muted-foreground">
                Regjistrimi i pasaportave për haxhin — Muftinia e BFI Gostivar.
              </p>
            </CardContent>
          </Card>
        </aside>
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

function Cell({
  value,
  conf,
  raw,
  bold,
  mono,
}: {
  value: string;
  conf?: number | undefined;
  raw?: string | undefined;
  bold?: boolean | undefined;
  mono?: boolean | undefined;
}) {
  return (
    <TableCell className="align-top">
      <div className="flex items-center gap-2">
        <span className={cn(bold && "font-medium", mono && "font-mono text-xs")}>{value}</span>
        <ConfidenceBadge value={conf} />
      </div>
      {raw ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          <mark className="rounded bg-primary/15 px-1 font-mono text-foreground">{raw}</mark>
        </p>
      ) : null}
    </TableCell>
  );
}
