import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Images, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { LoginGate, useAuthed } from "@/components/LoginGate";
import { PhotoGallery } from "@/components/PhotoGallery";
import { fileToDataUrl, loadRecords, saveRecords, shrinkImage, type PassportRecord } from "@/lib/passport-store";

const norm = (t: string) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\u0400-\u04ff]+/g, " ").trim();

/** Gjen pasaportën që përputhet me emrin e skedarit (nr. pasaporte ose emri i plotë). */
function matchRecord(fileName: string, records: PassportRecord[]) {
  const f = norm(fileName.replace(/\.[^.]+$/, ""));
  const compact = f.replace(/ /g, "");
  const byNumber = records.find((r) => r.passportNumber && compact.includes(norm(r.passportNumber).replace(/ /g, "")));
  if (byNumber) return byNumber;
  const tokens = new Set(f.split(" ").filter((t) => t.length > 1));
  let best: PassportRecord | undefined;
  let bestScore = 0;
  for (const r of records) {
    for (const n of [r.nameSq, r.nameEn, r.nameMk]) {
      const parts = norm(n || "").split(" ").filter((t) => t.length > 1);
      if (!parts.length) continue;
      const hit = parts.filter((p) => tokens.has(p)).length;
      const score = hit / parts.length;
      if (hit >= 2 && score > bestScore) {
        best = r;
        bestScore = score;
      }
    }
  }
  return best;
}

type Pending = { key: string; name: string; dataUrl: string; matchId: string };

export const Route = createFileRoute("/fotot")({
  head: () => ({
    meta: [
      { title: "Fotot e haxhinjve — HAXHI.app" },
      { name: "description", content: "Portretet e të gjithë haxhinjve të regjistruar me skanim pasaporte." },
      { property: "og:title", content: "Fotot e haxhinjve — HAXHI.app" },
      { property: "og:description", content: "Galeria e portreteve nga pasaportat e skanuara." },
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
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    const out: Pending[] = [];
    for (const file of Array.from(files)) {
      const dataUrl = await shrinkImage(await fileToDataUrl(file), 700);
      out.push({ key: crypto.randomUUID(), name: file.name, dataUrl, matchId: matchRecord(file.name, records)?.id ?? "" });
    }
    setPending(out);
    if (fileRef.current) fileRef.current.value = "";
    const matched = out.filter((p) => p.matchId).length;
    toast.info(`${matched} nga ${out.length} foto u identifikuan automatikisht. Kontrolloni dhe konfirmoni.`);
  }

  function applyPending() {
    const map = new Map(pending.filter((p) => p.matchId).map((p) => [p.matchId, p.dataUrl]));
    const next = records.map((r) => (map.has(r.id) ? { ...r, photo: map.get(r.id) } : r));
    setRecords(next);
    saveRecords(next);
    setPending([]);
    toast.success(`${map.size} foto u lidhën me pasaportat.`);
  }
  useEffect(() => setRecords(loadRecords()), []);
  const withPhoto = records.filter((r) => r.photo);

  return (
    <AppShell
      title="Fotot e haxhinjve"
      subtitle={`${withPhoto.length} portrete nga ${records.length} pasaporta`}
      actions={
        <>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void onUpload(e.target.files)} />
        <Button variant="outline" className="rounded-full" onClick={() => fileRef.current?.click()} disabled={!records.length}>
          <Upload /> Ngarko foto
        </Button>
        <Button className="rounded-full" onClick={() => setOpen(true)} disabled={!records.length}>
          <Images /> Prij / Ngarko / Printo
        </Button>
        </>
      }
    >
      {pending.length > 0 && (
        <div className="mb-6 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">
              Identifikimi i fotove të ngarkuara ({pending.filter((p) => p.matchId).length}/{pending.length})
            </p>
            <p className="text-xs text-muted-foreground">Fotot lidhen sipas emrit të skedarit (emri ose nr. i pasaportës). Ndryshoni me dorë ku duhet.</p>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPending([])}>Anulo</Button>
              <Button size="sm" onClick={applyPending}>Konfirmo</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {pending.map((p) => {
              const r = records.find((x) => x.id === p.matchId);
              return (
                <div key={p.key} className={`rounded-lg border bg-card p-2 ${p.matchId ? "border-primary" : "border-destructive"}`}>
                  <div className="flex gap-1">
                    <img src={p.dataUrl} alt="" className="aspect-[35/45] w-1/2 rounded object-cover" />
                    {r?.photo ? (
                      <img src={r.photo} alt="" className="aspect-[35/45] w-1/2 rounded object-cover opacity-70" />
                    ) : (
                      <div className="flex aspect-[35/45] w-1/2 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">pasaporta</div>
                    )}
                  </div>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground">{p.name}</p>
                  <select
                    className="mt-1 w-full rounded border border-input bg-background px-1 py-1 text-xs"
                    value={p.matchId}
                    onChange={(e) => setPending(pending.map((x) => (x.key === p.key ? { ...x, matchId: e.target.value } : x)))}
                  >
                    <option value="">— Pa lidhur —</option>
                    {records.map((x) => (
                      <option key={x.id} value={x.id}>{x.nameSq || x.nameEn || x.fileName}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {records.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Ende nuk ka haxhinj të skanuar.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {records.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-2 text-center">
              {r.photo ? (
                <img src={r.photo} alt={r.nameSq || r.nameEn} className="aspect-[35/45] w-full rounded-md object-cover" />
              ) : (
                <div className="flex aspect-[35/45] items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                  Pa foto
                </div>
              )}
              <p className="mt-2 truncate text-xs font-medium">{r.nameSq || r.nameEn || "—"}</p>
            </div>
          ))}
        </div>
      )}
      <PhotoGallery
        open={open}
        records={records}
        onClose={() => setOpen(false)}
        onUpdate={(u) => {
          const next = records.map((r) => (r.id === u.id ? u : r));
          setRecords(next);
          saveRecords(next);
        }}
      />
    </AppShell>
  );
}
