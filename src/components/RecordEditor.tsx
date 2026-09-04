import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { shrinkImage, type FieldKey, type PassportRecord } from "@/lib/passport-store";

type Props = {
  record: PassportRecord | null;
  onClose: () => void;
  onSave: (record: PassportRecord) => void;
};

type EditableKey = FieldKey | "sex" | "departurePort" | "arrivalPort" | "docType";

const fields: { key: EditableKey; label: string; type?: string }[] = [
  { key: "nameEn", label: "Emri (Anglisht)" },
  { key: "nameSq", label: "Emri (Shqip)" },
  { key: "nameMk", label: "Emri (Maqedonisht)" },
  { key: "passportNumber", label: "Nr. i pasaportës" },
  { key: "sex", label: "Gjinia (M/F)" },
  { key: "birthDate", label: "Datëlindja", type: "date" },
  { key: "issueDate", label: "Data e lëshimit", type: "date" },
  { key: "expiryDate", label: "Data e skadimit", type: "date" },
  { key: "nationality", label: "Shtetësia" },
  { key: "docType", label: "Lloji i dokumentit" },
  { key: "departurePort", label: "Niset nga" },
  { key: "arrivalPort", label: "Arrin në" },
];

export function ConfidenceBadge({ value }: { value: number | undefined }) {
  if (value === undefined) return null;
  const pct = Math.round(value * 100);
  const tone =
    pct >= 85
      ? "bg-primary/10 text-primary border-primary/30"
      : pct >= 60
        ? "bg-chart-4/20 text-foreground border-chart-4/50"
        : "bg-destructive/10 text-destructive border-destructive/30";
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums",
        tone,
      )}
      title="Niveli i besueshmërisë së leximit"
    >
      {pct}%
    </span>
  );
}

export function RecordEditor({ record, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<PassportRecord | null>(record);
  const photoInput = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(record), [record]);

  async function onPhotoFile(file: File | undefined) {
    if (!file || !draft) return;
    const raw = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const photo = await shrinkImage(raw, 600);
    setDraft({ ...draft, photo });
  }

  return (
    <Dialog open={!!record} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Redakto të dhënat</DialogTitle>
        </DialogHeader>
        {draft && (
          <div className="grid gap-6 md:grid-cols-[200px_1fr]">
            <div className="space-y-3">
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                {draft.photo ? (
                  <img
                    src={draft.photo}
                    alt={`Fotografia e ${draft.nameSq || draft.nameEn || "personit"}`}
                    className="aspect-[35/45] w-full bg-card object-cover"
                  />
                ) : (
                  <div className="flex aspect-[35/45] items-center justify-center text-xs text-muted-foreground">
                    Pa foto
                  </div>
                )}
              </div>
              <input
                ref={photoInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void onPhotoFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => photoInput.current?.click()}
              >
                <Upload /> Ngarko foto
              </Button>
              {draft.thumbnail && (
                <img
                  src={draft.thumbnail}
                  alt="Pasaporta e plotë"
                  className="w-full rounded-xl border border-border object-cover"
                />
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => {
                const conf = draft.confidence?.[f.key as FieldKey];
                const raw = draft.rawText?.[f.key as FieldKey];
                return (
                  <div key={f.key} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={f.key}>{f.label}</Label>
                      <ConfidenceBadge value={conf} />
                    </div>
                    <Input
                      id={f.key}
                      type={f.type ?? "text"}
                      value={String(draft[f.key] ?? "")}
                      onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                      className={cn(
                        "rounded-xl",
                        conf !== undefined && conf < 0.6 && "border-destructive/60",
                      )}
                    />
                    {raw ? (
                      <p className="text-[11px] text-muted-foreground">
                        Lexuar nga fotoja:{" "}
                        <mark className="rounded bg-primary/15 px-1 py-0.5 font-mono text-foreground">
                          {raw}
                        </mark>
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" className="rounded-xl" onClick={onClose}>
            Anulo
          </Button>
          <Button className="rounded-xl" onClick={() => draft && onSave(draft)}>
            Ruaj
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
