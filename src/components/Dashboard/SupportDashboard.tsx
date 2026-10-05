import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Play, MessageCircle, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface TutorialCategory {
  id: string;
  name: string;
  icon: string | null;
  color: string;
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

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const SupportDashboard = () => {
  const [categories, setCategories] = useState<TutorialCategory[]>([]);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<Tutorial | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [catRes, tutRes] = await Promise.all([
      supabase.from('tutorial_categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('tutorials').select('*, tutorial_categories(*)').eq('is_published', true).order('sort_order'),
    ]);
    if (catRes.data) setCategories(catRes.data as TutorialCategory[]);
    if (tutRes.data) setTutorials(tutRes.data as Tutorial[]);
    setLoading(false);
  };

  const filtered = tutorials.filter(t => {
    const matchesCategory = !selectedCategory || t.category_id === selectedCategory;
    const matchesSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getEmbedUrl = (url: string) => {
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?]+)/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`;
    return url;
  };

  const isDirectVideo = (url: string) => {
    return url.match(/\.(mp4|webm|ogg)(\?|$)/i);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-2 pb-24 md:py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">Central de Ajuda</h1>
          <p className="text-xs text-muted-foreground">Tutoriais em vídeo para dominar a plataforma</p>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tutorial..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {categories.length > 0 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                !selectedCategory
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
                style={{
                  backgroundColor: selectedCategory === cat.id ? cat.color : 'hsl(var(--muted))',
                  color: selectedCategory === cat.id ? 'white' : 'hsl(var(--muted-foreground))',
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="rounded-2xl border border-border/60 bg-card overflow-hidden animate-pulse">
                <div className="aspect-video bg-muted" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Play className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? 'Nenhum tutorial encontrado' : 'Nenhum tutorial disponível ainda'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(tutorial => (
              <button
                key={tutorial.id}
                onClick={() => setSelectedVideo(tutorial)}
                className="rounded-2xl border border-border/60 bg-card overflow-hidden text-left hover:shadow-md transition-all group"
              >
                <div className="aspect-video bg-muted relative overflow-hidden">
                  {tutorial.thumbnail_url ? (
                    <img
                      src={tutorial.thumbnail_url}
                      alt={tutorial.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                      <Play className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                      <Play className="h-5 w-5 text-foreground ml-0.5" />
                    </div>
                  </div>
                  {tutorial.duration_seconds && (
                    <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                      {formatDuration(tutorial.duration_seconds)}
                    </span>
                  )}
                </div>
                <div className="p-3.5">
                  <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-tight">
                    {tutorial.title}
                  </h3>
                  {tutorial.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {tutorial.description}
                    </p>
                  )}
                  {tutorial.tutorial_categories && (
                    <Badge
                      variant="secondary"
                      className="mt-2 text-[10px] px-2 py-0 h-5"
                      style={{
                        backgroundColor: `${tutorial.tutorial_categories.color}18`,
                        color: tutorial.tutorial_categories.color,
                        borderColor: `${tutorial.tutorial_categories.color}30`,
                      }}
                    >
                      {tutorial.tutorial_categories.name}
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-12 text-center">
          <p className="text-xs text-muted-foreground mb-2">Não encontrou o que procurava?</p>
          <a
            href="https://wa.me/5541989015612?text=Olá! Preciso de ajuda com a Ellosuit."
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="gap-2 rounded-xl text-xs h-9">
              <MessageCircle className="h-3.5 w-3.5" />
              Fale conosco pelo WhatsApp
            </Button>
          </a>
        </div>
      </div>

      <Dialog open={!!selectedVideo} onOpenChange={(open) => !open && setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-2xl">
          {selectedVideo && (
            <div>
              <div className="aspect-video bg-black">
                {isDirectVideo(selectedVideo.video_url) ? (
                  <video src={selectedVideo.video_url} controls autoPlay className="w-full h-full" />
                ) : (
                  <iframe
                    src={getEmbedUrl(selectedVideo.video_url)}
                    className="w-full h-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                )}
              </div>
              <div className="p-5">
                <h2 className="text-base font-bold text-foreground">{selectedVideo.title}</h2>
                {selectedVideo.description && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedVideo.description}</p>
                )}
                {selectedVideo.tutorial_categories && (
                  <Badge
                    variant="secondary"
                    className="mt-3 text-xs"
                    style={{
                      backgroundColor: `${selectedVideo.tutorial_categories.color}18`,
                      color: selectedVideo.tutorial_categories.color,
                    }}
                  >
                    {selectedVideo.tutorial_categories.name}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupportDashboard;
