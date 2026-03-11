import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Clock, MessageCircle, Snowflake, RefreshCw, 
  CheckCircle, LogOut, Download, Share, CreditCard, Crown,
  Mail, Phone, Instagram
} from "lucide-react";
import { toast } from 'sonner';

const AwaitingActivation: React.FC = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState('');
  const [checking, setChecking] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState('https://wa.me/5511999999999');
  const [emailSuporte, setEmailSuporte] = useState('');
  const [telefoneSuporte, setTelefoneSuporte] = useState('');
  const [instagramSuporte, setInstagramSuporte] = useState('');
  const [checkoutMensal, setCheckoutMensal] = useState('');
  const [checkoutTrimestral, setCheckoutTrimestral] = useState('');
  const [checkoutAnual, setCheckoutAnual] = useState('');
  const [checkoutVitalicio, setCheckoutVitalicio] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string>('mensal');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detectar iOS e standalone
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);
    
    const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                       (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Handler para Chrome/Android
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/');
        return;
      }
      setUserEmail(session.user.email || '');

      // Load settings
      const { data: settings } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', ['whatsapp_suporte', 'email_suporte', 'telefone_suporte', 'instagram_suporte', 'checkout_mensal', 'checkout_trimestral', 'checkout_semestral', 'checkout_anual', 'checkout_vitalicio', 'planos_visiveis_landing', 'preco_mensal', 'preco_trimestral', 'preco_semestral', 'preco_anual', 'preco_vitalicio']);
      
      if (settings) {
        settings.forEach(s => {
          if (s.key === 'whatsapp_suporte' && s.value) setWhatsappLink(s.value);
          if (s.key === 'email_suporte' && s.value) setEmailSuporte(s.value);
          if (s.key === 'telefone_suporte' && s.value) setTelefoneSuporte(s.value);
          if (s.key === 'instagram_suporte' && s.value) setInstagramSuporte(s.value);
          if (s.key === 'checkout_mensal' && s.value) setCheckoutMensal(s.value);
          if (s.key === 'checkout_trimestral' && s.value) setCheckoutTrimestral(s.value);
          if (s.key === 'checkout_anual' && s.value) setCheckoutAnual(s.value);
          if (s.key === 'checkout_vitalicio' && s.value) setCheckoutVitalicio(s.value);
        });
      }
    };

    loadData();
  }, [navigate]);

  const checkSubscriptionStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/');
        return false;
      }

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      // Verifica se está aprovado
      if (subscription?.is_active && subscription?.status === 'aprovado') {
        toast.success('🎉 Assinatura ativa! Redirecionando...');
        navigate('/dashboard');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking subscription:', error);
      return false;
    }
  };

  // Auto-refresh a cada 10 segundos para verificar se o pagamento foi processado
  useEffect(() => {
    const interval = setInterval(async () => {
      const isActive = await checkSubscriptionStatus();
      if (isActive) {
        clearInterval(interval);
      }
    }, 10000); // Verifica a cada 10 segundos

    return () => clearInterval(interval);
  }, [navigate]);

  const handleCheckSubscription = async () => {
    setChecking(true);
    const isActive = await checkSubscriptionStatus();
    if (!isActive) {
      toast.info('Sua assinatura ainda não foi ativada. Complete o pagamento ou entre em contato com o suporte.');
    }
    setChecking(false);
  };

  const handleContactSupport = () => {
    const message = encodeURIComponent(`Olá! Criei minha conta no AC Service Pro com o email: ${userEmail}. Gostaria de ativar minha assinatura!`);
    window.open(`${whatsappLink}?text=${message}`, '_blank');
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleInstall = async () => {
    if (isIOS) {
      toast.info(
        'Para instalar no iPhone/iPad:\n1. Toque no ícone de compartilhar (📤)\n2. Role e toque em "Adicionar à Tela de Início"',
        { duration: 8000 }
      );
      return;
    }

    if (!deferredPrompt) {
      toast.info('Abra no Chrome e acesse: Menu (⋮) → "Instalar aplicativo"', { duration: 6000 });
      return;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        toast.success('App instalado com sucesso! Acesse pela sua tela inicial.');
        setDeferredPrompt(null);
      }
    } catch (error) {
      toast.error('Erro ao instalar. Tente novamente.');
    }
  };

  const openCheckout = (url: string) => {
    if (url) {
      window.open(url, '_blank');
    } else {
      toast.error('Link de pagamento não configurado. Entre em contato com o suporte.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-cyan-950 flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <Card className="w-full max-w-md bg-slate-800/90 border-cyan-500/30 backdrop-blur-lg relative z-10">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-white animate-pulse" />
          </div>
          <CardTitle className="text-white text-xl">
            Aguardando Ativação
          </CardTitle>
          <CardDescription className="text-gray-400">
            Sua conta foi criada com sucesso!
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Auto-refresh indicator */}
          <div className="flex items-center justify-center gap-2 text-cyan-400 text-xs bg-cyan-500/10 rounded-lg py-2">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Verificando pagamento automaticamente...</span>
          </div>

          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <p className="text-gray-300 text-sm text-center">
              Complete o pagamento usando o mesmo email: <strong className="text-cyan-400">{userEmail}</strong>
            </p>
            <p className="text-gray-500 text-xs text-center mt-2">
              O sistema libera o acesso automaticamente após confirmar o pagamento
            </p>
          </div>

          {/* Payment Buttons */}
          <div className="space-y-3">
            <p className="text-gray-400 text-xs text-center font-medium">Escolha seu plano:</p>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={() => setSelectedPlan('mensal')}
                variant="outline"
                className={`flex-col h-auto py-3 border transition-all ${selectedPlan === 'mensal' ? 'border-blue-500 bg-blue-500/20 text-white ring-2 ring-blue-500/50' : 'border-white/10 text-gray-300 hover:bg-white/5'}`}
              >
                <CreditCard className="w-4 h-4 mb-1" />
                <span className="text-sm font-semibold">Mensal</span>
                <span className="text-[10px] opacity-70">Mês a mês</span>
              </Button>
              
              <Button 
                onClick={() => setSelectedPlan('trimestral')}
                variant="outline"
                className={`flex-col h-auto py-3 border transition-all ${selectedPlan === 'trimestral' ? 'border-purple-500 bg-purple-500/20 text-white ring-2 ring-purple-500/50' : 'border-white/10 text-gray-300 hover:bg-white/5'}`}
              >
                <CreditCard className="w-4 h-4 mb-1" />
                <span className="text-sm font-semibold">Trimestral</span>
                <span className="text-[10px] opacity-70">3 meses</span>
              </Button>
              
              <Button 
                onClick={() => setSelectedPlan('anual')}
                variant="outline"
                className={`flex-col h-auto py-3 border transition-all relative overflow-hidden ${selectedPlan === 'anual' ? 'border-amber-500 bg-amber-500/20 text-white ring-2 ring-amber-500/50' : 'border-white/10 text-gray-300 hover:bg-white/5'}`}
              >
                <div className="absolute -top-0.5 -right-0.5 bg-green-500 text-[8px] px-1.5 py-0.5 rounded-bl-md font-bold text-white">
                  POPULAR
                </div>
                <Crown className="w-4 h-4 mb-1 text-amber-400" />
                <span className="text-sm font-semibold">Anual</span>
                <span className="text-[10px] opacity-70">Melhor preço</span>
              </Button>

              <Button 
                onClick={() => setSelectedPlan('vitalicio')}
                variant="outline"
                className={`flex-col h-auto py-3 border transition-all ${selectedPlan === 'vitalicio' ? 'border-green-500 bg-green-500/20 text-white ring-2 ring-green-500/50' : 'border-white/10 text-gray-300 hover:bg-white/5'}`}
              >
                <Crown className="w-4 h-4 mb-1 text-green-400" />
                <span className="text-sm font-semibold">Vitalício</span>
                <span className="text-[10px] opacity-70">Para sempre</span>
              </Button>
            </div>

            <Button 
              onClick={() => {
                const urls: Record<string, string> = {
                  mensal: checkoutMensal,
                  trimestral: checkoutTrimestral,
                  anual: checkoutAnual,
                  vitalicio: checkoutVitalicio,
                };
                openCheckout(urls[selectedPlan] || '');
              }}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold py-3"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Pagar Plano {selectedPlan === 'vitalicio' ? 'Vitalício' : selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-slate-800 px-2 text-gray-500">ou</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handleContactSupport}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Falar com Suporte via WhatsApp
            </Button>

            <Button 
              onClick={handleCheckSubscription}
              variant="outline"
              className="w-full border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
              disabled={checking}
            >
              {checking ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Verificar Ativação
            </Button>

            {!isStandalone && (
              <Button 
                onClick={handleInstall}
                variant="outline"
                className="w-full border-white/20 text-gray-300 hover:bg-white/10"
              >
                {isIOS ? <Share className="w-4 h-4 mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Instalar como App
              </Button>
            )}

            <Button 
              onClick={handleSignOut}
              variant="ghost"
              className="w-full text-gray-400 hover:text-white hover:bg-white/5"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>

          <div className="text-center pt-2">
            <p className="text-gray-500 text-xs">
              Após a ativação, você terá acesso completo ao sistema
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AwaitingActivation;
