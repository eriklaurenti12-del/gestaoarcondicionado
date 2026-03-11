import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Globe, Download, ExternalLink, Server, Rocket, Info, CheckCircle, 
  Code2, Github, Link2, LogIn, Calendar, Users, ChevronRight, 
  ShieldCheck, Zap, Upload, Package, Settings2
} from "lucide-react";
import { DEFAULT_URL } from "@/hooks/useDomainSettings";
import JSZip from 'jszip';

interface AdminHostingOptionsProps {
  primaryDomain: string;
}

export const AdminHostingOptions: React.FC<AdminHostingOptionsProps> = ({ primaryDomain }) => {
  const { toast } = useToast();
  const [deploying, setDeploying] = useState<string | null>(null);
  const [showUrlConfig, setShowUrlConfig] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(false);

  const baseUrl = primaryDomain || DEFAULT_URL;

  const SYSTEM_PAGES = [
    { key: 'landing', label: 'Landing Page', path: '/vendas', icon: Globe, color: 'text-cyan-400' },
    { key: 'login', label: 'Login', path: '/?login=true', icon: LogIn, color: 'text-green-400' },
    { key: 'cadastro', label: 'Cadastro', path: '/?cadastro=true', icon: Link2, color: 'text-purple-400' },
    { key: 'portal', label: 'Portal Equipe', path: '/portal', icon: Users, color: 'text-blue-400' },
    { key: 'agendamento', label: 'Agendamento', path: '/agendar', icon: Calendar, color: 'text-amber-400' },
  ];

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
    setDeploying(platform);
    try {
      const zip = new JSZip();

      // index.html (landing)
      zip.file('index.html', generatePageHtml('AC Service Pro', baseUrl + '/vendas'));

      // Sub-pages
      for (const page of SYSTEM_PAGES) {
        if (page.key === 'landing') continue;
        zip.file(`${page.key}.html`, generatePageHtml(page.label, baseUrl + page.path));
      }

      // Platform-specific configs
      if (platform === 'netlify') {
        const redirects = SYSTEM_PAGES.map(p => {
          const from = p.key === 'landing' ? '/' : `/${p.key}`;
          return `${from}    ${baseUrl + p.path}    302`;
        }).join('\n');
        zip.file('_redirects', redirects);
      } else if (platform === 'vercel') {
        const rewrites = SYSTEM_PAGES.map(p => ({
          source: p.key === 'landing' ? '/' : `/${p.key}`,
          destination: baseUrl + p.path,
        }));
        zip.file('vercel.json', JSON.stringify({ rewrites }, null, 2));
      }

      // Generate and download ZIP
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `deploy-${platform}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Open platform automatically
      const platformUrls: Record<string, string> = {
        netlify: 'https://app.netlify.com/drop',
        tiiny: 'https://tiiny.host/',
        vercel: 'https://vercel.com/new',
        cloudflare: 'https://dash.cloudflare.com/?to=/:account/pages/new/upload',
        github: 'https://pages.github.com/',
      };

      setTimeout(() => {
        if (platformUrls[platform]) {
          window.open(platformUrls[platform], '_blank');
        }
      }, 800);

      toast({
        title: "ZIP baixado! 🚀",
        description: `Arraste o ZIP na plataforma que abriu e seu site estará online em segundos.`,
      });
    } catch {
      toast({ title: "Erro ao gerar ZIP", variant: "destructive" });
    } finally {
      setDeploying(null);
    }
  };

  const PLATFORMS = [
    {
      id: 'netlify',
      name: 'Netlify Drop',
      desc: 'Mais fácil — Arraste e solte',
      badge: 'Super Fácil',
      recommended: true,
      icon: '🟢',
      iconColor: 'text-green-400',
    },
    {
      id: 'tiiny',
      name: 'Tiiny.host',
      desc: 'Ultra simples — Upload direto',
      badge: 'Ultra Fácil',
      recommended: true,
      icon: '⚡',
      iconColor: 'text-pink-400',
    },
    {
      id: 'vercel',
      name: 'Vercel',
      desc: 'Profissional — Domínio grátis + SSL',
      badge: 'Fácil',
      recommended: false,
      icon: '▲',
      iconColor: 'text-white',
    },
    {
      id: 'cloudflare',
      name: 'Cloudflare Pages',
      desc: 'CDN global — Performance máxima',
      badge: 'Fácil',
      recommended: false,
      icon: '🔶',
      iconColor: 'text-orange-400',
    },
    {
      id: 'github',
      name: 'GitHub Pages',
      desc: 'Via repositório GitHub',
      badge: 'Intermediário',
      recommended: false,
      icon: '🐙',
      iconColor: 'text-purple-400',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Main Section */}
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
                Publique sua landing page <strong className="text-gray-300">sem token, sem código, sem complicação</strong> — escolha a plataforma e clique
              </p>
            </div>
          </div>

          {/* How it works (3 steps) */}
          <div>
            <p className="text-gray-400 text-xs font-semibold mb-2 flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5" />
              Como funciona (3 passos)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { step: 1, icon: '🚀', title: 'Clique em Deploy', desc: 'Escolha a plataforma abaixo' },
                { step: 2, icon: '📦', title: 'ZIP baixa sozinho', desc: '+ a plataforma abre automaticamente' },
                { step: 3, icon: '🎉', title: 'Arraste e solte', desc: 'Seu site fica online em segundos' },
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
              Escolha onde publicar (1 clique!)
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
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        const urls: Record<string, string> = {
                          netlify: 'https://app.netlify.com/drop',
                          tiiny: 'https://tiiny.host/',
                          vercel: 'https://vercel.com/new',
                          cloudflare: 'https://dash.cloudflare.com/?to=/:account/pages/new/upload',
                          github: 'https://pages.github.com/',
                        };
                        window.open(urls[platform.id], '_blank');
                      }}
                      className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-[#2a2a3a] transition-colors"
                      title="Abrir plataforma"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                    <Button
                      onClick={() => generateZipAndDeploy(platform.id)}
                      disabled={deploying !== null}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-4 gap-1.5"
                      size="sm"
                    >
                      <Rocket className="w-3.5 h-3.5" />
                      {deploying === platform.id ? 'Gerando...' : 'Deploy'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

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
                {SYSTEM_PAGES.map((page) => (
                  <span key={page.key} className="flex items-center gap-1 text-[11px] text-gray-300 bg-[#0a0a14] px-2 py-1 rounded-md border border-[#2a2a3a]">
                    <page.icon className={`w-3 h-3 ${page.color}`} />
                    {page.label}
                  </span>
                ))}
              </div>
              <Button
                onClick={() => generateZipAndDeploy('generic')}
                disabled={deploying !== null}
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
    </div>
  );
};

export default AdminHostingOptions;
