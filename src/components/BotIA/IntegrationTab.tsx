import React, { useState, useEffect } from 'react';
import { MessageSquare, Bot, Loader2, ExternalLink, Users, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const OMNI_COLOR = '#374DA4';

interface ActiveConversation {
  id: string;
  contact_name: string;
  contact_phone: string;
  profile_picture?: string;
  last_message_at?: string;
  ai_auto_reply_enabled: boolean;
  session_instance?: string;
}

interface IntegrationTabProps {
  agentId: string;
  agentName: string;
}

const IntegrationTab: React.FC<IntegrationTabProps> = ({ agentId, agentName }) => {
  const [conversations, setConversations] = useState<ActiveConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    loadActiveConversations();
  }, [agentId]);

  const loadActiveConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('id, contact_name, contact_phone, profile_picture, last_message_at, ai_auto_reply_enabled')
        .eq('assigned_agent_id', agentId)
        .order('last_message_at', { ascending: false });

      if (!error && data) {
        setConversations(data.map(c => ({
          id: c.id,
          contact_name: c.contact_name || c.contact_phone,
          contact_phone: c.contact_phone,
          profile_picture: c.profile_picture || undefined,
          last_message_at: c.last_message_at || undefined,
          ai_auto_reply_enabled: c.ai_auto_reply_enabled ?? false,
        })));
      }
    } catch (e) {
      console.error('Error loading conversations:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className="rounded-2xl border-gray-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">WhatsApp CRM</h2>
              <p className="text-xs text-gray-400">
                Este agente responde automaticamente quando atribuído a conversas
              </p>
            </div>
          </div>

          <div className="bg-[#F0F2FE] border border-[#DFE4FB] rounded-xl p-4 text-sm text-[#253573]">
            <p className="font-medium mb-1">Como funciona?</p>
            <ul className="text-xs space-y-1 text-[#2F428D]">
              <li>• No <strong>CRM WhatsApp</strong>, atribua este agente a conversas específicas</li>
              <li>• Um <strong>Chatbot</strong> pode atribuir automaticamente este agente a novas conversas</li>
              <li>• O agente responderá automaticamente apenas nas conversas atribuídas</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Active Conversations */}
      <Card className="rounded-2xl border-gray-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" style={{ color: OMNI_COLOR }} />
              <h3 className="text-base font-semibold text-gray-900">Conversas Ativas</h3>
              <Badge variant="outline" className="font-mono text-xs">{conversations.length}</Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard/crm')}
              className="gap-1.5 text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Abrir CRM
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
              <Bot className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">Nenhuma conversa atribuída</p>
              <p className="text-xs text-gray-400 mt-1">
                Vá ao CRM WhatsApp para atribuir "{agentName}" a conversas
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/dashboard/crm')}
                className="mt-4 gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ir para o CRM
              </Button>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {conversations.map(conv => (
                  <div
                    key={conv.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {conv.profile_picture ? (
                          <img src={conv.profile_picture} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm font-medium text-gray-500">
                            {conv.contact_name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{conv.contact_name}</p>
                        <p className="text-xs text-gray-400">{conv.contact_phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {conv.last_message_at && (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="h-3 w-3" />
                          {format(new Date(conv.last_message_at), "dd/MM HH:mm", { locale: ptBR })}
                        </div>
                      )}
                      <Badge
                        className={conv.ai_auto_reply_enabled
                          ? 'bg-green-100 text-green-700 text-[10px]'
                          : 'bg-gray-100 text-gray-500 text-[10px]'
                        }
                      >
                        {conv.ai_auto_reply_enabled ? 'Auto-reply ON' : 'Pausado'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default IntegrationTab;
