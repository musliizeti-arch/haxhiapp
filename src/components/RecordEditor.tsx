import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { FieldKey, PassportRecord } from "@/lib/passport-store";

type Props = {
  record: PassportRecord | null;
  onClose: () => void;
  onSave: (record: PassportRecord) => void;
};

const fields: { key: FieldKey; label: string; type?: string }[] = [
  { key: "nameEn", label: "Emri (Anglisht)" },
  { key: "nameSq", label: "Emri (Shqip)" },
  { key: "nameMk", label: "Emri (Maqedonisht)" },
  { key: "passportNumber", label: "Nr. i pasaportës" },
  { key: "issueDate", label: "Data e lëshimit", type: "date" },
  { key: "expiryDate", label: "Data e skadimit", type: "date" },
  { key: "nationality", label: "Shtetësia" },
  { key: "birthDate", label: "Datëlindja", type: "date" },
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
  useEffect(() => setDraft(record), [record]);

  return (
    <Dialog open={!!record} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Redakto të dhënat</DialogTitle>
        </DialogHeader>
        {draft && (
          <div className="grid gap-5 sm:grid-cols-2">
            {fields.map((f) => {
              const conf = draft.confidence?.[f.key];
              const raw = draft.rawText?.[f.key];
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
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Anulo
          </Button>
          <Button onClick={() => draft && onSave(draft)}>Ruaj</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
