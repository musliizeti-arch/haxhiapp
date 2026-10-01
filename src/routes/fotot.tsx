import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { LoginGate, useAuthed } from "@/components/LoginGate";
import { PhotoGallery } from "@/components/PhotoGallery";
import { loadRecords, saveRecords, type PassportRecord } from "@/lib/passport-store";

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
  useEffect(() => setRecords(loadRecords()), []);
  const withPhoto = records.filter((r) => r.photo);

  return (
    <AppShell
      title="Fotot e haxhinjve"
      subtitle={`${withPhoto.length} portrete nga ${records.length} pasaporta`}
      actions={
        <Button className="rounded-full" onClick={() => setOpen(true)} disabled={!records.length}>
          <Images /> Prij / Ngarko / Printo
        </Button>
      }
    >
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
