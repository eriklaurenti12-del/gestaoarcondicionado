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
      <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-center justify-center text-xl md:text-2xl">
              <Lock className="w-5 h-5 md:w-6 md:h-6" />
              Acesso Bloqueado
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground text-sm md:text-base">
              {subscription?.status === 'pendente' 
                ? 'Sua assinatura está aguardando aprovação do administrador.'
                : 'Sua assinatura expirou ou está inativa.'
              }
            </p>
            <p className="text-xs md:text-sm font-medium">
              Entre em contato com o suporte para ativar sua conta.
            </p>
            <a
              href="https://wa.me/5516992600631?text=Olá%20Erik,%20tudo%20bem?%20Preciso%20de%20suporte%20para%20ativar%20minha%20conta"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium px-4 md:px-6 py-2.5 md:py-3 rounded-lg transition-colors text-sm md:text-base"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              Falar com Suporte
            </a>
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
