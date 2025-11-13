import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      toast({
        title: "Cadastro realizado!",
        description: "Você já pode fazer login.",
      });
      
      setEmail("");
      setPassword("");
    } catch (error: any) {
      toast({
        title: "Erro no cadastro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Login realizado!",
        description: "Bem-vindo de volta.",
      });
    } catch (error: any) {
      toast({
        title: "Erro no login",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });
      
      setForgotEmail("");
    } catch (error: any) {
      toast({
        title: "Erro ao enviar email",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#16161f] to-[#0a0a0f] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Efeitos de fundo com glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[150px] animate-pulse"></div>
        <div className="absolute bottom-1/3 -right-20 w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Conteúdo principal */}
      <div className="relative z-10 w-full max-w-md">
        {/* Header com título e créditos */}
        <div className="text-center mb-10 space-y-3 animate-fade-in">
          <h1 className="text-6xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 bg-clip-text text-transparent">
              GESTÃO DE NEGÓCIOS
            </span>
          </h1>
          <p className="text-gray-400 text-base font-light">
            Sistema Completo de Gestão
          </p>
          <p className="text-sm text-gray-500">
            Criado por <span className="text-purple-400 font-medium">Erik Laurenti</span>
          </p>
        </div>

        {/* Card de autenticação */}
        <Card className="backdrop-blur-2xl bg-[#1a1a24]/60 border-[#2a2a3a] shadow-[0_0_80px_rgba(147,51,234,0.15)] rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <Tabs defaultValue="login" className="w-full">
              {/* Tabs customizadas */}
              <TabsList className="grid w-full grid-cols-3 bg-transparent border-b border-[#2a2a3a] rounded-none h-14">
                <TabsTrigger 
                  value="login" 
                  className="rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-purple-500 data-[state=active]:text-white text-gray-400 font-medium transition-all"
                >
                  Login
                </TabsTrigger>
                <TabsTrigger 
                  value="signup" 
                  className="rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-purple-500 data-[state=active]:text-white text-gray-400 font-medium transition-all"
                >
                  Cadastro
                </TabsTrigger>
                <TabsTrigger 
                  value="forgot" 
                  className="rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-purple-500 data-[state=active]:text-white text-gray-400 font-medium transition-all text-xs sm:text-sm"
                >
                  Esqueci
                </TabsTrigger>
              </TabsList>

              {/* Tab Login */}
              <TabsContent value="login" className="p-8 space-y-6 animate-fade-in">
                <div className="text-center space-y-2 mb-6">
                  <h2 className="text-2xl font-bold text-white">FAZER LOGIN</h2>
                  <p className="text-sm text-gray-400">Acesse sua conta</p>
                </div>

                <form onSubmit={handleSignIn} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-sm font-medium text-gray-300 uppercase tracking-wide">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="pl-11 h-12 bg-[#0f0f17] border-[#2a2a3a] text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 rounded-lg transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-sm font-medium text-gray-300 uppercase tracking-wide">
                      Senha
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="pl-11 h-12 bg-[#0f0f17] border-[#2a2a3a] text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 rounded-lg transition-all"
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit"
                    className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg shadow-lg hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all duration-300 flex items-center justify-center gap-2" 
                    disabled={loading}
                  >
                    <Mail className="w-5 h-5" />
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "CONTINUAR"}
                  </Button>
                </form>
              </TabsContent>

              {/* Tab Cadastro */}
              <TabsContent value="signup" className="p-8 space-y-6 animate-fade-in">
                <div className="text-center space-y-2 mb-6">
                  <h2 className="text-2xl font-bold text-white">CRIAR CONTA</h2>
                  <p className="text-sm text-gray-400">Cadastre-se gratuitamente</p>
                </div>

                <form onSubmit={handleSignUp} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-sm font-medium text-gray-300 uppercase tracking-wide">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="pl-11 h-12 bg-[#0f0f17] border-[#2a2a3a] text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 rounded-lg transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-sm font-medium text-gray-300 uppercase tracking-wide">
                      Senha
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        className="pl-11 h-12 bg-[#0f0f17] border-[#2a2a3a] text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 rounded-lg transition-all"
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg shadow-lg hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all duration-300 flex items-center justify-center gap-2" 
                    disabled={loading}
                  >
                    <Mail className="w-5 h-5" />
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "CRIAR CONTA"}
                  </Button>
                </form>
              </TabsContent>

              {/* Tab Esqueci Senha */}
              <TabsContent value="forgot" className="p-8 space-y-6 animate-fade-in">
                <div className="text-center space-y-2 mb-6">
                  <h2 className="text-2xl font-bold text-white">RECUPERAR SENHA</h2>
                  <p className="text-sm text-gray-400">Digite seu email para recuperação</p>
                </div>

                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email" className="text-sm font-medium text-gray-300 uppercase tracking-wide">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="seu@email.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                        className="pl-11 h-12 bg-[#0f0f17] border-[#2a2a3a] text-white placeholder:text-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 rounded-lg transition-all"
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg shadow-lg hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all duration-300" 
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "ENVIAR EMAIL"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
