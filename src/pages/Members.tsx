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
import { ArrowLeft, Search, Mail } from "lucide-react";
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
      // Buscar todos os profiles (super admin pode ver todos)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, username, created_at');
      
      if (profilesError) throw profilesError;

      // Buscar todas as subscriptions
      const { data: subscriptions, error: subsError } = await supabase
        .from('subscriptions')
        .select('*');
      
      if (subsError) throw subsError;

      // Para cada profile, buscar o email do auth
      const membersData: Member[] = [];
      
      for (const profile of profiles || []) {
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(profile.user_id);
        
        if (!userError && user) {
          membersData.push({
            id: user.id,
            email: user.email || '',
            created_at: profile.created_at,
            subscription: subscriptions?.find(s => s.user_id === user.id) || null
          });
        }
      }

      setMembers(membersData);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar membros",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSubscription = async (userId: string, plan: string, status: string) => {
    try {
      const startDate = new Date();
      let endDate: Date | null = null;

      if (plan !== 'vitalicio') {
        endDate = new Date();
        if (plan === 'anual') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        } else if (plan === 'trimestral') {
          endDate.setMonth(endDate.getMonth() + 3);
        } else {
          endDate.setMonth(endDate.getMonth() + 1);
        }
      }

      const { error } = await supabase
        .from('subscriptions')
        .update({
          plan,
          status,
          is_active: status === 'aprovado',
          start_date: startDate.toISOString(),
          end_date: endDate?.toISOString() || null,
          payment_date: status === 'aprovado' ? startDate.toISOString() : null
        })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Assinatura atualizada."
      });

      loadMembers();
    } catch (error: any) {
      toast({
        title: "Erro",
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
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const filteredMembers = members.filter(m => 
    m.email.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: members.length,
    aprovados: members.filter(m => m.subscription?.status === 'aprovado').length,
    aguardando: members.filter(m => m.subscription?.status === 'pendente').length,
    dia1: members.filter(m => {
      const created = new Date(m.created_at);
      const now = new Date();
      return created.toDateString() === now.toDateString();
    }).length,
    completa: members.filter(m => m.subscription?.plan === 'vitalicio').length
  };

  if (!isSuperAdmin || loading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="w-8 h-8" />
            Membros
          </h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 dark:bg-green-950">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{stats.aprovados}</div>
              <div className="text-sm">✓ Pagamentos Aprovados</div>
            </CardContent>
          </Card>
          <Card className="bg-yellow-50 dark:bg-yellow-950">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-yellow-600">{stats.aguardando}</div>
              <div className="text-sm">⏱ Aguardando</div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 dark:bg-blue-950">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">{stats.dia1}</div>
              <div className="text-sm">Dia 1</div>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 dark:bg-purple-950">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-purple-600">{stats.completa}</div>
              <div className="text-sm">Completa</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Lista de Membros</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.email}</TableCell>
                    <TableCell>
                      <Select
                        value={member.subscription?.plan || 'mensal'}
                        onValueChange={(plan) => updateSubscription(member.id, plan, member.subscription?.status || 'pendente')}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vitalicio">Vitalício</SelectItem>
                          <SelectItem value="anual">1 Ano</SelectItem>
                          <SelectItem value="trimestral">3 Meses</SelectItem>
                          <SelectItem value="mensal">1 Mês</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {member.subscription && getStatusBadge(member.subscription.status)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(member.created_at), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="text-sm">
                      {member.subscription?.end_date 
                        ? format(new Date(member.subscription.end_date), 'dd/MM/yyyy')
                        : member.subscription?.plan === 'vitalicio' ? '∞' : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={member.subscription?.status === 'aprovado' ? 'outline' : 'default'}
                        onClick={() => updateSubscription(
                          member.id, 
                          member.subscription?.plan || 'mensal',
                          member.subscription?.status === 'aprovado' ? 'pendente' : 'aprovado'
                        )}
                      >
                        {member.subscription?.status === 'aprovado' ? 'Cancelar' : 'Marcar Pago'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
