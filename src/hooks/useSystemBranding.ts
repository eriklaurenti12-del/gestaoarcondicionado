import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SystemBranding {
  systemName: string;
  systemSubtitle: string;
  systemLogoUrl: string | null;
  creatorName: string;
  isLoading: boolean;
}

export function useSystemBranding(): SystemBranding {
  const { data, isLoading } = useQuery({
    queryKey: ['system-branding'],
    queryFn: async () => {
      const keys = ['system_name', 'system_subtitle', 'system_logo_url', 'system_creator'];
      const { data, error } = await supabase
        .from('admin_settings')
        .select('key, value')
        .in('key', keys);
      
      if (error) return {};
      const settings: Record<string, string> = {};
      data?.forEach(item => { settings[item.key] = item.value || ''; });
      return settings;
    },
    staleTime: 60 * 1000,
  });

  return {
    systemName: data?.system_name || 'AC Service Pro',
    systemSubtitle: data?.system_subtitle || 'Sistema de Gestão para Ar Condicionado',
    systemLogoUrl: data?.system_logo_url || null,
    creatorName: data?.system_creator || 'Erik Laurenti',
    isLoading,
  };
}
