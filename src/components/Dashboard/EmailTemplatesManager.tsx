import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Edit, Copy, Trash2, Eye,
  Mail, Loader2, Palette, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useEmailDesigns } from '@/hooks/useEmailDesigns';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';

const OMNI_COLOR = '#374DA4';

interface UnifiedTemplate {
  id: string;
  name: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  thumbnail_url?: string;
  source: 'design' | 'template';
  html_content?: string;
  category?: string;
}

const EmailTemplatesManager: React.FC = () => {
  const navigate = useNavigate();
  const { designs, loading: loadingDesigns, deleteDesign, refetch: refetchDesigns } = useEmailDesigns();
  const { templates, loading: loadingTemplates, deleteTemplate, duplicateTemplate, refetch: refetchTemplates } = useEmailTemplates();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const loading = loadingDesigns || loadingTemplates;

  useEffect(() => {
    const handleFocus = () => {
      refetchDesigns();
      refetchTemplates();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchDesigns, refetchTemplates]);

  const unifiedList: UnifiedTemplate[] = [
    ...designs.map(d => ({
      id: d.id,
      name: d.name,
      is_published: d.is_published,
      created_at: d.created_at,
      updated_at: d.updated_at,
      thumbnail_url: d.thumbnail_url,
      source: 'design' as const,
    })),
    ...templates.map(t => ({
      id: t.id,
      name: t.name,
      is_published: t.is_active,
      created_at: t.created_at,
      updated_at: t.updated_at,
      source: 'template' as const,
      html_content: t.html_content,
      category: t.category,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filteredItems = unifiedList.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || 
      (filterStatus === 'published' && d.is_published) ||
      (filterStatus === 'draft' && !d.is_published);
    return matchesSearch && matchesFilter;
  });

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

  const handleDelete = async (item: UnifiedTemplate) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) return;
    if (item.source === 'design') {
      await deleteDesign(item.id);
    } else {
      await deleteTemplate(item.id);
    }
  };

  const handleEdit = (item: UnifiedTemplate) => {
    if (item.source === 'design') {
      navigate(`/dashboard/email-builder?id=${item.id}`);
    } else {
      navigate(`/dashboard/email-builder?templateId=${item.id}`);
    }
  };

  const handleDuplicate = async (item: UnifiedTemplate) => {
    if (item.source === 'template') {
      const tpl = templates.find(t => t.id === item.id);
      if (tpl) await duplicateTemplate(tpl);
    }
  };

  const handlePreview = (item: UnifiedTemplate) => {
    if (item.source === 'design') {
      navigate(`/dashboard/email-builder?id=${item.id}`);
    } else if (item.html_content) {
      setPreviewHtml(item.html_content);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map(d => d.id));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] dark:bg-[#000] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#374DA4]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#000] animate-in fade-in duration-500">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-10">
          <h1 className="text-3xl font-black text-foreground tracking-tight">Modelos de Email</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            Gerencie e crie designs exclusivos para suas comunicações.
          </p>
        </div>

        <div className="bg-white dark:bg-white/5 rounded-[2rem] border border-border/40 overflow-hidden shadow-sm">
          <div className="p-6 flex flex-col md:flex-row items-center gap-4 bg-gray-50/50 dark:bg-white/5 border-b border-border/40">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar modelos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 border-border/40 bg-white dark:bg-black/20 rounded-2xl focus:bg-white h-11"
              />
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full md:w-[160px] rounded-2xl border-border/40 bg-white dark:bg-black/20 h-11 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-border/40">
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="published">Ativos</SelectItem>
                  <SelectItem value="draft">Rascunhos</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={() => navigate('/dashboard/email-builder')}
                className="rounded-2xl gap-2 text-white h-11 px-6 font-bold shadow-lg shadow-[#374DA4]/20 hover:shadow-[#374DA4]/30 transition-all whitespace-nowrap"
                style={{ backgroundColor: OMNI_COLOR }}
              >
                <Plus className="h-4 w-4" />
                Novo Modelo
              </Button>
            </div>
          </div>

          <div className="hidden lg:grid grid-cols-[60px_1fr_120px_120px_140px_120px] gap-4 px-8 py-4 bg-gray-50/30 dark:bg-white/5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/40">
            <div className="flex items-center justify-center">
              <Checkbox 
                checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                onCheckedChange={toggleSelectAll}
                className="rounded-md border-border/40"
              />
            </div>
            <div>Nome do Modelo</div>
            <div>Categoria</div>
            <div>Status</div>
            <div>Última Edição</div>
            <div className="text-right">Ações</div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
              <div className="w-20 h-20 rounded-[2rem] bg-gray-50 dark:bg-white/5 flex items-center justify-center mb-6">
                <Palette className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Nenhum modelo encontrado</h3>
              <p className="text-sm text-muted-foreground max-w-xs mb-8 font-medium">
                {searchQuery ? 'Tente uma busca diferente ou ajuste seus filtros.' : 'Crie seu primeiro modelo de email para começar a enviar campanhas.'}
              </p>
              {!searchQuery && (
                <Button 
                  onClick={() => navigate('/dashboard/email-builder')}
                  style={{ backgroundColor: OMNI_COLOR }}
                  className="text-white rounded-2xl h-12 px-8 font-bold shadow-lg shadow-[#374DA4]/20 transition-all active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Modelo
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filteredItems.map(item => (
                <div 
                  key={`${item.source}-${item.id}`}
                  className="grid grid-cols-1 lg:grid-cols-[60px_1fr_120px_120px_140px_120px] gap-4 px-8 py-5 items-center hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors group"
                >
                  <div className="hidden lg:flex items-center justify-center">
                    <Checkbox 
                      checked={selectedItems.includes(item.id)}
                      onCheckedChange={() => toggleSelect(item.id)}
                      className="rounded-md border-border/40"
                    />
                  </div>

                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/10 flex-shrink-0 overflow-hidden flex items-center justify-center border border-border/40 group-hover:scale-105 transition-transform duration-300">
                      {item.thumbnail_url ? (
                        <img 
                          src={item.thumbnail_url} 
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Mail className="h-5 w-5 text-muted-foreground/50" />
                      )}
                    </div>
                    <div className="flex flex-col truncate">
                      <span className="font-bold text-foreground truncate">{item.name}</span>
                      <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-tighter lg:hidden mt-1">{item.source === 'design' ? 'Design' : item.category || 'Template'}</span>
                    </div>
                  </div>

                  <div className="hidden lg:block">
                    <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border-border/40 bg-gray-50/50 dark:bg-white/5 text-muted-foreground">
                      {item.source === 'design' ? 'Design' : item.category || 'Geral'}
                    </Badge>
                  </div>

                  <div className="hidden lg:block">
                    {item.is_published ? (
                      <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Ativo</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">Rascunho</span>
                      </div>
                    )}
                  </div>

                  <div className="hidden lg:block text-[11px] font-bold text-muted-foreground uppercase tracking-tighter">
                    {formatRelativeDate(item.updated_at)}
                  </div>

                  <div className="flex items-center justify-end gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-white/10 transition-all"
                      onClick={() => handlePreview(item)}
                      title="Pré-visualizar"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-white/10 transition-all"
                      onClick={() => handleEdit(item)}
                      title="Editar"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-white/10 transition-all"
                      onClick={() => handleDuplicate(item)}
                      title="Duplicar"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-9 w-9 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                      onClick={() => handleDelete(item)}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!previewHtml} onOpenChange={(open) => !open && setPreviewHtml(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col rounded-[2rem] border-border/40 p-0 overflow-hidden bg-white dark:bg-black">
          <div className="p-6 border-b border-border/40 bg-gray-50/50 dark:bg-white/5 flex items-center justify-between">
            <h3 className="text-lg font-bold tracking-tight">Visualização do Modelo</h3>
            <Button variant="ghost" size="icon" onClick={() => setPreviewHtml(null)} className="rounded-xl">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-auto bg-[#faf9f7] dark:bg-white/5 p-8">
            {previewHtml && (
              <div className="max-w-[600px] mx-auto shadow-2xl rounded-2xl overflow-hidden border border-border/40 bg-white">
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-[60vh] border-0"
                  title="Preview"
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailTemplatesManager;