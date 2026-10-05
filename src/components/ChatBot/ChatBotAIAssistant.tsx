import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Loader2, Bot, User, Wand2, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FlowNode, FlowEdge } from './types';

const OMNI_COLOR = '#374DA4';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  flowData?: {
    nodes: FlowNode[];
    edges: FlowEdge[];
  };
}

interface ChatBotAIAssistantProps {
  onApplyFlow: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  currentNodes: FlowNode[];
  currentEdges: FlowEdge[];
}

const QUICK_PROMPTS = [
  { label: '💬 Atendimento com menu', prompt: 'Crie um fluxo de atendimento ao cliente com menu de opções: informações, suporte e falar com atendente' },
  { label: '📋 Captura de leads', prompt: 'Crie um fluxo para captura de leads pedindo nome, email e telefone, depois salvar no CRM' },
  { label: '📅 Agendamento', prompt: 'Monte um fluxo de agendamento perguntando nome, serviço desejado e horário preferido' },
  { label: '🛒 Pós-venda', prompt: 'Crie um fluxo de pós-venda perguntando sobre satisfação e se precisa de suporte' },
];

const ChatBotAIAssistant: React.FC<ChatBotAIAssistantProps> = ({
  onApplyFlow,
  currentNodes,
  currentEdges
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Olá! 👋 Sou sua assistente de criação de fluxos. Descreva o que precisa ou use um modelo rápido abaixo.'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const addNode = (
    nodes: FlowNode[], id: string, type: string, subType: string,
    label: string, x: number, y: number, config: Record<string, any>, icon: string
  ) => {
    nodes.push({
      id, type: type as any, subType,
      position: { x, y },
      data: { label, config: { ...config, icon } }
    });
  };

  const addEdge = (edges: FlowEdge[], source: string, target: string, sourceHandle?: string) => {
    edges.push({
      id: `edge_${source}_${target}${sourceHandle ? `_${sourceHandle}` : ''}`,
      source, target, sourceHandle
    });
  };

  const generateFlowFromDescription = useCallback(async (description: string): Promise<{ nodes: FlowNode[], edges: FlowEdge[], summary: string }> => {
    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    const descLower = description.toLowerCase();
    
    const baseX = 300;
    const spacing = 160;
    let summary = '';

    // === LEAD CAPTURE FLOW ===
    if (descLower.includes('lead') || descLower.includes('captura') || descLower.includes('cadastro') || descLower.includes('formulário')) {
      addNode(nodes, 'n1', 'trigger', 'whatsapp_channel', 'Canal WhatsApp', baseX, 50, { triggerWhen: 'any_message' }, 'Phone');
      addNode(nodes, 'n2', 'message', 'text', 'Boas-vindas', baseX, 50 + spacing, { content: 'Olá! 👋 Que bom ter você aqui! Vou precisar de algumas informações para te atender melhor.' }, 'MessageSquare');
      addNode(nodes, 'n3', 'message', 'text', 'Perguntar Nome', baseX, 50 + spacing * 2, { content: 'Qual é o seu nome completo?', waitForResponse: true, saveAs: 'nome' }, 'MessageSquare');
      addNode(nodes, 'n4', 'message', 'text', 'Perguntar Email', baseX, 50 + spacing * 3, { content: 'Ótimo, {{nome}}! Qual o seu melhor email?', waitForResponse: true, saveAs: 'email' }, 'MessageSquare');
      addNode(nodes, 'n5', 'message', 'text', 'Perguntar Telefone', baseX, 50 + spacing * 4, { content: 'E qual seu telefone com DDD?', waitForResponse: true, saveAs: 'telefone' }, 'MessageSquare');
      addNode(nodes, 'n6', 'action', 'save_crm', 'Salvar no CRM', baseX, 50 + spacing * 5, { fields: ['nome', 'email', 'telefone'] }, 'Database');
      addNode(nodes, 'n7', 'action', 'assign_tag', 'Marcar Lead', baseX, 50 + spacing * 6, { tag: 'lead-novo' }, 'Tag');
      addNode(nodes, 'n8', 'message', 'text', 'Confirmação', baseX, 50 + spacing * 7, { content: 'Perfeito, {{nome}}! 🎉 Seus dados foram salvos. Nossa equipe entrará em contato em breve!' }, 'MessageSquare');

      addEdge(edges, 'n1', 'n2');
      addEdge(edges, 'n2', 'n3');
      addEdge(edges, 'n3', 'n4');
      addEdge(edges, 'n4', 'n5');
      addEdge(edges, 'n5', 'n6');
      addEdge(edges, 'n6', 'n7');
      addEdge(edges, 'n7', 'n8');

      summary = '📋 Fluxo de captura de leads com 8 blocos:\n• Início pelo WhatsApp\n• Coleta nome, email e telefone\n• Salva no CRM automaticamente\n• Adiciona tag "lead-novo"\n• Envia confirmação';
    }
    // === ATENDIMENTO COM MENU ===
    else if (descLower.includes('menu') || descLower.includes('opções') || descLower.includes('atendimento')) {
      addNode(nodes, 'n1', 'trigger', 'whatsapp_channel', 'Canal WhatsApp', baseX, 50, { triggerWhen: 'any_message' }, 'Phone');
      addNode(nodes, 'n2', 'message', 'text', 'Boas-vindas', baseX, 50 + spacing, { content: 'Olá! 👋 Bem-vindo ao nosso atendimento. Como posso te ajudar?' }, 'MessageSquare');
      addNode(nodes, 'n3', 'message', 'buttons', 'Menu Principal', baseX, 50 + spacing * 2, { 
        content: 'Escolha uma opção:', 
        buttons: ['1️⃣ Informações', '2️⃣ Suporte', '3️⃣ Falar com atendente']
      }, 'List');
      
      // Condition to route based on response
      addNode(nodes, 'n4', 'condition', 'multi', 'Roteamento', baseX, 50 + spacing * 3, {
        conditions: [
          { id: 'cond_info', label: 'Informações', operator: 'contains', value: '1' },
          { id: 'cond_suporte', label: 'Suporte', operator: 'contains', value: '2' },
          { id: 'cond_atendente', label: 'Atendente', operator: 'contains', value: '3' }
        ]
      }, 'GitBranch');

      // Branch responses
      addNode(nodes, 'n5', 'message', 'text', '📄 Informações', baseX - 280, 50 + spacing * 4.5, { content: 'Aqui estão nossas informações:\n\n🏢 Horário: Seg-Sex 9h-18h\n📍 Endereço: ...\n📞 Telefone: ...\n🌐 Site: ...' }, 'MessageSquare');
      addNode(nodes, 'n6', 'message', 'text', '🔧 Suporte', baseX, 50 + spacing * 4.5, { content: 'Entendido! Descreva seu problema que vou registrar para nossa equipe técnica.', waitForResponse: true, saveAs: 'problema' }, 'MessageSquare');
      addNode(nodes, 'n7', 'action', 'transfer_human', '👤 Atendente', baseX + 280, 50 + spacing * 4.5, { departmentName: 'Atendimento Geral' }, 'UserPlus');
      
      // Suporte follow-up
      addNode(nodes, 'n8', 'action', 'assign_tag', 'Tag Suporte', baseX, 50 + spacing * 5.5, { tag: 'suporte-pendente' }, 'Tag');
      addNode(nodes, 'n9', 'message', 'text', 'Confirmação Suporte', baseX, 50 + spacing * 6.5, { content: 'Seu chamado foi registrado! ✅ Nossa equipe analisará e responderá em breve.' }, 'MessageSquare');

      // Else branch
      addNode(nodes, 'n10', 'message', 'text', 'Não entendi', baseX + 280, 50 + spacing * 6, { content: 'Desculpe, não entendi. Por favor, escolha uma das opções do menu.' }, 'MessageSquare');

      addEdge(edges, 'n1', 'n2');
      addEdge(edges, 'n2', 'n3');
      addEdge(edges, 'n3', 'n4');
      addEdge(edges, 'n4', 'n5', 'cond_info');
      addEdge(edges, 'n4', 'n6', 'cond_suporte');
      addEdge(edges, 'n4', 'n7', 'cond_atendente');
      addEdge(edges, 'n4', 'n10', 'else');
      addEdge(edges, 'n6', 'n8');
      addEdge(edges, 'n8', 'n9');

      summary = '💬 Fluxo de atendimento com 10 blocos:\n• Boas-vindas + Menu com 3 opções\n• Multi-condicional para rotear\n• Informações → Texto automático\n• Suporte → Registra problema + Tag\n• Atendente → Transfere para humano\n• Fallback para resposta inválida';
    }
    // === AGENDAMENTO ===
    else if (descLower.includes('agenda') || descLower.includes('agendar') || descLower.includes('consulta') || descLower.includes('horário')) {
      addNode(nodes, 'n1', 'trigger', 'whatsapp_channel', 'Canal WhatsApp', baseX, 50, { triggerWhen: 'any_message' }, 'Phone');
      addNode(nodes, 'n2', 'message', 'text', 'Boas-vindas', baseX, 50 + spacing, { content: 'Olá! 📅 Vamos agendar seu atendimento. Preciso de algumas informações.' }, 'MessageSquare');
      addNode(nodes, 'n3', 'message', 'text', 'Perguntar Nome', baseX, 50 + spacing * 2, { content: 'Qual é o seu nome?', waitForResponse: true, saveAs: 'nome' }, 'MessageSquare');
      addNode(nodes, 'n4', 'message', 'buttons', 'Tipo de Serviço', baseX, 50 + spacing * 3, { 
        content: 'Qual serviço deseja agendar?',
        buttons: ['Consulta', 'Retorno', 'Avaliação']
      }, 'List');
      addNode(nodes, 'n5', 'message', 'text', 'Data Preferida', baseX, 50 + spacing * 4, { content: 'Qual data e horário de sua preferência? (Ex: 15/03 às 14h)', waitForResponse: true, saveAs: 'data_preferida' }, 'MessageSquare');
      addNode(nodes, 'n6', 'condition', 'time', 'Horário Comercial', baseX, 50 + spacing * 5, { startHour: 8, endHour: 18 }, 'Clock');
      addNode(nodes, 'n7', 'action', 'save_crm', 'Salvar Agendamento', baseX - 150, 50 + spacing * 6, { fields: ['nome', 'data_preferida'] }, 'Database');
      addNode(nodes, 'n8', 'message', 'text', 'Confirmação', baseX - 150, 50 + spacing * 7, { content: '✅ {{nome}}, seu agendamento foi solicitado para {{data_preferida}}! Confirmaremos em breve.' }, 'MessageSquare');
      addNode(nodes, 'n9', 'message', 'text', 'Fora do Horário', baseX + 200, 50 + spacing * 6, { content: '⚠️ Nosso horário de agendamento é das 8h às 18h. Tente novamente no horário comercial!' }, 'MessageSquare');

      addEdge(edges, 'n1', 'n2');
      addEdge(edges, 'n2', 'n3');
      addEdge(edges, 'n3', 'n4');
      addEdge(edges, 'n4', 'n5');
      addEdge(edges, 'n5', 'n6');
      addEdge(edges, 'n6', 'n7', 'yes');
      addEdge(edges, 'n7', 'n8');
      addEdge(edges, 'n6', 'n9', 'no');

      summary = '📅 Fluxo de agendamento com 9 blocos:\n• Coleta nome e serviço\n• Pergunta data/horário preferido\n• Verifica horário comercial\n• Salva no CRM se dentro do horário\n• Mensagem de erro se fora';
    }
    // === PÓS-VENDA / SATISFAÇÃO ===
    else if (descLower.includes('pós-venda') || descLower.includes('satisfação') || descLower.includes('feedback') || descLower.includes('nps')) {
      addNode(nodes, 'n1', 'trigger', 'whatsapp_channel', 'Canal WhatsApp', baseX, 50, { triggerWhen: 'any_message' }, 'Phone');
      addNode(nodes, 'n2', 'message', 'text', 'Pesquisa', baseX, 50 + spacing, { content: 'Olá! 😊 Gostaríamos de saber como foi sua experiência conosco.' }, 'MessageSquare');
      addNode(nodes, 'n3', 'message', 'buttons', 'Avaliação', baseX, 50 + spacing * 2, { content: 'De 1 a 5, como avalia nosso atendimento?', buttons: ['⭐ 1-2 Ruim', '⭐⭐⭐ 3 Regular', '⭐⭐⭐⭐⭐ 4-5 Ótimo'] }, 'List');
      addNode(nodes, 'n4', 'condition', 'multi', 'Avaliar Nota', baseX, 50 + spacing * 3, {
        conditions: [
          { id: 'c_ruim', label: 'Nota Baixa', operator: 'contains', value: '1' },
          { id: 'c_otimo', label: 'Nota Alta', operator: 'contains', value: '5' }
        ]
      }, 'GitBranch');
      addNode(nodes, 'n5', 'message', 'text', 'Feedback Negativo', baseX - 250, 50 + spacing * 4.5, { content: 'Lamentamos que sua experiência não tenha sido boa. 😔 Pode nos contar o que aconteceu?', waitForResponse: true, saveAs: 'feedback' }, 'MessageSquare');
      addNode(nodes, 'n6', 'action', 'transfer_human', 'Escalar Suporte', baseX - 250, 50 + spacing * 5.5, { departmentName: 'Supervisão' }, 'UserPlus');
      addNode(nodes, 'n7', 'message', 'text', 'Feedback Positivo', baseX + 250, 50 + spacing * 4.5, { content: 'Que bom saber! 🎉 Obrigado pelo feedback positivo. Conte conosco sempre!' }, 'MessageSquare');
      addNode(nodes, 'n8', 'message', 'text', 'Feedback Regular', baseX, 50 + spacing * 5, { content: 'Obrigado pelo feedback! Vamos trabalhar para melhorar. 💪' }, 'MessageSquare');

      addEdge(edges, 'n1', 'n2');
      addEdge(edges, 'n2', 'n3');
      addEdge(edges, 'n3', 'n4');
      addEdge(edges, 'n4', 'n5', 'c_ruim');
      addEdge(edges, 'n4', 'n7', 'c_otimo');
      addEdge(edges, 'n4', 'n8', 'else');
      addEdge(edges, 'n5', 'n6');

      summary = '⭐ Fluxo de pós-venda com 8 blocos:\n• Pesquisa de satisfação com botões\n• Multi-condicional por nota\n• Nota baixa → Coleta feedback + Escala\n• Nota alta → Agradecimento\n• Regular → Mensagem de melhoria';
    }
    // === GENERIC FLOW ===
    else {
      addNode(nodes, 'n1', 'trigger', 'whatsapp_channel', 'Canal WhatsApp', baseX, 50, { triggerWhen: 'any_message' }, 'Phone');
      addNode(nodes, 'n2', 'message', 'text', 'Boas-vindas', baseX, 50 + spacing, { content: 'Olá! 👋 Como posso ajudar você hoje?' }, 'MessageSquare');
      addNode(nodes, 'n3', 'message', 'text', 'Coletar Info', baseX, 50 + spacing * 2, { content: 'Me conte mais detalhes sobre o que precisa:', waitForResponse: true, saveAs: 'solicitacao' }, 'MessageSquare');
      addNode(nodes, 'n4', 'delay', 'wait_interval', 'Aguardar', baseX, 50 + spacing * 3, { seconds: 3 }, 'Clock');
      addNode(nodes, 'n5', 'message', 'text', 'Resposta', baseX, 50 + spacing * 4, { content: 'Obrigado! Vou encaminhar sua solicitação para nossa equipe. 📩' }, 'MessageSquare');
      addNode(nodes, 'n6', 'action', 'transfer_human', 'Transferir', baseX, 50 + spacing * 5, { departmentName: 'Atendimento' }, 'UserPlus');

      addEdge(edges, 'n1', 'n2');
      addEdge(edges, 'n2', 'n3');
      addEdge(edges, 'n3', 'n4');
      addEdge(edges, 'n4', 'n5');
      addEdge(edges, 'n5', 'n6');

      summary = '🤖 Fluxo genérico com 6 blocos:\n• Boas-vindas + coleta de info\n• Delay de 3s para naturalidade\n• Resposta + transferência para humano\n\n💡 Dica: edite os blocos para personalizar!';
    }

    return { nodes, edges, summary };
  }, []);

  const handleSendMessage = async (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Simulate brief thinking delay for UX
      await new Promise(r => setTimeout(r, 800));
      
      const { nodes, edges, summary } = await generateFlowFromDescription(messageText);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `${summary}\n\nClique abaixo para aplicar ao canvas:`,
        flowData: { nodes, edges }
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível gerar o fluxo.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFlow = (flowData: { nodes: FlowNode[], edges: FlowEdge[] }) => {
    onApplyFlow(flowData.nodes, flowData.edges);
    toast({ title: '✅ Fluxo aplicado!', description: `${flowData.nodes.length} blocos e ${flowData.edges.length} conexões adicionados.` });
  };

  const showQuickPrompts = messages.length <= 1 && !isLoading;

  return (
    <div className="w-80 border-l bg-white flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${OMNI_COLOR}10, ${OMNI_COLOR}05)` }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: OMNI_COLOR }}>
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">Assistente IA</h3>
          <p className="text-xs text-muted-foreground">Crie fluxos completos com IA</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setMessages([{ id: '1', role: 'assistant', content: 'Olá! 👋 Descreva o fluxo que precisa ou use um modelo rápido abaixo.' }])}
          title="Recomeçar"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div 
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${message.role === 'user' ? 'bg-gray-100' : ''}`}
                style={message.role === 'assistant' ? { backgroundColor: `${OMNI_COLOR}15` } : {}}
              >
                {message.role === 'user' ? <User className="h-4 w-4 text-gray-600" /> : <Bot className="h-4 w-4" style={{ color: OMNI_COLOR }} />}
              </div>
              <div className={`flex-1 rounded-2xl p-3 text-sm ${message.role === 'user' ? 'bg-gray-100' : 'bg-muted/50'}`}>
                <p className="whitespace-pre-wrap text-foreground/90">{message.content}</p>
                {message.flowData && (
                  <Button onClick={() => handleApplyFlow(message.flowData!)} className="mt-3 w-full rounded-xl text-white" style={{ backgroundColor: OMNI_COLOR }}>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Aplicar Fluxo ({message.flowData.nodes.length} blocos)
                  </Button>
                )}
              </div>
            </div>
          ))}

          {/* Quick Prompts */}
          {showQuickPrompts && (
            <div className="space-y-2 mt-2">
              <p className="text-xs text-muted-foreground font-medium">⚡ Modelos rápidos:</p>
              {QUICK_PROMPTS.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => handleSendMessage(qp.prompt)}
                  className="w-full text-left p-2.5 rounded-xl border border-gray-200 hover:border-[#374DA4]/30 hover:bg-[#374DA4]/5 transition-all text-xs"
                >
                  {qp.label}
                </button>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${OMNI_COLOR}15` }}>
                <Bot className="h-4 w-4" style={{ color: OMNI_COLOR }} />
              </div>
              <div className="bg-muted/50 rounded-2xl p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Construindo fluxo...
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            placeholder="Descreva o fluxo desejado..."
            className="rounded-xl"
            disabled={isLoading}
          />
          <Button onClick={() => handleSendMessage()} disabled={!input.trim() || isLoading} size="icon" className="rounded-xl shrink-0" style={{ backgroundColor: OMNI_COLOR }}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatBotAIAssistant;
