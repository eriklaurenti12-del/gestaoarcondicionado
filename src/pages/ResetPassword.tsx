import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, Scissors, CheckCircle } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isHandled = false;

    // Setup auth listener FIRST - this is critical
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event, 'Session:', !!session);
      
      if (event === 'PASSWORD_RECOVERY') {
        console.log('PASSWORD_RECOVERY event received');
        isHandled = true;
        setIsReady(true);
        clearTimeout(timeoutId);
      } else if (event === 'SIGNED_IN' && session) {
        // User might have come from recovery and already signed in
        console.log('SIGNED_IN event with session');
        isHandled = true;
        setIsReady(true);
        clearTimeout(timeoutId);
      }
    });

    // Check for tokens in URL (both hash and query params)
    const checkUrlTokens = () => {
      // Check hash params (most common for recovery)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      
      // Check query params (alternative format)
      const queryParams = new URLSearchParams(window.location.search);
      const code = queryParams.get('code');
      const queryType = queryParams.get('type');
      
      if ((type === 'recovery' && accessToken) || (queryType === 'recovery' && code)) {
        console.log('Recovery tokens found in URL');
        return true;
      }
      
      // Check for any access token (might be recovery)
      if (accessToken || code) {
        console.log('Access token found in URL');
        return true;
      }
      
      return false;
    };

    const hasTokens = checkUrlTokens();
    
    if (hasTokens) {
      // Tokens found - wait for auth event or session
      console.log('Waiting for Supabase to process tokens...');
      
      // Give Supabase time to process the tokens
      timeoutId = setTimeout(async () => {
        if (isHandled) return;
        
        // Check if session was established
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Timeout check - session:', !!session);
        
        if (session) {
          setIsReady(true);
        } else {
          // Still no session - might need more time or there's an issue
          toast({
            title: "Erro na verificação",
            description: "Não foi possível verificar o link. Tente novamente.",
            variant: "destructive",
          });
          navigate("/auth");
        }
      }, 3000);
    } else {
      // No tokens in URL - check for existing session
      supabase.auth.getSession().then(({ data: { session } }) => {
        console.log('No tokens, checking session:', !!session);
        if (session) {
          setIsReady(true);
        } else {
          toast({
            title: "Acesso negado",
            description: "Use o link enviado por email para redefinir sua senha.",
            variant: "destructive",
          });
          navigate("/auth");
        }
      });
    }

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
    };
  }, [navigate, toast]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter no mínimo 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      setSuccess(true);
      toast({
        title: "Senha alterada!",
        description: "Sua senha foi alterada com sucesso.",
      });
      
      setTimeout(() => {
        navigate("/");
      }, 3000);
    } catch (error: any) {
      toast({
        title: "Erro ao alterar senha",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-1/3 -right-20 w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[120px]"></div>
        </div>
        <Card className="w-full max-w-md backdrop-blur-xl bg-[#1a1a24]/80 border border-[#2a2a3a] rounded-2xl">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <p className="text-gray-400">Verificando acesso...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-1/3 -right-20 w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[120px]"></div>
        </div>
        <Card className="w-full max-w-md backdrop-blur-xl bg-[#1a1a24]/80 border border-green-500/30 rounded-2xl">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-3 rounded-full bg-green-500/20">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-white">Senha Alterada!</h2>
              <p className="text-gray-400">Redirecionando para o sistema...</p>
              <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/3 -right-20 w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6 space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
              <Scissors className="w-10 h-10 text-purple-400" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 bg-clip-text text-transparent">
              Redefinir Senha
            </span>
          </h1>
          <p className="text-gray-400 text-sm">Digite sua nova senha</p>
        </div>

        <Card className="backdrop-blur-xl bg-[#1a1a24]/80 border border-[#2a2a3a] rounded-2xl shadow-[0_0_50px_rgba(147,51,234,0.15)]">
          <CardContent className="p-6">
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium text-gray-300 uppercase">
                  NOVA SENHA
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pl-10 h-11 bg-[#0f0f17] border-[#2a2a3a] text-white placeholder:text-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 rounded-lg"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-xs font-medium text-gray-300 uppercase">
                  CONFIRMAR SENHA
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pl-10 h-11 bg-[#0f0f17] border-[#2a2a3a] text-white placeholder:text-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 rounded-lg"
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-lg shadow-lg hover:shadow-purple-500/25 transition-all" 
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "ALTERAR SENHA"
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-gray-400 hover:text-white"
                onClick={() => navigate("/auth")}
              >
                Voltar para Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
