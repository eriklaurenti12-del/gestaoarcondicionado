import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { listTrash, removeTrash, restoreTrashItem, clearAllTrash, purgePreviousMonths, type TrashItem } from "@/utils/financialTrash";
import { useToast } from "@/hooks/use-toast";
import { Trash2, RotateCcw, Receipt } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const POST_DELETE_KEY = "fin_open_trash_after_delete";

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
  const [autoOpen, setAutoOpen] = useState<boolean>(() => {
    try { return (localStorage.getItem(POST_DELETE_KEY) ?? "1") === "1"; } catch { return true; }
  });

  const refresh = () => { if (userId) setItems(listTrash(userId)); };
  useEffect(() => { if (open) refresh(); }, [open, userId]);

  const toggleAutoOpen = (v: boolean) => {
    setAutoOpen(v);
    try { localStorage.setItem(POST_DELETE_KEY, v ? "1" : "0"); } catch {}
  };

  const handleRestore = async (it: TrashItem) => {
    setBusy(it.id);
    try {
      await restoreTrashItem(it);
      toast({ title: "Restaurado!", description: `${it.summary.title} voltou com os valores originais.` });
      refresh();
      onRestored();
    } catch (e: any) {
      toast({ title: "Erro ao restaurar", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const handleRestoreAll = async () => {
    if (items.length === 0) return;
    if (!window.confirm(`Restaurar ${items.length} item(ns) da lixeira?`)) return;
    let ok = 0, fail = 0;
    for (const it of items) {
      try { await restoreTrashItem(it); ok++; } catch { fail++; }
    }
    toast({ title: `${ok} restaurado(s)`, description: fail ? `${fail} falharam.` : "Tudo de volta na lista." });
    refresh(); onRestored();
  };

  const handlePurge = (it: TrashItem) => {
    if (!window.confirm("Remover permanentemente da lixeira? Não poderá mais restaurar.")) return;
    removeTrash(it.id); refresh();
  };

  const handleClearAll = () => {
    if (!userId || items.length === 0) return;
    if (!window.confirm(`Apagar PERMANENTEMENTE os ${items.length} item(ns) da lixeira? Esta ação NÃO pode ser desfeita.`)) return;
    clearAllTrash(userId);
    toast({ title: "Lixeira esvaziada", description: "Todos os itens foram removidos definitivamente." });
    refresh();
  };

  const handlePurgeOldMonths = () => {
    if (!userId) return;
    const before = items.length;
    purgePreviousMonths(userId);
    refresh();
    const after = (userId ? listTrash(userId) : []).length;
    toast({ title: "Limpeza de meses anteriores", description: `${before - after} item(ns) removido(s) permanentemente.` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-500" /> Lixeira do Financeiro
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap border rounded-md p-2 bg-muted/30">
          <div className="flex items-center gap-2">
            <Switch id="auto-open-trash" checked={autoOpen} onCheckedChange={toggleAutoOpen} />
            <Label htmlFor="auto-open-trash" className="text-xs cursor-pointer">
              Abrir Lixeira automaticamente após excluir
            </Label>
          </div>
          {items.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="outline" onClick={handleRestoreAll}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restaurar todos ({items.length})
              </Button>
              <Button size="sm" variant="outline" onClick={handlePurgeOldMonths} title="Apaga apenas itens de meses anteriores">
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Limpar meses anteriores
              </Button>
              <Button size="sm" variant="destructive" onClick={handleClearAll}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Esvaziar tudo
              </Button>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Itens excluídos nos últimos 30 dias (auto-expiram). Restaure se foi engano, ou esvazie permanentemente.
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
