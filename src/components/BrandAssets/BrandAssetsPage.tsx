import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, Trash2, Image, FileText, Search, Plus } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

const CATEGORIES = [
  { value: 'logo', label: 'Logo' },
  { value: 'screenshot', label: 'Screenshot do Sistema' },
  { value: 'icon', label: 'Ícone' },
  { value: 'banner', label: 'Banner' },
  { value: 'photo', label: 'Foto' },
  { value: 'other', label: 'Outro' },
];

export default function BrandAssetsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadCategory, setUploadCategory] = useState('screenshot');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const fetchCompany = async () => {
      if (!user?.id) return;
      const { data } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).limit(1).maybeSingle();
      if (data) setCompanyId(data.company_id);
    };
    fetchCompany();
  }, [user?.id]);

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['brand-assets', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('brand_assets')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const asset = assets.find(a => a.id === id);
      if (asset) {
        const path = new URL(asset.file_url).pathname.split('/brand-assets/')[1];
        if (path) await supabase.storage.from('brand-assets').remove([decodeURIComponent(path)]);
      }
      const { error } = await supabase.from('brand_assets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand-assets'] });
      toast.success('Asset removido');
    },
  });

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!companyId || files.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const path = `${companyId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true });
        if (uploadError) { toast.error(`Erro ao enviar ${file.name}`); continue; }
        const { data: { publicUrl } } = supabase.storage.from('brand-assets').getPublicUrl(path);
        await supabase.from('brand_assets').insert({
          company_id: companyId,
          name: file.name.replace(/\.[^.]+$/, ''),
          file_url: publicUrl,
          file_type: file.type.startsWith('image/') ? 'image' : 'file',
          category: uploadCategory,
          tags: [uploadCategory],
        });
      }
      queryClient.invalidateQueries({ queryKey: ['brand-assets'] });
      toast.success(`${files.length} arquivo(s) enviado(s)`);
    } catch (e) {
      toast.error('Erro no upload');
    } finally {
      setIsUploading(false);
    }
  }, [companyId, uploadCategory, queryClient]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: uploadFiles,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'] },
    multiple: true,
  });

  const filtered = assets.filter(a => {
    if (filterCategory !== 'all' && a.category !== filterCategory) return false;
    if (searchTerm && !a.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Biblioteca de Marca</h1>
          <p className="text-muted-foreground text-sm">Logos, prints e assets da Ellosuit para uso na IA</p>
        </div>
        <Badge variant="secondary">{assets.length} arquivo(s)</Badge>
      </div>

      {/* Upload Zone */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <Select value={uploadCategory} onValueChange={setUploadCategory}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">Categoria para novos uploads</span>
          </div>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/50'}`}
          >
            <input {...getInputProps()} />
            {isUploading ? (
              <p className="text-muted-foreground">Enviando...</p>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-foreground font-medium">Arraste imagens aqui ou clique para selecionar</p>
                <p className="text-xs text-muted-foreground">PNG, JPG, WebP, SVG • Múltiplos arquivos</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar assets..." className="pl-9" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Image className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>Nenhum asset encontrado</p>
          <p className="text-xs mt-1">Faça upload de logos e prints do sistema para a IA usar como referência</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map(asset => (
            <Card key={asset.id} className="overflow-hidden group relative">
              <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                {asset.file_type === 'image' ? (
                  <img src={asset.file_url} alt={asset.name} className="w-full h-full object-cover" />
                ) : (
                  <FileText className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <CardContent className="p-2">
                <p className="text-xs font-medium truncate text-foreground">{asset.name}</p>
                <Badge variant="outline" className="text-[10px] mt-1">{asset.category}</Badge>
              </CardContent>
              <Button
                variant="destructive" size="icon"
                className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => deleteMutation.mutate(asset.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
