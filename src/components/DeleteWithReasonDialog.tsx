import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";

interface DeleteWithReasonDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: (reason: string) => Promise<void> | void;
}

export default function DeleteWithReasonDialog({
  open, onOpenChange, title, description, confirmLabel = "Excluir", onConfirm,
}: DeleteWithReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setReason(""); setBusy(false); } }, [open]);

  const handleConfirm = async () => {
    setBusy(true);
    try { await onConfirm(reason.trim()); onOpenChange(false); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" /> {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          <div className="space-y-1">
            <Label className="text-xs">Motivo da exclusão (opcional)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: cliente cancelou, lançamento duplicado, valor errado..."
              rows={3}
              maxLength={300}
            />
            <p className="text-[10px] text-muted-foreground">
              Você pode desfazer logo após a exclusão (8s) ou restaurar pela Lixeira nos próximos 30 dias.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={busy}>{busy ? "Excluindo..." : confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
