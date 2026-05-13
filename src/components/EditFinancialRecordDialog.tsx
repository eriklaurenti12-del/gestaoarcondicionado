import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Pencil } from "lucide-react";

interface RecordLite {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  payment_method: string | null;
  category: string | null;
  record_date: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  record: RecordLite | null;
  onSaved: () => void;
}

export default function EditFinancialRecordDialog({ open, onOpenChange, record, onSaved }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    description: "", amount: "", payment_method: "", category: "", record_date: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && record) {
      setForm({
        description: record.description || "",
        amount: String(record.amount ?? ""),
        payment_method: record.payment_method || "",
        category: record.category || "",
        record_date: record.record_date ? record.record_date.slice(0, 10) : "",
      });
    }
  }, [open, record]);

  const save = async () => {
    if (!record) return;
    const amountNum = Number(form.amount);
    if (!isFinite(amountNum) || amountNum <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" }); return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("financial_records").update({
        description: form.description || null,
        amount: amountNum,
        payment_method: form.payment_method || null,
        category: form.category || null,
        record_date: form.record_date ? new Date(form.record_date).toISOString() : record.record_date,
      }).eq("id", record.id);
      if (error) throw error;
      toast({ title: "Lançamento atualizado!" });
      onSaved(); onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao editar", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" /> Editar lançamento
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Pagamento</Label>
              <Select value={form.payment_method || "none"} onValueChange={(v) => setForm({ ...form, payment_method: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex.: Serviço, Contrato..." />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
