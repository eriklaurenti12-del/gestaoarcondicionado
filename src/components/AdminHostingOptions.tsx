import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Globe, Download, ExternalLink, Rocket, CheckCircle, 
  Link2, LogIn, Calendar, Users, ChevronRight, 
  ShieldCheck, Zap, Package, Settings2, Copy, Send, Eye,
  Power, PowerOff, RefreshCw, Pencil, Trash2, BookOpen
} from "lucide-react";
import { DEFAULT_URL } from "@/hooks/useDomainSettings";
import JSZip from 'jszip';

interface AdminHostingOptionsProps {
  primaryDomain: string;
}

const SYSTEM_PAGES = [
  { key: 'landing', label: 'Landing Page', path: '/vendas', icon: Globe, color: 'text-cyan-400' },
  { key: 'login', label: 'Login', path: '/?login=true', icon: LogIn, color: 'text-green-400' },
  { key: 'cadastro', label: 'Cadastro', path: '/?cadastro=true', icon: Link2, color: 'text-purple-400' },
  { key: 'portal', label: 'Portal Equipe', path: '/portal', icon: Users, color: 'text-blue-400' },
  { key: 'agendamento', label: 'Agendamento', path: '/agendar', icon: Calendar, color: 'text-amber-400' },
];

const PLATFORMS = [
  { id: 'netlify', name: 'Netlify Drop', desc: 'Mais fácil — Arraste e solte', badge: 'Super Fácil', recommended: true, icon: '🟢', deployUrl: 'https://app.netlify.com/drop', baseDomain: '.netlify.app' },
  { id: 'tiiny', name: 'Tiiny.host', desc: 'Ultra simples — Upload direto', badge: 'Ultra Fácil', recommended: true, icon: '⚡', deployUrl: 'https://tiiny.host/', baseDomain: '.tiiny.site' },
  { id: 'vercel', name: 'Vercel', desc: 'Profissional — Domínio grátis + SSL', badge: 'Fácil', recommended: false, icon: '▲', deployUrl: 'https://vercel.com/new', baseDomain: '.vercel.app' },
  { id: 'cloudflare', name: 'Cloudflare Pages', desc: 'CDN global — Performance máxima', badge: 'Fácil', recommended: false, icon: '🔶', deployUrl: 'https://dash.cloudflare.com/?to=/:account/pages/new/upload', baseDomain: '.pages.dev' },
  { id: 'github', name: 'GitHub Pages', desc: 'Via repositório GitHub', badge: 'Intermediário', recommended: false, icon: '🐙', deployUrl: 'https://pages.github.com/', baseDomain: '.github.io' },
];

const PLATFORM_GUIDES: Record<string, { difficulty: string; free: boolean; summary: string; steps: string[]; warnings?: string[] }> = {
  netlify: {
    difficulty: 'Fácil', free: true,
    summary: 'Arraste e solte o ZIP — sem conta obrigatória',
    steps: [
      'Clique em "Deploy" ao lado do Netlify acima para baixar o ZIP',
      'Acesse app.netlify.com/drop (abre automaticamente)',
      'Arraste o arquivo ZIP na área indicada',
      'Aguarde o deploy (30 segundos) — sua URL será gerada',
      'Copie a URL (ex: random-name.netlify.app) e cole acima em "Salvar URL"',
      'Pronto! Seus links estarão funcionando',
    ],
    warnings: ['A URL gerada será aleatória (ex: jovial-cat-123.netlify.app)', 'Para domínio próprio, crie conta grátis no Netlify'],
  },
  tiiny: {
    difficulty: 'Fácil', free: true,
    summary: 'Upload direto do ZIP — link gerado em segundos',
    steps: [
      'Clique em "Deploy" ao lado do Tiiny.host acima para baixar o ZIP',
      'Acesse tiiny.host (abre automaticamente)',
      'Faça upload do arquivo ZIP',
      'Escolha um nome para o link (ex: meu-sistema)',
      'Clique em "Launch" — URL gerada como meu-sistema.tiiny.site',
      'Cole a URL acima para ativar os links',
    ],
    warnings: ['Plano grátis tem limite de 7 dias', 'Ideal para testes rápidos e demos'],
  },
  vercel: {
    difficulty: 'Fácil', free: true,
    summary: 'Deploy profissional com SSL grátis e domínio personalizado',
    steps: [
      'Baixe o ZIP clicando em "Deploy" acima',
      'Extraia o ZIP em uma pasta no computador',
      'Crie conta grátis em vercel.com (pode usar GitHub)',
      'Arraste a pasta extraída em vercel.com/new',
      'Ou use: npx vercel deploy na pasta pelo terminal',
      'URL gerada automaticamente (ex: meu-site.vercel.app)',
    ],
    warnings: ['Precisa de conta Vercel (grátis)', 'Para domínio próprio: Settings > Domains no Vercel'],
  },
  cloudflare: {
    difficulty: 'Fácil', free: true,
    summary: 'CDN global com performance máxima e SSL automático',
    steps: [
      'Baixe o ZIP clicando em "Deploy" acima',
      'Extraia o ZIP em uma pasta',
      'Acesse dash.cloudflare.com > Pages > Upload Assets',
      'Arraste a pasta extraída ou selecione os arquivos',
      'Escolha um nome para o projeto',
      'Deploy automático — URL como nome.pages.dev',
    ],
    warnings: ['Precisa de conta Cloudflare (grátis)', 'Melhor performance global de todas as opções'],
  },
  github: {
    difficulty: 'Médio', free: true,
    summary: 'Via repositório GitHub — ideal para desenvolvedores',
    steps: [
      'Baixe o ZIP e extraia em uma pasta',
      'Crie repositório no GitHub e faça push dos arquivos',
      'Vá em Settings > Pages no repositório',
      'Selecione "Deploy from a branch" > main',
      'Aguarde o build — URL como usuario.github.io/repo',
    ],
    warnings: ['Requer conhecimento de Git/GitHub', 'Deploy pode levar alguns minutos', 'Repositório precisa ser público no plano grátis'],
  },
};

export const AdminHostingOptions: React.FC<AdminHostingOptionsProps> = ({ primaryDomain }) => {
  const { toast } = useToast();
  const [deploying, setDeploying] = useState<string | null>(null);
  const [showUrlConfig, setShowUrlConfig] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);
  const [selectedPages, setSelectedPages] = useState<string[]>(SYSTEM_PAGES.map(p => p.key));
  const [deployedLinks, setDeployedLinks] = useState<{ platform: string; pages: { label: string; path: string }[] } | null>(null);

  // Deploy management state
  const [deployStatus, setDeployStatus] = useState<{
    active: boolean;
    platform: string;
    projectUrl: string;
    pages: string[];
    deployedAt: string;
  } | null>(null);
  const [editingUrl, setEditingUrl] = useState(false);
  const [tempProjectUrl, setTempProjectUrl] = useState('');

  const baseUrl = primaryDomain || DEFAULT_URL;

  // Load saved deploy status
  useEffect(() => {
    const loadDeployStatus = async () => {
      try {
        const { data } = await supabase
          .from('admin_settings')
          .select('key, value')
          .in('key', ['deploy_status']);
        if (data && data.length > 0) {
          const status = data.find(r => r.key === 'deploy_status');
          if (status?.value) {
            const parsed = JSON.parse(status.value);
            setDeployStatus(parsed);
          }
        }
      } catch (e) {
        console.error('Error loading deploy status:', e);
      }
    };
    loadDeployStatus();
  }, []);

  const saveDeployStatus = async (status: typeof deployStatus) => {
    try {
      await supabase.from('admin_settings').upsert({
        key: 'deploy_status',
        value: JSON.stringify(status),
        description: 'Deploy status and configuration',
      }, { onConflict: 'key' });
      setDeployStatus(status);
    } catch (e) {
      console.error('Error saving deploy status:', e);
    }
  };

  const togglePage = (key: string) => {
    setSelectedPages(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const selectAll = () => setSelectedPages(SYSTEM_PAGES.map(p => p.key));
  const selectNone = () => setSelectedPages([]);

  const generatePageHtml = (title: string, targetUrl: string) => {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - AC Service Pro</title>
  <meta name="description" content="Sistema completo de gestão para empresas de ar condicionado.">
  <meta http-equiv="refresh" content="0;url=${targetUrl}">
  <link rel="canonical" href="${targetUrl}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 50%, #0f0f23 100%);
      color: white; display: flex; align-items: center; justify-content: center;
      min-height: 100vh; text-align: center;
    }
    .container { max-width: 500px; padding: 2rem; }
    .spinner { 
      width: 28px; height: 28px; border: 3px solid rgba(255,255,255,0.15);
      border-top-color: #06b6d4; border-radius: 50%; animation: spin 0.8s linear infinite;
      margin: 0 auto 1.5rem;
    }
    h1 { font-size: 1.4rem; margin-bottom: 0.5rem; }
    p { color: #9ca3af; margin-bottom: 1.5rem; font-size: 0.875rem; }
    a { 
      display: inline-block; padding: 0.75rem 2rem; 
      background: linear-gradient(135deg, #06b6d4, #3b82f6);
      color: white; text-decoration: none; border-radius: 0.75rem; font-weight: 600;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    a:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(6,182,212,0.3); }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h1>❄️ ${title}</h1>
    <p>Redirecionando...</p>
    <a href="${targetUrl}">Acessar agora →</a>
  </div>
  <script>window.location.href="${targetUrl}";</script>
</body>
</html>`;
  };

  const generateZipAndDeploy = async (platform: string) => {
    if (selectedPages.length === 0) {
      toast({ title: "Selecione pelo menos uma página", variant: "destructive" });
      return;
    }

    setDeploying(platform);
    try {
      const zip = new JSZip();
      const pagesToDeploy = SYSTEM_PAGES.filter(p => selectedPages.includes(p.key));

      const landingPage = pagesToDeploy.find(p => p.key === 'landing');
      if (landingPage) {
        zip.file('index.html', generatePageHtml('AC Service Pro', baseUrl + landingPage.path));
      } else {
        const linksHtml = pagesToDeploy.map(p => 
          `<a href="/${p.key}.html" style="margin:0.5rem;display:inline-block;padding:0.5rem 1.5rem;background:linear-gradient(135deg,#06b6d4,#3b82f6);color:white;text-decoration:none;border-radius:0.5rem;font-size:0.875rem;">${p.label}</a>`
        ).join('\n');
        zip.file('index.html', generatePageHtml('AC Service Pro', '').replace(
          '<a href="">Acessar agora →</a>',
          linksHtml
        ));
      }

      for (const page of pagesToDeploy) {
        if (page.key === 'landing') continue;
        zip.file(`${page.key}.html`, generatePageHtml(page.label, baseUrl + page.path));
      }

      if (platform === 'netlify') {
        const redirects = pagesToDeploy.map(p => {
          const from = p.key === 'landing' ? '/' : `/${p.key}`;
          return `${from}    ${baseUrl + p.path}    302`;
        }).join('\n');
        zip.file('_redirects', redirects);
      } else if (platform === 'vercel') {
        const rewrites = pagesToDeploy.map(p => ({
          source: p.key === 'landing' ? '/' : `/${p.key}`,
          destination: baseUrl + p.path,
        }));
        zip.file('vercel.json', JSON.stringify({ rewrites }, null, 2));
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deploy-${platform}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const deployedPages = pagesToDeploy.map(p => ({
        label: p.label,
        path: p.key === 'landing' ? '/' : `/${p.key}.html`,
      }));
      setDeployedLinks({ platform, pages: deployedPages });

      // Save deploy status
      await saveDeployStatus({
        active: true,
        platform,
        projectUrl: '',
        pages: selectedPages,
        deployedAt: new Date().toISOString(),
      });

      const platformConfig = PLATFORMS.find(p => p.id === platform);
      if (platformConfig) {
        setTimeout(() => {
          window.open(platformConfig.deployUrl, '_blank');
        }, 800);
      }

      toast({
        title: "ZIP baixado! 🚀",
        description: `${pagesToDeploy.length} página(s) selecionada(s). Arraste o ZIP na plataforma.`,
      });
    } catch {
      toast({ title: "Erro ao gerar ZIP", variant: "destructive" });
    } finally {
      setDeploying(null);
    }
  };

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({ title: "Link copiado! 📋" });
  };

  const shareLink = async (link: string, label: string) => {
    if (navigator.share) {
      await navigator.share({ title: label, url: link });
    } else {
      copyLink(link);
    }
  };

  const deactivateDeploy = async () => {
    await saveDeployStatus(null);
    setDeployedLinks(null);
    toast({ title: "Deploy desativado", description: "O status do deploy foi removido." });
  };

  const updateProjectUrl = async () => {
    if (!deployStatus) return;
    const updated = { ...deployStatus, projectUrl: tempProjectUrl };
    await saveDeployStatus(updated);
    setEditingUrl(false);
    toast({ title: "✅ URL atualizada!", description: "Os links agora refletem a URL real do seu projeto." });
  };

  const redeployWithSameConfig = () => {
    if (deployStatus) {
      setSelectedPages(deployStatus.pages);
      generateZipAndDeploy(deployStatus.platform);
    }
  };

  return (
    <div className="space-y-4">
      {/* Active Deploy Status Card */}
      {deployStatus?.active && (
        <Card className="bg-[#1a1a2e] border-[#2a2a3a] border-l-4 border-l-emerald-500">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <h3 className="text-sm font-bold text-white">Landing Page Ativa</h3>
                <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30 text-[9px]">
                  {PLATFORMS.find(p => p.id === deployStatus.platform)?.name || deployStatus.platform}
                </Badge>
              </div>
              <span className="text-[10px] text-gray-500">
                {new Date(deployStatus.deployedAt).toLocaleDateString('pt-BR')}
              </span>
            </div>

            {/* Project URL */}
            <div className="space-y-2">
              {deployStatus.projectUrl ? (
                <div className="flex items-center gap-2 bg-[#12121a] border border-[#2a2a3a] rounded-lg px-3 py-2">
                  <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <code className="flex-1 text-cyan-300 text-xs font-mono truncate">{deployStatus.projectUrl}</code>
                  <button onClick={() => copyLink(deployStatus.projectUrl)} className="p-1 rounded text-gray-500 hover:text-cyan-400 transition-colors" title="Copiar">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => window.open(deployStatus.projectUrl, '_blank')} className="p-1 rounded text-gray-500 hover:text-cyan-400 transition-colors" title="Abrir">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { setTempProjectUrl(deployStatus.projectUrl); setEditingUrl(true); }} className="p-1 rounded text-gray-500 hover:text-amber-400 transition-colors" title="Editar">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : editingUrl ? null : (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Cole a URL do seu projeto (ex: https://meu-site.netlify.app)"
                    value={tempProjectUrl}
                    onChange={e => setTempProjectUrl(e.target.value)}
                    className="bg-[#12121a] border-[#2a2a3a] text-white text-xs h-8 flex-1"
                  />
                  <Button size="sm" onClick={updateProjectUrl} disabled={!tempProjectUrl} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8">
                    Salvar URL
                  </Button>
                </div>
              )}

              {editingUrl && (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Nova URL do projeto"
                    value={tempProjectUrl}
                    onChange={e => setTempProjectUrl(e.target.value)}
                    className="bg-[#12121a] border-[#2a2a3a] text-white text-xs h-8 flex-1"
                  />
                  <Button size="sm" onClick={updateProjectUrl} disabled={!tempProjectUrl} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8">
                    Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingUrl(false)} className="text-gray-400 text-xs h-8">
                    Cancelar
                  </Button>
                </div>
              )}
            </div>

            {/* Active pages */}
            <div className="flex flex-wrap gap-1.5">
              {deployStatus.pages.map(pageKey => {
                const page = SYSTEM_PAGES.find(p => p.key === pageKey);
                if (!page) return null;
                const realUrl = deployStatus.projectUrl 
                  ? `${deployStatus.projectUrl}${pageKey === 'landing' ? '' : `/${pageKey}.html`}`
                  : null;
                return (
                  <button
                    key={pageKey}
                    onClick={() => realUrl && window.open(realUrl, '_blank')}
                    className="flex items-center gap-1.5 text-[11px] text-gray-300 bg-[#12121a] px-2.5 py-1 rounded-md border border-[#2a2a3a] hover:border-cyan-500/30 hover:text-white transition-all"
                    title={realUrl || 'Configure a URL primeiro'}
                  >
                    <page.icon className={`w-3 h-3 ${page.color}`} />
                    {page.label}
                    {realUrl && <ExternalLink className="w-2.5 h-2.5 text-gray-500" />}
                  </button>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" onClick={redeployWithSameConfig} className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 gap-1.5">
                <RefreshCw className="w-3 h-3" /> Refazer Deploy
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setDeployedLinks(null); }} className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-xs h-7 gap-1.5">
                <Pencil className="w-3 h-3" /> Alterar Páginas
              </Button>
              <Button size="sm" variant="outline" onClick={deactivateDeploy} className="border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-7 gap-1.5">
                <PowerOff className="w-3 h-3" /> Desativar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Deploy Section */}
      <Card className="bg-[#1a1a2e] border-[#2a2a3a] border-l-4 border-l-blue-500">
        <CardContent className="p-5 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
              <Rocket className="w-5 h-5 text-blue-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Publicar Landing Page com Seu Domínio</h2>
                <Badge className="bg-emerald-600 text-white text-[10px] px-2 py-0">1 CLIQUE</Badge>
              </div>
              <p className="text-gray-400 text-xs">
                Publique sua landing page <strong className="text-gray-300">sem token, sem código, sem complicação</strong> — escolha as páginas e a plataforma
              </p>
            </div>
          </div>

          {/* How it works */}
          <div>
            <p className="text-gray-400 text-xs font-semibold mb-2 flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5" />
              Como funciona (3 passos)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { step: 1, icon: '✅', title: 'Selecione páginas', desc: 'Escolha quais páginas publicar' },
                { step: 2, icon: '🚀', title: 'Clique em Deploy', desc: 'ZIP baixa + plataforma abre' },
                { step: 3, icon: '🔗', title: 'Copie os links', desc: 'Links gerados para compartilhar' },
              ].map((s) => (
                <div key={s.step} className="bg-[#12121a] border border-[#2a2a3a] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-cyan-500/20 text-cyan-400 font-bold w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0">
                      {s.step}
                    </span>
                    <span className="text-sm">{s.icon}</span>
                    <span className="text-white text-xs font-semibold">{s.title}</span>
                  </div>
                  <p className="text-gray-500 text-[10px] ml-7">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Page Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-400 text-xs font-semibold flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                Selecione as páginas para deploy
              </p>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors">
                  Todas
                </button>
                <span className="text-gray-600 text-[10px]">|</span>
                <button onClick={selectNone} className="text-[10px] text-gray-400 hover:text-gray-300 transition-colors">
                  Nenhuma
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SYSTEM_PAGES.map((page) => {
                const isSelected = selectedPages.includes(page.key);
                return (
                  <button
                    key={page.key}
                    onClick={() => togglePage(page.key)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all text-left ${
                      isSelected 
                        ? 'bg-cyan-500/10 border-cyan-500/40 ring-1 ring-cyan-500/20' 
                        : 'bg-[#12121a] border-[#2a2a3a] hover:border-[#3a3a4a]'
                    }`}
                  >
                    <Checkbox 
                      checked={isSelected} 
                      className="pointer-events-none data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
                    />
                    <page.icon className={`w-3.5 h-3.5 ${isSelected ? page.color : 'text-gray-500'}`} />
                    <span className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-gray-500'}`}>
                      {page.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-gray-500 text-[10px] mt-1.5">
              {selectedPages.length} de {SYSTEM_PAGES.length} páginas selecionadas
            </p>
          </div>

          {/* URL Config (collapsible) */}
          <button
            onClick={() => setShowUrlConfig(!showUrlConfig)}
            className="flex items-center gap-1.5 text-gray-400 text-xs hover:text-gray-300 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Configurar URL do sistema (opcional)
            <ChevronRight className={`w-3 h-3 transition-transform ${showUrlConfig ? 'rotate-90' : ''}`} />
          </button>

          {showUrlConfig && (
            <div className="bg-[#12121a] border border-[#2a2a3a] rounded-lg p-3 space-y-2">
              <p className="text-gray-400 text-[11px]">URL base atual do sistema:</p>
              <code className="block text-cyan-300 text-xs bg-[#0a0a14] px-3 py-2 rounded-md font-mono break-all">
                {baseUrl}
              </code>
              <p className="text-gray-500 text-[10px]">
                As páginas de redirect apontarão para esta URL. Para alterar, configure seu domínio personalizado na seção acima.
              </p>
            </div>
          )}

          {/* Platform Selection */}
          <div>
            <p className="text-gray-400 text-xs font-semibold mb-3 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Escolha onde publicar ({selectedPages.length} página{selectedPages.length !== 1 ? 's' : ''})
            </p>
            <div className="space-y-2">
              {PLATFORMS.map((platform) => (
                <div
                  key={platform.id}
                  className="flex items-center gap-3 bg-[#12121a] border border-[#2a2a3a] rounded-lg px-4 py-3 hover:border-[#3a3a4a] transition-colors"
                >
                  <span className="text-lg shrink-0 w-6 text-center">{platform.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-semibold">{platform.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[#3a3a4a] text-gray-400">
                        {platform.badge}
                      </Badge>
                      {platform.recommended && (
                        <Badge className="bg-emerald-600/80 text-white text-[9px] px-1.5 py-0 flex items-center gap-0.5">
                          <span>⭐</span> Recomendado
                        </Badge>
                      )}
                    </div>
                    <p className="text-gray-500 text-[11px]">{platform.desc}</p>
                  </div>
                  <Button
                    onClick={() => generateZipAndDeploy(platform.id)}
                    disabled={deploying !== null || selectedPages.length === 0}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-4 gap-1.5"
                    size="sm"
                  >
                    <Rocket className="w-3.5 h-3.5" />
                    {deploying === platform.id ? 'Gerando...' : 'Deploy'}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Deploy Links (shown after deploy) */}
          {deployedLinks && (
            <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <p className="text-emerald-300 text-sm font-semibold">
                  Deploy gerado! Links das páginas:
                </p>
              </div>
              <p className="text-gray-400 text-[11px]">
                Após arrastar o ZIP na plataforma, cole a URL do projeto abaixo para gerar links reais:
              </p>
              
              {/* Quick URL input */}
              {!deployStatus?.projectUrl && (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Cole a URL do seu projeto (ex: https://meu-site.netlify.app)"
                    value={tempProjectUrl}
                    onChange={e => setTempProjectUrl(e.target.value)}
                    className="bg-[#0a0a14] border-[#2a2a3a] text-white text-xs h-8 flex-1"
                  />
                  <Button size="sm" onClick={updateProjectUrl} disabled={!tempProjectUrl} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8">
                    Salvar
                  </Button>
                </div>
              )}

              <div className="space-y-1.5">
                {deployedLinks.pages.map((page) => {
                  const platformInfo = PLATFORMS.find(p => p.id === deployedLinks.platform);
                  const realUrl = deployStatus?.projectUrl 
                    ? `${deployStatus.projectUrl}${page.path === '/' ? '' : page.path}`
                    : `https://seu-projeto${platformInfo?.baseDomain || ''}${page.path}`;
                  const hasRealUrl = !!deployStatus?.projectUrl;
                  return (
                    <div key={page.label} className="flex items-center gap-2 bg-[#0a0a14] rounded-md px-3 py-2">
                      <span className="text-gray-300 text-xs font-medium min-w-[100px]">{page.label}</span>
                      <code className={`flex-1 text-[11px] font-mono truncate ${hasRealUrl ? 'text-emerald-300' : 'text-cyan-300'}`}>{realUrl}</code>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => copyLink(realUrl)} className="p-1 rounded text-gray-500 hover:text-cyan-400 hover:bg-[#1a1a2e] transition-colors" title="Copiar">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => shareLink(realUrl, page.label)} className="p-1 rounded text-gray-500 hover:text-cyan-400 hover:bg-[#1a1a2e] transition-colors" title="Enviar">
                          <Send className="w-3.5 h-3.5" />
                        </button>
                        {hasRealUrl && (
                          <button onClick={() => window.open(realUrl, '_blank')} className="p-1 rounded text-gray-500 hover:text-cyan-400 hover:bg-[#1a1a2e] transition-colors" title="Abrir">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Advanced Export (collapsible) */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-gray-400 text-xs hover:text-gray-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar apenas HTML (avançado)
            <ChevronRight className={`w-3 h-3 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
          </button>

          {showAdvanced && (
            <div className="bg-[#12121a] border border-[#2a2a3a] rounded-lg p-3 space-y-3">
              <p className="text-gray-400 text-[11px]">Baixe os arquivos HTML individuais para hospedagem manual:</p>
              <div className="flex flex-wrap gap-2">
                {SYSTEM_PAGES.filter(p => selectedPages.includes(p.key)).map((page) => (
                  <span key={page.key} className="flex items-center gap-1 text-[11px] text-gray-300 bg-[#0a0a14] px-2 py-1 rounded-md border border-[#2a2a3a]">
                    <page.icon className={`w-3 h-3 ${page.color}`} />
                    {page.label}
                  </span>
                ))}
              </div>
              <Button
                onClick={() => generateZipAndDeploy('generic')}
                disabled={deploying !== null || selectedPages.length === 0}
                variant="outline"
                className="text-xs h-8 border-[#3a3a4a] text-gray-300 hover:bg-[#2a2a3a]"
                size="sm"
              >
                <Package className="w-3.5 h-3.5 mr-1.5" />
                Baixar ZIP universal
              </Button>
            </div>
          )}

          {/* Integrations safe (collapsible) */}
          <button
            onClick={() => setShowIntegrations(!showIntegrations)}
            className="flex items-center gap-1.5 text-gray-400 text-xs hover:text-gray-300 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Suas integrações continuam seguras
            <ChevronRight className={`w-3 h-3 transition-transform ${showIntegrations ? 'rotate-90' : ''}`} />
          </button>

          {showIntegrations && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 space-y-2">
              <p className="text-emerald-300 text-[11px]">
                <strong>Todas as integrações funcionam normalmente!</strong> O deploy cria páginas de redirect inteligente que apontam para seu sistema. 
                Banco de dados, autenticação, webhooks e tudo mais continuam funcionando porque o sistema roda no Lovable Cloud.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['Banco de dados', 'Autenticação', 'Webhooks', 'Edge Functions', 'Dashboard'].map((item) => (
                  <span key={item} className="flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    <CheckCircle className="w-2.5 h-2.5" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══════════ GUIA DE INSTRUÇÕES POR PLATAFORMA ═══════════ */}
      <Card className="bg-[#1a1a2e] border-[#2a2a3a] border-l-4 border-l-amber-500">
        <CardContent className="p-5 space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
              <BookOpen className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white">Guia de Deploy por Plataforma</h2>
              <p className="text-gray-400 text-xs">
                Instruções passo-a-passo e status de compatibilidade de cada plataforma
              </p>
            </div>
          </div>

          {/* Status geral */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Funciona ✅', items: ['Redirect HTML', 'Auth/Login', 'Webhooks', 'Banco de dados'], color: 'emerald' },
              { label: 'Atenção ⚠️', items: ['SEO limitado', 'URL diferente', 'Cache do navegador'], color: 'amber' },
              { label: 'Não funciona ❌', items: ['SSR/SEO dinâmico', 'Service Worker ext.'], color: 'red' },
              { label: 'Dica 💡', items: ['Use domínio próprio', 'Ative HTTPS', 'Teste antes de enviar'], color: 'blue' },
            ].map((section) => (
              <div key={section.label} className={`bg-${section.color}-500/5 border border-${section.color}-500/20 rounded-lg p-3`}>
                <p className={`text-${section.color}-400 text-xs font-bold mb-1.5`}>{section.label}</p>
                <ul className="space-y-0.5">
                  {section.items.map((item) => (
                    <li key={item} className="text-[10px] text-gray-400">• {item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Platform guides */}
          <div className="space-y-2">
            {PLATFORMS.map((platform) => {
              const isExpanded = expandedGuide === platform.id;
              const guide = PLATFORM_GUIDES[platform.id];
              if (!guide) return null;
              return (
                <div key={platform.id} className="bg-[#12121a] border border-[#2a2a3a] rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedGuide(isExpanded ? null : platform.id)}
                    className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[#1a1a2e] transition-colors text-left"
                  >
                    <span className="text-lg shrink-0">{platform.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-semibold">{platform.name}</span>
                        <Badge className={`text-[9px] px-1.5 py-0 ${guide.difficulty === 'Fácil' ? 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30' : guide.difficulty === 'Médio' ? 'bg-amber-600/20 text-amber-400 border-amber-600/30' : 'bg-red-600/20 text-red-400 border-red-600/30'}`}>
                          {guide.difficulty}
                        </Badge>
                        {guide.free && <Badge className="bg-cyan-600/20 text-cyan-400 border-cyan-600/30 text-[9px] px-1.5 py-0">Grátis</Badge>}
                      </div>
                      <p className="text-gray-500 text-[11px]">{guide.summary}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-[#2a2a3a] pt-3">
                      <ol className="space-y-2">
                        {guide.steps.map((step, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="bg-cyan-500/20 text-cyan-400 font-bold w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <span className="text-gray-300 text-xs">{step}</span>
                          </li>
                        ))}
                      </ol>

                      {guide.warnings && guide.warnings.length > 0 && (
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-md p-2.5">
                          <p className="text-amber-400 text-[10px] font-bold mb-1">⚠️ Atenção:</p>
                          {guide.warnings.map((w, i) => (
                            <p key={i} className="text-amber-300/70 text-[10px]">• {w}</p>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={() => generateZipAndDeploy(platform.id)}
                          disabled={deploying !== null || selectedPages.length === 0}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 gap-1"
                        >
                          <Rocket className="w-3 h-3" /> Deploy agora
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(platform.deployUrl, '_blank')}
                          className="border-[#3a3a4a] text-gray-300 text-xs h-7 gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Abrir {platform.name}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const text = `📋 Guia de Deploy — ${platform.name}\n\n${guide.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n${guide.warnings?.map(w => `⚠️ ${w}`).join('\n') || ''}\n\n🔗 Acesse: ${platform.deployUrl}`;
                            if (navigator.share) {
                              navigator.share({ title: `Guia ${platform.name}`, text });
                            } else {
                              navigator.clipboard.writeText(text);
                              toast({ title: "Instruções copiadas! 📋" });
                            }
                          }}
                          className="border-[#3a3a4a] text-gray-300 text-xs h-7 gap-1"
                        >
                          <Send className="w-3 h-3" /> Enviar instruções
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminHostingOptions;
