import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Loader2, AlertTriangle, CheckCircle2, RefreshCw, Trash2, Activity, Search, Wrench, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { recordFinancialEntry } from '@/utils/financialHelpers';
import { reconcileFinancialMonth, repairMissingFinancialRecords, type RepairResult } from '@/utils/recurringSync';

const formatBRL = (v: number) => `R$ ${(Number(v) || 0).toFixed(2)}`;

export default function FinanceiroReconciliationTab() {
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const [busy, setBusy] = useState(false);
  const [repairResult, setRepairResult] = useState<RepairResult | null>(null);
  const [repairing, setRepairing] = useState(false);
  const autoRepairRan = useRef(false);

  const monthStart = `${selectedMonth}-01`;
  const monthEndDate = (() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return new Date(y, m, 0).toISOString().split('T')[0];
  })();

  // Sales do mês
  const { data: sales, refetch: refetchSales } = useQuery({
    queryKey: ['recon-sales', selectedMonth],
    queryFn: async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return [];
      const { data, error } = await supabase
        .from('sales')
        .select('id, sale_price, qty, sale_date, payment_method, product_id, products(name)')
        .gte('sale_date', monthStart)
        .lte('sale_date', monthEndDate + 'T23:59:59');
      if (error) throw error;
      return data || [];
    },
  });

  // Financial records do mês
  const { data: records, refetch: refetchRecords } = useQuery({
    queryKey: ['recon-records', selectedMonth],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('financial_records')
        .select('id, type, category, amount, description, record_date, sale_id, appointment_id')
        .gte('record_date', monthStart)
        .lte('record_date', monthEndDate + 'T23:59:59');
      if (error) throw error;
      return data || [];
    },
  });

  // Audit log
  const { data: auditLog, refetch: refetchAudit } = useQuery({
    queryKey: ['recon-audit', selectedMonth],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('financial_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Vendas órfãs (sale sem financial_record)
  const orphanSales = (sales || []).filter((s: any) => {
    return !(records || []).some((r: any) => r.sale_id === s.id);
  });

  // Records órfãos (financial_record com sale_id apontando para sale inexistente)
  const orphanRecords = (records || []).filter((r: any) => {
    if (!r.sale_id) return false;
    return !(sales || []).some((s: any) => s.id === r.sale_id);
  });

  // Duplicatas suspeitas (mesmo type + amount + descrição similar no mesmo dia)
  const duplicates: any[] = [];
  const seen = new Map<string, any[]>();
  (records || []).forEach((r: any) => {
    const key = `${r.type}|${r.amount}|${(r.description || '').toLowerCase().slice(0, 40)}|${r.record_date.slice(0, 10)}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(r);
  });
  seen.forEach((arr) => {
    if (arr.length > 1) duplicates.push(...arr.slice(1));
  });

  // Totais por categoria
  const byCategory = new Map<string, { fr: number; sales: number }>();
  (records || []).filter((r: any) => r.type === 'entrada').forEach((r: any) => {
    const cat = (r.category || 'sem-categoria').toString();
    if (!byCategory.has(cat)) byCategory.set(cat, { fr: 0, sales: 0 });
    byCategory.get(cat)!.fr += Number(r.amount);
  });
  const totalSales = (sales || []).reduce((acc: number, s: any) => acc + Number(s.sale_price) * Number(s.qty || 1), 0);
  if (totalSales > 0) {
    if (!byCategory.has('Produto/Serviço (PDV)')) byCategory.set('Produto/Serviço (PDV)', { fr: 0, sales: 0 });
    byCategory.get('Produto/Serviço (PDV)')!.sales = totalSales;
  }

  const refreshAll = async () => {
    await Promise.all([refetchSales(), refetchRecords(), refetchAudit()]);
  };

  const handleSyncOrphanSale = async (sale: any) => {
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return;
      const r = await recordFinancialEntry({
        userId: sess.session.user.id,
        type: 'entrada',
        amount: Number(sale.sale_price) * Number(sale.qty || 1),
        description: `Venda PDV: ${sale.products?.name || 'item'} (${sale.qty}x) [sync conciliação]`,
        paymentMethod: sale.payment_method || 'Dinheiro',
        category: 'Produto',
        recordDate: sale.sale_date,
        saleId: sale.id,
      });
      if (r.skipped) {
        toast({ title: 'Já estava sincronizada', description: 'Lançamento equivalente detectado.' });
      } else {
        toast({ title: '✅ Venda sincronizada' });
      }
      await refreshAll();
    } catch (e: any) {
      toast({ title: 'Erro ao sincronizar', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveDuplicate = async (id: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from('financial_records').delete().eq('id', id);
      if (error) throw error;
      toast({ title: '🗑️ Duplicata removida' });
      await refreshAll();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleFullReconcile = async () => {
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return;
      const result = await reconcileFinancialMonth(sess.session.user.id, selectedMonth, 'manual');
      toast({
        title: '🔄 Conciliação executada',
        description: `${result.dupRecords + result.dupSales + result.orphanRecords + result.orphanSales} item(ns) ajustado(s).`,
      });
      await refreshAll();
    } catch (e: any) {
      toast({ title: 'Erro na conciliação', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleRepair = async (silent = false) => {
    setRepairing(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return;
      const result = await repairMissingFinancialRecords(sess.session.user.id);
      setRepairResult(result);
      const total = result.appointmentsRepaired + result.salesRepaired;
      if (!silent || total > 0) {
        toast({
          title: total > 0 ? '🛠️ Reparo concluído' : 'Nada a reparar',
          description: total > 0
            ? `${result.appointmentsRepaired} agendamento(s) e ${result.salesRepaired} venda(s) reparados.`
            : 'Todos os agendamentos concluídos e vendas já têm lançamento.',
        });
      }
      await refreshAll();
    } catch (e: any) {
      if (!silent) toast({ title: 'Erro no reparo', description: e.message, variant: 'destructive' });
    } finally {
      setRepairing(false);
    }
  };

  // Auto-reparo: roda 1x por sessão ao montar
  useEffect(() => {
    if (autoRepairRan.current) return;
    autoRepairRan.current = true;
    handleRepair(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalIssues = orphanSales.length + orphanRecords.length + duplicates.length;
  const repairTotal = (repairResult?.appointmentsRepaired || 0) + (repairResult?.salesRepaired || 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-44"
        />
        <Button variant="outline" onClick={refreshAll} disabled={busy || repairing} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
        <Button onClick={() => handleRepair(false)} disabled={busy || repairing} variant="secondary" className="gap-2">
          {repairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
          Reparar lançamentos faltantes
        </Button>
        <Button onClick={handleFullReconcile} disabled={busy || repairing} className="gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
          Reconciliar mês
        </Button>
      </div>

      {/* Resumo do reparo automático */}
      {repairResult && (
        <Card className={repairTotal > 0 ? 'border-blue-500/40 bg-blue-500/5' : 'border-green-500/30 bg-green-500/5'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-500" />
              {repairTotal > 0 ? 'Reparo automático aplicado' : 'Reparo automático — sem pendências'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="rounded-lg border p-2">
                <div className="text-xs text-muted-foreground">Agendamentos reparados</div>
                <div className="text-xl font-bold">{repairResult.appointmentsRepaired}</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="text-xs text-muted-foreground">Vendas reparadas</div>
                <div className="text-xl font-bold">{repairResult.salesRepaired}</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="text-xs text-muted-foreground">Ignorados (já ok)</div>
                <div className="text-xl font-bold">{repairResult.skipped}</div>
              </div>
              <div className="rounded-lg border p-2">
                <div className="text-xs text-muted-foreground">Erros</div>
                <div className={`text-xl font-bold ${repairResult.errors > 0 ? 'text-red-500' : ''}`}>{repairResult.errors}</div>
              </div>
            </div>
            {repairTotal > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Ver detalhes dos {repairTotal} lançamento(s) criado(s)
                </summary>
                <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
                  {repairResult.details.appointmentRows.map((r) => (
                    <div key={r.appointment_id} className="flex justify-between border-b border-border/40 py-1">
                      <span className="truncate">📅 {r.description}</span>
                      <span className="font-mono">{formatBRL(r.amount)}</span>
                    </div>
                  ))}
                  {repairResult.details.saleRows.map((r) => (
                    <div key={r.sale_id} className="flex justify-between border-b border-border/40 py-1">
                      <span className="truncate">🛒 {r.description}</span>
                      <span className="font-mono">{formatBRL(r.amount)}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className={orphanSales.length === 0 ? 'border-green-500/30' : 'border-amber-500/40'}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              {orphanSales.length === 0 ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
              Vendas sem registro financeiro
            </div>
            <div className="text-2xl font-bold mt-1">{orphanSales.length}</div>
          </CardContent>
        </Card>
        <Card className={orphanRecords.length === 0 ? 'border-green-500/30' : 'border-red-500/40'}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              {orphanRecords.length === 0 ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
              Registros órfãos
            </div>
            <div className="text-2xl font-bold mt-1">{orphanRecords.length}</div>
          </CardContent>
        </Card>
        <Card className={duplicates.length === 0 ? 'border-green-500/30' : 'border-red-500/40'}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              {duplicates.length === 0 ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
              Duplicatas suspeitas
            </div>
            <div className="text-2xl font-bold mt-1">{duplicates.length}</div>
          </CardContent>
        </Card>
      </div>

      {totalIssues === 0 && (
        <Card className="border-green-500/40 bg-green-500/5">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-2" />
            <p className="font-semibold">Tudo conciliado neste mês 🎉</p>
            <p className="text-xs text-muted-foreground">Vendas, registros financeiros e gastos batem.</p>
          </CardContent>
        </Card>
      )}

      {/* Vendas órfãs */}
      {orphanSales.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Vendas no PDV sem lançamento financeiro ({orphanSales.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orphanSales.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell>{format(new Date(s.sale_date), 'dd/MM HH:mm')}</TableCell>
                    <TableCell>{s.products?.name || '—'}</TableCell>
                    <TableCell className="text-right">{formatBRL(Number(s.sale_price) * Number(s.qty || 1))}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => handleSyncOrphanSale(s)} disabled={busy} className="gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5" /> Sincronizar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Duplicatas */}
      {duplicates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              Lançamentos duplicados ({duplicates.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {duplicates.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{format(new Date(r.record_date), 'dd/MM HH:mm')}</TableCell>
                    <TableCell><Badge variant="outline">{r.type}</Badge></TableCell>
                    <TableCell className="max-w-xs truncate">{r.description}</TableCell>
                    <TableCell className="text-right">{formatBRL(r.amount)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="destructive" onClick={() => handleRemoveDuplicate(r.id)} disabled={busy} className="gap-1.5">
                        <Trash2 className="w-3.5 h-3.5" /> Remover
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Totais por categoria */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-4 h-4" /> Totais por categoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Financial Records</TableHead>
                <TableHead className="text-right">Sales (PDV)</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(byCategory.entries()).map(([cat, vals]) => {
                const diff = vals.fr - vals.sales;
                return (
                  <TableRow key={cat}>
                    <TableCell className="font-medium">{cat}</TableCell>
                    <TableCell className="text-right">{formatBRL(vals.fr)}</TableCell>
                    <TableCell className="text-right">{formatBRL(vals.sales)}</TableCell>
                    <TableCell className={`text-right ${Math.abs(diff) > 0.01 ? 'text-amber-600 font-semibold' : 'text-green-600'}`}>
                      {formatBRL(diff)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Audit log */}
      {auditLog && auditLog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4" /> Últimas ações do rastreador (50)
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-96 overflow-y-auto">
            <div className="space-y-1.5">
              {auditLog.map((log: any) => (
                <div key={log.id} className="flex items-start gap-2 text-xs border-b border-border/40 pb-1.5">
                  <Badge variant={log.event_type === 'duplicate_blocked' ? 'destructive' : 'outline'} className="text-[10px]">
                    {log.event_type}
                  </Badge>
                  <span className="text-muted-foreground">{format(new Date(log.created_at), 'dd/MM HH:mm:ss')}</span>
                  <span className="flex-1 truncate">{JSON.stringify(log.details)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
