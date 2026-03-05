import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wind, User, KeyRound } from "lucide-react";

export default function TeamPortalLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [nameOrPhone, setNameOrPhone] = useState("");
  const [pin, setPin] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameOrPhone.trim() || pin.length !== 4) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Try to find the team member by matching accepted_email (username) in team_invites
      const { data: invites } = await supabase
        .from('team_invites')
        .select('accepted_email, accepted_by, team_role')
        .eq('status', 'accepted');

      if (!invites || invites.length === 0) {
        throw new Error("Nenhum membro encontrado");
      }

      // Find matching member by name (case insensitive)
      const match = invites.find((i: any) => 
        i.accepted_email?.toLowerCase() === nameOrPhone.trim().toLowerCase()
      );

      if (!match || !match.accepted_email) {
        throw new Error("Nome não encontrado. Verifique com o administrador.");
      }

      // Build the email used during team signup
      const memberName = match.accepted_email;
      // We need to find the actual auth email - query profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('username', memberName)
        .maybeSingle();

      if (!profile) {
        throw new Error("Perfil não encontrado. Contate o administrador.");
      }

      // Try to sign in using the team password pattern
      const teamPassword = `team${pin}00`;
      
      // We need to find the user's email from auth - use admin-members edge function won't work here
      // Instead, list profiles to find matching user and try login
      const { data: allInvites } = await supabase
        .from('team_invites')
        .select('*')
        .eq('accepted_by', profile.user_id)
        .eq('status', 'accepted')
        .maybeSingle();

      // Try to get user email pattern from the profile user_id
      // The email pattern is: name.timestamp@team.acservice.app
      // We'll try signing in with the service - need to find the actual email
      
      // Alternative: query auth users through profiles
      const { data: { users }, error: listError } = await (supabase.auth.admin as any).listUsers();
      
      // Since we can't list users client-side, use edge function
      const { data: loginResult, error: loginError } = await supabase.functions.invoke('team-portal-login', {
        body: { member_name: nameOrPhone.trim(), pin }
      });

      if (loginError || loginResult?.error) {
        throw new Error(loginResult?.error || loginError?.message || "Erro ao fazer login");
      }

      if (loginResult?.email && loginResult?.password) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: loginResult.email,
          password: loginResult.password,
        });
        if (signInError) throw signInError;
        
        toast({ title: `Olá, ${memberName}!`, description: "Bem-vindo ao portal." });
        navigate("/dashboard");
      } else {
        throw new Error("Credenciais não encontradas");
      }
    } catch (error: any) {
      toast({ title: "Erro no acesso", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <Card className="border border-border/50 shadow-lg rounded-2xl">
          <CardContent className="p-8 space-y-6">
            {/* Logo */}
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 rounded-full bg-primary/10 border border-primary/20">
                <Wind className="w-10 h-10 text-primary" />
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-bold text-foreground">Portal da Equipe</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Entre com seu <strong className="text-primary">nome</strong> ou{" "}
                  <strong className="text-primary">número de telefone</strong> e sua senha
                </p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Nome ou WhatsApp</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Seu nome ou telefone"
                    value={nameOrPhone}
                    onChange={e => setNameOrPhone(e.target.value)}
                    required
                    className="pl-10 h-12 rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Senha (4 dígitos)</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="password"
                    inputMode="numeric"
                    placeholder="••••"
                    value={pin}
                    maxLength={4}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    required
                    className="pl-10 h-12 rounded-lg text-center text-2xl tracking-[0.5em] font-mono"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Primeiro acesso? Use o PIN enviado pelo administrador.
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-lg text-base font-semibold"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
