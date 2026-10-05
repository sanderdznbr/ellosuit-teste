
import React, { useState } from 'react';
import { Menu, Bell, Search, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import MobileButton from '@/components/ui/mobile-button';
import logoEllo from '@/assets/logoellosuit.png';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

interface MobileHeaderProps {
  title: string;
  showSearch?: boolean;
  showNotifications?: boolean;
  showAddButton?: boolean;
  onAddClick?: () => void;
  onMenuClick?: () => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  showSearch = false,
  showNotifications = true,
  showAddButton = false,
  onAddClick,
  onMenuClick
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <>
      {/* Header Principal */}
      <div className="fixed top-0 left-0 right-0 z-50 mobile-header-blur mobile-safe-top md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Lado Esquerdo - Menu */}
          <Drawer>
            <DrawerTrigger asChild>
              <MobileButton variant="ghost" size="sm" className="h-10 w-10 p-0">
                <Menu className="h-5 w-5" />
              </MobileButton>
            </DrawerTrigger>
            <DrawerContent className="h-[80vh]">
              <DrawerHeader>
                <DrawerTitle>Menu</DrawerTitle>
                <DrawerDescription>
                  Navegue pelas funcionalidades do app
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-8">
                <MobileMenuContent />
              </div>
            </DrawerContent>
          </Drawer>

          {/* Centro - Logo */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <img src={logoEllo} alt="ElloSuit" className="h-8 w-auto" />
          </div>

          {/* Lado Direito */}
          <div className="flex items-center space-x-2">
            {showSearch && (
              <MobileButton
                variant="ghost"
                size="sm"
                className="h-10 w-10 p-0"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
              >
                {isSearchOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
              </MobileButton>
            )}
            
            {showNotifications && (
              <MobileButton variant="ghost" size="sm" className="h-10 w-10 p-0 relative">
                <Bell className="h-5 w-5" />
                <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs bg-red-500 border-0">
                  3
                </Badge>
              </MobileButton>
            )}
            
            {showAddButton && (
              <MobileButton 
                variant="primary"
                size="sm" 
                className="h-10 w-10 p-0 rounded-full"
                onClick={onAddClick}
              >
                <Plus className="h-5 w-5" />
              </MobileButton>
            )}
          </div>
        </div>

        {/* Barra de Pesquisa */}
        {isSearchOpen && (
          <div className="px-4 pb-3 animate-in slide-in-from-top-2 duration-200">
            <Input
              placeholder="Buscar..."
              className="mobile-input"
              autoFocus
            />
          </div>
        )}
      </div>

      {/* Spacer para o header fixo */}
      <div className="h-20 md:hidden" />
    </>
  );
};

const MobileMenuContent = () => {
  const menuItems = [
    { icon: '📧', title: 'Rastreamento', description: 'Rastreamento de emails' },
    { icon: '📊', title: 'Campanhas', description: 'Gerenciar campanhas de email' },
    { icon: '⚡', title: 'Produtividade', description: 'Métricas e produtividade' },
    { icon: '📅', title: 'Calendário', description: 'Agenda e eventos' },
    { icon: '🤝', title: 'Reuniões', description: 'Gerenciar reuniões' },
    { icon: '📄', title: 'Documentos', description: 'Arquivos e documentos' },
    { icon: '👥', title: 'Clientes', description: 'Base de clientes' },
    { icon: '📈', title: 'Análises', description: 'Relatórios e métricas' },
  ];

  return (
    <div className="space-y-1">
      {menuItems.map((item, index) => (
        <div
          key={index}
          className="mobile-list-item flex items-center space-x-4 rounded-xl cursor-pointer mobile-touch-feedback"
        >
          <div className="text-2xl">{item.icon}</div>
          <div className="flex-1">
            <h3 className="font-medium text-gray-900">{item.title}</h3>
            <p className="text-sm text-gray-500">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MobileHeader;
