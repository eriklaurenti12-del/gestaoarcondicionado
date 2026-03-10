import { useState, useEffect, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_URL = 'https://gestaoarcondicionado.lovable.app';

interface DomainSettings {
  customDomain: string;
  savedDomain: string;
  useCustomDomain: boolean;
  loading: boolean;
  baseUrl: string;
  landingUrl: string;
  loginUrl: string;
  cadastroUrl: string;
  portalUrl: string;
  agendamentoUrl: string;
}

export function useDomainSettings(): DomainSettings {
  const [customDomain, setCustomDomain] = useState('');
  const [savedDomain, setSavedDomain] = useState('');
  const [useCustomDomain, setUseCustomDomain] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase
          .from('admin_settings')
          .select('key, value')
          .in('key', ['custom_domain', 'use_custom_domain']);

        if (data) {
          const domainRow = data.find(r => r.key === 'custom_domain');
          const useRow = data.find(r => r.key === 'use_custom_domain');
          if (domainRow?.value) {
            setCustomDomain(domainRow.value);
            setSavedDomain(domainRow.value);
          }
          if (useRow?.value === 'true') {
            setUseCustomDomain(true);
          }
        }
      } catch (e) {
        console.error('Error loading domain settings:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const baseUrl = useCustomDomain && savedDomain ? savedDomain : DEFAULT_URL;

  return {
    customDomain,
    savedDomain,
    useCustomDomain,
    loading,
    baseUrl,
    landingUrl: baseUrl + '/vendas',
    loginUrl: baseUrl + '/?login=true',
    cadastroUrl: baseUrl + '/?cadastro=true',
    portalUrl: baseUrl + '/portal',
    agendamentoUrl: baseUrl + '/agendar',
  };
}

export { DEFAULT_URL };
