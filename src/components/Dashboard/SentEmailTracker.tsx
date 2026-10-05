import React, { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Mail, Eye, MousePointer, Clock, Search, Filter,
  AlertCircle, RefreshCw, ChevronRight, ChevronLeft, MailOpen,
  Smartphone, Monitor, Tablet, Globe, Link2, MapPin,
  BarChart3, Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface TrackedEmail {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  sent_at: string;
  status: string;
  open_count: number;
  opened_at: string | null;
  last_opened_at: string | null;
  metadata: any;
  tracking_pixel_id: string;
}

interface EmailEvent {
  id: string;
  email_id: string;
  event_type: string;
  timestamp: string;
  user_agent: string | null;
  ip_address: string | null;
  browser: string | null;
  os: string | null;
  device_type: string | null;
  country: string | null;
  city: string | null;
  referrer: string | null;
  open_count: number | null;
  metadata: any;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  sent: { label: 'Enviado', color: 'text-[#2F428D]', bgColor: 'bg-[#F0F2FE]', icon: Mail },
  delivered: { label: 'Entregue', color: 'text-[#2F428D]', bgColor: 'bg-[#F0F2FE]', icon: Mail },
  opened: { label: 'Aberto', color: 'text-[#2ECC71]', bgColor: 'bg-[#2ECC71]/10', icon: MailOpen },
  clicked: { label: 'Clicado', color: 'text-purple-600', bgColor: 'bg-purple-50', icon: MousePointer },
  bounced: { label: 'Falhou', color: 'text-red-600', bgColor: 'bg-red-50', icon: AlertCircle },
};

const getDeviceIcon = (deviceType: string | null) => {
  switch (deviceType) {
    case 'mobile': return Smartphone;
    case 'tablet': return Tablet;
    case 'email_proxy': return Globe;
    default: return Monitor;
  }
};

const TRACK_COLOR = "#2ECC71";

// Engagement chart by hour
const EngagementChart: React.FC<{ events: EmailEvent[] }> = ({ events }) => {
  const hourData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}h`, aberturas: 0, cliques: 0 }));
    events.forEach(e => {
      const h = new Date(e.timestamp).getHours();
      if (e.event_type === 'opened') hours[h].aberturas++;
      if (e.event_type === 'clicked') hours[h].cliques++;
    });
    return hours;
  }, [events]);

  if (events.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-4 w-4" style={{ color: TRACK_COLOR }} />
        <h3 className="text-sm font-semibold text-gray-900">Engajamento por Horário</h3>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={hourData} barGap={0}>
          <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={24} />
          <Tooltip
            contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #e5e7eb' }}
            labelFormatter={(v) => `${v}:00`}
          />
          <Bar dataKey="aberturas" fill={TRACK_COLOR} radius={[4, 4, 0, 0]} name="Aberturas" />
          <Bar dataKey="cliques" fill="#8B5CF6" radius={[4, 4, 0, 0]} name="Cliques" />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 justify-center">
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: TRACK_COLOR }} /><span className="text-xs text-gray-500">Aberturas</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-purple-500" /><span className="text-xs text-gray-500">Cliques</span></div>
      </div>
    </div>
  );
};

const SentEmailTracker: React.FC = () => {
  const { toast } = useToast();
  const [emails, setEmails] = useState<TrackedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedEmail, setSelectedEmail] = useState<TrackedEmail | null>(null);
  const [selectedEmailEvents, setSelectedEmailEvents] = useState<EmailEvent[]>([]);
  const [allEvents, setAllEvents] = useState<EmailEvent[]>([]);
  const [showEventsModal, setShowEventsModal] = useState(false);

  const loadEmails = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('emails').select('*').order('sent_at', { ascending: false }).limit(200);
    if (!error && data) setEmails(data as any);
    setLoading(false);
  };

  const loadAllEvents = async () => {
    const { data } = await supabase.from('email_events').select('*').order('timestamp', { ascending: false }).limit(1000);
    if (data) setAllEvents(data as any);
  };

  const loadEventsForEmail = async (emailId: string) => {
    const { data } = await supabase.from('email_events').select('*').eq('email_id', emailId).order('timestamp', { ascending: false });
    if (data) setSelectedEmailEvents(data as any);
  };

  useEffect(() => { loadEmails(); loadAllEvents(); }, []);
  useEffect(() => { if (selectedEmail) loadEventsForEmail(selectedEmail.id); }, [selectedEmail?.id]);

  const getEmailStatus = (email: TrackedEmail) => {
    if ((email.open_count || 0) > 0) return 'opened';
    return email.status || 'sent';
  };

  const totalEmails = emails.length;
  const openedEmails = emails.filter(e => (e.open_count || 0) > 0).length;
  const totalOpens = emails.reduce((sum, e) => sum + (e.open_count || 0), 0);
  const totalClicks = allEvents.filter(e => e.event_type === 'clicked').length;
  const openRate = totalEmails > 0 ? ((openedEmails / totalEmails) * 100).toFixed(1) : '0';

  const filteredEmails = emails.filter(email => {
    const matchesSearch = email.recipient_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (email.recipient_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const emailStatus = getEmailStatus(email);
    const matchesStatus = filterStatus === 'all' || emailStatus === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = [
    { label: "Emails Enviados", value: totalEmails, icon: Mail, color: "#374DA4" },
    { label: "Taxa de Abertura", value: `${openRate}%`, icon: MailOpen, color: "#10B981" },
    { label: "Total Aberturas", value: totalOpens, icon: Eye, color: "#8B5CF6" },
    { label: "Cliques em Links", value: totalClicks, icon: Link2, color: "#F59E0B" },
  ];

  // Count clicks for selected email
  const selectedClickCount = selectedEmailEvents.filter(e => e.event_type === 'clicked').length;

  return (
    <div className="min-h-full bg-[#faf9f7] p-4 sm:p-6 pb-[13rem] md:pb-32 lg:pb-6 overscroll-contain">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-[#374DA4]">Rastrear Emails</h1>
          <Button
            variant="outline"
            className="rounded-full border-gray-200 bg-white shrink-0"
            onClick={() => { loadEmails(); loadAllEvents(); }}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {selectedEmail ? (
          /* ---------- DETALHES ---------- */
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 sm:mb-8">
              <Button variant="ghost" onClick={() => setSelectedEmail(null)} className="rounded-full hover:bg-white/50">
                <ChevronLeft className="h-4 w-4 mr-2" /> Voltar
              </Button>
              <Badge variant="secondary" className={`text-[10px] font-bold px-3 py-1 rounded-full ${
                (selectedEmail.open_count || 0) > 0 ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-500'
              }`}>
                {(selectedEmail.open_count || 0) > 0 ? 'Aberto' : 'Enviado'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Aberturas', value: selectedEmail.open_count || 0 },
                { label: 'Cliques', value: selectedClickCount },
                { label: '1ª abertura', value: selectedEmail.opened_at ? format(new Date(selectedEmail.opened_at), 'dd/MM HH:mm') : '—' },
                { label: 'Eventos', value: selectedEmailEvents.length },
              ].map((stat, i) => (
                <div key={i} className="bg-white/50 backdrop-blur-sm p-5 rounded-2xl border border-white shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="space-y-12">
              <section>
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 px-1">Email</h3>
                <div className="bg-white rounded-3xl p-5 sm:p-8 border border-white shadow-sm space-y-3">
                  <p className="text-lg font-bold text-gray-900">{selectedEmail.subject}</p>
                  <p className="text-sm text-gray-500">
                    Para <span className="font-medium text-gray-700">{selectedEmail.recipient_name || selectedEmail.recipient_email}</span>
                    {selectedEmail.recipient_name && <span className="text-gray-400"> ({selectedEmail.recipient_email})</span>}
                  </p>
                  <p className="text-xs text-gray-400">
                    Enviado em {format(new Date(selectedEmail.sent_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </p>
                  {selectedEmail.metadata?.provider && (
                    <span className="inline-block text-[10px] font-medium text-gray-500 bg-gray-50 px-3 py-1 rounded-full capitalize">
                      {selectedEmail.metadata.provider}
                    </span>
                  )}
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-4 px-1">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Linha do tempo</h3>
                  {selectedEmailEvents.length > 6 && (
                    <Button variant="ghost" size="sm" className="text-xs h-7 rounded-full" onClick={() => setShowEventsModal(true)}>
                      Ver todos ({selectedEmailEvents.length})
                    </Button>
                  )}
                </div>
                <div className="space-y-0 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[1px] before:bg-gray-100">
                  <div className="relative pl-12 pb-6">
                    <div className="absolute left-0 top-1 w-[35px] h-[35px] rounded-full border-4 border-[#faf9f7] flex items-center justify-center z-10 bg-[#374DA4]">
                      <Mail className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-900">Enviado</span>
                      <span className="text-[10px] text-gray-400 mt-0.5">
                        {format(new Date(selectedEmail.sent_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  </div>

                  {selectedEmailEvents.slice(0, 6).map((event) => {
                    const DeviceIcon = getDeviceIcon(event.device_type);
                    const isClick = event.event_type === 'clicked';
                    return (
                      <div key={event.id} className="relative pl-12 pb-6 group">
                        <div className={`absolute left-0 top-1 w-[35px] h-[35px] rounded-full border-4 border-[#faf9f7] flex items-center justify-center z-10 ${isClick ? 'bg-purple-500' : 'bg-green-500'}`}>
                          {isClick ? <MousePointer className="h-3.5 w-3.5 text-white" /> : <MailOpen className="h-3.5 w-3.5 text-white" />}
                        </div>
                        <div className="group-hover:bg-white/40 p-2 -m-2 rounded-xl transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">
                              {isClick ? 'Link clicado' : event.event_type === 'opened' ? 'Aberto' : event.event_type}
                            </span>
                            <DeviceIcon className="h-3 w-3 text-gray-400" />
                          </div>
                          <span className="text-[10px] text-gray-400">{format(new Date(event.timestamp), "dd/MM 'às' HH:mm:ss")}</span>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {event.browser && <span className="text-[10px] text-gray-500 bg-gray-50 rounded-full px-2 py-0.5">{event.browser}</span>}
                            {event.os && <span className="text-[10px] text-gray-500 bg-gray-50 rounded-full px-2 py-0.5">{event.os}</span>}
                            {event.city && event.country && (
                              <span className="text-[10px] text-gray-500 bg-gray-50 rounded-full px-2 py-0.5 flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" />{event.city}, {event.country}
                              </span>
                            )}
                          </div>
                          {isClick && event.metadata?.url && (
                            <p className="text-[10px] text-purple-500 mt-1 truncate">{event.metadata.url}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {selectedEmailEvents.length === 0 && (
                    <div className="bg-white/30 rounded-3xl p-12 text-center border border-dashed border-gray-200">
                      <p className="text-sm text-gray-400 italic">Nenhuma abertura registrada ainda...</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        ) : (
          /* ---------- LISTA ---------- */
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((stat, i) => (
                <div key={i} className="bg-white/50 backdrop-blur-sm p-5 rounded-2xl border border-white shadow-sm">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                </div>
              ))}
            </div>

            <EngagementChart events={allEvents} />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar email, assunto ou nome..."
                  className="pl-9 w-full sm:w-80 rounded-full h-10 bg-white border-gray-200"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40 rounded-full h-10 bg-white border-gray-200">
                  <Filter className="h-4 w-4 mr-1" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="rounded-lg">Todos</SelectItem>
                  <SelectItem value="sent" className="rounded-lg">Enviado</SelectItem>
                  <SelectItem value="opened" className="rounded-lg">Aberto</SelectItem>
                  <SelectItem value="clicked" className="rounded-lg">Clicado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card className="rounded-2xl border-none shadow-sm overflow-x-auto">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead>Enviado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aberturas</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16">
                        <RefreshCw className="h-6 w-6 animate-spin text-gray-300 mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredEmails.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16 text-sm text-gray-400 italic">
                        Nenhum email rastreado ainda
                      </TableCell>
                    </TableRow>
                  ) : filteredEmails.map((email) => {
                    const emailStatus = getEmailStatus(email);
                    const status = statusConfig[emailStatus] || statusConfig.sent;
                    return (
                      <TableRow
                        key={email.id}
                        className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                        onClick={() => setSelectedEmail(email)}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{email.recipient_name || email.recipient_email}</span>
                            {email.recipient_name && <span className="text-[10px] text-gray-400">{email.recipient_email}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[240px]">
                          <span className="text-sm text-gray-600 truncate block">{email.subject}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-[11px] text-gray-400">
                            {format(new Date(email.sent_at), "dd MMM 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`text-[10px] ${
                            emailStatus === 'opened' ? 'bg-green-50 text-green-600' :
                            emailStatus === 'clicked' ? 'bg-purple-50 text-purple-600' :
                            emailStatus === 'bounced' ? 'bg-red-50 text-red-600' :
                            'bg-gray-50 text-gray-500'
                          }`}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-bold text-[#374DA4]">{email.open_count || 0}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50"
                            onClick={async (ev) => {
                              ev.stopPropagation();
                              if (!confirm('Apagar este registro de email?')) return;
                              const { error } = await supabase.from('emails').delete().eq('id', email.id);
                              if (error) {
                                toast({ title: 'Erro ao apagar', description: error.message, variant: 'destructive' });
                                return;
                              }
                              setEmails((prev) => prev.filter((e) => e.id !== email.id));
                              toast({ title: 'Registro apagado' });
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </div>

      {/* Events Modal - Full Timeline */}
      <Dialog open={showEventsModal} onOpenChange={setShowEventsModal}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle>Timeline Completa</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[500px]">
            <div className="space-y-3 pr-4">
              {selectedEmailEvents.map((event) => {
                const DeviceIcon = getDeviceIcon(event.device_type);
                const isClick = event.event_type === 'clicked';
                return (
                  <div key={event.id} className="p-3 rounded-xl border border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge 
                          className={`text-xs rounded-lg border-0 ${isClick ? 'bg-purple-50 text-purple-600' : 'bg-[#2ECC71]/10 text-[#2ECC71]'}`}
                        >
                          {event.event_type === 'opened' ? 'Abertura' : event.event_type === 'clicked' ? 'Clique' : event.event_type}
                        </Badge>
                        <DeviceIcon className="h-3.5 w-3.5 text-gray-400" />
                      </div>
                      <span className="text-xs text-gray-500">{format(new Date(event.timestamp), "dd/MM/yy HH:mm:ss")}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {event.browser && <span className="text-[10px] text-gray-500 bg-gray-50 rounded px-1.5 py-0.5">{event.browser}</span>}
                      {event.os && <span className="text-[10px] text-gray-500 bg-gray-50 rounded px-1.5 py-0.5">{event.os}</span>}
                      {event.device_type && <span className="text-[10px] text-gray-500 bg-gray-50 rounded px-1.5 py-0.5 capitalize">{event.device_type}</span>}
                      {event.city && event.country && (
                        <span className="text-[10px] text-gray-500 bg-gray-50 rounded px-1.5 py-0.5 flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" />{event.city}, {event.country}
                        </span>
                      )}
                    </div>
                    {isClick && event.metadata?.url && (
                      <p className="text-[10px] text-purple-500 mt-1.5 truncate">🔗 {event.metadata.url}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SentEmailTracker;
