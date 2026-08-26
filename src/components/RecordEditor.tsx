import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PassportRecord } from "@/lib/passport-store";

type Props = {
  record: PassportRecord | null;
  onClose: () => void;
  onSave: (record: PassportRecord) => void;
};

const fields: { key: keyof PassportRecord; label: string; type?: string }[] = [
  { key: "nameEn", label: "Emri (Anglisht)" },
  { key: "nameSq", label: "Emri (Shqip)" },
  { key: "nameMk", label: "Emri (Maqedonisht)" },
  { key: "passportNumber", label: "Nr. i pasaportës" },
  { key: "issueDate", label: "Data e lëshimit", type: "date" },
  { key: "expiryDate", label: "Data e skadimit", type: "date" },
  { key: "nationality", label: "Shtetësia" },
  { key: "birthDate", label: "Datëlindja", type: "date" },
];

export function RecordEditor({ record, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<PassportRecord | null>(record);
  useEffect(() => setDraft(record), [record]);

  return (
    <Dialog open={!!record} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Redakto të dhënat</DialogTitle>
        </DialogHeader>
        {draft && (
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key}>{f.label}</Label>
                <Input
                  id={f.key}
                  type={f.type ?? "text"}
                  value={String(draft[f.key] ?? "")}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                />
              </div>
            ))}
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
