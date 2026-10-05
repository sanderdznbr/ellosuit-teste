import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  MessageSquare, Zap, GitBranch, Clock, Mail, Hash, 
  UserPlus, Database, Send, Globe, Bot,
  Tag, Phone, Image, FileText, List, ToggleLeft, Search, Brain, Plus,
  PanelLeftClose, PanelLeftOpen, GripVertical
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { BlockCategory, BlockDefinition } from './types';

const OMNI_COLOR = '#374DA4';

const BLOCK_CATEGORIES: BlockCategory[] = [
  {
    id: 'start',
    label: 'INÍCIO',
    color: OMNI_COLOR,
    blocks: [
      { 
        type: 'trigger', 
        subType: 'whatsapp_channel', 
        label: 'Iniciar por um canal', 
        description: 'Inicia quando o contato entra através de um canal.', 
        icon: 'Phone', 
        defaultConfig: { sessionId: '', triggerWhen: 'any_message' } 
      },
      { 
        type: 'trigger', 
        subType: 'manual', 
        label: 'Iniciar manualmente', 
        description: 'Inicia quando o atendente ativa o fluxo manualmente.', 
        icon: 'Zap', 
        defaultConfig: {} 
      },
    ]
  },
  {
    id: 'conditions',
    label: 'CONDIÇÃO',
    color: OMNI_COLOR,
    blocks: [
      { 
        type: 'condition', 
        subType: 'weekday', 
        label: 'Dias da semana', 
        description: 'Defina ações a partir de cada dia da semana.', 
        icon: 'Clock', 
        defaultConfig: { days: [] },
        locked: false
      },
      { 
        type: 'condition', 
        subType: 'time', 
        label: 'Horários', 
        description: 'Defina ações a partir de intervalos de horários.', 
        icon: 'Clock', 
        defaultConfig: { startHour: 9, endHour: 18 },
        locked: false
      },
      { 
        type: 'condition', 
        subType: 'if_else', 
        label: 'Definir condição', 
        description: 'Defina regras específicas para o seu fluxo.', 
        icon: 'GitBranch', 
        defaultConfig: { conditionType: 'user_response', operator: 'contains', value: '' }
      },
      { 
        type: 'condition', 
        subType: 'multi', 
        label: 'Multi-condicional', 
        description: 'Defina múltiplas regras e múltiplos fluxo de saída.', 
        icon: 'GitBranch', 
        defaultConfig: { conditions: [{ id: 'cond_1', label: 'Condição 1', operator: 'contains', value: '' }, { id: 'cond_2', label: 'Condição 2', operator: 'contains', value: '' }] }
      },
    ]
  },
  {
    id: 'delays',
    label: 'DELAYS',
    color: OMNI_COLOR,
    blocks: [
      { 
        type: 'delay', 
        subType: 'wait_interval', 
        label: 'Aguardar intervalo', 
        description: 'Pausa o fluxo por um tempo específico.', 
        icon: 'Clock', 
        defaultConfig: { seconds: 5 } 
      },
      { 
        type: 'delay', 
        subType: 'wait_until', 
        label: 'Aguardar até', 
        description: 'Pausa até uma data/hora específica.', 
        icon: 'Clock', 
        defaultConfig: { datetime: '' } 
      },
    ]
  },
  {
    id: 'messages',
    label: 'MENSAGENS',
    color: OMNI_COLOR,
    blocks: [
      { 
        type: 'message', 
        subType: 'text', 
        label: 'Enviar mensagem', 
        description: 'Envia uma mensagem de texto.', 
        icon: 'MessageSquare', 
        defaultConfig: { content: '' } 
      },
      { 
        type: 'message', 
        subType: 'buttons', 
        label: 'Botões de Resposta', 
        description: 'Envia até 3 botões interativos (API Oficial).', 
        icon: 'ToggleLeft', 
        defaultConfig: { content: '', buttons: [], interactive_type: 'reply_buttons' } 
      },
      { 
        type: 'message', 
        subType: 'list', 
        label: 'Lista de Opções', 
        description: 'Menu dropdown com até 10 opções (API Oficial).', 
        icon: 'List', 
        defaultConfig: { content: '', button_text: 'Ver opções', sections: [{ title: 'Opções', rows: [{ id: '1', title: 'Opção 1' }] }] } 
      },
      { 
        type: 'message', 
        subType: 'image', 
        label: 'Enviar mídia', 
        description: 'Envia imagem, vídeo ou arquivo.', 
        icon: 'Image', 
        defaultConfig: { url: '', caption: '' } 
      },
    ]
  },
  {
    id: 'actions',
    label: 'AÇÕES',
    color: OMNI_COLOR,
    blocks: [
      { 
        type: 'action', 
        subType: 'assign_tag', 
        label: 'Atribuir Tag', 
        description: 'Adiciona uma etiqueta ao contato.', 
        icon: 'Tag', 
        defaultConfig: { tag: '' } 
      },
      { 
        type: 'action', 
        subType: 'transfer_human', 
        label: 'Transferir para Humano', 
        description: 'Encerra o bot e transfere para atendimento.', 
        icon: 'UserPlus', 
        defaultConfig: { departmentName: '' } 
      },
      { 
        type: 'action', 
        subType: 'save_crm', 
        label: 'Salvar no CRM', 
        description: 'Salva o contato como lead.', 
        icon: 'Database', 
        defaultConfig: { nameField: '{{nome}}' } 
      },
      { 
        type: 'action', 
        subType: 'call_api', 
        label: 'Chamar API', 
        description: 'Faz requisição para sistema externo.', 
        icon: 'Globe', 
        defaultConfig: { url: '', method: 'POST' } 
      },
      { 
        type: 'action', 
        subType: 'transfer_ai_agent', 
        label: 'Transferir para IA', 
        description: 'Encerra o bot e ativa um agente de IA.', 
        icon: 'Bot', 
        defaultConfig: { agentId: '' } 
      },
      {
        type: 'action',
        subType: 'ai_agent_inline',
        label: 'Agente de IA',
        description: 'Responde com IA usando as instruções definidas aqui mesmo.',
        icon: 'Brain',
        defaultConfig: {
          systemPrompt: 'Você é um atendente simpático e prestativo. Responda em português brasileiro, de forma curta e clara.',
          model: 'google/gemini-2.5-flash',
          saveAs: 'ai_response',
          sendReply: true,
          fallbackMessage: 'Desculpe, não consegui processar agora. Pode tentar de novo?'
        }
      },
    ]
  }
];

const iconMap: Record<string, React.ComponentType<any>> = {
  Phone, Mail, Hash, MessageSquare, Clock, Globe, ToggleLeft, Bot,
  List, Image, FileText, GitBranch, Database, Tag, UserPlus, Send, Zap, Brain
};

interface ChatBotSidebarProps {
  onDragStart: (block: BlockDefinition) => void;
}

const CATEGORY_TONE: Record<string, string> = {
  start: 'text-blue-600 bg-blue-50',
  conditions: 'text-amber-600 bg-amber-50',
  delays: 'text-purple-600 bg-purple-50',
  messages: 'text-emerald-600 bg-emerald-50',
  actions: 'text-rose-600 bg-rose-50',
};

const ChatBotSidebar: React.FC<ChatBotSidebarProps> = ({ onDragStart }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(true);

  const filteredCategories = BLOCK_CATEGORIES.map(category => ({
    ...category,
    blocks: category.blocks.filter(block =>
      block.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      block.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.blocks.length > 0);

  if (!isOpen) {
    return (
      <div className="absolute left-6 top-1/2 -translate-y-1/2 z-[60]">
        <button
          onClick={() => setIsOpen(true)}
          title="Abrir componentes"
          className="flex flex-col items-center gap-2 p-2 px-3 rounded-2xl bg-[#f3f2ee] dark:bg-[#161616] border border-border/60 shadow-lg hover:scale-105 active:scale-95 transition-all group"
        >
          <div className="w-8 h-8 rounded-xl bg-white dark:bg-white/5 flex items-center justify-center shadow-sm group-hover:bg-[#374DA4] group-hover:text-white transition-colors">
            <Plus className="h-4 w-4" />
          </div>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider [writing-mode:vertical-lr] rotate-180">
            Componentes
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-[268px] flex-shrink-0 bg-[#f3f2ee] dark:bg-[#161616] border-r border-border/60 flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="h-14 px-3 flex items-center justify-between border-b border-border/60">
        <span className="text-sm font-medium text-foreground">Componentes</span>
        <button
          onClick={() => setIsOpen(false)}
          title="Fechar painel"
          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2.5 border-b border-border/60">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar componente"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs bg-white/50 dark:bg-white/5 border-0 rounded-lg focus-visible:ring-1 focus-visible:ring-border"
          />
        </div>
      </div>

      {/* Blocks — list style */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-2 py-3 space-y-5">
          {filteredCategories.map((category) => (
            <div key={category.id} className="group/category">
              <div className="px-3 mb-2 flex items-center justify-between text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                {category.label}
                <div className="h-px flex-1 bg-border/40 ml-3" />
              </div>

              <div className="space-y-1">
                {category.blocks.map((block) => {
                  const Icon = iconMap[block.icon] || MessageSquare;
                  const isLocked = (block as any).locked;

                  return (
                    <div
                      key={`${block.type}-${block.subType}`}
                      draggable={!isLocked}
                      title={block.description}
                      onDragStart={(e) => {
                        if (isLocked) { e.preventDefault(); return; }
                        e.dataTransfer.setData('block', JSON.stringify(block));
                        e.dataTransfer.effectAllowed = 'copy';
                        onDragStart(block);
                      }}
                      className={cn(
                        'group flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-200 mx-1.5',
                        isLocked
                          ? 'opacity-40 cursor-not-allowed'
                          : 'cursor-grab hover:bg-white dark:hover:bg-white/5 hover:shadow-sm active:cursor-grabbing active:scale-[0.98]'
                      )}
                    >
                      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm transition-transform group-hover:scale-105', CATEGORY_TONE[category.id])}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-[13px] text-foreground truncate flex-1">
                        {block.label}
                      </span>
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredCategories.length === 0 && (
            <p className="px-2 py-6 text-xs text-muted-foreground text-center">
              Nenhum componente encontrado.
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ChatBotSidebar;
