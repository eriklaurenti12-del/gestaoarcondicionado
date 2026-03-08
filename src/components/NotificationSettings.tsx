import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, BellRing, BellOff, Smartphone, Monitor, AlertTriangle, Gift, DollarSign, Wrench, Calendar, CreditCard, PartyPopper, ShieldCheck, TrendingUp, Lightbulb, MessageCircle, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import LembretesTab from './LembretesTab';

const NotificationSettings: React.FC = () => {
  const [permissionStatus, setPermissionStatus] = useState<string>('default');
  const [activeTab, setActiveTab] = useState('configuracoes');
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('notification_settings');
    return saved ? JSON.parse(saved) : {
      enabled: true,
      appointments: true,
      installments: true,
      maintenance: true,
      birthdays: true,
      stock: true,
      tips: true,
      rotatingBanner: true,
      holidays: true,
      paymentSystem: true,
      overdueAlerts: true,
      weeklyReport: false,
      soundEnabled: true,
    };
  });

  useEffect(() => {
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  const saveSettings = (newSettings: typeof settings) => {
    setSettings(newSettings);
    localStorage.setItem('notification_settings', JSON.stringify(newSettings));
    toast.success('Configurações salvas!');
  };

  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);
      if (permission === 'granted') {
        toast.success('Notificações ativadas no dispositivo!');
        new Notification('AC Service Pro', {
          body: '✅ Notificações ativadas com sucesso!',
          icon: '/icon-192x192.png'
        });
      } else {
        toast.error('Permissão negada. Habilite nas configurações do navegador.');
      }
    }
  };

  const SettingRow = ({ icon: Icon, label, description, settingKey, color }: { 
    icon: any; label: string; description: string; settingKey: string; color: string 
  }) => (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch
        checked={settings[settingKey]}
        onCheckedChange={(checked) => saveSettings({ ...settings, [settingKey]: checked })}
      />
    </div>
  );

  const enabledCount = Object.entries(settings).filter(([k, v]) => k !== 'enabled' && v === true).length;
  const totalCount = Object.keys(settings).length - 1;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Bell className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Notificações & Mensagens</h2>
            <p className="text-sm text-muted-foreground">Gerencie alertas, lembretes e mensagens do sistema</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="configuracoes" className="gap-2">
            <Settings2 className="w-4 h-4" /> Configurações
          </TabsTrigger>
          <TabsTrigger value="mensagens" className="gap-2">
            <MessageCircle className="w-4 h-4" /> Lembretes & Mensagens
          </TabsTrigger>
        </TabsList>

        {/* CONFIGURAÇÕES */}
        <TabsContent value="configuracoes" className="mt-4 space-y-4">
          {/* Master Toggle */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Notificações Globais</p>
                    <p className="text-xs text-muted-foreground">Ativar/desativar todas as notificações</p>
                  </div>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked) => saveSettings({ ...settings, enabled: checked })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Device Permission */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="w-4 h-4" />
                Permissão do Dispositivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {permissionStatus === 'granted' ? (
                    <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                      <BellRing className="w-3 h-3 mr-1" /> Ativado
                    </Badge>
                  ) : permissionStatus === 'denied' ? (
                    <Badge variant="destructive">
                      <BellOff className="w-3 h-3 mr-1" /> Bloqueado
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <Bell className="w-3 h-3 mr-1" /> Não Configurado
                    </Badge>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {permissionStatus === 'granted' 
                      ? 'Seu dispositivo receberá notificações push'
                      : permissionStatus === 'denied'
                        ? 'Vá nas configurações do navegador para habilitar'
                        : 'Ative para receber alertas mesmo com o app fechado'
                    }
                  </p>
                </div>
                {permissionStatus !== 'granted' && (
                  <Button onClick={requestPermission} size="sm">
                    <BellRing className="w-4 h-4 mr-2" />
                    Ativar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Alertas do Sistema */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Alertas do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SettingRow icon={Calendar} label="Agendamentos" description="Alertas de serviços agendados, confirmados e atrasados" settingKey="appointments" color="bg-blue-500/10 text-blue-500" />
              <SettingRow icon={DollarSign} label="Parcelas e Cobranças" description="Alertas de parcelas vencidas e a vencer" settingKey="installments" color="bg-red-500/10 text-red-500" />
              <SettingRow icon={Wrench} label="Manutenções Pendentes" description="Lembretes de limpezas e manutenções preventivas" settingKey="maintenance" color="bg-amber-500/10 text-amber-500" />
              <SettingRow icon={AlertTriangle} label="Estoque Baixo" description="Alertas quando produtos estiverem abaixo do mínimo" settingKey="stock" color="bg-orange-500/10 text-orange-500" />
              <SettingRow icon={AlertTriangle} label="Serviços Atrasados" description="Agendamentos com data passada ainda pendentes" settingKey="overdueAlerts" color="bg-red-500/10 text-red-600" />
            </CardContent>
          </Card>

          {/* Lembretes e Datas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Gift className="w-4 h-4" />
                Lembretes e Datas Especiais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SettingRow icon={Gift} label="Aniversários de Clientes" description="Aviso de aniversários para ações de fidelização" settingKey="birthdays" color="bg-pink-500/10 text-pink-500" />
              <SettingRow icon={PartyPopper} label="Feriados Nacionais" description="Lembretes de feriados e datas comemorativas" settingKey="holidays" color="bg-purple-500/10 text-purple-500" />
              <SettingRow icon={CreditCard} label="Pagamento do Sistema" description="Alerta de vencimento da sua assinatura" settingKey="paymentSystem" color="bg-cyan-500/10 text-cyan-500" />
            </CardContent>
          </Card>

          {/* Exibição na Tela */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                Exibição na Tela
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SettingRow icon={BellRing} label="Banner Rotativo" description="Barra de alertas rotativos no dashboard" settingKey="rotatingBanner" color="bg-primary/10 text-primary" />
              <SettingRow icon={Lightbulb} label="Dicas do Sistema" description="Sugestões e dicas de uso do sistema" settingKey="tips" color="bg-purple-500/10 text-purple-500" />
              <SettingRow icon={TrendingUp} label="Resumo Semanal" description="Relatório resumido da semana na tela inicial" settingKey="weeklyReport" color="bg-emerald-500/10 text-emerald-500" />
              <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Som de Notificação</p>
                    <p className="text-xs text-muted-foreground">Tocar som ao receber alertas na tela</p>
                  </div>
                </div>
                <Switch
                  checked={settings.soundEnabled}
                  onCheckedChange={(checked) => saveSettings({ ...settings, soundEnabled: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LEMBRETES & MENSAGENS */}
        <TabsContent value="mensagens" className="mt-4">
          <LembretesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationSettings;
