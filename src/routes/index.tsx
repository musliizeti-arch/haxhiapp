import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import { Camera, FileSpreadsheet, Loader2, Pencil, Trash2, Upload, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { extractPassport } from "@/lib/passport.functions";
import {
  fileToDataUrl,
  hashDataUrl,
  loadRecords,
  saveRecords,
  shrinkImage,
  type PassportRecord,
} from "@/lib/passport-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Skaner Pasaportash — Lexim automatik dhe eksport në Excel" },
      {
        name: "description",
        content:
          "Skanoni ose ngarkoni pasaporta, lexoni automatikisht emrin në shqip, anglisht e maqedonisht, datat dhe numrin, dhe eksportoni në Excel.",
      },
      { property: "og:title", content: "Skaner Pasaportash — Lexim automatik i të dhënave" },
      {
        property: "og:description",
        content:
          "Lexim automatik i pasaportave me kamerë ose foto të skanuara, redaktim i fushave dhe eksport në Excel.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [records, setRecords] = useState<PassportRecord[]>([]);
  const [busy, setBusy] = useState(false);
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

  async function process(rawDataUrl: string, fileName: string) {
    setBusy(true);
    try {
      const imageDataUrl = await shrinkImage(rawDataUrl);
      const hash = await hashDataUrl(imageDataUrl);
      const existing = loadRecords();
      if (existing.some((r) => r.hash === hash)) {
        toast.warning("Kjo foto është skanuar më parë — u anashkalua.");
        return;
      }
      const data = await runExtract({ data: { imageDataUrl } });
      const record: PassportRecord = {
        id: crypto.randomUUID(),
        hash,
        fileName,
        thumbnail: await shrinkImage(imageDataUrl, 220),
        createdAt: new Date().toISOString(),
        ...data,
      };
      persist([record, ...existing]);
      toast.success(`U lexua: ${record.nameEn || "pasaportë e re"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gabim gjatë leximit");
    } finally {
      setBusy(false);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const dataUrl = await fileToDataUrl(file);
      await process(dataUrl, file.name);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function exportExcel() {
    if (!records.length) return;
    const rows = records.map((r, i) => ({
      "Nr.": i + 1,
      "Emri (Anglisht)": r.nameEn,
      "Emri (Shqip)": r.nameSq,
      "Emri (Maqedonisht)": r.nameMk,
      "Nr. i pasaportës": r.passportNumber,
      "Data e lëshimit": r.issueDate,
      "Data e skadimit": r.expiryDate,
      Shtetësia: r.nationality,
      Datëlindja: r.birthDate,
      Skedari: r.fileName,
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = Object.keys(rows[0]).map(() => ({ wch: 22 }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Pasaportat");
    XLSX.writeFile(book, `pasaportat-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Skedari Excel u shkarkua.");
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Skaner Pasaportash</h1>
              <p className="text-xs text-muted-foreground">
                Lexim automatik i të dhënave • Shqip / Anglisht / Maqedonisht
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={exportExcel} disabled={!records.length}>
            <FileSpreadsheet /> Konverto në Excel
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
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
                Zgjidhni një ose më shumë foto nga kompjuteri. Fotot e dyfishta anashkalohen
                automatikisht.
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
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Duke lexuar pasaportën…
          </div>
        )}

        <Card className="shadow-[var(--shadow-panel)]">
          <CardHeader>
            <CardTitle className="text-base">
              Të dhënat e lexuara ({records.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {records.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Ende nuk ka të dhëna. Skanoni ose ngarkoni një pasaportë.
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
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <img
                          src={r.thumbnail}
                          alt={`Pasaporta e ${r.nameEn || "personit"}`}
                          className="h-10 w-16 rounded border border-border object-cover"
                        />
                      </TableCell>
                      <TableCell className="font-medium">{r.nameEn}</TableCell>
                      <TableCell>{r.nameSq}</TableCell>
                      <TableCell>{r.nameMk}</TableCell>
                      <TableCell className="font-mono text-xs">{r.passportNumber}</TableCell>
                      <TableCell>{r.issueDate}</TableCell>
                      <TableCell>{r.expiryDate}</TableCell>
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
                  ))}
                </TableBody>
              </Table>
            )}
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
