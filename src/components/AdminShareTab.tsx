import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Globe, Send, Save, Loader2, Info, LinkIcon, Users, Calendar, LogIn, Link2, Plus, Trash2 } from "lucide-react";
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
        if (domainRow?.value) setPrimaryDomain(domainRow.value);
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
      .from('admin_settings').select('id').eq('key', 'custom_domains_list').maybeSingle();
    if (existing) {
      await supabase.from('admin_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', 'custom_domains_list');
    } else {
      await supabase.from('admin_settings').insert({ key: 'custom_domains_list', value, description: 'Lista de domínios personalizados' });
    }
  };

  const savePrimaryDomain = async (domain: string) => {
    for (const [key, value] of [['custom_domain', domain], ['use_custom_domain', domain ? 'true' : 'false']] as const) {
      const { data: existing } = await supabase.from('admin_settings').select('id').eq('key', key).maybeSingle();
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
      if (domain && !domain.startsWith('http')) domain = 'https://' + domain;
      const entry: DomainEntry = { id: crypto.randomUUID(), domain, nickname: newNickname.trim(), usage: newUsage };
      const updated = [...domains, entry];
      setDomains(updated);
      await saveDomainsList(updated);
      if (updated.length === 1 || newUsage === 'landing') {
        setPrimaryDomain(domain);
        await savePrimaryDomain(domain);
      }
      setNewDomain(''); setNewNickname(''); setNewUsage('landing');
      toast({ title: "Domínio adicionado! 🌐", description: `${domain} configurado como ${USAGE_OPTIONS.find(o => o.value === newUsage)?.label}.` });
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    } finally { setSaving(false); }
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
    { icon: Globe, label: 'Landing Page', desc: 'Página de vendas principal', url: getDomainForUsage('landing') + '/vendas', color: 'text-cyan-400', borderColor: 'border-l-cyan-500' },
    { icon: LogIn, label: 'Página de Login', desc: 'Link direto para login', url: getDomainForUsage('login') + '/?login=true', color: 'text-green-400', borderColor: 'border-l-green-500' },
    { icon: Link2, label: 'Página de Cadastro', desc: 'Link direto para criar conta', url: getDomainForUsage('cadastro') + '/?cadastro=true', color: 'text-purple-400', borderColor: 'border-l-purple-500' },
    { icon: Users, label: 'Portal da Equipe', desc: 'Link para equipe administrar e solicitar suporte', url: getDomainForUsage('portal') + '/portal', color: 'text-blue-400', borderColor: 'border-l-blue-500' },
    { icon: Calendar, label: 'Agendamento Online', desc: 'Página pública de agendamento', url: getDomainForUsage('agendamento') + '/agendar', color: 'text-amber-400', borderColor: 'border-l-amber-500' },
  ];

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
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
          <Send className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Compartilhar Links</h2>
          <p className="text-gray-400 text-xs">Copie e compartilhe os links do sistema</p>
        </div>
      </div>

      {/* Domínio Personalizado */}
      <Card className="bg-[#1a1a2e] border-[#2a2a3a] border-l-4 border-l-blue-500">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-white" />
              <h3 className="text-white font-bold text-base">Domínios Personalizados</h3>
              <Badge className="bg-blue-600 text-white text-[10px] px-2 py-0">PRO</Badge>
            </div>
            <Badge variant="outline" className="border-[#3a3a4a] text-gray-400 text-xs">
              {domains.length} domínio(s)
            </Badge>
          </div>
          <p className="text-gray-400 text-xs -mt-2">Conecte múltiplos domínios para landing page, agendamento, portal e mais</p>

          {/* Add New Domain */}
          <div className="bg-[#12121a] border border-[#2a2a3a] rounded-xl p-4 space-y-4">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Plus className="w-4 h-4" />
              Adicionar Novo Domínio
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-gray-300 text-xs font-medium mb-1.5 block">Domínio</label>
                <Input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="meusite.com.br"
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white placeholder:text-gray-600" />
              </div>
              <div>
                <label className="text-gray-300 text-xs font-medium mb-1.5 block">Apelido (opcional)</label>
                <Input value={newNickname} onChange={(e) => setNewNickname(e.target.value)} placeholder="Meu site principal"
                  className="bg-[#0f0f17] border-[#2a2a3a] text-white placeholder:text-gray-600" />
              </div>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-gray-300 text-xs font-medium mb-1.5 block">Tipo de uso</label>
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
              <Button onClick={addDomain} disabled={saving || !newDomain.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 h-10 px-5">
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
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(d.domain, d.nickname || d.domain)}
                      className="text-gray-400 hover:text-white h-8 w-8 p-0"><Copy className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => removeDomain(d.id)}
                      className="text-gray-400 hover:text-red-400 h-8 w-8 p-0"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* DNS Instructions */}
          <div className="bg-[#12121a] border border-[#2a2a3a] rounded-lg p-3 space-y-2">
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

      {/* Links List - Full width cards with visible URLs */}
      <div className="grid gap-4">
        {links.map((link, i) => (
          <Card key={i} className={`bg-[#1a1a2e] border-[#2a2a3a] border-l-4 ${link.borderColor}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-[#12121a]">
                  <link.icon className={`w-5 h-5 ${link.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-sm">{link.label}</h3>
                  <p className="text-gray-500 text-xs">{link.desc}</p>
                  <div className="mt-2">
                    <Input value={link.url} readOnly
                      className="bg-[#0f0f17] border-[#2a2a3a] text-cyan-300 text-xs h-9 font-mono cursor-text" />
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Button size="sm" onClick={() => copyToClipboard(link.url, link.label)}
                    className="bg-[#2a2a3a] hover:bg-[#3a3a4a] text-white text-xs border border-[#3a3a4a] h-8 px-3">
                    <Copy className="w-3 h-3 mr-1" /> Copiar
                  </Button>
                  <Button size="sm" onClick={() => shareLink(link.url, link.label)}
                    className="bg-[#2a2a3a] hover:bg-[#3a3a4a] text-white text-xs border border-[#3a3a4a] h-8 px-3">
                    <Send className="w-3 h-3 mr-1" /> Enviar
                  </Button>
                  <Button size="sm" onClick={() => window.open(link.url, '_blank')}
                    className="bg-[#2a2a3a] hover:bg-[#3a3a4a] text-white text-xs border border-[#3a3a4a] h-8 px-3">
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
          <Card key={i} className="bg-[#1a1a2e] border-[#2a2a3a]">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold">{tmpl.label}</p>
                <p className="text-gray-500 text-xs mt-1 line-clamp-2">{tmpl.msg}</p>
              </div>
              <Button size="sm" onClick={() => copyToClipboard(tmpl.msg, tmpl.label)}
                className="bg-green-600 hover:bg-green-700 text-white text-xs shrink-0 h-9 px-4">
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
