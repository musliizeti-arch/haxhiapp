import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppShell } from "@/components/AppShell";
import { LoginGate, useAuthed } from "@/components/LoginGate";
import { loadLeaders, loadRegistrations } from "@/lib/haxhi-store";

export const Route = createFileRoute("/sms")({
  head: () => ({
    meta: [
      { title: "Dërgo SMS — HAXHI.app" },
      { name: "description", content: "Dërgoni mesazhe SMS ose WhatsApp haxhinjve dhe udhëheqësve." },
      { property: "og:title", content: "Dërgo SMS — HAXHI.app" },
      { property: "og:description", content: "Mesazhe të shpejta për haxhinjtë." },
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

const TEMPLATES = [
  "Të nderuar haxhinj, ju njoftojmë se takimi informues do të mbahet në Muftininë e Gostivarit.",
  "Ju lutem dorëzoni pasaportën dhe fotografinë në zyrën e Muftinisë sa më shpejt.",
  "Kujtesë: nisja e fluturimit është e planifikuar. Ju lutemi të jeni në aeroport 3 orë më herët.",
];

function Content() {
  const [contacts, setContacts] = useState<{ name: string; phone: string }[]>([]);
  const [q, setQ] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const list = [
      ...loadRegistrations().map((r) => ({ name: r.name, phone: r.phone })),
      ...loadLeaders().map((l) => ({ name: l.name, phone: l.phone })),
    ].filter((c) => c.phone);
    setContacts(list);
  }, []);

  const found = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? contacts.filter((c) => c.name.toLowerCase().includes(t)).slice(0, 8) : [];
  }, [q, contacts]);

  const clean = phone.replace(/[^\d+]/g, "");
  const intl = clean.startsWith("+") ? clean.slice(1) : clean.startsWith("0") ? `389${clean.slice(1)}` : clean;
  const body = encodeURIComponent(msg);
  const isIOS = typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent);

  return (
    <AppShell title="Dërgo SMS" subtitle="Mesazh me SMS ose WhatsApp">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="size-4" /> Marrësi</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Label>Kërko kontakt</Label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Emri i haxhiut ose udhëheqësit…" />
              {found.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg">
                  {found.map((c, i) => (
                    <button key={i} type="button" className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-secondary"
                      onClick={() => { setPhone(c.phone); setQ(""); }}>
                      <span>{c.name}</span><span className="text-muted-foreground">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Numri i telefonit</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="p.sh. 070 123 456 ose +389 70 123 456" />
            </div>
            <div>
              <Label>Mesazhi</Label>
              <Textarea rows={6} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Shkruani mesazhin këtu…" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild disabled={!clean || !msg}>
                <a href={`sms:${clean}${isIOS ? "&" : "?"}body=${body}`}><Send className="size-4" /> Dërgo SMS</a>
              </Button>
              <Button variant="outline" asChild disabled={!intl || !msg}>
                <a href={`https://wa.me/${intl}?text=${body}`} target="_blank" rel="noreferrer">WhatsApp</a>
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Mesazhe të gatshme</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {TEMPLATES.map((t) => (
              <button key={t} type="button" onClick={() => setMsg(t)} className="w-full rounded-lg border border-border p-3 text-left text-sm hover:bg-secondary">
                {t}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
