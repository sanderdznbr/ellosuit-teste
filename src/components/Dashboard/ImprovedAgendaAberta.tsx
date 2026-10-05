import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  Clock, Plus, Copy, Link as LinkIcon, Trash2, Users,
  ExternalLink, CheckCircle2, XCircle, Mail, CalendarDays, Timer,
  Palette, Sparkles
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isAfter, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const FLOW_COLOR = "#4D7CFF";

interface BookingLink {
  id: string;
  title: string;
  description?: string;
  duration_minutes: number;
  buffer_minutes: number;
  link_slug: string;
  is_active: boolean;
  expires_at?: string;
  created_at: string;
  logo_url?: string | null;
  primary_color?: string | null;
}

interface PublicBooking {
  id: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  booking_date: string;
  booking_time: string;
  status: string;
  notes?: string;
  booking_link_id: string;
  created_at: string;
}

const ImprovedAgendaAberta = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [bookingLinks, setBookingLinks] = useState<BookingLink[]>([]);
  const [bookings, setBookings] = useState<PublicBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'links' | 'bookings'>('links');
  const [bookingFilter, setBookingFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration_minutes: 30,
    buffer_minutes: 15
  });

  useEffect(() => {
    const fetchCompanyId = async () => {
      if (!user?.id) return;
      const { data } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).single();
      if (data?.company_id) setCompanyId(data.company_id);
    };
    fetchCompanyId();
  }, [user?.id]);

  useEffect(() => {
    if (companyId && user?.id) {
      loadBookingLinks();
      loadBookings();
    }
  }, [companyId, user?.id]);

  const loadBookingLinks = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase.from('public_booking_links').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (!error) setBookingLinks(data || []);
    setLoading(false);
  };

  const loadBookings = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase.from('public_bookings').select('*').eq('user_id', user.id).order('booking_date', { ascending: true }).order('booking_time', { ascending: true });
    if (!error) setBookings(data || []);
  };

  const createBookingLink = async () => {
    if (!user?.id || !companyId) return;
    const linkSlug = `${user.email?.split('@')[0]}-${Date.now().toString(36)}`;
    const { data, error } = await supabase.from('public_booking_links').insert({ ...formData, link_slug: linkSlug, user_id: user.id, company_id: companyId, is_active: true }).select().single();
    if (error) { toast({ title: 'Erro', description: 'Erro ao criar link', variant: 'destructive' }); return; }
    toast({ title: 'Link criado!', description: 'Personalize o visual do seu link agora' });
    setFormData({ title: '', description: '', duration_minutes: 30, buffer_minutes: 15 });
    setShowCreateDialog(false);
    loadBookingLinks();
    // Navigate to the editor for the newly created link
    if (data?.id) {
      navigate(`/dashboard/agenda-aberta/editor?linkId=${data.id}`);
    }
  };

  const toggleLinkStatus = async (linkId: string, isActive: boolean) => {
    const { error } = await supabase.from('public_booking_links').update({ is_active: !isActive }).eq('id', linkId);
    if (!error) { loadBookingLinks(); toast({ title: isActive ? 'Link desativado' : 'Link ativado' }); }
  };

  const copyLinkToClipboard = (linkSlug: string) => {
    navigator.clipboard.writeText(`https://www.ellosuit.online/agendamentos/${linkSlug}`);
    toast({ title: 'Link copiado!' });
  };

  const openBookingPage = (linkSlug: string) => window.open(`/agendamentos/${linkSlug}`, '_blank');

  const deleteLink = async (linkId: string) => {
    if (!confirm('Excluir este link? Esta ação não pode ser desfeita.')) return;
    const { error } = await supabase.from('public_booking_links').delete().eq('id', linkId);
    if (!error) { loadBookingLinks(); toast({ title: 'Link excluído' }); }
  };

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    const { error } = await supabase.from('public_bookings').update({ status: newStatus }).eq('id', bookingId);
    if (!error) { loadBookings(); toast({ title: 'Status atualizado' }); }
  };

  const getFilteredBookings = () => {
    const today = startOfDay(new Date());
    return bookings.filter(booking => {
      const bookingDate = parseISO(booking.booking_date);
      if (bookingFilter === 'upcoming') return isAfter(bookingDate, today) || format(bookingDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
      if (bookingFilter === 'past') return isBefore(bookingDate, today);
      return true;
    });
  };

  const getLinkStats = (linkId: string) => {
    const lb = bookings.filter(b => b.booking_link_id === linkId);
    return { total: lb.length, confirmed: lb.filter(b => b.status === 'confirmed').length, pending: lb.filter(b => b.status === 'pending').length };
  };

  const filteredBookings = getFilteredBookings();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays} dias atrás`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} semanas atrás`;
    return `${Math.floor(diffDays / 30)} meses atrás`;
  };

  return (
    <div className="relative min-h-full bg-[#faf9f7] dark:bg-background transition-colors duration-300">
      {/* Ambient glows - refined for Claude style */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-[#374DA4]/10 blur-3xl" />
        <div className="absolute top-40 right-0 h-72 w-72 rounded-full bg-[#374DA4]/5 blur-3xl" />
      </div>
      <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header */}
        <div className="bg-white/40 dark:bg-white/5 backdrop-blur-xl border border-border/40 rounded-3xl p-5 md:p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[#374DA4] flex items-center justify-center shadow-lg shadow-[#374DA4]/20">
              <CalendarDays className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#374DA4]">Agenda Online</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie seus links de agendamento e compromissos
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="rounded-full gap-2 bg-[#374DA4] hover:bg-[#2e418a] text-white shadow-lg shadow-[#374DA4]/20">
            <Plus className="h-4 w-4" />
            Novo Link
          </Button>
        </div>

        {/* Tab Switcher (glass pill) */}
        <div className="bg-[#ecebe4] dark:bg-white/5 p-1.5 inline-flex gap-1 mb-6 rounded-full">
          {[
            { id: 'links' as const, label: 'Meus Links', icon: LinkIcon },
            { id: 'bookings' as const, label: 'Agendamentos', icon: CalendarDays },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2",
                activeTab === tab.id
                  ? "bg-[#374DA4] text-white shadow-md shadow-[#374DA4]/20"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Links Tab */}
        {activeTab === 'links' && (
          <div className="bg-white dark:bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            {/* Search + Actions */}
            <div className="p-4 flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar links..."
                  className="pl-9 border-border bg-muted rounded-xl focus:bg-card"
                />
              </div>
              <div className="flex-1" />
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="sm:max-w-lg rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>Criar Link de Agendamento</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Título do Evento</Label>
                      <Input placeholder="Ex: Consultoria de 30min" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição (opcional)</Label>
                      <Textarea placeholder="Descreva o compromisso..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="rounded-xl resize-none" rows={3} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2"><Timer className="h-4 w-4 text-gray-400" />Duração</Label>
                        <Select value={formData.duration_minutes.toString()} onValueChange={(v) => setFormData({ ...formData, duration_minutes: parseInt(v) })}>
                          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="15">15 minutos</SelectItem>
                            <SelectItem value="30">30 minutos</SelectItem>
                            <SelectItem value="45">45 minutos</SelectItem>
                            <SelectItem value="60">1 hora</SelectItem>
                            <SelectItem value="90">1h 30min</SelectItem>
                            <SelectItem value="120">2 horas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2"><Clock className="h-4 w-4 text-gray-400" />Intervalo</Label>
                        <Select value={formData.buffer_minutes.toString()} onValueChange={(v) => setFormData({ ...formData, buffer_minutes: parseInt(v) })}>
                          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="0">Sem intervalo</SelectItem>
                            <SelectItem value="5">5 minutos</SelectItem>
                            <SelectItem value="10">10 minutos</SelectItem>
                            <SelectItem value="15">15 minutos</SelectItem>
                            <SelectItem value="30">30 minutos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="flex-1 rounded-xl">Cancelar</Button>
                    <Button onClick={createBookingLink} disabled={!formData.title} className="flex-1 rounded-xl bg-[#374DA4] hover:bg-[#2500B8] text-white">Criar Link</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-[1fr_100px_100px_120px_140px_160px] gap-4 px-4 py-3 border-t border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div>Nome</div>
              <div>Duração</div>
              <div>Status</div>
              <div>Agendamentos</div>
              <div>Criado em</div>
              <div className="text-right">Ações</div>
            </div>

            {/* List */}
            {bookingLinks.length === 0 ? (
              <div className="text-center py-16">
                <LinkIcon className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Nenhum link criado</h3>
                <p className="text-muted-foreground mb-6">Crie seu primeiro link para permitir agendamentos</p>
                <Button onClick={() => setShowCreateDialog(true)} className="rounded-full bg-[#374DA4] hover:bg-[#2e418a] text-white shadow-lg shadow-[#374DA4]/20">
                  <Plus className="h-4 w-4 mr-2" />Criar Link
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {bookingLinks.map((link) => {
                  const stats = getLinkStats(link.id);
                  return (
                    <div
                      key={link.id}
                      className={cn(
                        "grid grid-cols-[1fr_100px_100px_120px_140px_160px] gap-4 px-4 py-4 items-center hover:bg-muted/50 transition-colors",
                        !link.is_active && "opacity-60"
                      )}
                    >
                      {/* Name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center"
                          style={{ backgroundColor: link.logo_url ? 'transparent' : `${link.primary_color || FLOW_COLOR}12` }}
                        >
                          {link.logo_url ? (
                            <img src={link.logo_url} alt="Logo" className="w-full h-full object-cover rounded-xl" />
                          ) : (
                            <LinkIcon className="h-4 w-4" style={{ color: link.primary_color || FLOW_COLOR }} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-foreground truncate block">{link.title}</span>
                          {link.description && <p className="text-xs text-muted-foreground truncate">{link.description}</p>}
                        </div>
                      </div>

                      {/* Duration */}
                      <div className="text-sm text-muted-foreground">
                        {link.duration_minutes} min
                      </div>

                      {/* Status */}
                      <div>
                        {link.is_active ? (
                          <Badge className="bg-green-50 text-green-700 border-0 text-[10px] px-2 py-0.5">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-2 py-0.5">Inativo</Badge>
                        )}
                      </div>

                      {/* Bookings count */}
                      <div className="text-sm text-muted-foreground">
                        {stats.total} total
                      </div>

                      {/* Created */}
                      <div className="text-sm text-muted-foreground">
                        {formatRelativeDate(link.created_at)}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => navigate(`/dashboard/agenda-aberta/editor?linkId=${link.id}`)} title="Personalizar">
                          <Palette className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => copyLinkToClipboard(link.link_slug)} title="Copiar link">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => openBookingPage(link.link_slug)} title="Abrir">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground" onClick={() => toggleLinkStatus(link.id, link.is_active)} title={link.is_active ? 'Desativar' : 'Ativar'}>
                          {link.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600" onClick={() => deleteLink(link.id)} title="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            {/* Filters */}
            <div className="p-4 flex items-center gap-3">
              <div className="flex gap-2">
                {(['upcoming', 'all', 'past'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setBookingFilter(filter)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      bookingFilter === filter ? 'text-white' : 'text-muted-foreground hover:bg-muted'
                    }`}
                    style={bookingFilter === filter ? { backgroundColor: FLOW_COLOR } : {}}
                  >
                    {filter === 'upcoming' && 'Próximos'}
                    {filter === 'all' && 'Todos'}
                    {filter === 'past' && 'Passados'}
                  </button>
                ))}
              </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-[1fr_140px_100px_120px_100px] gap-4 px-4 py-3 border-t border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div>Cliente</div>
              <div>Data</div>
              <div>Horário</div>
              <div>Status</div>
              <div className="text-right">Ações</div>
            </div>

            {/* List */}
            {filteredBookings.length === 0 ? (
              <div className="text-center py-16">
                <CalendarDays className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Nenhum agendamento</h3>
                <p className="text-muted-foreground">
                  {bookingFilter === 'upcoming' ? 'Sem agendamentos futuros' : bookingFilter === 'past' ? 'Sem agendamentos passados' : 'Aguardando agendamentos'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredBookings.map((booking) => {
                  const isPast = isBefore(parseISO(booking.booking_date), startOfDay(new Date()));
                  return (
                    <div
                      key={booking.id}
                      className={cn(
                        "grid grid-cols-[1fr_140px_100px_120px_100px] gap-4 px-4 py-4 items-center hover:bg-muted/50 transition-colors",
                        isPast && "opacity-60"
                      )}
                    >
                      {/* Client */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: `${FLOW_COLOR}12` }}>
                          <Users className="h-4 w-4" style={{ color: FLOW_COLOR }} />
                        </div>
                        <div className="min-w-0">
                          <span className="font-medium text-foreground truncate block">{booking.client_name}</span>
                          <span className="text-xs text-muted-foreground truncate block">{booking.client_email}</span>
                        </div>
                      </div>

                      {/* Date */}
                      <div className="text-sm text-muted-foreground">
                        {format(parseISO(booking.booking_date), "dd 'de' MMM", { locale: ptBR })}
                      </div>

                      {/* Time */}
                      <div className="text-sm text-muted-foreground">
                        {booking.booking_time}
                      </div>

                      {/* Status */}
                      <div>
                        <Badge className={cn(
                          "text-[10px] px-2 py-0.5 border-0",
                          booking.status === 'confirmed' && "bg-green-50 text-green-700",
                          booking.status === 'pending' && "bg-amber-50 text-amber-700",
                          booking.status === 'cancelled' && "bg-red-50 text-red-700"
                        )}>
                          {booking.status === 'confirmed' && '✓ Confirmado'}
                          {booking.status === 'pending' && '⏳ Pendente'}
                          {booking.status === 'cancelled' && '✕ Cancelado'}
                        </Badge>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1">
                        {!isPast && booking.status === 'pending' && (
                          <>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-green-600 hover:bg-green-50" onClick={() => updateBookingStatus(booking.id, 'confirmed')}>
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:bg-red-50" onClick={() => updateBookingStatus(booking.id, 'cancelled')}>
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImprovedAgendaAberta;
