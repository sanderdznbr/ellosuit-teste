import React, { useState, useEffect } from 'react';
import { Bot, Save, Loader2, MessageSquare, Trash2, Upload, FileText, X, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AIAgent {
  id: string;
  name: string;
  description?: string;
  personality: string;
  instructions: string;
  model: string;
  is_active: boolean;
  avatar_url?: string;
  settings: any;
  whatsapp_enabled?: boolean;
  whatsapp_session_id?: string;
}

interface WhatsAppSession {
  id: string;
  instance_name: string;
  status: string;
  phone_number?: string;
}

interface TrainingFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

interface EditAgentModalProps {
  agent: AIAgent;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onDelete: () => void;
}

const AI_MODELS = [
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash (Rápido)' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (Balanceado)' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro (Avançado)' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini (Rápido)' },
  { value: 'openai/gpt-5', label: 'GPT-5 (Avançado)' },
];

const EditAgentModal: React.FC<EditAgentModalProps> = ({
  agent,
  isOpen,
  onClose,
  onUpdate,
  onDelete
}) => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [whatsappSessions, setWhatsappSessions] = useState<WhatsAppSession[]>([]);
  const [trainingFiles, setTrainingFiles] = useState<TrainingFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  
  // Form state
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description || '');
  const [personality, setPersonality] = useState(agent.personality);
  const [instructions, setInstructions] = useState(agent.instructions);
  const [model, setModel] = useState(agent.model);
  const [isActive, setIsActive] = useState(agent.is_active);
  const [whatsappEnabled, setWhatsappEnabled] = useState(agent.whatsapp_enabled || false);
  const [whatsappSessionId, setWhatsappSessionId] = useState(agent.whatsapp_session_id || '');
  
  // Advanced settings
  const [maxResponseChars, setMaxResponseChars] = useState(agent.settings?.maxResponseChars || 2000);
  const [temperature, setTemperature] = useState(agent.settings?.temperature || 0.7);
  const [contextMemory, setContextMemory] = useState(agent.settings?.contextMemory || 10);

  // Load WhatsApp sessions
  useEffect(() => {
    const loadSessions = async () => {
      const { data } = await supabase
        .from('whatsapp_sessions')
        .select('id, instance_name, status, phone_number');
      
      setWhatsappSessions(data || []);
    };

    if (isOpen) {
      loadSessions();
      // Load training files from settings
      const files = agent.settings?.trainingFiles || [];
      setTrainingFiles(files);
    }
  }, [isOpen, agent.settings]);

  // Reset form when agent changes
  useEffect(() => {
    setName(agent.name);
    setDescription(agent.description || '');
    setPersonality(agent.personality);
    setInstructions(agent.instructions);
    setModel(agent.model);
    setIsActive(agent.is_active);
    setWhatsappEnabled(agent.whatsapp_enabled || false);
    setWhatsappSessionId(agent.whatsapp_session_id || '');
    setMaxResponseChars(agent.settings?.maxResponseChars || 2000);
    setTemperature(agent.settings?.temperature || 0.7);
    setContextMemory(agent.settings?.contextMemory || 10);
    setTrainingFiles(agent.settings?.trainingFiles || []);
  }, [agent]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFile(true);
    try {
      const file = files[0];
      
      // Validate file type
      const allowedTypes = ['text/plain', 'application/pdf', 'application/json', 'text/csv', 'text/markdown'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: 'Tipo inválido',
          description: 'Aceitos: TXT, PDF, JSON, CSV, MD',
          variant: 'destructive'
        });
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'Arquivo muito grande',
          description: 'Máximo 10MB por arquivo',
          variant: 'destructive'
        });
        return;
      }

      const newFile: TrainingFile = {
        id: Math.random().toString(36).substring(7),
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString()
      };

      setTrainingFiles(prev => [...prev, newFile]);
      toast({ title: 'Arquivo adicionado', description: file.name });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao fazer upload do arquivo',
        variant: 'destructive'
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const removeFile = (fileId: string) => {
    setTrainingFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSave = async () => {
    if (!name || !personality || !instructions) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // Convert trainingFiles to JSON-compatible format
      const trainingFilesJson = trainingFiles.map(f => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: f.type,
        uploadedAt: f.uploadedAt
      }));

      const { error } = await supabase
        .from('ai_agents')
        .update({
          name,
          description,
          personality,
          instructions,
          model,
          is_active: isActive,
          whatsapp_enabled: whatsappEnabled,
          whatsapp_session_id: whatsappEnabled && whatsappSessionId ? whatsappSessionId : null,
          settings: {
            maxResponseChars,
            temperature,
            contextMemory,
            trainingFiles: trainingFilesJson
          }
        })
        .eq('id', agent.id);

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Agente atualizado!' });
      onUpdate();
      onClose();
    } catch (e: any) {
      console.error('Error updating agent:', e);
      toast({ title: 'Erro', description: e.message || 'Erro ao atualizar agente', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('ai_agents')
        .delete()
        .eq('id', agent.id);

      if (error) throw error;

      toast({ title: 'Sucesso', description: 'Agente excluído' });
      onDelete();
      onClose();
    } catch (e: any) {
      console.error('Error deleting agent:', e);
      toast({ title: 'Erro', description: e.message || 'Erro ao excluir agente', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Editar Agente: {agent.name}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <Label>Nome do Agente *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Assistente de Vendas"
                />
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Breve descrição do agente..."
                  rows={2}
                />
              </div>

              <div>
                <Label>Modelo de IA</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Personalidade *</Label>
                <Textarea
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  placeholder="Ex: Profissional, amigável e prestativo..."
                  rows={2}
                />
              </div>

              <div>
                <Label>Instruções *</Label>
                <Textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Instruções detalhadas sobre como o agente deve se comportar..."
                  rows={6}
                />
              </div>
            </div>

            <Separator />

            {/* Advanced Settings */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                <Label className="text-base font-semibold">Configurações Avançadas</Label>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Limite de caracteres por resposta</Label>
                    <span className="text-sm font-medium">{maxResponseChars}</span>
                  </div>
                  <Slider
                    value={[maxResponseChars]}
                    onValueChange={([v]) => setMaxResponseChars(v)}
                    min={100}
                    max={10000}
                    step={100}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Limite máximo de caracteres que o agente pode responder
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Temperatura (Criatividade)</Label>
                    <span className="text-sm font-medium">{temperature.toFixed(1)}</span>
                  </div>
                  <Slider
                    value={[temperature * 100]}
                    onValueChange={([v]) => setTemperature(v / 100)}
                    min={0}
                    max={100}
                    step={10}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    0 = mais preciso, 1 = mais criativo
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Memória de contexto (mensagens)</Label>
                    <span className="text-sm font-medium">{contextMemory}</span>
                  </div>
                  <Slider
                    value={[contextMemory]}
                    onValueChange={([v]) => setContextMemory(v)}
                    min={1}
                    max={50}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Quantidade de mensagens anteriores que o agente lembra
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Training Files */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <Label className="text-base font-semibold">Arquivos de Treinamento</Label>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Adicione arquivos para o agente estudar e usar como referência nas respostas.
              </p>

              <div className="space-y-2">
                {trainingFiles.length > 0 ? (
                  <div className="space-y-2">
                    {trainingFiles.map(file => (
                      <Card key={file.id}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-[#374DA4]" />
                            <div>
                              <p className="text-sm font-medium">{file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(file.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed rounded-lg">
                    <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum arquivo adicionado
                    </p>
                  </div>
                )}

                <div className="flex justify-center">
                  <Label
                    htmlFor="file-upload"
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-muted transition-colors">
                      <Upload className="h-4 w-4" />
                      <span className="text-sm">
                        {uploadingFile ? 'Enviando...' : 'Adicionar arquivo'}
                      </span>
                    </div>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".txt,.pdf,.json,.csv,.md"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                      className="hidden"
                    />
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Aceitos: TXT, PDF, JSON, CSV, MD (máx. 10MB)
                </p>
              </div>
            </div>

            <Separator />

            {/* Status */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Agente Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Desative para pausar o agente
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            <Separator />

            {/* WhatsApp Integration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#2F428D]" />
                  <div>
                    <Label>Integração WhatsApp</Label>
                    <p className="text-xs text-muted-foreground">
                      Conectar ao CRM WhatsApp para responder leads
                    </p>
                  </div>
                </div>
                <Switch
                  checked={whatsappEnabled}
                  onCheckedChange={setWhatsappEnabled}
                />
              </div>

              {whatsappEnabled && (
                <div>
                  <Label>Conexão WhatsApp</Label>
                  <Select value={whatsappSessionId} onValueChange={setWhatsappSessionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma conexão..." />
                    </SelectTrigger>
                    <SelectContent>
                      {whatsappSessions.length === 0 ? (
                        <SelectItem value="" disabled>
                          Nenhuma conexão disponível
                        </SelectItem>
                      ) : (
                        whatsappSessions.map(session => (
                          <SelectItem key={session.id} value={session.id}>
                            {session.instance_name} ({session.phone_number || 'Sem número'}) 
                            {session.status !== 'connected' && ' - Desconectado'}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    O agente responderá automaticamente às mensagens desta conexão
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Danger Zone */}
            <div className="space-y-2">
              <Label className="text-red-600">Zona de Perigo</Label>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="w-full">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir Agente
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir Agente?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. O agente "{agent.name}" será permanentemente excluído.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditAgentModal;
