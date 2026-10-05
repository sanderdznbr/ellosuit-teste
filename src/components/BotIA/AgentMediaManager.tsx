import React, { useState, useEffect, useCallback } from 'react';
import { Image, Upload, Trash2, X, Loader2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const OMNI_COLOR = '#374DA4';

interface AgentMedia {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  description: string;
  context_keywords: string[];
  is_active: boolean;
}

interface AgentMediaManagerProps {
  agentId: string;
  companyId: string;
}

const AgentMediaManager: React.FC<AgentMediaManagerProps> = ({ agentId, companyId }) => {
  const { toast } = useToast();
  const [mediaList, setMediaList] = useState<AgentMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const loadMedia = useCallback(async () => {
    const { data, error } = await supabase
      .from('ai_agent_media')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMediaList(data as AgentMedia[]);
    }
    setLoading(false);
  }, [agentId]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('application/pdf')) {
      toast({ title: 'Tipo inválido', description: 'Aceitos: Imagens, vídeos e PDFs', variant: 'destructive' });
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Máximo 20MB', variant: 'destructive' });
      return;
    }

    if (!description.trim()) {
      toast({ title: 'Descrição obrigatória', description: 'Descreva quando o agente deve enviar este arquivo', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `agent-media/${agentId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(path, file, { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('whatsapp-media').getPublicUrl(path);

      const keywordsArray = keywords.split(',').map(k => k.trim()).filter(Boolean);

      const { error: insertError } = await supabase
        .from('ai_agent_media')
        .insert({
          agent_id: agentId,
          company_id: companyId,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document',
          description: description.trim(),
          context_keywords: keywordsArray,
          is_active: true,
        });

      if (insertError) throw insertError;

      setDescription('');
      setKeywords('');
      await loadMedia();
      toast({ title: 'Mídia adicionada!', description: 'O agente agora pode enviar este arquivo' });
    } catch (err: any) {
      console.error('Upload error:', err);
      toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const toggleActive = async (mediaId: string, current: boolean) => {
    await supabase.from('ai_agent_media').update({ is_active: !current }).eq('id', mediaId);
    setMediaList(prev => prev.map(m => m.id === mediaId ? { ...m, is_active: !current } : m));
  };

  const deleteMedia = async (mediaId: string) => {
    await supabase.from('ai_agent_media').delete().eq('id', mediaId);
    setMediaList(prev => prev.filter(m => m.id !== mediaId));
    toast({ title: 'Mídia removida' });
  };

  return (
    <Card className="rounded-2xl border-gray-200">
      <CardContent className="p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Image className="h-4 w-4" style={{ color: OMNI_COLOR }} />
            Mídia do Agente
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Adicione fotos e arquivos que o agente pode enviar automaticamente durante conversas no WhatsApp. 
            Descreva quando cada arquivo deve ser enviado — a IA decidirá sozinha o melhor momento.
          </p>
        </div>

        {/* Upload form */}
        <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <div>
            <Label className="text-sm text-gray-700">Quando enviar? *</Label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Quando pedirem o cardápio, quando perguntarem sobre preços, quando quiserem ver fotos do produto..."
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm text-gray-700">Palavras-chave (opcional)</Label>
            <Input
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              placeholder="cardápio, menu, preços (separados por vírgula)"
              className="mt-1"
            />
            <p className="text-xs text-gray-400 mt-1">Ajuda a IA a identificar quando enviar</p>
          </div>
          <div className="flex justify-center">
            <Label htmlFor="agent-media-upload" className="cursor-pointer">
              <div className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all ${uploading ? 'opacity-50' : 'hover:opacity-90'}`} style={{ backgroundColor: OMNI_COLOR }}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? 'Enviando...' : 'Selecionar Arquivo'}
              </div>
              <input
                id="agent-media-upload"
                type="file"
                accept="image/*,video/*,application/pdf"
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
              />
            </Label>
          </div>
          <p className="text-xs text-gray-400 text-center">Imagens, vídeos e PDFs (máx. 20MB)</p>
        </div>

        {/* Media list */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : mediaList.length > 0 ? (
          <div className="space-y-2">
            {mediaList.map(media => (
              <div key={media.id} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                {/* Thumbnail */}
                <button
                  onClick={() => setPreviewUrl(media.file_url)}
                  className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center hover:opacity-80 transition-opacity"
                >
                  {media.file_type === 'image' ? (
                    <img src={media.file_url} alt={media.file_name} className="w-full h-full object-cover" />
                  ) : (
                    <Image className="h-6 w-6 text-gray-400" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{media.file_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{media.description}</p>
                  {media.context_keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {media.context_keywords.map((kw, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={media.is_active}
                    onCheckedChange={() => toggleActive(media.id, media.is_active)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-gray-400 hover:text-red-500"
                    onClick={() => deleteMedia(media.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-2xl">
            <Image className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">Nenhuma mídia adicionada</p>
            <p className="text-xs text-gray-400 mt-1">Adicione fotos para o agente enviar no WhatsApp</p>
          </div>
        )}

        {/* Preview dialog */}
        <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
          <DialogContent className="max-w-lg p-2">
            {previewUrl && <img src={previewUrl} alt="Preview" className="w-full rounded-lg" />}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default AgentMediaManager;
