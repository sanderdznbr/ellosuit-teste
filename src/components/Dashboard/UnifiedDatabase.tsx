 import React, { useState, useMemo, useEffect } from 'react';
 import { Card, CardContent } from '@/components/ui/card';
 import { Switch } from '@/components/ui/switch';
 import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/hooks/useAuth';
 import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
 import { Database, Search, Plus, MoreHorizontal, Eye, UserCog, Trash2, Filter, Download, Upload, Tag, Users, Building2, Target, Briefcase, X, ChevronDown, Mail, Phone, Settings, Trash } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import ClientForm from './ClientForm';
import { cn } from '@/lib/utils';

// Tag configurations
const TAG_CONFIGS: Record<string, {
  label: string;
  color: string;
  icon: React.ElementType;
}> = {
  cliente: {
    label: 'Cliente',
    color: 'bg-[#374DA4]/10 text-[#374DA4] border-[#374DA4]/20',
    icon: Users
  },
  fornecedor: {
    label: 'Fornecedor',
    color: 'bg-[#374DA4]/15 text-[#374DA4] border-[#374DA4]/25',
    icon: Building2
  },
  prospecto: {
    label: 'Prospecto',
    color: 'bg-[#5B3BFF]/10 text-[#5B3BFF] border-[#5B3BFF]/20',
    icon: Target
  },
  colaborador: {
    label: 'Colaborador',
    color: 'bg-[#374DA4]/5 text-[#374DA4] border-[#374DA4]/15',
    icon: Briefcase
  }
};
const STATUS_CONFIGS: Record<string, {
  label: string;
  color: string;
}> = {
  active: {
    label: 'Ativo',
    color: 'bg-[#374DA4]/10 text-[#374DA4]'
  },
  inactive: {
    label: 'Inativo',
    color: 'bg-muted text-muted-foreground'
  },
  prospect: {
    label: 'Lead',
    color: 'bg-[#5B3BFF]/10 text-[#5B3BFF]'
  }
};
 const UnifiedDatabase: React.FC = () => {
   const { user } = useAuth();
   const [searchTerm, setSearchTerm] = useState('');
   const [kpiConfig, setKpiConfig] = useState<Record<string, boolean>>({
     total: false,
     cliente: false,
     fornecedor: false,
     prospecto: false,
   });
   const [customTypes, setCustomTypes] = useState<any[]>([]);
   const [newTypeLabel, setNewTypeLabel] = useState('');
   const [isAddingType, setIsAddingType] = useState(false);
   const [companyId, setCompanyId] = useState<string | null>(null);
 
   useEffect(() => {
     const fetchData = async () => {
       if (!user) return;
       
       // Fetch Company ID
       const { data: compData } = await supabase
         .from('company_users')
         .select('company_id')
         .eq('user_id', user.id)
         .single();
       if (compData) setCompanyId(compData.company_id);
 
       // Fetch KPI Config
       const { data: kpiData } = await supabase
         .from('user_dashboard_kpis')
         .select('kpi_key, is_visible')
         .eq('user_id', user.id)
         .eq('dashboard_key', 'unified_database');
       
       if (kpiData && kpiData.length > 0) {
         const newConfig = { ...kpiConfig };
         kpiData.forEach(item => {
           newConfig[item.kpi_key] = item.is_visible;
         });
         setKpiConfig(newConfig);
       }
 
       // Fetch Custom Types
       if (compData) {
         const { data: typeData } = await supabase
           .from('client_custom_types')
           .select('*')
           .eq('company_id', compData.company_id);
         if (typeData) setCustomTypes(typeData);
       }
     };
     fetchData();
   }, [user]);
 
   const handleAddCustomType = async () => {
     if (!newTypeLabel.trim() || !companyId) return;
     const value = newTypeLabel.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
     
     const { data, error } = await supabase
       .from('client_custom_types')
       .insert({
         company_id: companyId,
         label: newTypeLabel,
         value,
       })
       .select()
       .single();
 
     if (error) {
       toast.error("Erro ao criar tipo de contato");
     } else {
       setCustomTypes(prev => [...prev, data]);
       setNewTypeLabel('');
       setIsAddingType(false);
       toast.success("Tipo de contato criado!");
     }
   };
 
   const mergedTags = useMemo(() => {
     const base = { ...TAG_CONFIGS };
     customTypes.forEach(t => {
       base[t.value] = {
         label: t.label,
         color: t.color,
         icon: Users, // Default icon
       };
     });
     return base;
   }, [customTypes]);
 
   const toggleKpiVisibility = async (key: string) => {
     const newValue = !kpiConfig[key];
     setKpiConfig(prev => ({ ...prev, [key]: newValue }));
     
     if (!user) return;
     const { error } = await supabase
       .from('user_dashboard_kpis')
       .upsert({
         user_id: user.id,
         dashboard_key: 'unified_database',
         kpi_key: key,
         is_visible: newValue
       }, { onConflict: 'user_id, dashboard_key, kpi_key' });
     
     if (error) {
       toast.error("Erro ao salvar configuração de KPI");
       setKpiConfig(prev => ({ ...prev, [key]: !newValue }));
     }
   };
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  // Load all clients
  const {
    clients,
    loading,
    createClient,
    updateClient,
    deleteClient
  } = useClients('all');

  // Filter logic
  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = client.name.toLowerCase().includes(searchLower) || (client.company_name || '').toLowerCase().includes(searchLower) || (client.email || '').toLowerCase().includes(searchLower) || (client.phone || '').toLowerCase().includes(searchLower);

      // Tag filter
      const clientType = client.client_type || 'cliente';
      const matchesTag = selectedTags.length === 0 || selectedTags.includes(clientType);

      // Status filter
      const matchesStatus = selectedStatus.length === 0 || selectedStatus.includes(client.status);
      return matchesSearch && matchesTag && matchesStatus;
    });
  }, [clients, searchTerm, selectedTags, selectedStatus]);

   // Stats
   const stats = useMemo(() => {
     const s: Record<string, number> = {
       total: clients.length,
     };
     Object.keys(mergedTags).forEach(tag => {
       s[tag] = clients.filter(c => (c.client_type || 'cliente') === tag).length;
     });
     return s;
   }, [clients, mergedTags]);
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };
  const toggleStatus = (status: string) => {
    setSelectedStatus(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
  };
  const toggleRowSelection = (id: string) => {
    setSelectedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };
  const toggleAllRows = () => {
    if (selectedRows.length === filteredClients.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(filteredClients.map(c => c.id));
    }
  };
  const handleAddClient = () => {
    setEditingClient(null);
    setShowClientForm(true);
  };
  const handleEditClient = (client: any) => {
    setEditingClient(client);
    setShowClientForm(true);
  };
  const handleSaveClient = async (clientData: any) => {
    if (editingClient) {
      await updateClient(editingClient.id, clientData);
    } else {
      await createClient(clientData);
    }
  };
  const handleDeleteClient = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este contato?')) {
      await deleteClient(id);
    }
  };
  const handleBulkDelete = async () => {
    if (confirm(`Deseja excluir ${selectedRows.length} contatos selecionados?`)) {
      for (const id of selectedRows) {
        await deleteClient(id);
      }
      setSelectedRows([]);
    }
  };
  const clearFilters = () => {
    setSelectedTags([]);
    setSelectedStatus([]);
    setSearchTerm('');
  };
  if (loading) {
    return <div className="min-h-full bg-[#faf9f7] p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#374DA4]" />
      </div>;
  }
  return <div className="min-h-full bg-[#faf9f7] p-4 sm:p-6 pb-[13rem] md:pb-32 lg:pb-6 overscroll-contain">
      <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#374DA4]">Cadastros</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {filteredClients.length} de {clients.length} contatos
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" className="gap-2 rounded-full bg-white hover:bg-gray-50 text-gray-600 border border-gray-100">
            <Upload className="h-4 w-4" />
            Importar
          </Button>
          <Button variant="ghost" className="gap-2 rounded-full bg-white hover:bg-gray-50 text-gray-600 border border-gray-100">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
           <Popover>
             <PopoverTrigger asChild>
               <Button variant="ghost" size="icon" title="Configurar KPIs" className="rounded-full bg-white hover:bg-gray-50 text-gray-600 border border-gray-100">
                 <Settings className="h-4 w-4" />
               </Button>
             </PopoverTrigger>
             <PopoverContent className="w-56 p-4">
               <div className="space-y-4">
                 <h4 className="font-medium leading-none mb-2">Visibilidade dos KPIs</h4>
                  <ScrollArea className="h-[300px] pr-4">
                    <div className="space-y-4">
                      <div>
                        <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">KPIs Base</h5>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Total Geral</span>
                            <Switch checked={kpiConfig.total} onCheckedChange={() => toggleKpiVisibility('total')} />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Clientes</span>
                            <Switch checked={kpiConfig.cliente} onCheckedChange={() => toggleKpiVisibility('cliente')} />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Fornecedores</span>
                            <Switch checked={kpiConfig.fornecedor} onCheckedChange={() => toggleKpiVisibility('fornecedor')} />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Prospectos</span>
                            <Switch checked={kpiConfig.prospecto} onCheckedChange={() => toggleKpiVisibility('prospecto')} />
                          </div>
                        </div>
                      </div>
 
                      <div>
                        <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Tipos Personalizados</h5>
                        <div className="space-y-3">
                          {customTypes.map(type => (
                            <div key={type.id} className="flex items-center justify-between">
                              <span className="text-sm truncate mr-2">{type.label}</span>
                              <Switch 
                                checked={kpiConfig[type.value] || false} 
                                onCheckedChange={() => toggleKpiVisibility(type.value)} 
                              />
                            </div>
                          ))}
                        </div>
                      </div>
 
                      <div className="pt-2 border-t">
                        {isAddingType ? (
                          <div className="space-y-2">
                            <Input 
                              placeholder="Nome do tipo..." 
                              value={newTypeLabel} 
                              onChange={e => setNewTypeLabel(e.target.value)}
                              className="h-8 text-xs"
                              autoFocus
                              onKeyDown={e => e.key === 'Enter' && handleAddCustomType()}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" className="h-7 text-[10px] flex-1" onClick={handleAddCustomType}>Salvar</Button>
                              <Button size="sm" variant="ghost" className="h-7 text-[10px] flex-1" onClick={() => setIsAddingType(false)}>Cancelar</Button>
                            </div>
                          </div>
                        ) : (
                          <Button 
                            variant="ghost" 
                            className="w-full justify-start h-8 text-xs text-[#2F428D] hover:text-[#253573] hover:bg-[#F0F2FE]"
                            onClick={() => setIsAddingType(true)}
                          >
                            <Plus className="h-3 w-3 mr-2" /> Novo Tipo
                          </Button>
                        )}
                      </div>
                    </div>
                  </ScrollArea>
               </div>
             </PopoverContent>
           </Popover>
            <Button onClick={handleAddClient} className="gap-2 rounded-full bg-[#374DA4] hover:bg-[#2b3d85] text-white">
             <Plus className="h-4 w-4" />
             Novo Contato
           </Button>
        </div>
      </div>

       {/* Stats Cards */}
       {Object.values(kpiConfig).some(v => v) && (
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           {kpiConfig.total && (
             <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => clearFilters()}>
               <CardContent className="p-4">
                 <div className="flex items-center justify-between">
                   <div>
                     <p className="text-xs text-muted-foreground uppercase tracking-wide">Total</p>
                     <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                   </div>
                   <div className="p-2 rounded-xl bg-muted">
                     <Database className="h-5 w-5 text-muted-foreground" />
                   </div>
                 </div>
               </CardContent>
             </Card>
           )}
            {Object.entries(mergedTags)
              .filter(([key]) => key !== 'colaborador' && kpiConfig[key])
              .map(([key, config]) => {
               const count = stats[key as keyof typeof stats] || 0;
               const Icon = config.icon;
               const isSelected = selectedTags.includes(key);
               return (
                 <Card 
                   key={key} 
                   className={cn("border-border/60 shadow-sm hover:shadow-md transition-all cursor-pointer", isSelected && "ring-2 ring-[#374DA4]")} 
                   onClick={() => toggleTag(key)}
                 >
                   <CardContent className="p-4">
                     <div className="flex items-center justify-between">
                       <div>
                         <p className="text-xs text-muted-foreground uppercase tracking-wide">{config.label}s</p>
                         <p className="text-2xl font-bold text-foreground">{count}</p>
                       </div>
                       <div className={cn("p-2 rounded-xl", config.color.split(' ')[0])}>
                         <Icon className={cn("h-5 w-5", config.color.split(' ')[1])} />
                       </div>
                     </div>
                   </CardContent>
                 </Card>
               );
           })}
         </div>
       )}

      {/* Filters & Search */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, empresa, email ou telefone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 bg-muted/50 border-border" />
            </div>

            {/* Tag Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Tag className="h-4 w-4" />
                Tipo:
              </span>
               {Object.entries(mergedTags).map(([key, config]) => <Badge key={key} variant="outline" className={cn("cursor-pointer transition-all", selectedTags.includes(key) ? config.color : "bg-muted/50 text-muted-foreground border-border hover:bg-muted")} onClick={() => toggleTag(key)}>
                  {config.label}
                  {selectedTags.includes(key) && <X className="h-3 w-3 ml-1" />}
                </Badge>)}
            </div>

            {/* Status Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Filter className="h-4 w-4" />
                Status:
              </span>
              {Object.entries(STATUS_CONFIGS).map(([key, config]) => <Badge key={key} variant="outline" className={cn("cursor-pointer transition-all", selectedStatus.includes(key) ? config.color : "bg-muted/50 text-muted-foreground border-border hover:bg-muted")} onClick={() => toggleStatus(key)}>
                  {config.label}
                  {selectedStatus.includes(key) && <X className="h-3 w-3 ml-1" />}
                </Badge>)}
            </div>

            {/* Clear Filters */}
            {(selectedTags.length > 0 || selectedStatus.length > 0 || searchTerm) && <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>}
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedRows.length > 0 && <Card className="border-0 shadow-sm bg-[#F0F2FE]">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[#253573]">
                {selectedRows.length} contato(s) selecionado(s)
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={handleBulkDelete}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedRows([])}>
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>}

      {/* Data Table */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 border-border/40">
                <TableHead className="w-12">
                  <Checkbox checked={selectedRows.length === filteredClients.length && filteredClients.length > 0} onCheckedChange={toggleAllRows} />
                </TableHead>
                <TableHead className="font-semibold text-muted-foreground">Nome</TableHead>
                <TableHead className="font-semibold text-muted-foreground">Tipo</TableHead>
                <TableHead className="font-semibold text-muted-foreground">Contato</TableHead>
                <TableHead className="font-semibold text-muted-foreground">Status</TableHead>
                <TableHead className="font-semibold text-muted-foreground">Tags</TableHead>
                <TableHead className="font-semibold text-muted-foreground">Criado em</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.length === 0 ? <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Database className="h-8 w-8 text-muted-foreground/30" />
                      <p className="text-muted-foreground">Nenhum contato encontrado</p>
                      <Button variant="outline" size="sm" onClick={handleAddClient}>
                       <Plus className="h-4 w-4 mr-1" />
                       Adicionar Contato
                     </Button>
                   </div>
                 </TableCell>
               </TableRow> : filteredClients.map(client => {
             const clientType = client.client_type || 'cliente';
             const tagConfig = mergedTags[clientType] || mergedTags.cliente;
             const statusConfig = STATUS_CONFIGS[client.status] || STATUS_CONFIGS.active;
             return <TableRow key={client.id} className={cn("hover:bg-muted/30 transition-colors", selectedRows.includes(client.id) && "bg-primary/5")}>
                      <TableCell>
                        <Checkbox checked={selectedRows.includes(client.id)} onCheckedChange={() => toggleRowSelection(client.id)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={client.avatar_url} />
                            <AvatarFallback className={cn("text-xs font-medium", tagConfig.color.split(' ')[0], tagConfig.color.split(' ')[1])}>
                              {client.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{client.name}</p>
                            {client.company_name && <p className="text-xs text-muted-foreground">{client.company_name}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal bg-primary text-primary-foreground border-primary">
                          {tagConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {client.email && <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {client.email}
                            </div>}
                          {client.phone && <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {client.phone}
                            </div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn("font-normal", statusConfig.color)}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {client.tags?.slice(0, 2).map((tag: string, idx: number) => <Badge key={idx} variant="outline" className="text-[10px] py-0 h-5">
                              {tag}
                            </Badge>)}
                          {client.tags && client.tags.length > 2 && <Badge variant="outline" className="text-[10px] py-0 h-5">
                              +{client.tags.length - 2}
                            </Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(client.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditClient(client)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditClient(client)}>
                              <UserCog className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDeleteClient(client.id)} className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>;
            })}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Card>

      {/* Client Form Modal */}
      <ClientForm client={editingClient} open={showClientForm} onOpenChange={setShowClientForm} onSave={handleSaveClient} />
      </div>
    </div>;
};
export default UnifiedDatabase;