import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FINANCE_POPUP_VERSION } from "./FinanceiroUpdatePopup";

export default function FinanceLastRepairBadge() {
  const [when, setWhen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      const { data: rec } = await supabase
        .from("financial_reconciliation_log")
        .select("created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && rec?.created_at) setWhen(rec.created_at);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="outline" className="gap-1">
        <CheckCircle2 className="w-3 h-3 text-green-600" />
        Última correção automática:{" "}
        <b className="ml-1">
          {when ? format(new Date(when), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
        </b>
      </Badge>
      <Badge variant="secondary">v{FINANCE_POPUP_VERSION}</Badge>
    </div>
  );
}
