import React, { useState, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Download, Trash2, Filter, ChevronRight, MessageSquare, User, Phone, CheckCircle2, Clock, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const OMNI_COLOR = '#374DA4';

interface ExtractedData {
  id: string;
  agent_id: string;
  contact_phone: string;
  extracted_data: Record<string, any>;
  created_at: string;
  last_updated_at: string;
  ai_agents: { name: string };
}

interface AgentConversionsProps {
  /** Empresa do usuário logado. Os dados extraídos são isolados por empresa. */
  companyId?: string | null;
}

const AgentConversions: React.FC<AgentConversionsProps> = ({ companyId }) => {
  const [data, setData] = useState<ExtractedData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<ExtractedData | null>(null);

  const loadData = useCallback(async () => {
    if (!companyId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Filtra pelos agentes da empresa do usuário: sem isso, a lista mostrava
    // conversões de todas as contas. O `!inner` garante o filtro no banco.
    const { data: results, error } = await supabase
      .from('ai_agent_extracted_data')
      .select('*, ai_agents!inner(name)')
      .eq('ai_agents.company_id', companyId)
      .order('last_updated_at', { ascending: false });

    if (!error) setData((results as any) || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredData = data.filter(item => 
    item.contact_phone.includes(searchQuery) || 
    item.ai_agents?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    JSON.stringify(item.extracted_data).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allDiscoveryKeys = Array.from(new Set(
    data.flatMap(item => Object.keys(item.extracted_data))
  )).filter(key => key !== 'timestamp' && key !== 'id').sort();

  const deleteData = async (id: string) => {
    if (!confirm('Excluir este registro?')) return;
    // Só apaga registros que vieram da lista da empresa (a RLS também barra o resto).
    if (!data.some(item => item.id === id)) return;
    const { error } = await supabase.from('ai_agent_extracted_data').delete().eq('id', id);
    if (!error) {
      setData(prev => prev.filter(i => i.id !== id));
    }
  };

  const exportCSV = () => {
    if (filteredData.length === 0) return;
    const headers = ['Agente', 'Telefone', 'Data', ...allDiscoveryKeys];
    const rows = filteredData.map(item => [
      item.ai_agents?.name,
      item.contact_phone,
      format(new Date(item.last_updated_at), 'dd/MM/yyyy HH:mm'),
      ...allDiscoveryKeys.map(key => item.extracted_data[key] || '')
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `conversoes-agentes-${format(new Date(), 'dd-MM-yyyy')}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5" style={{ color: OMNI_COLOR }} />
            Conversões e Dados Extraídos
          </h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Respostas e informações capturadas pelos seus agentes de IA</p>
        </div>
        <Button variant="outline" onClick={exportCSV} className="rounded-xl gap-2 border-gray-200 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {allDiscoveryKeys.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 px-1">
          <span className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest self-center mr-2">Campos Identificados:</span>
          {allDiscoveryKeys.map(key => (
            <Badge key={key} variant="outline" className="bg-[#F0F2FE]/50 dark:bg-[#374DA4]/5 border-[#B3BFF0]/50 dark:border-[#374DA4]/10 text-[#253573] dark:text-[#5A74D1] text-[10px] font-bold py-0.5">
              {key}
            </Badge>
          ))}
        </div>
      )}

      <Card className="border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden rounded-2xl bg-white dark:bg-zinc-900/50">
        <CardHeader className="bg-gray-50/50 dark:bg-zinc-900/30 border-b border-gray-100 dark:border-zinc-800 p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-zinc-500" />
            <Input 
              placeholder="Buscar por telefone, agente ou conteúdo..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white dark:bg-zinc-900 rounded-xl border-gray-200 dark:border-zinc-800 dark:text-zinc-300"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ) : filteredData.length === 0 ? (
            <div className="p-20 text-center">
              <Filter className="h-12 w-12 text-gray-200 dark:text-zinc-800 mx-auto mb-4" />
              <p className="text-gray-500 font-medium">Nenhuma conversão encontrada</p>
              <p className="text-sm text-gray-400">Dados aparecerão aqui conforme os clientes responderem aos agentes.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50/50 dark:bg-zinc-900/40 hover:bg-gray-50/50 dark:hover:bg-zinc-900/40 border-b border-gray-100 dark:border-zinc-800">
                    <TableHead className="font-bold text-gray-500 dark:text-zinc-500 text-[11px] uppercase tracking-widest px-5 py-4">Contato</TableHead>
                    <TableHead className="font-bold text-gray-500 dark:text-zinc-500 text-[11px] uppercase tracking-widest px-4 py-4">Agente</TableHead>
                    <TableHead className="font-bold text-gray-500 dark:text-zinc-500 text-[11px] uppercase tracking-widest px-4 py-4">Campos Automáticos (Identificados)</TableHead>
                    <TableHead className="font-bold text-gray-500 dark:text-zinc-500 text-[11px] uppercase tracking-widest px-4 py-4">Atualização</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => (
                    <TableRow key={item.id} className="group border-b border-gray-50 dark:border-zinc-900/50 hover:bg-[#F0F2FE]/20 dark:hover:bg-[#374DA4]/5 transition-all duration-150 cursor-pointer" onClick={() => setSelectedItem(item)}>
                      <TableCell className="px-5 py-5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-2xl bg-[#DFE4FB] dark:bg-[#374DA4]/10 flex items-center justify-center border-2 border-white dark:border-zinc-800 shadow-sm">
                            <User className="h-4 w-4 text-[#253573]" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 dark:text-zinc-100">{item.contact_phone}</span>
                            <span className="text-[10px] text-gray-400 dark:text-zinc-500 uppercase font-black tracking-tight">WhatsApp</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-5">
                        <Badge variant="secondary" className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700 border-none rounded-lg font-bold text-[10px] px-2 py-0.5">
                          {item.ai_agents?.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-5">
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(item.extracted_data).map(([key, val]) => (
                            <div key={key} className="flex flex-col min-w-[80px] p-2 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl shadow-sm">
                              <span className="text-[8px] text-[#374DA4] font-black uppercase tracking-wider leading-none mb-1">{key}</span>
                              <span className="text-[11px] text-gray-800 dark:text-zinc-200 font-bold truncate max-w-[120px]">{String(val)}</span>
                            </div>
                          ))}
                          {Object.keys(item.extracted_data).length === 0 && (
                            <span className="text-xs text-gray-400 italic">Analisando conversa...</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-5">
                        <div className="flex items-center gap-1.5 text-gray-500 dark:text-zinc-500 text-xs font-medium">
                          <Clock className="h-3.5 w-3.5" />
                          {format(new Date(item.last_updated_at), 'dd/MM/yy HH:mm')}
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl" onClick={(e) => { e.stopPropagation(); deleteData(item.id); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <ChevronRight className="h-4 w-4 text-gray-300" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl dark:bg-zinc-950 dark:border-zinc-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 dark:text-zinc-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Dados do Cliente
            </DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-[#DFE4FB] dark:bg-[#374DA4]/10 flex items-center justify-center">
                    <Phone className="h-4 w-4 text-[#374DA4]" />
                  </div>
                  <span className="font-mono text-gray-700 dark:text-zinc-300 font-bold">{selectedItem.contact_phone}</span>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase dark:border-zinc-700 dark:text-zinc-400 font-black tracking-widest">{selectedItem.ai_agents?.name}</Badge>
              </div>
              
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-[0.2em] px-1">Informações Capturadas</h4>
                <ScrollArea className="max-h-[300px] pr-4">
                  <div className="grid gap-2.5">
                    {Object.entries(selectedItem.extracted_data).map(([key, val]) => (
                      <div key={key} className="flex flex-col p-3.5 bg-white dark:bg-zinc-900/50 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-sm">
                        <span className="text-[9px] text-[#374DA4] font-black uppercase tracking-widest mb-1">{key}</span>
                        <span className="text-sm text-gray-800 dark:text-zinc-200 font-semibold">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1 rounded-xl h-11 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 font-bold"
                  onClick={() => window.open(`https://wa.me/${selectedItem.contact_phone.replace(/\D/g, '')}`, '_blank')}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
                <Button 
                  className="flex-1 rounded-xl text-white h-11 font-bold shadow-lg shadow-[#253573]/10 hover:shadow-[#253573]/20 transition-all" 
                  style={{ backgroundColor: OMNI_COLOR }}
                  onClick={() => setSelectedItem(null)}
                >
                  Concluído
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentConversions;
