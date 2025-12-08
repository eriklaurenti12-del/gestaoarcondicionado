import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Sparkles, Share } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const InstallButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detectar iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Verificar se já está instalado como PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                       (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    if (standalone) {
      setShowInstall(false);
      setShowBanner(false);
      return;
    }

    // Handler para Chrome/Android
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
      
      const dismissed = localStorage.getItem('pwa-banner-dismissed');
      const lastDismissed = localStorage.getItem('pwa-banner-dismissed-time');
      const dayPassed = lastDismissed ? (Date.now() - parseInt(lastDismissed)) > 86400000 : true;
      
      if (!dismissed || dayPassed) {
        setTimeout(() => setShowBanner(true), 2000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Para iOS, sempre mostrar opção de instalação manual
    if (iOS && !standalone) {
      setShowInstall(true);
      const dismissed = localStorage.getItem('pwa-banner-dismissed');
      const lastDismissed = localStorage.getItem('pwa-banner-dismissed-time');
      const dayPassed = lastDismissed ? (Date.now() - parseInt(lastDismissed)) > 86400000 : true;
      
      if (!dismissed || dayPassed) {
        setTimeout(() => setShowBanner(true), 2000);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      toast.info(
        'Para instalar no iPhone/iPad:\n1. Toque no ícone de compartilhar (📤)\n2. Role e toque em "Adicionar à Tela de Início"',
        { duration: 8000 }
      );
      return;
    }

    if (!deferredPrompt) {
      // Tentar forçar instalação via manifest
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/manifest.json';
      document.head.appendChild(link);
      toast.info('Abra no Chrome e acesse: Menu (⋮) → "Instalar aplicativo"', { duration: 6000 });
      return;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        toast.success('App instalado com sucesso! Acesse pela sua tela inicial.');
        setDeferredPrompt(null);
        setShowInstall(false);
        setShowBanner(false);
        localStorage.setItem('pwa-banner-dismissed', 'true');
      }
    } catch (error) {
      console.error('Erro ao instalar:', error);
      toast.error('Erro ao instalar. Tente novamente.');
    }
  };

  const dismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-banner-dismissed', 'true');
    localStorage.setItem('pwa-banner-dismissed-time', Date.now().toString());
  };

  // Não mostrar se já instalado
  if (isStandalone) return null;

  return (
    <>
      {/* Botão de instalação compacto - sempre visível */}
      <Button 
        variant="default" 
        size="sm" 
        onClick={handleInstall}
        className="h-11 min-h-[44px] px-3 sm:px-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
      >
        {isIOS ? <Share className="w-5 h-5" /> : <Download className="w-5 h-5" />}
        <span className="hidden sm:inline ml-2 text-sm font-medium">Instalar</span>
      </Button>

      {/* Banner flutuante de instalação */}
      {showBanner && (
        <div className="fixed inset-x-0 bottom-0 z-[9999] p-3 sm:p-4 pointer-events-none animate-in slide-in-from-bottom-5 duration-500">
          <Card className="max-w-sm mx-auto shadow-2xl border-2 border-primary/30 bg-card/98 backdrop-blur-md pointer-events-auto">
            <CardHeader className="relative pb-2 pt-4 px-4">
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-7 w-7 hover:bg-destructive/10"
                onClick={dismissBanner}
              >
                <X className="h-4 w-4" />
              </Button>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2 pr-6">
                <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                Instale o App!
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Acesso rápido direto da sua tela inicial
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-4 px-4">
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/50">
                  <span className="text-base">📱</span>
                  <span className="text-center text-[10px] sm:text-xs">Funciona Offline</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/50">
                  <span className="text-base">⚡</span>
                  <span className="text-center text-[10px] sm:text-xs">Super Rápido</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-muted/50">
                  <span className="text-base">🔔</span>
                  <span className="text-center text-[10px] sm:text-xs">Notificações</span>
                </div>
              </div>
              
              {isIOS ? (
                <div className="text-xs text-center text-muted-foreground bg-muted/30 p-3 rounded-lg">
                  <p className="font-medium mb-1">No iPhone/iPad:</p>
                  <p>Toque em <Share className="inline w-4 h-4" /> e depois em "Adicionar à Tela de Início"</p>
                </div>
              ) : (
                <Button 
                  onClick={handleInstall} 
                  className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-medium"
                  size="lg"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Instalar Agora - Grátis
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default InstallButton;
