import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Link2, LogIn, Globe, Share2, Server, Save, Loader2, Info, Send, LinkIcon, Users } from "lucide-react";
import { AdminGuideCards } from "@/components/AdminGuideCards";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export const AdminShareTab: React.FC = () => {
  const { toast } = useToast();
  const [customDomain, setCustomDomain] = useState('');
  const [savedDomain, setSavedDomain] = useState('');
  const [useCustomDomain, setUseCustomDomain] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const defaultUrl = 'https://gestaoarcondicionado.lovable.app';

  useEffect(() => {
    loadDomainSettings();
  }, []);

  const loadDomainSettings = async () => {
    try {
      const { data } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', ['custom_domain', 'use_custom_domain']);

      if (data) {
        const domainRow = data.find(r => r.key === 'custom_domain');
        const useRow = data.find(r => r.key === 'use_custom_domain');
        if (domainRow?.value) {
          setCustomDomain(domainRow.value);
          setSavedDomain(domainRow.value);
        }
        if (useRow?.value === 'true') {
          setUseCustomDomain(true);
        }
      }
    } catch (e) {
      console.error('Error loading domain settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveDomainSettings = async () => {
    setSaving(true);
    try {
      let domain = customDomain.trim().replace(/\/+$/, '');
      if (domain && !domain.startsWith('http')) {
        domain = 'https://' + domain;
      }
      setCustomDomain(domain);

      for (const [key, value] of [
        ['custom_domain', domain],
        ['use_custom_domain', domain ? 'true' : 'false'],
      ] as const) {
        const { data: existing } = await supabase
          .from('admin_settings')
          .select('id')
          .eq('key', key)
          .maybeSingle();

        if (existing) {
          await supabase.from('admin_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
        } else {
          await supabase.from('admin_settings').insert({ key, value, description: key === 'custom_domain' ? 'Domínio personalizado' : 'Usar domínio personalizado' });
        }
      }

      setSavedDomain(domain);
      setUseCustomDomain(!!domain);
      toast({ title: "Domínio salvo! 🌐", description: domain ? `Domínio ${domain} configurado com sucesso.` : "Domínio removido. Usando URL padrão." });
    } catch (e) {
      toast({ title: "Erro", description: "Não foi possível salvar o domínio.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const removeDomain = async () => {
    setCustomDomain('');
    setSaving(true);
    try {
      await supabase.from('admin_settings').update({ value: '', updated_at: new Date().toISOString() }).eq('key', 'custom_domain');
      await supabase.from('admin_settings').update({ value: 'false', updated_at: new Date().toISOString() }).eq('key', 'use_custom_domain');
      setSavedDomain('');
      setUseCustomDomain(false);
      toast({ title: "Domínio removido", description: "Voltando para a URL padrão." });
    } catch (e) {
      toast({ title: "Erro", description: "Falha ao remover domínio.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const baseUrl = useCustomDomain && savedDomain ? savedDomain : defaultUrl;
  const landingUrl = baseUrl + '/vendas';
  const loginUrl = baseUrl + '/?login=true';
  const cadastroUrl = baseUrl + '/?cadastro=true';
  const portalUrl = baseUrl + '/portal';

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
    { icon: Globe, label: 'Landing Page', desc: 'Página de vendas principal', url: landingUrl, color: 'text-cyan-400', borderColor: 'border-l-cyan-500' },
    { icon: LogIn, label: 'Página de Login', desc: 'Link direto para login', url: loginUrl, color: 'text-green-400', borderColor: 'border-l-green-500' },
    { icon: Link2, label: 'Página de Cadastro', desc: 'Link direto para criar conta', url: cadastroUrl, color: 'text-purple-400', borderColor: 'border-l-purple-500' },
    { icon: Users, label: 'Portal da Equipe', desc: 'Link para equipe administrar e solicitar suporte', url: portalUrl, color: 'text-blue-400', borderColor: 'border-l-blue-500' },
  ];

  const whatsappTemplates = [
    { label: 'Convite para profissionais', msg: `🔧 Ei, técnico de ar condicionado! Conheça o sistema que vai organizar toda sua empresa: ${landingUrl}` },
    { label: 'Indicação', msg: `❄️ Estou usando um sistema incrível pra gerenciar meus serviços de ar condicionado. Dá uma olhada: ${landingUrl}` },
    { label: 'Link de cadastro', msg: `Cria sua conta aqui pra começar a usar o AC Service Pro: ${cadastroUrl}` },
  ];

  return (
    <div className="space-y-6">
      <AdminGuideCards tab="share" />

      {/* Header Card */}
      <Card className="bg-[#1a1a24] border-[#2a2a3a]">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
              <LinkIcon className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-white font-bold text-base">Links do Sistema</h2>
                <Badge className="bg-cyan-600 text-white text-[10px] px-2 py-0">COMPARTILHAR</Badge>
              </div>
              <p className="text-gray-400 text-xs">Gerencie os links de acesso ao sistema: landing page, cadastro, login e agendamento online. Copie e compartilhe facilmente.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-2">
        <LinkIcon className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-blue-300 text-xs">
          <span className="font-semibold">Também usado na aba Landing e Portal:</span> O link da Landing Page é compartilhado com a aba Landing para personalização. O link de agendamento (/agendar) é o mesmo usado na página de agendamento online público.
        </p>
      </div>

      {/* Compartilhar Links Section */}
      <div className="flex items-center gap-3 mt-2">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
          <Send className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Compartilhar Links</h2>
          <p className="text-gray-400 text-xs">Copie e compartilhe os links do sistema</p>
        </div>
      </div>

      {/* Domain Section */}
      <Card className="bg-[#1a1a24] border-[#2a2a3a] border-l-4 border-l-blue-500">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-white" />
            <h3 className="text-white font-bold text-base">Domínio Personalizado</h3>
            <Badge variant="outline" className="border-blue-500/50 text-blue-400 text-[10px] px-2 py-0">PRO</Badge>
          </div>
          <p className="text-gray-400 text-xs -mt-2">Conecte seu próprio domínio para sua landing page e sistema</p>

          {savedDomain && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-300 text-xs font-medium">Domínio ativo: {savedDomain}</span>
            </div>
          )}

          <div>
            <label className="text-gray-300 text-xs font-medium mb-1.5 block">Seu domínio</label>
            <div className="flex gap-2">
              <Input
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="meusite.com.br"
                className="bg-[#0f0f17] border-[#2a2a3a] text-white placeholder:text-gray-600 flex-1"
              />
              <Button
                onClick={saveDomainSettings}
                disabled={saving || !customDomain.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span className="ml-1">Salvar</span>
              </Button>
            </div>
          </div>

          {savedDomain && (
            <Button
              variant="outline"
              size="sm"
              onClick={removeDomain}
              disabled={saving}
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs"
            >
              Remover domínio personalizado
            </Button>
          )}

          <div className="bg-[#12121a] border border-[#2a2a3a] rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <div className="text-xs text-gray-400 space-y-1">
                <p className="font-medium text-blue-300">Como configurar seu domínio:</p>
                <ol className="list-decimal list-inside space-y-1 ml-1">
                  <li>Compre um domínio (ex: Registro.br, GoDaddy, Hostinger)</li>
                  <li>No painel do domínio, adicione um registro <span className="text-amber-300 font-mono">A</span> apontando para <span className="text-cyan-300 font-mono">185.158.133.1</span></li>
                  <li>Adicione também o <span className="text-amber-300 font-mono">www</span> como registro A para o mesmo IP</li>
                  <li>Acesse as configurações do projeto e conecte o domínio na aba <span className="text-cyan-300">Domains</span></li>
                  <li>Cole o domínio aqui para os links serem atualizados automaticamente</li>
                </ol>
                <p className="text-gray-500 mt-2">⏱ A propagação do DNS pode levar até 72h após a configuração.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Links List */}
      <div className="grid gap-4">
        {links.map((link, i) => (
          <Card key={i} className={`bg-[#1a1a24] border-[#2a2a3a] border-l-4 ${link.borderColor}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-[#12121a]">
                  <link.icon className={`w-5 h-5 ${link.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-sm">{link.label}</h3>
                  <p className="text-gray-500 text-xs">{link.desc}</p>
                  <div className="mt-2">
                    <Input
                      value={link.url}
                      readOnly
                      className="bg-[#0f0f17] border-[#2a2a3a] text-cyan-300 text-xs h-9 font-mono cursor-text"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(link.url, link.label)}
                    className="bg-[#2a2a3a] hover:bg-[#3a3a4a] text-white text-xs border border-[#3a3a4a] h-8 px-3"
                  >
                    <Copy className="w-3 h-3 mr-1" /> Copiar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => shareLink(link.url, link.label)}
                    className="bg-[#2a2a3a] hover:bg-[#3a3a4a] text-white text-xs border border-[#3a3a4a] h-8 px-3"
                  >
                    <Send className="w-3 h-3 mr-1" /> Enviar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => window.open(link.url, '_blank')}
                    className="bg-[#2a2a3a] hover:bg-[#3a3a4a] text-white text-xs border border-[#3a3a4a] h-8 px-3"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" /> Abrir
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* WhatsApp Templates */}
      <div className="flex items-center gap-3 mt-2">
        <span className="text-2xl">💬</span>
        <div>
          <h2 className="text-lg font-bold text-white">Mensagens Prontas para WhatsApp</h2>
          <p className="text-gray-400 text-xs">Clique para copiar e enviar</p>
        </div>
      </div>

      <div className="space-y-3">
        {whatsappTemplates.map((tmpl, i) => (
          <Card key={i} className="bg-[#1a1a24] border-[#2a2a3a]">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold">{tmpl.label}</p>
                <p className="text-gray-500 text-xs mt-1 line-clamp-2">{tmpl.msg}</p>
              </div>
              <Button
                size="sm"
                onClick={() => copyToClipboard(tmpl.msg, tmpl.label)}
                className="bg-green-600 hover:bg-green-700 text-white text-xs shrink-0 h-9 px-4"
              >
                <Copy className="w-3 h-3 mr-1" /> Copiar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminShareTab;
