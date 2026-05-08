import { useEffect, useState, createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { differenceInDays, differenceInHours, addDays } from "date-fns";

// Context to share subscription data
interface SubscriptionContextType {
  subscription: any;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  isTrial: boolean;
  isExpiringSoon: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  return context;
};

export default function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [daysUntilExpiry, setDaysUntilExpiry] = useState<number | null>(null);
  const [hoursRemaining, setHoursRemaining] = useState<number | null>(null);
  const [isTrial, setIsTrial] = useState(false);

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser(); const user = authData?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: subData, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      setSubscription(subData);
      
      const now = new Date();
      
      // Check if subscription is approved and active
      if (subData?.is_active && subData?.status === 'aprovado') {
        setHasAccess(true);
        setIsTrial(false);
        
        // Calculate days until expiry for non-lifetime plans
        if (subData?.end_date && subData.plan !== 'vitalicio') {
          const days = differenceInDays(new Date(subData.end_date), now);
          setDaysUntilExpiry(days);
        }
      } 
      // Check if it's a trial (pending status = 1 day trial from start_date or created_at)
      else if (subData?.status === 'pendente') {
        const startDate = subData?.start_date ? new Date(subData.start_date) : new Date(subData?.created_at);
        const trialEndDate = addDays(startDate, 1); // 1 day trial
        const hoursLeft = differenceInHours(trialEndDate, now);
        
        setIsTrial(true);
        setHoursRemaining(Math.max(0, hoursLeft));
        
        // Trial expired - block access
        if (hoursLeft <= 0) {
          setHasAccess(false);
        } else {
          setHasAccess(true); // Allow trial access
        }
      } else {
        // Other statuses (vencido, cancelado) - no access
        setHasAccess(false);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return null;
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-6 relative overflow-hidden">
        <Card className="w-full max-w-md border-destructive/30 relative z-10">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30">
                <AlertCircle className="w-10 h-10 text-destructive" />
              </div>
            </div>
            <CardTitle className="flex items-center gap-2 text-center justify-center text-xl md:text-2xl">
              Acesso Bloqueado
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground text-sm md:text-base">
              {isTrial && hoursRemaining !== null && hoursRemaining <= 0
                ? 'Seu período de teste de 1 dia expirou. Para continuar usando o sistema, ative sua licença.'
                : subscription?.status === 'pendente' 
                  ? 'Sua assinatura está aguardando aprovação do administrador.'
                  : 'Sua assinatura expirou ou está inativa. Renove agora para continuar.'
              }
            </p>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                ⚠️ Sua licença está vencida. Renove para continuar usando o sistema!
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <Button 
                onClick={() => navigate('/awaiting-activation')}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
              >
                💳 Efetuar Pagamento
              </Button>
              <a
                href="https://wa.me/5516992600631?text=Ol%C3%A1%20Erik,%20preciso%20ativar%20minha%20licen%C3%A7a%20AC%20Service%20Pro"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium px-6 py-3 rounded-lg transition-all text-sm w-full"
              >
                📱 Chamar Suporte via WhatsApp
              </a>
              <Button 
                onClick={handleLogout}
                variant="outline" 
                className="w-full"
              >
                Sair da Conta
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Mostrar alerta 7 dias antes do vencimento ou durante trial
  const showExpiryWarning = daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  const showTrialBanner = isTrial && hoursRemaining !== null && hoursRemaining > 0;

  const subscriptionContextValue: SubscriptionContextType = {
    subscription,
    daysRemaining: daysUntilExpiry,
    hoursRemaining,
    isTrial,
    isExpiringSoon: showExpiryWarning
  };

  return (
    <SubscriptionContext.Provider value={subscriptionContextValue}>
      {/* Trial Banner */}
      {showTrialBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-cyan-500 to-blue-500 text-white p-3 text-center shadow-lg">
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span className="font-bold text-lg">
                ⏰ Período de Teste: Restam {hoursRemaining} hora{hoursRemaining !== 1 ? 's' : ''}!
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span>Para liberar acesso completo:</span>
              <a 
                href="https://wa.me/5516992600631?text=Olá%20Erik,%20quero%20ativar%20minha%20licença%20AC%20Service%20Pro"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-bold hover:opacity-80"
              >
                Fale com Suporte
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Expiry Warning Banner */}
      {showExpiryWarning && !showTrialBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-500 to-orange-500 text-black p-3 text-center shadow-lg">
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span className="font-bold text-lg">
                Sua assinatura AC Service Pro vence em {daysUntilExpiry} {daysUntilExpiry === 1 ? 'dia' : 'dias'}!
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">
                Para renovar, entre em contato:
              </span>
              <a 
                href="https://wa.me/5516992600631?text=Olá%20Erik,%20quero%20renovar%20minha%20assinatura%20AC%20Service%20Pro"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-bold hover:opacity-80"
              >
                WhatsApp: +55 16 99260-0631
              </a>
            </div>
          </div>
        </div>
      )}
      <div className={(showExpiryWarning || showTrialBanner) ? 'pt-24' : ''}>
        {children}
      </div>
    </SubscriptionContext.Provider>
  );
}
