import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw as RefreshIcon, X as XIcon, Sparkles as SparklesIcon, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { forceUpdateApp } from '@/lib/updateApp';

const UpdateNotification: React.FC = () => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateFn, setUpdateFn] = useState<((reload?: boolean) => Promise<void>) | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const handleNeedRefresh = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.updateSW) setUpdateFn(() => detail.updateSW);
      setShowUpdate(true);
    };

    window.addEventListener('pwa:need-refresh', handleNeedRefresh);
    return () => {
      window.removeEventListener('pwa:need-refresh', handleNeedRefresh);
    };
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    if (updateFn) {
      await updateFn(true).catch(() => forceUpdateApp());
    } else {
      await forceUpdateApp();
    }
  };

  return (
    <Dialog open={showUpdate} onOpenChange={setShowUpdate}>
      <DialogContent className="max-w-[90vw] sm:max-w-md bg-slate-900 border-primary/30 text-white p-0 overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-br from-primary/20 via-slate-900 to-slate-900 p-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-4 mx-auto border border-primary/30">
            <RefreshIcon className="w-8 h-8 text-primary animate-spin-slow" />
          </div>
          
          <DialogHeader className="text-center">
            <DialogTitle className="text-2xl font-bold text-white flex items-center justify-center gap-2">
              <SparklesIcon className="w-6 h-6 text-yellow-400" />
              Nova Versão Disponível!
            </DialogTitle>
            <DialogDescription className="text-slate-400 mt-2 text-base">
              Uma nova atualização do sistema HVAC foi detectada. Ela contém correções importantes e melhorias de performance.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-3">
            <Button 
              className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all active:scale-95"
              onClick={handleUpdate}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <RefreshIcon className="w-5 h-5 mr-2 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <RefreshIcon className="w-5 h-5 mr-2" />
                  Atualizar Agora (Foco Total)
                </>
              )}
            </Button>
            
            <Button 
              variant="ghost" 
              className="w-full h-10 text-slate-500 hover:text-slate-300 hover:bg-white/5 text-sm"
              onClick={() => setShowUpdate(false)}
            >
              Fechar e não atualizar
            </Button>
          </div>
          
          <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-center gap-2 text-[10px] text-slate-500 uppercase tracking-widest">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Sincronização PWA Ativa
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateNotification;
