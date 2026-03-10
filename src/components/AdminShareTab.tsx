import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Globe, Send, Save, Loader2, Info, LinkIcon, Users, Calendar, LogIn, Link2, LayoutDashboard, Zap, Plus, Trash2 } from "lucide-react";
import { AdminGuideCards } from "@/components/AdminGuideCards";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_URL } from "@/hooks/useDomainSettings";

interface DomainEntry {
  id: string;
  domain: string;
  nickname: string;
  usage: string;
}

const USAGE_OPTIONS = [
  { value: 'landing', label: 'Landing Page', desc: 'Página de vendas' },
  { value: 'login', label: 'Login', desc: 'Página de login' },
  { value: 'cadastro', label: 'Cadastro', desc: 'Página de cadastro' },
  { value: 'portal', label: 'Portal da Equipe', desc: 'Portal da equipe' },
  { value: 'agendamento', label: 'Agendamento', desc: 'Agendamento online' },
  { value: 'dashboard', label: 'Dashboard', desc: 'Painel de controle' },
];

export const AdminShareTab: React.FC = () => {
  const { toast } = useToast();
  const [domains, setDomains] = useState<DomainEntry[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newUsage, setNewUsage] = useState('landing');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [primaryDomain, setPrimaryDomain] = useState('');

  useEffect(() => {
    loadDomainSettings();
  }, []);

  const loadDomainSettings = async () => {
    try {
      const { data } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', ['custom_domain', 'use_custom_domain', 'custom_domains_list']);

      if (data) {
        const domainRow = data.find(r => r.key === 'custom_domain');
        const domainsListRow = data.find(r => r.key === 'custom_domains_list');

        if (domainRow?.value) {
          setPrimaryDomain(domainRow.value);
        }

        if (domainsListRow?.value) {
          try {
            const parsed = JSON.parse(domainsListRow.value);
            if (Array.isArray(parsed)) setDomains(parsed);
          } catch {}
        }
      }
    } catch (e) {
      console.error('Error loading domain settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveDomainsList = async (list: DomainEntry[]) => {
    const value = JSON.stringify(list);
    const { data: existing } = await supabase
      .from('admin_settings')
      .select('id')
      .eq('key', 'custom_domains_list')
      .maybeSingle();

    if (existing) {
      await supabase.from('admin_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', 'custom_domains_list');
    } else {
      await supabase.from('admin_settings').insert({ key: 'custom_domains_list', value, description: 'Lista de domínios personalizados' });
    }
  };

  const savePrimaryDomain = async (domain: string) => {
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
  };

  const addDomain = async () => {
    if (!newDomain.trim()) return;
    setSaving(true);
    try {
      let domain = newDomain.trim().replace(/\/+$/, '');
      if (domain && !domain.startsWith('http')) {
        domain = 'https://' + domain;
      }

      const entry: DomainEntry = {
        id: crypto.randomUUID(),
        domain,
        nickname: newNickname.trim(),
        usage: newUsage,
      };

      const updated = [...domains, entry];
      setDomains(updated);
      await saveDomainsList(updated);

      // Set as primary if it's the first or if it's a landing domain
      if (updated.length === 1 || newUsage === 'landing') {
        setPrimaryDomain(domain);
        await savePrimaryDomain(domain);
      }

      setNewDomain('');
      setNewNickname('');
      setNewUsage('landing');
      toast({ title: "Domínio adicionado! 🌐", description: `${domain} configurado como ${USAGE_OPTIONS.find(o => o.value === newUsage)?.label}.` });
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar o domínio.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const removeDomain = async (id: string) => {
    const updated = domains.filter(d => d.id !== id);
    setDomains(updated);
    await saveDomainsList(updated);

    const landingDomain = updated.find(d => d.usage === 'landing');
    const newPrimary = landingDomain?.domain || '';
    setPrimaryDomain(newPrimary);
    await savePrimaryDomain(newPrimary);

    toast({ title: "Domínio removido", description: "Links atualizados automaticamente." });
  };

  const getDomainForUsage = (usage: string): string => {
    const match = domains.find(d => d.usage === usage);
    return match?.domain || primaryDomain || DEFAULT_URL;
  };

  const baseUrl = primaryDomain || DEFAULT_URL;

  const links = [
    { icon: Globe, label: 'Landing Page (Vendas)', desc: 'Página de vendas principal', url: getDomainForUsage('landing') + '/vendas', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { icon: Users, label: 'Portal da Equipe', desc: 'Login do portal da equipe', url: getDomainForUsage('portal') + '/portal', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { icon: Calendar, label: 'Agendamento Online', desc: 'Agendamento público', url: getDomainForUsage('agendamento') + '/agendar', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { icon: LogIn, label: 'Login do Sistema', desc: 'Link direto para login', url: getDomainForUsage('login') + '/?login=true', color: 'text-green-400', bg: 'bg-green-500/10' },
    { icon: Link2, label: 'Cadastro', desc: 'Link para criar conta', url: getDomainForUsage('cadastro') + '/?cadastro=true', color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { icon: LayoutDashboard, label: 'Dashboard', desc: 'Painel de controle', url: getDomainForUsage('dashboard') + '/members', color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { icon: Zap, label: 'Simplificado', desc: 'Interface simplificada', url: baseUrl, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  ];

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado! 📋", description: `${label} copiado.` });
  };

  const whatsappTemplates = [
    { label: 'Convite para profissionais', msg: `🔧 Ei, técnico de ar condicionado! Conheça o sistema que vai organizar toda sua empresa: ${getDomainForUsage('landing')}/vendas` },
    { label: 'Indicação', msg: `❄️ Estou usando um sistema incrível pra gerenciar meus serviços de ar condicionado. Dá uma olhada: ${getDomainForUsage('landing')}/vendas` },
    { label: 'Link de cadastro', msg: `Cria sua conta aqui pra começar a usar o AC Service Pro: ${getDomainForUsage('cadastro')}/?cadastro=true` },
  ];

  return (
    <div className="space-y-6">
      <AdminGuideCards tab="share" />

      {/* Header */}
      <Card className="bg-[#1a1a2e] border-[#2a2a3a]">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20">
              <Send className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Links & Domínios</h2>
              <p className="text-gray-400 text-sm">Gerencie seus domínios personalizados e links do sistema</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Domínios Personalizados */}
      <Card className="bg-[#1a1a2e] border-[#2a2a3a]">
        <CardContent className="p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-white" />
              <h3 className="text-white font-bold text-base">Domínios Personalizados</h3>
              <Badge className="bg-blue-600 text-white text-[10px] px-2 py-0">PRO</Badge>
            </div>
            <Badge variant="outline" className="border-[#3a3a4a] text-gray-400 text-xs">
              {domains.length} domínio(s)
            </Badge>
          </div>
          <p className="text-gray-400 text-sm -mt-2">Conecte múltiplos domínios para landing page, agendamento, portal e mais</p>

          {/* Add New Domain Form */}
          <div className="bg-[#12121a] border border-[#2a2a3a] rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Plus className="w-4 h-4" />
              Adicionar Novo Domínio
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 text-xs font-medium mb-1 block">Domínio</label>
                <Input
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="meusite.com.br"
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white placeholder:text-gray-600"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs font-medium mb-1 block">Apelido (opcional)</label>
                <Input
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  placeholder="Meu site principal"
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white placeholder:text-gray-600"
                />
              </div>
            </div>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-gray-400 text-xs font-medium mb-1 block">Tipo de uso</label>
                <Select value={newUsage} onValueChange={setNewUsage}>
                  <SelectTrigger className="bg-[#0f0f17] border-[#2a2a3a] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a2e] border-[#2a2a3a]">
                    {USAGE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="text-white">
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-gray-400 ml-1">— {opt.desc}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={addDomain}
                disabled={saving || !newDomain.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 h-10 px-5"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                Adicionar
              </Button>
            </div>
          </div>

          {/* Domain List */}
          {domains.length > 0 && (
            <div className="space-y-2">
              {domains.map((d) => {
                const usageLabel = USAGE_OPTIONS.find(o => o.value === d.usage)?.label || d.usage;
                return (
                  <div key={d.id} className="flex items-center gap-3 bg-[#12121a] border border-[#2a2a3a] rounded-lg p-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-medium truncate">{d.domain}</span>
                        {d.nickname && <span className="text-gray-500 text-xs">({d.nickname})</span>}
                      </div>
                      <span className="text-gray-500 text-xs">{usageLabel}</span>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] shrink-0">Ativo</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(d.domain, d.nickname || d.domain)}
                      className="text-gray-400 hover:text-white h-8 w-8 p-0"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeDomain(d.id)}
                      className="text-gray-400 hover:text-red-400 h-8 w-8 p-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* DNS Instructions */}
          <div className="bg-[#12121a] border border-[#2a2a3a] rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <div className="text-xs text-gray-400 space-y-1">
                <p className="font-medium text-blue-300">Como configurar seu domínio:</p>
                <ol className="list-decimal list-inside space-y-1 ml-1">
                  <li>Compre um domínio (ex: Registro.br, GoDaddy, Hostinger)</li>
                  <li>No painel do domínio, adicione um registro <span className="text-amber-300 font-mono">A</span> para <span className="text-amber-300 font-mono">@</span> apontando para <span className="text-cyan-300 font-mono">185.158.133.1</span></li>
                  <li>Adicione um registro <span className="text-amber-300 font-mono">A</span> para <span className="text-amber-300 font-mono">www</span> apontando para <span className="text-cyan-300 font-mono">185.158.133.1</span></li>
                  <li>Adicione um registro <span className="text-amber-300 font-mono">TXT</span> com nome <span className="text-cyan-300 font-mono">_lovable</span> (o valor será fornecido nas configurações do projeto)</li>
                  <li>No projeto, acesse <span className="text-cyan-300">Settings → Domains</span> e conecte o domínio</li>
                  <li>Cole o domínio aqui — todos os links serão atualizados automaticamente</li>
                </ol>
                <p className="text-gray-500 mt-2">⏱ A propagação do DNS pode levar até 72h após a configuração.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Links Rápidos Grid */}
      <Card className="bg-[#1a1a2e] border-[#2a2a3a]">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
              <LinkIcon className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Links Rápidos & Compartilhamento</h2>
              <p className="text-gray-400 text-sm">Acesse e compartilhe todos os links do sistema</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {links.map((link, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-[#12121a] border border-[#2a2a3a] rounded-xl p-4 hover:border-[#3a3a5a] transition-colors group"
              >
                <div className={`p-2.5 rounded-xl ${link.bg} shrink-0`}>
                  <link.icon className={`w-5 h-5 ${link.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-semibold text-sm">{link.label}</h4>
                  <p className="text-gray-500 text-xs truncate">{link.desc}</p>
                </div>
                <div className="flex gap-1 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(link.url, link.label)}
                    className="text-gray-400 hover:text-white h-8 w-8 p-0"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => window.open(link.url, '_blank')}
                    className="text-gray-400 hover:text-white h-8 w-8 p-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Templates */}
      <Card className="bg-[#1a1a2e] border-[#2a2a3a]">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💬</span>
            <div>
              <h2 className="text-white font-bold text-lg">Mensagens Prontas para WhatsApp</h2>
              <p className="text-gray-400 text-sm">Clique para copiar e enviar</p>
            </div>
          </div>

          <div className="space-y-2">
            {whatsappTemplates.map((tmpl, i) => (
              <div key={i} className="flex items-center gap-3 bg-[#12121a] border border-[#2a2a3a] rounded-lg p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold">{tmpl.label}</p>
                  <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{tmpl.msg}</p>
                </div>
                <Button size="sm" onClick={() => copyToClipboard(tmpl.msg, tmpl.label)}
                  className="bg-green-600 hover:bg-green-700 text-white text-xs shrink-0 h-9 px-4">
                  <Copy className="w-3 h-3 mr-1" /> Copiar
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-2">
        <LinkIcon className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-blue-300 text-xs">
          <span className="font-semibold">Integração automática:</span> Ao configurar um domínio, todos os links do sistema são atualizados automaticamente — Landing Page, Login, Cadastro, Portal, Agendamento e mensagens do WhatsApp.
        </p>
      </div>
    </div>
  );
};

export default AdminShareTab;
