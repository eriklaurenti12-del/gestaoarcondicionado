import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Link2, LogIn, Globe, Share2, Users, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type TeamInvite = {
  id: string;
  invite_code: string;
  status: string;
  accepted_email: string | null;
  created_at: string;
};

export const AdminShareTab: React.FC = () => {
  const { toast } = useToast();
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([]);
  const [loadingInvite, setLoadingInvite] = useState(false);

  const publishedUrl = 'https://gestaoarcondicionado.lovable.app';
  const landingUrl = publishedUrl + '/';
  const loginUrl = publishedUrl + '/?login=true';
  const cadastroUrl = publishedUrl + '/?cadastro=true';

  useEffect(() => {
    loadTeamInvites();
  }, []);

  const loadTeamInvites = async () => {
    const { data } = await supabase
      .from('team_invites')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setTeamInvites(data as TeamInvite[]);
  };

  const generateTeamInvite = async () => {
    setLoadingInvite(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const code = crypto.randomUUID().slice(0, 8).toUpperCase();
      const { error } = await supabase.from('team_invites').insert({
        invite_code: code,
        created_by: user.id,
        status: 'pending'
      });
      if (error) throw error;
      toast({ title: "Link de equipe criado!", description: `Código: ${code}` });
      loadTeamInvites();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoadingInvite(false);
    }
  };

  const deleteInvite = async (id: string) => {
    await supabase.from('team_invites').delete().eq('id', id);
    loadTeamInvites();
    toast({ title: "Convite removido" });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado! 📋", description: `${label} copiado para a área de transferência.` });
  };

  const shareLink = async (url: string, title: string) => {
    if (navigator.share) {
      try { await navigator.share({ title, url, text: `Confira o ${title}!` }); } catch {}
    } else {
      copyToClipboard(url, title);
    }
  };

  const links = [
    { icon: Globe, label: 'Landing Page', desc: 'Página de vendas principal', url: landingUrl, color: 'text-cyan-400', bg: 'from-cyan-500/20 to-blue-500/20' },
    { icon: LogIn, label: 'Página de Login', desc: 'Link direto para login', url: loginUrl, color: 'text-green-400', bg: 'from-green-500/20 to-emerald-500/20' },
    { icon: Link2, label: 'Página de Cadastro', desc: 'Link direto para criar conta', url: cadastroUrl, color: 'text-purple-400', bg: 'from-purple-500/20 to-pink-500/20' },
  ];

  return (
    <div className="space-y-6">
      {/* Team Invites Section */}
      <Card className="bg-gradient-to-br from-[#1a1a24] to-[#12121a] border-cyan-500/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                <Users className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <CardTitle className="text-white text-lg">🔗 Link de Equipe (Co-Admin)</CardTitle>
                <CardDescription className="text-gray-400 text-sm">
                  Gere links para membros da equipe co-administrarem o painel
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={generateTeamInvite}
              disabled={loadingInvite}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Gerar Link
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {teamInvites.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">Nenhum convite gerado. Clique em "Gerar Link" para criar.</p>
          ) : (
            teamInvites.map((invite) => {
              const teamUrl = `${publishedUrl}/auth?team=${invite.invite_code}`;
              return (
                <div key={invite.id} className="flex items-center gap-3 bg-[#0f0f17] border border-[#2a2a3a] rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-cyan-300 text-sm font-mono">{invite.invite_code}</code>
                      <Badge className={invite.status === 'accepted' ? 'bg-green-600' : 'bg-yellow-600'}>
                        {invite.status === 'accepted' ? '✓ Aceito' : '⏳ Pendente'}
                      </Badge>
                    </div>
                    {invite.accepted_email && (
                      <p className="text-gray-400 text-xs">Aceito por: {invite.accepted_email}</p>
                    )}
                    <Input value={teamUrl} readOnly className="bg-[#0a0a12] border-[#2a2a3a] text-cyan-300/70 text-xs h-7 font-mono mt-1" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(teamUrl, 'Link de Equipe')}
                      className="border-[#2a2a3a] text-white hover:bg-[#2a2a3a] text-xs h-7">
                      <Copy className="w-3 h-3 mr-1" /> Copiar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteInvite(invite.id)}
                      className="text-xs h-7 bg-red-600/80 hover:bg-red-700">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
          <p className="text-gray-500 text-xs">
            💡 Membros que se cadastrarem pelo link terão acesso total ao painel admin.
          </p>
        </CardContent>
      </Card>

      {/* Share Links */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
          <Share2 className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Compartilhar Links</h2>
          <p className="text-gray-400 text-sm">Copie e compartilhe os links do sistema</p>
        </div>
      </div>

      <div className="grid gap-4">
        {links.map((link, i) => (
          <Card key={i} className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${link.bg}`}>
                  <link.icon className={`w-5 h-5 ${link.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-sm">{link.label}</h3>
                  <p className="text-gray-500 text-xs">{link.desc}</p>
                  <div className="mt-2">
                    <Input value={link.url} readOnly className="bg-[#0f0f17] border-[#2a2a3a] text-cyan-300 text-xs h-8 font-mono" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button size="sm" variant="outline" onClick={() => copyToClipboard(link.url, link.label)}
                    className="border-[#2a2a3a] text-white hover:bg-[#2a2a3a] text-xs">
                    <Copy className="w-3 h-3 mr-1" /> Copiar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => shareLink(link.url, link.label)}
                    className="border-[#2a2a3a] text-white hover:bg-[#2a2a3a] text-xs">
                    <Share2 className="w-3 h-3 mr-1" /> Enviar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => window.open(link.url, '_blank')}
                    className="border-[#2a2a3a] text-white hover:bg-[#2a2a3a] text-xs">
                    <ExternalLink className="w-3 h-3 mr-1" /> Abrir
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* WhatsApp Templates */}
      <Card className="bg-[#1a1a24] border-[#2a2a3a]">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-base">💬 Mensagens Prontas para WhatsApp</CardTitle>
          <CardDescription className="text-gray-400 text-xs">Clique para copiar e enviar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Convite para técnicos', msg: `🔧 Ei, técnico de ar condicionado! Conheça o sistema que vai organizar toda sua empresa: ${landingUrl}` },
            { label: 'Indicação', msg: `❄️ Estou usando um sistema incrível pra gerenciar meus serviços de ar condicionado. Dá uma olhada: ${landingUrl}` },
            { label: 'Link de cadastro', msg: `Cria sua conta aqui pra começar a usar o AC Service Pro: ${cadastroUrl}` },
          ].map((tmpl, i) => (
            <div key={i} className="flex items-center gap-3 bg-[#12121a] border border-[#2a2a3a] rounded-lg p-3">
              <div className="flex-1">
                <p className="text-gray-300 text-xs font-medium">{tmpl.label}</p>
                <p className="text-gray-500 text-xs mt-1 line-clamp-2">{tmpl.msg}</p>
              </div>
              <Button size="sm" onClick={() => copyToClipboard(tmpl.msg, tmpl.label)}
                className="bg-green-600 hover:bg-green-700 text-white text-xs shrink-0">
                <Copy className="w-3 h-3 mr-1" /> Copiar
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminShareTab;
