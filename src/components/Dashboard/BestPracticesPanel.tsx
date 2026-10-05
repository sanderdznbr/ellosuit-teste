import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, PlayCircle, Search, Send, Trash2, Play } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface TutorialCategory {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  sort_order: number;
  is_active: boolean;
}

interface Tutorial {
  id: string;
  category_id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  tutorial_categories?: TutorialCategory;
}

interface Comment {
  id: string;
  tutorial_id: string;
  user_id: string;
  author_name: string | null;
  author_avatar: string | null;
  content: string;
  created_at: string;
}

interface BestPracticesPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const isDirectVideo = (url: string) => /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
const getEmbedUrl = (url: string) => {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1`;
  return url;
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString('pt-BR');
};

export const BestPracticesPanel = ({ isOpen, onOpenChange }: BestPracticesPanelProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedVideo, setSelectedVideo] = useState<Tutorial | null>(null);
  const [categories, setCategories] = useState<TutorialCategory[]>([]);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const panelRef = useRef<HTMLDivElement>(null);
  const { isMobile } = useIsMobile();
  const { user } = useAuth();

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    Promise.all([
      supabase.from('tutorial_categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('tutorials').select('*, tutorial_categories(*)').eq('is_published', true).order('sort_order'),
    ]).then(([catRes, tutRes]) => {
      if (catRes.data) setCategories(catRes.data as TutorialCategory[]);
      if (tutRes.data) setTutorials(tutRes.data as Tutorial[]);
      setLoading(false);
    });
  }, [isOpen]);

  // Quando vídeo abre, fecha Knowledge Hub
  useEffect(() => {
    if (selectedVideo && isOpen) onOpenChange(false);
  }, [selectedVideo]);

  const loadComments = useCallback(async (tutorialId: string) => {
    const { data } = await supabase
      .from('tutorial_comments')
      .select('*')
      .eq('tutorial_id', tutorialId)
      .order('created_at', { ascending: false });
    if (data) setComments(data as Comment[]);
  }, []);

  useEffect(() => {
    if (selectedVideo) {
      loadComments(selectedVideo.id);
    } else {
      setComments([]);
      setNewComment('');
    }
  }, [selectedVideo, loadComments]);

  const submitComment = async () => {
    if (!user || !selectedVideo || !newComment.trim()) return;
    setSubmittingComment(true);
    const author_name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário';
    const author_avatar = user.user_metadata?.avatar_url || null;
    const { error } = await supabase.from('tutorial_comments').insert({
      tutorial_id: selectedVideo.id,
      user_id: user.id,
      author_name,
      author_avatar,
      content: newComment.trim(),
    });
    setSubmittingComment(false);
    if (error) {
      toast.error('Erro ao enviar comentário');
      return;
    }
    setNewComment('');
    loadComments(selectedVideo.id);
  };

  const deleteComment = async (id: string) => {
    const { error } = await supabase.from('tutorial_comments').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    if (selectedVideo) loadComments(selectedVideo.id);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isOpen && e.deltaY < -30) {
      if (panelRef.current && panelRef.current.scrollTop <= 0) onOpenChange(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedVideo) setSelectedVideo(null);
        else if (isOpen) onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onOpenChange, selectedVideo]);

  const filteredTutorials = tutorials.filter(t =>
    (selectedCategory === 'all' || t.category_id === selectedCategory) &&
    (t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-[90] bg-black/10 backdrop-blur-md pointer-events-auto"
          />
        )}
      </AnimatePresence>

      <div className={`fixed bottom-0 left-0 right-0 z-[100] flex flex-col items-center pointer-events-none ${isMobile && !isOpen ? 'hidden' : 'flex'}`}>
        <AnimatePresence initial={false}>
          <motion.div
            initial={{ y: 'calc(100% - 8px)' }}
            animate={{ y: isOpen ? 0 : 'calc(100% - 8px)' }}
            transition={{ type: 'spring', damping: 40, stiffness: 350 }}
            className={`pointer-events-auto w-full h-[95vh] shadow-[0_-20px_80px_rgba(0,0,0,0.1)] rounded-t-[3.5rem] flex flex-col border-t border-black/5 relative cursor-default ${
              isDark ? 'bg-[#F9FAFB] text-[#111827]' : 'bg-white text-[#111827]'
            }`}
          >
            <div
              onClick={() => onOpenChange(!isOpen)}
              className="h-10 w-full flex items-center justify-center cursor-pointer hover:bg-black/[0.02] transition-colors group shrink-0"
            >
              <div className={`w-16 h-1 rounded-full ${isDark ? 'bg-black/10' : 'bg-black/5'} group-hover:bg-black/20 transition-all`} />
            </div>

            <div className="px-12 py-8 space-y-8">
              <div className="flex items-center justify-between gap-4">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
                  <input
                    type="text"
                    placeholder="Buscar tutorial..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-black/[0.03] rounded-2xl text-sm border-none focus:ring-1 focus:ring-black/10 transition-all outline-none"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-[500px]">
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        selectedCategory === 'all'
                          ? 'bg-black text-white shadow-lg'
                          : 'bg-black/[0.04] text-black/40 hover:bg-black/[0.07]'
                      }`}
                    >
                      Todos
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                          selectedCategory === cat.id
                            ? 'bg-black text-white shadow-lg'
                            : 'bg-black/[0.04] text-black/40 hover:bg-black/[0.07]'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => onOpenChange(false)}
                    className="p-2.5 rounded-full hover:bg-black/5 transition-all opacity-40 hover:opacity-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            <div
              ref={panelRef}
              onWheel={handleWheel}
              className="flex-1 overflow-y-auto px-12 pb-24 custom-scrollbar"
            >
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="aspect-video rounded-[2rem] bg-black/[0.04] animate-pulse" />
                  ))}
                </div>
              ) : filteredTutorials.length === 0 ? (
                <div className="text-center py-20">
                  <PlayCircle className="h-12 w-12 text-black/20 mx-auto mb-4" />
                  <p className="text-sm text-black/40">Nenhum tutorial disponível ainda</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {filteredTutorials.map((item) => (
                    <motion.div
                      layout
                      key={item.id}
                      onClick={() => setSelectedVideo(item)}
                      className="group cursor-pointer"
                    >
                      <div className={`aspect-video rounded-[2rem] overflow-hidden border border-black/[0.03] shadow-sm transition-all duration-500 group-hover:shadow-xl group-hover:scale-[1.02] relative ${
                        isDark ? 'bg-white' : 'bg-white'
                      }`}>
                        {item.thumbnail_url ? (
                          <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <PlayCircle className="h-10 w-10 opacity-20" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <div className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xl">
                            <Play className="h-5 w-5 text-black ml-0.5" />
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 px-1">
                        <h3 className="text-sm font-semibold line-clamp-2">{item.title}</h3>
                        {item.tutorial_categories && (
                          <span
                            className="inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md"
                            style={{
                              backgroundColor: `${item.tutorial_categories.color || '#374DA4'}18`,
                              color: item.tutorial_categories.color || '#374DA4',
                            }}
                          >
                            {item.tutorial_categories.name}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Video Player Popup */}
      <Dialog open={!!selectedVideo} onOpenChange={(o) => !o && setSelectedVideo(null)}>
        <DialogContent
          className="!max-w-[1200px] w-[95vw] p-0 overflow-hidden bg-background rounded-3xl border-none z-[200] gap-0"
          style={{ backdropFilter: 'blur(40px)' }}
        >
          {selectedVideo && (
            <div className="flex flex-col lg:flex-row max-h-[90vh]">
              {/* Player */}
              <div className="flex-1 bg-black flex items-center justify-center lg:rounded-l-3xl overflow-hidden">
                <div className="w-full aspect-video">
                  {isDirectVideo(selectedVideo.video_url) ? (
                    <video src={selectedVideo.video_url} controls autoPlay className="w-full h-full" />
                  ) : (
                    <iframe
                      src={getEmbedUrl(selectedVideo.video_url)}
                      className="w-full h-full border-none"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                </div>
              </div>

              {/* Sidebar */}
              <aside className="w-full lg:w-[380px] shrink-0 flex flex-col border-l border-border bg-card overflow-hidden">
                <div className="p-5 border-b border-border">
                  <h2 className="text-base font-bold leading-tight text-foreground">{selectedVideo.title}</h2>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {selectedVideo.tutorial_categories && (
                      <Badge
                        variant="secondary"
                        className="text-[10px]"
                        style={{
                          backgroundColor: `${selectedVideo.tutorial_categories.color || '#374DA4'}18`,
                          color: selectedVideo.tutorial_categories.color || '#374DA4',
                        }}
                      >
                        {selectedVideo.tutorial_categories.name}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(selectedVideo.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  {selectedVideo.description && (
                    <p className="text-xs text-muted-foreground mt-3 leading-relaxed whitespace-pre-wrap">
                      {selectedVideo.description}
                    </p>
                  )}
                </div>

                {/* Comments */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="px-5 pt-4 pb-2 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    Comentários ({comments.length})
                  </div>
                  <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-3 custom-scrollbar">
                    {comments.length === 0 ? (
                      <p className="text-xs text-muted-foreground/60 text-center py-8">
                        Seja o primeiro a comentar
                      </p>
                    ) : (
                      comments.map(c => (
                        <div key={c.id} className="flex gap-2.5 group">
                          <Avatar className="h-7 w-7 shrink-0">
                            {c.author_avatar && <AvatarImage src={c.author_avatar} />}
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {(c.author_name || 'U').substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-foreground truncate">
                                {c.author_name || 'Usuário'}
                              </span>
                              <span className="text-[10px] text-muted-foreground">{formatDate(c.created_at)}</span>
                              {user?.id === c.user_id && (
                                <button
                                  onClick={() => deleteComment(c.id)}
                                  className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-foreground/90 mt-0.5 whitespace-pre-wrap break-words">{c.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Input */}
                  {user && (
                    <div className="p-3 border-t border-border bg-muted/30">
                      <div className="flex gap-2 items-end">
                        <textarea
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              submitComment();
                            }
                          }}
                          placeholder="Adicione um comentário..."
                          rows={1}
                          className="flex-1 resize-none rounded-xl bg-background border border-border px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary/30 max-h-24"
                        />
                        <Button
                          size="icon"
                          onClick={submitComment}
                          disabled={!newComment.trim() || submittingComment}
                          className="h-9 w-9 shrink-0 rounded-xl"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
