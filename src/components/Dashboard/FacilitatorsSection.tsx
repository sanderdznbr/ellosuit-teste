import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Zap, DollarSign, CreditCard, Mail, MessageSquare, Users,
  Heart, Calendar, Bell, FileText, ShoppingCart, UserPlus,
  ClipboardList, Clock, CheckCircle, Send, RefreshCw, Globe,
  Gift, BarChart3, ChevronRight
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

type FacilitatorCategory = 'financial' | 'onboarding' | 'followup' | 'sales' | 'productivity' | 'scheduling' | 'integrations';

interface FacilitatorField {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'select' | 'number';
  options?: { label: string; value: string }[];
  defaultValue?: string;
}

interface FacilitatorTemplate {
  id: string;
  title: string;
  description: string;
  category: FacilitatorCategory;
  icon: React.ElementType;
  iconColor: string;
  hub: 'Omni' | 'Flow' | 'Suite';
  hubColor: string;
  fields: FacilitatorField[];
  buildAutomation: (config: Record<string, string>) => {
    name: string;
    description: string;
    trigger_type: string;
    trigger_config: Record<string, any>;
    nodes: any[];
    edges: any[];
    actions: any[];
  };
}

const CATEGORY_LABELS: Record<FacilitatorCategory, { label: string; emoji: string }> = {
  financial: { label: 'Financeiro & Cobranças', emoji: '💰' },
  onboarding: { label: 'Onboarding & Boas-vindas', emoji: '👋' },
  followup: { label: 'Follow-up & Relacionamento', emoji: '🤝' },
  sales: { label: 'Vendas & Propostas', emoji: '📈' },
  productivity: { label: 'Produtividade & Tarefas', emoji: '⚡' },
  scheduling: { label: 'Agendamento', emoji: '📅' },
  integrations: { label: 'Integrações', emoji: '🔗' },
};

const makeNodes = (trigger: any, action: any) => [
  { id: 'trigger-1', type: trigger.type, label: trigger.label, position: { x: 250, y: 50 }, data: {}, config: trigger.config || {} },
  { id: 'action-1', type: action.type, label: action.label, position: { x: 250, y: 250 }, data: {}, config: action.config || {} },
];
const makeEdges = () => [
  { id: 'edge-1', source: 'trigger-1', target: 'action-1' },
];

const FACILITATORS: FacilitatorTemplate[] = [
  // === FINANCEIRO ===
  {
    id: 'overdue-invoice',
    title: 'Aviso de fatura atrasada',
    description: 'Envia WhatsApp/email ao cliente quando a fatura vence',
    category: 'financial',
    icon: DollarSign,
    iconColor: '#EF4444',
    hub: 'Omni',
    hubColor: '#10B981',
    fields: [
      { key: 'channel', label: 'Canal', placeholder: 'Selecione', type: 'select', options: [{ label: 'WhatsApp', value: 'whatsapp' }, { label: 'Email', value: 'email' }], defaultValue: 'whatsapp' },
      { key: 'message', label: 'Mensagem', placeholder: 'Olá {nome}, sua fatura está atrasada...', defaultValue: 'Olá {nome}, identificamos que sua fatura está em atraso. Por favor, regularize o pagamento.' },
    ],
    buildAutomation: (c) => ({
      name: 'Aviso de fatura atrasada',
      description: 'Envia aviso automático quando fatura vence',
      trigger_type: 'schedule',
      trigger_config: { cron: '0 9 * * *', description: 'Verifica faturas vencidas diariamente às 9h' },
      nodes: makeNodes({ type: 'schedule', label: 'Verificar faturas vencidas', config: { cron: '0 9 * * *' } }, { type: c.channel === 'email' ? 'send_email' : 'send_whatsapp', label: `Enviar ${c.channel === 'email' ? 'email' : 'WhatsApp'}`, config: { message: c.message } }),
      edges: makeEdges(),
      actions: [{ type: c.channel === 'email' ? 'send_email' : 'send_whatsapp', config: { message: c.message } }],
    }),
  },
  {
    id: 'payment-reminder',
    title: 'Lembrete de pagamento próximo',
    description: 'Avisa 3 dias antes do vencimento',
    category: 'financial',
    icon: Bell,
    iconColor: '#F59E0B',
    hub: 'Omni',
    hubColor: '#10B981',
    fields: [
      { key: 'days_before', label: 'Dias antes', placeholder: '3', type: 'number', defaultValue: '3' },
      { key: 'message', label: 'Mensagem', placeholder: 'Lembrete de pagamento...', defaultValue: 'Olá {nome}, sua fatura vence em {dias} dias. Evite juros e pague em dia!' },
    ],
    buildAutomation: (c) => ({
      name: 'Lembrete de pagamento próximo',
      description: `Avisa ${c.days_before} dias antes do vencimento`,
      trigger_type: 'schedule',
      trigger_config: { cron: '0 9 * * *', days_before: parseInt(c.days_before) },
      nodes: makeNodes({ type: 'schedule', label: 'Verificar vencimentos próximos' }, { type: 'send_whatsapp', label: 'Enviar lembrete', config: { message: c.message } }),
      edges: makeEdges(),
      actions: [{ type: 'send_whatsapp', config: { message: c.message } }],
    }),
  },
  {
    id: 'payment-confirmation',
    title: 'Confirmação de pagamento recebido',
    description: 'Agradece automaticamente após pagamento',
    category: 'financial',
    icon: CheckCircle,
    iconColor: '#10B981',
    hub: 'Omni',
    hubColor: '#10B981',
    fields: [
      { key: 'message', label: 'Mensagem de agradecimento', placeholder: 'Obrigado pelo pagamento...', defaultValue: 'Olá {nome}, recebemos seu pagamento com sucesso! Obrigado pela confiança. 🙏' },
    ],
    buildAutomation: (c) => ({
      name: 'Confirmação de pagamento recebido',
      description: 'Agradece automaticamente após pagamento',
      trigger_type: 'webhook',
      trigger_config: { event: 'payment_received' },
      nodes: makeNodes({ type: 'webhook', label: 'Pagamento recebido' }, { type: 'send_whatsapp', label: 'Enviar agradecimento', config: { message: c.message } }),
      edges: makeEdges(),
      actions: [{ type: 'send_whatsapp', config: { message: c.message } }],
    }),
  },
  // === ONBOARDING ===
  {
    id: 'welcome-email',
    title: 'Boas-vindas por email',
    description: 'Email de boas-vindas quando novo lead entra na base',
    category: 'onboarding',
    icon: Mail,
    iconColor: '#374DA4',
    hub: 'Omni',
    hubColor: '#10B981',
    fields: [
      { key: 'subject', label: 'Assunto', placeholder: 'Bem-vindo(a)!', defaultValue: 'Bem-vindo(a) à nossa empresa!' },
      { key: 'message', label: 'Mensagem', placeholder: 'Olá {nome}, seja bem-vindo...', defaultValue: 'Olá {nome}, seja muito bem-vindo(a)! Estamos felizes em tê-lo(a) conosco.' },
    ],
    buildAutomation: (c) => ({
      name: 'Boas-vindas por email',
      description: 'Envia email de boas-vindas para novos leads',
      trigger_type: 'new_client',
      trigger_config: { clientType: 'any' },
      nodes: makeNodes({ type: 'new_client', label: 'Novo lead cadastrado' }, { type: 'send_email', label: 'Enviar email de boas-vindas', config: { subject: c.subject, message: c.message } }),
      edges: makeEdges(),
      actions: [{ type: 'send_email', config: { subject: c.subject, message: c.message } }],
    }),
  },
  {
    id: 'welcome-whatsapp',
    title: 'Boas-vindas por WhatsApp',
    description: 'Mensagem via WhatsApp para novo contato',
    category: 'onboarding',
    icon: MessageSquare,
    iconColor: '#25D366',
    hub: 'Omni',
    hubColor: '#10B981',
    fields: [
      { key: 'message', label: 'Mensagem', placeholder: 'Olá {nome}, bem-vindo...', defaultValue: 'Olá {nome}! 👋 Seja bem-vindo(a)! Estou aqui para ajudá-lo(a). Como posso te atender?' },
    ],
    buildAutomation: (c) => ({
      name: 'Boas-vindas por WhatsApp',
      description: 'Mensagem de boas-vindas via WhatsApp',
      trigger_type: 'new_client',
      trigger_config: { clientType: 'any' },
      nodes: makeNodes({ type: 'new_client', label: 'Novo contato' }, { type: 'send_whatsapp', label: 'Enviar boas-vindas', config: { message: c.message } }),
      edges: makeEdges(),
      actions: [{ type: 'send_whatsapp', config: { message: c.message } }],
    }),
  },
  {
    id: 'onboarding-kit',
    title: 'Kit de onboarding',
    description: 'Envia sequência de 3 mensagens nos primeiros dias',
    category: 'onboarding',
    icon: Users,
    iconColor: '#8B5CF6',
    hub: 'Suite',
    hubColor: '#374DA4',
    fields: [
      { key: 'msg1', label: 'Mensagem dia 1', placeholder: 'Bem-vindo!', defaultValue: 'Olá {nome}! Seja bem-vindo(a)! Aqui estão os primeiros passos para começar.' },
      { key: 'msg2', label: 'Mensagem dia 3', placeholder: 'Dica especial...', defaultValue: 'Olá {nome}! Esperamos que esteja gostando. Aqui vai uma dica especial para você.' },
      { key: 'msg3', label: 'Mensagem dia 7', placeholder: 'Como está sendo?', defaultValue: 'Olá {nome}! Já faz uma semana! Como está sendo sua experiência? Estamos aqui para ajudar.' },
    ],
    buildAutomation: (c) => ({
      name: 'Kit de onboarding',
      description: 'Sequência de 3 mensagens de onboarding',
      trigger_type: 'new_client',
      trigger_config: { clientType: 'any' },
      nodes: [
        { id: 'trigger-1', type: 'new_client', label: 'Novo cliente', position: { x: 250, y: 50 }, data: {}, config: {} },
        { id: 'action-1', type: 'send_whatsapp', label: 'Msg dia 1', position: { x: 250, y: 200 }, data: {}, config: { message: c.msg1 } },
        { id: 'delay-1', type: 'delay', label: 'Aguardar 3 dias', position: { x: 250, y: 350 }, data: {}, config: { duration: 3, unit: 'days' } },
        { id: 'action-2', type: 'send_whatsapp', label: 'Msg dia 3', position: { x: 250, y: 500 }, data: {}, config: { message: c.msg2 } },
        { id: 'delay-2', type: 'delay', label: 'Aguardar 4 dias', position: { x: 250, y: 650 }, data: {}, config: { duration: 4, unit: 'days' } },
        { id: 'action-3', type: 'send_whatsapp', label: 'Msg dia 7', position: { x: 250, y: 800 }, data: {}, config: { message: c.msg3 } },
      ],
      edges: [
        { id: 'e1', source: 'trigger-1', target: 'action-1' },
        { id: 'e2', source: 'action-1', target: 'delay-1' },
        { id: 'e3', source: 'delay-1', target: 'action-2' },
        { id: 'e4', source: 'action-2', target: 'delay-2' },
        { id: 'e5', source: 'delay-2', target: 'action-3' },
      ],
      actions: [{ type: 'send_whatsapp', config: { message: c.msg1 } }],
    }),
  },
  // === FOLLOW-UP ===
  {
    id: 'post-meeting-followup',
    title: 'Follow-up pós-reunião',
    description: 'Envia resumo e próximos passos após reunião',
    category: 'followup',
    icon: FileText,
    iconColor: '#0EA5E9',
    hub: 'Flow',
    hubColor: '#F59E0B',
    fields: [
      { key: 'message', label: 'Mensagem', placeholder: 'Obrigado pela reunião...', defaultValue: 'Olá {nome}, obrigado pela reunião de hoje! Seguem os próximos passos que combinamos.' },
    ],
    buildAutomation: (c) => ({
      name: 'Follow-up pós-reunião',
      description: 'Envia resumo após reunião',
      trigger_type: 'schedule',
      trigger_config: { event: 'meeting_ended' },
      nodes: makeNodes({ type: 'schedule', label: 'Reunião finalizada' }, { type: 'send_email', label: 'Enviar follow-up', config: { message: c.message } }),
      edges: makeEdges(),
      actions: [{ type: 'send_email', config: { message: c.message } }],
    }),
  },
  {
    id: 'inactive-client',
    title: 'Reengajamento de cliente inativo',
    description: 'Contata clientes sem interação há 30 dias',
    category: 'followup',
    icon: RefreshCw,
    iconColor: '#374DA4',
    hub: 'Omni',
    hubColor: '#10B981',
    fields: [
      { key: 'days', label: 'Dias de inatividade', placeholder: '30', type: 'number', defaultValue: '30' },
      { key: 'message', label: 'Mensagem', placeholder: 'Sentimos sua falta...', defaultValue: 'Olá {nome}, sentimos sua falta! Faz tempo que não nos falamos. Tem alguma novidade? Estamos à disposição!' },
    ],
    buildAutomation: (c) => ({
      name: 'Reengajamento de cliente inativo',
      description: `Contata clientes sem interação há ${c.days} dias`,
      trigger_type: 'schedule',
      trigger_config: { cron: '0 10 * * 1', inactivity_days: parseInt(c.days) },
      nodes: makeNodes({ type: 'schedule', label: `Clientes inativos (${c.days}d)` }, { type: 'send_whatsapp', label: 'Reengajar', config: { message: c.message } }),
      edges: makeEdges(),
      actions: [{ type: 'send_whatsapp', config: { message: c.message } }],
    }),
  },
  {
    id: 'client-birthday',
    title: 'Aniversário do cliente',
    description: 'Envia parabéns na data de aniversário',
    category: 'followup',
    icon: Gift,
    iconColor: '#EC4899',
    hub: 'Omni',
    hubColor: '#10B981',
    fields: [
      { key: 'message', label: 'Mensagem', placeholder: 'Parabéns!', defaultValue: '🎂 Feliz aniversário, {nome}! Desejamos um dia maravilhoso. Parabéns! 🎉' },
    ],
    buildAutomation: (c) => ({
      name: 'Aniversário do cliente',
      description: 'Envia parabéns no aniversário',
      trigger_type: 'schedule',
      trigger_config: { cron: '0 8 * * *', check: 'birthday' },
      nodes: makeNodes({ type: 'schedule', label: 'Verificar aniversários' }, { type: 'send_whatsapp', label: 'Enviar parabéns', config: { message: c.message } }),
      edges: makeEdges(),
      actions: [{ type: 'send_whatsapp', config: { message: c.message } }],
    }),
  },
  {
    id: 'satisfaction-survey',
    title: 'Pesquisa de satisfação',
    description: 'Envia NPS/pesquisa após serviço prestado',
    category: 'followup',
    icon: BarChart3,
    iconColor: '#6366F1',
    hub: 'Suite',
    hubColor: '#374DA4',
    fields: [
      { key: 'message', label: 'Mensagem', placeholder: 'Como foi sua experiência?', defaultValue: 'Olá {nome}, gostaríamos de saber como foi sua experiência conosco. De 0 a 10, quanto você nos recomendaria?' },
    ],
    buildAutomation: (c) => ({
      name: 'Pesquisa de satisfação',
      description: 'Envia NPS após serviço',
      trigger_type: 'proposal_status',
      trigger_config: { status: 'completed' },
      nodes: makeNodes({ type: 'proposal_status', label: 'Serviço concluído' }, { type: 'send_whatsapp', label: 'Enviar pesquisa', config: { message: c.message } }),
      edges: makeEdges(),
      actions: [{ type: 'send_whatsapp', config: { message: c.message } }],
    }),
  },
  // === VENDAS ===
  {
    id: 'proposal-followup',
    title: 'Proposta enviada - follow-up',
    description: 'Cobra retorno 3 dias após envio de proposta',
    category: 'sales',
    icon: FileText,
    iconColor: '#374DA4',
    hub: 'Suite',
    hubColor: '#374DA4',
    fields: [
      { key: 'days', label: 'Dias após envio', placeholder: '3', type: 'number', defaultValue: '3' },
      { key: 'message', label: 'Mensagem', placeholder: 'Sobre a proposta...', defaultValue: 'Olá {nome}, gostaria de saber se conseguiu analisar a proposta que enviamos. Posso esclarecer alguma dúvida?' },
    ],
    buildAutomation: (c) => ({
      name: 'Follow-up de proposta',
      description: `Cobra retorno ${c.days} dias após proposta`,
      trigger_type: 'proposal_status',
      trigger_config: { status: 'sent', delay_days: parseInt(c.days) },
      nodes: [
        { id: 'trigger-1', type: 'proposal_status', label: 'Proposta enviada', position: { x: 250, y: 50 }, data: {}, config: { status: 'sent' } },
        { id: 'delay-1', type: 'delay', label: `Aguardar ${c.days} dias`, position: { x: 250, y: 200 }, data: {}, config: { duration: parseInt(c.days), unit: 'days' } },
        { id: 'action-1', type: 'send_whatsapp', label: 'Enviar follow-up', position: { x: 250, y: 350 }, data: {}, config: { message: c.message } },
      ],
      edges: [{ id: 'e1', source: 'trigger-1', target: 'delay-1' }, { id: 'e2', source: 'delay-1', target: 'action-1' }],
      actions: [{ type: 'send_whatsapp', config: { message: c.message } }],
    }),
  },
  {
    id: 'qualified-lead',
    title: 'Lead qualificado - notificação',
    description: 'Avisa a equipe quando lead é qualificado',
    category: 'sales',
    icon: UserPlus,
    iconColor: '#10B981',
    hub: 'Omni',
    hubColor: '#10B981',
    fields: [
      { key: 'message', label: 'Mensagem interna', placeholder: 'Novo lead qualificado!', defaultValue: '🎯 Novo lead qualificado: {nome} ({email}). Entre em contato o mais rápido possível!' },
    ],
    buildAutomation: (c) => ({
      name: 'Lead qualificado - notificação',
      description: 'Notifica equipe sobre lead qualificado',
      trigger_type: 'client_updated',
      trigger_config: { fields: ['status'], value: 'qualified' },
      nodes: makeNodes({ type: 'client_updated', label: 'Lead qualificado' }, { type: 'send_whatsapp', label: 'Notificar equipe', config: { message: c.message } }),
      edges: makeEdges(),
      actions: [{ type: 'send_whatsapp', config: { message: c.message } }],
    }),
  },
  {
    id: 'abandoned-cart',
    title: 'Carrinho abandonado',
    description: 'Relembra cliente sobre interesse não convertido',
    category: 'sales',
    icon: ShoppingCart,
    iconColor: '#374DA4',
    hub: 'Omni',
    hubColor: '#10B981',
    fields: [
      { key: 'message', label: 'Mensagem', placeholder: 'Notamos seu interesse...', defaultValue: 'Olá {nome}, notamos que você demonstrou interesse em nossos serviços. Posso ajudá-lo(a) a finalizar?' },
    ],
    buildAutomation: (c) => ({
      name: 'Carrinho abandonado',
      description: 'Lembra cliente sobre interesse',
      trigger_type: 'schedule',
      trigger_config: { cron: '0 14 * * *', check: 'abandoned_interest' },
      nodes: makeNodes({ type: 'schedule', label: 'Verificar interesses' }, { type: 'send_whatsapp', label: 'Reengajar', config: { message: c.message } }),
      edges: makeEdges(),
      actions: [{ type: 'send_whatsapp', config: { message: c.message } }],
    }),
  },
  // === PRODUTIVIDADE ===
  {
    id: 'overdue-task',
    title: 'Tarefa atrasada - alerta',
    description: 'Notifica quando tarefa passa do prazo',
    category: 'productivity',
    icon: ClipboardList,
    iconColor: '#EF4444',
    hub: 'Flow',
    hubColor: '#F59E0B',
    fields: [
      { key: 'message', label: 'Mensagem', placeholder: 'Tarefa atrasada!', defaultValue: '⚠️ A tarefa "{tarefa}" está atrasada! Prazo era {prazo}. Por favor, atualize o status.' },
    ],
    buildAutomation: (c) => ({
      name: 'Tarefa atrasada - alerta',
      description: 'Alerta sobre tarefas atrasadas',
      trigger_type: 'schedule',
      trigger_config: { cron: '0 9 * * *', check: 'overdue_tasks' },
      nodes: makeNodes({ type: 'schedule', label: 'Verificar tarefas atrasadas' }, { type: 'send_whatsapp', label: 'Enviar alerta', config: { message: c.message } }),
      edges: makeEdges(),
      actions: [{ type: 'send_whatsapp', config: { message: c.message } }],
    }),
  },
  {
    id: 'daily-task-summary',
    title: 'Resumo diário de tarefas',
    description: 'Envia resumo das tarefas pendentes todo dia às 8h',
    category: 'productivity',
    icon: Clock,
    iconColor: '#6366F1',
    hub: 'Flow',
    hubColor: '#F59E0B',
    fields: [
      { key: 'time', label: 'Horário de envio', placeholder: '08:00', defaultValue: '08:00' },
    ],
    buildAutomation: (c) => ({
      name: 'Resumo diário de tarefas',
      description: 'Envia resumo de tarefas pendentes',
      trigger_type: 'schedule',
      trigger_config: { cron: `0 ${c.time.split(':')[0]} * * *` },
      nodes: makeNodes({ type: 'schedule', label: `Todos os dias às ${c.time}` }, { type: 'send_whatsapp', label: 'Enviar resumo', config: { message: '📋 Bom dia! Aqui está seu resumo de tarefas pendentes para hoje.' } }),
      edges: makeEdges(),
      actions: [{ type: 'send_whatsapp', config: { message: 'Resumo diário de tarefas' } }],
    }),
  },
  {
    id: 'task-assigned',
    title: 'Nova tarefa atribuída',
    description: 'Avisa membro quando recebe tarefa',
    category: 'productivity',
    icon: Send,
    iconColor: '#0EA5E9',
    hub: 'Flow',
    hubColor: '#F59E0B',
    fields: [
      { key: 'message', label: 'Mensagem', placeholder: 'Nova tarefa!', defaultValue: '📌 Nova tarefa atribuída a você: "{tarefa}". Prazo: {prazo}.' },
    ],
    buildAutomation: (c) => ({
      name: 'Nova tarefa atribuída',
      description: 'Notifica sobre nova tarefa',
      trigger_type: 'webhook',
      trigger_config: { event: 'task_assigned' },
      nodes: makeNodes({ type: 'webhook', label: 'Tarefa atribuída' }, { type: 'send_whatsapp', label: 'Notificar responsável', config: { message: c.message } }),
      edges: makeEdges(),
      actions: [{ type: 'send_whatsapp', config: { message: c.message } }],
    }),
  },
  // === AGENDAMENTO ===
  {
    id: 'booking-confirmation',
    title: 'Confirmação de agendamento',
    description: 'Confirma automaticamente reunião agendada',
    category: 'scheduling',
    icon: Calendar,
    iconColor: '#10B981',
    hub: 'Flow',
    hubColor: '#F59E0B',
    fields: [
      { key: 'message', label: 'Mensagem', placeholder: 'Agendamento confirmado!', defaultValue: '✅ Olá {nome}, seu agendamento para {data} às {hora} foi confirmado! Até lá!' },
    ],
    buildAutomation: (c) => ({
      name: 'Confirmação de agendamento',
      description: 'Confirma reunião agendada',
      trigger_type: 'webhook',
      trigger_config: { event: 'booking_created' },
      nodes: makeNodes({ type: 'webhook', label: 'Agendamento criado' }, { type: 'send_whatsapp', label: 'Confirmar', config: { message: c.message } }),
      edges: makeEdges(),
      actions: [{ type: 'send_whatsapp', config: { message: c.message } }],
    }),
  },
  {
    id: 'meeting-reminder',
    title: 'Lembrete de reunião',
    description: 'Avisa 1h antes da reunião por WhatsApp',
    category: 'scheduling',
    icon: Bell,
    iconColor: '#F59E0B',
    hub: 'Flow',
    hubColor: '#F59E0B',
    fields: [
      { key: 'minutes_before', label: 'Minutos antes', placeholder: '60', type: 'number', defaultValue: '60' },
      { key: 'message', label: 'Mensagem', placeholder: 'Lembrete!', defaultValue: '⏰ Olá {nome}, lembrete: sua reunião começa em {minutos} minutos. Até já!' },
    ],
    buildAutomation: (c) => ({
      name: 'Lembrete de reunião',
      description: `Lembra ${c.minutes_before}min antes`,
      trigger_type: 'schedule',
      trigger_config: { minutes_before: parseInt(c.minutes_before), check: 'upcoming_meetings' },
      nodes: makeNodes({ type: 'schedule', label: `${c.minutes_before}min antes` }, { type: 'send_whatsapp', label: 'Lembrete', config: { message: c.message } }),
      edges: makeEdges(),
      actions: [{ type: 'send_whatsapp', config: { message: c.message } }],
    }),
  },
  {
    id: 'auto-reschedule',
    title: 'Reagendamento automático',
    description: 'Oferece nova data quando cliente cancela',
    category: 'scheduling',
    icon: RefreshCw,
    iconColor: '#8B5CF6',
    hub: 'Flow',
    hubColor: '#F59E0B',
    fields: [
      { key: 'message', label: 'Mensagem', placeholder: 'Que tal outra data?', defaultValue: 'Olá {nome}, vimos que você cancelou o agendamento. Gostaria de escolher uma nova data? Estamos à disposição!' },
    ],
    buildAutomation: (c) => ({
      name: 'Reagendamento automático',
      description: 'Oferece nova data após cancelamento',
      trigger_type: 'webhook',
      trigger_config: { event: 'booking_cancelled' },
      nodes: makeNodes({ type: 'webhook', label: 'Agendamento cancelado' }, { type: 'send_whatsapp', label: 'Oferecer reagendamento', config: { message: c.message } }),
      edges: makeEdges(),
      actions: [{ type: 'send_whatsapp', config: { message: c.message } }],
    }),
  },
  // === INTEGRAÇÕES ===
  {
    id: 'webhook-lead',
    title: 'Webhook recebido - processar lead',
    description: 'Recebe dados de formulário externo, cria contato e notifica',
    category: 'integrations',
    icon: Globe,
    iconColor: '#64748B',
    hub: 'Suite',
    hubColor: '#374DA4',
    fields: [
      { key: 'notify_message', label: 'Mensagem de notificação', placeholder: 'Novo lead recebido!', defaultValue: '🔔 Novo lead via formulário externo: {nome} ({email}). Fonte: {fonte}.' },
    ],
    buildAutomation: (c) => ({
      name: 'Webhook - processar lead',
      description: 'Processa dados de formulário externo',
      trigger_type: 'webhook',
      trigger_config: { method: 'POST', path: '/webhook/lead' },
      nodes: [
        { id: 'trigger-1', type: 'webhook', label: 'Webhook recebido', position: { x: 250, y: 50 }, data: {}, config: { method: 'POST' } },
        { id: 'action-1', type: 'create_client', label: 'Criar contato', position: { x: 250, y: 200 }, data: {}, config: { fieldMapping: {} } },
        { id: 'action-2', type: 'send_whatsapp', label: 'Notificar equipe', position: { x: 250, y: 350 }, data: {}, config: { message: c.notify_message } },
      ],
      edges: [{ id: 'e1', source: 'trigger-1', target: 'action-1' }, { id: 'e2', source: 'action-1', target: 'action-2' }],
      actions: [{ type: 'create_client', config: {} }, { type: 'send_whatsapp', config: { message: c.notify_message } }],
    }),
  },
];

const FacilitatorsSection: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedFacilitator, setSelectedFacilitator] = useState<FacilitatorTemplate | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isActivating, setIsActivating] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const openDialog = (f: FacilitatorTemplate) => {
    const defaults: Record<string, string> = {};
    f.fields.forEach(field => { defaults[field.key] = field.defaultValue || ''; });
    setConfig(defaults);
    setSelectedFacilitator(f);
  };

  const activateFacilitator = async () => {
    if (!selectedFacilitator || !user?.id) return;
    setIsActivating(true);

    try {
      const { data: companyData } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyData?.company_id) throw new Error('Empresa não encontrada');

      const automation = selectedFacilitator.buildAutomation(config);

      const { error } = await supabase.from('automations').insert({
        company_id: companyData.company_id,
        created_by: user.id,
        name: automation.name,
        description: automation.description,
        trigger_type: automation.trigger_type,
        trigger_config: automation.trigger_config,
        nodes: automation.nodes,
        edges: automation.edges,
        actions: automation.actions,
        is_active: true,
      });

      if (error) throw error;

      toast({
        title: '✅ Facilitador ativado!',
        description: `"${automation.name}" foi criado e está ativo.`,
      });

      setSelectedFacilitator(null);
      setConfig({});
    } catch (err: any) {
      toast({
        title: 'Erro ao ativar',
        description: err.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsActivating(false);
    }
  };

  const categories = Object.keys(CATEGORY_LABELS) as FacilitatorCategory[];
  const displayedFacilitators = showAll ? FACILITATORS : FACILITATORS.slice(0, 6);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.9 }}
        className="w-full max-w-3xl mt-6 mb-4"
      >
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-white/50" />
            <h2 className="text-sm font-semibold text-white/70 tracking-wide uppercase">Facilitadores</h2>
          </div>
          {!showAll && FACILITATORS.length > 6 && (
            <button
              onClick={() => setShowAll(true)}
              className="text-xs text-white/50 hover:text-white/80 transition-colors flex items-center gap-1"
            >
              Ver todos ({FACILITATORS.length})
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {displayedFacilitators.map((f, i) => (
            <motion.button
              key={f.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 1.0 + i * 0.04 }}
              onClick={() => openDialog(f)}
              className="group text-left rounded-2xl overflow-hidden border border-white/10 hover:border-white/25 bg-white/[0.07] hover:bg-white/[0.12] backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-black/10 hover:-translate-y-0.5 p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div
                  className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${f.iconColor}20` }}
                >
                  <f.icon className="h-4.5 w-4.5" style={{ color: f.iconColor }} />
                </div>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white/90"
                  style={{ backgroundColor: `${f.hubColor}cc` }}
                >
                  {f.hub}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white/90 mb-1 leading-tight">{f.title}</h3>
              <p className="text-[11px] text-white/40 leading-snug line-clamp-2">{f.description}</p>
            </motion.button>
          ))}
        </div>

        {showAll && (
          <button
            onClick={() => setShowAll(false)}
            className="mt-3 w-full text-xs text-white/40 hover:text-white/60 transition-colors text-center py-2"
          >
            Mostrar menos
          </button>
        )}
      </motion.div>

      {/* Configuration Dialog */}
      <Dialog open={!!selectedFacilitator} onOpenChange={(open) => { if (!open) setSelectedFacilitator(null); }}>
        <DialogContent className="sm:max-w-md bg-[#1a1a2e] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-white">
              {selectedFacilitator && (
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${selectedFacilitator.iconColor}20` }}
                >
                  <selectedFacilitator.icon className="h-5 w-5" style={{ color: selectedFacilitator.iconColor }} />
                </div>
              )}
              <div>
                <span>{selectedFacilitator?.title}</span>
                <Badge
                  className="ml-2 text-[10px]"
                  style={{ backgroundColor: `${selectedFacilitator?.hubColor}cc`, color: 'white', borderColor: 'transparent' }}
                >
                  {selectedFacilitator?.hub}
                </Badge>
              </div>
            </DialogTitle>
            <DialogDescription className="text-white/50">
              {selectedFacilitator?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {selectedFacilitator?.fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-white/70 text-xs">{field.label}</Label>
                {field.type === 'select' ? (
                  <select
                    className="w-full rounded-lg border border-white/10 bg-white/5 text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white/20"
                    value={config[field.key] || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                  >
                    {field.options?.map(opt => (
                      <option key={opt.value} value={opt.value} className="bg-[#1a1a2e]">{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type={field.type || 'text'}
                    placeholder={field.placeholder}
                    value={config[field.key] || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-white/20"
                  />
                )}
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setSelectedFacilitator(null)}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button
              onClick={activateFacilitator}
              disabled={isActivating}
              className="bg-white text-[#1a1a2e] hover:bg-white/90 font-semibold"
            >
              {isActivating ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Ativando...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-1" />
                  Ativar Facilitador
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FacilitatorsSection;
