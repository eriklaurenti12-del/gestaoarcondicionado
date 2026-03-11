import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Globe, Download, ExternalLink, Server, Rocket, Info, CheckCircle, Code2, FolderDown, Github, Link2, LogIn, Calendar, Users, Copy, ShieldCheck, AlertTriangle, Zap, Database } from "lucide-react";
import { DEFAULT_URL } from "@/hooks/useDomainSettings";

interface AdminHostingOptionsProps {
  primaryDomain: string;
}

export const AdminHostingOptions: React.FC<AdminHostingOptionsProps> = ({ primaryDomain }) => {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const baseUrl = primaryDomain || DEFAULT_URL;

  const SYSTEM_PAGES = [
    { key: 'landing', label: 'Landing Page', path: '/vendas', icon: Globe, color: 'text-cyan-400' },
    { key: 'login', label: 'Login', path: '/?login=true', icon: LogIn, color: 'text-green-400' },
    { key: 'cadastro', label: 'Cadastro', path: '/?cadastro=true', icon: Link2, color: 'text-purple-400' },
    { key: 'portal', label: 'Portal Equipe', path: '/portal', icon: Users, color: 'text-blue-400' },
    { key: 'agendamento', label: 'Agendamento', path: '/agendar', icon: Calendar, color: 'text-amber-400' },
  ];

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado! 📋", description: `${label} copiado.` });
  };

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

  const generateVercelConfig = () => {
    const rewrites = SYSTEM_PAGES.map(p => ({
      source: p.key === 'landing' ? '/' : `/${p.key}`,
      destination: baseUrl + p.path,
    }));
    return JSON.stringify({ rewrites }, null, 2);
  };

  const generateNetlifyRedirects = () => {
    return SYSTEM_PAGES.map(p => {
      const from = p.key === 'landing' ? '/' : `/${p.key}`;
      return `${from}    ${baseUrl + p.path}    302`;
    }).join('\n');
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportFullPackage = async (platform: 'vercel' | 'netlify' | 'generic') => {
    setExporting(true);
    try {
      // Main landing page
      downloadFile(
        generatePageHtml('AC Service Pro', baseUrl + '/vendas'),
        'index.html', 'text/html'
      );

      // Sub-pages for each system link
      let delay = 400;
      for (const page of SYSTEM_PAGES) {
        if (page.key === 'landing') continue;
        setTimeout(() => {
          downloadFile(
            generatePageHtml(page.label, baseUrl + page.path),
            `${page.key}.html`, 'text/html'
          );
        }, delay);
        delay += 300;
      }

      // Platform config
      setTimeout(() => {
        if (platform === 'vercel') {
          downloadFile(generateVercelConfig(), 'vercel.json', 'application/json');
        } else if (platform === 'netlify') {
          downloadFile(generateNetlifyRedirects(), '_redirects', 'text/plain');
        }
      }, delay);

      const platformNames = { vercel: 'Vercel', netlify: 'Netlify', generic: 'hospedagem' };
      toast({ 
        title: "Pacote exportado! 🚀", 
        description: `${SYSTEM_PAGES.length} páginas + config para ${platformNames[platform]} baixados.` 
      });
    } catch {
      toast({ title: "Erro na exportação", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const HOSTING_OPTIONS = [
    {
      icon: Globe,
      title: 'Domínio Próprio no Lovable',
      desc: 'Conecte meusite.com.br diretamente — tudo funciona, zero risco',
      badge: 'RECOMENDADO',
      badgeColor: 'bg-emerald-600',
      borderColor: 'border-l-emerald-500',
      features: ['100% compatível', 'SSL automático', 'Integrações intactas'],
      action: () => window.open('https://docs.lovable.dev/features/custom-domain', '_blank'),
      actionLabel: 'Ver como conectar',
      actionIcon: ExternalLink,
    },
    {
      icon: Github,
      title: 'Deploy via GitHub',
      desc: 'Sistema completo na Vercel/Netlify — banco e auth conectados',
      badge: 'AVANÇADO',
      badgeColor: 'bg-gray-700',
      borderColor: 'border-l-gray-500',
      features: ['Sistema inteiro', 'Webhooks via Lovable', 'CI/CD automático'],
      action: () => {
        toast({
          title: "Como fazer deploy via GitHub 🐙",
          description: "Acesse Settings → GitHub no editor Lovable para conectar seu repositório. Depois vincule na Vercel/Netlify.",
        });
      },
      actionLabel: 'Ver instruções',
      actionIcon: ExternalLink,
    },
    {
      icon: Rocket,
      title: 'Exportar para Vercel',
      desc: 'Redirect inteligente — integrações 100% preservadas',
      badge: 'FÁCIL',
      badgeColor: 'bg-blue-600',
      borderColor: 'border-l-blue-500',
      features: ['Integrações intactas', 'vercel.json incluso', 'Sem re-deploy'],
      action: () => exportFullPackage('vercel'),
      actionLabel: 'Exportar pacote Vercel',
      actionIcon: Download,
    },
    {
      icon: Server,
      title: 'Qualquer Hospedagem',
      desc: 'HTML puro — funciona em qualquer servidor do mundo',
      badge: 'UNIVERSAL',
      badgeColor: 'bg-purple-600',
      borderColor: 'border-l-purple-500',
      features: ['Integrações intactas', 'Zero dependências', 'Funciona em tudo'],
      action: () => exportFullPackage('generic'),
      actionLabel: 'Baixar pacote HTML',
      actionIcon: FolderDown,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20">
          <Server className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Hospedagem & Deploy</h2>
          <p className="text-gray-400 text-xs">Hospede seu sistema com domínio próprio — sem "lovable" na URL</p>
        </div>
      </div>

      {/* Pages included info */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
        <p className="text-emerald-300 text-xs font-semibold mb-2">📦 Páginas incluídas na exportação:</p>
        <div className="flex flex-wrap gap-2">
          {SYSTEM_PAGES.map((p) => (
            <span key={p.key} className="flex items-center gap-1 text-[11px] text-gray-300 bg-[#12121a] px-2 py-1 rounded-md border border-[#2a2a3a]">
              <p.icon className={`w-3 h-3 ${p.color}`} />
              {p.label}
            </span>
          ))}
        </div>
      </div>

      {/* Integration Compatibility Table */}
      <Card className="bg-[#1a1a2e] border-[#2a2a3a] border-l-4 border-l-amber-500">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <h3 className="text-white font-bold text-sm">Compatibilidade das Integrações</h3>
          </div>
          <p className="text-gray-400 text-xs">Veja o que funciona em cada método de hospedagem:</p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#2a2a3a]">
                  <th className="text-left text-gray-400 py-2 pr-3 font-medium">Recurso</th>
                  <th className="text-center text-emerald-400 py-2 px-2 font-medium">Domínio Lovable</th>
                  <th className="text-center text-gray-300 py-2 px-2 font-medium">GitHub + Vercel</th>
                  <th className="text-center text-blue-400 py-2 px-2 font-medium">Redirect</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {[
                  { feature: 'Landing Page', lovable: true, github: true, redirect: true },
                  { feature: 'Login / Cadastro', lovable: true, github: true, redirect: true },
                  { feature: 'Dashboard completo', lovable: true, github: true, redirect: true },
                  { feature: 'Banco de dados', lovable: true, github: true, redirect: true },
                  { feature: 'Autenticação (Google)', lovable: true, github: true, redirect: true },
                  { feature: 'Webhooks (Cakto)', lovable: true, github: 'parcial', redirect: true },
                  { feature: 'Edge Functions', lovable: true, github: 'parcial', redirect: true },
                  { feature: 'Deploy automático', lovable: true, github: true, redirect: false },
                  { feature: 'Sem "lovable" na URL', lovable: true, github: true, redirect: true },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-[#1a1a2a]">
                    <td className="py-1.5 pr-3 text-gray-300">{row.feature}</td>
                    <td className="py-1.5 px-2 text-center">
                      {row.lovable ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mx-auto" /> : <span className="text-red-400">✕</span>}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {row.github === true ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mx-auto" /> : 
                       row.github === 'parcial' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mx-auto" /> : 
                       <span className="text-red-400">✕</span>}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {row.redirect ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mx-auto" /> : <span className="text-red-400">✕</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Explanations */}
          <div className="space-y-2 pt-1">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 flex items-start gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-emerald-300 text-[11px]">
                <strong>Redirect (Vercel/Netlify/HTML):</strong> Seu domínio apenas redireciona para o sistema. Todas as integrações continuam funcionando normalmente porque o sistema roda no Lovable Cloud.
              </p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-amber-300 text-[11px]">
                <strong>GitHub + Vercel (deploy completo):</strong> O frontend roda na Vercel, mas as Edge Functions e webhooks continuam apontando para o Lovable Cloud. Funciona, mas webhooks da Cakto precisam manter a URL original do Lovable.
              </p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 flex items-start gap-2">
              <Database className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
              <p className="text-blue-300 text-[11px]">
                <strong>Banco de dados:</strong> Em TODOS os métodos, o banco de dados é o mesmo. Seus clientes, agendamentos, financeiro e configurações ficam seguros e acessíveis de qualquer lugar.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hosting Options */}
      <div className="grid gap-4">
        {HOSTING_OPTIONS.map((opt, i) => (
          <Card key={i} className={`bg-[#1a1a2e] border-[#2a2a3a] border-l-4 ${opt.borderColor}`}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-[#12121a] shrink-0">
                  <opt.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-white font-bold text-sm">{opt.title}</h3>
                    <Badge className={`${opt.badgeColor} text-white text-[10px] px-2 py-0`}>{opt.badge}</Badge>
                  </div>
                  <p className="text-gray-400 text-xs mb-3">{opt.desc}</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {opt.features.map((f, j) => (
                      <span key={j} className="flex items-center gap-1 text-[11px] text-gray-300 bg-[#12121a] px-2 py-1 rounded-md">
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        {f}
                      </span>
                    ))}
                  </div>
                  <Button onClick={opt.action} disabled={exporting}
                    className="bg-[#2a2a3a] hover:bg-[#3a3a4a] text-white text-xs border border-[#3a3a4a] h-9 px-4">
                    <opt.actionIcon className="w-3.5 h-3.5 mr-1.5" />
                    {opt.actionLabel}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* GitHub + Vercel Complete Guide */}
      <Card className="bg-[#1a1a2e] border-[#2a2a3a]">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Github className="w-5 h-5 text-white" />
            <h3 className="text-white font-bold text-sm">Deploy Completo via GitHub + Vercel</h3>
            <Badge className="bg-amber-600 text-white text-[10px] px-2 py-0">SISTEMA INTEIRO</Badge>
          </div>
          <p className="text-gray-400 text-xs">Este método publica o sistema completo (não apenas redirect) com domínio próprio e deploy automático.</p>
          
          <ol className="text-xs text-gray-400 space-y-3 ml-1">
            <li className="flex gap-2">
              <span className="bg-cyan-500/20 text-cyan-400 font-bold w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
              <div>
                <strong className="text-white block">Conecte ao GitHub</strong>
                <span>No editor Lovable, clique no nome do projeto (canto superior esquerdo) → <strong className="text-cyan-300">Settings</strong> → <strong className="text-cyan-300">GitHub</strong> → <strong className="text-cyan-300">Connect project</strong></span>
              </div>
            </li>
            <li className="flex gap-2">
              <span className="bg-cyan-500/20 text-cyan-400 font-bold w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
              <div>
                <strong className="text-white block">Crie o repositório</strong>
                <span>Autorize o Lovable GitHub App e clique em <strong className="text-cyan-300">Create Repository</strong>. Todo seu código será enviado automaticamente.</span>
              </div>
            </li>
            <li className="flex gap-2">
              <span className="bg-cyan-500/20 text-cyan-400 font-bold w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
              <div>
                <strong className="text-white block">Vincule na Vercel</strong>
                <span>Acesse <strong className="text-cyan-300">vercel.com</strong> → New Project → Import Git Repository → selecione o repo criado.</span>
              </div>
            </li>
            <li className="flex gap-2">
              <span className="bg-cyan-500/20 text-cyan-400 font-bold w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5">4</span>
              <div>
                <strong className="text-white block">Configure as variáveis de ambiente</strong>
                <span>Na Vercel, vá em Settings → Environment Variables e adicione:</span>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="bg-[#12121a] text-amber-300 text-[10px] px-2 py-1 rounded font-mono">VITE_SUPABASE_URL</code>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(import.meta.env.VITE_SUPABASE_URL || '', 'VITE_SUPABASE_URL')}
                      className="h-5 w-5 p-0 text-gray-500 hover:text-white"><Copy className="w-3 h-3" /></Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-[#12121a] text-amber-300 text-[10px] px-2 py-1 rounded font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '', 'VITE_SUPABASE_PUBLISHABLE_KEY')}
                      className="h-5 w-5 p-0 text-gray-500 hover:text-white"><Copy className="w-3 h-3" /></Button>
                  </div>
                </div>
              </div>
            </li>
            <li className="flex gap-2">
              <span className="bg-emerald-500/20 text-emerald-400 font-bold w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5">5</span>
              <div>
                <strong className="text-white block">Conecte seu domínio</strong>
                <span>Na Vercel: Settings → Domains → adicione <strong className="text-emerald-300">meusite.com.br</strong>. SSL é automático!</span>
              </div>
            </li>
          </ol>

          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-emerald-300 text-[11px]">
              <strong>Resultado:</strong> Seu sistema completo (landing, login, cadastro, dashboard, portal, agendamento) ficará em <strong>meusite.com.br</strong> com deploy automático a cada alteração no Lovable.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Quick Vercel Guide */}
      <Card className="bg-[#1a1a2e] border-[#2a2a3a]">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-cyan-400" />
            <h3 className="text-white font-bold text-sm">Deploy Rápido (só redirect)</h3>
          </div>
          <ol className="text-xs text-gray-400 space-y-2 ml-1">
            <li className="flex gap-2">
              <span className="text-cyan-400 font-bold shrink-0">1.</span>
              <span>Clique em <strong className="text-white">"Exportar pacote Vercel"</strong> acima para baixar os arquivos</span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400 font-bold shrink-0">2.</span>
              <span>Acesse <strong className="text-cyan-300">vercel.com</strong> → New Project → <strong className="text-white">Upload</strong></span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400 font-bold shrink-0">3.</span>
              <span>Arraste a pasta com os arquivos e publique</span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400 font-bold shrink-0">4.</span>
              <span>Site pronto em <strong className="text-emerald-300">seuprojeto.vercel.app</strong></span>
            </li>
          </ol>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-start gap-2 mt-2">
            <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-blue-300 text-[11px]">
              <strong>Dica:</strong> As páginas redirecionam automaticamente. Atualizações no sistema são refletidas sem re-exportar.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Alternative Hosts */}
      <Card className="bg-[#1a1a2e] border-[#2a2a3a]">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-purple-400" />
            <h3 className="text-white font-bold text-sm">Outras Plataformas</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { name: 'Vercel', url: 'https://vercel.com', tip: 'Import do GitHub automático' },
              { name: 'Netlify', url: 'https://netlify.com', tip: 'Arraste a pasta e publique' },
              { name: 'GitHub Pages', url: 'https://pages.github.com', tip: 'Gratuito com repositório' },
              { name: 'Cloudflare Pages', url: 'https://pages.cloudflare.com', tip: 'CDN global gratuito' },
            ].map((host, i) => (
              <button key={i} onClick={() => window.open(host.url, '_blank')}
                className="bg-[#12121a] border border-[#2a2a3a] rounded-lg p-3 text-left hover:border-[#4a4a5a] transition-colors group">
                <p className="text-white text-xs font-medium group-hover:text-cyan-300 transition-colors">{host.name}</p>
                <p className="text-gray-500 text-[10px] mt-0.5">{host.tip}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminHostingOptions;
