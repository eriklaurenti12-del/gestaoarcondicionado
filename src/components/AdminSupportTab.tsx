import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, UserCheck, KeyRound, CalendarDays, Wallet, Users, 
  Package, Wrench, Truck, HelpCircle, CheckCircle, XCircle, 
  RefreshCw, Loader2, Shield, Eye, Mail
} from "lucide-react";

interface SupportAction {
  label: string;
  icon: any;
  color: string;
  description: string;
}

const quickActions: SupportAction[] = [
  { label: 'Login / Acesso', icon: KeyRound, color: 'text-red-400', description: 'Problemas de login, senha, verificação de email' },
  { label: 'Liberar Acesso', icon: UserCheck, color: 'text-green-400', description: 'Ativar/suspender assinatura de usuário' },
  { label: 'Agendamentos', icon: CalendarDays, color: 'text-blue-400', description: 'Ajudar com agenda, conflitos de horário' },
  { label: 'Financeiro', icon: Wallet, color: 'text-amber-400', description: 'Problemas com parcelas, faturamento, relatórios' },
  { label: 'Clientes', icon: Users, color: 'text-purple-400', description: 'Cadastro de clientes, dados duplicados' },
  { label: 'Peças/Serviços', icon: Package, color: 'text-cyan-400', description: 'Produtos, estoque, serviços cadastrados' },
  { label: 'Fornecedores', icon: Truck, color: 'text-orange-400', description: 'Cadastro e gestão de fornecedores' },
];

export const AdminSupportTab: React.FC = () => {
  const { toast } = useToast();
  const [searchEmail, setSearchEmail] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [actionLog, setActionLog] = useState<string[]>([]);

  const searchUser = async () => {
    if (!searchEmail.trim()) return;
    setSearching(true);
    setFoundUser(null);
    try {
      const { data, error } = await supabase.functions.invoke('admin-members', { body: {} });
      if (error) throw error;
      const users = data as any[];
      const found = users.find((u: any) => u.email.toLowerCase().includes(searchEmail.toLowerCase()));
      if (found) {
        setFoundUser(found);
        addLog(`Usuário encontrado: ${found.email}`);
      } else {
        toast({ title: "Usuário não encontrado", description: "Tente outro email.", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro na busca", description: e.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const addLog = (msg: string) => {
    setActionLog(prev => [`[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`, ...prev.slice(0, 19)]);
  };

  const activateUser = async () => {
    if (!foundUser) return;
    try {
      const { error } = await supabase.functions.invoke('admin-update-subscription', {
        body: { user_id: foundUser.id, plan: foundUser.subscription?.plan || 'mensal', status: 'aprovado' }
      });
      if (error) throw error;
      addLog(`✅ Acesso ATIVADO para ${foundUser.email}`);
      toast({ title: "Acesso ativado!", description: foundUser.email });
      setFoundUser({ ...foundUser, subscription: { ...foundUser.subscription, status: 'aprovado', is_active: true } });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const suspendUser = async () => {
    if (!foundUser) return;
    try {
      const { error } = await supabase.functions.invoke('admin-update-subscription', {
        body: { user_id: foundUser.id, plan: foundUser.subscription?.plan || 'mensal', status: 'pendente' }
      });
      if (error) throw error;
      addLog(`⛔ Acesso SUSPENSO para ${foundUser.email}`);
      toast({ title: "Acesso suspenso", description: foundUser.email });
      setFoundUser({ ...foundUser, subscription: { ...foundUser.subscription, status: 'pendente', is_active: false } });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Card key={action.label} className="cursor-pointer hover:border-primary/50 transition-all group">
              <CardContent className="p-3 text-center">
                <Icon className={`w-6 h-6 mx-auto mb-1 ${action.color} group-hover:scale-110 transition-transform`} />
                <p className="text-xs font-medium">{action.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* User Search */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            Buscar Usuário para Suporte
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Digite o email do usuário..."
              value={searchEmail}
              onChange={e => setSearchEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchUser()}
            />
            <Button onClick={searchUser} disabled={searching} className="gap-2 shrink-0">
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </Button>
          </div>

          {foundUser && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className="font-semibold flex items-center gap-2">
                      <Mail className="w-4 h-4 text-primary" />
                      {foundUser.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Plano: <Badge variant="outline" className="ml-1">{foundUser.subscription?.plan || 'N/A'}</Badge>
                      <span className="mx-2">|</span>
                      Status: {foundUser.subscription?.status === 'aprovado' 
                        ? <Badge className="bg-green-500/20 text-green-400 ml-1">Ativo</Badge>
                        : <Badge variant="destructive" className="ml-1">{foundUser.subscription?.status || 'N/A'}</Badge>}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={activateUser} className="gap-1 bg-green-600 hover:bg-green-700">
                      <CheckCircle className="w-3 h-3" /> Ativar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={suspendUser} className="gap-1">
                      <XCircle className="w-3 h-3" /> Suspender
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-muted-foreground">WhatsApp</p>
                    <p className="font-medium">{foundUser.phone || '-'}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-muted-foreground">Plano</p>
                    <p className="font-medium">{foundUser.subscription?.plan || '-'}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium">{foundUser.subscription?.status || '-'}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-muted-foreground">Cadastro</p>
                    <p className="font-medium">{foundUser.created_at ? new Date(foundUser.created_at).toLocaleDateString('pt-BR') : '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Action Log */}
      {actionLog.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Log de Ações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-40 overflow-auto">
              {actionLog.map((log, i) => (
                <p key={i} className="text-xs text-muted-foreground font-mono">{log}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminSupportTab;
