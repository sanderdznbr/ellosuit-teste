import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Download, Calendar, Clock, X, FileText, Sparkles } from 'lucide-react';

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
    speaker_mapping?: Record<string, string> | any;
    transcript_with_timestamps?: any;
    type?: 'presencial' | 'online';
  };
  onDownload: () => void;
}

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

const MeetingTranscriptViewModal: React.FC<Props> = ({ isOpen, onClose, meeting, onDownload }) => {
  const [search, setSearch] = useState('');

  const segments: Segment[] = useMemo(() => {
    if (Array.isArray(meeting.transcript_with_timestamps) && meeting.transcript_with_timestamps.length) {
      return meeting.transcript_with_timestamps as Segment[];
    }
    if (!meeting.transcript) return [];
    return meeting.transcript.split(/\n+/).filter(Boolean).map(line => ({ text: line }));
  }, [meeting]);

  const mapping = (meeting.speaker_mapping || {}) as Record<string, string>;

  const filtered = useMemo(() => {
    if (!search.trim()) return segments;
    const q = search.toLowerCase();
    return segments.filter(s =>
      s.text?.toLowerCase().includes(q) ||
      (mapping[s.speaker || ''] || s.speaker || '').toLowerCase().includes(q)
    );
  }, [segments, search, mapping]);

  const speakers = useMemo(() => {
    const set = new Set<string>();
    segments.forEach(s => s.speaker && set.add(mapping[s.speaker] || s.speaker));
    return Array.from(set);
  }, [segments, mapping]);

  const speakerColor = (name: string) => {
    const palette = ['#374DA4', '#007DE3', '#0055D4', '#2ECC71', '#9333EA', '#EC4899', '#F59E0B'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % palette.length;
    return palette[h];
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl h-[85vh] p-0 bg-[#faf9f7] border-black/5 rounded-3xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-black/5 flex items-start justify-between gap-4 shrink-0 bg-white">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="p-2.5 rounded-2xl bg-[#374DA4]/10 text-[#374DA4] shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <h2 className="text-lg font-bold text-black truncate">{meeting.title}</h2>
                {meeting.type && (
                  <Badge className="text-[10px] bg-black/5 text-black/60 border-none uppercase tracking-wide">
                    {meeting.type === 'online' ? 'Online' : 'Presencial'}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-black/40">
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />
                  {new Date(meeting.created_at).toLocaleDateString('pt-BR')}
                </span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />
                  {new Date(meeting.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                {meeting.duration_seconds > 0 && (
                  <span>{fmtTime(meeting.duration_seconds)}</span>
                )}
                {speakers.length > 0 && (
                  <span>{speakers.length} {speakers.length === 1 ? 'voz' : 'vozes'}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button onClick={onDownload} size="sm" className="rounded-xl bg-[#374DA4] hover:bg-[#374DA4]/90 text-white gap-1.5 shadow-sm">
              <Download className="w-3.5 h-3.5" /> Baixar
            </Button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-black/5 text-black/40">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-black/5 bg-white shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar na transcrição..."
              className="pl-10 bg-black/5 border-black/5 text-black placeholder:text-black/30 rounded-xl focus-visible:ring-[#374DA4]/40"
            />
          </div>
        </div>

        {/* Transcript */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-black/20">
              <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">{search ? 'Nenhum resultado para esta busca' : 'Sem transcrição disponível'}</p>
            </div>
          ) : (
            filtered.map((seg, i) => {
              const speakerName = seg.speaker ? (mapping[seg.speaker] || seg.speaker) : null;
              const color = speakerName ? speakerColor(speakerName) : '#666';
              const time = seg.timestamp_seconds != null
                ? fmtTime(seg.timestamp_seconds)
                : (seg.timestamp ? new Date(seg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');
              return (
                <div key={i} className="flex gap-3 group">
                  <div className="shrink-0 w-12 text-[10px] text-black/30 font-mono pt-1.5">{time}</div>
                  <div className="flex-1 min-w-0">
                    {speakerName && (
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>
                          {speakerName}
                        </span>
                      </div>
                    )}
                    <p className="text-sm text-black/80 leading-relaxed">{seg.text}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MeetingTranscriptViewModal;