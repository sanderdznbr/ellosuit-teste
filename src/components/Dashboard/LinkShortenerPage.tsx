import React, { useState } from 'react';
import { Link2, Copy, Check, ExternalLink, MousePointer, Globe, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const BRAND = "#374DA4";
const BRAND_2 = "#5B3BFF";

export default function LinkShortenerPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: companyId } = useQuery({
    queryKey: ['user-company', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      return data?.company_id || null;
    },
    enabled: !!user?.id,
  });

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['tracked-links', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from('tracked_links')
        .select('*, link_clicks(id)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  const handleCreate = async () => {
    if (!url || !companyId || !user?.id) return;
    setCreating(true);
    try {
      const shortCode = Math.random().toString(36).substring(2, 8);
      const { error } = await supabase.from('tracked_links').insert({
        company_id: companyId,
        user_id: user.id,
        original_url: url.startsWith('http') ? url : `https://${url}`,
        short_code: shortCode,
        title: title || url,
        is_active: true,
      });
      if (error) throw error;
      toast({ title: 'Link criado!', description: 'Seu link rastreável foi gerado.' });
      setUrl('');
      setTitle('');
      queryClient.invalidateQueries({ queryKey: ['tracked-links'] });
    } catch (error) {
      console.error(error);
      toast({ title: 'Erro', description: 'Falha ao criar link.', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const copyLink = (shortCode: string) => {
    const link = `${window.location.origin}/l/${shortCode}`;
    navigator.clipboard.writeText(link);
    setCopiedId(shortCode);
    toast({ title: 'Link copiado!' });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalClicks = links.reduce((acc: number, l: any) => acc + (l.link_clicks?.length || 0), 0);

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -top-32 -left-20 h-80 w-80 rounded-full bg-[#374DA4]/20 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -right-24 h-96 w-96 rounded-full bg-[#5B3BFF]/15 blur-3xl" />
      <div className="relative max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header */}
        <div className="glass-toolbar rounded-2xl p-4 md:p-5 mb-6 flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#374DA4] to-[#5B3BFF] flex items-center justify-center shadow-lg shadow-[#374DA4]/30">
            <Link2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-foreground leading-tight">Encurtador Rastreável</h1>
            <p className="text-xs text-muted-foreground">Encurte URLs e acompanhe cada clique em tempo real</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
          {[
            { label: 'Links ativos', value: links.length, icon: Link2 },
            { label: 'Total de cliques', value: totalClicks, icon: MousePointer },
            { label: 'Taxa média', value: links.length > 0 ? `${(totalClicks / links.length).toFixed(1)}` : '0', icon: BarChart3 },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="glass-pill rounded-2xl p-4 md:p-5 flex items-center gap-3 md:gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[#374DA4]/10">
                  <Icon className="h-5 w-5 text-[#374DA4]" />
                </div>
                <div className="min-w-0">
                  <div className="text-xl md:text-2xl font-bold text-foreground">{stat.value}</div>
                  <div className="text-[11px] text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Create Link */}
        <div className="glass-toolbar rounded-2xl p-4 md:p-6 mb-6">
          <h2 className="text-base md:text-lg font-semibold text-foreground mb-4">Criar novo link</h2>
          <div className="flex flex-col md:flex-row gap-3">
            <Input
              placeholder="Cole a URL aqui... ex: https://meusite.com/pagina"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="rounded-xl h-12 flex-1 bg-background/60"
            />
            <Input
              placeholder="Nome (opcional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl h-12 md:w-48 bg-background/60"
            />
            <Button
              onClick={handleCreate}
              disabled={!url || creating}
              className="rounded-full h-12 px-6 bg-[#374DA4] hover:bg-[#2400b3] text-white shadow-md shadow-[#374DA4]/30"
            >
              {creating ? 'Criando...' : 'Encurtar'}
            </Button>
          </div>
        </div>

        {/* Links List */}
        {links.length > 0 && (
          <div>
            <h2 className="text-base md:text-lg font-semibold text-foreground mb-4">Seus links ({links.length})</h2>
            <div className="space-y-3">
              {links.map((link: any) => {
                const clicks = link.link_clicks?.length || 0;
                return (
                  <div
                    key={link.id}
                    className="glass-pill flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-2xl hover:shadow-md hover:shadow-[#374DA4]/10 transition-all"
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#374DA4]/10"
                    >
                      <Link2 className="h-5 w-5 text-[#374DA4]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{link.title || link.original_url}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {window.location.origin}/l/{link.short_code} → {link.original_url}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="text-center px-2 md:px-3">
                        <div className="text-lg font-bold text-[#374DA4]">{clicks}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">cliques</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full text-xs gap-1.5 h-8 hover:bg-[#374DA4]/10 hover:text-[#374DA4]"
                        onClick={() => copyLink(link.short_code)}
                      >
                        {copiedId === link.short_code ? (
                          <><Check className="h-3.5 w-3.5 text-[#374DA4]" /> Copiado</>
                        ) : (
                          <><Copy className="h-3.5 w-3.5" /> Copiar</>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full h-8 w-8 hover:bg-[#374DA4]/10 hover:text-[#374DA4]"
                        onClick={() => window.open(link.original_url, '_blank')}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {links.length === 0 && !isLoading && (
          <div className="text-center py-16 text-muted-foreground">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-[#374DA4]/10 flex items-center justify-center mb-3">
              <Link2 className="h-7 w-7 text-[#374DA4]" />
            </div>
            <p className="font-medium text-foreground">Nenhum link criado</p>
            <p className="text-sm">Cole uma URL acima para criar seu primeiro link rastreável</p>
          </div>
        )}
      </div>
    </div>
  );
}
