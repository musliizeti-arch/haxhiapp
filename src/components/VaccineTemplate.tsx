import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { FileUp, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadRecords, saveRecords, type PassportRecord } from "@/lib/passport-store";

type Tpl = { book: XLSX.WorkBook; sheet: string; headerRow: number; cols: { name: number; address: number; nr: number; embg: number; passport: number; birth: number } };

const has = (h: string, words: string[]) => words.some((w) => h.includes(w));

function detect(rows: unknown[][]) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const hs = (rows[i] ?? []).map((c) => String(c ?? "").toLowerCase());
    const find = (w: string[]) => hs.findIndex((h) => has(h, w));
    const name = find(["emri", "emër", "emer", "name", "име", "презиме", "mbiemri"]);
    const address = find(["adres", "vendbanim", "адреса", "живеалиште", "address", "qyteti", "место"]);
    if (name >= 0) {
      return {
        headerRow: i,
        cols: {
          name,
          address,
          nr: find(["nr", "r.b", "р.б", "бр"]),
          embg: find(["embg", "ембг", "jmbg"]),
          passport: find(["pasap", "пасош", "passport"]),
          birth: find(["datël", "datel", "роден", "birth", "датум на раѓ"]),
        },
      };
    }
  }
  return null;
}

/** Ngarkon dokumentin e vjetër të vaksinave dhe e mbush me haxhinjtë e rinj. */
export function VaccineTemplate() {
  const ref = useRef<HTMLInputElement>(null);
  const [tpl, setTpl] = useState<Tpl | null>(null);
  const [records, setRecords] = useState<PassportRecord[]>([]);

  async function onFile(file?: File) {
    if (!file) return;
    const book = XLSX.read(await file.arrayBuffer(), { cellStyles: true });
    const sheet = book.SheetNames[0]!;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheet]!, { header: 1, defval: "" });
    const d = detect(rows);
    if (!d) {
      toast.error("Nuk u gjet kolona e emrit në dokument.");
      return;
    }
    setTpl({ book, sheet, ...d });
    setRecords(loadRecords());
    toast.success("Dokumenti u lexua. Kontrolloni adresat dhe shkarkoni.");
    if (ref.current) ref.current.value = "";
  }

  function setAddress(id: string, residence: string) {
    const all = loadRecords().map((r) => (r.id === id ? { ...r, residence } : r));
    saveRecords(all);
    setRecords(all);
  }

  function download() {
    if (!tpl) return;
    const ws = tpl.book.Sheets[tpl.sheet]!;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
    const head = rows.slice(0, tpl.headerRow + 1);
    const width = Math.max(...head.map((r) => r.length));
    const body = records.map((r, i) => {
      const row: unknown[] = Array(width).fill("");
      const c = tpl.cols;
      if (c.nr >= 0) row[c.nr] = i + 1;
      row[c.name] = r.nameMk || r.nameSq || r.nameEn;
      if (c.address >= 0) row[c.address] = r.residence ?? "";
      if (c.passport >= 0) row[c.passport] = r.passportNumber;
      if (c.birth >= 0) row[c.birth] = r.birthDate;
      if (c.embg >= 0) row[c.embg] = "";
      return row;
    });
    const out = XLSX.utils.aoa_to_sheet([...head, ...body]);
    if (ws["!cols"]) out["!cols"] = ws["!cols"];
    if (ws["!merges"]) out["!merges"] = ws["!merges"].filter((m) => m.e.r <= tpl.headerRow);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, out, tpl.sheet);
    XLSX.writeFile(book, "vaksinat-haxhinjte-e-rinj.xlsx");
  }

  return (
    <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-panel)]">
      <CardHeader className="flex flex-row flex-wrap items-center gap-2">
        <CardTitle className="text-base">Dokumenti i vaksinave (nga dosja e vjetër)</CardTitle>
        <input ref={ref} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => ref.current?.click()}>
            <FileUp /> Ngarko dosjen e vjetër
          </Button>
          <Button onClick={download} disabled={!tpl}>
            <FileSpreadsheet /> Shkarko të mbushur
          </Button>
        </div>
      </CardHeader>
      {tpl && (
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Emrat dhe adresat merren nga pasaportat e skanuara. EMBG mbetet bosh për ta shënuar me dorë.
            {tpl.cols.address < 0 && " Kujdes: në dokument nuk u gjet kolona e adresës."}
          </p>
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {records.map((r, i) => (
              <div key={r.id} className="flex items-center gap-2">
                <span className="w-8 text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate text-sm">{r.nameMk || r.nameSq || r.nameEn}</span>
                <Input
                  className={`h-8 w-56 text-xs ${r.residence ? "" : "border-destructive"}`}
                  placeholder="Adresa / vendbanimi"
                  defaultValue={r.residence ?? ""}
                  onBlur={(e) => e.target.value !== (r.residence ?? "") && setAddress(r.id, e.target.value)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
