import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Gift, Loader2, Trophy, Users, Sparkles, RotateCw, Copy } from "lucide-react";

type Member = {
  id: string;
  email: string;
  phone: string | null;
  subscription: { plan: string; status: string; } | null;
};

export const AdminRaffleTab: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [filter, setFilter] = useState<'all' | 'active'>('active');
  const [prize, setPrize] = useState('1 mês grátis');
  const [winner, setWinner] = useState<Member | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [history, setHistory] = useState<{ winner: string; prize: string; date: string }[]>([]);

  useEffect(() => { loadMembers(); }, []);

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

  const eligibleMembers = members.filter(m => {
    if (m.email === 'eriklaurenti09@gmail.com') return false;
    if (filter === 'active') return m.subscription?.status === 'aprovado';
    return true;
  });

  const runRaffle = () => {
    if (eligibleMembers.length === 0) {
      toast({ title: "Sem participantes", description: "Nenhum usuário elegível.", variant: "destructive" });
      return;
    }

    setSpinning(true);
    setWinner(null);

    // Animate through names
    let count = 0;
    const maxCount = 20;
    const interval = setInterval(() => {
      const randomMember = eligibleMembers[Math.floor(Math.random() * eligibleMembers.length)];
      setWinner(randomMember);
      count++;
      if (count >= maxCount) {
        clearInterval(interval);
        setSpinning(false);
        const finalWinner = eligibleMembers[Math.floor(Math.random() * eligibleMembers.length)];
        setWinner(finalWinner);
        setHistory(prev => [
          { winner: finalWinner.email, prize, date: new Date().toLocaleString('pt-BR') },
          ...prev.slice(0, 9)
        ]);
        toast({ title: "🎉 Sorteio Realizado!", description: `Vencedor: ${finalWinner.email}` });
      }
    }, 100);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
          <Gift className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Sorteio de Usuários</h2>
          <p className="text-gray-400 text-sm">Sorteie prêmios entre os assinantes</p>
        </div>
      </div>

      {/* Config */}
      <Card className="bg-[#1a1a24] border-[#2a2a3a]">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300 text-sm">Prêmio</Label>
              <Input value={prize} onChange={e => setPrize(e.target.value)}
                className="bg-[#0f0f17] border-[#2a2a3a] text-white" placeholder="Ex: 1 mês grátis" />
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

          <Button onClick={runRaffle} disabled={spinning || eligibleMembers.length === 0}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-lg py-6">
            {spinning ? (
              <>
                <RotateCw className="w-5 h-5 mr-2 animate-spin" /> Sorteando...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" /> SORTEAR AGORA
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Winner */}
      {winner && !spinning && (
        <Card className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 border-amber-500/50">
          <CardContent className="p-6 text-center">
            <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <h3 className="text-2xl font-bold text-white mb-1">🎉 Vencedor!</h3>
            <p className="text-amber-300 text-lg font-semibold">{winner.email}</p>
            {winner.phone && <p className="text-gray-400 text-sm mt-1">📱 {winner.phone}</p>}
            <Badge className="mt-3 bg-amber-500/20 text-amber-300 border-amber-500/30">
              Prêmio: {prize}
            </Badge>
            <div className="flex justify-center gap-2 mt-4">
              <Button size="sm" onClick={() => { navigator.clipboard.writeText(winner.email); toast({ title: "Copiado!" }); }}
                className="bg-[#2a2a3a] text-white hover:bg-[#3a3a4a]">
                <Copy className="w-3 h-3 mr-1" /> Copiar Email
              </Button>
              {winner.phone && (
                <Button size="sm" onClick={() => window.open(`https://wa.me/55${winner.phone?.replace(/\D/g, '')}?text=Parabéns! Você ganhou: ${prize}! 🎉`, '_blank')}
                  className="bg-green-600 hover:bg-green-700 text-white">
                  💬 Avisar no WhatsApp
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card className="bg-[#1a1a24] border-[#2a2a3a]">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm">📜 Histórico de Sorteios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between bg-[#12121a] border border-[#2a2a3a] rounded-lg p-2">
                <div>
                  <p className="text-white text-xs font-medium">{h.winner}</p>
                  <p className="text-gray-500 text-[10px]">{h.date}</p>
                </div>
                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                  {h.prize}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminRaffleTab;