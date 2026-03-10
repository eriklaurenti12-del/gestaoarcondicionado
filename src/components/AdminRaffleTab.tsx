import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Gift, Loader2, Trophy, Users, Sparkles, RotateCw, Copy, Phone, History, Crown, UserPlus, Zap } from "lucide-react";
import { AdminGuideCards } from "@/components/AdminGuideCards";

type Member = {
  id: string;
  email: string;
  phone: string | null;
  subscription: { plan: string; status: string; } | null;
};

type RaffleRecord = {
  id: string;
  winner_email: string;
  winner_user_id: string | null;
  prize: string;
  is_claimed: boolean;
  winner_notified: boolean;
  created_at: string;
};

export const AdminRaffleTab: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [filter, setFilter] = useState<'all' | 'active'>('active');
  const [prize, setPrize] = useState('1 mês grátis');
  const [winner, setWinner] = useState<Member | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [history, setHistory] = useState<RaffleRecord[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [activating, setActivating] = useState<string | null>(null);

  useEffect(() => { loadMembers(); loadHistory(); }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-members', { body: {} });
      if (error) throw error;
      setMembers((data as Member[]) || []);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    const { data } = await supabase
      .from('raffle_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setHistory(data as RaffleRecord[]);
  };

  const eligibleMembers = members.filter(m => {
    if (['eriklaurenti09@gmail.com', 'leonardoleal372@gmail.com'].includes(m.email)) return false;
    if (filter === 'active') return m.subscription?.status === 'aprovado';
    return true;
  });

  const activate1MonthFree = async (member: Member) => {
    setActivating(member.id);
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      const { error } = await supabase.functions.invoke('admin-update-subscription', {
        body: {
          target_user_id: member.id,
          plan: 'mensal',
          status: 'aprovado',
          is_active: true,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          payment_date: startDate.toISOString()
        }
      });
      if (error) throw error;
      toast({ title: "✅ Ativado!", description: `1 mês grátis ativado para ${member.email}` });
      loadMembers();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setActivating(null);
    }
  };

  const selectAndReward = () => {
    if (!selectedUserId) {
      toast({ title: "Selecione um usuário", variant: "destructive" });
      return;
    }
    const member = members.find(m => m.id === selectedUserId);
    if (!member) return;
    setWinner(member);
    setDisplayName(member.email);
    saveRaffleResult(member);
    toast({ title: "🎉 Prêmio Atribuído!", description: `${member.email} recebeu: ${prize}` });
  };

  const runRaffle = () => {
    if (eligibleMembers.length === 0) {
      toast({ title: "Sem participantes", description: "Nenhum usuário elegível.", variant: "destructive" });
      return;
    }

    setSpinning(true);
    setWinner(null);
    setDisplayName('');

    let count = 0;
    const maxCount = 25;
    const interval = setInterval(() => {
      const randomMember = eligibleMembers[Math.floor(Math.random() * eligibleMembers.length)];
      setDisplayName(randomMember.email);
      count++;
      if (count >= maxCount) {
        clearInterval(interval);
        setSpinning(false);
        const finalWinner = eligibleMembers[Math.floor(Math.random() * eligibleMembers.length)];
        setWinner(finalWinner);
        setDisplayName(finalWinner.email);
        saveRaffleResult(finalWinner);
        toast({ title: "🎉 Sorteio Realizado!", description: `Vencedor: ${finalWinner.email}` });
      }
    }, 120);
  };

  const saveRaffleResult = async (winnerMember: Member) => {
    try {
      await supabase.from('raffle_history').insert({
        winner_email: winnerMember.email,
        winner_user_id: winnerMember.id,
        prize,
        winner_notified: true,
      });
      loadHistory();
    } catch (error: any) {
      console.error('Error saving raffle:', error);
    }
  };

  const notifyWinner = (member: Member) => {
    const message = `🎉 Parabéns! Você GANHOU o sorteio do AC Service Pro!\n\n🎁 Prêmio: ${prize}\n\nEntre no sistema para ver sua premiação ou responda essa mensagem para resgatar!`;
    const phone = member.phone?.replace(/\D/g, '') || '';
    if (phone) {
      window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  return (
    <div className="space-y-4">
      <AdminGuideCards tab="raffle" />
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
          <Gift className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Sorteio & Premiação</h2>
          <p className="text-gray-400 text-sm">Sorteie ou selecione usuários para dar prêmios e ativar contas</p>
        </div>
      </div>

      {/* Config */}
      <Card className="bg-[#1a1a24] border-[#2a2a3a]">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300 text-sm">Prêmio</Label>
              <Input value={prize} onChange={e => setPrize(e.target.value)}
                className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="Ex: 1 mês grátis, desconto 50%" />
            </div>
            <div>
              <Label className="text-gray-300 text-sm">Participantes</Label>
              <div className="flex gap-2 mt-1">
                <Button size="sm" variant={filter === 'active' ? 'default' : 'outline'}
                  onClick={() => setFilter('active')}
                  className={filter === 'active' ? 'bg-cyan-600' : 'border-[#2a2a3a] text-gray-400'}>
                  Só ativos
                </Button>
                <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilter('all')}
                  className={filter === 'all' ? 'bg-cyan-600' : 'border-[#2a2a3a] text-gray-400'}>
                  Todos
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-[#12121a] border border-[#2a2a3a] rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span className="text-gray-300 text-sm">
                <strong className="text-white">{eligibleMembers.length}</strong> participantes elegíveis
              </span>
            </div>
            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
              🎁 {prize}
            </Badge>
          </div>

          {/* Select specific user */}
          <Card className="bg-[#12121a] border-[#2a2a3a]">
            <CardContent className="p-4 space-y-3">
              <h4 className="text-cyan-400 font-semibold text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4" /> Selecionar Usuário Específico
              </h4>
              <div className="flex gap-2">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="bg-[#0f0f17] border-[#2a2a3a] text-white flex-1">
                    <SelectValue placeholder="Selecione um usuário..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a24] border-[#2a2a3a] max-h-60">
                    {members.filter(m => !['eriklaurenti09@gmail.com', 'leonardoleal372@gmail.com'].includes(m.email)).map(m => (
                      <SelectItem key={m.id} value={m.id} className="text-white hover:bg-[#2a2a3a] focus:bg-[#2a2a3a] focus:text-white">
                        {m.email} {m.subscription?.status === 'aprovado' ? '✅' : '⏳'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={selectAndReward}
                  className="bg-amber-600 hover:bg-amber-700 text-white whitespace-nowrap">
                  <Gift className="w-4 h-4 mr-1" /> Dar Prêmio
                </Button>
              </div>
              {selectedUserId && (
                <Button size="sm" onClick={() => {
                  const member = members.find(m => m.id === selectedUserId);
                  if (member) activate1MonthFree(member);
                }}
                  disabled={activating === selectedUserId}
                  className="bg-green-600 hover:bg-green-700 text-white w-full">
                  {activating === selectedUserId ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4 mr-2" />
                  )}
                  Ativar 1 Mês Grátis para este Usuário
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Spinning display */}
          {(spinning || displayName) && (
            <div className={`p-6 rounded-xl border-2 text-center transition-all ${
              spinning 
                ? 'border-amber-500/50 bg-amber-500/5 animate-pulse' 
                : 'border-green-500/50 bg-green-500/5'
            }`}>
              <p className="text-gray-400 text-xs mb-2">{spinning ? '🎰 Sorteando...' : '🎉 Vencedor!'}</p>
              <p className={`text-2xl font-bold ${spinning ? 'text-amber-400' : 'text-green-400'}`}>
                {displayName}
              </p>
            </div>
          )}

          <Button onClick={runRaffle} disabled={spinning || eligibleMembers.length === 0}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-lg py-6">
            {spinning ? (
              <><RotateCw className="w-5 h-5 mr-2 animate-spin" /> Sorteando...</>
            ) : (
              <><Sparkles className="w-5 h-5 mr-2" /> SORTEAR ALEATÓRIO</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Winner Card */}
      {winner && !spinning && (
        <Card className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 border-amber-500/50 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
          <CardContent className="p-6 text-center relative">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">🎉 Vencedor!</h3>
            <p className="text-amber-300 text-lg font-semibold">{winner.email}</p>
            {winner.phone && <p className="text-gray-400 text-sm mt-1">📱 {winner.phone}</p>}
            <Badge className="mt-3 bg-amber-500/20 text-amber-300 border-amber-500/30 text-sm">
              <Crown className="w-3 h-3 mr-1" /> Prêmio: {prize}
            </Badge>
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
              <Button size="sm" onClick={() => { navigator.clipboard.writeText(winner.email); toast({ title: "Copiado!" }); }}
                className="bg-[#2a2a3a] text-white hover:bg-[#3a3a4a]">
                <Copy className="w-3 h-3 mr-1" /> Copiar Email
              </Button>
              {winner.phone && (
                <Button size="sm" onClick={() => notifyWinner(winner)}
                  className="bg-green-600 hover:bg-green-700 text-white">
                  <Phone className="w-3 h-3 mr-1" /> Avisar WhatsApp
                </Button>
              )}
              <Button size="sm" onClick={() => activate1MonthFree(winner)}
                disabled={activating === winner.id}
                className="bg-cyan-600 hover:bg-cyan-700 text-white">
                {activating === winner.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                Ativar 1 Mês Grátis
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card className="bg-[#1a1a24] border-[#2a2a3a]">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" /> Histórico de Sorteios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between bg-[#12121a] border border-[#2a2a3a] rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <div>
                    <p className="text-white text-sm font-medium">{h.winner_email}</p>
                    <p className="text-gray-500 text-[10px]">
                      {new Date(h.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                    {h.prize}
                  </Badge>
                  {h.is_claimed && (
                    <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-[10px]">
                      Resgatado
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminRaffleTab;
