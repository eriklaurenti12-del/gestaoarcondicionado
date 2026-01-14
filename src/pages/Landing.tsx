import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Percent, BadgeCheck, TrendingUp, MessageCircle
} from "lucide-react";
import { SubscriptionNotifications } from "@/components/SubscriptionNotifications";
import { PromoCountdown } from "@/components/PromoCountdown";

type AdminSettings = {
  checkout_mensal: string;
  checkout_anual: string;
  whatsapp_suporte: string;
  promo_end_date: string;
};

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showLogin, setShowLogin] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [settings, setSettings] = useState<AdminSettings>({
    checkout_mensal: '',
    checkout_anual: '',
    whatsapp_suporte: 'https://wa.me/5511999999999',
    promo_end_date: ''
  });

  // Load admin settings
  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', ['checkout_mensal', 'checkout_anual', 'whatsapp_suporte', 'promo_end_date']);

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

  // Verificar se já está logado
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/');
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleCheckout = (type: 'mensal' | 'anual') => {
    const link = type === 'mensal' ? settings.checkout_mensal : settings.checkout_anual;
    if (link) {
      window.open(link, '_blank');
    } else {
      // If no checkout link, show login to create account then contact support
      setShowLogin(true);
      setIsLogin(false);
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
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        if (rememberMe) {
          localStorage.setItem('ac_remember_email', email);
        } else {
          localStorage.removeItem('ac_remember_email');
        }
        
        toast({ title: "Bem-vindo de volta!", description: "Login realizado com sucesso." });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { name }
          }
        });
        if (error) throw error;
        
        toast({ 
          title: "Conta criada!", 
          description: "Você já pode acessar o sistema." 
        });
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
    { icon: Calendar, title: "Agendamentos", desc: "Organize todos os atendimentos" },
    { icon: Users, title: "Clientes", desc: "Cadastro completo com histórico" },
    { icon: Wind, title: "Equipamentos", desc: "Controle por ar condicionado" },
    { icon: Wrench, title: "Manutenção", desc: "Alertas de limpeza preventiva" },
    { icon: FileText, title: "Ordens de Serviço", desc: "Documentos profissionais" },
    { icon: BarChart3, title: "Financeiro", desc: "Lucro real e despesas" },
    { icon: Smartphone, title: "100% Mobile", desc: "Funciona em qualquer lugar" },
    { icon: Shield, title: "Seguro", desc: "Dados protegidos na nuvem" },
  ];

  const testimonials = [
    { name: "Carlos M.", role: "Técnico Autônomo", text: "Mudou minha vida! Antes eu perdia orçamentos no papel, agora tenho tudo organizado.", stars: 5 },
    { name: "Ana Paula", role: "Empresa de Climatização", text: "O controle de manutenção preventiva aumentou nossa receita recorrente em 40%.", stars: 5 },
    { name: "Roberto S.", role: "Técnico há 15 anos", text: "Simples de usar mesmo para quem não entende de tecnologia. Recomendo!", stars: 5 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-cyan-950 text-white overflow-x-hidden">
      {/* Subscription Notifications */}
      <SubscriptionNotifications />

      {/* Promo Countdown Timer */}
      <div className="fixed top-0 left-0 right-0 z-[60]">
        <PromoCountdown endDate={settings.promo_end_date || undefined} />
      </div>

      {/* Partículas animadas de fundo */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${3 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`
            }}
          >
            <Snowflake 
              className="text-cyan-400/20" 
              style={{ 
                width: `${10 + Math.random() * 20}px`,
                height: `${10 + Math.random() * 20}px`
              }} 
            />
          </div>
        ))}
      </div>

      {/* Floating animated orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header fixo - adjusted top position for promo bar */}
      <header className="fixed top-10 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-cyan-500/20">
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

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
      `}</style>

      {/* Hero Section */}
      <section className="pt-44 pb-16 px-4 relative min-h-[90vh] flex items-center">
        <div className="container mx-auto text-center">
          {/* Badge de promoção */}
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-full px-4 py-2 mb-6 animate-bounce">
            <Gift className="w-4 h-4 text-amber-400" />
            <span className="text-amber-300 text-sm font-medium">
              PROMOÇÃO: Plano Anual com 22% OFF!
            </span>
            <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight animate-fade-in">
            Gerencie sua empresa de{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              Ar Condicionado
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-xl mx-auto animate-fade-in px-4" style={{ animationDelay: '0.2s' }}>
            Sistema completo para técnicos e empresas. Agendamentos, clientes, financeiro e mais!
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10 px-4">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-base sm:text-lg px-6 py-5 rounded-xl shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:scale-105"
              onClick={() => { setShowLogin(true); setIsLogin(false); }}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Começar Agora
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 text-base sm:text-lg px-6 py-5 rounded-xl transition-all duration-300 hover:scale-105"
              onClick={() => document.getElementById('precos')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Ver Planos
              <ChevronDown className="w-5 h-5 ml-2" />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto px-4">
            {[
              { value: "500+", label: "Técnicos" },
              { value: "15K+", label: "Serviços" },
              { value: "99.9%", label: "Uptime" },
              { value: "4.9★", label: "Avaliação" }
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

      {/* Features Grid */}
      <section className="py-16 px-4 bg-gradient-to-b from-transparent to-slate-900/50">
        <div className="container mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-3">
            Tudo em <span className="text-cyan-400">um só lugar</span>
          </h2>
          <p className="text-gray-400 text-center mb-10 max-w-md mx-auto text-sm md:text-base px-4">
            Centralize toda sua operação em uma única ferramenta profissional.
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
      </section>

      {/* Pricing Section */}
      <section id="precos" className="py-16 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent pointer-events-none" />
        
        <div className="container mx-auto relative">
          <div className="text-center mb-10">
            <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 mb-4">
              <Percent className="w-3 h-3 mr-1" />
              Preços Promocionais
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3">
              Escolha seu plano
            </h2>
            <p className="text-gray-400 max-w-md mx-auto text-sm md:text-base px-4">
              Invista menos que uma limpeza por mês e tenha acesso completo.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Plano Mensal */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm relative overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <span className="text-white text-lg">Plano Mensal</span>
                  <Clock className="w-5 h-5 text-gray-400" />
                </CardTitle>
                <CardDescription className="text-gray-400 text-sm">
                  Ideal para começar
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="mb-4">
                  <span className="text-3xl md:text-4xl font-bold text-white">R$ 39,90</span>
                  <span className="text-gray-400">/mês</span>
                </div>
                <ul className="space-y-2">
                  {[
                    "Acesso completo",
                    "Clientes ilimitados",
                    "Ordens de serviço",
                    "Controle financeiro",
                    "Suporte WhatsApp"
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
                  Assinar Mensal
                </Button>
              </CardFooter>
            </Card>

            {/* Plano Anual */}
            <Card className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-500/50 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-3 right-3">
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg text-xs">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  22% OFF
                </Badge>
              </div>
              
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  <span className="text-white text-lg">Plano Anual</span>
                </CardTitle>
                <CardDescription className="text-cyan-300 text-sm">
                  Melhor custo-benefício
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="mb-1">
                  <span className="text-gray-400 line-through text-sm">R$ 478,80</span>
                </div>
                <div className="mb-4">
                  <span className="text-3xl md:text-4xl font-bold text-white">R$ 370</span>
                  <span className="text-gray-300">/ano</span>
                  <div className="text-cyan-400 text-xs mt-1">= R$ 30,83/mês</div>
                </div>
                <ul className="space-y-2">
                  {[
                    "Tudo do mensal",
                    "2 meses grátis",
                    "Suporte prioritário",
                    "Relatórios avançados",
                    "Backup diário"
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
                  Assinar Anual
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Garantia */}
          <div className="text-center mt-6">
            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-full px-4 py-2">
              <Shield className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-xs sm:text-sm">
                Garantia de reembolso em até 7 dias
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 px-4 bg-slate-900/50">
        <div className="container mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">
            O que nossos clientes dizem
          </h2>
          
          <div className="grid md:grid-cols-3 gap-4 md:gap-6">
            {testimonials.map((t, i) => (
              <Card key={i} className="bg-white/5 border-white/10 backdrop-blur-sm">
                <CardContent className="p-5">
                  <div className="flex gap-1 mb-3">
                    {[...Array(t.stars)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-gray-300 mb-3 italic text-sm">"{t.text}"</p>
                  <div>
                    <div className="font-semibold text-white text-sm">{t.name}</div>
                    <div className="text-xs text-gray-400">{t.role}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-16 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 to-transparent pointer-events-none" />
        
        <div className="container mx-auto text-center relative">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Pronto para começar?
          </h2>
          <p className="text-gray-400 mb-6 max-w-md mx-auto text-sm md:text-base px-4">
            Junte-se a centenas de técnicos que já organizaram seu negócio.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center px-4">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-base px-6 py-5 rounded-xl shadow-lg shadow-cyan-500/25"
              onClick={() => { setShowLogin(true); setIsLogin(false); }}
            >
              Criar Conta
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="border-green-500/30 text-green-400 hover:bg-green-500/10 text-base px-6 py-5 rounded-xl"
              onClick={handleContactSupport}
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Falar com Consultor
            </Button>
          </div>
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

      {/* Modal de Login/Cadastro */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <Card className="w-full max-w-md bg-slate-900 border-cyan-500/30 relative animate-scale-in">
            <Button 
              variant="ghost" 
              size="icon"
              className="absolute top-2 right-2 text-gray-400 hover:text-white"
              onClick={() => setShowLogin(false)}
            >
              <X className="w-5 h-5" />
            </Button>
            
            <CardHeader className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center mx-auto mb-4">
                <Snowflake className="w-10 h-10 text-white" />
              </div>
              <CardTitle className="text-white text-2xl">
                {isLogin ? 'Bem-vindo de volta!' : 'Crie sua conta'}
              </CardTitle>
              <CardDescription className="text-gray-400">
                {isLogin 
                  ? 'Entre para acessar seu painel' 
                  : 'Acesse todas as funcionalidades'}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleAuth} className="space-y-4">
                {!isLogin && (
                  <div>
                    <Label className="text-gray-300">Seu nome</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Como podemos te chamar?"
                      className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                    />
                  </div>
                )}
                
                <div>
                  <Label className="text-gray-300">Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="bg-white/10 border-white/20 text-white placeholder:text-gray-500"
                  />
                </div>
                
                <div>
                  <Label className="text-gray-300">Senha</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={6}
                      className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 text-gray-400 hover:text-white"
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
                      className="border-white/30 data-[state=checked]:bg-cyan-500"
                    />
                    <Label htmlFor="remember" className="text-gray-400 text-sm cursor-pointer">
                      Lembrar meu email
                    </Label>
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : isLogin ? (
                    <LogIn className="w-4 h-4 mr-2" />
                  ) : (
                    <UserPlus className="w-4 h-4 mr-2" />
                  )}
                  {isLogin ? 'Entrar' : 'Criar Conta Grátis'}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-gray-400 text-sm">
                  {isLogin ? 'Não tem conta?' : 'Já tem conta?'}
                  <Button 
                    variant="link" 
                    className="text-cyan-400 hover:text-cyan-300 p-1"
                    onClick={() => setIsLogin(!isLogin)}
                  >
                    {isLogin ? 'Criar conta grátis' : 'Fazer login'}
                  </Button>
                </p>
              </div>

              {!isLogin && (
                <div className="mt-4 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/20 text-gray-300 hover:bg-white/10"
                    onClick={() => {
                      // Trigger PWA install
                      if ('serviceWorker' in navigator) {
                        toast({ title: "Dica!", description: "Após criar sua conta, você poderá instalar o app no seu celular!" });
                      }
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Instalar como App
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Landing;
