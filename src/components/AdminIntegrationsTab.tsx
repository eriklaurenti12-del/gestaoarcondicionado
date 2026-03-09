import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Copy, CheckCircle2, XCircle, Send, Loader2,
  ExternalLink, RefreshCw, Zap, Globe, Shield,
  CreditCard, Smartphone, Eye, EyeOff, Code, Plug,
  FileJson, Key, Plus, Trash2, Settings, ChevronDown
} from "lucide-react";

const WEBHOOK_URL = `https://gnrinwqmqhfasfojysep.supabase.co/functions/v1/payment-webhook`;

type TestResult = { success: boolean; message: string; data?: any; timestamp: string; };

type Platform = {
  name: string; slug: string; color: string; icon: string;
  guide: string[]; events: string[];
};

const PLATFORMS: Platform[] = [
  { name: 'Cakto', slug: 'cakto', color: 'from-pink-500 to-rose-600', icon: '🎂', guide: ['Configurações > Integrações > Webhook', 'Cole a URL do webhook', 'Selecione: pagamento aprovado/recusado', 'Salve e teste'], events: ['payment_approved', 'payment_refused', 'subscription_active'] },
  { name: 'GGCheckout', slug: 'ggcheckout', color: 'from-green-500 to-emerald-600', icon: '💳', guide: ['Configurações > Webhooks', 'Adicionar Webhook', 'Cole a URL, selecione "Pagamento Aprovado"', 'Salve'], events: ['pix_paid', 'card_paid', 'failed'] },
  { name: 'Hotmart', slug: 'hotmart', color: 'from-orange-500 to-red-500', icon: '🔥', guide: ['Ferramentas > Webhook (Hottok)', 'Configure a URL de notificação', 'Selecione compra aprovada', 'Ative'], events: ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE'] },
  { name: 'Kiwify', slug: 'kiwify', color: 'from-purple-500 to-violet-600', icon: '🥝', guide: ['Configurações > Webhooks', 'Adicione URL', 'Selecione "Compra Aprovada"', 'Salve'], events: ['order_paid', 'subscription_created'] },
  { name: 'Eduzz', slug: 'eduzz', color: 'from-blue-500 to-indigo-600', icon: '📦', guide: ['Configurações > Notificações', 'Configure Postback URL', 'Selecione "Pago"', 'Ative'], events: ['paid', 'refunded'] },
  { name: 'Monetizze', slug: 'monetizze', color: 'from-teal-500 to-cyan-600', icon: '💰', guide: ['Configurações > Postback', 'Informe a URL', 'Selecione "Compra Finalizada"', 'Salve'], events: ['Finalizada', 'Cancelada'] },
  { name: 'Stripe', slug: 'stripe', color: 'from-indigo-500 to-purple-600', icon: '💎', guide: ['Developers > Webhooks', 'Add Endpoint', 'Cole URL e selecione eventos', 'Salve'], events: ['checkout.session.completed', 'payment_intent.succeeded'] },
  { name: 'Mercado Pago', slug: 'mercadopago', color: 'from-sky-400 to-blue-500', icon: '🔵', guide: ['Configurações > Notificações IPN', 'Configure URL', 'Selecione "Payments"', 'Salve'], events: ['payment.created', 'payment.updated'] },
  { name: 'PagSeguro', slug: 'pagseguro', color: 'from-green-400 to-green-600', icon: '🟢', guide: ['Vendas > Configurações', 'URL de notificação', 'Transações aprovadas', 'Salve'], events: ['paid', 'available'] },
  { name: 'Braip', slug: 'braip', color: 'from-amber-500 to-orange-600', icon: '🚀', guide: ['Configurações > Postback', 'URL de notificação', '"Venda Aprovada"', 'Ative'], events: ['approved', 'refunded'] },
  { name: 'Yampi', slug: 'yampi', color: 'from-violet-500 to-fuchsia-600', icon: '🛒', guide: ['Configurações > Webhooks', 'Adicione URL', 'Eventos de pedido', 'Salve'], events: ['order.paid', 'order.cancelled'] },
  { name: 'Pepper', slug: 'pepper', color: 'from-red-500 to-orange-500', icon: '🌶️', guide: ['Mesmo do Hotmart', 'Ferramentas > Webhook', 'Configure compra', 'Salve'], events: ['PURCHASE_APPROVED'] },
];

const PLANS = [
  { id: 'mensal', label: 'Mensal', icon: '💳', placeholder: '29.90' },
  { id: 'trimestral', label: 'Trimestral', icon: '📘', placeholder: '69.90' },
  { id: 'semestral', label: 'Semestral', icon: '📗', placeholder: '149.90' },
  { id: 'anual', label: 'Anual', icon: '⭐', placeholder: '199.90' },
  { id: 'vitalicio', label: 'Vitalício', icon: '👑', placeholder: '499.90' },
];

export const AdminIntegrationsTab: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [testResults
