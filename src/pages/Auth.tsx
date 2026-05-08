import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase, getSafeUser } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, Wind, User, Shield, Headphones, Monitor, KeyRound, Moon, Sun } from "lucide-react";
import { lovable } from "@/integrations/lovable/index";
import { ParticleBackground } from "@/components/ParticleBackground";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/contexts/ThemeContext";
import { useSystemBranding } from "@/hooks/useSystemBranding";
import { forceUpdateApp } from "@/lib/updateApp";
import { RefreshCw } from "lucide-react";

const ROLE_INFO: Record<string, { label: string; desc: string; icon: any; color: string }> = {
  painel: { label: 'Painel Admin', desc: 'Acesso ao painel de administração', icon: Shield, color: 'text-cyan-400' },
  sistema: { label: 'Sistema Completo', desc: 'Acesso total ao sistema de gestão', icon: Monitor, color: 'text-green-400' },
  suporte: { label: 'Suporte', desc: 'Acesso para atendimento e suporte', icon: Headphones, color: 'text-amber-400' },
};

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const teamCode = searchParams.get('team');
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const { systemName, systemSubtitle, systemLogoUrl, creatorName } = useSystemBranding();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [memberName, setMemberName] = useState("");
  const [pin, setPin] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [inviteRole, setInviteRole] = useState<string | null>(null);
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    // Handle hash recovery
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');
    if (type === 'recovery' || accessToken) {
      navigate(`/reset-password${window.location.hash}`);
      return;
    }

    // Stable Auth Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      console.log('[Auth] State changed:', event);
      if (event === 'PASSWORD_RECOVERY') navigate("/reset-password");
      else if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        navigate("/dashboard");
      }
    });

    // Check current session immediately using the safe helper
    getSafeUser().then(({ user }) => {
      if (mounted && user) {
        navigate("/dashboard");
      }
    });

    if (teamCode) validateTeamInvite(teamCode);

    return () => { 
      mounted = false;
      subscription.unsubscribe(); 
    };
  }, [navigate, teamCode]);

  const validateTeamInvite = async (code: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('accept-team-invite', {
        body: { action: 'validate', invite_code: code }
      });
      if (error || !data?.valid) { setInviteValid(false); setInviteRole(null); return; }
      setInviteRole(data.team_role || 'sistema');
      setInviteValid(true);
    } catch { setInviteValid(false); setInviteRole(null); }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (teamCode) {
      if (!memberName.trim()) { toast({ title: "Nome obrigatório", description: "Digite seu nome.", variant: "destructive" }); return; }
      if (pin.length !== 4 || !/^\d{4}$/.test(pin)) { toast({ title: "PIN inválido", description: "Digite um PIN de 4 dígitos.", variant: "destructive" }); return; }
    }
    setLoading(true);
    try {
      if (!teamCode) {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { username: email.split('@')[0] } }
        });
        if (error) throw error;
        toast({ title: "Cadastro realizado!", description: "Você já pode fazer login." });
      } else {
        const uniqueEmail = `${memberName.trim().toLowerCase().replace(/\s+/g, '.')}.${Date.now()}@team.acservice.app`;
        const teamPassword = `team${pin}00`;
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: uniqueEmail, password: teamPassword,
          options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { username: memberName.trim() } }
        });
        if (error) throw error;
        if (signUpData.user) {
          const { data, error: inviteError } = await supabase.functions.invoke('accept-team-invite', {
            body: { invite_code: teamCode, user_id: signUpData.user.id, user_email: uniqueEmail, member_name: memberName.trim(), selected_role: inviteRole || 'sistema' }
          });
          if (inviteError) throw inviteError;
          if (data?.error) throw new Error(data.error);
        }
        toast({ title: "🎉 Bem-vindo à equipe!", description: `Conta criada: ${memberName}` });
        await supabase.auth.signInWithPassword({ email: uniqueEmail, password: teamPassword });
      }
      setEmail(""); setPassword(""); setMemberName(""); setPin("");
    } catch (error: any) {
      toast({ title: "Erro no cadastro", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast({ title: "Login realizado!", description: "Bem-vindo de volta." });
    } catch (error: any) {
      toast({ title: "Erro no login", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: "Erro no login com Google", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) throw error;
      toast({ title: "Email enviado!", description: "Verifique sua caixa de entrada." });
      setForgotEmail(""); setShowForgotPassword(false);
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const isDark = theme === 'dark';
  const bg = isDark ? 'bg-gradient-to-br from-[#0a1628] via-[#0d1f3c] to-[#0a1628]' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50';
  const cardBg = isDark ? 'bg-[#0d1f3c]/80 border-cyan-500/20' : 'bg-white/90 border-border';
  const inputBg = isDark ? 'bg-[#0a1628] border-cyan-500/20 text-white placeholder:text-cyan-200/30' : 'bg-background border-border text-foreground placeholder:text-muted-foreground';
  const labelColor = isDark ? 'text-cyan-100/80' : 'text-foreground';
  const subtitleColor = isDark ? 'text-cyan-200/50' : 'text-muted-foreground';
  const dividerBorder = isDark ? 'border-cyan-500/20' : 'border-border';
  const tabActive = isDark ? 'data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 text-cyan-100/50' : 'data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-muted-foreground';
  const tabListBorder = isDark ? 'border-cyan-500/20' : 'border-border';

  const roleInfo = inviteRole ? ROLE_INFO[inviteRole] : null;
  const RoleIcon = roleInfo?.icon || Monitor;

  return (
    <div className={`min-h-screen ${bg} flex flex-col items-center justify-center p-4 relative overflow-hidden`}>
      {isDark && <ParticleBackground className="z-0" />}
      
      {/* Permanent Utility Buttons */}
      <div className="fixed top-4 right-4 z-[9999] flex gap-2">
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-full bg-white/20 dark:bg-white/10 border border-white/30 dark:border-white/20 backdrop-blur-md hover:bg-white/30 dark:hover:bg-white/20 transition-colors shadow-lg"
          title={isDark ? 'Modo Claro' : 'Modo Escuro'}
        >
          {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-700" />}
        </button>
      </div>

      <div className="fixed top-4 left-4 z-[9999]">
        <button
          onClick={forceUpdateApp}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-cyan-600/90 hover:bg-cyan-500 border border-cyan-400/50 backdrop-blur-md transition-all shadow-lg shadow-cyan-500/30 group active:scale-95"
          title="Forçar Atualização do Sistema"
        >
          <RefreshCw className="w-4 h-4 text-white group-hover:rotate-180 transition-transform duration-500" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/90">Sincronizar</span>
        </button>
      </div>

      <div className="relative z-10 w-full max-w-md space-y-4">
        {/* Branding */}
        <div className="text-center mb-6 space-y-2 animate-fade-in">
          <div className="flex justify-center mb-4">
            {systemLogoUrl ? (
              <img src={systemLogoUrl} alt={systemName} className="w-16 h-16 rounded-2xl object-contain shadow-lg" />
            ) : (
              <div className={`p-4 rounded-2xl ${isDark ? 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30' : 'bg-primary/10 border border-primary/20'}`}>
                <Wind className={`w-12 h-12 ${isDark ? 'text-cyan-400' : 'text-primary'}`} />
              </div>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            <span className={isDark ? 'bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent' : 'text-foreground'}>
              {systemName}
            </span>
          </h1>
          <p className={`text-sm ${subtitleColor}`}>{systemSubtitle}</p>
        </div>

        <Card className={`backdrop-blur-xl ${cardBg} rounded-2xl shadow-xl`}>
          <CardContent className="p-0">
            {showForgotPassword ? (
              <div className="p-6 space-y-4">
                <div className="text-center mb-4">
                  <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-foreground'}`}>RECUPERAR SENHA</h2>
                </div>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase opacity-70">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type="email" placeholder="seu@email.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required className={`pl-10 h-12 ${inputBg}`} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" onClick={() => setShowForgotPassword(false)} variant="secondary" className="flex-1">VOLTAR</Button>
                    <Button type="submit" disabled={loading} className="flex-1">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "ENVIAR"}
                    </Button>
                  </div>
                </form>
              </div>
            ) : teamCode ? (
              <div className="p-6 space-y-5">
                <div className="text-center">
                  <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-foreground'}`}>CONVITE DE EQUIPE</h2>
                  {inviteValid === true && roleInfo && (
                    <div className="flex items-center justify-center gap-2 p-3 mt-4 bg-primary/10 rounded-lg">
                      <RoleIcon className={`w-5 h-5 ${roleInfo.color}`} />
                      <span className="text-sm font-medium">{roleInfo.label}</span>
                    </div>
                  )}
                </div>
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase opacity-70">Seu Nome</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type="text" placeholder="Nome completo" value={memberName} onChange={e => setMemberName(e.target.value)} required className={`pl-10 h-12 ${inputBg}`} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase opacity-70">PIN (4 números)</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type="text" inputMode="numeric" placeholder="0000" value={pin} maxLength={4} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} required className={`pl-10 h-12 ${inputBg} text-center tracking-widest text-xl`} />
                    </div>
                  </div>
                  <Button type="submit" disabled={loading} className="w-full h-12">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "ENTRAR NA EQUIPE"}
                  </Button>
                </form>
              </div>
            ) : (
              <Tabs defaultValue="login" className="w-full">
                <TabsList className={`grid w-full grid-cols-2 bg-transparent border-b ${tabListBorder} h-14`}>
                  <TabsTrigger value="login" className={`rounded-none ${tabActive} h-14`}>Login</TabsTrigger>
                  <TabsTrigger value="signup" className={`rounded-none ${tabActive} h-14`}>Cadastro</TabsTrigger>
                </TabsList>
                <TabsContent value="login" className="p-6 space-y-4">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase opacity-70">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required className={`pl-10 h-12 ${inputBg}`} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase opacity-70">Senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required className={`pl-10 h-12 ${inputBg}`} />
                      </div>
                    </div>
                    <button type="button" onClick={() => setShowForgotPassword(true)} className="text-xs text-primary hover:underline block mx-auto">Esqueci minha senha</button>
                    <Button type="submit" disabled={loading} className="w-full h-12">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "ENTRAR"}
                    </Button>
                    <div className="relative my-2">
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t opacity-20" /></div>
                      <div className="relative flex justify-center text-xs uppercase"><span className="bg-transparent px-2 text-muted-foreground">ou</span></div>
                    </div>
                    <Button type="button" onClick={handleGoogleSignIn} disabled={loading} variant="outline" className="w-full h-12">
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Google
                    </Button>
                  </form>
                </TabsContent>
                <TabsContent value="signup" className="p-6 space-y-4">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase opacity-70">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required className={`pl-10 h-12 ${inputBg}`} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase opacity-70">Senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className={`pl-10 h-12 ${inputBg}`} />
                      </div>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full h-12">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "CRIAR CONTA"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
        
        <div className="text-center opacity-30 text-[10px] uppercase tracking-tighter">
          v2.5.2-stable • {creatorName}
        </div>
      </div>
    </div>
  );
}
