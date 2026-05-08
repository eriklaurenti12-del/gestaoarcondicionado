import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Link2, Copy, Info } from 'lucide-react';
import { BusinessHoursCard } from '@/components/BusinessHoursCard';

export default function OnlineBookingConfigTab() {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
    });
  }, []);

  const publicUrl = userId ? `${window.location.origin}/agendar/${userId}` : '';

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast({ title: '🔗 Link copiado!' });
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-primary/5 p-3 flex items-start gap-2 text-xs">
        <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <div>
          Esta configuração é a <b>mesma</b> usada em <b>Minha Empresa → Horário de Funcionamento</b>.
          Inclui dias, horários, almoço, antecedência, confirmação automática e <b>férias/folgas</b>.
          Qualquer alteração reflete em tempo real na agenda manual e online — sem risco de conflito de horários ou financeiro.
        </div>
      </div>

      <BusinessHoursCard />

      {userId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="w-4 h-4" /> Link público
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Compartilhe este link no WhatsApp, Instagram ou no rodapé do seu site.
            </p>
            <div className="flex gap-2">
              <Input readOnly value={publicUrl} className="font-mono text-xs" />
              <Button variant="outline" onClick={copyLink} className="gap-1.5">
                <Copy className="w-4 h-4" /> Copiar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
