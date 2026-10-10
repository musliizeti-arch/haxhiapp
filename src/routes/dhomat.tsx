import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BedDouble, FileSpreadsheet, Plus, Trash2, X } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppShell } from "@/components/AppShell";
import { LoginGate, useAuthed } from "@/components/LoginGate";
import { PersonSearch, personName } from "@/components/PersonSearch";
import { loadRecords, type PassportRecord } from "@/lib/passport-store";
import { loadHotelRooms, saveHotelRooms, type HotelId, type HotelRoom } from "@/lib/haxhi-store";

export const Route = createFileRoute("/dhomat")({
  head: () => ({
    meta: [
      { title: "Dhomat e hoteleve — HAXHI.app" },
      { name: "description", content: "Ndarja e haxhinjve në dhomat e Hotelit Mekë dhe Hotelit Medinë." },
      { property: "og:title", content: "Dhomat e hoteleve — HAXHI.app" },
      { property: "og:description", content: "Rregullimi i dhomave në Mekë dhe Medinë." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const HOTELS: Record<HotelId, string> = { meke: "Hoteli Mekë", medine: "Hoteli Medinë" };

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
  const [rooms, setRooms] = useState<HotelRoom[]>([]);
  const [hotel, setHotel] = useState<HotelId>("meke");
  const [number, setNumber] = useState("");
  const [capacity, setCapacity] = useState(4);
  useEffect(() => {
    setRecords(loadRecords());
    setRooms(loadHotelRooms());
  }, []);

  const byId = useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);
  const hotelRooms = rooms.filter((r) => r.hotel === hotel);
  const assigned = useMemo(() => new Set(hotelRooms.flatMap((r) => r.memberIds)), [hotelRooms]);

  function persist(next: HotelRoom[]) {
    setRooms(next);
    saveHotelRooms(next);
  }

  function addRoom() {
    const n = number.trim();
    if (!n) return;
    if (hotelRooms.some((r) => r.number === n)) {
      toast.error("Kjo dhomë ekziston.");
      return;
    }
    persist([...rooms, { id: crypto.randomUUID(), hotel, number: n, capacity, memberIds: [] }]);
    setNumber("");
  }

  function addMember(room: HotelRoom, id: string) {
    if (room.memberIds.length >= room.capacity) {
      toast.error("Dhoma është plot.");
      return;
    }
    persist(rooms.map((r) => (r.id === room.id ? { ...r, memberIds: [...r.memberIds, id] } : r)));
  }

  function exportExcel() {
    const book = XLSX.utils.book_new();
    for (const h of Object.keys(HOTELS) as HotelId[]) {
      const rows = rooms
        .filter((r) => r.hotel === h)
        .flatMap((room) =>
          room.memberIds.map((id) => {
            const p = byId.get(id);
            return {
              Dhoma: room.number,
              Kapaciteti: room.capacity,
              Emri: p ? personName(p) : "",
              "Nr. pasaportës": p?.passportNumber ?? "",
            };
          }),
        );
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), HOTELS[h]);
    }
    XLSX.writeFile(book, "dhomat-hoteleve.xlsx");
  }

  return (
    <AppShell
      title="Dhomat"
      subtitle={`${HOTELS[hotel]} • ${hotelRooms.length} dhoma • ${assigned.size} nga ${records.length} haxhinj`}
      actions={
        <Button className="rounded-full" onClick={exportExcel} disabled={!rooms.length}>
          <FileSpreadsheet /> Excel
        </Button>
      }
    >
      <Tabs value={hotel} onValueChange={(v) => setHotel(v as HotelId)} className="mb-5">
        <TabsList>
          <TabsTrigger value="meke">Hoteli Mekë</TabsTrigger>
          <TabsTrigger value="medine">Hoteli Medinë</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-5 flex max-w-lg flex-wrap gap-2">
        <Input
          className="w-40"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addRoom()}
          placeholder="Nr. i dhomës"
        />
        <div className="flex rounded-md border border-input">
          {[2, 3, 4, 5].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCapacity(c)}
              className={`px-3 text-sm ${capacity === c ? "bg-primary text-primary-foreground" : ""}`}
            >
              {c}
            </button>
          ))}
        </div>
        <Button onClick={addRoom}>
          <Plus /> Shto dhomë
        </Button>
      </div>

      {hotelRooms.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Ende nuk ka dhoma në {HOTELS[hotel]}.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {hotelRooms.map((room) => (
            <Card key={room.id}>
              <CardHeader className="space-y-3 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BedDouble className="size-4 text-primary" /> Dhoma {room.number}
                  <span className="ml-auto text-sm tabular-nums text-primary">
                    {room.memberIds.length}/{room.capacity}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Fshi dhomën"
                    onClick={() => persist(rooms.filter((r) => r.id !== room.id))}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </CardTitle>
                {room.memberIds.length < room.capacity && (
                  <PersonSearch records={records} exclude={assigned} onPick={(id) => addMember(room, id)} />
                )}
              </CardHeader>
              <CardContent className="space-y-1.5">
                {room.memberIds.map((id) => {
                  const p = byId.get(id);
                  return (
                    <div key={id} className="flex items-center gap-2">
                      {p?.photo && <img src={p.photo} alt="" className="size-7 rounded object-cover" />}
                      <span className="min-w-0 flex-1 truncate text-sm">{p ? personName(p) : "—"}</span>
                      <button
                        type="button"
                        aria-label="Hiq"
                        onClick={() =>
                          persist(
                            rooms.map((r) =>
                              r.id === room.id ? { ...r, memberIds: r.memberIds.filter((x) => x !== id) } : r,
                            ),
                          )
                        }
                      >
                        <X className="size-4 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
