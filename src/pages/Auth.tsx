import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, Wind, Users } from "lucide-react";
import { ParticleBackground } from "@/components/ParticleBackground";

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const teamCode = searchParams.get('team');
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  useEffect(() => {
    // Check URL for recovery tokens - redirect to reset-password page
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');

    if (type === 'recovery' || accessToken) {
      // Redirect to reset-password with tokens
      navigate(`/reset-password${window.location.hash}`);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate("/reset-password");
      } else if (event === 'SIGNED_IN' && session) {
        navigate("/dashboard");
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });
      if (error) throw error;

      // If team invite code, accept it
      if (teamCode && signUpData.user) {
        await supabase.functions.invoke('accept-team-invite', {
          body: {
            invite_code: teamCode,
            user_id: signUpData.user.id,
            user_email: email
          }
        });
        toast({
          title: "🎉 Bem-vindo à equipe!",
          description: "Conta criada com acesso de co-administrador."
        });
      } else {
        toast({
          title: "Cadastro realizado!",
          description: "Você já pode fazer login."
        });
      }
      setEmail("");
      setPassword("");
    } catch (error: any) {
      toast({
        title: "Erro no cadastro",
        description: error.message,
        variant: "destructive"
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
        password
      });
      if (error) throw error;
      toast({
        title: "Login realizado!",
        description: "Bem-vindo de volta."
      });
    } catch (error: any) {
      toast({
        title: "Erro no login",
        description: error.message,
        variant: "destructive"
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
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir sua senha."
      });
      setForgotEmail("");
      setShowForgotPassword(false);
    } catch (error: any) {
      toast({
        title: "Erro ao enviar email",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects - AC theme */}
      {/* Background effects - AC theme */}
      <ParticleBackground className="z-0" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {/* Glow effects - kept for atmosphere but reduced */}
        <div className="absolute top-1/4 -left-20 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-1/3 -right-20 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] animate-pulse"></div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(6,182,212,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.3) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md space-y-4">
        {/* Header */}
        <div className="text-center mb-6 space-y-2 animate-fade-in">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 hover:scale-110 transition-transform duration-300 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
              <Wind className="w-12 h-12 text-cyan-400" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              AC Service Pro
            </span>
          </h1>
          <p className="text-cyan-100/70 text-sm">Sistema de Gestão para Ar Condicionado</p>
          <p className="text-xs text-cyan-200/40">Criado por Erik Laurenti</p>
        </div>

        {/* Show ONLY Recovery Card OR Login Card - never both */}
        {showForgotPassword ? (
          <Card className="backdrop-blur-xl bg-[#0d1f3c]/80 border border-cyan-500/20 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] animate-scale-in">
            <CardContent className="p-6 space-y-4">
              <div className="text-center space-y-1 mb-4">
                <h2 className="text-xl font-bold text-white">RECUPERAR SENHA</h2>
                <p className="text-xs text-cyan-200/50">Digite seu email para recuperação</p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email" className="text-xs font-medium text-cyan-100/80 uppercase">
                    EMAIL
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500/50" />
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      required
                      className="pl-10 h-12 bg-[#0a1628] border-cyan-500/20 text-white placeholder:text-cyan-200/30 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 rounded-lg transition-all duration-200"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="flex-1 h-12 bg-[#1a3a5c] hover:bg-[#234b75] text-white font-medium rounded-lg transition-all duration-200 hover:scale-[1.02]"
                  >
                    VOLTAR
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-12 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium rounded-lg shadow-lg hover:shadow-cyan-500/25 transition-all duration-200 hover:scale-[1.02]"
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "ENVIAR"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="backdrop-blur-xl bg-[#0d1f3c]/80 border border-cyan-500/20 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.15)] animate-scale-in">
            <CardContent className="p-0">
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-transparent border-b border-cyan-500/20 rounded-none h-14">
                  <TabsTrigger value="login" className="rounded-none data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 data-[state=active]:shadow-none text-cyan-100/50 font-medium transition-all duration-200 h-14">
                    Login
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-none data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 data-[state=active]:shadow-none text-cyan-100/50 font-medium transition-all duration-200 h-14">
                    Cadastro
                  </TabsTrigger>
                </TabsList>

                {/* Login Tab */}
                <TabsContent value="login" className="p-6 space-y-4">
                  <div className="text-center space-y-1 mb-4">
                    <h2 className="text-xl font-bold text-white">FAZER LOGIN</h2>
                    <p className="text-xs text-cyan-200/50">Acesse sua conta</p>
                  </div>

                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-xs font-medium text-cyan-100/80 uppercase">
                        EMAIL
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500/50" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="seu@email.com"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          required
                          className="pl-10 h-12 bg-[#0a1628] border-cyan-500/20 text-white placeholder:text-cyan-200/30 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 rounded-lg transition-all duration-200"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password" className="text-xs font-medium text-cyan-100/80 uppercase">
                        SENHA
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500/50" />
                        <Input
                          id="login-password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                          className="pl-10 h-12 bg-[#0a1628] border-cyan-500/20 text-white placeholder:text-cyan-200/30 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 rounded-lg transition-all duration-200"
                        />
                      </div>
                    </div>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors hover:underline"
                      >
                        Esqueci minha senha
                      </button>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium rounded-lg shadow-lg hover:shadow-cyan-500/25 transition-all duration-200 hover:scale-[1.02] flex items-center justify-center gap-2"
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        <>
                          <Wind className="w-4 h-4" />
                          ENTRAR
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>

                {/* Signup Tab */}
                <TabsContent value="signup" className="p-6 space-y-4">
                  <div className="text-center space-y-1 mb-4">
                    <h2 className="text-xl font-bold text-white">CRIAR CONTA</h2>
                    <p className="text-xs text-cyan-200/50">
                      {teamCode ? '🔗 Convite de equipe detectado' : 'Cadastre-se gratuitamente'}
                    </p>
                    {teamCode && (
                      <div className="flex items-center justify-center gap-2 mt-2 p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
                        <Users className="w-4 h-4 text-cyan-400" />
                        <span className="text-cyan-300 text-xs font-medium">Acesso Co-Admin ao criar conta</span>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-xs font-medium text-cyan-100/80 uppercase">
                        EMAIL
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500/50" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="seu@email.com"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          required
                          className="pl-10 h-12 bg-[#0a1628] border-cyan-500/20 text-white placeholder:text-cyan-200/30 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 rounded-lg transition-all duration-200"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-xs font-medium text-cyan-100/80 uppercase">
                        SENHA
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500/50" />
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                          minLength={6}
                          className="pl-10 h-12 bg-[#0a1628] border-cyan-500/20 text-white placeholder:text-cyan-200/30 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 rounded-lg transition-all duration-200"
                        />
                      </div>
                      <p className="text-xs text-cyan-200/40">Mínimo 6 caracteres</p>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-medium rounded-lg shadow-lg hover:shadow-cyan-500/25 transition-all duration-200 hover:scale-[1.02] flex items-center justify-center gap-2"
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        <>
                          <Wind className="w-4 h-4" />
                          CRIAR CONTA
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-center text-cyan-200/40">
                      Acesso imediato após cadastro - sem confirmação de email
                    </p>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
