import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, LayoutDashboard, CalendarDays, Users, DollarSign,
  Package, ShoppingCart, TrendingUp, TrendingDown, Wallet,
  Search, Phone, MapPin, Clock, CheckCircle2, AlertCircle, Lock,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

type Props = {
  onBack: () => void;
  memberName: string;
  role: string;
  canAccess: (tab: string) => boolean;
  data: {
    todayAppointments: any[];
    pendingBookings: any[];
    clients: any[];
    financial: any[];
    products: any[];
    sales: any[];
    suppliers: any[];
    subscribers: any[];
  };
};

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function PortalFullSystemView({ onBack, memberName, role, canAccess, data }: Props) {
  const [tab, setTab] = useState("dashboard");
  const [clientSearch, setClientSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const totalReceitas = useMemo(
    () => (data.financial || []).filter(f => f.type === 'receita').reduce((s, f) => s + Number(f.amount || 0), 0)
      + (data.sales || []).reduce((s, r) => s + Number(r.sale_price || 0), 0),
    [data.financial, data.sales]
  );
  const totalDespesas = useMemo(
    () => (data.financial || []).filter(f => f.type === 'despesa').reduce((s, f) => s + Number(f.amount || 0), 0),
    [data.financial]
  );
  const totalLucro = useMemo(
    () => (data.sales || []).reduce((s, r) => s + Number(r.total_profit || 0), 0),
    [data.sales]
  );
  const saldo = totalReceitas - totalDespesas;

  // Monthly breakdown for chart (last 6 months)
  const monthlyData = useMemo(() => {
    const map: Record<string, { mes: string; receita: number; despesa: number }> = {};
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const k = format(d, 'yyyy-MM');
      map[k] = { mes: format(d, 'MMM/yy', { locale: ptBR }), receita: 0, despesa: 0 };
    }
    (data.sales || []).forEach(s => {
      const k = s.sale_date ? format(new Date(s.sale_date), 'yyyy-MM') : null;
      if (k && map[k]) map[k].receita += Number(s.sale_price || 0);
    });
    (data.financial || []).forEach(f => {
      const k = f.record_date ? format(new Date(f.record_date), 'yyyy-MM') : null;
      if (k && map[k]) {
        if (f.type === 'receita') map[k].receita += Number(f.amount || 0);
        else if (f.type === 'despesa') map[k].despesa += Number(f.amount || 0);
      }
    });
    return Object.values(map);
  }, [data.financial, data.sales]);

  // Payment method breakdown
  const paymentData = useMemo(() => {
    const map: Record<string, number> = {};
    (data.sales || []).forEach(s => {
      const k = s.payment_method || 'Outro';
      map[k] = (map[k] || 0) + Number(s.sale_price || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [data.sales]);

  const filteredClients = (data.clients || []).filter(c =>
    !clientSearch || c.name?.toLowerCase().includes(clientSearch.toLowerCase()) || c.telefone?.includes(clientSearch)
  );
  const filteredProducts = (data.products || []).filter(p =>
    !productSearch || p.name?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const lockedSection = (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-6 text-center">
        <Lock className="w-10 h-10 mx-auto mb-2 text-amber-500" />
        <p className="font-medium">Acesso restrito</p>
        <p className="text-xs text-muted-foreground mt-1">Você não tem permissão para esta área. Solicite ao administrador.</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* Header — visual de "sistema completo" */}
      <div className="bg-gradient-to-r from-primary via-primary to-primary/70 text-primary-foreground sticky top-0 z-20 shadow-lg">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button size="icon" variant="ghost" onClick={onBack} className="text-primary-foreground hover:bg-primary-foreground/20 h-9 w-9 shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="font-bold text-base sm:text-lg truncate flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                Sistema Completo
              </h1>
              <p className="text-[11px] sm:text-xs opacity-80 truncate">{memberName} • visão {role} (somente leitura)</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-primary-foreground/15 text-primary-foreground border-primary-foreground/30 text-[10px] shrink-0">
            👁 leitura
          </Badge>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-3 sm:p-4 space-y-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full grid grid-cols-3 sm:grid-cols-6 h-auto gap-1 p-1">
            <TabsTrigger value="dashboard" className="text-[11px] gap-1 py-2"><LayoutDashboard className="w-3.5 h-3.5" />Dashboard</TabsTrigger>
            <TabsTrigger value="agenda" className="text-[11px] gap-1 py-2"><CalendarDays className="w-3.5 h-3.5" />Agenda</TabsTrigger>
            <TabsTrigger value="clientes" className="text-[11px] gap-1 py-2"><Users className="w-3.5 h-3.5" />Clientes</TabsTrigger>
            <TabsTrigger value="financeiro" className="text-[11px] gap-1 py-2"><DollarSign className="w-3.5 h-3.5" />Financeiro</TabsTrigger>
            <TabsTrigger value="produtos" className="text-[11px] gap-1 py-2"><Package className="w-3.5 h-3.5" />Estoque</TabsTrigger>
            <TabsTrigger value="vendas" className="text-[11px] gap-1 py-2"><ShoppingCart className="w-3.5 h-3.5" />Vendas</TabsTrigger>
          </TabsList>

          {/* DASHBOARD */}
          <TabsContent value="dashboard" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              <Card className="border-green-500/30 bg-green-500/5">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Receitas</p>
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  </div>
                  <p className="text-lg font-bold text-green-500">R$ {totalReceitas.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card className="border-red-500/30 bg-red-500/5">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Despesas</p>
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  </div>
                  <p className="text-lg font-bold text-red-500">R$ {totalDespesas.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Saldo</p>
                    <Wallet className="w-4 h-4 text-primary" />
                  </div>
                  <p className={`text-lg font-bold ${saldo >= 0 ? 'text-primary' : 'text-red-500'}`}>R$ {saldo.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card className="border-emerald-500/30 bg-emerald-500/5">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Lucro</p>
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="text-lg font-bold text-emerald-500">R$ {totalLucro.toFixed(2)}</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Receita x Despesa (6 meses)</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                        <Bar dataKey="receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="despesa" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Vendas por Pagamento</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-[220px]">
                    {paymentData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={paymentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(e: any) => `${e.name}`}>
                            {paymentData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem vendas no período</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Card><CardContent className="p-3 text-center"><Users className="w-4 h-4 mx-auto mb-1 text-primary" /><div className="text-xl font-bold">{data.clients?.length || 0}</div><div className="text-[10px] text-muted-foreground">Clientes</div></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><Package className="w-4 h-4 mx-auto mb-1 text-amber-500" /><div className="text-xl font-bold">{data.products?.length || 0}</div><div className="text-[10px] text-muted-foreground">Produtos</div></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><CalendarDays className="w-4 h-4 mx-auto mb-1 text-cyan-500" /><div className="text-xl font-bold">{data.todayAppointments?.length || 0}</div><div className="text-[10px] text-muted-foreground">Agend. hoje/amanhã</div></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><ShoppingCart className="w-4 h-4 mx-auto mb-1 text-emerald-500" /><div className="text-xl font-bold">{data.sales?.length || 0}</div><div className="text-[10px] text-muted-foreground">Vendas</div></CardContent></Card>
            </div>
          </TabsContent>

          {/* AGENDA */}
          <TabsContent value="agenda" className="mt-4 space-y-2">
            {!canAccess('agenda') ? lockedSection : (
              <>
                <p className="text-xs text-muted-foreground px-1">{data.todayAppointments.length} agendamento(s) — hoje e amanhã</p>
                {data.todayAppointments.length === 0 ? (
                  <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">Nenhum agendamento</CardContent></Card>
                ) : data.todayAppointments.map((a: any) => (
                  <Card key={a.id} className="border-l-4 border-l-primary">
                    <CardContent className="p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm truncate">{a.client_name || 'Cliente'}</p>
                        <Badge variant={a.status === 'concluido' ? 'default' : 'outline'} className="text-[10px]">{a.status}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{a.time || '-'}</span>
                        {a.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{a.phone}</span>}
                        {a.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{a.address}</span>}
                      </div>
                      {a.notes && <p className="text-xs text-muted-foreground italic">{a.notes}</p>}
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>

          {/* CLIENTES */}
          <TabsContent value="clientes" className="mt-4 space-y-2">
            {!canAccess('cadastros') ? lockedSection : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Buscar cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="pl-10" />
                </div>
                <p className="text-xs text-muted-foreground px-1">{filteredClients.length} de {data.clients.length} cliente(s)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {filteredClients.slice(0, 100).map((c: any) => (
                    <Card key={c.id}>
                      <CardContent className="p-3">
                        <p className="font-semibold text-sm">{c.name}</p>
                        <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                          {c.telefone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.telefone}</p>}
                          {c.address && <p className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.address}</p>}
                          {c.email && <p className="truncate">{c.email}</p>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* FINANCEIRO */}
          <TabsContent value="financeiro" className="mt-4 space-y-2">
            {!canAccess('financeiro') ? lockedSection : (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Card className="border-green-500/30"><CardContent className="p-2 text-center"><p className="text-[10px] text-muted-foreground">Receitas</p><p className="text-sm font-bold text-green-500">R$ {totalReceitas.toFixed(2)}</p></CardContent></Card>
                  <Card className="border-red-500/30"><CardContent className="p-2 text-center"><p className="text-[10px] text-muted-foreground">Despesas</p><p className="text-sm font-bold text-red-500">R$ {totalDespesas.toFixed(2)}</p></CardContent></Card>
                  <Card className="border-primary/30"><CardContent className="p-2 text-center"><p className="text-[10px] text-muted-foreground">Saldo</p><p className={`text-sm font-bold ${saldo >= 0 ? 'text-primary' : 'text-red-500'}`}>R$ {saldo.toFixed(2)}</p></CardContent></Card>
                </div>
                <p className="text-xs text-muted-foreground px-1">{data.financial.length} lançamento(s)</p>
                {data.financial.slice(0, 50).map((f: any) => (
                  <Card key={f.id} className={`border-l-4 ${f.type === 'receita' ? 'border-l-green-500' : 'border-l-red-500'}`}>
                    <CardContent className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{f.description || f.category || '—'}</p>
                        <p className="text-[11px] text-muted-foreground">{f.record_date ? format(new Date(f.record_date), 'dd/MM/yyyy') : '-'} • {f.payment_method || ''}</p>
                      </div>
                      <p className={`font-bold text-sm whitespace-nowrap ${f.type === 'receita' ? 'text-green-500' : 'text-red-500'}`}>
                        {f.type === 'receita' ? '+' : '-'} R$ {Number(f.amount || 0).toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>

          {/* PRODUTOS / ESTOQUE */}
          <TabsContent value="produtos" className="mt-4 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar produto..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pl-10" />
            </div>
            <p className="text-xs text-muted-foreground px-1">{filteredProducts.length} produto(s)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {filteredProducts.slice(0, 100).map((p: any) => {
                const lowStock = p.type !== 'service' && p.qty != null && p.min_stock != null && p.qty <= p.min_stock;
                return (
                  <Card key={p.id} className={lowStock ? 'border-amber-500/40' : ''}>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm flex-1">{p.name}</p>
                        {lowStock && <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />}
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className="text-muted-foreground">{p.type === 'service' ? 'Serviço' : `Estoque: ${p.qty ?? 0}`}</span>
                        <span className="font-bold text-primary">R$ {Number(p.price || 0).toFixed(2)}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* VENDAS */}
          <TabsContent value="vendas" className="mt-4 space-y-2">
            {!canAccess('vendas') ? lockedSection : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Card className="border-green-500/30"><CardContent className="p-2 text-center"><p className="text-[10px] text-muted-foreground">Faturamento</p><p className="text-sm font-bold text-green-500">R$ {(data.sales || []).reduce((s, r) => s + Number(r.sale_price || 0), 0).toFixed(2)}</p></CardContent></Card>
                  <Card className="border-emerald-500/30"><CardContent className="p-2 text-center"><p className="text-[10px] text-muted-foreground">Lucro</p><p className="text-sm font-bold text-emerald-500">R$ {totalLucro.toFixed(2)}</p></CardContent></Card>
                </div>
                {data.sales.slice(0, 100).map((s: any) => (
                  <Card key={s.id} className="border-l-4 border-l-emerald-500">
                    <CardContent className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{s.products?.name || `Venda #${s.id}`}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {s.sale_date ? format(new Date(s.sale_date), 'dd/MM/yyyy HH:mm') : '-'} • {s.payment_method || '-'} • Qtd: {s.qty || 1}
                        </p>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <p className="font-bold text-sm text-green-500">R$ {Number(s.sale_price || 0).toFixed(2)}</p>
                        <p className="text-[10px] text-emerald-500">Lucro: R$ {Number(s.total_profit || 0).toFixed(2)}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}
          </TabsContent>
        </Tabs>

        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-3 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground">
              Esta é uma <strong>visão de leitura</strong> do sistema completo. Para criar/editar registros, use as abas operacionais do Portal.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
