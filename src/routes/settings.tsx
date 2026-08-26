import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, KeyRound, BarChart3, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginGate, useAuthed } from "@/components/LoginGate";
import {
  isExpiringSoon,
  loadCredentials,
  loadRecords,
  saveCredentials,
  signOut,
  type PassportRecord,
} from "@/lib/passport-store";
import logo from "@/assets/haxhi-logo.png.asset.json";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Cilësimet — HAXHI.app" },
      {
        name: "description",
        content:
          "Menaxhoni përdoruesin dhe fjalëkalimin e HAXHI.app dhe shikoni statistikat e pasaportave të skanuara.",
      },
      { property: "og:title", content: "Cilësimet — HAXHI.app" },
      {
        property: "og:description",
        content: "Kredencialet dhe statistikat e skanimeve të pasaportave në HAXHI.app.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { authed, ready, setAuthed } = useAuthed();
  return (
    <LoginGate authed={authed} ready={ready} onAuthed={setAuthed}>
      <SettingsContent onSignOut={() => setAuthed(false)} />
    </LoginGate>
  );
}

function SettingsContent({ onSignOut }: { onSignOut: () => void }) {
  const [records, setRecords] = useState<PassportRecord[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    setRecords(loadRecords());
    const c = loadCredentials();
    setUsername(c.username);
    setPassword(c.password);
  }, []);

  const total = records.length;
  const expiring = records.filter(isExpiringSoon).length;
  const thisMonth = records.filter(
    (r) => new Date(r.createdAt).getMonth() === new Date().getMonth(),
  ).length;
  const avgConfidence = (() => {
    const vals = records.flatMap((r) => Object.values(r.confidence ?? {}));
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100);
  })();

  const stats = [
    { label: "Pasaporta gjithsej", value: total },
    { label: "Me afat < 3 muaj", value: expiring },
    { label: "Skanuar këtë muaj", value: thisMonth },
    { label: "Besueshmëri mesatare", value: avgConfidence === null ? "—" : `${avgConfidence}%` },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={logo.url} alt="Logo HAXHI.app" className="size-9 object-contain" />
            <h1 className="text-lg font-semibold tracking-tight">Cilësimet</h1>
          </div>
          <Button variant="outline" asChild>
            <Link to="/">
              <ArrowLeft /> Kthehu
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <Card className="shadow-[var(--shadow-panel)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4 text-primary" /> Statistikat
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-secondary/40 p-4">
                <p className="text-2xl font-bold tabular-nums text-primary">{s.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-panel)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4 text-primary" /> Përdoruesi dhe fjalëkalimi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="su">Përdoruesi</Label>
                <Input id="su" value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp">Fjalëkalimi</Label>
                <Input id="sp" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  if (!username.trim() || !password) {
                    toast.error("Plotësoni të dyja fushat.");
                    return;
                  }
                  saveCredentials({ username: username.trim(), password });
                  toast.success("Kredencialet u ruajtën.");
                }}
              >
                Ruaj kredencialet
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  signOut();
                  onSignOut();
                }}
              >
                <LogOut /> Dil
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Kredencialet ruhen lokalisht në këtë pajisje.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
