import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X, Smartphone } from 'lucide-react';
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
      
      // Mostrar banner automático após 1 segundo
      setTimeout(() => {
        setShowBanner(true);
      }, 1000);
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
      toast.success('App instalado com sucesso!');
      setDeferredPrompt(null);
      setShowInstall(false);
      setShowBanner(false);
    }
  };

  if (!showInstall) return null;

  return (
    <>
      {/* Botão de instalação na barra de ferramentas */}
      <Button 
        variant="default" 
        size="sm" 
        onClick={handleInstall}
        className="flex items-center gap-1 sm:gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white animate-pulse px-2 sm:px-3"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline text-xs sm:text-sm font-medium">Instalar</span>
      </Button>

      {/* Banner flutuante permanente para instalação */}
      {showBanner && (
        <div className="fixed inset-x-0 bottom-0 z-[9999] p-3 sm:p-4 bg-gradient-to-t from-background via-background to-transparent pointer-events-none">
          <Card className="max-w-md mx-auto shadow-2xl border-2 border-green-500/30 bg-card/95 backdrop-blur-sm pointer-events-auto animate-in slide-in-from-bottom-5">
            <CardHeader className="relative pb-2 pt-3 px-4">
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-6 w-6 hover:bg-destructive/10"
                onClick={() => setShowBanner(false)}
              >
                <X className="h-4 w-4" />
              </Button>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-green-500/10">
                  <Smartphone className="w-5 h-5 text-green-500" />
                </div>
                Instale o Gestão de Negócios
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Acesso rápido em PC e celular
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-4 px-4">
              <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
                  <span className="text-lg">📱</span>
                  <span className="text-center">Offline</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
                  <span className="text-lg">⚡</span>
                  <span className="text-center">Rápido</span>
                </div>
                <div className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50">
                  <span className="text-lg">🔔</span>
                  <span className="text-center">Alertas</span>
                </div>
              </div>
              <Button 
                onClick={handleInstall} 
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-medium"
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
