import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, ExternalLink, Link2, LogIn, Globe, Share2 } from "lucide-react";
import { AdminGuideCards } from "@/components/AdminGuideCards";

export const AdminShareTab: React.FC = () => {
  const { toast } = useToast();

  const publishedUrl = 'https://gestaoarcondicionado.lovable.app';
  const landingUrl = publishedUrl + '/vendas';
  const loginUrl = publishedUrl + '/?login=true';
  const cadastroUrl = publishedUrl + '/?cadastro=true';

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
      <AdminGuideCards tab="share" />
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
