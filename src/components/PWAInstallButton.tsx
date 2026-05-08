import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Download, X, Share } from "lucide-react";
import { toast } from "sonner";

const checkInstalled = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    localStorage.getItem('pwa-installed') === 'true' ||
    localStorage.getItem('pwa-install-dismissed-forever') === 'true';
};

const PWAInstallButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => checkInstalled());
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (checkInstalled()) {
      setIsInstalled(true);
      return;
    }

    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setIsVisible(true), 3000);
    };

    const installedHandler = () => {
      setIsInstalled(true);
      setIsVisible(false);
      localStorage.setItem('pwa-installed', 'true');
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (isIOS) {
      toast.info('Para instalar: toque em 📤 (compartilhar) → "Adicionar à Tela de Início"', { duration: 6000 });
      return;
    }

    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          toast.success('🎉 App instalado com sucesso!');
          setIsInstalled(true);
          setIsVisible(false);
          setDeferredPrompt(null);
          localStorage.setItem('pwa-installed', 'true');
        }
      } catch (err) {
        console.error('PWA Install Error:', err);
        toast.error('Erro ao instalar. Tente pelo menu do navegador.');
      }
    } else {
      toast.info('Abra no Chrome → Menu (⋮) → "Instalar aplicativo"');
    }
  }, [deferredPrompt, isIOS]);

  if (isInstalled || (!isVisible && !isIOS)) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] md:left-auto md:max-w-xs animate-in slide-in-from-bottom-10 duration-700">
      <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-1 rounded-2xl shadow-2xl overflow-hidden ring-4 ring-white/10 dark:ring-black/20">
        <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl flex items-center gap-4">
          <div className="bg-cyan-100 dark:bg-cyan-900/30 p-2 rounded-lg">
            <Download className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm text-foreground truncate">Instalar AC Service Pro</h4>
            <p className="text-[11px] text-muted-foreground leading-tight">Tenha acesso rápido e notificações direto no seu aparelho.</p>
          </div>
          <div className="flex flex-col gap-1">
            <Button size="sm" onClick={handleInstall} className="h-9 px-4 rounded-lg text-xs font-bold">
              {isIOS ? <Share className="w-3 h-3 mr-1" /> : <Download className="w-3 h-3 mr-1" />}
              INSTALAR
            </Button>
            <button 
              onClick={() => {
                setIsVisible(false);
                localStorage.setItem('pwa-install-dismissed-forever', 'true');
              }}
              className="text-[10px] text-muted-foreground hover:text-foreground underline transition-colors"
            >
              Não mostrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallButton;
