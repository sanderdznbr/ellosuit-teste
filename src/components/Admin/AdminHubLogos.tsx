import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save, Trash2 } from 'lucide-react';

const HUB_IDS = [
  { id: 'home', label: 'Dashboard Home' },
  { id: 'omni', label: 'Omni Hub' },
  { id: 'flow', label: 'Flow Hub' },
  { id: 'meet', label: 'Meet Hub' },
  { id: 'track', label: 'Track Hub' },
  { id: 'suite', label: 'Suite Hub' },
];

const AdminHubLogos = () => {
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchLogos();
  }, []);

  const fetchLogos = async () => {
    try {
      const { data, error } = await supabase.from('hub_logos').select('*');
      if (error) throw error;
      
      const logoMap: Record<string, string> = {};
      data.forEach(item => {
        logoMap[item.hub_id] = item.svg_content;
      });
      setLogos(logoMap);
    } catch (error) {
      console.error('Error fetching logos:', error);
      toast({
        title: 'Erro ao carregar logos',
        description: 'Não foi possível carregar as logos do banco de dados.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

   const handleSave = async (hubId: string) => {
     const svgContent = logos[hubId];
     if (!svgContent) return;
 
     // Basic validation for SVG
     if (!svgContent.trim().toLowerCase().startsWith('<svg') || !svgContent.trim().toLowerCase().endsWith('</svg>')) {
       toast({
         title: 'SVG Inválido',
         description: 'O código deve começar com <svg e terminar com </svg>.',
         variant: 'destructive',
       });
       return;
     }
 
     setSaving(hubId);
     try {
       const { error } = await supabase
         .from('hub_logos')
         .upsert({ 
           hub_id: hubId, 
           svg_content: svgContent.trim(),
           updated_at: new Date().toISOString()
         });
 
       if (error) {
         console.error('Supabase error saving logo:', error);
         throw error;
       }
 
       toast({
         title: 'Logo salva!',
         description: `A logo do hub ${hubId} foi atualizada com sucesso.`,
       });
     } catch (error: any) {
       console.error('Error saving logo:', error);
       toast({
         title: 'Erro ao salvar logo',
         description: error.message || 'Erro de permissão ou conexão. Tente novamente.',
         variant: 'destructive',
       });
     } finally {
       setSaving(null);
     }
   };

  const handleDelete = async (hubId: string) => {
    if (!confirm(`Tem certeza que deseja excluir a logo do hub ${hubId}?`)) return;

    try {
      const { error } = await supabase
        .from('hub_logos')
        .delete()
        .eq('hub_id', hubId);

      if (error) throw error;

      const newLogos = { ...logos };
      delete newLogos[hubId];
      setLogos(newLogos);

      toast({
        title: 'Logo excluída',
        description: 'A logo foi removida com sucesso.',
      });
    } catch (error) {
      console.error('Error deleting logo:', error);
      toast({
        title: 'Erro ao excluir logo',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Logos dos Hubs (SVG)</h1>
        <p className="text-muted-foreground">
          Cole o código SVG de cada hub abaixo. Isso resolverá problemas de carregamento lento e permitirá animações fluidas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {HUB_IDS.map((hub) => (
          <Card key={hub.id} className="border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{hub.label}</CardTitle>
                <div 
                  className="h-8 w-24 bg-black/5 dark:bg-white/5 rounded flex items-center justify-center overflow-hidden p-1 border border-border/20"
                  dangerouslySetInnerHTML={{ __html: logos[hub.id] || '<span class="text-[10px] opacity-20 italic">Vazio</span>' }}
                />
              </div>
              <CardDescription>Cole o conteúdo do arquivo .svg</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <Textarea
                placeholder="<svg ...>...</svg>"
                className="font-mono text-[11px] min-h-[160px] resize-y bg-muted/20"
                value={logos[hub.id] || ''}
                onChange={(e) => setLogos({ ...logos, [hub.id]: e.target.value })}
              />
              <div className="flex gap-2">
                <Button 
                  className="flex-1" 
                  onClick={() => handleSave(hub.id)}
                  disabled={saving === hub.id || !logos[hub.id]}
                >
                  {saving === hub.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar
                </Button>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(hub.id)}
                  disabled={!logos[hub.id]}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminHubLogos;
