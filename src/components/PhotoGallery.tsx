import { useEffect, useRef, useState } from "react";
import { Crop, Printer, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { cropPhoto, shrinkImage, type PassportRecord, type PhotoBox } from "@/lib/passport-store";
import { openPhotoSheet } from "@/lib/photo-sheet";

type Props = {
  open: boolean;
  records: PassportRecord[];
  onClose: () => void;
  onUpdate: (record: PassportRecord) => void;
};

const RATIO = 35 / 45;

/** Galeria e portreteve brenda aplikacionit, me mundësi prerjeje dhe ngarkimi. */
export function PhotoGallery({ open, records, onClose, onUpdate }: Props) {
  const [cropping, setCropping] = useState<PassportRecord | null>(null);
  const uploadFor = useRef<PassportRecord | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function print() {
    const items = records.filter((r) => !!r.photo).map((r) => ({ src: r.photo!, name: "Foto" }));
    if (!items.length) return void toast.warning("Nuk ka fotografi.");
    if (!openPhotoSheet(items)) toast.error("Lejoni dritaret pop-up për printim.");
  }

  async function onFile(file: File | undefined) {
    const rec = uploadFor.current;
    if (!file || !rec) return;
    const raw = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(file);
    });
    onUpdate({ ...rec, photo: await shrinkImage(raw, 600) });
    toast.success("Fotoja u ngarkua.");
  }

  return (
    <>
      <Dialog open={open && !cropping} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center justify-between gap-2 pr-6">
              Fotografitë ({records.length})
              <Button size="sm" variant="outline" className="rounded-full" onClick={print}>
                <Printer /> Printo / PDF
              </Button>
            </DialogTitle>
          </DialogHeader>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {records.map((r) => (
              <div key={r.id} className="group space-y-2">
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  {r.photo ? (
                    <img src={r.photo} alt="" className="aspect-[35/45] w-full object-cover" />
                  ) : (
                    <div className="flex aspect-[35/45] items-center justify-center text-xs text-muted-foreground">
                      Pa foto
                    </div>
                  )}
                </div>
                <p className="truncate text-center text-xs text-muted-foreground">
                  {r.nameSq || r.nameEn || r.nameMk || "—"}
                </p>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-lg"
                    onClick={() => setCropping(r)}
                    title="Prije nga pasaporta"
                  >
                    <Crop /> Prije
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg"
                    title="Ngarko foto"
                    onClick={() => {
                      uploadFor.current = r;
                      fileInput.current?.click();
                    }}
                  >
                    <Upload />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {cropping && (
        <CropDialog
          record={cropping}
          onClose={() => setCropping(null)}
          onDone={(photo, box) => {
            onUpdate({ ...cropping, photo, photoBox: box });
            setCropping(null);
            toast.success("Fotoja u pre.");
          }}
        />
      )}
    </>
  );
}

/* ---------- Prerja manuale ---------- */

function CropDialog({
  record,
  onClose,
  onDone,
}: {
  record: PassportRecord;
  onClose: () => void;
  onDone: (photo: string, box: PhotoBox) => void;
}) {
  const source = record.thumbnail;
  const wrap = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 1, h: 1 });
  const [box, setBox] = useState<PhotoBox>(() => {
    const b = record.photoBox;
    return b && b.w > 0 && b.h > 0 ? b : { x: 0.05, y: 0.15, w: 0.25, h: 0.6 };
  });
  const [preview, setPreview] = useState<string>();
  const drag = useRef<{ px: number; py: number; bx: number; by: number } | null>(null);

  // Mbaj raportin 35:45 në piksela reale
  function normalize(b: PhotoBox): PhotoBox {
    const hPx = b.h * dims.h;
    const w = (hPx * RATIO) / dims.w;
    const x = Math.min(Math.max(0, b.x), 1 - w);
    const y = Math.min(Math.max(0, b.y), 1 - b.h);
    return { x, y, w, h: b.h };
  }

  useEffect(() => {
    const img = new Image();
    img.onload = () => setDims({ w: img.width, h: img.height });
    img.src = source;
  }, [source]);

  useEffect(() => {
    if (dims.w === 1) return;
    let alive = true;
    void cropPhoto(source, normalize(box), 520).then((p) => alive && setPreview(p));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box, dims, source]);

  const nb = normalize(box);

  function onPointerDown(e: React.PointerEvent) {
    const rect = wrap.current!.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const inside = px >= nb.x && px <= nb.x + nb.w && py >= nb.y && py <= nb.y + nb.h;
    const start = inside ? nb : { ...nb, x: px - nb.w / 2, y: py - nb.h / 2 };
    if (!inside) setBox(start);
    drag.current = { px, py, bx: start.x, by: start.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const rect = wrap.current!.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setBox({ ...nb, x: drag.current.bx + (px - drag.current.px), y: drag.current.by + (py - drag.current.py) });
  }
  function onPointerUp() {
    drag.current = null;
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Prije fotografinë — {record.nameSq || record.nameEn || "personi"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-[1fr_200px]">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Zvarrit kornizën mbi fytyrën e personit. Përdor rrëshqitësin për madhësinë.
            </p>
            <div
              ref={wrap}
              className="relative select-none overflow-hidden rounded-xl border border-border bg-card touch-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              <img src={source} alt="Pasaporta" className="block w-full" draggable={false} />
              <div
                className="pointer-events-none absolute border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
                style={{
                  left: `${nb.x * 100}%`,
                  top: `${nb.y * 100}%`,
                  width: `${nb.w * 100}%`,
                  height: `${nb.h * 100}%`,
                }}
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Madhësia</span>
              <Slider
                min={10}
                max={100}
                step={1}
                value={[Math.round(box.h * 100)]}
                onValueChange={([v]) => setBox({ ...nb, h: (v ?? 50) / 100 })}
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium">Rezultati</p>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {preview ? (
                <img src={preview} alt="Parapamje" className="aspect-[35/45] w-full object-cover" />
              ) : (
                <div className="aspect-[35/45]" />
              )}
            </div>
            <Button
              className="w-full rounded-xl"
              disabled={!preview}
              onClick={() => preview && onDone(preview, nb)}
            >
              Ruaj foton
            </Button>
            <Button variant="outline" className="w-full rounded-xl" onClick={onClose}>
              Anulo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
