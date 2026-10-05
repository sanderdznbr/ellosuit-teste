
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CampaignCreator from './CampaignCreator';
import CampaignList from './CampaignList';
import ContactManager from './ContactManager';
import EmailTemplates from './EmailTemplates';
import EmailProviders from './EmailProviders';
import { Plus, List, Users, FileText, Settings } from 'lucide-react';

const CampaignMail = () => {
  const [activeTab, setActiveTab] = useState('campaigns');

  return (
    <div className="bg-white dark:bg-black/20 min-h-[600px] animate-in fade-in duration-500 rounded-3xl overflow-hidden">
      <div className="p-8 border-b border-border/40">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Campanhas de Email</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Crie e gerencie fluxos de automação e envios em massa.
        </p>
      </div>

      <div className="p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-8">
          <TabsList className="inline-flex h-11 items-center justify-center rounded-2xl bg-gray-100 dark:bg-white/5 p-1 text-muted-foreground w-full sm:w-auto">
            <TabsTrigger 
              value="campaigns" 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-2"
            >
              <List className="h-4 w-4" />
              Listagem
            </TabsTrigger>
            <TabsTrigger 
              value="create" 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-2"
            >
              <Plus className="h-4 w-4" />
              Nova
            </TabsTrigger>
            <TabsTrigger 
              value="contacts" 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-2"
            >
              <Users className="h-4 w-4" />
              Contatos
            </TabsTrigger>
            <TabsTrigger 
              value="templates" 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-2"
            >
              <FileText className="h-4 w-4" />
              Modelos
            </TabsTrigger>
            <TabsTrigger 
              value="providers" 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-2"
            >
              <Settings className="h-4 w-4" />
              Contas
            </TabsTrigger>
          </TabsList>

          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <TabsContent value="campaigns" className="mt-0 outline-none">
              <CampaignList />
            </TabsContent>

            <TabsContent value="create" className="mt-0 outline-none">
              <CampaignCreator />
            </TabsContent>

            <TabsContent value="contacts" className="mt-0 outline-none">
              <ContactManager />
            </TabsContent>

            <TabsContent value="templates" className="mt-0 outline-none">
              <EmailTemplates />
            </TabsContent>

            <TabsContent value="providers" className="mt-0 outline-none">
              <EmailProviders />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default CampaignMail;
