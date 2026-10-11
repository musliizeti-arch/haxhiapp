import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileDown, Search, Stamp, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { AppShell } from "@/components/AppShell";
import { LoginGate, useAuthed } from "@/components/LoginGate";
import { loadRecords, type PassportRecord } from "@/lib/passport-store";
import { loadVisas, saveVisas, type VisaInfo, type VisaStatus } from "@/lib/haxhi-store";

export const Route = createFileRoute("/vizat")({
  head: () => ({
    meta: [
      { title: "Vizat e Haxhit & Nusuk — HAXHI.app" },
      { name: "description", content: "Ndjekja e vizave të haxhit për çdo haxhi: statusi, numri dhe dokumenti." },
      { property: "og:title", content: "Vizat e Haxhit & Nusuk — HAXHI.app" },
      { property: "og:description", content: "Statusi i vizave dhe dokumentet për haxhinjtë." },
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

const STATUS: Record<VisaStatus, string> = {
  issued: "E lëshuar",
  pending: "Në pritje",
  missing: "Mungon",
};

function Content() {
  const [records, setRecords] = useState<PassportRecord[]>([]);
  const [visas, setVisas] = useState<Record<string, VisaInfo>>({});
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | VisaStatus>("all");

  useEffect(() => {
    setRecords(loadRecords());
    setVisas(loadVisas());
  }, []);

  const get = (id: string): VisaInfo => visas[id] ?? { status: "missing" };
  function update(id: string, patch: Partial<VisaInfo>) {
    const next = { ...visas, [id]: { ...get(id), ...patch } };
    setVisas(next);
    saveVisas(next);
  }

  const counts = useMemo(() => {
    const c = { issued: 0, pending: 0, missing: 0 };
    records.forEach((r) => c[get(r.id).status]++);
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, visas]);

  const shown = records.filter((r) => {
    const v = get(r.id);
    if (filter !== "all" && v.status !== filter) return false;
    const t = q.trim().toLowerCase();
    return !t || [r.nameSq, r.nameEn, r.nameMk, r.passportNumber, v.number].join(" ").toLowerCase().includes(t);
  });

  function attach(id: string, file: File) {
    if (file.size > 3_000_000) return void toast.error("Skedari është shumë i madh (max 3MB).");
    const reader = new FileReader();
    reader.onload = () =>
      update(id, { file: String(reader.result), fileName: file.name, status: "issued" });
    reader.readAsDataURL(file);
  }

  function exportExcel() {
    const rows = records.map((r, i) => {
      const v = get(r.id);
      return {
        Nr: i + 1,
        Emri: r.nameSq || r.nameEn,
        "Nr. pasaportës": r.passportNumber,
        Statusi: STATUS[v.status],
        "Nr. vizës": v.number ?? "",
        Lëshuar: v.issueDate ?? "",
        Skadon: v.expiryDate ?? "",
        Shënim: v.note ?? "",
      };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Vizat");
    XLSX.writeFile(wb, "vizat.xlsx");
  }

  return (
    <AppShell
      title="Vizat e Haxhit & Nusuk"
      subtitle={`${counts.issued} të lëshuara · ${counts.pending} në pritje · ${counts.missing} mungojnë`}
      actions={
        <Button onClick={exportExcel} disabled={!records.length}>
          <FileDown className="size-4" /> Excel
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Kërko emër, pasaportë ose nr. vize…" className="pl-8" />
        </div>
        {(["all", "issued", "pending", "missing"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
            {f === "all" ? "Të gjitha" : STATUS[f]}
          </Button>
        ))}
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {shown.length === 0 ? (
            <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Stamp className="size-4" /> Nuk ka haxhinj. Skanoni pasaportat fillimisht.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-2">Haxhiu</th><th className="p-2">Statusi</th><th className="p-2">Nr. vizës</th>
                  <th className="p-2">Lëshuar</th><th className="p-2">Skadon</th><th className="p-2">Dokumenti</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const v = get(r.id);
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="p-2">
                        <p className="font-medium">{r.nameSq || r.nameEn}</p>
                        <p className="text-xs text-muted-foreground">{r.passportNumber}</p>
                      </td>
                      <td className="p-2">
                        <select
                          value={v.status}
                          onChange={(e) => update(r.id, { status: e.target.value as VisaStatus })}
                          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                      </td>
                      <td className="p-2"><Input className="h-8 w-36" value={v.number ?? ""} onChange={(e) => update(r.id, { number: e.target.value })} /></td>
                      <td className="p-2"><Input type="date" className="h-8 w-36" value={v.issueDate ?? ""} onChange={(e) => update(r.id, { issueDate: e.target.value })} /></td>
                      <td className="p-2"><Input type="date" className="h-8 w-36" value={v.expiryDate ?? ""} onChange={(e) => update(r.id, { expiryDate: e.target.value })} /></td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          {v.file && (
                            <a href={v.file} download={v.fileName} className="max-w-28 truncate text-xs text-primary underline">
                              {v.fileName ?? "Vize"}
                            </a>
                          )}
                          <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-secondary">
                            <Upload className="size-3" /> Ngarko
                            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && attach(r.id, e.target.files[0])} />
                          </label>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
