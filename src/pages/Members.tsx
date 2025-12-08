import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Search, Mail, Shield, Ban, UserX, Trash2 } from "lucide-react";
import { format } from "date-fns";

type Member = {
  id: string;
  email: string;
  created_at: string;
  subscription: {
    plan: string;
    status: string;
    is_active: boolean;
    start_date: string | null;
    end_date: string | null;
  } | null;
};

export default function Members() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    checkSuperAdmin();
    loadMembers();
  }, []);

  const checkSuperAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email !== 'eriklaurenti09@gmail.com') {
      navigate("/");
      return;
    }
    setIsSuperAdmin(true);
  };

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-members', { body: {} });
      if (error) throw error;
      setMembers((data as Member[]) || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar usuários",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSubscription = async (targetUserId: string, plan: string, status: string) => {
    try {
      const startDate = new Date();
      let endDate: Date | null = null;

      if (plan !== 'vitalicio') {
        endDate = new Date();
        if (plan === 'anual') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        } else if (plan === 'trimestral') {
          endDate.setMonth(endDate.getMonth() + 3);
        } else if (plan === '1dia') {
          endDate.setDate(endDate.getDate() + 1);
        } else {
          endDate.setMonth(endDate.getMonth() + 1);
        }
      }

      const { data, error } = await supabase.functions.invoke('admin-update-subscription', {
        body: {
          target_user_id: targetUserId,
          plan,
          status,
          is_active: status === 'aprovado',
          start_date: startDate.toISOString(),
          end_date: endDate?.toISOString() || null,
          payment_date: status === 'aprovado' ? startDate.toISOString() : null
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Sucesso!",
        description: status === 'aprovado' 
          ? "Acesso liberado! O usuário já pode acessar o sistema."
          : "Assinatura atualizada."
      });

      await loadMembers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const banUser = async (targetUserId: string, email: string) => {
    if (!window.confirm(`Tem certeza que deseja BANIR o usuário ${email}? Ele perderá todo acesso ao sistema.`)) return;
    
    try {
      await updateSubscription(targetUserId, 'mensal', 'cancelado');
      toast({
        title: "Usuário Banido",
        description: `${email} foi banido do sistema.`,
        variant: "destructive"
      });
    } catch (error: any) {
      toast({
        title: "Erro ao banir usuário",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      aprovado: "default",
      pendente: "secondary",
      vencido: "destructive",
      cancelado: "outline"
    };
    const labels: Record<string, string> = {
      aprovado: "✓ Ativo",
      pendente: "⏳ Pendente",
      vencido: "⚠️ Vencido",
      cancelado: "🚫 Banido"
    };
    return <Badge variant={variants[status] || "outline"}>{labels[status] || status}</Badge>;
  };

  const filteredMembers = members.filter(m => 
    m.email.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: members.length,
    aprovados: members.filter(m => m.subscription?.status === 'aprovado').length,
    aguardando: members.filter(m => m.subscription?.status === 'pendente').length,
    banidos: members.filter(m => m.subscription?.status === 'cancelado').length,
    vitalicio: members.filter(m => m.subscription?.plan === 'vitalicio').length
  };

  if (!isSuperAdmin || loading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-500" />
              Painel Super Admin
            </h1>
          </div>
          <Button onClick={loadMembers} variant="outline">
            Atualizar Lista
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <Card>
            <CardContent className="pt-4 sm:pt-6">
              <div className="text-xl sm:text-2xl font-bold">{stats.total}</div>
              <div className="text-xs sm:text-sm text-muted-foreground">Total Usuários</div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-950">
            <CardContent className="pt-4 sm:pt-6">
              <div className="text-xl sm:text-2xl font-bold text-green-600">{stats.aprovados}</div>
              <div className="text-xs sm:text-sm">✓ Ativos</div>
            </CardContent>
          </Card>
          <Card className="bg-yellow-50 dark:bg-yellow-950">
            <CardContent className="pt-4 sm:pt-6">
              <div className="text-xl sm:text-2xl font-bold text-yellow-600">{stats.aguardando}</div>
              <div className="text-xs sm:text-sm">⏱ Aguardando</div>
            </CardContent>
          </Card>
          <Card className="bg-red-50 dark:bg-red-950">
            <CardContent className="pt-4 sm:pt-6">
              <div className="text-xl sm:text-2xl font-bold text-red-600">{stats.banidos}</div>
              <div className="text-xs sm:text-sm">🚫 Banidos</div>
            </CardContent>
          </Card>
          <Card className="bg-cyan-50 dark:bg-cyan-950">
            <CardContent className="pt-4 sm:pt-6">
              <div className="text-xl sm:text-2xl font-bold text-cyan-600">{stats.vitalicio}</div>
              <div className="text-xs sm:text-sm">∞ Vitalício</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Gerenciar Usuários</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Email</TableHead>
                    <TableHead className="min-w-[120px]">Plano</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="min-w-[100px]">Cadastro</TableHead>
                    <TableHead className="min-w-[120px]">Vencimento</TableHead>
                    <TableHead className="min-w-[200px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.id} className={member.subscription?.status === 'cancelado' ? 'bg-red-50 dark:bg-red-950/30' : ''}>
                      <TableCell className="font-medium text-xs sm:text-sm">{member.email}</TableCell>
                      <TableCell>
                        <Select
                          value={member.subscription?.plan || 'mensal'}
                          onValueChange={(plan) => updateSubscription(member.id, plan, member.subscription?.status || 'pendente')}
                        >
                          <SelectTrigger className="w-[100px] sm:w-[110px] h-9 text-xs sm:text-sm bg-background border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent 
                            className="bg-popover border-border min-w-[120px]"
                            position="popper"
                            sideOffset={4}
                          >
                            <SelectItem value="vitalicio">Vitalício</SelectItem>
                            <SelectItem value="anual">1 Ano</SelectItem>
                            <SelectItem value="trimestral">3 Meses</SelectItem>
                            <SelectItem value="mensal">1 Mês</SelectItem>
                            <SelectItem value="1dia">1 Dia</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {member.subscription && getStatusBadge(member.subscription.status)}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        {format(new Date(member.created_at), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">
                        {member.subscription?.end_date 
                          ? format(new Date(member.subscription.end_date), 'dd/MM/yyyy')
                          : member.subscription?.plan === 'vitalicio' ? '∞' : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={member.subscription?.status === 'aprovado' ? 'outline' : 'default'}
                            onClick={() => updateSubscription(
                              member.id, 
                              member.subscription?.plan || 'mensal',
                              member.subscription?.status === 'aprovado' ? 'pendente' : 'aprovado'
                            )}
                            className="text-xs whitespace-nowrap"
                          >
                            {member.subscription?.status === 'aprovado' ? 'Suspender' : 'Ativar'}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => banUser(member.id, member.email)}
                            className="text-xs"
                            title="Banir usuário"
                          >
                            <Ban className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
