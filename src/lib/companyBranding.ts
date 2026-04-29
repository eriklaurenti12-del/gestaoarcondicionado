import { supabase } from "@/integrations/supabase/client";

export interface CompanyBranding {
  companyName: string;
  cnpjCpf: string;
  email: string;
  whatsapp: string;
  address: string;
  logoBase64: string | null;
}

/**
 * Fetch branding for the current logged-in user from the database (single source of truth).
 * Returns logo as base64 (so jsPDF can embed it). Safe across login switches.
 */
export async function getCurrentCompanyBranding(): Promise<CompanyBranding> {
  const empty: CompanyBranding = {
    companyName: '',
    cnpjCpf: '',
    email: '',
    whatsapp: '',
    address: '',
    logoBase64: null,
  };

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return empty;

  const { data, error } = await supabase
    .from('company_data')
    .select('company_name, cnpj_cpf, email, whatsapp, address, logo_url')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error || !data) return empty;

  let logoBase64: string | null = null;
  if (data.logo_url) {
    try {
      const resp = await fetch(data.logo_url);
      const blob = await resp.blob();
      logoBase64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    } catch {
      logoBase64 = null;
    }
  }

  return {
    companyName: data.company_name || '',
    cnpjCpf: data.cnpj_cpf || '',
    email: data.email || '',
    whatsapp: data.whatsapp || '',
    address: data.address || '',
    logoBase64,
  };
}
