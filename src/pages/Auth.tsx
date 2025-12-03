import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, Download, Bell, Smartphone, Scissors } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  
  // PWA install state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

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

    // PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      setCanInstall(false);
    }

    // Check notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [navigate]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast({
        title: "App instalado!",
        description: "Acesse pela sua tela inicial."
      });
      setDeferredPrompt(null);
      setCanInstall(false);
      setIsInstalled(true);
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      
      if (permission === 'granted') {
        toast({
          title: "Notificações ativadas!",
          description: "Você receberá alertas de aniversários e agendamentos."
        });
        
        // Show test notification
        new Notification("Salão de Beleza", {
          body: "Notificações ativadas com sucesso! 🎉",
          icon: "/icon-192x192.png"
        });
      } else if (permission === 'denied') {
        toast({
          title: "Notificações bloqueadas",
          description: "Você pode ativar nas configurações do navegador.",
          variant: "destructive"
        });
      }
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });
      if (error) throw error;
      toast({
        title: "Cadastro realizado!",
        description: "Você já pode fazer login."
      });
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
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/3 -right-20 w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[120px]"></div>
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md space-y-4">
        {/* Header */}
        <div className="text-center mb-6 space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
              <Scissors className="w-10 h-10 text-purple-400" />
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 bg-clip-text text-transparent">
              Salão de Beleza
            </span>
          </h1>
          <p className="text-gray-400 text-sm">Sistema Completo de Gestão</p>
          <p className="text-xs text-gray-500">Criado por Erik Laurenti</p>
        </div>

        {/* PWA Install & Notifications Card */}
        {(canInstall || notificationPermission !== 'granted') && !isInstalled && (
          <Card className="backdrop-blur-xl bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-2xl">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-green-400 font-medium">
                <Smartphone className="w-5 h-5" />
                <span>Instale o App no seu celular!</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                {canInstall && (
                  <Button 
                    onClick={handleInstall}
                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Instalar App
                  </Button>
                )}
                {notificationPermission !== 'granted' && 'Notification' in window && (
                  <Button 
                    onClick={requestNotificationPermission}
                    variant="outline"
                    className="flex-1 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                  >
                    <Bell className="w-4 h-4 mr-2" />
                    Ativar Lembretes
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-400 text-center">
                Receba alertas de aniversários e agendamentos
              </p>
            </CardContent>
          </Card>
        )}

        {isInstalled && notificationPermission !== 'granted' && 'Notification' in window && (
          <Card className="backdrop-blur-xl bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-500/30 rounded-2xl">
            <CardContent className="p-4">
              <Button 
                onClick={requestNotificationPermission}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
              >
                <Bell className="w-4 h-4 mr-2" />
                Ativar Notificações de Lembretes
              </Button>
              <p className="text-xs text-gray-400 text-center mt-2">
                Receba alertas de aniversários e agendamentos
              </p>
            </CardContent>
          </Card>
        )}

        {/* Auth Card */}
        <Card className="backdrop-blur-xl bg-[#1a1a24]/80 border border-[#2a2a3a] rounded-2xl shadow-[0_0_50px_rgba(147,51,234,0.15)]">
          <CardContent className="p-0">
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-transparent border-b border-[#2a2a3a] rounded-none h-12">
                <TabsTrigger value="login" className="rounded-none data-[state=active]:bg-purple-600/20 data-[state=active]:text-white data-[state=active]:shadow-none text-gray-400 font-medium transition-all">
                  Login
                </TabsTrigger>
                <TabsTrigger value="signup" className="rounded-none data-[state=active]:bg-purple-600/20 data-[state=active]:text-white data-[state=active]:shadow-none text-gray-400 font-medium transition-all">
                  Cadastro
                </TabsTrigger>
              </TabsList>

              {/* Login Tab */}
              <TabsContent value="login" className="p-6 space-y-4">
                <div className="text-center space-y-1 mb-4">
                  <h2 className="text-xl font-bold text-white">FAZER LOGIN</h2>
                  <p className="text-xs text-gray-400">Acesse sua conta</p>
                </div>

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email" className="text-xs font-medium text-gray-300 uppercase">
                      EMAIL
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input 
                        id="login-email" 
                        type="email" 
                        placeholder="seu@email.com" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        required 
                        className="pl-10 h-11 bg-[#0f0f17] border-[#2a2a3a] text-white placeholder:text-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 rounded-lg" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password" className="text-xs font-medium text-gray-300 uppercase">
                      SENHA
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input 
                        id="login-password" 
                        type="password" 
                        placeholder="••••••••" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        required 
                        className="pl-10 h-11 bg-[#0f0f17] border-[#2a2a3a] text-white placeholder:text-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 rounded-lg" 
                      />
                    </div>
                  </div>

                  <div className="text-center">
                    <button 
                      type="button" 
                      onClick={() => setShowForgotPassword(true)} 
                      className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      Esqueci minha senha
                    </button>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg shadow-lg hover:shadow-purple-500/25 transition-all flex items-center justify-center gap-2" 
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <>
                        <Mail className="w-4 h-4" />
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
                  <p className="text-xs text-gray-400">Cadastre-se gratuitamente</p>
                </div>

                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-xs font-medium text-gray-300 uppercase">
                      EMAIL
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input 
                        id="signup-email" 
                        type="email" 
                        placeholder="seu@email.com" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        required 
                        className="pl-10 h-11 bg-[#0f0f17] border-[#2a2a3a] text-white placeholder:text-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 rounded-lg" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-xs font-medium text-gray-300 uppercase">
                      SENHA
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <Input 
                        id="signup-password" 
                        type="password" 
                        placeholder="••••••••" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        required 
                        minLength={6} 
                        className="pl-10 h-11 bg-[#0f0f17] border-[#2a2a3a] text-white placeholder:text-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 rounded-lg" 
                      />
                    </div>
                    <p className="text-xs text-gray-500">Mínimo 6 caracteres</p>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg shadow-lg hover:shadow-purple-500/25 transition-all flex items-center justify-center gap-2" 
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <>
                        <Mail className="w-4 h-4" />
                        CRIAR CONTA
                      </>
                    )}
                  </Button>
                  
                  <p className="text-xs text-center text-gray-500">
                    Acesso imediato após cadastro - sem confirmação de email
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Forgot Password Section */}
        {showForgotPassword && (
          <Card className="backdrop-blur-xl bg-[#1a1a24]/80 border border-[#2a2a3a] rounded-2xl shadow-[0_0_50px_rgba(147,51,234,0.15)]">
            <CardContent className="p-6 space-y-4">
              <div className="text-center space-y-1 mb-4">
                <h2 className="text-xl font-bold text-white">RECUPERAR SENHA</h2>
                <p className="text-xs text-gray-400">Digite seu email para recuperação</p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email" className="text-xs font-medium text-gray-300 uppercase">
                    EMAIL
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input 
                      id="forgot-email" 
                      type="email" 
                      placeholder="seu@email.com" 
                      value={forgotEmail} 
                      onChange={e => setForgotEmail(e.target.value)} 
                      required 
                      className="pl-10 h-11 bg-[#0f0f17] border-[#2a2a3a] text-white placeholder:text-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 rounded-lg" 
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    onClick={() => setShowForgotPassword(false)} 
                    className="flex-1 h-11 bg-[#2a2a3a] hover:bg-[#3a3a4a] text-white font-medium rounded-lg transition-all"
                  >
                    VOLTAR
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 h-11 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg shadow-lg hover:shadow-purple-500/25 transition-all" 
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "ENVIAR"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
