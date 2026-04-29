import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const UpdateNotification: React.FC = () => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateFn, setUpdateFn] = useState<((reload?: boolean) => Promise<void>) | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const handleNeedRefresh = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.updateSW) setUpdateFn(() => detail.updateSW);
      setShowUpdate(true);
      // Also surface as a toast so users see it even if they dismiss the banner
      toast.success('🎉 Nova versão disponível!', {
        description: 'Clique em "Atualizar" para aplicar as melhorias.',
        duration: 8000,
      });
    };

    const handleOfflineReady = () => {
      toast.success('✅ App pronto para uso offline');
    };

    window.addEventListener('pwa:need-refresh', handleNeedRefresh);
    window.addEventListener('pwa:offline-ready', handleOfflineReady);

    return () => {
      window.removeEventListener('pwa:need-refresh', handleNeedRefresh);
      window.removeEventListener('pwa:offline-ready', handleOfflineReady);
    };
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      if (updateFn) {
        // This activates the new SW and reloads the page
        await updateFn(true);
      } else {
        // Fallback: hard reload
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };

  if (!showUpdate) return null;

  return (
    <div className={cn(
      "fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-md",
      "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-xl shadow-2xl p-4 border border-primary-foreground/10",
      "animate-in slide-in-from-top-5 duration-300"
    )}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-white/15 rounded-lg flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">Nova versão disponível!</p>
            <p className="text-xs opacity-90 truncate">Atualize para receber as novas melhorias.</p>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleUpdate}
            disabled={isUpdating}
            className="h-8 px-3 text-xs font-semibold"
          >
            {isUpdating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                Atualizar
              </>
            )}
          </Button>
          <button
            onClick={() => setShowUpdate(false)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
