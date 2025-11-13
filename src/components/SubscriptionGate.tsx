import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, AlertCircle } from "lucide-react";
import { format, differenceInDays } from "date-fns";

export default function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [daysUntilExpiry, setDaysUntilExpiry] = useState<number | null>(null);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      setSubscription(data);
      setHasAccess(data?.is_active && data?.status === 'aprovado');

      // Calcular dias até vencimento
      if (data?.end_date && data.plan !== 'vitalicio') {
        const days = differenceInDays(new Date(data.end_date), new Date());
        setDaysUntilExpiry(days);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-center justify-center">
              <Lock className="w-6 h-6" />
              Acesso Bloqueado
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              {subscription?.status === 'pendente' 
                ? 'Sua assinatura está aguardando aprovação do administrador.'
                : 'Sua assinatura expirou ou está inativa.'
              }
            </p>
            <p className="text-sm">
              Entre em contato com o suporte para ativar sua conta.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Mostrar alerta 7 dias antes do vencimento
  const showExpiryWarning = daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry > 0;

  return (
    <>
      {showExpiryWarning && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-black p-3 text-center">
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span className="font-bold text-lg">
                Sua assinatura vence em {daysUntilExpiry} {daysUntilExpiry === 1 ? 'dia' : 'dias'}!
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">
                Para renovar, entre em contato:
              </span>
              <a 
                href="https://wa.me/5516993729938?text=Olá%20Natalia,%20quero%20renovar%20minha%20assinatura"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-bold hover:opacity-80"
              >
                WhatsApp: +55 16 99372-9938
              </a>
            </div>
          </div>
        </div>
      )}
      <div className={showExpiryWarning ? 'pt-24' : ''}>
        {children}
      </div>
    </>
  );
}
