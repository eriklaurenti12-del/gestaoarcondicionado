import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { reconcileFinancialMonth } from '@/utils/recurringSync';
import { toast } from 'sonner';
import { format } from 'date-fns';

/**
 * Atalhos globais:
 * - Ctrl+Shift+R / Cmd+Shift+R → Força limpeza: invalida TODAS as queries,
 *   roda reconciliação financeira do mês atual, faz prefetch de portal/agenda online.
 *   Substitui o hard-reload do navegador por uma correção de dados in-app.
 */
export function useGlobalShortcuts() {
  const qc = useQueryClient();

  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      const isForceRefresh =
        (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'R' || e.key === 'r');
      if (!isForceRefresh) return;
      e.preventDefault();
      e.stopPropagation();

      const t = toast.loading('🧹 Limpando cache e reorganizando dados...');
      try {
        // 1) Invalida tudo
        qc.clear();

        // 2) Reconcilia o mês atual (remove duplicatas, ressincroniza vendas/serviços/contratos)
        const { data: sess } = await supabase.auth.getSession();
        if (sess?.session?.user?.id) {
          await reconcileFinancialMonth(
            sess.session.user.id,
            format(new Date(), 'yyyy-MM'),
            'manual'
          );
        }

        // 3) Pré-aquece dados públicos (agenda online + portal)
        try {
          const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
          const userId = sess?.session?.user?.id;
          if (projectId && userId) {
            fetch(`https://${projectId}.supabase.co/functions/v1/public-booking?user_id=${userId}`).catch(() => {});
          }
        } catch { /* ignore */ }

        toast.dismiss(t);
        toast.success('✅ Sistema limpo e corrigido', {
          description: 'Cache renovado, financeiro reconciliado.',
        });
      } catch (err: any) {
        toast.dismiss(t);
        toast.error('Erro ao limpar', { description: err?.message });
      }
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true } as any);
  }, [qc]);
}
