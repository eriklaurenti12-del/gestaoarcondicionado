import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, FileDown, RefreshCw, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AuditRow = {
  id: string;
  user_id: string;
  event_type: string;
  record_id: string | null;
  details: any;
  created_at: string;
};

export default function AdminFinancialAuditTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("duplicate_blocked");
  const [days, setDays] = useState<number>(30);

  const load = async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      let q = supabase
        .from("financial_audit_log")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (eventFilter !== "all") q = q.eq("event_type", eventFilter);
      const { data, error } = await q;
      if (error) throw error;
      setRows((data as AuditRow[]) || []);
    } catch (e: any) {
      toast({ title: "Erro ao carregar auditoria", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [eventFilter, days]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => JSON.stringify(r.details || {}).toLowerCase().includes(q) || (r.record_id || "").includes(q) || r.user_id.includes(q));
  }, [rows, search]);

  const exportCsv = () => {
    const header = ["data", "evento", "user_id", "record_existente", "valor_tentado", "tipo", "categoria", "appointment_id", "sale_id", "descricao"];
    const lines = filtered.map((r) => {
      const d = r.details || {};
      return [
        new Date(r.created_at).toISOString(),
        r.event_type,
        r.user_id,
        r.record_id || "",
        String(d.attempted_amount ?? ""),
        d.attempted_type ?? "",
        d.attempted_category ?? "",
        d.attempted_appointment_id ?? "",
        d.attempted_sale_id ?? "",
        String(d.attempted_description ?? "").replace(/[;\n\r]/g, " "),
      ].join(";");
    });
    const csv = [header.join(";"), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-financeira-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const blocked = rows.filter((r) => r.event_type === "duplicate_blocked").length;

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4 text-amber-500" />
          Auditoria do Financeiro — Duplicatas Bloqueadas
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Toda tentativa de inserir um lançamento duplicado é bloqueada pelo banco e registrada aqui.
          Use para investigar reclamações de "valor errado" ou "lançamento sumiu".
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
          >
            <option value="duplicate_blocked">Duplicatas bloqueadas</option>
            <option value="all">Todos os eventos</option>
          </select>
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
            <option value={365}>Último ano</option>
          </select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-7 h-9"
              placeholder="Filtrar por descrição, id, valor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <FileDown className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="secondary">Total: {rows.length}</Badge>
          <Badge variant="destructive">Bloqueios: {blocked}</Badge>
          <Badge variant="outline">Exibindo: {filtered.length}</Badge>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="p-2">Data</th>
                <th className="p-2">Evento</th>
                <th className="p-2">Valor</th>
                <th className="p-2">Tipo</th>
                <th className="p-2">Origem</th>
                <th className="p-2">Descrição</th>
                <th className="p-2">Existente</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Carregando…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhum evento encontrado nesse período.</td></tr>
              )}
              {filtered.map((r) => {
                const d = r.details || {};
                const origin = d.attempted_appointment_id
                  ? `apt:${String(d.attempted_appointment_id).slice(0, 8)}`
                  : d.attempted_sale_id
                  ? `sale:${d.attempted_sale_id}`
                  : "manual";
                return (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                    <td className="p-2">
                      <Badge variant={r.event_type === "duplicate_blocked" ? "destructive" : "secondary"} className="text-[10px]">
                        {r.event_type}
                      </Badge>
                    </td>
                    <td className="p-2 font-mono">R$ {Number(d.attempted_amount || 0).toFixed(2)}</td>
                    <td className="p-2">{d.attempted_type || "-"}</td>
                    <td className="p-2 font-mono text-[10px]">{origin}</td>
                    <td className="p-2 max-w-[260px] truncate" title={d.attempted_description || ""}>
                      {d.attempted_description || "-"}
                    </td>
                    <td className="p-2 font-mono text-[10px]">{r.record_id ? r.record_id.slice(0, 8) : "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
