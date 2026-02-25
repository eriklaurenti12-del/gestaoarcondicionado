import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, BellRing, BellOff, Smartphone, Monitor, Clock, AlertTriangle, Gift, DollarSign, Wrench, Calendar } from 'lucide-react';
import { toast } from 'sonner';

const NotificationSettings: React.FC = () => {
  const [permissionStatus, setPermissionStatus] = useState<string>('default');
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Bell className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Notificações</h2>
          <p className="text-sm text-muted-foreground">Gerencie alertas e avisos do sistema</p>
        </div>
      </div>

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

      {/* Notification Types */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="w-4 h-4" />
            Tipos de Notificação
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SettingRow 
            icon={Calendar} 
            label="Agendamentos" 
            description="Alertas de serviços agendados e atrasados" 
            settingKey="appointments" 
            color="bg-blue-500/10 text-blue-500" 
          />
          <SettingRow 
            icon={DollarSign} 
            label="Parcelas e Cobranças" 
            description="Alertas de parcelas vencidas e a vencer" 
            settingKey="installments" 
            color="bg-red-500/10 text-red-500" 
          />
          <SettingRow 
            icon={Wrench} 
            label="Manutenções" 
            description="Lembretes de manutenções preventivas" 
            settingKey="maintenance" 
            color="bg-amber-500/10 text-amber-500" 
          />
          <SettingRow 
            icon={Gift} 
            label="Aniversários" 
            description="Aviso de aniversários de clientes" 
            settingKey="birthdays" 
            color="bg-pink-500/10 text-pink-500" 
          />
          <SettingRow 
            icon={AlertTriangle} 
            label="Estoque Baixo" 
            description="Alertas quando produtos estiverem acabando" 
            settingKey="stock" 
            color="bg-orange-500/10 text-orange-500" 
          />
          <SettingRow 
            icon={Clock} 
            label="Dicas do Sistema" 
            description="Sugestões e dicas rotativas na tela" 
            settingKey="tips" 
            color="bg-purple-500/10 text-purple-500" 
          />
        </CardContent>
      </Card>

      {/* Banner Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BellRing className="w-4 h-4" />
            Notificações na Tela
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Banner Rotativo Central</p>
                <p className="text-xs text-muted-foreground">Mostra alertas e dicas no rodapé da tela</p>
              </div>
            </div>
            <Switch
              checked={settings.rotatingBanner}
              onCheckedChange={(checked) => saveSettings({ ...settings, rotatingBanner: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationSettings;
