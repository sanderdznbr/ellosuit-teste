
import React from 'react';
import { User, Bell, Shield, Palette, HelpCircle, LogOut } from 'lucide-react';
import { vibrate } from '@/utils/mobile-helpers';

const MobileSettings = () => {
  const settingsGroups = [
    {
      title: 'Conta',
      items: [
        { icon: User, label: 'Perfil', description: 'Editar informações pessoais' },
        { icon: Bell, label: 'Notificações', description: 'Gerenciar alertas' },
        { icon: Shield, label: 'Privacidade', description: 'Configurações de segurança' }
      ]
    },
    {
      title: 'Aparência',
      items: [
        { icon: Palette, label: 'Tema', description: 'Cores e personalização' }
      ]
    },
    {
      title: 'Suporte',
      items: [
        { icon: HelpCircle, label: 'Ajuda', description: 'Central de ajuda' },
        { icon: LogOut, label: 'Sair', description: 'Desconectar da conta', danger: true }
      ]
    }
  ];

  const handleSettingClick = (setting: any) => {
    vibrate(30);
    console.log('Setting clicked:', setting);
  };

  return (
    <div className="ios-scroll" style={{ backgroundColor: 'var(--ios-bg-grouped)' }}>
      <div className="px-4 pb-6 space-y-6">
        {/* Profile Header */}
        <div className="ios-card p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-[#DFE4FB] flex items-center justify-center mx-auto mb-4">
            <User className="h-10 w-10 text-[#2F428D]" />
          </div>
          <h2 className="ios-title-2 mb-1">João Silva</h2>
          <p className="ios-subheadline">joao@empresa.com</p>
        </div>

        {/* Settings Groups */}
        {settingsGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="ios-card-section">
            <div className="ios-section-header">
              <h2 className="ios-title-3">{group.title}</h2>
            </div>
            <div className="space-y-1">
              {group.items.map((item, itemIndex) => (
                <div
                  key={itemIndex}
                  className="ios-list-item ios-fade-in cursor-pointer"
                  style={{ animationDelay: `${itemIndex * 0.1}s` }}
                  onClick={() => handleSettingClick(item)}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      item.danger ? 'bg-red-100' : 'bg-gray-100'
                    }`}>
                      <item.icon className={`h-5 w-5 ${
                        item.danger ? 'text-red-600' : 'text-gray-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <h3 className={`ios-headline ${item.danger ? 'text-red-600' : ''}`}>
                        {item.label}
                      </h3>
                      <p className="ios-subheadline">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* App Info */}
        <div className="text-center py-4">
          <p className="ios-caption text-gray-400">Versão 1.0.0</p>
        </div>
      </div>
    </div>
  );
};

export default MobileSettings;
