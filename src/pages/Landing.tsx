import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import MarqueeBanner from '@/components/MarqueeBanner';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { 
  Snowflake, CheckCircle, Star, Users, Calendar, BarChart3, 
  FileText, Shield, Smartphone, Zap, ArrowRight, Sparkles,
  Crown, Gift, Clock, DollarSign, ChevronDown, Wind, Wrench,
  Download, LogIn, UserPlus, Eye, EyeOff, Loader2, X,
  Percent, BadgeCheck, TrendingUp, MessageCircle, HelpCircle, ChevronUp, Video, Play
} from "lucide-react";
import { SubscriptionNotifications } from "@/components/SubscriptionNotifications";
import { PromoCountdown } from "@/components/PromoCountdown";
import InteractiveBackground from "@/components/InteractiveBackground";
import { GridBackground } from "@/components/GridBackground";

type AdminSettings = Record<string, string>;

// Scroll Reveal animation component
const ScrollReveal: React.FC<{ 
  children: React.ReactNode; 
  delay?: number; 
  direction?: 'up' | 'down' | 'left' | 'right' | 'fade' | 'scale';
  className?: string;
}> = ({ children, delay = 0, direction = 'up', className = '' }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.unobserve(entry.target); } },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const transforms: Record<string, string> = {
    up: 'translateY(40px)', down: 'translateY(-40px)',
    left: 'translateX(40px)', right: 'translateX(-40px)',
    fade: 'translateY(0)', scale: 'scale(0.9)',
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0) translateX(0) scale(1)' : transforms[direction],
        transition: `opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
};

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

// Video embed helper
const VideoEmbed: React.FC<{ url: string; className?: string }> = ({ url, className = "w-full h-full" }) => {
  if (url.includes('youtube') || url.includes('youtu.be')) {
    return <iframe src={url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')} className={className} allowFullScreen />;
  }
  if (url.includes('vimeo')) {
    return <iframe src={url.replace('vimeo.com/', 'player.vimeo.com/video/')} className={className} allowFullScreen />;
  }
  return <video src={url} controls className={className} />;
};

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [showLogin, setShowLogin] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  useEffect(() => {
    if (searchParams.get('login') === 'true') { setShowLogin(true); setIsLogin(true); }
    else if (searchParams.get('cadastro') === 'true') { setShowLogin(true); setIsLogin(false); }
  }, [searchParams]);

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [settings, setSettings] = useState<AdminSettings>({
    checkout_mensal: '', checkout_anual: '',
    whatsapp_suporte: 'https://wa.me/5511999999999', promo_end_date: '',
    landing_preco_mensal: '39,90', landing_preco_anual: '370',
    landing_preco_anual_original: '478,80', landing_economia_anual: '108',
    landing_preco_mensal_equivalente: '30,83',
    landing_hero_titulo: 'Chega de Perder Clientes',
    landing_hero_subtitulo: 'e Trabalhar no Prejuízo',
    landing_hero_descricao: 'Você anota tudo no papel ou no WhatsApp? Esquece de cobrar clientes? Não sabe quanto lucrou no mês? Esse problema acaba HOJE.',
    landing_social_proof_count: '500', landing_social_proof_rating: '4.9',
    landing_garantia_dias: '7',
    landing_btn_cta_texto: 'QUERO PARAR DE PERDER DINHEIRO',
    landing_badge_urgencia: 'ATENÇÃO: Você está perdendo dinheiro todo dia sem saber',
    landing_frase_destaque: 'O único sistema de Ar Condicionado que você realmente vai usar — porque é simples igual WhatsApp, mas organiza TUDO.',
    landing_countdown_texto: '🔥 PROMOÇÃO POR TEMPO LIMITADO!',
    landing_countdown_desconto: '22% OFF Plano Anual',
    landing_notif_ativa: 'true', landing_notif_som: 'true', landing_notif_intervalo: '10', landing_notif_som_url: '',
    landing_pixel_facebook: '', landing_pixel_google: '', landing_pixel_tiktok: '',
    landing_bg_image_url: '', landing_bg_overlay_opacity: '70', landing_bg_particles: 'true',
    landing_bg_effect: 'none', landing_bg_grid_color: '#6366f1', landing_bg_grid_opacity: '15', landing_bg_glow_color: '#7c3aed',
    landing_secao_dor: 'true', landing_secao_features: 'true', landing_secao_comparativo: 'true',
    landing_secao_depoimentos: 'true', landing_secao_faq: 'true', landing_secao_garantia: 'true',
    landing_hero_bg_image: '', landing_precos_bg_image: '', landing_depoimentos_bg_image: '',
    landing_hero_font_size: 'normal', landing_anim_speed: 'normal',
    landing_animacoes_ativas: 'true', landing_scroll_reveal: 'true',
    landing_marquee1_ativo: 'false', landing_marquee1_textos: '', landing_marquee1_direcao: 'left',
    landing_marquee1_velocidade: 'normal', landing_marquee1_cor_fundo: '#06b6d4', landing_marquee1_cor_texto: '#ffffff',
    landing_marquee1_estilo: 'solid', landing_marquee1_posicao: 'hero-below', landing_marquee1_tamanho: 'md',
    landing_marquee1_separador: '✦', landing_marquee1_tipo: 'texto',
    landing_marquee2_ativo: 'false', landing_marquee2_textos: '', landing_marquee2_direcao: 'right',
    landing_marquee2_velocidade: 'normal', landing_marquee2_cor_fundo: '#f59e0b', landing_marquee2_cor_texto: '#ffffff',
    landing_marquee2_estilo: 'gradient', landing_marquee2_posicao: 'above-prices', landing_marquee2_tamanho: 'md',
    landing_marquee2_separador: '⚡', landing_marquee2_tipo: 'texto',
    landing_marquee3_ativo: 'false', landing_marquee3_textos: '', landing_marquee3_direcao: 'left',
    landing_marquee3_velocidade: 'slow', landing_marquee3_cor_fundo: '#22c55e', landing_marquee3_cor_texto: '#ffffff',
    landing_marquee3_estilo: 'neon', landing_marquee3_posicao: 'bottom', landing_marquee3_tamanho: 'sm',
    landing_marquee3_separador: '•', landing_marquee3_tipo: 'clientes',
    landing_oferta1_titulo: 'Plano Mensal', landing_oferta1_descricao: 'Para testar e ver resultado rápido',
    landing_oferta1_badge: '', landing_oferta1_ativa: 'true',
    landing_oferta2_titulo: 'Plano Anual', landing_oferta2_descricao: 'Para quem quer economizar de verdade',
    landing_oferta2_badge: 'MAIS ESCOLHIDO', landing_oferta2_ativa: 'true',
    landing_cor_primaria: '#06b6d4', landing_cor_secundaria: '#3b82f6',
    landing_cor_destaque: '#f59e0b', landing_cor_fundo: '#0f172a', landing_cor_botao_cta: '#22c55e',
    landing_depoimento1_nome: 'Carlos M.', landing_depoimento1_role: 'Técnico Autônomo - SP',
    landing_depoimento1_texto: 'Eu perdia cliente por esquecer de ligar. Agora o sistema me lembra de tudo. Triplicou meus agendamentos!',
    landing_depoimento1_estrelas: '5',
    landing_depoimento2_nome: 'Ana Paula', landing_depoimento2_role: 'Dona de Empresa - RJ',
    landing_depoimento2_texto: 'Parei de perder dinheiro sem saber. Descobri que tinha funcionário me roubando. O financeiro mostrou tudo.',
    landing_depoimento2_estrelas: '5',
    landing_depoimento3_nome: 'Roberto S.', landing_depoimento3_role: 'Técnico há 15 anos - MG',
    landing_depoimento3_texto: 'Achava que era difícil, mas é mais fácil que WhatsApp. Em 10 minutos já tava usando.',
    landing_depoimento3_estrelas: '5',
    landing_depoimento4_nome: 'Marcos L.', landing_depoimento4_role: 'Autônomo - BA',
    landing_depoimento4_texto: 'O melhor investimento que fiz. Por menos de R$40 eu tenho o que empresas grandes pagam milhares.',
    landing_depoimento4_estrelas: '5',
    landing_whatsapp_flutuante: 'true', landing_whatsapp_link: 'https://wa.me/5511999999999',
    landing_whatsapp_mensagem: 'Olá! Vim pela landing page e gostaria de saber mais!',
    landing_template: 'persuasao', landing_vsl_url: '', landing_vsl_trava: 'false',
    landing_faq1_pergunta: 'O sistema é difícil de usar?', landing_faq1_resposta: 'Não! É mais simples que WhatsApp. Em 2 minutos você já está usando.', landing_faq1_ativa: 'true',
    landing_faq2_pergunta: 'Funciona no celular?', landing_faq2_resposta: 'Sim! 100% responsivo, funciona em qualquer celular, tablet ou computador.', landing_faq2_ativa: 'true',
    landing_faq3_pergunta: 'Posso cancelar a qualquer momento?', landing_faq3_resposta: 'Sim! Sem multa, sem burocracia. Cancele quando quiser pelo WhatsApp.', landing_faq3_ativa: 'true',
    landing_faq4_pergunta: 'E se eu não gostar?', landing_faq4_resposta: 'Você tem 7 dias de garantia total. Se não gostar, devolvemos 100% do valor.', landing_faq4_ativa: 'true',
    landing_faq5_pergunta: 'Meus dados ficam seguros?', landing_faq5_resposta: 'Sim! Usamos criptografia de nível bancário. Seus dados estão 100% protegidos na nuvem.', landing_faq5_ativa: 'true',
    landing_faq6_pergunta: 'Preciso instalar alguma coisa?', landing_faq6_resposta: 'Não! Funciona direto no navegador. Basta abrir e usar. Também pode instalar como app no celular.', landing_faq6_ativa: 'true',
  });

  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase.from('admin_settings').select('key, value')
        .or('key.in.(checkout_mensal,checkout_anual,whatsapp_suporte,promo_end_date),key.like.landing_%');
      if (data) {
        const settingsMap: Partial<AdminSettings> = {};
        data.forEach(item => { settingsMap[item.key as keyof AdminSettings] = item.value || ''; });
        setSettings(prev => ({ ...prev, ...settingsMap }));
      }
    };
    loadSettings();
  }, []);

  const checkSubscriptionAndRedirect = async (userId: string) => {
    const { data: subscription } = await supabase.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
    if (subscription) {
      const startDate = new Date(subscription.start_date);
      const now = new Date();
      const trialEndDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
      const isInTrial = now < trialEndDate;
      if ((subscription.is_active && subscription.status === 'aprovado') || (subscription.is_active && isInTrial)) {
        navigate('/dashboard');
      } else { navigate('/awaiting-activation'); }
    } else { navigate('/awaiting-activation'); }
  };

  const isPreviewMode = searchParams.get('preview') === 'true';

  useEffect(() => {
    if (isPreviewMode) return; // Skip redirect in preview mode
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await checkSubscriptionAndRedirect(session.user.id);
    };
    checkSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setTimeout(() => checkSubscriptionAndRedirect(session.user.id), 0);
    });
    return () => subscription.unsubscribe();
  }, [navigate, isPreviewMode]);

  const handleCheckout = (type: 'mensal' | 'anual') => {
    trackConversion(type);
    
    // Priority: landing-specific links → global integration links → signup fallback
    const landingLink = type === 'mensal' ? settings.landing_checkout_mensal_link : settings.landing_checkout_anual_link;
    const globalLink = type === 'mensal' ? settings.checkout_mensal : settings.checkout_anual;
    const checkoutUrl = landingLink || globalLink;
    
    if (checkoutUrl && checkoutUrl.startsWith('http')) {
      window.open(checkoutUrl, '_blank');
    } else {
      // No checkout link found anywhere - redirect to signup
      setShowLogin(true); 
      setIsLogin(false); 
      toast({ title: "Crie sua conta primeiro!", description: "Após o cadastro, finalize a ativação." });
    }
  };

  const handleContactSupport = () => {
    window.open(`${settings.whatsapp_suporte || 'https://wa.me/5511999999999'}?text=Olá! Gostaria de saber mais sobre o AC Service Pro!`, '_blank');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (rememberMe) localStorage.setItem('ac_remember_email', email);
        else localStorage.removeItem('ac_remember_email');
        toast({ title: "Bem-vindo de volta!", description: "Verificando acesso..." });
        if (data.user) await checkSubscriptionAndRedirect(data.user.id);
      } else {
        const { data: authData, error } = await supabase.auth.signUp({
          email, password, options: { emailRedirectTo: `${window.location.origin}/awaiting-activation`, data: { name, phone } }
        });
        if (error) throw error;
        if (authData.user && phone) await supabase.from('profiles').update({ phone }).eq('user_id', authData.user.id);
        toast({ title: "Conta criada com sucesso! 🎉", description: "Redirecionando para ativação..." });
        setShowLogin(false);
        navigate('/awaiting-activation');
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro", description: error.message === "Invalid login credentials" ? "Email ou senha incorretos" : error.message });
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const savedEmail = localStorage.getItem('ac_remember_email');
    if (savedEmail) { setEmail(savedEmail); setRememberMe(true); }
  }, []);

  // Inject Pixel scripts
  useEffect(() => {
    // Facebook Pixel
    if (settings.landing_pixel_facebook) {
      const fbScript = document.createElement('script');
      fbScript.innerHTML = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${settings.landing_pixel_facebook}');fbq('track','PageView');`;
      fbScript.id = 'fb-pixel';
      if (!document.getElementById('fb-pixel')) document.head.appendChild(fbScript);
    }
    // Google Ads gtag
    if (settings.landing_pixel_google) {
      const gScript = document.createElement('script');
      gScript.src = `https://www.googletagmanager.com/gtag/js?id=${settings.landing_pixel_google}`;
      gScript.async = true;
      gScript.id = 'gtag-script';
      if (!document.getElementById('gtag-script')) {
        document.head.appendChild(gScript);
        const gInline = document.createElement('script');
        gInline.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${settings.landing_pixel_google}');`;
        document.head.appendChild(gInline);
      }
    }
    // TikTok Pixel
    if (settings.landing_pixel_tiktok) {
      const ttScript = document.createElement('script');
      ttScript.innerHTML = `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${settings.landing_pixel_tiktok}');ttq.page();}(window,document,'ttq');`;
      ttScript.id = 'tt-pixel';
      if (!document.getElementById('tt-pixel')) document.head.appendChild(ttScript);
    }
    return () => {
      ['fb-pixel', 'gtag-script', 'tt-pixel'].forEach(id => document.getElementById(id)?.remove());
    };
  }, [settings.landing_pixel_facebook, settings.landing_pixel_google, settings.landing_pixel_tiktok]);

  // Enhanced pixel tracking helpers
  const trackEvent = (eventName: string, params?: Record<string, any>) => {
    try {
      // Facebook Pixel events
      if ((window as any).fbq) {
        (window as any).fbq('track', eventName, params);
      }
      // Google Ads events
      if ((window as any).gtag && settings.landing_pixel_google) {
        const gtagEvent = eventName === 'Lead' ? 'generate_lead' 
          : eventName === 'InitiateCheckout' ? 'begin_checkout'
          : eventName === 'Purchase' ? 'purchase'
          : eventName === 'ViewContent' ? 'view_item'
          : eventName === 'AddToCart' ? 'add_to_cart'
          : 'conversion';
        (window as any).gtag('event', gtagEvent, { 
          send_to: settings.landing_pixel_google,
          ...params 
        });
      }
      // TikTok Pixel events
      if ((window as any).ttq) {
        const ttEvent = eventName === 'Lead' ? 'SubmitForm'
          : eventName === 'InitiateCheckout' ? 'InitiateCheckout'
          : eventName === 'Purchase' ? 'CompletePayment'
          : eventName === 'ViewContent' ? 'ViewContent'
          : eventName === 'AddToCart' ? 'AddToCart'
          : 'CompleteRegistration';
        (window as any).ttq.track(ttEvent, params);
      }
    } catch (e) {}
  };

  // Track ViewContent when page loads with pixels
  useEffect(() => {
    if (settings.landing_pixel_facebook || settings.landing_pixel_google || settings.landing_pixel_tiktok) {
      const timer = setTimeout(() => trackEvent('ViewContent', { content_name: 'Landing Page AC Service Pro' }), 2000);
      return () => clearTimeout(timer);
    }
  }, [settings.landing_pixel_facebook, settings.landing_pixel_google, settings.landing_pixel_tiktok]);

  const trackConversion = (type: 'mensal' | 'anual') => {
    trackEvent('InitiateCheckout', { content_name: `Plano ${type}`, value: type === 'mensal' ? settings.landing_preco_mensal : settings.landing_preco_anual, currency: 'BRL' });
    trackEvent('Lead', { content_name: `Plano ${type}` });
  };

  const trackScrollMilestone = (section: string) => {
    trackEvent('ViewContent', { content_name: section, content_category: 'landing_section' });
  };

  const features = [
    { icon: Calendar, title: "Agenda Inteligente", desc: "Nunca mais perca um serviço" },
    { icon: Users, title: "Clientes Organizados", desc: "Histórico completo em segundos" },
    { icon: Wind, title: "Controle de Equipamentos", desc: "Tudo sobre cada ar do cliente" },
    { icon: Wrench, title: "Manutenção Preventiva", desc: "Clientes voltando todo mês" },
    { icon: FileText, title: "OS Profissional", desc: "Impressione e cobre mais" },
    { icon: BarChart3, title: "Lucro Real", desc: "Veja quanto sobra de verdade" },
    { icon: Smartphone, title: "No Celular", desc: "Acesse em qualquer lugar" },
    { icon: Shield, title: "Dados Seguros", desc: "Tudo salvo na nuvem" },
  ];

  const testimonials = [1, 2, 3, 4].map(i => ({
    name: settings[`landing_depoimento${i}_nome`] || '',
    role: settings[`landing_depoimento${i}_role`] || '',
    text: settings[`landing_depoimento${i}_texto`] || '',
    stars: Number(settings[`landing_depoimento${i}_estrelas`] || 5),
    foto: settings[`landing_depoimento${i}_foto`] || '',
    video: settings[`landing_depoimento${i}_video`] || '',
  })).filter(t => t.name && t.text);

  const videosSocialProof = [1, 2, 3].map(i => settings[`landing_video_prova_social_${i}`] || '').filter(Boolean);

  const faqs = [1,2,3,4,5,6].map(i => ({
    q: settings[`landing_faq${i}_pergunta`] || '',
    a: settings[`landing_faq${i}_resposta`] || '',
    active: settings[`landing_faq${i}_ativa`] !== 'false',
  })).filter(f => f.active && f.q && f.a);

  const template = settings.landing_template || 'persuasao';

  const oferta1Features = (settings.landing_oferta1_features || 'Acesso COMPLETO a tudo\nClientes ilimitados\nOrdens de serviço profissionais\nControle financeiro real\nSuporte no WhatsApp').split('\n').filter(Boolean);
  const oferta2Features = (settings.landing_oferta2_features || 'TUDO do mensal incluído\n2 meses DE GRAÇA\nSuporte VIP prioritário\nRelatórios avançados\nBackup automático diário').split('\n').filter(Boolean);

  // ─── SHARED COMPONENTS ────────────────────────────────────────

  const Header = () => (
    <div className="fixed top-0 left-0 right-0 z-[60]">
      {settings.landing_banner_ativo === 'true' && settings.landing_banner_texto && (
        <div className="text-center py-2 px-4 text-white text-sm font-medium cursor-pointer" 
          style={{ background: settings.landing_banner_cor || '#ef4444' }}
          onClick={() => settings.landing_banner_link && window.open(settings.landing_banner_link, '_blank')}>
          {settings.landing_banner_texto}
        </div>
      )}
      <PromoCountdown endDate={settings.promo_end_date || undefined} text={settings.landing_countdown_texto} discountBadge={settings.landing_countdown_desconto} />
      <header className={`backdrop-blur-lg border-b ${template === 'minimalista' ? 'bg-white/90 border-gray-200' : 'bg-slate-900/80 border-cyan-500/20'}`}>
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${template === 'minimalista' ? 'bg-slate-900' : 'bg-gradient-to-br from-cyan-400 to-blue-500 animate-pulse'}`}>
              <Snowflake className="w-6 h-6 text-white" />
            </div>
            <span className={`text-xl font-bold ${template === 'minimalista' ? 'text-slate-900' : 'bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent'}`}>
              AC Service Pro
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className={template === 'minimalista' ? 'text-slate-700 hover:bg-slate-100' : 'text-white hover:bg-white/10'}
              onClick={() => { setShowLogin(true); setIsLogin(true); }}>
              <LogIn className="w-4 h-4 mr-2" /> Entrar
            </Button>
            <Button className={template === 'minimalista' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/25'}
              onClick={() => { setShowLogin(true); setIsLogin(false); }}>
              <UserPlus className="w-4 h-4 mr-2" /> Criar Conta
            </Button>
          </div>
        </div>
      </header>
    </div>
  );

  const PricingSection = () => (
    <section id="precos" className={`py-16 px-4 relative ${template === 'minimalista' ? '' : ''}`}>
      <div className="container mx-auto relative">
        <div className="text-center mb-10">
          {template !== 'minimalista' && (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 mb-4">
              <DollarSign className="w-3 h-3 mr-1" /> Investimento Ridículo
            </Badge>
          )}
          <h2 className={`text-2xl sm:text-3xl md:text-4xl font-bold mb-3 ${template === 'minimalista' ? 'text-slate-900' : 'text-white'}`}>
            {template === 'minimalista' ? 'Planos simples e transparentes' : <>Menos que <span className="text-cyan-400">uma limpeza</span> por mês</>}
          </h2>
          {template !== 'minimalista' && (
            <p className="text-gray-400 max-w-lg mx-auto text-sm md:text-base px-4">
              O sistema custa <strong className="text-cyan-400">R$ {settings.landing_preco_mensal}</strong>. <span className="text-amber-400">Faça as contas.</span>
            </p>
          )}
        </div>

        <div className={`grid gap-6 max-w-4xl mx-auto ${
          settings.landing_oferta1_ativa !== 'false' && settings.landing_oferta2_ativa !== 'false' ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-lg'
        }`}>
          {settings.landing_oferta1_ativa !== 'false' && (
            <Card className={template === 'minimalista' ? 'border-gray-200 shadow-sm' : '!bg-white/5 !border-white/10 backdrop-blur-sm relative overflow-hidden'}>
              {settings.landing_oferta1_badge && <div className="absolute top-3 right-3"><Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-0 text-xs">{settings.landing_oferta1_badge}</Badge></div>}
              <CardHeader className="pb-3">
                <CardTitle className={template === 'minimalista' ? 'text-slate-900' : 'text-white'}>{settings.landing_oferta1_titulo || 'Plano Mensal'}</CardTitle>
                <CardDescription>{settings.landing_oferta1_descricao || 'Para testar e ver resultado rápido'}</CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="mb-4">
                  <span className={`text-3xl md:text-4xl font-bold ${template === 'minimalista' ? 'text-slate-900' : 'text-white'}`}>R$ {settings.landing_preco_mensal}</span>
                  <span className="text-gray-400">/mês</span>
                </div>
                <ul className="space-y-2">
                  {oferta1Features.map((item, i) => (
                    <li key={i} className={`flex items-center gap-2 text-sm ${template === 'minimalista' ? 'text-slate-600' : 'text-gray-300'}`}>
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 ${template === 'minimalista' ? 'text-green-500' : 'text-cyan-400'}`} /> {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className={`w-full ${template === 'minimalista' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white'}`}
                  onClick={() => handleCheckout('mensal')}>
                  {settings.landing_oferta1_btn_texto || `Começar por R$ ${settings.landing_preco_mensal}`}
                </Button>
              </CardFooter>
            </Card>
          )}

          {settings.landing_oferta2_ativa !== 'false' && (
            <Card className={template === 'minimalista' ? 'border-slate-900 shadow-lg ring-2 ring-slate-900 relative overflow-hidden' : '!bg-gradient-to-br !from-cyan-500/20 !to-blue-500/20 !border-cyan-500/50 backdrop-blur-sm relative overflow-hidden'}>
              {settings.landing_oferta2_badge && <div className="absolute top-3 right-3"><Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-xs"><TrendingUp className="w-3 h-3 mr-1" />{settings.landing_oferta2_badge}</Badge></div>}
              <CardHeader className="pb-3">
                <CardTitle className={`flex items-center gap-2 ${template === 'minimalista' ? 'text-slate-900' : 'text-white'}`}>
                  <Crown className="w-5 h-5 text-amber-400" /> {settings.landing_oferta2_titulo || 'Plano Anual'}
                </CardTitle>
                <CardDescription className={template === 'minimalista' ? '' : 'text-cyan-300'}>{settings.landing_oferta2_descricao}</CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="mb-1">
                  <span className="text-gray-400 line-through text-sm">R$ {settings.landing_preco_anual_original}</span>
                  <span className="text-green-400 text-sm ml-2">Economize R$ {settings.landing_economia_anual}!</span>
                </div>
                <div className="mb-4">
                  <span className={`text-3xl md:text-4xl font-bold ${template === 'minimalista' ? 'text-slate-900' : 'text-white'}`}>R$ {settings.landing_preco_anual}</span>
                  <span className="text-gray-400">/ano</span>
                  <div className="text-cyan-400 text-xs mt-1">= R$ {settings.landing_preco_mensal_equivalente}/mês</div>
                </div>
                <ul className="space-y-2">
                  {oferta2Features.map((item, i) => (
                    <li key={i} className={`flex items-center gap-2 text-sm ${template === 'minimalista' ? 'text-slate-700' : 'text-white'}`}>
                      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" /> {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button size="lg" className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-lg"
                  onClick={() => handleCheckout('anual')}>
                  <Crown className="w-5 h-5 mr-2" /> {settings.landing_oferta2_btn_texto || `QUERO ECONOMIZAR R$ ${settings.landing_economia_anual}`}
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>

        <div className="text-center mt-8">
          <div className={`inline-flex flex-col items-center gap-2 rounded-xl px-6 py-4 ${template === 'minimalista' ? 'bg-green-50 border border-green-200' : 'bg-green-500/10 border border-green-500/30'}`}>
            <Shield className={`w-8 h-8 ${template === 'minimalista' ? 'text-green-600' : 'text-green-400'}`} />
            <span className={`font-bold ${template === 'minimalista' ? 'text-green-700' : 'text-green-400'}`}>Garantia Total de {settings.landing_garantia_dias} Dias</span>
            <span className={`text-sm max-w-md ${template === 'minimalista' ? 'text-gray-600' : 'text-gray-400'}`}>
              Se não amar o sistema, devolvemos 100% do dinheiro. <strong className={template === 'minimalista' ? 'text-slate-900' : 'text-white'}>Risco ZERO.</strong>
            </span>
          </div>
        </div>
      </div>
    </section>
  );

  const TestimonialsSection = () => {
    if (testimonials.length === 0) return null;
    return (
      <section className={`py-16 px-4 ${template === 'minimalista' ? 'bg-gray-50' : 'bg-slate-900/50'}`}>
        <div className="container mx-auto">
          <h2 className={`text-2xl sm:text-3xl font-bold text-center mb-3 ${template === 'minimalista' ? 'text-slate-900' : 'text-white'}`}>
            {template === 'minimalista' ? 'O que nossos clientes dizem' : <>Técnicos <span className="text-cyan-400">reais</span> falando a verdade</>}
          </h2>
          <p className={`text-center mb-10 text-sm ${template === 'minimalista' ? 'text-gray-500' : 'text-gray-400'}`}>
            {template === 'minimalista' ? 'Avaliações verificadas' : 'Pessoas como você que resolveram o problema.'}
          </p>
          <div className={`grid gap-4 md:gap-6 ${testimonials.length <= 2 ? 'md:grid-cols-2 max-w-3xl mx-auto' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
            {testimonials.map((t, i) => (
              <Card key={i} className={template === 'minimalista' ? 'border-gray-200 shadow-sm hover:shadow-md transition-shadow' : '!bg-white/5 !border-white/10 backdrop-blur-sm hover:border-cyan-500/30 transition-all'}>
                <CardContent className="p-5">
                  {t.video ? (
                    <div className="aspect-video bg-black rounded-lg overflow-hidden mb-3">
                      <VideoEmbed url={t.video} />
                    </div>
                  ) : (
                    <div className="flex gap-1 mb-3">
                      {[...Array(t.stars)].map((_, j) => <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
                    </div>
                  )}
                  <p className={`mb-4 italic text-sm leading-relaxed ${template === 'minimalista' ? 'text-gray-600' : 'text-gray-300'}`}>"{t.text}"</p>
                  <div className="border-t border-white/10 pt-3 flex items-center gap-3">
                    {t.foto ? (
                      <img src={t.foto} alt={t.name} className="w-10 h-10 rounded-full object-cover border-2 border-cyan-500/30" />
                    ) : (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${template === 'minimalista' ? 'bg-slate-200 text-slate-700' : 'bg-gradient-to-br from-cyan-500/30 to-blue-500/30 text-white'}`}>
                        {t.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className={`font-semibold text-sm ${template === 'minimalista' ? 'text-slate-900' : 'text-white'}`}>{t.name}</div>
                      <div className={`text-xs ${template === 'minimalista' ? 'text-gray-500' : 'text-cyan-400'}`}>{t.role}</div>
                    </div>
                  </div>
                  {t.video && <div className="flex gap-1 mt-2">{[...Array(t.stars)].map((_, j) => <Star key={j} className="w-3 h-3 fill-amber-400 text-amber-400" />)}</div>}
                </CardContent>
              </Card>
            ))}
          </div>
          {videosSocialProof.length > 0 && (
            <div className="mt-12">
              <h3 className={`text-xl font-bold text-center mb-6 ${template === 'minimalista' ? 'text-slate-900' : 'text-white'}`}>
                🎬 Veja depoimentos em vídeo
              </h3>
              <div className={`grid gap-4 max-w-4xl mx-auto ${videosSocialProof.length === 1 ? 'max-w-2xl' : videosSocialProof.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
                {videosSocialProof.map((url, i) => (
                  <div key={i} className="aspect-video bg-black rounded-xl overflow-hidden border border-white/10">
                    <VideoEmbed url={url} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    );
  };

  const FaqSection = () => {
    if (faqs.length === 0) return null;
    return (
      <section className={`py-16 px-4 ${template === 'minimalista' ? '' : 'bg-slate-900/50'}`}>
        <div className="container mx-auto max-w-3xl">
          <h2 className={`text-2xl sm:text-3xl font-bold text-center mb-8 ${template === 'minimalista' ? 'text-slate-900' : 'text-white'}`}>
            {template === 'minimalista' ? 'Perguntas frequentes' : <>Perguntas <span className="text-cyan-400">Frequentes</span></>}
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => <FaqItem key={i} question={faq.q} answer={faq.a} />)}
          </div>
        </div>
      </section>
    );
  };

  const Footer = () => (
    <footer className={`py-8 px-4 border-t ${template === 'minimalista' ? 'border-gray-200 bg-white' : 'border-white/10'}`}>
      <div className={`container mx-auto text-center text-sm ${template === 'minimalista' ? 'text-gray-500' : 'text-gray-400'}`}>
        <div className="flex items-center justify-center gap-2 mb-4">
          <Snowflake className={`w-5 h-5 ${template === 'minimalista' ? 'text-slate-900' : 'text-cyan-400'}`} />
          <span className={`font-semibold ${template === 'minimalista' ? 'text-slate-900' : 'text-white'}`}>AC Service Pro</span>
        </div>
        <p>© 2024 AC Service Pro. Todos os direitos reservados.</p>
      </div>
    </footer>
  );

  // ─── TEMPLATE: PERSUASÃO ────────────────────────────────────────
  const renderPersuasao = () => (
    <>
      {settings.landing_bg_effect && settings.landing_bg_effect !== 'none' && (
        <GridBackground 
          effect={settings.landing_bg_effect as 'grid' | 'dots' | 'gradient'} 
          gridColor={settings.landing_bg_grid_color || '#6366f1'}
          gridOpacity={Number(settings.landing_bg_grid_opacity || 15)}
          glowColor={settings.landing_bg_glow_color || '#7c3aed'}
          fondoColor={settings.landing_cor_fundo || '#0f172a'}
        />
      )}
      {settings.landing_bg_particles !== 'false' && !settings.landing_bg_effect?.match(/grid|dots|gradient/) && (
        <InteractiveBackground color1={`${settings.landing_cor_primaria}26`} color2={`${settings.landing_cor_secundaria}20`} color3={`${settings.landing_cor_destaque}15`} />
      )}
      {settings.landing_bg_image_url && (
        <>
          <div className="fixed inset-0 z-0" style={{ backgroundImage: `url(${settings.landing_bg_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }} />
          <div className="fixed inset-0 z-0" style={{ backgroundColor: `rgba(0,0,0,${Number(settings.landing_bg_overlay_opacity || 70) / 100})` }} />
        </>
      )}
      
      {/* Hero */}
      <section className="pt-32 pb-16 px-4 relative min-h-[90vh] flex items-center" style={settings.landing_hero_bg_image ? { backgroundImage: `url(${settings.landing_hero_bg_image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
        {settings.landing_hero_bg_image && <div className="absolute inset-0 bg-black/60" />}
        <div className="container mx-auto text-center relative z-10">
          <ScrollReveal direction="fade" delay={200}>
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-full px-4 py-2 mb-6 animate-bounce">
            <Zap className="w-4 h-4 text-red-400" />
            <span className="text-red-300 text-sm font-medium">{settings.landing_badge_urgencia}</span>
            <Zap className="w-4 h-4 text-red-400 animate-pulse" />
          </div>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={400}>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            Chega de <span className="bg-gradient-to-r from-red-400 via-orange-400 to-amber-400 bg-clip-text text-transparent">{settings.landing_hero_titulo}</span>
            <br /><span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl">{settings.landing_hero_subtitulo}</span>
          </h1>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={600}>
          <p className="text-lg md:text-xl text-gray-300 mb-4 max-w-2xl mx-auto">{settings.landing_hero_descricao}</p>
          <p className="text-base md:text-lg text-amber-300 mb-8 max-w-xl mx-auto font-medium">{settings.landing_frase_destaque}</p>
          </ScrollReveal>
          <ScrollReveal direction="scale" delay={800}>
          <Button size="lg" className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-lg px-8 py-6 rounded-xl shadow-lg shadow-green-500/25 hover:scale-105 transition-all" onClick={() => handleCheckout('anual')}>
            <Crown className="w-5 h-5 mr-2" /> {settings.landing_btn_cta_texto} <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          </ScrollReveal>
          <ScrollReveal direction="up" delay={1000}>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 max-w-2xl mx-auto border border-cyan-500/20 mt-8">
            <p className="text-gray-300 text-sm mb-2"><span className="text-cyan-400 font-bold">+ de {settings.landing_social_proof_count} técnicos</span> já pararam de perder dinheiro</p>
            <div className="flex items-center justify-center gap-1">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}
              <span className="text-amber-400 ml-2 font-bold">{settings.landing_social_proof_rating}/5</span>
            </div>
          </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Dor */}
      {settings.landing_secao_dor !== 'false' && (
        <ScrollReveal direction="up">
        <section className="py-16 px-4 bg-gradient-to-b from-transparent to-red-950/20">
          <div className="container mx-auto max-w-4xl">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-4">Você se <span className="text-red-400">identifica</span> com isso?</h2>
            <div className="grid md:grid-cols-2 gap-4 mb-10">
              {["Anota serviços no papel e depois perde","Esquece de cobrar cliente","Não sabe quanto lucrou no mês","Perde tempo procurando no WhatsApp","Cliente liga e você não lembra o histórico","Já perdeu serviço por falta de organização","Trabalha muito mas o dinheiro não sobra","Usa planilha Excel mas nunca atualiza"].map((pain, i) => (
                <ScrollReveal key={i} delay={i * 80} direction="left">
                <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <X className="w-5 h-5 text-red-400 flex-shrink-0" /><span className="text-gray-300 text-sm">{pain}</span>
                </div>
                </ScrollReveal>
              ))}
            </div>
            <ScrollReveal direction="scale">
            <div className="text-center bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-2xl p-6">
              <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Se marcou 2 ou mais... <span className="text-cyan-400">você PRECISA desse sistema.</span></h3>
            </div>
            </ScrollReveal>
          </div>
        </section>
        </ScrollReveal>
      )}

      {/* Features */}
      {settings.landing_secao_features !== 'false' && (
        <ScrollReveal direction="up">
        <section className="py-16 px-4">
          <div className="container mx-auto">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-8">O que você ganha <span className="text-green-400">de verdade</span></h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {features.map((f, i) => (
                <ScrollReveal key={i} delay={i * 100} direction="scale">
                <Card className="!bg-white/5 !border-white/10 backdrop-blur-sm hover:!bg-white/10 hover:scale-105 transition-all group">
                  <CardContent className="p-4 md:p-6 text-center">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-3">
                      <f.icon className="w-6 h-6 text-cyan-400" />
                    </div>
                    <h3 className="font-semibold text-white text-sm md:text-base mb-1">{f.title}</h3>
                    <p className="text-xs md:text-sm text-gray-400">{f.desc}</p>
                  </CardContent>
                </Card>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
        </ScrollReveal>
      )}

      {/* Comparação */}
      {settings.landing_secao_comparativo !== 'false' && (
        <ScrollReveal direction="up">
        <section className="py-16 px-4 bg-slate-900/50">
          <div className="container mx-auto max-w-4xl">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-8">Por que <span className="text-cyan-400">esse é o melhor</span> sistema?</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <ScrollReveal direction="left" delay={100}>
              <Card className="!bg-red-500/5 !border-red-500/20">
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-red-400"><X className="w-5 h-5" /> Outros Sistemas</CardTitle></CardHeader>
                <CardContent><ul className="space-y-2">{["Custam R$ 150 a R$ 500/mês","Complicados demais","Precisam de treinamento","Feitos para empresas grandes","Suporte demora dias","Interface confusa"].map((item, i) => (<li key={i} className="flex items-center gap-2 text-gray-400 text-sm"><X className="w-4 h-4 text-red-400 flex-shrink-0" />{item}</li>))}</ul></CardContent>
              </Card>
              </ScrollReveal>
              <ScrollReveal direction="right" delay={200}>
              <Card className="!bg-green-500/5 !border-green-500/30">
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-green-400"><CheckCircle className="w-5 h-5" /> AC Service Pro</CardTitle></CardHeader>
                <CardContent><ul className="space-y-2">{[`Apenas R$ ${settings.landing_preco_mensal}/mês`,"Simples igual WhatsApp","Começa em 2 minutos","Feito POR técnico PARA técnico","Suporte em minutos no WhatsApp","Interface moderna e bonita"].map((item, i) => (<li key={i} className="flex items-center gap-2 text-gray-200 text-sm"><CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />{item}</li>))}</ul></CardContent>
              </Card>
              </ScrollReveal>
            </div>
          </div>
        </section>
        </ScrollReveal>
      )}

      <ScrollReveal direction="up"><PricingSection /></ScrollReveal>
      {settings.landing_secao_depoimentos !== 'false' && <ScrollReveal direction="up"><TestimonialsSection /></ScrollReveal>}
      {settings.landing_secao_faq !== 'false' && faqs.length > 0 && <ScrollReveal direction="up"><FaqSection /></ScrollReveal>}

      {/* Urgência Final */}
      <ScrollReveal direction="scale">
      <section className="py-12 px-4 bg-gradient-to-r from-red-950/30 to-orange-950/30">
        <div className="container mx-auto text-center max-w-3xl">
          <h2 className="text-xl sm:text-2xl font-bold mb-4">⚠️ Quanto você já <span className="text-red-400">perdeu</span> esse mês por falta de organização?</h2>
          <p className="text-gray-300 mb-6">Cada dia sem sistema é <strong className="text-amber-400">dinheiro que fica na mesa</strong>.</p>
        </div>
      </section>
      </ScrollReveal>

      {/* CTA Final */}
      <ScrollReveal direction="up" delay={100}>
      <section className="py-16 px-4 relative">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6">A decisão é <span className="text-cyan-400">sua</span></h2>
          <Button size="lg" className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-lg px-8 py-6 rounded-xl shadow-lg hover:scale-105 transition-all" onClick={() => handleCheckout('anual')}>
            <Crown className="w-5 h-5 mr-2" /> {settings.landing_btn_cta_texto} <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <div className="mt-4">
            <Button variant="ghost" className="text-gray-400 hover:text-white" onClick={handleContactSupport}>
              <MessageCircle className="w-4 h-4 mr-2" /> Fale com um consultor
            </Button>
          </div>
        </div>
      </section>
      </ScrollReveal>
    </>
  );

  // ─── TEMPLATE: VSL (VIDEO SALES LETTER) ─────────────────────────
  const renderVSL = () => (
    <>
      {settings.landing_bg_effect && settings.landing_bg_effect !== 'none' && (
        <GridBackground effect={settings.landing_bg_effect as 'grid' | 'dots' | 'gradient'} gridColor={settings.landing_bg_grid_color || '#6366f1'} gridOpacity={Number(settings.landing_bg_grid_opacity || 15)} glowColor={settings.landing_bg_glow_color || '#7c3aed'} fondoColor={settings.landing_cor_fundo || '#0f172a'} />
      )}
      {settings.landing_bg_particles !== 'false' && !settings.landing_bg_effect?.match(/grid|dots|gradient/) && <InteractiveBackground color1="#f59e0b26" color2="#ef444420" color3="#8b5cf615" />}
      {settings.landing_bg_image_url && (
        <>
          <div className="fixed inset-0 z-0" style={{ backgroundImage: `url(${settings.landing_bg_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }} />
          <div className="fixed inset-0 z-0" style={{ backgroundColor: `rgba(0,0,0,${Number(settings.landing_bg_overlay_opacity || 70) / 100})` }} />
        </>
      )}

      {/* Hero com Vídeo central */}
      <section className="pt-32 pb-8 px-4 min-h-[95vh] flex items-center">
        <div className="container mx-auto max-w-4xl text-center">
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 mb-6 animate-pulse text-sm px-4 py-1">
            🔴 ASSISTA AGORA — Vídeo exclusivo para técnicos
          </Badge>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 leading-tight">
            <span className="bg-gradient-to-r from-amber-400 to-red-400 bg-clip-text text-transparent">{settings.landing_hero_titulo}</span>
          </h1>
          <p className="text-gray-400 mb-8 max-w-2xl mx-auto">{settings.landing_hero_descricao}</p>

          {/* Vídeo principal */}
          {settings.landing_vsl_url ? (
            <div className="max-w-3xl mx-auto mb-8">
              <div className="aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl shadow-amber-500/20 border-2 border-amber-500/30">
                <VideoEmbed url={settings.landing_vsl_url} />
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto mb-8">
              <div className="aspect-video bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl flex items-center justify-center border-2 border-dashed border-amber-500/30">
                <div className="text-center">
                  <Play className="w-16 h-16 text-amber-400 mx-auto mb-3" />
                  <p className="text-gray-400">Configure o vídeo no painel admin</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Button size="lg" className="bg-gradient-to-r from-amber-500 to-red-500 hover:from-amber-600 hover:to-red-600 text-lg px-10 py-7 rounded-2xl shadow-xl shadow-amber-500/30 hover:scale-105 transition-all"
              onClick={() => handleCheckout('anual')}>
              <Crown className="w-6 h-6 mr-2" /> {settings.landing_btn_cta_texto} <ArrowRight className="w-6 h-6 ml-2" />
            </Button>
          </div>

          <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1"><Shield className="w-4 h-4 text-green-400" /> {settings.landing_garantia_dias} dias de garantia</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Star className="w-4 h-4 text-amber-400" /> {settings.landing_social_proof_rating}/5 ({settings.landing_social_proof_count}+ avaliações)</span>
          </div>
        </div>
      </section>

      {/* Benefícios rápidos */}
      <section className="py-12 px-4 bg-gradient-to-b from-amber-500/5 to-transparent">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {features.slice(0, 4).map((f, i) => (
              <div key={i} className="text-center p-4 rounded-xl bg-white/5 border border-amber-500/10">
                <f.icon className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                <p className="text-white text-sm font-medium">{f.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PricingSection />
      <TestimonialsSection />
      {faqs.length > 0 && <FaqSection />}

      {/* CTA Final forte */}
      <section className="py-16 px-4 bg-gradient-to-r from-amber-950/30 to-red-950/30">
        <div className="container mx-auto text-center max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Você já viu o vídeo. Agora é <span className="text-amber-400">sua decisão.</span></h2>
          <Button size="lg" className="bg-gradient-to-r from-amber-500 to-red-500 hover:from-amber-600 hover:to-red-600 text-lg px-10 py-7 rounded-2xl shadow-xl hover:scale-105 transition-all" onClick={() => handleCheckout('anual')}>
            <Crown className="w-6 h-6 mr-2" /> QUERO COMEÇAR AGORA
          </Button>
        </div>
      </section>
    </>
  );

  // ─── TEMPLATE: MINIMALISTA ──────────────────────────────────────
  const renderMinimalista = () => (
    <div className="bg-white text-slate-900">
      {/* Hero limpo */}
      <section className="pt-28 pb-20 px-4">
        <div className="container mx-auto max-w-3xl text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 text-slate-900 leading-tight tracking-tight">
            {settings.landing_hero_titulo}
          </h1>
          <p className="text-lg text-gray-500 mb-8 max-w-xl mx-auto leading-relaxed">
            {settings.landing_hero_descricao}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="bg-slate-900 text-white hover:bg-slate-800 text-base px-8 py-6 rounded-lg" onClick={() => handleCheckout('anual')}>
              Começar agora <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="border-gray-300 text-slate-700 hover:bg-gray-50 text-base px-8 py-6 rounded-lg" onClick={handleContactSupport}>
              Falar com equipe
            </Button>
          </div>
          <p className="text-sm text-gray-400 mt-4">
            {settings.landing_social_proof_count}+ profissionais • {settings.landing_garantia_dias} dias de garantia • Cancele quando quiser
          </p>
        </div>
      </section>

      {/* Features grid limpo */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12 text-slate-900">Tudo que você precisa em um lugar</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center mx-auto mb-3">
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">{f.title}</h3>
                <p className="text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PricingSection />
      <TestimonialsSection />
      {faqs.length > 0 && <FaqSection />}

      {/* CTA Final */}
      <section className="py-16 px-4">
        <div className="container mx-auto text-center max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-slate-900">Pronto para se organizar?</h2>
          <p className="text-gray-500 mb-6">Comece gratuitamente. Sem cartão de crédito.</p>
          <Button size="lg" className="bg-slate-900 text-white hover:bg-slate-800 text-base px-10 py-6 rounded-lg" onClick={() => handleCheckout('anual')}>
            Começar agora <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>
    </div>
  );

  // ─── TEMPLATE: CUSTOM / CRIAR DO ZERO ───────────────────────────
  const renderCustom = () => (
    <>
      {settings.landing_bg_effect && settings.landing_bg_effect !== 'none' && (
        <GridBackground effect={settings.landing_bg_effect as 'grid' | 'dots' | 'gradient'} gridColor={settings.landing_bg_grid_color || '#6366f1'} gridOpacity={Number(settings.landing_bg_grid_opacity || 15)} glowColor={settings.landing_bg_glow_color || '#7c3aed'} fondoColor={settings.landing_cor_fundo || '#0f172a'} />
      )}
      {settings.landing_bg_particles !== 'false' && !settings.landing_bg_effect?.match(/grid|dots|gradient/) && <InteractiveBackground color1="#8b5cf626" color2="#ec489920" color3="#06b6d415" />}
      {settings.landing_bg_image_url && (
        <>
          <div className="fixed inset-0 z-0" style={{ backgroundImage: `url(${settings.landing_bg_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }} />
          <div className="fixed inset-0 z-0" style={{ backgroundColor: `rgba(0,0,0,${Number(settings.landing_bg_overlay_opacity || 70) / 100})` }} />
        </>
      )}
      
      {/* Hero gradiente diferente */}
      <section className="pt-32 pb-16 px-4 min-h-[85vh] flex items-center relative">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 mb-4">
                <Sparkles className="w-3 h-3 mr-1" /> Sistema #1 para técnicos
              </Badge>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 leading-tight">
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">{settings.landing_hero_titulo}</span>
              </h1>
              <p className="text-lg text-gray-300 mb-6">{settings.landing_hero_descricao}</p>
              <p className="text-amber-300 mb-8 font-medium">{settings.landing_frase_destaque}</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-lg px-8 py-6 rounded-xl shadow-lg shadow-purple-500/25 hover:scale-105 transition-all" onClick={() => handleCheckout('anual')}>
                  {settings.landing_btn_cta_texto} <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button size="lg" variant="outline" className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10 text-lg px-8 py-6 rounded-xl" onClick={handleContactSupport}>
                  <MessageCircle className="w-5 h-5 mr-2" /> Falar conosco
                </Button>
              </div>
              <div className="flex items-center gap-4 mt-6 text-sm text-gray-400">
                <span className="flex items-center gap-1">{[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)} {settings.landing_social_proof_rating}/5</span>
                <span>•</span>
                <span>{settings.landing_social_proof_count}+ técnicos</span>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-3xl blur-3xl" />
                <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border border-purple-500/20">
                  <div className="grid grid-cols-2 gap-4">
                    {features.slice(0, 4).map((f, i) => (
                      <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-purple-500/30 transition-all">
                        <f.icon className="w-8 h-8 text-purple-400 mb-2" />
                        <p className="text-white text-sm font-medium">{f.title}</p>
                        <p className="text-gray-500 text-xs mt-1">{f.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features full */}
      <section className="py-16 px-4 bg-gradient-to-b from-purple-500/5 to-transparent">
        <div className="container mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-8">
            Funcionalidades <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">completas</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <div key={i} className="bg-white/5 rounded-xl p-5 border border-purple-500/10 hover:border-purple-500/30 transition-all text-center group hover:bg-white/10">
                <f.icon className="w-10 h-10 text-purple-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <h3 className="font-semibold text-white mb-1">{f.title}</h3>
                <p className="text-xs text-gray-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PricingSection />
      <TestimonialsSection />
      {faqs.length > 0 && <FaqSection />}

      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6">Comece <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">agora mesmo</span></h2>
          <Button size="lg" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-lg px-10 py-7 rounded-2xl shadow-xl hover:scale-105 transition-all" onClick={() => handleCheckout('anual')}>
            <Crown className="w-6 h-6 mr-2" /> {settings.landing_btn_cta_texto}
          </Button>
        </div>
      </section>
    </>
  );

  // ─── TEMPLATE: MODERNA ──────────────────────────────────────────
  const renderModerna = () => (
    <>
      <GridBackground effect="grid" gridColor="#6366f1" gridOpacity={12} glowColor="#7c3aed" fondoColor={settings.landing_cor_fundo || '#0a0a1a'} />
      {settings.landing_bg_image_url && (
        <>
          <div className="fixed inset-0 z-0" style={{ backgroundImage: `url(${settings.landing_bg_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }} />
          <div className="fixed inset-0 z-0" style={{ backgroundColor: `rgba(0,0,0,${Number(settings.landing_bg_overlay_opacity || 70) / 100})` }} />
        </>
      )}

      {/* Hero */}
      <section className="pt-32 pb-16 px-4 min-h-[90vh] flex items-center relative">
        <div className="container mx-auto text-center relative z-10">
          <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 mb-6 text-sm px-4 py-1.5 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 mr-1" /> {settings.landing_badge_urgencia || 'Tecnologia de ponta para técnicos'}
          </Badge>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight tracking-tight">
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">{settings.landing_hero_titulo}</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 mb-4 max-w-2xl mx-auto">{settings.landing_hero_descricao}</p>
          <p className="text-violet-300 mb-8 font-medium">{settings.landing_frase_destaque}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-lg px-10 py-7 rounded-2xl shadow-xl shadow-indigo-500/25 hover:scale-105 transition-all backdrop-blur-sm border border-white/10" onClick={() => handleCheckout('anual')}>
              <Crown className="w-5 h-5 mr-2" /> {settings.landing_btn_cta_texto} <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
          <div className="mt-8 inline-flex items-center gap-4 bg-white/5 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/10">
            <div className="flex items-center gap-1">{[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />)}</div>
            <span className="text-gray-300 text-sm"><strong className="text-white">{settings.landing_social_proof_count}+</strong> técnicos ativos</span>
          </div>
        </div>
      </section>

      {/* Features */}
      {settings.landing_secao_features !== 'false' && (
        <section className="py-16 px-4">
          <div className="container mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Tudo em <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">um só lugar</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {features.map((f, i) => (
                <div key={i} className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:border-indigo-500/40 transition-all hover:bg-white/10 text-center group">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <f.icon className="w-6 h-6 text-indigo-400" />
                  </div>
                  <h3 className="font-semibold text-white text-sm mb-1">{f.title}</h3>
                  <p className="text-xs text-gray-500">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <PricingSection />
      {settings.landing_secao_depoimentos !== 'false' && <TestimonialsSection />}
      {settings.landing_secao_faq !== 'false' && faqs.length > 0 && <FaqSection />}

      <section className="py-16 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Comece <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">agora</span></h2>
          <Button size="lg" className="bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-lg px-10 py-7 rounded-2xl shadow-xl hover:scale-105 transition-all" onClick={() => handleCheckout('anual')}>
            <Crown className="w-6 h-6 mr-2" /> {settings.landing_btn_cta_texto}
          </Button>
        </div>
      </section>
    </>
  );

  // ─── MAIN RENDER ────────────────────────────────────────────────

  return (
    <div className={`min-h-screen overflow-x-hidden ${template === 'minimalista' ? 'bg-white text-slate-900' : 'bg-gradient-to-br from-slate-900 via-blue-950 to-cyan-950 text-white'}`}>
      {settings.landing_notif_ativa !== 'false' && (
        <SubscriptionNotifications 
          interval={Number(settings.landing_notif_intervalo || 10) * 1000}
          soundEnabled={settings.landing_notif_som !== 'false'}
          soundUrl={settings.landing_notif_som_url || undefined}
          precoMensal={settings.landing_preco_mensal || '39,90'}
          precoAnual={settings.landing_preco_anual || '370'}
          customActions={settings.landing_notif_acoes || ''}
          customNames={settings.landing_notif_nomes || ''}
          customCities={settings.landing_notif_cidades || ''}
        />
      )}

      <Header />

      <style>{`@keyframes float { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-20px) rotate(180deg); } }`}</style>

      {template === 'persuasao' && renderPersuasao()}
      {template === 'vsl' && renderVSL()}
      {template === 'minimalista' && renderMinimalista()}
      {template === 'moderna' && renderModerna()}
      {template === 'custom' && renderCustom()}

      <Footer />

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowLogin(false)}>
          <Card className="w-full max-w-sm !bg-slate-800/95 !border-cyan-500/30 backdrop-blur-lg relative animate-in zoom-in-95">
            <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-gray-400 hover:text-white h-8 w-8" onClick={() => setShowLogin(false)}>
              <X className="w-4 h-4" />
            </Button>
            <CardHeader className="text-center pb-2 pt-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center mx-auto mb-2">
                <Snowflake className="w-7 h-7 text-white" />
              </div>
              <CardTitle className="text-white text-lg">{isLogin ? 'Entrar' : 'Criar Conta'}</CardTitle>
              <CardDescription className="text-gray-400 text-xs">{isLogin ? 'Acesse seu painel' : 'Cadastre-se gratuitamente'}</CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              <form onSubmit={handleAuth} className="space-y-3">
                {!isLogin && (
                  <>
                    <div><Label className="text-gray-300 text-sm">Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 h-9 text-sm" /></div>
                    <div><Label className="text-gray-300 text-sm">WhatsApp</Label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 h-9 text-sm" /></div>
                  </>
                )}
                <div><Label className="text-gray-300 text-sm">Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 h-9 text-sm" /></div>
                <div><Label className="text-gray-300 text-sm">Senha</Label>
                  <div className="relative">
                    <Input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 pr-9 h-9 text-sm" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 text-gray-400 hover:text-white h-9 w-9" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                {isLogin && (
                  <div className="flex items-center gap-2">
                    <Checkbox id="remember" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(checked as boolean)} className="border-white/30 data-[state=checked]:bg-cyan-500 h-4 w-4" />
                    <Label htmlFor="remember" className="text-gray-400 text-xs cursor-pointer">Lembrar email</Label>
                  </div>
                )}
                <Button type="submit" className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 h-9" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : isLogin ? <LogIn className="w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                  {isLogin ? 'Entrar' : 'Criar Conta'}
                </Button>
              </form>
              <div className="mt-3 text-center">
                <p className="text-gray-400 text-xs">{isLogin ? 'Não tem conta?' : 'Já tem conta?'}
                  <Button variant="link" className="text-cyan-400 hover:text-cyan-300 p-1 text-xs h-auto" onClick={() => setIsLogin(!isLogin)}>
                    {isLogin ? 'Criar conta' : 'Fazer login'}
                  </Button>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* WhatsApp Floating */}
      {settings.landing_whatsapp_flutuante !== 'false' && settings.landing_whatsapp_link && (
        <a href={`${settings.landing_whatsapp_link}?text=${encodeURIComponent(settings.landing_whatsapp_mensagem || 'Olá!')}`}
          target="_blank" rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-[#25D366] hover:bg-[#128C7E] flex items-center justify-center shadow-2xl shadow-green-500/50 hover:scale-110 transition-all group overflow-hidden"
          title="Fale conosco no WhatsApp">
          {settings.landing_whatsapp_icon_url ? (
            <img src={settings.landing_whatsapp_icon_url} alt="WhatsApp" className="w-full h-full object-cover" />
          ) : (
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-white fill-current">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
          )}
          <span className="absolute right-[72px] bg-slate-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">💬 Fale conosco!</span>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-ping" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full" />
        </a>
      )}

      {/* VSL Video Lock Modal */}
      {template === 'vsl' && settings.landing_vsl_url && settings.landing_vsl_trava === 'true' && !showLogin && (
        <div className="fixed inset-0 bg-black/95 z-[65] flex items-center justify-center p-4">
          <div className="w-full max-w-3xl">
            <h2 className="text-white text-xl font-bold text-center mb-4">🎬 Assista o vídeo antes de continuar</h2>
            <div className="aspect-video bg-black rounded-xl overflow-hidden mb-4">
              <VideoEmbed url={settings.landing_vsl_url} />
            </div>
            <div className="text-center">
              <Button onClick={() => setShowLogin(true)} className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-lg px-8 py-6">
                <Crown className="w-5 h-5 mr-2" /> QUERO COMEÇAR AGORA <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Landing;
