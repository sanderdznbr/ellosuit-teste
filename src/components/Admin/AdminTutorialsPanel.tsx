import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, Pencil, Trash2, Video, FolderOpen, Play, Upload, Loader2,
  GripVertical, Eye, EyeOff, BookOpen, MessageSquare, Calendar, BarChart3
} from 'lucide-react';

const SUITE_COLOR = '#374DA4';

interface TutorialCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
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

const iconMap: Record<string, React.ReactNode> = {
  MessageSquare: <MessageSquare className="h-4 w-4" />,
  Calendar: <Calendar className="h-4 w-4" />,
  BarChart3: <BarChart3 className="h-4 w-4" />,
  BookOpen: <BookOpen className="h-4 w-4" />,
};

const AdminTutorialsPanel: React.FC = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<TutorialCategory[]>([]);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tutorials');

  // Tutorial dialog state
  const [showTutorialDialog, setShowTutorialDialog] = useState(false);
  const [editingTutorial, setEditingTutorial] = useState<Tutorial | null>(null);
  const [tutorialForm, setTutorialForm] = useState({
    title: '', description: '', video_url: '', category_id: '', is_published: false,
    thumbnail_url: '', duration_seconds: 0,
  });
  const [uploading, setUploading] = useState(false);

  // Category dialog state
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TutorialCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '', slug: '', description: '', icon: 'BookOpen', color: '#374DA4',
  });

  // Video player state
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [catRes, tutRes] = await Promise.all([
      supabase.from('tutorial_categories').select('*').order('sort_order'),
      supabase.from('tutorials').select('*, tutorial_categories(*)').order('sort_order'),
    ]);
    if (catRes.data) setCategories(catRes.data);
    if (tutRes.data) setTutorials(tutRes.data as any);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ============== CATEGORY CRUD ==============
  const openCategoryDialog = (cat?: TutorialCategory) => {
    if (cat) {
      setEditingCategory(cat);
      setCategoryForm({ name: cat.name, slug: cat.slug, description: cat.description || '', icon: cat.icon || 'BookOpen', color: cat.color || '#374DA4' });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: '', slug: '', description: '', icon: 'BookOpen', color: '#374DA4' });
    }
    setShowCategoryDialog(true);
  };

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) return;
    const slug = categoryForm.slug.trim() || categoryForm.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const payload = { ...categoryForm, slug };

    if (editingCategory) {
      const { error } = await supabase.from('tutorial_categories').update(payload).eq('id', editingCategory.id);
      if (error) { toast.error('Erro ao atualizar categoria'); return; }
      toast.success('Categoria atualizada');
    } else {
      const { error } = await supabase.from('tutorial_categories').insert({ ...payload, sort_order: categories.length });
      if (error) { toast.error('Erro ao criar categoria: ' + error.message); return; }
      toast.success('Categoria criada');
    }
    setShowCategoryDialog(false);
    fetchData();
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Excluir categoria e todos os tutoriais dela?')) return;
    const { error } = await supabase.from('tutorial_categories').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Categoria excluída');
    fetchData();
  };

  // ============== TUTORIAL CRUD ==============
  const openTutorialDialog = (tut?: Tutorial) => {
    if (tut) {
      setEditingTutorial(tut);
      setTutorialForm({
        title: tut.title, description: tut.description || '', video_url: tut.video_url,
        category_id: tut.category_id, is_published: tut.is_published,
        thumbnail_url: tut.thumbnail_url || '', duration_seconds: tut.duration_seconds || 0,
      });
    } else {
      setEditingTutorial(null);
      setTutorialForm({
        title: '', description: '', video_url: '', category_id: categories[0]?.id || '',
        is_published: false, thumbnail_url: '', duration_seconds: 0,
      });
    }
    setShowTutorialDialog(true);
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `videos/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('tutorials').upload(path, file, { contentType: file.type, upsert: true });
    if (error) { toast.error('Erro no upload: ' + error.message); setUploading(false); return; }
    const { data: pub } = supabase.storage.from('tutorials').getPublicUrl(path);
    setTutorialForm(f => ({ ...f, video_url: pub.publicUrl }));
    setUploading(false);
    toast.success('Vídeo enviado com sucesso');
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop();
    const path = `thumbnails/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('tutorials').upload(path, file, { contentType: file.type, upsert: true });
    if (error) { toast.error('Erro no upload'); return; }
    const { data: pub } = supabase.storage.from('tutorials').getPublicUrl(path);
    setTutorialForm(f => ({ ...f, thumbnail_url: pub.publicUrl }));
  };

  const saveTutorial = async () => {
    if (!tutorialForm.title.trim() || !tutorialForm.video_url.trim() || !tutorialForm.category_id) {
      toast.error('Preencha título, vídeo e categoria'); return;
    }
    const payload = {
      title: tutorialForm.title,
      description: tutorialForm.description || null,
      video_url: tutorialForm.video_url,
      category_id: tutorialForm.category_id,
      is_published: tutorialForm.is_published,
      thumbnail_url: tutorialForm.thumbnail_url || null,
      duration_seconds: tutorialForm.duration_seconds || null,
    };

    if (editingTutorial) {
      const { error } = await supabase.from('tutorials').update(payload).eq('id', editingTutorial.id);
      if (error) { toast.error('Erro ao atualizar'); return; }
      toast.success('Tutorial atualizado');
    } else {
      const { error } = await supabase.from('tutorials').insert({
        ...payload, created_by: user!.id, sort_order: tutorials.length,
      });
      if (error) { toast.error('Erro ao criar: ' + error.message); return; }
      toast.success('Tutorial criado');
    }
    setShowTutorialDialog(false);
    fetchData();
  };

  const deleteTutorial = async (id: string) => {
    if (!confirm('Excluir tutorial?')) return;
    const { error } = await supabase.from('tutorials').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Tutorial excluído');
    fetchData();
  };

  const togglePublished = async (tut: Tutorial) => {
    await supabase.from('tutorials').update({ is_published: !tut.is_published }).eq('id', tut.id);
    fetchData();
  };

  const filteredTutorials = selectedCategory === 'all'
    ? tutorials
    : tutorials.filter(t => t.category_id === selectedCategory);

  const formatDuration = (s: number | null) => {
    if (!s) return '';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tutoriais em Vídeo</h1>
          <p className="text-sm text-muted-foreground">Gerencie os tutoriais exibidos para os usuários da plataforma</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1">
            <Video className="h-3.5 w-3.5" /> {tutorials.length} tutoriais
          </Badge>
          <Badge variant="outline" className="gap-1">
            <FolderOpen className="h-3.5 w-3.5" /> {categories.length} categorias
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="rounded-xl">
          <TabsTrigger value="tutorials" className="rounded-xl gap-2"><Video className="h-4 w-4" /> Tutoriais</TabsTrigger>
          <TabsTrigger value="categories" className="rounded-xl gap-2"><FolderOpen className="h-4 w-4" /> Categorias</TabsTrigger>
        </TabsList>

        {/* ==================== TUTORIALS TAB ==================== */}
        <TabsContent value="tutorials" className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                className="rounded-xl"
                onClick={() => setSelectedCategory('all')}
              >
                Todos
              </Button>
              {categories.map(cat => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-xl gap-1.5"
                  onClick={() => setSelectedCategory(cat.id)}
                  style={selectedCategory === cat.id ? { backgroundColor: cat.color || SUITE_COLOR } : {}}
                >
                  {iconMap[cat.icon || ''] || <BookOpen className="h-3.5 w-3.5" />}
                  {cat.name}
                </Button>
              ))}
            </div>
            <Button onClick={() => openTutorialDialog()} className="rounded-xl gap-2 text-white" style={{ backgroundColor: SUITE_COLOR }}>
              <Plus className="h-4 w-4" /> Novo Tutorial
            </Button>
          </div>

          {filteredTutorials.length === 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="py-16 text-center text-muted-foreground">
                <Video className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum tutorial encontrado</p>
                <p className="text-sm">Clique em "Novo Tutorial" para adicionar</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTutorials.map(tut => {
                const cat = categories.find(c => c.id === tut.category_id);
                return (
                  <Card key={tut.id} className="rounded-2xl overflow-hidden group hover:shadow-lg transition-shadow">
                    {/* Video Thumbnail / Player */}
                    <div className="relative aspect-video bg-muted">
                      {playingVideo === tut.id ? (
                        <video
                          src={tut.video_url}
                          controls
                          autoPlay
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <>
                          {tut.thumbnail_url ? (
                            <img src={tut.thumbnail_url} alt={tut.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: (cat?.color || SUITE_COLOR) + '15' }}>
                              <Video className="h-12 w-12 opacity-20" style={{ color: cat?.color || SUITE_COLOR }} />
                            </div>
                          )}
                          <button
                            onClick={() => setPlayingVideo(tut.id)}
                            className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                              <Play className="h-6 w-6 ml-0.5" style={{ color: SUITE_COLOR }} />
                            </div>
                          </button>
                          {tut.duration_seconds ? (
                            <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                              {formatDuration(tut.duration_seconds)}
                            </span>
                          ) : null}
                        </>
                      )}
                      {/* Status badge */}
                      <div className="absolute top-2 left-2">
                        <Badge className={tut.is_published ? 'bg-emerald-500 text-white' : 'bg-yellow-500 text-white'}>
                          {tut.is_published ? 'Publicado' : 'Rascunho'}
                        </Badge>
                      </div>
                    </div>

                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm truncate">{tut.title}</h3>
                          {tut.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{tut.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        {cat && (
                          <Badge variant="outline" className="gap-1 text-[10px]" style={{ borderColor: cat.color || SUITE_COLOR, color: cat.color || SUITE_COLOR }}>
                            {iconMap[cat.icon || ''] || <BookOpen className="h-3 w-3" />}
                            {cat.name}
                          </Badge>
                        )}
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePublished(tut)}>
                            {tut.is_published ? <Eye className="h-3.5 w-3.5 text-emerald-500" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openTutorialDialog(tut)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTutorial(tut.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ==================== CATEGORIES TAB ==================== */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openCategoryDialog()} className="rounded-xl gap-2 text-white" style={{ backgroundColor: SUITE_COLOR }}>
              <Plus className="h-4 w-4" /> Nova Categoria
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(cat => {
              const tutCount = tutorials.filter(t => t.category_id === cat.id).length;
              return (
                <Card key={cat.id} className="rounded-2xl">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: (cat.color || SUITE_COLOR) + '20' }}>
                        <span style={{ color: cat.color || SUITE_COLOR }}>
                          {iconMap[cat.icon || ''] || <BookOpen className="h-5 w-5" />}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm">{cat.name}</h3>
                        <p className="text-xs text-muted-foreground">{tutCount} tutorial{tutCount !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCategoryDialog(cat)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCategory(cat.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {cat.description && (
                      <p className="text-xs text-muted-foreground mt-2">{cat.description}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* ==================== TUTORIAL DIALOG ==================== */}
      <Dialog open={showTutorialDialog} onOpenChange={setShowTutorialDialog}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTutorial ? 'Editar Tutorial' : 'Novo Tutorial'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 p-1">
              <div>
                <Label>Título *</Label>
                <Input value={tutorialForm.title} onChange={e => setTutorialForm(f => ({ ...f, title: e.target.value }))} className="rounded-xl mt-1" placeholder="Ex: Como criar um contato no CRM" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea value={tutorialForm.description} onChange={e => setTutorialForm(f => ({ ...f, description: e.target.value }))} className="rounded-xl mt-1" rows={3} placeholder="Breve descrição do tutorial..." />
              </div>
              <div>
                <Label>Categoria *</Label>
                <Select value={tutorialForm.category_id} onValueChange={v => setTutorialForm(f => ({ ...f, category_id: v }))}>
                  <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vídeo *</Label>
                <div className="mt-1 space-y-2">
                  <Input value={tutorialForm.video_url} onChange={e => setTutorialForm(f => ({ ...f, video_url: e.target.value }))} className="rounded-xl" placeholder="Cole a URL do vídeo ou faça upload" />
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                      <Button type="button" variant="outline" className="rounded-xl w-full gap-2" onClick={() => document.querySelector<HTMLInputElement>('input[accept="video/*"]')?.click()} disabled={uploading}>
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {uploading ? 'Enviando...' : 'Upload Vídeo'}
                      </Button>
                    </label>
                  </div>
                  {tutorialForm.video_url && (
                    <video src={tutorialForm.video_url} controls className="w-full rounded-xl aspect-video bg-black" />
                  )}
                </div>
              </div>
              <div>
                <Label>Thumbnail (opcional)</Label>
                <div className="mt-1 space-y-2">
                  <Input value={tutorialForm.thumbnail_url} onChange={e => setTutorialForm(f => ({ ...f, thumbnail_url: e.target.value }))} className="rounded-xl" placeholder="URL da imagem de capa" />
                  <label>
                    <input type="file" accept="image/*" className="hidden" onChange={handleThumbnailUpload} />
                    <Button type="button" variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => document.querySelector<HTMLInputElement>('input[accept="image/*"]')?.click()}>
                      <Upload className="h-3.5 w-3.5" /> Upload Thumbnail
                    </Button>
                  </label>
                </div>
              </div>
              <div>
                <Label>Duração (segundos)</Label>
                <Input type="number" value={tutorialForm.duration_seconds || ''} onChange={e => setTutorialForm(f => ({ ...f, duration_seconds: parseInt(e.target.value) || 0 }))} className="rounded-xl mt-1" placeholder="Ex: 180 (3 minutos)" />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={tutorialForm.is_published} onCheckedChange={v => setTutorialForm(f => ({ ...f, is_published: v }))} />
                <Label className="cursor-pointer">Publicar imediatamente</Label>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTutorialDialog(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={saveTutorial} className="rounded-xl text-white" style={{ backgroundColor: SUITE_COLOR }}>
              {editingTutorial ? 'Salvar' : 'Criar Tutorial'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== CATEGORY DIALOG ==================== */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={categoryForm.name} onChange={e => setCategoryForm(f => ({ ...f, name: e.target.value }))} className="rounded-xl mt-1" placeholder="Ex: Omni" />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={categoryForm.slug} onChange={e => setCategoryForm(f => ({ ...f, slug: e.target.value }))} className="rounded-xl mt-1" placeholder="omni (gerado automaticamente)" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={categoryForm.description} onChange={e => setCategoryForm(f => ({ ...f, description: e.target.value }))} className="rounded-xl mt-1" rows={2} />
            </div>
            <div>
              <Label>Ícone</Label>
              <Select value={categoryForm.icon} onValueChange={v => setCategoryForm(f => ({ ...f, icon: v }))}>
                <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="MessageSquare">💬 MessageSquare</SelectItem>
                  <SelectItem value="Calendar">📅 Calendar</SelectItem>
                  <SelectItem value="BarChart3">📊 BarChart3</SelectItem>
                  <SelectItem value="BookOpen">📖 BookOpen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cor</Label>
              <Input type="color" value={categoryForm.color} onChange={e => setCategoryForm(f => ({ ...f, color: e.target.value }))} className="rounded-xl mt-1 h-10 w-20" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={saveCategory} disabled={!categoryForm.name.trim()} className="rounded-xl text-white" style={{ backgroundColor: SUITE_COLOR }}>
              {editingCategory ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTutorialsPanel;
