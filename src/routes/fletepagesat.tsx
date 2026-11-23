import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Receipt, Trash2 } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoginGate, useAuthed } from "@/components/LoginGate";
import { loadPayments, savePayments, type PaymentSlip } from "@/lib/haxhi-store";
import { loadRecords, type PassportRecord } from "@/lib/passport-store";

export const Route = createFileRoute("/fletepagesat")({
  head: () => ({
    meta: [
      { title: "Fletëpagesat — HAXHI.app" },
      { name: "description", content: "Fletëpagesat e haxhinjve të ngarkuara nga dosjet." },
      { property: "og:title", content: "Fletëpagesat — HAXHI.app" },
      { property: "og:description", content: "Të gjitha fletëpagesat e haxhinjve në një vend." },
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
  const [items, setItems] = useState<PaymentSlip[]>([]);
  const [records, setRecords] = useState<PassportRecord[]>([]);
  useEffect(() => {
    setItems(loadPayments());
    setRecords(loadRecords());
  }, []);
  const persist = (v: PaymentSlip[]) => {
    setItems(v);
    savePayments(v);
  };
  const sorted = useMemo(() => [...records].sort((a, b) => a.nameSq.localeCompare(b.nameSq)), [records]);

  return (
    <AppShell title="Fletëpagesat" subtitle={`${items.length} fletëpagesa`}>
      <div className="mx-auto max-w-6xl">
        {items.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            <Receipt className="mx-auto mb-2 size-8" />
            Ende nuk ka fletëpagesa. Ngarkoni një dosje te “Pasaportat”.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <Card key={p.id}>
                <CardContent className="space-y-2 p-3">
                  <a href={p.image} target="_blank" rel="noreferrer">
                    <img src={p.image} alt={p.fileName} className="h-56 w-full rounded-md object-contain bg-secondary" />
                  </a>
                  <p className="truncate text-xs text-muted-foreground">{p.fileName}</p>
                  <div className="flex gap-2">
                    <select
                      className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                      value={p.personId ?? ""}
                      onChange={(e) =>
                        persist(items.map((x) => (x.id === p.id ? { ...x, personId: e.target.value || undefined } : x)) as PaymentSlip[])
                      }
                    >
                      <option value="">— Lidh me haxhiun —</option>
                      {sorted.map((r) => (
                        <option key={r.id} value={r.id}>{r.nameSq || r.nameEn}</option>
                      ))}
                    </select>
                    <Button size="icon" variant="ghost" onClick={() => persist(items.filter((x) => x.id !== p.id))}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
