import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { 
  Snowflake, CheckCircle, Star, Users, Calendar, BarChart3, 
  FileText, Shield, Smartphone, Zap, ArrowRight, Sparkles,
  Crown, Gift, Clock, DollarSign, ChevronDown, Wind, Wrench,
  Download, LogIn, UserPlus, Eye, EyeOff, Loader2, X,
  Percent, BadgeCheck, TrendingUp, MessageCircle, HelpCircle, ChevronUp, Video
} from "lucide-react";
import { SubscriptionNotifications } from "@/components/SubscriptionNotifications";
import { PromoCountdown } from "@/components/PromoCountdown";
import InteractiveBackground from "@/components/InteractiveBackground";

type AdminSettings = Record<string, string>;

const FaqItem: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} 
        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors">
        <span className="text-white font-medium text-sm pr-4">{question}</span>
        {open ? <ChevronUp className="w-4 h-4 text-cyan-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 text-gray-300 text-sm leading-relaxed border-t border-white/5 pt-3">
          {answer}
        </div>
      )}
    </div>
  );
};

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [showLogin, setShowLogin] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  // Handle ?login=true and ?cadastro=true query params
  useEffect(() => {
    if (searchParams.get('login') === 'true') {
      setShowLogin(true);
      setIsLogin(true);
    } else if (searchParams.get('cadastro') === 'true') {
      setShowLogin(true);
      setIsLogin(false);
    }
  }, [searchParams]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [settings, setSettings] = useState<AdminSettings>({
    checkout_mensal: '',
    checkout_anual: '',
    whatsapp_suporte: 'https://wa.me/5511999999999',
    promo_end_date: '',
    landing_preco_mensal: '39,90',
    landing_preco_anual: '370',
    landing_preco_anual_original: '478,80',
    landing_economia_anual: '108',
    landing_preco_mensal_equivalente: '30,83',
    landing_hero_titulo: 'Chega de Perder Clientes',
    landing_hero_subtitulo: 'e Trabalhar no Prejuízo',
    landing_hero_descricao: 'Você anota tudo no papel ou no WhatsApp? Esquece de cobrar clientes? Não sabe quanto lucrou no mês? Esse problema acaba HOJE.',
    landing_social_proof_count: '500',
    landing_social_proof_rating: '4.9',
    landing_garantia_dias: '7',
    landing_btn_cta_texto: 'QUERO PARAR DE PERDER DINHEIRO',
    landing_badge_urgencia: 'ATENÇÃO: Você está perdendo dinheiro todo dia sem saber',
    landing_frase_destaque: 'O único sistema de Ar Condicionado que você realmente vai usar — porque é simples igual WhatsApp, mas organiza TUDO.',
    landing_countdown_texto: '🔥 PROMOÇÃO POR TEMPO LIMITADO!',
    landing_countdown_desconto: '22% OFF Plano Anual',
    landing_notif_ativa: 'true',
    landing_notif_som: 'true',
    landing_notif_intervalo: '10',
    landing_oferta1_titulo: 'Plano Mensal',
    landing_oferta1_descricao: 'Para testar e ver resultado rápido',
    landing_oferta1_badge: '',
    landing_oferta1_ativa: 'true',
    landing_oferta2_titulo: 'Plano Anual',
    landing_oferta2_descricao: 'Para quem quer economizar de verdade',
    landing_oferta2_badge: 'MAIS ESCOLHIDO',
    landing_oferta2_ativa: 'true',
    landing_cor_primaria: '#06b6d4',
    landing_cor_secundaria: '#3b82f6',
    landing_cor_destaque: '#f59e0b',
    landing_cor_fundo: '#0f172a',
    landing_cor_botao_cta: '#22c55e',
    landing_depoimento1_nome: 'Carlos M.',
    landing_depoimento1_role: 'Técnico Autônomo - SP',
    landing_depoimento1_texto: 'Eu perdia cliente por esquecer de ligar. Agora o sistema me lembra de tudo. Triplicou meus agendamentos!',
    landing_depoimento1_estrelas: '5',
    landing_depoimento2_nome: 'Ana Paula',
    landing_depoimento2_role: 'Dona de Empresa - RJ',
    landing_depoimento2_texto: 'Parei de perder dinheiro sem saber. Descobri que tinha funcionário me roubando. O financeiro mostrou tudo.',
    landing_depoimento2_estrelas: '5',
    landing_depoimento3_nome: 'Roberto S.',
    landing_depoimento3_role: 'Técnico há 15 anos - MG',
    landing_depoimento3_texto: 'Achava que era difícil, mas é mais fácil que WhatsApp. Em 10 minutos já tava usando.',
    landing_depoimento3_estrelas: '5',
    landing_depoimento4_nome: 'Marcos L.',
    landing_depoimento4_role: 'Autônomo - BA',
    landing_depoimento4_texto: 'O melhor investimento que fiz. Por menos de R$40 eu tenho o que empresas grandes pagam milhares.',
    landing_depoimento4_estrelas: '5',
    // WhatsApp flutuante
    landing_whatsapp_flutuante: 'true',
    landing_whatsapp_link: 'https://wa.me/5511999999999',
    landing_whatsapp_mensagem: 'Olá! Vim pela landing page e gostaria de saber mais!',
    // Template
    landing_template: 'persuasao',
    // VSL
    landing_vsl_url: '',
    landing_vsl_trava: 'false',
    // FAQ
    landing_faq1_pergunta: 'O sistema é difícil de usar?',
    landing_faq1_resposta: 'Não! É mais simples que WhatsApp. Em 2 minutos você já está usando.',
    landing_faq1_ativa: 'true',
    landing_faq2_pergunta: 'Funciona no celular?',
    landing_faq2_resposta: 'Sim! 100% responsivo, funciona em qualquer celular, tablet ou computador.',
    landing_faq2_ativa: 'true',
    landing_faq3_pergunta: 'Posso cancelar a qualquer momento?',
    landing_faq3_resposta: 'Sim! Sem multa, sem burocracia. Cancele quando quiser pelo WhatsApp.',
    landing_faq3_ativa: 'true',
    landing_faq4_pergunta: 'E se eu não gostar?',
    landing_faq4_resposta: 'Você tem 7 dias de garantia total. Se não gostar, devolvemos 100% do valor.',
    landing_faq4_ativa: 'true',
    landing_faq5_pergunta: 'Meus dados ficam seguros?',
    landing_faq5_resposta: 'Sim! Usamos criptografia de nível bancário. Seus dados estão 100% protegidos na nuvem.',
    landing_faq5_ativa: 'true',
    landing_faq6_pergunta: 'Preciso instalar alguma coisa?',
    landing_faq6_resposta: 'Não! Funciona direto no navegador. Basta abrir e usar. Também pode instalar como app no celular.',
    landing_faq6_ativa: 'true',
  });

  // Load admin settings
  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase
        .from('admin_settings')
        .select('key, value')
        .or('key.in.(checkout_mensal,checkout_anual,whatsapp_suporte,promo_end_date),key.like.landing_%');

      if (data) {
        const settingsMap: Partial<AdminSettings> = {};
        data.forEach(item => {
          settingsMap[item.key as keyof AdminSettings] = item.value || '';
        });
        setSettings(prev => ({ ...prev, ...settingsMap }));
      }
    };
    loadSettings();
  }, []);

  // Função para verificar assinatura e redirecionar
  const checkSubscriptionAndRedirect = async (userId: string) => {
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (subscription) {
      // Verifica se está em período de trial (1 dia desde start_date)
      const startDate = new Date(subscription.start_date);
      const now = new Date();
      const trialEndDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000); // 1 dia de trial
      const isInTrial = now < trialEndDate;

      // Acesso liberado se: assinatura ativa E aprovada OU dentro do período de trial
      if ((subscription.is_active && subscription.status === 'aprovado') || (subscription.is_active && isInTrial)) {
        navigate('/dashboard');
      } else {
        navigate('/awaiting-activation');
      }
    } else {
      navigate('/awaiting-activation');
    }
  };

  // Verificar se já está logado
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await checkSubscriptionAndRedirect(session.user.id);
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        // Usar setTimeout para evitar deadlock
        setTimeout(() => {
          checkSubscriptionAndRedirect(session.user.id);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleCheckout = (type: 'mensal' | 'anual') => {
    const checkoutUrl = type === 'mensal' ? settings.checkout_mensal : settings.checkout_anual;
    if (checkoutUrl && checkoutUrl.startsWith('http')) {
      // If checkout link configured, open it directly
      window.open(checkoutUrl, '_blank');
    } else {
      // Fallback: create account first
      setShowLogin(true);
      setIsLogin(false);
      toast({
        title: "Crie sua conta primeiro!",
        description: "Após o cadastro, finalize a ativação com nosso suporte usando o mesmo email.",
      });
    }
  };

  const handleContactSupport = () => {
    const whatsappLink = settings.whatsapp_suporte || 'https://wa.me/5511999999999';
    window.open(`${whatsappLink}?text=Olá! Gostaria de saber mais sobre o AC Service Pro!`, '_blank');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        if (rememberMe) {
          localStorage.setItem('ac_remember_email', email);
        } else {
          localStorage.removeItem('ac_remember_email');
        }
        
        toast({ title: "Bem-vindo de volta!", description: "Verificando acesso..." });
        
        // Verifica assinatura e redireciona
        if (data.user) {
          await checkSubscriptionAndRedirect(data.user.id);
        }
      } else {
        const { data: authData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/awaiting-activation`,
            data: { name, phone }
          }
        });
        if (error) throw error;
        
        // Atualizar telefone no perfil
        if (authData.user && phone) {
          await supabase.from('profiles').update({ phone }).eq('user_id', authData.user.id);
        }
        if (error) throw error;
        
        toast({ 
          title: "Conta criada com sucesso! 🎉", 
          description: "Redirecionando para ativação..." 
        });
        
        // Redireciona para página de aguardando ativação
        setShowLogin(false);
        navigate('/awaiting-activation');
      }
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Erro", 
        description: error.message === "Invalid login credentials" 
          ? "Email ou senha incorretos" 
          : error.message 
      });
    } finally {
      setLoading(false);
    }
  };

  // Carregar email salvo
  useEffect(() => {
    const savedEmail = localStorage.getItem('ac_remember_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const features = [
    { icon: Calendar, title: "Agenda Inteligente", desc: "Nunca mais perca um serviço por esquecimento" },
    { icon: Users, title: "Clientes Organizados", desc: "Histórico completo em segundos" },
    { icon: Wind, title: "Controle de Equipamentos", desc: "Saiba tudo sobre cada ar do cliente" },
    { icon: Wrench, title: "Manutenção Preventiva", desc: "Clientes voltando todo mês automático" },
    { icon: FileText, title: "OS Profissional", desc: "Impressione e cobre mais caro" },
    { icon: BarChart3, title: "Lucro Real", desc: "Veja quanto sobra de verdade" },
    { icon: Smartphone, title: "No Celular", desc: "Acesse na obra, no carro, em casa" },
    { icon: Shield, title: "Nunca Perde Dados", desc: "Tudo salvo na nuvem, sempre" },
  ];

  const testimonials = [1, 2, 3, 4].map(i => ({
    name: settings[`landing_depoimento${i}_nome`] || '',
    role: settings[`landing_depoimento${i}_role`] || '',
    text: settings[`landing_depoimento${i}_texto`] || '',
    stars: Number(settings[`landing_depoimento${i}_estrelas`] || 5),
  })).filter(t => t.name && t.text);

  const template = settings.landing_template || 'persuasao';
  const isPersuasao = template === 'persuasao';
  const isVSL = template === 'vsl';
  const isMinimalista = template === 'minimalista';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-cyan-950 text-white overflow-x-hidden">
      {/* Subscription Notifications */}
      {settings.landing_notif_ativa !== 'false' && (
        <SubscriptionNotifications 
          interval={Number(settings.landing_notif_intervalo || 10) * 1000}
          soundEnabled={settings.landing_notif_som !== 'false'}
          precoMensal={settings.landing_preco_mensal || '39,90'}
          precoAnual={settings.landing_preco_anual || '370'}
        />
      )}

      {/* Promo Countdown Timer - now part of header flow, not overlapping */}
      <div className="fixed top-0 left-0 right-0 z-[60]">
        <PromoCountdown 
          endDate={settings.promo_end_date || undefined}
          text={settings.landing_countdown_texto}
          discountBadge={settings.landing_countdown_desconto}
        />
        {/* Header fixo - inside promo container */}
        <header className="bg-slate-900/80 backdrop-blur-lg border-b border-cyan-500/20">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center animate-pulse">
                <Snowflake className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                AC Service Pro
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                className="text-white hover:bg-white/10 transition-all duration-300 hover:scale-105"
                onClick={() => { setShowLogin(true); setIsLogin(true); }}
              >
                <LogIn className="w-4 h-4 mr-2" />
                Entrar
              </Button>
              <Button 
                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 transition-all duration-300 hover:scale-105 shadow-lg shadow-cyan-500/25"
                onClick={() => { setShowLogin(true); setIsLogin(false); }}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Criar Conta
              </Button>
            </div>
          </div>
        </header>
      </div>

      {/* Interactive Mouse Background */}
      <InteractiveBackground 
        color1={settings.landing_cor_primaria ? `${settings.landing_cor_primaria}26` : undefined}
        color2={settings.landing_cor_secundaria ? `${settings.landing_cor_secundaria}20` : undefined}
        color3={settings.landing_cor_destaque ? `${settings.landing_cor_destaque}15` : undefined}
      />

      {/* Spacer for fixed header */}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
      `}</style>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4 relative min-h-[90vh] flex items-center">
        <div className="container mx-auto text-center">
          {/* Badge de urgência - hide on minimalista */}
          {!isMinimalista && (
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-full px-4 py-2 mb-6 animate-bounce">
            <Zap className="w-4 h-4 text-red-400" />
            <span className="text-red-300 text-sm font-medium">
              {settings.landing_badge_urgencia}
            </span>
            <Zap className="w-4 h-4 text-red-400 animate-pulse" />
          </div>
          )}

          <h1 className={`font-bold mb-6 leading-tight animate-fade-in ${isMinimalista ? 'text-3xl sm:text-4xl md:text-5xl' : 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl'}`}>
            {!isMinimalista && <>Chega de{" "}</>}
            <span className="bg-gradient-to-r from-red-400 via-orange-400 to-amber-400 bg-clip-text text-transparent">
              {settings.landing_hero_titulo}
            </span>
            <br />
            <span className={isMinimalista ? 'text-xl sm:text-2xl md:text-3xl text-gray-300' : 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl'}>{settings.landing_hero_subtitulo}</span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-300 mb-4 max-w-2xl mx-auto animate-fade-in px-4" style={{ animationDelay: '0.2s' }}>
            {settings.landing_hero_descricao}
          </p>

          <p className="text-base md:text-lg text-amber-300 mb-8 max-w-xl mx-auto font-medium px-4">
            {settings.landing_frase_destaque}
          </p>

          {/* VSL Video in Hero */}
          {settings.landing_template === 'vsl' && settings.landing_vsl_url && (
            <div className="max-w-3xl mx-auto mb-8 px-4">
              <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl shadow-cyan-500/20 border border-cyan-500/20">
                {settings.landing_vsl_url.includes('youtube') || settings.landing_vsl_url.includes('youtu.be') ? (
                  <iframe 
                    src={settings.landing_vsl_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')} 
                    className="w-full h-full" allowFullScreen />
                ) : settings.landing_vsl_url.includes('vimeo') ? (
                  <iframe 
                    src={settings.landing_vsl_url.replace('vimeo.com/', 'player.vimeo.com/video/')}
                    className="w-full h-full" allowFullScreen />
                ) : (
                  <video src={settings.landing_vsl_url} controls className="w-full h-full" />
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8 px-4">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-base sm:text-lg px-8 py-6 rounded-xl shadow-lg shadow-green-500/25 transition-all duration-300 hover:scale-105"
              onClick={() => handleCheckout('anual')}
            >
              <Crown className="w-5 h-5 mr-2" />
              {settings.landing_btn_cta_texto}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>

          {/* Prova social imediata */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 max-w-2xl mx-auto border border-cyan-500/20 mb-8">
            <p className="text-gray-300 text-sm mb-2">
              <span className="text-cyan-400 font-bold">+ de {settings.landing_social_proof_count} técnicos</span> já pararam de perder dinheiro com esse sistema
            </p>
            <div className="flex items-center justify-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
              <span className="text-amber-400 ml-2 font-bold">{settings.landing_social_proof_rating}/5</span>
              <span className="text-gray-400 text-sm ml-1">- Avaliação dos clientes</span>
            </div>
          </div>

          {/* Stats reformulados */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto px-4">
            {[
              { value: `R$ ${settings.landing_preco_mensal}`, label: "Menos que 1 limpeza" },
              { value: "2 min", label: "Para começar a usar" },
              { value: "100%", label: "No celular" },
              { value: "0", label: "Conhecimento técnico" }
            ].map((stat, i) => (
              <div 
                key={i} 
                className="bg-white/5 backdrop-blur-sm rounded-xl p-3 md:p-4 border border-white/10 hover:border-cyan-500/50 transition-all duration-300"
              >
                <div className="text-xl md:text-2xl font-bold text-cyan-400">{stat.value}</div>
                <div className="text-xs md:text-sm text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Seção da Dor - only persuasao */}
      {isPersuasao && <section className="py-16 px-4 bg-gradient-to-b from-transparent to-red-950/20">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-4">
            Você se <span className="text-red-400">identifica</span> com isso?
          </h2>
          
          <div className="grid md:grid-cols-2 gap-4 mb-10">
            {[
              "Anota serviços no papel e depois perde",
              "Esquece de cobrar cliente ou de fazer follow-up",
              "Não sabe quanto lucrou no mês de verdade",
              "Perde tempo procurando informação no WhatsApp",
              "Cliente liga e você não lembra o histórico dele",
              "Já perdeu serviço por falta de organização",
              "Trabalha muito mas o dinheiro não sobra",
              "Usa planilha Excel mas nunca atualiza"
            ].map((pain, i) => (
              <div key={i} className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <X className="w-5 h-5 text-red-400 flex-shrink-0" />
                <span className="text-gray-300 text-sm">{pain}</span>
              </div>
            ))}
          </div>

          <div className="text-center bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-2xl p-6">
            <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
              Se você marcou 2 ou mais... <span className="text-cyan-400">você PRECISA desse sistema.</span>
            </h3>
            <p className="text-gray-300">
              Cada dia sem organização é dinheiro que você deixa na mesa. <strong className="text-amber-400">Literalmente.</strong>
            </p>
          </div>
        </div>
      </section>}

      {/* Features Grid - persuasao & minimalista */}
      {(isPersuasao || isMinimalista) && <section className="py-16 px-4 bg-gradient-to-b from-transparent to-slate-900/50">
        <div className="container mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-3">
            O que você ganha <span className="text-green-400">de verdade</span>
          </h2>
          <p className="text-gray-400 text-center mb-4 max-w-lg mx-auto text-sm md:text-base px-4">
            Não é só "organização". É <strong className="text-white">mais dinheiro no bolso</strong> todo mês.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {features.map((feature, i) => (
              <Card 
                key={i} 
                className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 hover:scale-105 hover:border-cyan-500/50 group"
              >
                <CardContent className="p-4 md:p-6 text-center">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-3 group-hover:from-cyan-500/30 group-hover:to-blue-500/30 transition-all">
                    <feature.icon className="w-5 h-5 md:w-6 md:h-6 text-cyan-400" />
                  </div>
                  <h3 className="font-semibold text-white text-sm md:text-base mb-1">{feature.title}</h3>
                  <p className="text-xs md:text-sm text-gray-400">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>}

      {/* Seção de Comparação - only persuasao */}
      {isPersuasao && <section className="py-16 px-4 bg-slate-900/50">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-8">
            Por que <span className="text-cyan-400">esse é o melhor</span> sistema?
          </h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Outros sistemas */}
            <Card className="bg-red-500/5 border-red-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-red-400">
                  <X className="w-5 h-5" />
                  Outros Sistemas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {[
                    "Custam R$ 150 a R$ 500/mês",
                    "Complicados demais para usar",
                    "Precisam de treinamento",
                    "Feitos para empresas grandes",
                    "Suporte demora dias para responder",
                    "Interface confusa e antiga"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-400 text-sm">
                      <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* AC Service Pro */}
            <Card className="bg-green-500/5 border-green-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  AC Service Pro
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {[
                    `Apenas R$ ${settings.landing_preco_mensal}/mês (ou menos no anual)`,
                    "Simples igual WhatsApp",
                    "Começa a usar em 2 minutos",
                    "Feito POR técnico PARA técnico",
                    "Suporte responde em minutos no WhatsApp",
                    "Interface moderna e bonita"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-200 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-8 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <p className="text-amber-300 font-medium">
              💡 <strong>Pense:</strong> Uma única limpeza que você não esquece de cobrar já paga o sistema por 3 meses.
            </p>
          </div>
        </div>
      </section>}

      {/* Pricing Section */}
      <section id="precos" className="py-16 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent pointer-events-none" />
        
        <div className="container mx-auto relative">
          <div className="text-center mb-10">
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 mb-4">
              <DollarSign className="w-3 h-3 mr-1" />
              Investimento Ridículo
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">
              Menos que <span className="text-cyan-400">uma limpeza</span> por mês
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto text-sm md:text-base px-4">
              Você cobra <strong className="text-white">R$ 120 a R$ 200</strong> numa limpeza. 
              O sistema custa <strong className="text-cyan-400">R$ {settings.landing_preco_mensal}</strong>. <span className="text-amber-400">Faça as contas.</span>
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Plano Mensal */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm relative overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <span className="text-white text-lg">{settings.landing_oferta1_titulo || 'Plano Mensal'}</span>
                  <Clock className="w-5 h-5 text-gray-400" />
                </CardTitle>
                <CardDescription className="text-gray-400 text-sm">
                  {settings.landing_oferta1_descricao || 'Para testar e ver resultado rápido'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="mb-4">
                  <span className="text-3xl md:text-4xl font-bold text-white">R$ {settings.landing_preco_mensal}</span>
                  <span className="text-gray-400">/mês</span>
                  <div className="text-green-400 text-xs mt-1">= 1/3 de uma limpeza simples</div>
                </div>
                <ul className="space-y-2">
                  {[
                    "Acesso COMPLETO a tudo",
                    "Clientes e equipamentos ilimitados",
                    "Ordens de serviço profissionais",
                    "Controle financeiro real",
                    "Suporte humano no WhatsApp"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-300 text-sm">
                      <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white transition-all duration-300 hover:scale-105"
                  onClick={() => handleCheckout('mensal')}
                >
                  Começar por R$ {settings.landing_preco_mensal}
                </Button>
              </CardFooter>
            </Card>

            {/* Plano Anual */}
            <Card className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-500/50 backdrop-blur-sm relative overflow-hidden">
              {settings.landing_oferta2_badge && (
                <div className="absolute top-3 right-3">
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg text-xs">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {settings.landing_oferta2_badge}
                  </Badge>
                </div>
              )}
              
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  <span className="text-white text-lg">{settings.landing_oferta2_titulo || 'Plano Anual'}</span>
                </CardTitle>
                <CardDescription className="text-cyan-300 text-sm">
                  {settings.landing_oferta2_descricao || 'Para quem quer economizar de verdade'}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="mb-1">
                  <span className="text-gray-400 line-through text-sm">R$ {settings.landing_preco_anual_original}</span>
                  <span className="text-green-400 text-sm ml-2">Economize R$ {settings.landing_economia_anual}!</span>
                </div>
                <div className="mb-4">
                  <span className="text-3xl md:text-4xl font-bold text-white">R$ {settings.landing_preco_anual}</span>
                  <span className="text-gray-300">/ano</span>
                  <div className="text-cyan-400 text-xs mt-1">= Apenas R$ {settings.landing_preco_mensal_equivalente}/mês (preço de um almoço)</div>
                </div>
                <ul className="space-y-2">
                  {[
                    "TUDO do mensal incluído",
                    "2 meses DE GRAÇA",
                    "Suporte VIP prioritário",
                    "Relatórios avançados",
                    "Backup automático diário"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-white text-sm">
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  size="lg"
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-lg shadow-amber-500/25 transition-all duration-300 hover:scale-105"
                  onClick={() => handleCheckout('anual')}
                >
                  <Crown className="w-5 h-5 mr-2" />
                  QUERO ECONOMIZAR R$ {settings.landing_economia_anual}
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Garantia */}
          <div className="text-center mt-8">
            <div className="inline-flex flex-col items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl px-6 py-4">
              <Shield className="w-8 h-8 text-green-400" />
              <span className="text-green-400 font-bold">
                Garantia Total de {settings.landing_garantia_dias} Dias
              </span>
              <span className="text-gray-400 text-sm max-w-md">
                Se você não amar o sistema em {settings.landing_garantia_dias} dias, devolvemos 100% do seu dinheiro. Sem perguntas. <strong className="text-white">Risco ZERO.</strong>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials - persuasao & vsl */}
      {(isPersuasao || isVSL) && <section className="py-16 px-4 bg-slate-900/50">
        <div className="container mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">
            Técnicos <span className="text-cyan-400">reais</span> falando a verdade
          </h2>
          <p className="text-gray-400 text-center mb-10 text-sm">
            Não inventamos nada. São pessoas como você que resolveram o problema.
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {testimonials.map((t, i) => (
              <Card key={i} className="bg-white/5 border-white/10 backdrop-blur-sm hover:border-cyan-500/30 transition-all">
                <CardContent className="p-5">
                  <div className="flex gap-1 mb-3">
                    {[...Array(t.stars)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-gray-300 mb-4 italic text-sm leading-relaxed">"{t.text}"</p>
                  <div className="border-t border-white/10 pt-3">
                    <div className="font-semibold text-white text-sm">{t.name}</div>
                    <div className="text-xs text-cyan-400">{t.role}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>}

      {/* FAQ Section - persuasao only */}
      {isPersuasao && (() => {
        const faqs = [1,2,3,4,5,6].map(i => ({
          q: settings[`landing_faq${i}_pergunta`] || '',
          a: settings[`landing_faq${i}_resposta`] || '',
          active: settings[`landing_faq${i}_ativa`] !== 'false',
        })).filter(f => f.active && f.q && f.a);
        
        if (faqs.length === 0) return null;
        
        return (
          <section className="py-16 px-4 bg-slate-900/50">
            <div className="container mx-auto max-w-3xl">
              <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">
                Perguntas <span className="text-cyan-400">Frequentes</span>
              </h2>
              <p className="text-gray-400 text-center mb-8 text-sm">
                Tire suas dúvidas antes de começar
              </p>
              <div className="space-y-3">
                {faqs.map((faq, i) => (
                  <FaqItem key={i} question={faq.q} answer={faq.a} />
                ))}
              </div>
            </div>
          </section>
        );
      })()}

      {/* Urgência Final - persuasao only */}
      {isPersuasao && (
      <section className="py-12 px-4 bg-gradient-to-r from-red-950/30 to-orange-950/30">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 text-white">
            ⚠️ Quanto você já <span className="text-red-400">perdeu</span> esse mês por falta de organização?
          </h2>
          <p className="text-gray-300 mb-6">
            Cada dia que passa sem sistema é cliente que você esquece, serviço que você não cobra, 
            e <strong className="text-amber-400">dinheiro que fica na mesa</strong>. 
            Você vai continuar trabalhando no prejuízo?
          </p>
        </div>
      </section>
      )}

      {/* CTA Final */}
      <section className="py-16 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 to-transparent pointer-events-none" />
        
        <div className="container mx-auto text-center relative">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">
            A decisão é <span className="text-cyan-400">sua</span>
          </h2>
          <p className="text-gray-300 mb-6 max-w-lg mx-auto text-sm md:text-base px-4">
            Continuar perdendo dinheiro todo dia... ou investir <strong className="text-white">menos que uma limpeza</strong> e resolver isso de vez?
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center px-4 mb-6">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-base sm:text-lg px-8 py-6 rounded-xl shadow-lg shadow-green-500/25 transition-all duration-300 hover:scale-105"
              onClick={() => handleCheckout('anual')}
            >
              <Crown className="w-5 h-5 mr-2" />
              {settings.landing_btn_cta_texto}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
          <Button 
            variant="ghost"
            className="text-gray-400 hover:text-white"
            onClick={handleContactSupport}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Ainda tem dúvidas? Fale com um consultor
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/10">
        <div className="container mx-auto text-center text-gray-400 text-sm">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Snowflake className="w-5 h-5 text-cyan-400" />
            <span className="font-semibold text-white">AC Service Pro</span>
          </div>
          <p>© 2024 AC Service Pro. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Modal de Login/Cadastro - Compacto */}
      {showLogin && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowLogin(false)}
        >
          <Card className="w-full max-w-sm bg-slate-800/95 border-cyan-500/30 backdrop-blur-lg relative animate-in zoom-in-95">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 text-gray-400 hover:text-white h-8 w-8"
              onClick={() => setShowLogin(false)}
            >
              <X className="w-4 h-4" />
            </Button>
            
            <CardHeader className="text-center pb-2 pt-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center mx-auto mb-2">
                <Snowflake className="w-7 h-7 text-white" />
              </div>
              <CardTitle className="text-white text-lg">
                {isLogin ? 'Entrar' : 'Criar Conta'}
              </CardTitle>
              <CardDescription className="text-gray-400 text-xs">
                {isLogin 
                  ? 'Acesse seu painel' 
                  : 'Cadastre-se gratuitamente'}
              </CardDescription>
            </CardHeader>

            <CardContent className="pb-4">
              <form onSubmit={handleAuth} className="space-y-3">
                {!isLogin && (
                  <>
                    <div>
                      <Label className="text-gray-300 text-sm">Nome</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Seu nome"
                        className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 text-sm">WhatsApp</Label>
                      <Input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 h-9 text-sm"
                      />
                    </div>
                  </>
                )}
                
                <div>
                  <Label className="text-gray-300 text-sm">Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 h-9 text-sm"
                  />
                </div>
                
                <div>
                  <Label className="text-gray-300 text-sm">Senha</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 pr-9 h-9 text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 text-gray-400 hover:text-white h-9 w-9"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {isLogin && (
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="remember" 
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                      className="border-white/30 data-[state=checked]:bg-cyan-500 h-4 w-4"
                    />
                    <Label htmlFor="remember" className="text-gray-400 text-xs cursor-pointer">
                      Lembrar email
                    </Label>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 h-9"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : isLogin ? (
                    <LogIn className="w-4 h-4 mr-2" />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-2" />
                  )}
                  {isLogin ? 'Entrar' : 'Criar Conta'}
                </Button>
              </form>

              <div className="mt-3 text-center">
                <p className="text-gray-400 text-xs">
                  {isLogin ? 'Não tem conta?' : 'Já tem conta?'}
                  <Button 
                    variant="link" 
                    className="text-cyan-400 hover:text-cyan-300 p-1 text-xs h-auto"
                    onClick={() => setIsLogin(!isLogin)}
                  >
                    {isLogin ? 'Criar conta' : 'Fazer login'}
                  </Button>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* WhatsApp Floating Button */}
      {settings.landing_whatsapp_flutuante !== 'false' && settings.landing_whatsapp_link && (
        <a
          href={`${settings.landing_whatsapp_link}?text=${encodeURIComponent(settings.landing_whatsapp_mensagem || 'Olá!')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-[#25D366] hover:bg-[#128C7E] flex items-center justify-center shadow-2xl shadow-green-500/50 transition-all duration-300 hover:scale-110 group overflow-hidden"
          style={{ animation: 'bounce 2s ease-in-out 3' }}
          title="Fale conosco no WhatsApp"
        >
          {settings.landing_whatsapp_icon_url ? (
            <img src={settings.landing_whatsapp_icon_url} alt="WhatsApp" className="w-full h-full object-cover" />
          ) : (
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-white fill-current">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          )}
          <span className="absolute right-[72px] bg-slate-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            💬 Fale conosco!
          </span>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full" />
        </a>
      )}

      {/* VSL Video Modal */}
      {settings.landing_template === 'vsl' && settings.landing_vsl_url && settings.landing_vsl_trava === 'true' && !showLogin && (
        <div className="fixed inset-0 bg-black/95 z-[65] flex items-center justify-center p-4">
          <div className="w-full max-w-3xl">
            <h2 className="text-white text-xl font-bold text-center mb-4">
              🎬 Assista o vídeo antes de continuar
            </h2>
            <div className="aspect-video bg-black rounded-xl overflow-hidden mb-4">
              {settings.landing_vsl_url.includes('youtube') || settings.landing_vsl_url.includes('youtu.be') ? (
                <iframe 
                  src={settings.landing_vsl_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')} 
                  className="w-full h-full" allowFullScreen />
              ) : settings.landing_vsl_url.includes('vimeo') ? (
                <iframe 
                  src={settings.landing_vsl_url.replace('vimeo.com/', 'player.vimeo.com/video/')}
                  className="w-full h-full" allowFullScreen />
              ) : (
                <video src={settings.landing_vsl_url} controls className="w-full h-full" />
              )}
            </div>
            <div className="text-center">
              <Button onClick={() => { setShowLogin(true); }}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-lg px-8 py-6">
                <Crown className="w-5 h-5 mr-2" />
                QUERO COMEÇAR AGORA
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Landing;
