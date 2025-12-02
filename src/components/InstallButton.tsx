import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Smartphone, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const InstallButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
      
      // Mostrar banner automático após 2 segundos
      const dismissed = localStorage.getItem('pwa-banner-dismissed');
      if (!dismissed) {
        setTimeout(() => {
          setShowBanner(true);
        }, 2000);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Verificar se já está instalado
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstall(false);
      setShowBanner(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast.success('App instalado com sucesso! Acesse pela sua tela inicial.');
      setDeferredPrompt(null);
      setShowInstall(false);
      setShowBanner(false);
      localStorage.setItem('pwa-banner-dismissed', 'true');
    }
  };

  const dismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-banner-dismissed', 'true');
  };

  if (!showInstall) return null;

  return (
    <>
      {/* Botão de instalação compacto */}
      <Button 
        variant="default" 
        size="sm" 
        onClick={handleInstall}
        className="h-8 sm:h-9 px-2 sm:px-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline ml-1.5 text-xs font-medium">Instalar</span>
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
              <Button 
                onClick={handleInstall} 
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-primary-foreground font-medium"
                size="lg"
              >
                <Download className="w-4 h-4 mr-2" />
                Instalar Agora - Grátis
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default InstallButton;
