import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Settings, LogOut, Building2, ChevronDown } from "lucide-react";

interface UserProfileDropdownProps {
  onSignOut: () => void;
  onNavigateCompany: () => void;
}

export function UserProfileDropdown({ onSignOut, onNavigateCompany }: UserProfileDropdownProps) {
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    const loadUser = async () => {
      const { data: sessionData } = await supabase.auth.getSession(); const session = sessionData?.session;
      if (session?.user) {
        setUserEmail(session.user.email || "");
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("user_id", session.user.id)
          .maybeSingle();
        setUserName(profile?.username || session.user.email?.split("@")[0] || "Usuário");
      }
    };
    loadUser();
  }, []);

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors outline-none">
          <Avatar className="h-8 w-8 border border-border">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
              {initials || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col items-start text-left">
            <span className="text-xs font-semibold truncate max-w-[120px]">{userName}</span>
            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{userEmail}</span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden md:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-3 py-2">
          <p className="text-sm font-semibold">{userName}</p>
          <p className="text-xs text-muted-foreground">{userEmail}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onNavigateCompany} className="gap-2 cursor-pointer">
          <Building2 className="w-4 h-4" />
          Minha Empresa
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="w-4 h-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
