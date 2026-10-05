import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, User, MessageSquare, UserPlus, RefreshCw, Download, Upload,
  Trash2, MoreHorizontal, CheckCircle2, Users, Loader2, ArrowDownToLine, ArrowUpFromLine
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const OMNI_COLOR = '#374DA4';

interface WhatsAppContact {
  id: string;
  wa_id: string;
  phone_number: string;
  push_name?: string;
  profile_picture?: string;
  is_business?: boolean;
  business_name?: string;
  session_id: string;
  created_at: string;
}

interface WhatsAppContactsProps {
  companyId: string;
  sessionId?: string;
  onStartConversation?: (contact: WhatsAppContact) => void;
  onSaveAsLead?: (contact: WhatsAppContact) => void;
  fullPage?: boolean;
}

const AVATAR_COLORS = ['#F59E0B', '#EF4444', '#10B981', '#374DA4', '#8B5CF6', '#EC4899'];
const getAvatarColor = (name?: string) => {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
};

const formatPhoneNumber = (phone: string) => {
  if (phone.length === 13 && phone.startsWith('55')) {
    return `+${phone.slice(0, 2)} ${phone.slice(2, 4)} ${phone.slice(4, 9)}-${phone.slice(9)}`;
  }
  return `+${phone}`;
};

const csvEscape = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const WhatsAppContacts: React.FC<WhatsAppContactsProps> = ({
  companyId,
  sessionId,
  onStartConversation,
  onSaveAsLead,
  fullPage = false,
}) => {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalContacts, setTotalContacts] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Pull-from-Cadastros dialog
  const [pullOpen, setPullOpen] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsSelected, setClientsSelected] = useState<Set<string>>(new Set());
  const [clientsQuery, setClientsQuery] = useState('');

  const loadContacts = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { count } = await supabase
        .from('whatsapp_contacts')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);
      setTotalContacts(count || 0);
      const { data, error } = await supabase
        .from('whatsapp_contacts')
        .select('*')
        .eq('company_id', companyId)
        .order('push_name', { ascending: true })
        .limit(500);
      if (error) throw error;
      setContacts(data || []);
    } catch (e) {
      console.error('Error loading contacts:', e);
      toast({ title: 'Erro', description: 'Erro ao carregar contatos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadContacts(); }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel('whatsapp-contacts-changes')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'whatsapp_contacts',
        filter: `company_id=eq.${companyId}`,
      }, () => { loadContacts(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId]);

  const filteredContacts = useMemo(() => contacts.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.push_name?.toLowerCase().includes(q) ||
      c.phone_number.includes(q) ||
      c.business_name?.toLowerCase().includes(q)
    );
  }), [contacts, searchQuery]);

  const allSelected = filteredContacts.length > 0 && filteredContacts.every(c => selected.has(c.id));
  const toggleAll = () => {
    setSelected(prev => {
      if (filteredContacts.every(c => prev.has(c.id))) {
        const next = new Set(prev);
        filteredContacts.forEach(c => next.delete(c.id));
        return next;
      }
      const next = new Set(prev);
      filteredContacts.forEach(c => next.add(c.id));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  // ============ Export ============
  const exportCsv = (onlySelected: boolean) => {
    const rows = onlySelected
      ? contacts.filter(c => selected.has(c.id))
      : filteredContacts;
    if (rows.length === 0) {
      toast({ title: 'Nada para exportar', description: 'Nenhum contato selecionado.' });
      return;
    }
    const header = ['nome', 'telefone', 'nome_comercial', 'is_business', 'criado_em'];
    const body = rows.map(c => [
      c.push_name || '',
      c.phone_number,
      c.business_name || '',
      c.is_business ? 'sim' : 'nao',
      c.created_at,
    ].map(csvEscape).join(','));
    const csv = [header.join(','), ...body].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contatos-whatsapp-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast({ title: 'Exportado', description: `${rows.length} contato(s) exportado(s).` });
  };

  // ============ Import CSV ============
  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !companyId) return;
    setBusy(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) throw new Error('CSV vazio ou sem cabeçalho');
      const parseLine = (line: string) => {
        const out: string[] = [];
        let cur = ''; let q = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (q) {
            if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (ch === '"') { q = false; }
            else cur += ch;
          } else {
            if (ch === '"') q = true;
            else if (ch === ',' || ch === ';') { out.push(cur); cur = ''; }
            else cur += ch;
          }
        }
        out.push(cur);
        return out;
      };
      const headers = parseLine(lines[0]).map(h => h.trim().toLowerCase());
      const phoneIdx = headers.findIndex(h => ['telefone', 'phone', 'phone_number', 'celular', 'whatsapp'].includes(h));
      const nameIdx = headers.findIndex(h => ['nome', 'name', 'push_name', 'contato'].includes(h));
      const bizIdx = headers.findIndex(h => ['nome_comercial', 'business_name', 'empresa'].includes(h));
      if (phoneIdx === -1) throw new Error('Coluna de telefone não encontrada. Use "telefone" ou "phone".');

      const rows = lines.slice(1).map(parseLine);
      const payload = rows.map(cols => {
        const rawPhone = (cols[phoneIdx] || '').replace(/\D/g, '');
        if (!rawPhone) return null;
        const phone = rawPhone.length === 11 ? '55' + rawPhone : rawPhone;
        return {
          company_id: companyId,
          session_id: sessionId || null,
          wa_id: phone + '@s.whatsapp.net',
          phone_number: phone,
          push_name: nameIdx >= 0 ? (cols[nameIdx] || '').trim() || null : null,
          business_name: bizIdx >= 0 ? (cols[bizIdx] || '').trim() || null : null,
          is_business: bizIdx >= 0 && !!(cols[bizIdx] || '').trim(),
        };
      }).filter(Boolean) as any[];

      if (payload.length === 0) throw new Error('Nenhum contato válido no CSV');

      const { error } = await supabase.from('whatsapp_contacts').upsert(payload, { onConflict: 'company_id,wa_id' } as any);
      if (error) throw error;
      toast({ title: 'Importado', description: `${payload.length} contato(s) importado(s).` });
      loadContacts();
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erro na importação', description: err?.message || 'Falha ao importar CSV', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  // ============ Bulk save as leads (into clients) ============
  const saveSelectedAsLeads = async () => {
    if (!companyId) return;
    const chosen = contacts.filter(c => selected.has(c.id));
    if (chosen.length === 0) return;
    setBusy(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Usuário não autenticado');
      const payload = chosen.map(c => ({
        company_id: companyId,
        created_by: uid,
        name: c.push_name || c.business_name || formatPhoneNumber(c.phone_number),
        phone: c.phone_number,
        whatsapp: c.phone_number,
        status: 'lead',
        client_type: c.is_business ? 'business' : 'personal',
        avatar_url: c.profile_picture || null,
        company_name: c.business_name || null,
      }));
      const { error } = await supabase.from('clients').insert(payload);
      if (error) throw error;
      toast({ title: 'Salvos em Cadastros', description: `${chosen.length} contato(s) enviados como Leads.` });
      clearSelection();
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erro', description: err?.message || 'Falha ao salvar como leads', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  // ============ Bulk delete ============
  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} contato(s)?`)) return;
    setBusy(true);
    try {
      const ids = Array.from(selected);
      const { error } = await supabase.from('whatsapp_contacts').delete().in('id', ids).eq('company_id', companyId);
      if (error) throw error;
      toast({ title: 'Excluídos', description: `${ids.length} contato(s) removido(s).` });
      clearSelection();
      loadContacts();
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message || 'Falha ao excluir', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  // ============ Pull from Cadastros ============
  const openPullDialog = async () => {
    setPullOpen(true);
    setClientsSelected(new Set());
    setClientsLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, phone, whatsapp, avatar_url, company_name, client_type')
        .eq('company_id', companyId)
        .order('name', { ascending: true })
        .limit(500);
      if (error) throw error;
      setClients((data || []).filter(c => c.phone || c.whatsapp));
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message || 'Falha ao carregar cadastros', variant: 'destructive' });
    } finally { setClientsLoading(false); }
  };

  const filteredClients = useMemo(() => clients.filter(c => {
    if (!clientsQuery) return true;
    const q = clientsQuery.toLowerCase();
    return c.name?.toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.whatsapp || '').includes(q);
  }), [clients, clientsQuery]);

  const importFromClients = async () => {
    if (clientsSelected.size === 0) return;
    setBusy(true);
    try {
      const chosen = clients.filter(c => clientsSelected.has(c.id));
      const payload = chosen.map(c => {
        const raw = String(c.whatsapp || c.phone || '').replace(/\D/g, '');
        const phone = raw.length === 11 ? '55' + raw : raw;
        return {
          company_id: companyId,
          session_id: sessionId || null,
          wa_id: phone + '@s.whatsapp.net',
          phone_number: phone,
          push_name: c.name,
          business_name: c.company_name || null,
          is_business: c.client_type === 'business',
          profile_picture: c.avatar_url || null,
        };
      }).filter(x => x.phone_number);
      if (payload.length === 0) throw new Error('Nenhum cadastro com telefone válido.');
      const { error } = await supabase.from('whatsapp_contacts').upsert(payload, { onConflict: 'company_id,wa_id' } as any);
      if (error) throw error;
      toast({ title: 'Puxado dos Cadastros', description: `${payload.length} contato(s) adicionado(s).` });
      setPullOpen(false);
      loadContacts();
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message || 'Falha ao puxar cadastros', variant: 'destructive' });
    } finally { setBusy(false); }
  };

  // ============ Sidebar mode (unchanged simple) ============
  if (!fullPage) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[15px]">Contatos</span>
              <span className="text-xs text-muted-foreground tabular-nums">{totalContacts}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={loadContacts} className="h-8 w-8 p-0">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contatos..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted/50 border-transparent rounded-xl focus-visible:bg-background"
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-4">
              <User className="h-10 w-10 text-muted-foreground/40 mb-4" />
              <h3 className="font-medium mb-1">{searchQuery ? 'Nada encontrado' : 'Nenhum contato'}</h3>
              <p className="text-xs text-muted-foreground">Os contatos serão sincronizados após conectar o WhatsApp.</p>
            </div>
          ) : (
            <div>
              {filteredContacts.map(c => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer group border-b border-border/40">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={c.profile_picture || undefined} />
                    <AvatarFallback style={{ backgroundColor: getAvatarColor(c.push_name) }} className="text-white">
                      {c.push_name?.substring(0, 2).toUpperCase() || <User className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm truncate block">{c.push_name || c.business_name || 'Contato sem nome'}</span>
                    <p className="text-xs text-muted-foreground tabular-nums">{formatPhoneNumber(c.phone_number)}</p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onStartConversation && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={e => { e.stopPropagation(); onStartConversation(c); }}>
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    )}
                    {onSaveAsLead && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={e => { e.stopPropagation(); onSaveAsLead(c); }}>
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============ Full page mode — CLEAN ============
  return (
    <div className="h-full overflow-auto bg-background">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileChosen}
      />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-3xl font-semibold text-foreground tracking-tight">Contatos</h1>
              <span className="text-xl font-light text-muted-foreground tabular-nums">{totalContacts}</span>
            </div>
            <p className="text-muted-foreground mt-2 text-[15px] max-w-xl leading-relaxed">
              Gerencie contatos do WhatsApp, importe/exporte listas em CSV e envie leads direto para o Cadastros.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadContacts}
              disabled={loading}
              className="h-9 px-3 rounded-full text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
            >
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} />
              Atualizar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={openPullDialog}
              className="h-9 px-3 rounded-full text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
            >
              <ArrowDownToLine className="h-3.5 w-3.5 mr-1.5" />
              Puxar dos Cadastros
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleImportClick}
              disabled={busy}
              className="h-9 px-3 rounded-full text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Importar CSV
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 rounded-full text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => exportCsv(false)}>
                  <ArrowUpFromLine className="h-4 w-4 mr-2" />
                  Todos ({filteredContacts.length})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportCsv(true)} disabled={selected.size === 0}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Somente selecionados ({selected.size})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Toolbar card */}
        <div className="bg-card border border-border/60 rounded-3xl overflow-hidden">
          <div className="p-4 flex items-center gap-3 border-b border-border/40">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome ou telefone..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-11 py-2.5 bg-muted/50 border-transparent rounded-2xl text-[13px] focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-border"
              />
            </div>

            {/* Selection bar (right-aligned) */}
            {selected.size > 0 ? (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[13px] text-muted-foreground tabular-nums">
                  {selected.size} selecionado(s)
                </span>
                <Button
                  size="sm"
                  onClick={saveSelectedAsLeads}
                  disabled={busy}
                  className="h-9 rounded-full text-[13px] font-medium text-white gap-1.5"
                  style={{ backgroundColor: OMNI_COLOR }}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Salvar em Cadastros
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={deleteSelected}
                  disabled={busy}
                  className="h-9 rounded-full text-[13px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Excluir
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearSelection}
                  className="h-9 w-9 p-0 rounded-full text-muted-foreground hover:text-foreground"
                >
                  ×
                </Button>
              </div>
            ) : (
              <div className="ml-auto text-[13px] text-muted-foreground">
                {filteredContacts.length} exibido(s)
              </div>
            )}
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-[44px_1fr_140px] gap-4 px-4 py-3 border-b border-border/40 bg-muted/30 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="flex items-center justify-center">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
            </div>
            <div>Contato</div>
            <div className="text-right pr-2">Ações</div>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-20 px-6">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-muted/60 flex items-center justify-center">
                <Users className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <h3 className="text-base font-medium text-foreground mb-2">Nenhum contato encontrado</h3>
              <p className="text-[13px] text-muted-foreground max-w-sm mx-auto leading-relaxed">
                {searchQuery
                  ? 'Tente outra busca ou limpe o filtro.'
                  : 'Importe um CSV, puxe dos Cadastros ou aguarde a sincronização do WhatsApp.'}
              </p>
            </div>
          ) : (
            <div>
              {filteredContacts.map(c => (
                <div
                  key={c.id}
                  className={cn(
                    'grid grid-cols-[44px_1fr_140px] gap-4 px-4 py-3.5 items-center transition-colors border-b border-border/30 last:border-b-0',
                    selected.has(c.id) ? 'bg-[#374DA4]/[0.03]' : 'hover:bg-muted/30'
                  )}
                >
                  <div className="flex items-center justify-center">
                    <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} />
                  </div>

                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={c.profile_picture || undefined} />
                      <AvatarFallback style={{ backgroundColor: getAvatarColor(c.push_name) }} className="text-white text-xs font-medium">
                        {c.push_name?.substring(0, 2).toUpperCase() || <User className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[14px] text-foreground truncate">
                          {c.push_name || c.business_name || 'Contato sem nome'}
                        </span>
                        {c.is_business && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-md border-border/60 text-muted-foreground">
                            Business
                          </Badge>
                        )}
                      </div>
                      <p className="text-[12px] text-muted-foreground tabular-nums">
                        {formatPhoneNumber(c.phone_number)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1">
                    {onStartConversation && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        title="Iniciar conversa"
                        onClick={() => onStartConversation(c)}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    )}
                    {onSaveAsLead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        title="Salvar como Lead"
                        onClick={() => onSaveAsLead(c)}
                      >
                        <UserPlus className="h-4 w-4" />
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => { setSelected(new Set([c.id])); exportCsv(true); }}>
                          <Download className="h-4 w-4 mr-2" />
                          Exportar este
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={async () => {
                            if (!confirm('Excluir este contato?')) return;
                            await supabase.from('whatsapp_contacts').delete().eq('id', c.id).eq('company_id', companyId);
                            loadContacts();
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
              {totalContacts > 500 && (
                <div className="p-4 text-center text-[12px] text-muted-foreground">
                  Mostrando 500 de {totalContacts} contatos. Use a busca para refinar.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pull-from-Cadastros dialog */}
      <Dialog open={pullOpen} onOpenChange={setPullOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Puxar do Cadastros</DialogTitle>
            <DialogDescription>
              Selecione clientes/leads com telefone para adicionar como contatos do WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={clientsQuery}
              onChange={e => setClientsQuery(e.target.value)}
              className="pl-11 py-2.5 bg-muted/50 border-transparent rounded-2xl text-[13px]"
            />
          </div>

          <ScrollArea className="max-h-[400px] pr-2">
            {clientsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                Nenhum cadastro com telefone encontrado.
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {filteredClients.map(c => {
                  const chk = clientsSelected.has(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 py-2.5 px-1 cursor-pointer hover:bg-muted/40 rounded-lg"
                    >
                      <Checkbox
                        checked={chk}
                        onCheckedChange={() => setClientsSelected(prev => {
                          const n = new Set(prev);
                          n.has(c.id) ? n.delete(c.id) : n.add(c.id);
                          return n;
                        })}
                      />
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={c.avatar_url || undefined} />
                        <AvatarFallback style={{ backgroundColor: getAvatarColor(c.name) }} className="text-white text-xs">
                          {c.name?.substring(0, 2).toUpperCase() || <User className="h-4 w-4" />}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-medium truncate">{c.name}</div>
                        <div className="text-[12px] text-muted-foreground tabular-nums">
                          {c.whatsapp || c.phone}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPullOpen(false)}>Cancelar</Button>
            <Button
              onClick={importFromClients}
              disabled={busy || clientsSelected.size === 0}
              style={{ backgroundColor: OMNI_COLOR }}
              className="text-white"
            >
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowDownToLine className="h-4 w-4 mr-2" />}
              Adicionar {clientsSelected.size > 0 ? `(${clientsSelected.size})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WhatsAppContacts;
