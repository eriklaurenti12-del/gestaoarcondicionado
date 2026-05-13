import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { listTrash, removeTrash, restoreTrashItem, type TrashItem } from "@/utils/financialTrash";
import { useToast } from "@/hooks/use-toast";
import { Trash2, RotateCcw, Receipt } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FinancialTrashDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
  onRestored: () => void;
}

const fmtMoney = (n?: number) =>
  typeof n === "number" ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-";

export default function FinancialTrashDialog({ open, onOpenChange, userId, onRestored }: FinancialTrashDialogProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => { if (userId) setItems(listTrash(userId)); };
  useEffect(() => { if (open) refresh(); }, [open, userId]);

  const handleRestore = async (it: TrashItem) => {
    setBusy(it.id);
    try {
      await restoreTrashItem(it);
      toast({ title: "Restaurado!", description: it.summary.title });
      refresh(); onRestored();
    } catch (e: any) {
      toast({ title: "Erro ao restaurar", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const handlePurge = (it: TrashItem) => {
    if (!window.confirm("Remover permanentemente da lixeira? Não poderá mais restaurar.")) return;
    removeTrash(it.id); refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" /> Lixeira do Financeiro
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Itens excluídos nos últimos 30 dias. Restaure se foi engano ou apague de vez.
        </p>
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Receipt className="h-10 w-10 mx-auto mb-2 opacity-40" />
            Nada na lixeira.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className="border rounded-md p-3 flex items-start justify-between gap-3 hover:bg-muted/40">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{it.summary.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {it.type === "sale" ? "Venda/serviço" : "Lançamento"} ·{" "}
                    {fmtMoney(it.summary.amount)} ·{" "}
                    excluído {format(new Date(it.deletedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                  {it.reason && <p className="text-[11px] mt-1 italic text-amber-700">Motivo: {it.reason}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="outline" disabled={busy === it.id} onClick={() => handleRestore(it)}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handlePurge(it)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Apagar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
