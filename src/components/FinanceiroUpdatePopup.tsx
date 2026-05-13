import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Sparkles, Wrench } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// IMPORTANT: bump this whenever you ship a new financial fix the user must see.
export const FINANCE_POPUP_VERSION = "2026-05-13.2";

const NOTES = [
  "Nova etiqueta Origem em cada lançamento: Auto (vem de agendamento/PDV/contrato) ou Manual (digitado por você).",
  "Filtro Todos / Manuais / Automáticos no topo da tabela para enxergar separado o que entrou sozinho.",
  "Tooltip detalhado no badge mostra de onde veio o lançamento e se está vinculado a agendamento ou venda.",
  "Botão Ocultar legenda ao lado da Ajuda — sua preferência agora é salva por usuário (não mistura entre dispositivos compartilhados).",
  "Reparo automático e anti-duplicata continuam ativos: nada é duplicado mesmo rodando várias vezes.",
];

const STEPS = [
  "Confirme o mês selecionado no topo do Financeiro.",
  "Use o filtro Todos / Manuais / Automáticos para revisar cada origem.",
  "Passe o mouse no badge Auto/Manual para ver o detalhe da origem.",
  "Se quiser interface mais limpa, clique em Ocultar legenda — sua escolha fica salva no seu usuário.",
];

interface RecentRecon {
  created_at: string;
  inserted_recurring: number;
  dup_records: number;
  dup_sales: number;
  orphan_sales: number;
  orphan_records: number;
  triggered_by: string;
}

export default function FinanceiroUpdatePopup() {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentRecon | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      setUserId(uid);
      const flag = `finance_popup_${FINANCE_POPUP_VERSION}_${uid}`;
      if (localStorage.getItem(flag)) return;

      const { data: rec } = await supabase
        .from("financial_reconciliation_log")
        .select("created_at,inserted_recurring,dup_records,dup_sales,orphan_sales,orphan_records,triggered_by")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        if (rec) setRecent(rec as RecentRecon);
        setOpen(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const dismiss = () => {
    if (userId) {
      localStorage.setItem(`finance_popup_${FINANCE_POPUP_VERSION}_${userId}`, "1");
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Financeiro foi atualizado
            <Badge variant="secondary" className="ml-1">v{FINANCE_POPUP_VERSION}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {recent && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Última reconciliação:{" "}
                {format(new Date(recent.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                <Badge variant="outline" className="ml-auto text-xs capitalize">{recent.triggered_by}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>🔁 Recorrentes inseridos: <b>{recent.inserted_recurring}</b></span>
                <span>🗑️ Duplicados removidos: <b>{recent.dup_records + recent.dup_sales}</b></span>
                <span>🔗 Vendas órfãs: <b>{recent.orphan_sales}</b></span>
                <span>🧹 Manuais órfãos: <b>{recent.orphan_records}</b></span>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 font-medium mb-2">
              <Wrench className="w-4 h-4 text-blue-600" />
              O que foi corrigido
            </div>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              {NOTES.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>

          <div>
            <div className="flex items-center gap-2 font-medium mb-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              O que você deve fazer agora
            </div>
            <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
              {STEPS.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={dismiss} className="w-full sm:w-auto">Entendi, não mostrar mais</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
