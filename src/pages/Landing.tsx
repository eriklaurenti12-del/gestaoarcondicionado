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
  Percent, BadgeCheck, TrendingUp
} from "lucide-react";

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
      {/* Partículas animadas de fundo */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 3}s`
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

      {/* Header fixo */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-cyan-500/20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <Snowflake className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              AC Service Pro
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              className="text-white hover:bg-white/10"
              onClick={() => { setShowLogin(true); setIsLogin(true); }}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Entrar
            </Button>
            <Button 
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
              onClick={() => { setShowLogin(true); setIsLogin(false); }}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Criar Conta
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative">
        <div className="container mx-auto text-center">
          {/* Badge de promoção */}
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-full px-4 py-2 mb-6 animate-pulse">
            <Gift className="w-4 h-4 text-amber-400" />
            <span className="text-amber-300 text-sm font-medium">
              🔥 PROMOÇÃO: Plano Anual com 22% OFF!
            </span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Gerencie sua empresa de
            <br />
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
              Ar Condicionado
            </span>
            <br />
            como um profissional
          </h1>
          
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Sistema completo para técnicos e empresas de climatização. 
            Agendamentos, clientes, ordens de serviço, financeiro e muito mais!
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-lg px-8 py-6 rounded-xl shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:scale-105"
              onClick={() => { setShowLogin(true); setIsLogin(false); }}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Começar Grátis por 7 Dias
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 text-lg px-8 py-6 rounded-xl"
              onClick={() => document.getElementById('precos')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Ver Planos e Preços
              <ChevronDown className="w-5 h-5 ml-2" />
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { value: "500+", label: "Técnicos ativos" },
              { value: "15.000+", label: "Serviços gerenciados" },
              { value: "99.9%", label: "Uptime garantido" },
              { value: "4.9★", label: "Avaliação média" }
            ].map((stat, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="text-2xl md:text-3xl font-bold text-cyan-400">{stat.value}</div>
                <div className="text-sm text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 bg-gradient-to-b from-transparent to-slate-900/50">
        <div className="container mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Tudo que você precisa em
            <span className="text-cyan-400"> um só lugar</span>
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-xl mx-auto">
            Pare de usar papel, planilhas e WhatsApp separados. 
            Centralize toda sua operação em uma única ferramenta.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {features.map((feature, i) => (
              <Card 
                key={i} 
                className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 hover:scale-105 hover:border-cyan-500/50 group"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-4 group-hover:from-cyan-500/30 group-hover:to-blue-500/30 transition-all">
                    <feature.icon className="w-6 h-6 text-cyan-400" />
                  </div>
                  <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                  <p className="text-sm text-gray-400">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="precos" className="py-20 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent pointer-events-none" />
        
        <div className="container mx-auto relative">
          <div className="text-center mb-12">
            <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 mb-4">
              <Percent className="w-3 h-3 mr-1" />
              Preços Promocionais
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Escolha seu plano
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Invista menos do que um serviço de limpeza por mês e tenha acesso a todas as funcionalidades.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Plano Mensal */}
            <Card className="bg-white/5 border-white/10 backdrop-blur-sm relative overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center justify-between">
                  <span className="text-white">Plano Mensal</span>
                  <Clock className="w-5 h-5 text-gray-400" />
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Ideal para começar
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-6">
                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">R$ 39,90</span>
                  <span className="text-gray-400">/mês</span>
                </div>
                <ul className="space-y-3">
                  {[
                    "Acesso completo ao sistema",
                    "Clientes e agendamentos ilimitados",
                    "Ordens de serviço e orçamentos",
                    "Controle financeiro completo",
                    "Suporte via WhatsApp",
                    "Atualizações gratuitas"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-300">
                      <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full bg-white/10 hover:bg-white/20 text-white"
                  onClick={() => { setShowLogin(true); setIsLogin(false); }}
                >
                  Começar com 7 dias grátis
                </Button>
              </CardFooter>
            </Card>

            {/* Plano Anual - Destacado */}
            <Card className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-500/50 backdrop-blur-sm relative overflow-hidden">
              {/* Badge de economia */}
              <div className="absolute top-4 right-4">
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  ECONOMIZE 22%
                </Badge>
              </div>
              
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  <span className="text-white">Plano Anual</span>
                </CardTitle>
                <CardDescription className="text-cyan-300">
                  Melhor custo-benefício
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-6">
                <div className="mb-2">
                  <span className="text-gray-400 line-through text-lg">R$ 478,80</span>
                </div>
                <div className="mb-6">
                  <span className="text-5xl font-bold text-white">R$ 370</span>
                  <span className="text-gray-300">/ano</span>
                  <div className="text-cyan-400 text-sm mt-1">
                    = R$ 30,83/mês
                  </div>
                </div>
                <ul className="space-y-3">
                  {[
                    "✅ Tudo do plano mensal",
                    "🎁 2 meses grátis inclusos",
                    "⚡ Suporte prioritário",
                    "📊 Relatórios avançados",
                    "🔒 Backup automático diário",
                    "🎓 Treinamento exclusivo"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-white">
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  size="lg"
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold shadow-lg shadow-cyan-500/25"
                  onClick={() => { setShowLogin(true); setIsLogin(false); }}
                >
                  <BadgeCheck className="w-5 h-5 mr-2" />
                  Assinar Plano Anual
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Garantia */}
          <div className="text-center mt-8">
            <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-full px-4 py-2">
              <Shield className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-sm">
                Garantia de 7 dias: não gostou, devolvemos seu dinheiro
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-slate-900/50">
        <div className="container mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            O que nossos clientes dizem
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <Card key={i} className="bg-white/5 border-white/10 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(t.stars)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-gray-300 mb-4 italic">"{t.text}"</p>
                  <div>
                    <div className="font-semibold text-white">{t.name}</div>
                    <div className="text-sm text-gray-400">{t.role}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 to-transparent pointer-events-none" />
        
        <div className="container mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Pronto para transformar seu negócio?
          </h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Junte-se a centenas de técnicos que já organizaram sua vida profissional com o AC Service Pro.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-lg px-8 py-6 rounded-xl shadow-lg shadow-cyan-500/25"
              onClick={() => { setShowLogin(true); setIsLogin(false); }}
            >
              Criar Conta Grátis
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10 text-lg px-8 py-6 rounded-xl"
              onClick={() => window.open('https://wa.me/5511999999999?text=Olá! Gostaria de saber mais sobre o AC Service Pro', '_blank')}
            >
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
                  : '7 dias grátis para testar todas as funcionalidades'}
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
