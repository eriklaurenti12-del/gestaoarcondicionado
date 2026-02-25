import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, RefreshCw, Loader2, Clock, Phone, Mail, Activity, UserCheck, UserX, Calendar } from "lucide-react";
import { format } from "date-fns";

type UserActivity = {
  id: string;
  email: string;
  phone: string | null;
  created_at: string;
  subscription: {
    plan: string;
    status: string;
    is_active: boolean;
  } | null;
  lastSeen?: string;
};

export const AdminUsersOnlineTab: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserActivity[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'pending' | 'recent'>('recent');

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-members', { body: {} });
      if (error) throw error;
      setUsers((data as UserActivity[]) || []);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    if (filter === 'active') return u.subscription?.status === 'aprovado';
    if (filter === 'pending') return u.subscription?.status === 'pendente';
    if (filter === 'recent') {
      const created = new Date(u.created_at);
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      return created >= threeDaysAgo;
    }
    return true;
  });

  const stats = {
    total: users.length,
    ativos: users.filter(u => u.subscription?.status === 'aprovado').length,
    pendentes: users.filter(u => u.subscription?.status === 'pendente').length,
    recentes: users.filter(u => {
      const created = new Date(u.created_at);
      return created >= new Date(Date.now() - 24 * 60 * 60 * 1000);
    }).length,
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20">
            <Activity className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Atividade de Usuários</h2>
            <p className="text-gray-400 text-sm">Veja quem está ativo e novos cadastros</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={loadUsers}
          className="border-[#2a2a3a] text-white hover:bg-[#2a2a3a]">
          <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: Users, color: 'text-white', bg: 'bg-[#1a1a24]' },
          { label: 'Ativos', value: stats.ativos, icon: UserCheck, color: 'text-green-400', bg: 'bg-green-900/20' },
          { label: 'Pendentes', value: stats.pendentes, icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-900/20' },
          { label: 'Hoje', value: stats.recentes, icon: Activity, color: 'text-cyan-400', bg: 'bg-cyan-900/20' },
        ].map((s, i) => (
          <Card key={i} className={`${s.bg} border-[#2a2a3a]`}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <div>
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-400">{s.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'recent' as const, label: '🕐 Recentes (3 dias)' },
          { key: 'active' as const, label: '✅ Ativos' },
          { key: 'pending' as const, label: '⏳ Pendentes' },
          { key: 'all' as const, label: '👥 Todos' },
        ].map(f => (
          <Button key={f.key} size="sm" variant={filter === f.key ? 'default' : 'outline'}
            onClick={() => setFilter(f.key)}
            className={filter === f.key 
              ? 'bg-cyan-600 text-white' 
              : 'border-[#2a2a3a] text-gray-400 hover:bg-[#2a2a3a] hover:text-white'}>
            {f.label}
          </Button>
        ))}
      </div>

      {/* User List */}
      <div className="space-y-2">
        {filteredUsers.length === 0 && (
          <Card className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardContent className="p-8 text-center text-gray-500">
              <UserX className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Nenhum usuário encontrado neste filtro
            </CardContent>
          </Card>
        )}
        {filteredUsers.map(user => (
          <Card key={user.id} className="bg-[#1a1a24] border-[#2a2a3a] hover:border-[#3a3a4a] transition-colors">
            <CardContent className="p-3 flex items-center gap-3 flex-wrap">
              <div className={`w-2 h-2 rounded-full ${user.subscription?.status === 'aprovado' ? 'bg-green-400' : user.subscription?.status === 'pendente' ? 'bg-yellow-400' : 'bg-red-400'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{user.email}</p>
                <p className="text-gray-500 text-xs">
                  Cadastro: {format(new Date(user.created_at), 'dd/MM/yyyy HH:mm')}
                </p>
              </div>
              <Badge variant="outline" className={`text-xs ${
                user.subscription?.status === 'aprovado' ? 'border-green-500 text-green-400' :
                user.subscription?.status === 'pendente' ? 'border-yellow-500 text-yellow-400' :
                'border-red-500 text-red-400'
              }`}>
                {user.subscription?.plan || 'sem plano'} • {user.subscription?.status || 'inativo'}
              </Badge>
              {user.phone && (
                <Button size="sm" variant="ghost" onClick={() => window.open(`https://wa.me/55${user.phone?.replace(/\D/g, '')}`, '_blank')}
                  className="text-green-400 hover:text-green-300 h-7 px-2">
                  <Phone className="w-3 h-3" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminUsersOnlineTab;