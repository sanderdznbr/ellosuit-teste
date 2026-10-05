import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, Eye, Clock, Users, BarChart, ExternalLink, Trash2, RefreshCw, Calendar, Timer, MousePointer, Smartphone, Monitor, Globe } from 'lucide-react';
import { useFileUpload } from '@/hooks/useFileUpload';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { extractAndUploadPdfPages } from '@/utils/pdf-extractor';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TrackableDocument {
  id: string;
  title: string;
  original_filename: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  tracking_enabled: boolean;
  public_link_id: string;
  created_at: string;
  updated_at: string;
}

interface DocumentStats {
  totalSessions: number;
  uniqueVisitors: number;
  totalEvents: number;
  pageStats: Array<{
    page: number;
    views: number;
    uniqueVisitors: number;
    timeSpent: number;
  }>;
  sessions: Array<{
    sessionId: string;
    visitorId: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    pageSequence: Array<{
      page: number;
      timestamp: string;
      duration?: number;
    }>;
    totalPagesVisited: number;
    totalEvents: number;
  }>;
  recentEvents: Array<{
    event_type: string;
    page_number: number;
    timestamp: string;
    data: any;
  }>;
}

const DocumentTrackingDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { uploadFile, uploading } = useFileUpload();
  const [documents, setDocuments] = useState<TrackableDocument[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<TrackableDocument | null>(null);
  const [documentStats, setDocumentStats] = useState<DocumentStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [activeStatsTab, setActiveStatsTab] = useState<'sessions' | 'pages' | 'events'>('sessions');

  useEffect(() => {
    if (user) fetchDocuments();
  }, [user]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('trackable_documents')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({ title: 'Erro', description: 'Erro ao carregar documentos', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast({ title: 'Tipo de arquivo não suportado', description: 'Por favor, selecione um arquivo PDF', variant: 'destructive' });
      return;
    }
    try {
      setLoading(true);
      const { data: companyUser, error: companyError } = await supabase
        .from('company_users').select('company_id').eq('user_id', user?.id).single();
      if (companyError || !companyUser) throw new Error('Usuário não associado a empresa');
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${companyUser.company_id}/${fileName}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('trackable-documents').upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);
      const { data: { publicUrl } } = supabase.storage.from('trackable-documents').getPublicUrl(uploadData.path);
      const { data, error } = await supabase
        .from('trackable_documents')
        .insert({ 
          user_id: user?.id, 
          company_id: companyUser.company_id, 
          title: file.name.replace('.pdf', ''), 
          original_filename: file.name, 
          file_url: publicUrl, 
          file_size: file.size, 
          mime_type: file.type, 
          tracking_enabled: true 
        })
        .select().single();
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Documento enviado e preparado para rastreamento' });
      try {
        toast({ title: 'Extraindo páginas', description: 'Convertendo PDF em imagens...' });
        const pages = await extractAndUploadPdfPages(publicUrl, data.id);
        toast({ title: 'Páginas extraídas', description: `${pages} páginas processadas com sucesso.` });
      } catch (extractionError) {
        console.error('Erro na extração de páginas:', extractionError);
        toast({ title: 'Aviso', description: 'Não foi possível extrair as páginas agora.' });
      }
      const shareableUrl = `https://www.ellosuit.online/document/${data.public_link_id}`;
      navigator.clipboard.writeText(shareableUrl);
      toast({ title: 'Link copiado!', description: shareableUrl });
      fetchDocuments();
      event.target.value = '';
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast({ title: 'Erro', description: error.message || 'Erro ao enviar documento', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchDocumentStats = async (document: TrackableDocument) => {
    try {
      setStatsLoading(true);
      const functionUrl = `https://jwddiyuezqrpuakazvgg.supabase.co/functions/v1/document-tracking?documentId=${document.id}`;
      const response = await fetch(functionUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3ZGRpeXVlenFycHVha2F6dmdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEzNDIzNTgsImV4cCI6MjA2NjkxODM1OH0.CrUu3HGCfWh6cPfGsbDXGQNG5AWOsi9X2GGix1-7izg`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setDocumentStats(data);
    } catch (error) {
      console.error('Error fetching document stats:', error);
      toast({ title: 'Erro', description: 'Erro ao carregar estatísticas do documento', variant: 'destructive' });
    } finally {
      setStatsLoading(false);
    }
  };

  const handleViewDocument = (document: TrackableDocument) => {
    setSelectedDocument(document);
    fetchDocumentStats(document);
  };

  const handleDeleteDocument = async (document: TrackableDocument) => {
    if (!confirm('Tem certeza que deseja excluir este documento?')) return;
    try {
      const { error } = await supabase.from('trackable_documents').delete().eq('id', document.id);
      if (error) throw error;
      toast({ title: 'Sucesso', description: 'Documento excluído' });
      fetchDocuments();
      if (selectedDocument?.id === document.id) { setSelectedDocument(null); setDocumentStats(null); }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({ title: 'Erro', description: 'Erro ao excluir documento', variant: 'destructive' });
    }
  };

  const getPublicViewUrl = (document: TrackableDocument) => `${window.location.origin}/document/${document.public_link_id}`;
  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: 'Copiado!', description: 'Link copiado para a área de transferência' });
  };
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload + Documents List */}
        <div className="space-y-6">
          {/* Upload */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Upload className="h-5 w-5 text-gray-500" />
              Carregar Documento
            </h3>
            <Alert className="mb-4 rounded-xl border-gray-100">
              <FileText className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Apenas PDFs. O documento será público e rastreável via link único.
              </AlertDescription>
            </Alert>
            <div>
              <Label className="text-sm text-gray-600">Selecionar Arquivo PDF</Label>
              <Input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileUpload}
                disabled={uploading || loading}
                className="mt-1 rounded-xl"
              />
            </div>
          </div>

          {/* Documents List */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-gray-500" />
              Documentos ({documents.length})
            </h3>
            {loading ? (
              <div className="text-center py-8 text-sm text-gray-500">Carregando...</div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Nenhum documento. Faça upload do primeiro!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div 
                    key={doc.id} 
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${
                      selectedDocument?.id === doc.id ? 'border-green-300 bg-green-50/50' : 'border-gray-100 hover:border-gray-200'
                    }`}
                    onClick={() => handleViewDocument(doc)}
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-gray-900 truncate">{doc.title}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatFileSize(doc.file_size)} • {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 ml-3">
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={(e) => { e.stopPropagation(); copyToClipboard(getPublicViewUrl(doc)); }}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteDocument(doc); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats Panel */}
        <div className="space-y-6">
          {selectedDocument ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <BarChart className="h-5 w-5 text-gray-500" />
                  Estatísticas
                </h3>
                <Button variant="outline" size="sm" onClick={() => fetchDocumentStats(selectedDocument)} disabled={statsLoading} className="rounded-xl">
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${statsLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>
              <p className="text-sm text-gray-500 truncate mb-4">{selectedDocument.title}</p>

              {statsLoading ? (
                <div className="text-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-green-500" />
                  <p className="text-sm text-gray-500">Carregando...</p>
                </div>
              ) : documentStats ? (
                <div className="space-y-5">
                  {/* Overview */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-4 bg-green-50 rounded-xl">
                      <Users className="h-5 w-5 mx-auto mb-2 text-green-600" />
                      <div className="text-2xl font-bold text-green-700">{documentStats.totalSessions}</div>
                      <div className="text-xs text-gray-500">Aberturas</div>
                    </div>
                    <div className="text-center p-4 bg-[#F0F2FE] rounded-xl">
                      <Globe className="h-5 w-5 mx-auto mb-2 text-[#2F428D]" />
                      <div className="text-2xl font-bold text-[#253573]">{documentStats.uniqueVisitors}</div>
                      <div className="text-xs text-gray-500">Visitantes</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-xl">
                      <MousePointer className="h-5 w-5 mx-auto mb-2 text-purple-600" />
                      <div className="text-2xl font-bold text-purple-700">{documentStats.totalEvents}</div>
                      <div className="text-xs text-gray-500">Interações</div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1">
                    {(['sessions', 'pages', 'events'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveStatsTab(tab)}
                        className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          activeStatsTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {tab === 'sessions' ? 'Sessões' : tab === 'pages' ? 'Páginas' : 'Eventos'}
                      </button>
                    ))}
                  </div>

                  <ScrollArea className="h-[350px]">
                    {activeStatsTab === 'sessions' && documentStats.sessions?.length > 0 && (
                      <div className="space-y-2">
                        {documentStats.sessions.map((session, index) => {
                          const duration = session.duration ? Math.round(session.duration / 1000) : 0;
                          return (
                            <div key={session.sessionId} className="p-3 rounded-xl border border-gray-100">
                              <div className="flex justify-between items-center mb-2">
                                <Badge variant="outline" className="text-xs rounded-lg">Sessão #{index + 1}</Badge>
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />{duration}s
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">
                                {session.totalPagesVisited} páginas • {session.totalEvents} eventos
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {activeStatsTab === 'pages' && documentStats.pageStats?.length > 0 && (
                      <div className="space-y-2">
                        {documentStats.pageStats.map(ps => (
                          <div key={ps.page} className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
                            <span className="text-sm font-medium">Página {ps.page}</span>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span>{ps.views} views</span>
                              <span>{ps.uniqueVisitors} únicos</span>
                              <span>{Math.round(ps.timeSpent / 1000)}s</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {activeStatsTab === 'events' && documentStats.recentEvents?.length > 0 && (
                      <div className="space-y-2">
                        {documentStats.recentEvents.slice(0, 20).map((event, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-gray-100">
                            <div>
                              <Badge variant="secondary" className="text-xs rounded-lg">{event.event_type}</Badge>
                              {event.page_number && <span className="text-xs text-gray-500 ml-2">Pág. {event.page_number}</span>}
                            </div>
                            <span className="text-xs text-gray-400">
                              {format(new Date(event.timestamp), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-gray-500">
                  Selecione um documento para ver estatísticas
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <Eye className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Selecione um documento para ver as estatísticas</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentTrackingDashboard;
