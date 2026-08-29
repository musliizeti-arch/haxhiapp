import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoginGate, useAuthed } from "@/components/LoginGate";
import { loadLeaders, saveLeaders, type Leader } from "@/lib/haxhi-store";

export const Route = createFileRoute("/udheheqesit")({
  head: () => ({
    meta: [
      { title: "Udhëheqësit fetarë — HAXHI.app" },
      {
        name: "description",
        content:
          "Regjistri i udhëheqësve fetarë që drejtojnë grupet e haxhinjve — emri, detyra, kontakti dhe numri i pasaportës.",
      },
      { property: "og:title", content: "Udhëheqësit fetarë — HAXHI.app" },
      {
        property: "og:description",
        content: "Menaxhoni nëpunësit fetarë që udhëheqin grupet e haxhinjve.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeadersPage,
});

const EMPTY = { name: "", role: "", phone: "", passportNumber: "", note: "" };

function LeadersPage() {
  const { authed, ready, setAuthed } = useAuthed();
  return (
    <LoginGate authed={authed} ready={ready} onAuthed={setAuthed}>
      <LeadersContent />
    </LoginGate>
  );
}

function LeadersContent() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => setLeaders(loadLeaders()), []);

  function persist(next: Leader[]) {
    setLeaders(next);
    saveLeaders(next);
  }

  function add() {
    if (!form.name.trim()) {
      toast.warning("Shkruani emrin e udhëheqësit.");
      return;
    }
    persist([
      { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...form },
      ...leaders,
    ]);
    setForm(EMPTY);
    toast.success("Udhëheqësi u shtua.");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/60 to-background font-sans">
      <header className="border-b border-border bg-card/85 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Kthehu">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <Users className="size-5 text-primary" /> Udhëheqësit fetarë
            </h1>
            <p className="text-xs text-muted-foreground">
              Nëpunësit fetarë që udhëheqin grupet e haxhinjve
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <Card className="shadow-[var(--shadow-panel)]">
          <CardHeader>
            <CardTitle className="text-base">Shto udhëheqës</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {(
              [
                ["name", "Emri dhe mbiemri"],
                ["role", "Detyra (imam, udhërrëfyes…)"],
                ["phone", "Telefoni"],
                ["passportNumber", "Nr. i pasaportës"],
                ["note", "Shënim"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key}>{label}</Label>
                <Input
                  id={key}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
            <div className="flex items-end">
              <Button onClick={add} className="w-full md:w-auto">
                <Plus /> Shto
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-panel)]">
          <CardHeader>
            <CardTitle className="text-base">
              Të regjistruar: <span className="tabular-nums text-primary">{leaders.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {leaders.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Ende nuk ka udhëheqës të regjistruar.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Emri</TableHead>
                    <TableHead>Detyra</TableHead>
                    <TableHead>Telefoni</TableHead>
                    <TableHead>Nr. pasaportës</TableHead>
                    <TableHead>Shënim</TableHead>
                    <TableHead className="text-right">Veprime</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaders.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.name}</TableCell>
                      <TableCell>{l.role}</TableCell>
                      <TableCell>{l.phone}</TableCell>
                      <TableCell className="font-mono text-xs">{l.passportNumber}</TableCell>
                      <TableCell className="text-muted-foreground">{l.note}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            persist(leaders.filter((x) => x.id !== l.id));
                            toast.success("U fshi.");
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
