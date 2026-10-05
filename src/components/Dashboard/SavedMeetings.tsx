import React, { useEffect, useMemo, useState } from 'react';
import { Download, Trash2, Search, Video, Mic, RefreshCw, Users, MoreHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import SavedMeetingDownloadModal from './SavedMeetingDownloadModal';
import MeetingDetailModal from './MeetingDetailModal';

interface Meeting {
  id: string;
  title: string;
  transcript: string;
  created_at: string;
  duration_seconds: number;
  file_url: string;
  speaker_mapping?: Record<string, string> | any;
  transcript_with_timestamps?: any;
  type?: 'presencial' | 'online';
  room_id?: string | null;
  livekit_recording_id?: string | null;
  meeting_code?: string | null;
  participants?: { name: string; user_id?: string | null }[];
}

const SUPABASE_URL = 'https://jwddiyuezqrpuakazvgg.supabase.co';
const PUBLIC_BUCKET = `${SUPABASE_URL}/storage/v1/object/public/meeting-recordings`;

const SavedMeetings = () => {
  const { toast } = useToast();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'online' | 'presencial'>('all');

  useEffect(() => { loadMeetings(); }, []);

  const resolveLiveKitFileUrl = async (egressId: string): Promise<string | null> => {
    try {
      const res = await fetch(`${PUBLIC_BUCKET}/${egressId}.json`);
      if (!res.ok) return null;
      const manifest = await res.json();
      const filename = manifest?.files?.[0]?.filename;
      if (!filename) return null;
      return `${PUBLIC_BUCKET}/${filename}`;
    } catch { return null; }
  };

  const loadMeetings = async () => {
    try {
      setRefreshing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load in-person meetings
      const { data: inPersonData } = await supabase.from('in_person_meetings')
        .select('id, title, transcript, created_at, duration_seconds, file_url, speaker_mapping, transcript_with_timestamps')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      // Load recordings with full metadata
      const { data: recordingsData } = await supabase.from('meeting_recordings')
        .select(`
          id, title, transcript, created_at, duration_seconds, file_url, 
          speaker_mapping, transcript_with_timestamps, room_id, 
          livekit_recording_id, skill_id, skill_feedback, meeting_metadata
        `)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      const recordings = recordingsData || [];
      const roomIds = Array.from(new Set(recordings.map((r: any) => r.room_id).filter(Boolean)));
      let participantsByRoom: Record<string, { name: string; user_id: string | null }[]> = {};
      let codeByRoom: Record<string, string> = {};
      if (roomIds.length) {
        const [{ data: parts }, { data: rooms }] = await Promise.all([
          supabase
          .from('room_participants')
          .select('room_id, user_id, display_name')
            .in('room_id', roomIds),
          supabase
            .from('meeting_rooms')
            .select('id, room_code')
            .in('id', roomIds),
        ]);
        (parts || []).forEach((p: any) => {
          if (!participantsByRoom[p.room_id]) participantsByRoom[p.room_id] = [];
          const exists = participantsByRoom[p.room_id].some(x => (x.user_id && x.user_id === p.user_id) || x.name === p.display_name);
          if (!exists) participantsByRoom[p.room_id].push({ name: p.display_name || 'Convidado', user_id: p.user_id });
        });
        (rooms || []).forEach((r: any) => { codeByRoom[r.id] = r.room_code; });
      }

      const enrichedRecordings = await Promise.all(recordings.map(async (m: any) => {
        let file_url = m.file_url;
        if (!file_url && m.livekit_recording_id) {
          file_url = await resolveLiveKitFileUrl(m.livekit_recording_id);
          if (file_url) {
            // Salva no banco para próximas vezes
            await supabase.from('meeting_recordings').update({ file_url }).eq('id', m.id);
          }
        }
        return {
          ...m,
          file_url: file_url || '',
          type: 'online' as const,
          participants: participantsByRoom[m.room_id] || [],
          meeting_code: codeByRoom[m.room_id] || null,
        };
      }));

      const enrichedInPerson = (inPersonData || []).map((m: any) => {
        const mapping = (m.speaker_mapping || {}) as Record<string, string>;
        const participants = Object.values(mapping).filter(Boolean).map((name: any) => ({ name }));
        return { ...m, type: 'presencial' as const, participants };
      });

      const combined = [...enrichedInPerson, ...enrichedRecordings]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setMeetings(combined as Meeting[]);
    } catch (error) {
      console.error('Erro ao carregar reuniões:', error);
      toast({ title: 'Erro ao Carregar', description: 'Não foi possível carregar as reuniões salvas', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const deleteMeeting = async (m: Meeting) => {
    if (!confirm('Deseja realmente excluir esta reunião?')) return;
    try {
      const table = m.type === 'online' ? 'meeting_recordings' : 'in_person_meetings';
      const { error } = await supabase.from(table).delete().eq('id', m.id);
      if (error) throw error;
      setMeetings(meetings.filter(x => x.id !== m.id));
      toast({ title: 'Reunião Excluída', description: 'A reunião foi removida com sucesso' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Erro ao Excluir', description: 'Não foi possível excluir', variant: 'destructive' });
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor(seconds / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m} min`;
    return `${seconds}s`;
  };

  const formatRelative = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'agora mesmo';
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `há ${days}d`;
    return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  };

  const filteredMeetings = useMemo(() => {
    const now = Date.now();
    const ranges: Record<string, number> = { today: 86400000, '7d': 7 * 86400000, '30d': 30 * 86400000 };
    return meetings.filter(m => {
      if (typeFilter !== 'all' && m.type !== typeFilter) return false;
      if (dateFilter !== 'all') {
        const ageMs = now - new Date(m.created_at).getTime();
        if (ageMs > ranges[dateFilter]) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!m.title.toLowerCase().includes(q) && !(m.transcript || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [meetings, search, dateFilter, typeFilter]);

  const stats = useMemo(() => {
    const total = meetings.length;
    const online = meetings.filter(m => m.type === 'online').length;
    const presencial = meetings.filter(m => m.type === 'presencial').length;
    const totalSec = meetings.reduce((acc, m) => acc + (m.duration_seconds || 0), 0);
    return { total, online, presencial, totalSec };
  }, [meetings]);

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      {/* Header */}
      <div className="px-10 pt-9 pb-5 shrink-0">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Histórico de Reuniões</h2>
            <p className="text-xs text-muted-foreground mt-1 font-light">
              Suas reuniões recentes — gravações e transcrições
              {!loading && meetings.length > 0 && (
                <span className="text-muted-foreground/40"> · {meetings.length} {meetings.length === 1 ? 'reunião' : 'reuniões'} · {formatDuration(stats.totalSec)}</span>
              )}
            </p>
          </div>
          <button onClick={loadMeetings} disabled={refreshing}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50" title="Atualizar">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      {!loading && meetings.length > 0 && (
        <div className="px-10 pb-4 space-y-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/30" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar reunião"
              className="pl-9 h-9 bg-card border-border text-sm text-foreground placeholder:text-muted-foreground/30 rounded-lg focus-visible:ring-1 focus-visible:ring-foreground/10 focus-visible:border-foreground/10 shadow-sm" />
          </div>
          <div className="flex items-center gap-1">
            {([['all','Todas'],['today','Hoje'],['7d','7 dias'],['30d','30 dias']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setDateFilter(k as any)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${dateFilter === k ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground/70'}`}>{label}</button>
            ))}
            <div className="w-px h-3.5 bg-border mx-2" />
            {([['all','Todos'],['online','Online'],['presencial','Presencial']] as const).map(([k, label]) => (
              <button key={k} onClick={() => setTypeFilter(k as any)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${typeFilter === k ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground/70'}`}>{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-muted-foreground/10 px-6 pb-6">
        {loading ? (
          <div className="space-y-px">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 mx-4 rounded-lg bg-muted animate-pulse" />)}
          </div>
        ) : filteredMeetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-12 h-12 rounded-full border border-border flex items-center justify-center mb-4">
              <Video className="h-5 w-5 text-muted-foreground/30" strokeWidth={1.5} />
            </div>
            <h3 className="text-sm font-medium mb-1">{meetings.length === 0 ? 'Nenhuma reunião ainda' : 'Nenhum resultado'}</h3>
            <p className="text-xs text-muted-foreground/30 max-w-xs font-light">
              {meetings.length === 0 ? 'Suas gravações e transcrições aparecerão aqui.' : 'Ajuste a busca ou os filtros.'}
            </p>
          </div>
        ) : (
          <div>
            {filteredMeetings.map((meeting, idx) => {
              const isOnline = meeting.type === 'online';
              const accent = isOnline ? '#007DE3' : '#3600FF';
              const hasTranscript = !!(meeting.transcript && meeting.transcript.trim().length > 0);
              const hasRecording = !!meeting.file_url;
              const participants = meeting.participants || [];
              const meetingDate = new Date(meeting.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });
              const displayTitle = isOnline && meeting.meeting_code
                ? `Reunião ${meeting.meeting_code} · ${meetingDate}`
                : `Reunião ${meetingDate}`;
              return (
                <div key={meeting.id}
                  onClick={() => { setSelectedMeeting(meeting); setShowDetailModal(true); }}
                  className={`group relative flex items-center gap-4 px-4 py-3.5 rounded-lg hover:bg-muted transition-colors cursor-pointer ${idx > 0 ? 'border-t border-border' : ''}`}>
                  <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center" style={{ background: `${accent}18`, color: accent }}>
                    {isOnline ? <Video className="w-4 h-4" strokeWidth={1.8} /> : <Mic className="w-4 h-4" strokeWidth={1.8} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                       <h3 className="font-medium text-sm text-foreground truncate">{displayTitle}</h3>
                      {participants.length > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground/40 shrink-0">
                          <Users className="w-3 h-3" />{participants.length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground/40 mt-0.5 font-light">
                      <span>{formatRelative(meeting.created_at)}</span>
                      {meeting.duration_seconds > 0 && <><span className="text-border">·</span><span>{formatDuration(meeting.duration_seconds)}</span></>}
                      {hasRecording && <><span className="text-border">·</span><span className="text-emerald-600/70">Gravação</span></>}
                      {hasTranscript && <><span className="text-border">·</span><span className="text-amber-600/70">Transcrição</span></>}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); setSelectedMeeting(meeting); setShowDownloadModal(true); }}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-colors" title="Baixar">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteMeeting(meeting); }}
                      className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground/50 hover:text-red-500 transition-colors" title="Excluir">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedMeeting && (
        <>
          <SavedMeetingDownloadModal
            isOpen={showDownloadModal}
            onClose={() => { setShowDownloadModal(false); if (!showDetailModal) setSelectedMeeting(null); }}
            meeting={selectedMeeting} />
          <MeetingDetailModal
            isOpen={showDetailModal}
            onClose={() => { setShowDetailModal(false); setSelectedMeeting(null); }}
            meeting={selectedMeeting}
            onDownload={() => { setShowDetailModal(false); setShowDownloadModal(true); }} />
        </>
      )}
    </div>
  );
};

export default SavedMeetings;
