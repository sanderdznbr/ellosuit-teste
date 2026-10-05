import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Image as ImageIcon, Video, Save } from 'lucide-react';

interface Asset {
  id: string;
  key: string;
  type: 'image' | 'video';
  url: string;
  label: string;
}

export const LandingPageAssetManager = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('landing_page_assets')
        .select('*')
        .order('label', { ascending: true });

      if (error) throw error;
      setAssets(data || []);
    } catch (error) {
      console.error('Error fetching assets:', error);
      toast.error('Erro ao carregar mídias da landing page');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAsset = async (id: string, url: string) => {
    try {
      setSaving(id);
      const { error } = await (supabase as any)
        .from('landing_page_assets')
        .update({ url, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      setAssets(assets.map(a => a.id === id ? { ...a, url } : a));
      toast.success('Mídia atualizada com sucesso!');
    } catch (error) {
      console.error('Error updating asset:', error);
      toast.error('Erro ao salvar alteração');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {assets.map((asset) => (
          <Card key={asset.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  {asset.type === 'video' ? <Video size={18} /> : <ImageIcon size={18} />}
                  {asset.label}
                </CardTitle>
              </div>
              <CardDescription>Key: {asset.key}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="aspect-video bg-gray-100 rounded-md overflow-hidden flex items-center justify-center border border-dashed border-gray-300">
                {asset.url ? (
                  asset.type === 'video' ? (
                    <div className="text-center p-4">
                      <Video className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                      <p className="text-xs text-gray-500 truncate max-w-[200px]">{asset.url}</p>
                    </div>
                  ) : (
                    <img src={asset.url} alt={asset.label} className="w-full h-full object-cover" />
                  )
                ) : (
                  <div className="text-center p-4">
                    <p className="text-xs text-gray-400">Nenhuma mídia configurada (usando placeholder)</p>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor={`url-${asset.id}`} className="text-xs">URL da Mídia (Link direto)</Label>
                <div className="flex gap-2">
                  <Input 
                    id={`url-${asset.id}`}
                    placeholder="https://exemplo.com/imagem.png"
                    defaultValue={asset.url}
                    className="h-9 text-sm"
                    onBlur={(e) => {
                      if (e.target.value !== asset.url) {
                        handleUpdateAsset(asset.id, e.target.value);
                      }
                    }}
                  />
                </div>
                <p className="text-[10px] text-gray-500 italic">Dica: Use links diretos do Supabase Storage ou URLs externas.</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
