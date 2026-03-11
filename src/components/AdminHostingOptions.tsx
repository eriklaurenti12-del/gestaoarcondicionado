import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Globe, Download, ExternalLink, Server, Rocket, Copy, Info, CheckCircle, Code2, FolderDown } from "lucide-react";
import { DEFAULT_URL } from "@/hooks/useDomainSettings";

interface AdminHostingOptionsProps {
  primaryDomain: string;
}

export const AdminHostingOptions: React.FC<AdminHostingOptionsProps> = ({ primaryDomain }) => {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const baseUrl = primaryDomain || DEFAULT_URL;
  const landingUrl = baseUrl + '/vendas';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado! 📋", description: `${label} copiado.` });
  };

  const generateRedirectPage = () => {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AC Service Pro - Sistema de Gestão para Ar Condicionado</title>
  <meta name="description" content="Sistema completo de gestão para empresas de ar condicionado. Controle clientes, agendamentos, financeiro e muito mais.">
  <meta http-equiv="refresh" content="0;url=${landingUrl}">
  <link rel="canonical" href="${landingUrl}">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 50%, #0f0f23 100%);
      color: white; display: flex; align-items: center; justify-content: center;
      min-height: 100vh; text-align: center;
    }
    .container { max-width: 500px; padding: 2rem; }
    .logo { font-size: 2.5rem; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #9ca3af; margin-bottom: 1.5rem; font-size: 0.9rem; }
    a { 
      display: inline-block; padding: 0.75rem 2rem; background: linear-gradient(135deg, #06b6d4, #3b82f6);
      color: white; text-decoration: none; border-radius: 0.75rem; font-weight: 600;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    a:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(6,182,212,0.3); }
    .spinner { 
      width: 24px; height: 24px; border: 3px solid rgba(255,255,255,0.2);
      border-top-color: #06b6d4; border-radius: 50%; animation: spin 0.8s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <div class="logo">❄️</div>
    <h1>AC Service Pro</h1>
    <p>Redirecionando para o sistema...</p>
    <a href="${landingUrl}">Acessar agora →</a>
  </div>
  <script>window.location.href="${landingUrl}";</script>
</body>
</html>`;
  };

  const generateVercelConfig = () => {
    return JSON.stringify({
      rewrites: [
        { source: "/(.*)", destination: landingUrl + "/$1" }
      ],
      redirects: [
        { source: "/", destination: landingUrl, statusCode: 302 }
      ]
    }, null, 2);
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

  const exportForVercel = async () => {
    setExporting(true);
    try {
      const indexHtml = generateRedirectPage();
      const vercelJson = generateVercelConfig();
      
      // Download as individual files
      downloadFile(indexHtml, 'index.html', 'text/html');
      setTimeout(() => {
        downloadFile(vercelJson, 'vercel.json', 'application/json');
      }, 500);

      toast({ 
        title: "Arquivos exportados! 🚀", 
        description: "Baixe index.html e vercel.json. Envie para o Vercel/Netlify." 
      });
    } catch {
      toast({ title: "Erro na exportação", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const exportRedirectOnly = () => {
    const html = generateRedirectPage();
    downloadFile(html, 'index.html', 'text/html');
    toast({ title: "Landing exportada! 📄", description: "Arquivo index.html baixado com sucesso." });
  };

  const HOSTING_OPTIONS = [
    {
      icon: Globe,
      title: 'Domínio Próprio no Lovable',
      desc: 'Conecte seu domínio diretamente — sem deploy manual',
      badge: 'RECOMENDADO',
      badgeColor: 'bg-emerald-600',
      borderColor: 'border-l-emerald-500',
      features: ['SSL automático', 'Sem configuração extra', 'Atualizações em tempo real'],
      action: () => window.open('https://docs.lovable.dev/features/custom-domain', '_blank'),
      actionLabel: 'Ver como conectar',
      actionIcon: ExternalLink,
    },
    {
      icon: Rocket,
      title: 'Deploy na Vercel',
      desc: 'Exporte e hospede na Vercel com domínio gratuito .vercel.app',
      badge: 'GRATUITO',
      badgeColor: 'bg-blue-600',
      borderColor: 'border-l-blue-500',
      features: ['Domínio .vercel.app grátis', 'Deploy em 2 minutos', 'CDN global'],
      action: exportForVercel,
      actionLabel: 'Exportar para Vercel',
      actionIcon: Download,
    },
    {
      icon: Server,
      title: 'Qualquer Hospedagem',
      desc: 'Baixe o HTML e suba em qualquer hospedagem (Hostinger, cPanel, etc)',
      badge: 'UNIVERSAL',
      badgeColor: 'bg-purple-600',
      borderColor: 'border-l-purple-500',
      features: ['Funciona em qualquer servidor', 'Arquivo único HTML', 'Zero dependências'],
      action: exportRedirectOnly,
      actionLabel: 'Baixar index.html',
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
          <p className="text-gray-400 text-xs">Hospede sua landing page sem o nome "lovable" na URL</p>
        </div>
      </div>

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

      {/* Vercel Step-by-Step Guide */}
      <Card className="bg-[#1a1a2e] border-[#2a2a3a]">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-cyan-400" />
            <h3 className="text-white font-bold text-sm">Guia Rápido: Deploy na Vercel</h3>
          </div>
          <ol className="text-xs text-gray-400 space-y-2 ml-1">
            <li className="flex gap-2">
              <span className="text-cyan-400 font-bold shrink-0">1.</span>
              <span>Clique em <strong className="text-white">"Exportar para Vercel"</strong> acima para baixar os arquivos</span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400 font-bold shrink-0">2.</span>
              <span>Acesse <strong className="text-cyan-300">vercel.com</strong> e crie uma conta gratuita (pode usar GitHub/Google)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400 font-bold shrink-0">3.</span>
              <span>Clique em <strong className="text-white">"New Project"</strong> → <strong className="text-white">"Upload"</strong> e arraste a pasta com os arquivos</span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400 font-bold shrink-0">4.</span>
              <span>Pronto! Seu site estará em <strong className="text-emerald-300">seuprojeto.vercel.app</strong> — sem "lovable" na URL</span>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400 font-bold shrink-0">5.</span>
              <span><strong className="text-amber-300">Opcional:</strong> Na Vercel, vá em Settings → Domains e conecte seu domínio próprio gratuitamente</span>
            </li>
          </ol>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-start gap-2 mt-2">
            <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-blue-300 text-[11px]">
              <strong>Dica:</strong> A página exportada redireciona automaticamente para seu sistema. Toda atualização que você fizer aqui será refletida sem precisar re-exportar.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Alternative Hosts */}
      <Card className="bg-[#1a1a2e] border-[#2a2a3a]">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-purple-400" />
            <h3 className="text-white font-bold text-sm">Outras Opções de Hospedagem</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { name: 'Netlify', url: 'https://netlify.com', tip: 'Arraste a pasta e publique' },
              { name: 'GitHub Pages', url: 'https://pages.github.com', tip: 'Gratuito com repositório' },
              { name: 'Hostinger', url: 'https://hostinger.com.br', tip: 'Upload via File Manager' },
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
