import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, Copy, BarChart3, Globe, Clock, MousePointer, Plus, Trash2, Loader2, Power, PowerOff } from 'lucide-react';
import { useTrackedLinks, TrackedLink } from '@/hooks/useTrackedLinks';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const LinkTrackingDashboard = () => {
  const { links, loading, createLink, deleteLink, toggleLinkStatus, totalClicks, totalUniqueVisitors } = useTrackedLinks();
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedLink, setSelectedLink] = useState<TrackedLink | null>(null);

  const handleCreateLink = async () => {
    if (!newUrl) return;
    setCreating(true);
    const result = await createLink(newUrl, newTitle || undefined);
    setCreating(false);
    if (result) { setNewUrl(''); setNewTitle(''); }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/l/${code}`);
  };

  const handleDeleteLink = async (id: string) => {
    await deleteLink(id);
    if (selectedLink?.id === id) setSelectedLink(null);
  };

  const stats = [
    { label: "Links Ativos", value: links.length, icon: Link, color: "#2ECC71" },
    { label: "Total Cliques", value: totalClicks, icon: MousePointer, color: "#10B981" },
    { label: "Visitantes Únicos", value: totalUniqueVisitors, icon: Globe, color: "#8B5CF6" },
    { label: "Status", value: links.length > 0 ? 'Ativo' : '-', icon: Clock, color: "#F59E0B" },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${stat.color}12` }}>
                <Icon className="h-5 w-5" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Link */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Plus className="h-5 w-5 text-gray-500" />
            Criar Link Rastreável
          </h3>
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-gray-600">URL de Destino</Label>
              <Input placeholder="https://exemplo.com/pagina" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="mt-1 rounded-xl h-10" />
            </div>
            <div>
              <Label className="text-sm text-gray-600">Título (opcional)</Label>
              <Input placeholder="Nome para identificar" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="mt-1 rounded-xl h-10" />
            </div>
            <Button onClick={handleCreateLink} className="w-full h-10 rounded-xl" disabled={creating || !newUrl}>
              {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando...</> : <><Plus className="h-4 w-4 mr-2" />Criar Link</>}
            </Button>
          </div>
        </div>

        {/* Links List */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-gray-500" />
            Seus Links ({links.length})
          </h3>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-gray-300" /></div>
          ) : links.length === 0 ? (
            <div className="text-center py-8">
              <Link className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500">Nenhum link criado ainda</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {links.map((link) => (
                <div
                  key={link.id}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedLink?.id === link.id ? 'border-green-300 bg-green-50/50' : 'border-gray-100 hover:border-gray-200'
                  } ${!link.is_active ? 'opacity-60' : ''}`}
                  onClick={() => setSelectedLink(link)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate text-gray-900">{link.title || 'Link sem título'}</p>
                        {!link.is_active && <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded-md">Off</span>}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{link.original_url}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={(e) => { e.stopPropagation(); copyToClipboard(link.short_code); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={(e) => { e.stopPropagation(); toggleLinkStatus(link.id, link.is_active); }}>
                        {link.is_active ? <PowerOff className="h-3.5 w-3.5 text-amber-500" /> : <Power className="h-3.5 w-3.5 text-green-500" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteLink(link.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><MousePointer className="h-3 w-3" />{link.clicks || 0} cliques</span>
                    <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{link.unique_visitors || 0} únicos</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(link.created_at), 'dd/MM/yy', { locale: ptBR })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected Details */}
      {selectedLink && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Detalhes: {selectedLink.title || 'Link sem título'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="p-4 bg-green-50 rounded-xl text-center">
              <p className="text-2xl font-bold text-green-700">{selectedLink.clicks || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Cliques Totais</p>
            </div>
            <div className="p-4 bg-[#F0F2FE] rounded-xl text-center">
              <p className="text-2xl font-bold text-[#253573]">{selectedLink.unique_visitors || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Visitantes Únicos</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl text-center">
              <p className="text-2xl font-bold text-purple-700">
                {selectedLink.clicks > 0 ? ((selectedLink.unique_visitors / selectedLink.clicks) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-xs text-gray-500 mt-1">Taxa de Conversão</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-gray-500">Link Rastreável</Label>
              <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between mt-1">
                <code className="text-sm break-all text-gray-700">{window.location.origin}/l/{selectedLink.short_code}</code>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(selectedLink.short_code)} className="rounded-lg ml-2">
                  <Copy className="h-3.5 w-3.5 mr-1" />Copiar
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-500">URL de Destino</Label>
              <div className="p-3 bg-gray-50 rounded-xl mt-1">
                <code className="text-sm break-all text-gray-700">{selectedLink.original_url}</code>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LinkTrackingDashboard;
