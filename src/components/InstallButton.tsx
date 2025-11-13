import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
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
      setTimeout(() => {
        setShowBanner(true);
        toast.success('Instale o app para acesso rápido!', {
          description: 'Funciona em PC e celular. Clique no botão "Instalar App".',
          duration: 5000,
        });
      }, 2000);
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
        className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 animate-pulse"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">Instalar App</span>
      </Button>

      {/* Banner flutuante para instalação */}
      {showBanner && (
        <Card className="fixed bottom-4 right-4 w-80 sm:w-96 z-[9999] shadow-2xl border-2 border-primary/20 animate-in slide-in-from-bottom-5">
          <CardHeader className="relative pb-3">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-6 w-6"
              onClick={() => setShowBanner(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <CardTitle className="text-lg flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              Instale o App
            </CardTitle>
            <CardDescription>
              Acesso rápido no PC e celular
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              • Funciona offline<br />
              • Acesso instantâneo<br />
              • Notificações em tempo real
            </p>
            <Button 
              onClick={handleInstall} 
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              <Download className="w-4 h-4 mr-2" />
              Instalar Agora
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default InstallButton;
