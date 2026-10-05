import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Calendar, Clock, X, FileText, Sparkles, Video, Users, Mic, PlayCircle, Search, Lightbulb, Brain, Target } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Segment {
  timestamp_seconds?: number;
  timestamp?: string;
  speaker?: string;
  text: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  meeting: {
    id: string;
    title: string;
    created_at: string;
    duration_seconds: number;
    transcript: string;
    file_url?: string;
    speaker_mapping?: Record<string, string> | any;
    transcript_with_timestamps?: any;
    type?: 'presencial' | 'online';
    meeting_code?: string | null;
    participants?: { name: string; user_id?: string | null }[];
    skill_id?: string | null;
    skill_feedback?: string | null;
    meeting_metadata?: any;
  };
  onDownload: () => void;
}

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

const MeetingDetailModal: React.FC<Props> = ({ isOpen, onClose, meeting, onDownload }) => {
  const hasRecording = !!meeting.file_url;
  const hasTranscript = !!(meeting.transcript_with_timestamps?.length || meeting.transcript);
  const hasSkill = !!(meeting.skill_id || meeting.skill_feedback);
  const initialTab = hasRecording ? 'recording' : (hasTranscript ? 'transcript' : 'participants');
  const [tab, setTab] = useState<'recording' | 'transcript' | 'participants' | 'insights'>(initialTab as any);
  const [search, setSearch] = useState('');

  React.useEffect(() => { setTab(initialTab as any); setSearch(''); }, [meeting.id, initialTab]);

  const segments: Segment[] = useMemo(() => {
    if (Array.isArray(meeting.transcript_with_timestamps) && meeting.transcript_with_timestamps.length) {
      return meeting.transcript_with_timestamps as Segment[];
    }
    if (!meeting.transcript) return [];
    return meeting.transcript.split(/\n+/).filter(Boolean).map(line => ({ text: line }));
  }, [meeting]);

  const mapping = (meeting.speaker_mapping || {}) as Record<string, string>;

  const filteredSegments = useMemo(() => {
    if (!search.trim()) return segments;
    const q = search.toLowerCase();
    return segments.filter(s => s.text?.toLowerCase().includes(q));
  }, [segments, search]);

  const speakerColor = (name: string) => {
    const palette = ['#374DA4', '#007DE3', '#0055D4', '#059669', '#7C3AED', '#DB2777', '#D97706'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % palette.length;
    return palette[h];
  };

  const participants = meeting.participants || [];
  const isOnline = meeting.type === 'online';
  const accent = isOnline ? '#007DE3' : '#374DA4';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[88vh] p-0 bg-background border-border rounded-[28px] overflow-hidden flex flex-col text-foreground">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="p-2.5 rounded-2xl shrink-0 border" style={{ background: `${accent}15`, borderColor: `${accent}30`, color: accent }}>
              {isOnline ? <Video className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <h2 className="text-lg font-bold truncate">
                  {meeting.meeting_code
                    ? `Reunião ${meeting.meeting_code} · ${new Date(meeting.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`
                    : (meeting.title || `Reunião ${new Date(meeting.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`)}
                </h2>
                <Badge className="text-[10px] uppercase tracking-wide border-none font-bold" style={{ background: `${accent}20`, color: accent }}>
                  {isOnline ? 'Online' : 'Presencial'}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3 text-muted-foreground/50" />{new Date(meeting.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
                <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-muted-foreground/50" />{new Date(meeting.created_at).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}</span>
                {meeting.duration_seconds > 0 && <span className="text-muted-foreground">{fmtTime(meeting.duration_seconds)}</span>}
                {participants.length > 0 && <span className="flex items-center gap-1.5"><Users className="w-3 h-3 text-muted-foreground/50" />{participants.length}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasTranscript && (
              <Button onClick={onDownload} size="sm" className="rounded-xl bg-[#374DA4] text-white hover:bg-[#374DA4]/90 gap-1.5 shadow-sm border-none">
                <Download className="w-3.5 h-3.5" /> Baixar
              </Button>
            )}
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted text-muted-foreground/50"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-border shrink-0 flex gap-1">
          {hasRecording && (
            <button onClick={() => setTab('recording')}
              className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-t-lg transition-colors flex items-center gap-1.5 ${tab === 'recording' ? 'bg-muted text-foreground border-b-2 border-[#007DE3]' : 'text-muted-foreground hover:text-foreground/70 bg-transparent'}`}>
              <PlayCircle className="w-3.5 h-3.5" /> Gravação
            </button>
          )}
          <button onClick={() => setTab('transcript')}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-t-lg transition-colors flex items-center gap-1.5 ${tab === 'transcript' ? 'bg-muted text-foreground border-b-2 border-[#374DA4]' : 'text-muted-foreground hover:text-foreground/70 bg-transparent'}`}>
            <FileText className="w-3.5 h-3.5" /> Transcrição
          </button>
          {hasSkill && (
            <button onClick={() => setTab('insights')}
              className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-t-lg transition-colors flex items-center gap-1.5 ${tab === 'insights' ? 'bg-muted text-foreground border-b-2 border-amber-500' : 'text-muted-foreground hover:text-foreground/70 bg-transparent'}`}>
              <Brain className="w-3.5 h-3.5" /> Insights IA
            </button>
          )}
          <button onClick={() => setTab('participants')}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-t-lg transition-colors flex items-center gap-1.5 ${tab === 'participants' ? 'bg-muted text-foreground border-b-2 border-emerald-600' : 'text-muted-foreground hover:text-foreground/70 bg-transparent'}`}>
            <Users className="w-3.5 h-3.5" /> Participantes ({participants.length})
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {tab === 'recording' && (
            <div className="p-6">
              {hasRecording ? (
                <div className="space-y-4">
                  <video src={meeting.file_url} controls className="w-full rounded-2xl bg-black aspect-video" />
                  <div className="flex items-center justify-between gap-3 px-1">
                    <div className="text-xs text-muted-foreground/40">Arquivo da reunião gravado pelo LiveKit</div>
                    <a href={meeting.file_url} download target="_blank" rel="noreferrer"
                      className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground flex items-center gap-1.5 border border-border shadow-sm">
                      <Download className="w-3 h-3" /> Baixar vídeo
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 text-muted-foreground/40">
                  <Video className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Sem gravação disponível para esta reunião</p>
                </div>
              )}
            </div>
          )}

          {tab === 'transcript' && (
            <div className="flex flex-col h-full">
              <div className="px-6 py-3 border-b border-border shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/30" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar na transcrição..."
                    className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground/30 rounded-xl focus-visible:ring-[#374DA4]/40 shadow-sm" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {filteredSegments.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground/40">
                    <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">{search ? 'Nenhum resultado para esta busca' : 'Sem transcrição disponível'}</p>
                  </div>
                ) : (
                  filteredSegments.map((seg, i) => {
                    const speakerName = seg.speaker ? (mapping[seg.speaker] || seg.speaker) : null;
                    const color = speakerName ? speakerColor(speakerName) : '#666';
                    const time = seg.timestamp_seconds != null
                      ? fmtTime(seg.timestamp_seconds)
                      : (seg.timestamp ? new Date(seg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
                    return (
                      <div key={i} className="flex gap-3 group">
                        <div className="shrink-0 w-12 text-[10px] text-muted-foreground/30 font-mono pt-1.5">{time}</div>
                        <div className="flex-1 min-w-0">
                          {speakerName && (
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>{speakerName}</span>
                            </div>
                          )}
                          <p className="text-sm text-foreground/85 leading-relaxed">{seg.text}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {tab === 'participants' && (
            <div className="p-6">
              {participants.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground/40">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Nenhum participante registrado</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {participants.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card border border-border shadow-sm">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-inner border-none"
                        style={{ background: `hsl(${(p.name.charCodeAt(0) * 37) % 360}, 60%, 45%)` }}>
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground/40">{p.user_id ? 'Membro' : 'Convidado'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'insights' && (
            <div className="p-8 max-w-3xl mx-auto">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">Insights Estratégicos</h3>
                  <p className="text-sm text-muted-foreground/40">Análise gerada pela inteligência artificial durante a reunião</p>
                </div>
              </div>

              {meeting.skill_id && (
                <div className="mb-6 p-4 rounded-2xl bg-card border border-border shadow-sm flex items-center gap-4">
                  <div className="p-2 rounded-xl bg-[#374DA4]/10 text-[#374DA4]">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/40">Skill Ativada</div>
                    <div className="text-sm font-semibold">{meeting.skill_id}</div>
                  </div>
                </div>
              )}

              {meeting.skill_feedback ? (
                <div className="space-y-4">
                  <div className="prose prose-sm max-w-none">
                    <div className="bg-card border border-border shadow-sm rounded-3xl p-6 leading-relaxed text-foreground/90 whitespace-pre-wrap">
                      {meeting.skill_feedback}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 bg-card border border-dashed border-border rounded-3xl shadow-sm">
                  <Lightbulb className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground/40">Nenhum insight específico gerado para esta sessão</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MeetingDetailModal;
