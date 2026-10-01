import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppShell } from "@/components/AppShell";
import { LoginGate, useAuthed } from "@/components/LoginGate";
import { loadRecords, type PassportRecord } from "@/lib/passport-store";
import { loadVip, saveVip, type VipEntry } from "@/lib/haxhi-store";

export const Route = createFileRoute("/vip")({
  head: () => ({
    meta: [
      { title: "VIP / Përparësi — HAXHI.app" },
      { name: "description", content: "Haxhinjtë VIP të Reisul Ulemasë, Muftiut dhe haxhinjtë me përparësi." },
      { property: "og:title", content: "VIP / Përparësi — HAXHI.app" },
      { property: "og:description", content: "Regjistri i haxhinjve VIP dhe me përparësi." },
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

const CATEGORIES = ["VIP i Reisul Ulemasë", "VIP i Muftiut", "Me përparësi"];

function Content() {
  const [list, setList] = useState<VipEntry[]>([]);
  const [records, setRecords] = useState<PassportRecord[]>([]);
  const [passportId, setPassportId] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]!);
  const [note, setNote] = useState("");

  useEffect(() => {
    setList(loadVip());
    setRecords(loadRecords());
  }, []);

  function persist(next: VipEntry[]) {
    setList(next);
    saveVip(next);
  }

  function add() {
    const rec = records.find((r) => r.id === passportId);
    const finalName = rec ? rec.nameSq || rec.nameEn : name.trim();
    if (!finalName) return void toast.warning("Zgjidhni haxhiun ose shkruani emrin.");
    if (rec && list.some((v) => v.passportId === rec.id)) return void toast.warning("Ky haxhi është tashmë në listë.");
    persist([
      { id: crypto.randomUUID(), passportId: rec?.id, name: finalName, category, note, createdAt: new Date().toISOString() },
      ...list,
    ]);
    setPassportId("");
    setName("");
    setNote("");
    toast.success("U shtua në listën VIP.");
  }

  const selectCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <AppShell title="VIP / Përparësi" subtitle="Haxhinjtë VIP të Reisit, Muftiut dhe me përparësi">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shto haxhi VIP</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nga haxhinjtë e regjistruar</Label>
              <select className={selectCls} value={passportId} onChange={(e) => setPassportId(e.target.value)}>
                <option value="">— ose shkruani emrin më poshtë —</option>
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nameSq || r.nameEn} {r.passportNumber && `(${r.passportNumber})`}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Emri (nëse nuk është skanuar)</Label>
              <Input value={name} disabled={!!passportId} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Kategoria</Label>
              <select className={selectCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Shënim</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div>
              <Button onClick={add}>
                <Plus /> Shto
              </Button>
            </div>
          </CardContent>
        </Card>

        {CATEGORIES.map((cat) => {
          const items = list.filter((v) => v.category === cat);
          return (
            <Card key={cat}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Crown className="size-4 text-primary" /> {cat}
                  <span className="ml-auto tabular-nums text-primary">{items.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">Asnjë haxhi.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {items.map((v) => {
                      const rec = records.find((r) => r.id === v.passportId);
                      return (
                        <li key={v.id} className="flex items-center gap-3 py-2">
                          {rec?.photo && <img src={rec.photo} alt="" className="size-9 rounded object-cover" />}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{v.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {rec?.passportNumber} {v.note}
                            </p>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => persist(list.filter((x) => x.id !== v.id))}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
