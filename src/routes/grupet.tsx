import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { ArrowLeft, BedDouble, FileSpreadsheet, Plane, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoginGate, useAuthed } from "@/components/LoginGate";
import {
  loadFlightAssignments,
  loadFlights,
  loadRoomAssignments,
  loadRooms,
  loadRoster,
  saveFlightAssignments,
  saveFlights,
  saveRoomAssignments,
  saveRooms,
  type Assignments,
  type Flight,
  type Room,
} from "@/lib/haxhi-store";
import { loadRecords } from "@/lib/passport-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/grupet")({
  head: () => ({
    meta: [
      { title: "Grupe & Fluturime — HAXHI.app" },
      {
        name: "description",
        content:
          "Organizoni haxhinjtë sipas fluturimeve me datë e bllok ulësesh dhe sipas dhomave të hotelit me kapacitet 2, 3 ose 4 persona.",
      },
      { property: "og:title", content: "Grupe & Fluturime — HAXHI.app" },
      {
        property: "og:description",
        content: "Caktim me drag-and-drop i haxhinjve në fluturime dhe dhoma, me eksport Excel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GroupsPage,
});

type Person = { id: string; name: string; passportNumber: string };

function GroupsPage() {
  const { authed, ready, setAuthed } = useAuthed();
  return (
    <LoginGate authed={authed} ready={ready} onAuthed={setAuthed}>
      <GroupsContent />
    </LoginGate>
  );
}

function GroupsContent() {
  const [people, setPeople] = useState<Person[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [flightAssign, setFlightAssign] = useState<Assignments>({});
  const [roomAssign, setRoomAssign] = useState<Assignments>({});
  const [flightForm, setFlightForm] = useState({ code: "", date: "", seatBlock: "", note: "" });
  const [roomForm, setRoomForm] = useState({ hotel: "", number: "", capacity: "2" });

  useEffect(() => {
    const records = loadRecords().map((r) => ({
      id: r.id,
      name: r.nameSq || r.nameEn || r.nameMk || r.fileName,
      passportNumber: r.passportNumber,
    }));
    const roster = loadRoster().map((p) => ({ id: p.id, name: p.name, passportNumber: "" }));
    const seen = new Set(records.map((r) => r.name.toLowerCase()));
    setPeople([...records, ...roster.filter((p) => !seen.has(p.name.toLowerCase()))]);
    setFlights(loadFlights());
    setRooms(loadRooms());
    setFlightAssign(loadFlightAssignments());
    setRoomAssign(loadRoomAssignments());
  }, []);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  function assign(kind: "flight" | "room", personId: string, targetId: string | null) {
    const current = kind === "flight" ? flightAssign : roomAssign;
    const next = { ...current };
    if (targetId) next[personId] = targetId;
    else delete next[personId];
    if (kind === "flight") {
      setFlightAssign(next);
      saveFlightAssignments(next);
    } else {
      const room = rooms.find((r) => r.id === targetId);
      if (room) {
        const occupied = Object.entries(current).filter(
          ([pid, rid]) => rid === room.id && pid !== personId,
        ).length;
        if (occupied >= room.capacity) {
          toast.error(`Dhoma ${room.number} është plot (${room.capacity} persona).`);
          return;
        }
      }
      setRoomAssign(next);
      saveRoomAssignments(next);
    }
  }

  function addFlight() {
    if (!flightForm.code.trim()) return toast.error("Shkruani numrin e fluturimit.");
    const next = [...flights, { id: crypto.randomUUID(), ...flightForm }];
    setFlights(next);
    saveFlights(next);
    setFlightForm({ code: "", date: "", seatBlock: "", note: "" });
  }

  function addRoom() {
    if (!roomForm.number.trim()) return toast.error("Shkruani numrin e dhomës.");
    const next: Room[] = [
      ...rooms,
      {
        id: crypto.randomUUID(),
        hotel: roomForm.hotel,
        number: roomForm.number,
        capacity: Number(roomForm.capacity) as 2 | 3 | 4,
      },
    ];
    setRooms(next);
    saveRooms(next);
    setRoomForm({ hotel: roomForm.hotel, number: "", capacity: roomForm.capacity });
  }

  function removeFlight(id: string) {
    const next = flights.filter((f) => f.id !== id);
    setFlights(next);
    saveFlights(next);
    const a = Object.fromEntries(Object.entries(flightAssign).filter(([, v]) => v !== id));
    setFlightAssign(a);
    saveFlightAssignments(a);
  }

  function removeRoom(id: string) {
    const next = rooms.filter((r) => r.id !== id);
    setRooms(next);
    saveRooms(next);
    const a = Object.fromEntries(Object.entries(roomAssign).filter(([, v]) => v !== id));
    setRoomAssign(a);
    saveRoomAssignments(a);
  }

  function exportFlights() {
    if (!flights.length) return toast.error("Nuk ka fluturime.");
    const book = XLSX.utils.book_new();
    for (const f of flights) {
      const rows = Object.entries(flightAssign)
        .filter(([, fid]) => fid === f.id)
        .map(([pid], i) => {
          const p = byId.get(pid);
          return {
            Nr: i + 1,
            Emri: p?.name ?? "",
            Pasaporta: p?.passportNumber ?? "",
            Fluturimi: f.code,
            Data: f.date,
            "Blloku i ulëseve": f.seatBlock,
          };
        });
      XLSX.utils.book_append_sheet(
        book,
        XLSX.utils.json_to_sheet(rows.length ? rows : [{ Nr: "", Emri: "" }]),
        (f.code || "Fluturim").slice(0, 28),
      );
    }
    XLSX.writeFile(book, "fluturimet.xlsx");
    toast.success("Excel-i i fluturimeve u shkarkua.");
  }

  function exportRooms() {
    if (!rooms.length) return toast.error("Nuk ka dhoma.");
    const rows = rooms.flatMap((r) => {
      const members = Object.entries(roomAssign).filter(([, rid]) => rid === r.id);
      if (!members.length)
        return [{ Hoteli: r.hotel, Dhoma: r.number, Kapaciteti: r.capacity, Emri: "", Pasaporta: "" }];
      return members.map(([pid]) => {
        const p = byId.get(pid);
        return {
          Hoteli: r.hotel,
          Dhoma: r.number,
          Kapaciteti: r.capacity,
          Emri: p?.name ?? "",
          Pasaporta: p?.passportNumber ?? "",
        };
      });
    });
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Dhomat");
    XLSX.writeFile(book, "dhomat.xlsx");
    toast.success("Excel-i i dhomave u shkarkua.");
  }

  const unassignedFlight = people.filter((p) => !flightAssign[p.id]);
  const unassignedRoom = people.filter((p) => !roomAssign[p.id]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary/60 to-background font-sans">
      <header className="border-b border-border bg-card/85 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Kthehu">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <Plane className="size-5 text-primary" /> Grupe / Fluturime
            </h1>
            <p className="text-xs text-muted-foreground">
              Tërhiqni emrat me maus te fluturimi ose dhoma përkatëse
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Tabs defaultValue="flights">
          <TabsList>
            <TabsTrigger value="flights">
              <Plane className="size-4" /> Fluturime
            </TabsTrigger>
            <TabsTrigger value="rooms">
              <BedDouble className="size-4" /> Dhoma
            </TabsTrigger>
          </TabsList>

          <TabsContent value="flights" className="space-y-6 pt-6">
            <Card className="shadow-[var(--shadow-panel)]">
              <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">Shto fluturim</CardTitle>
                <Button variant="outline" onClick={exportFlights}>
                  <FileSpreadsheet /> Excel për fluturim
                </Button>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-1.5">
                  <Label>Fluturimi</Label>
                  <Input
                    value={flightForm.code}
                    onChange={(e) => setFlightForm({ ...flightForm, code: e.target.value })}
                    placeholder="p.sh. TK1088"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={flightForm.date}
                    onChange={(e) => setFlightForm({ ...flightForm, date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Blloku i ulëseve</Label>
                  <Input
                    value={flightForm.seatBlock}
                    onChange={(e) => setFlightForm({ ...flightForm, seatBlock: e.target.value })}
                    placeholder="p.sh. 12A–18F"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Shënim</Label>
                  <Input
                    value={flightForm.note}
                    onChange={(e) => setFlightForm({ ...flightForm, note: e.target.value })}
                  />
                </div>
                <div className="flex items-end">
                  <Button className="w-full" onClick={addFlight}>
                    <Plus /> Shto
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <PersonPool
                title="Pa fluturim"
                people={unassignedFlight}
                onDropPerson={(id) => assign("flight", id, null)}
              />
              <div className="grid gap-4 md:grid-cols-2">
                {flights.map((f) => (
                  <DropBox
                    key={f.id}
                    title={f.code || "Fluturim"}
                    subtitle={[f.date, f.seatBlock, f.note].filter(Boolean).join(" • ")}
                    members={people.filter((p) => flightAssign[p.id] === f.id)}
                    onDropPerson={(pid) => assign("flight", pid, f.id)}
                    onRemove={() => removeFlight(f.id)}
                  />
                ))}
                {flights.length === 0 && (
                  <p className="text-sm text-muted-foreground">Ende nuk ka fluturime.</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="rooms" className="space-y-6 pt-6">
            <Card className="shadow-[var(--shadow-panel)]">
              <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-base">Shto dhomë</CardTitle>
                <Button variant="outline" onClick={exportRooms}>
                  <FileSpreadsheet /> Excel për dhomë
                </Button>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label>Hoteli</Label>
                  <Input
                    value={roomForm.hotel}
                    onChange={(e) => setRoomForm({ ...roomForm, hotel: e.target.value })}
                    placeholder="p.sh. Makkah Towers"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Numri i dhomës</Label>
                  <Input
                    value={roomForm.number}
                    onChange={(e) => setRoomForm({ ...roomForm, number: e.target.value })}
                    placeholder="p.sh. 512"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Kapaciteti</Label>
                  <Select
                    value={roomForm.capacity}
                    onValueChange={(v) => setRoomForm({ ...roomForm, capacity: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 persona</SelectItem>
                      <SelectItem value="3">3 persona</SelectItem>
                      <SelectItem value="4">4 persona</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button className="w-full" onClick={addRoom}>
                    <Plus /> Shto
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <PersonPool
                title="Pa dhomë"
                people={unassignedRoom}
                onDropPerson={(id) => assign("room", id, null)}
              />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {rooms.map((r) => {
                  const members = people.filter((p) => roomAssign[p.id] === r.id);
                  return (
                    <DropBox
                      key={r.id}
                      title={`Dhoma ${r.number}`}
                      subtitle={`${r.hotel ? r.hotel + " • " : ""}${members.length}/${r.capacity}`}
                      full={members.length >= r.capacity}
                      members={members}
                      onDropPerson={(pid) => assign("room", pid, r.id)}
                      onRemove={() => removeRoom(r.id)}
                    />
                  );
                })}
                {rooms.length === 0 && (
                  <p className="text-sm text-muted-foreground">Ende nuk ka dhoma.</p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function PersonChip({ person }: { person: Person }) {
  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", person.id)}
      className="cursor-grab rounded-md border border-border bg-card px-2.5 py-1.5 text-sm active:cursor-grabbing"
    >
      {person.name}
      {person.passportNumber && (
        <span className="ml-2 text-xs text-muted-foreground">{person.passportNumber}</span>
      )}
    </div>
  );
}

function PersonPool({
  title,
  people,
  onDropPerson,
}: {
  title: string;
  people: Person[];
  onDropPerson: (id: string) => void;
}) {
  return (
    <Card
      className="h-fit shadow-[var(--shadow-panel)]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDropPerson(id);
      }}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Users className="size-4 text-primary" /> {title} ({people.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex max-h-[520px] flex-col gap-2 overflow-y-auto">
        {people.length === 0 ? (
          <p className="text-xs text-muted-foreground">Të gjithë janë caktuar.</p>
        ) : (
          people.map((p) => <PersonChip key={p.id} person={p} />)
        )}
      </CardContent>
    </Card>
  );
}

function DropBox({
  title,
  subtitle,
  members,
  full,
  onDropPerson,
  onRemove,
}: {
  title: string;
  subtitle?: string;
  members: Person[];
  full?: boolean;
  onDropPerson: (id: string) => void;
  onRemove: () => void;
}) {
  return (
    <Card
      className={cn("shadow-[var(--shadow-panel)]", full && "border-primary")}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDropPerson(id);
      }}
    >
      <CardHeader className="flex items-start justify-between gap-2">
        <div>
          <CardTitle className="text-sm">{title}</CardTitle>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <Button size="icon" variant="ghost" onClick={onRemove} aria-label="Fshi">
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </CardHeader>
      <CardContent className="flex min-h-24 flex-col gap-2">
        {members.length === 0 ? (
          <p className="text-xs text-muted-foreground">Tërhiqni emrat këtu.</p>
        ) : (
          members.map((p) => <PersonChip key={p.id} person={p} />)
        )}
      </CardContent>
    </Card>
  );
}
