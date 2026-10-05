
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import SidebarEditor from './SidebarEditor';
import IntegrationsSettings from './IntegrationsSettings';
import NotificationSettings from './NotificationSettings';
import CalendarNotificationConfig from './CalendarNotificationConfig';
import ImprovedDashboardCustomizer from './ImprovedDashboardCustomizer';
import EmployeeManagement from './EmployeeManagement';
import MeetingAudioSettings from './MeetingAudioSettings';
import { LandingPageAssetManager } from './LandingPageAssetManager';
import { Settings as SettingsIcon, Palette, Link, Bell, Users, LayoutDashboard, Music, Globe } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('employees');

  return (
    <div className="p-6 page-content bg-white min-h-screen">
      <div className="flex items-center space-x-2 mb-6">
        <SettingsIcon className="h-6 w-6 text-gray-900" />
        <h1 className="text-2xl font-bold">Configurações</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="landing" className="flex items-center space-x-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Landing Page</span>
          </TabsTrigger>
          <TabsTrigger value="employees" className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Funcionários</span>
          </TabsTrigger>
          <TabsTrigger value="audio" className="flex items-center space-x-2">
            <Music className="h-4 w-4" />
            <span className="hidden sm:inline">Áudios</span>
          </TabsTrigger>
          <TabsTrigger value="customize" className="flex items-center space-x-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Personalizar</span>
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center space-x-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Aparência</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center space-x-2">
            <Link className="h-4 w-4" />
            <span className="hidden sm:inline">Integrações</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center space-x-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notificações</span>
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center space-x-2">
            <SettingsIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Geral</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="landing">
          <Card>
            <CardHeader>
              <CardTitle>Mídias da Landing Page</CardTitle>
              <CardDescription>Gerencie os vídeos e imagens que aparecem na sua página inicial.</CardDescription>
            </CardHeader>
            <CardContent>
              <LandingPageAssetManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees">
          <EmployeeManagement />
        </TabsContent>

        <TabsContent value="audio">
          <MeetingAudioSettings />
        </TabsContent>

        <TabsContent value="customize">
          <ImprovedDashboardCustomizer />
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Palette className="h-5 w-5" />
                <span>Personalização da Aparência</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SidebarEditor />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <IntegrationsSettings />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <NotificationSettings />
          <CalendarNotificationConfig />
        </TabsContent>

        <TabsContent value="general" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Informações da Conta */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <SettingsIcon className="h-5 w-5" />
                  <span>Informações da Conta</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Email não pode ser alterado aqui
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="nome">Nome de Display</Label>
                  <Input
                    id="nome"
                    type="text"
                    placeholder="Seu Nome"
                  />
                </div>
                
                <Button className="w-full">
                  Salvar Alterações
                </Button>
              </CardContent>
            </Card>

            {/* Configurações de Segurança */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <SettingsIcon className="h-5 w-5" />
                  <span>Segurança</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  Alterar Senha
                </Button>
                
                <Button variant="outline" className="w-full justify-start">
                  Configurar 2FA
                </Button>
                
                <Button variant="outline" className="w-full justify-start">
                  Sessões Ativas
                </Button>
              </CardContent>
            </Card>

            {/* Preferências do Sistema */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <SettingsIcon className="h-5 w-5" />
                  <span>Preferências</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Tema Escuro</Label>
                    <p className="text-sm text-gray-500">Ativar modo escuro</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Toggle
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Idioma</Label>
                    <p className="text-sm text-gray-500">Português (BR)</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Alterar
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Fuso Horário</Label>
                    <p className="text-sm text-gray-500">GMT-3 (Brasília)</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Alterar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Dados e Backup */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <SettingsIcon className="h-5 w-5" />
                  <span>Dados e Backup</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full justify-start">
                  Exportar Dados
                </Button>
                
                <Button variant="outline" className="w-full justify-start">
                  Importar Dados
                </Button>
                
                <div className="border-t pt-4">
                  <Button variant="destructive" className="w-full">
                    Excluir Conta
                  </Button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Esta ação não pode ser desfeita
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
