import React, { useState } from 'react';
import { Users, Building2, UserPlus, Briefcase, FolderOpen, Code2, Sparkles } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import ClientsManager from './ClientsManager';
import EmployeeManagement from './EmployeeManagement';
import ContactGroupsManager from './ContactGroupsManager';
import FormIntegration from './FormIntegration';

type TabValue = 'clientes' | 'fornecedores' | 'prospectos' | 'colaboradores' | 'grupos' | 'formularios';

interface TabConfig {
  value: TabValue;
  label: string;
  icon: React.ElementType;
  contactType?: 'cliente' | 'fornecedor' | 'prospecto';
}

const tabs: TabConfig[] = [
  { value: 'clientes', label: 'Clientes', icon: Users, contactType: 'cliente' },
  { value: 'fornecedores', label: 'Fornecedores', icon: Building2, contactType: 'fornecedor' },
  { value: 'prospectos', label: 'Prospectos', icon: UserPlus, contactType: 'prospecto' },
  { value: 'colaboradores', label: 'Colaboradores', icon: Briefcase },
  { value: 'grupos', label: 'Grupos', icon: FolderOpen },
  { value: 'formularios', label: 'Captação', icon: Code2 },
];

const UnifiedCadastros: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabValue>('clientes');

  return (
    <div className="min-h-full bg-[#faf9f7] p-4 sm:p-6 pb-[13rem] md:pb-32 lg:pb-6 overscroll-contain">
      <div className="max-w-7xl mx-auto space-y-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="w-full space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#374DA4]">Cadastros</h1>
              <p className="text-xs text-gray-400 mt-0.5">Gerencie todos os seus cadastros em um só lugar</p>
            </div>
          </div>

          {/* Pill tabs */}
          <div className="mt-4 inline-flex max-w-full overflow-x-auto rounded-full border border-gray-100 bg-white p-1.5">
              <TabsList className="bg-transparent p-0 h-auto gap-1 flex-nowrap">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.value;
                  return (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className={cn(
                        "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all whitespace-nowrap",
                        "data-[state=active]:bg-[#374DA4] data-[state=active]:text-white data-[state=active]:shadow-sm",
                        "data-[state=inactive]:text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className={cn("hidden sm:inline", isActive && "inline")}>{tab.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
          </div>
        </div>

        {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="mt-6">
            {tab.value === 'colaboradores' ? (
              <EmployeeManagement />
            ) : tab.value === 'grupos' ? (
              <ContactGroupsManager />
            ) : tab.value === 'formularios' ? (
              <FormIntegration />
            ) : (
              <ClientsManager contactType={tab.contactType!} />
            )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
};

export default UnifiedCadastros;
