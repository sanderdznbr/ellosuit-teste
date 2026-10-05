import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Zap, DollarSign, Bell, CheckCircle, Mail, MessageSquare, Users,
  RefreshCw, Gift, BarChart3, FileText, UserPlus, ShoppingCart,
  ClipboardList, Clock, Send, Calendar, Globe, Search,
  AlertTriangle, Wifi, WifiOff, Phone, AtSign, Paperclip, FileDown,
  Sparkles, Bot, ChevronRight, Plus, X, Target, Eye, HelpCircle, Loader2,
  User, Hash, Info, TrendingUp, Star, ArrowRight, Megaphone, Shield,
  Headphones, Link2, LayoutGrid, Filter
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

// Cover images
import coverOverdueInvoice from '@/assets/facilitators/overdue-invoice.jpg';
import coverPaymentReminder from '@/assets/facilitators/payment-reminder.jpg';
import coverPaymentConfirmation from '@/assets/facilitators/payment-confirmation.jpg';
import coverWelcomeEmail from '@/assets/facilitators/welcome-email.jpg';
import coverWelcomeWhatsapp from '@/assets/facilitators/welcome-whatsapp.jpg';
import coverOnboardingKit from '@/assets/facilitators/onboarding-kit.jpg';
import coverPostMeeting from '@/assets/facilitators/post-meeting.jpg';
import coverInactiveClient from '@/assets/facilitators/inactive-client.jpg';
import coverBirthday from '@/assets/facilitators/birthday.jpg';
import coverSatisfaction from '@/assets/facilitators/satisfaction.jpg';
import coverProposalFollowup from '@/assets/facilitators/proposal-followup.jpg';
import coverQualifiedLead from '@/assets/facilitators/qualified-lead.jpg';
import coverAbandonedCart from '@/assets/facilitators/abandoned-cart.jpg';
import coverOverdueTask from '@/assets/facilitators/overdue-task.jpg';
import coverDailySummary from '@/assets/facilitators/daily-summary.jpg';
import coverTaskAssigned from '@/assets/facilitators/task-assigned.jpg';
import coverBookingConfirmation from '@/assets/facilitators/booking-confirmation.jpg';
import coverMeetingReminder from '@/assets/facilitators/meeting-reminder.jpg';
import coverAutoReschedule from '@/assets/facilitators/auto-reschedule.jpg';
import coverWebhookLead from '@/assets/facilitators/webhook-lead.jpg';
import coverAutoReplyOffhours from '@/assets/facilitators/auto-reply-offhours.jpg';
import coverFaqWhatsapp from '@/assets/facilitators/faq-whatsapp.jpg';
import coverMassBroadcast from '@/assets/facilitators/mass-broadcast.jpg';
import coverWeeklyReport from '@/assets/facilitators/weekly-report.jpg';
import coverSendContract from '@/assets/facilitators/send-contract.jpg';
import coverContractReminder from '@/assets/facilitators/contract-reminder.jpg';
import coverNewSaleAlert from '@/assets/facilitators/new-sale-alert.jpg';
import coverGoalAchieved from '@/assets/facilitators/goal-achieved.jpg';
import coverAiAutoResponse from '@/assets/facilitators/ai-auto-response.jpg';
import coverAutoReceipt from '@/assets/facilitators/auto-receipt.jpg';
import coverReferralThanks from '@/assets/facilitators/referral-thanks.jpg';
import coverAutoInstagram from '@/assets/facilitators/auto-instagram.jpg';
import coverCollectFeedback from '@/assets/facilitators/collect-feedback.jpg';
import coverOnboardingChecklist from '@/assets/facilitators/onboarding-checklist.jpg';
import coverPromoCampaign from '@/assets/facilitators/promo-campaign.jpg';
import coverLoyaltyProgram from '@/assets/facilitators/loyalty-program.jpg';
import coverSlaAlert from '@/assets/facilitators/sla-alert.jpg';
import coverWinBack from '@/assets/facilitators/win-back.jpg';
import coverExpiringOffer from '@/assets/facilitators/expiring-offer.jpg';
import coverLeadScoring from '@/assets/facilitators/lead-scoring.jpg';
import coverSubscriptionRenewal from '@/assets/facilitators/subscription-renewal.jpg';
import coverLeadCaptureBot from '@/assets/facilitators/lead-capture-bot.jpg';
import coverUpsellCross from '@/assets/facilitators/upsell-cross.jpg';
import coverWarrantyExpiry from '@/assets/facilitators/warranty-expiry.jpg';
import coverSeasonalCampaign from '@/assets/facilitators/seasonal-campaign.jpg';
import coverMeetingNotes from '@/assets/facilitators/meeting-notes.jpg';
import coverNewTeamMember from '@/assets/facilitators/new-team-member.jpg';
import coverAppointmentReminderSms from '@/assets/facilitators/appointment-reminder-sms.jpg';
import coverPostPurchase from '@/assets/facilitators/post-purchase.jpg';
import coverContractSigned from '@/assets/facilitators/contract-signed.jpg';
import coverAnnouncement from '@/assets/facilitators/announcement.jpg';
import coverMonthlyReport from '@/assets/facilitators/monthly-report.jpg';
import coverPasswordExpiry from '@/assets/facilitators/password-expiry.jpg';
import coverEventInvite from '@/assets/facilitators/event-invite.jpg';
import coverPartnershipFollowup from '@/assets/facilitators/partnership-followup.jpg';
import coverAiFollowup from '@/assets/facilitators/ai-followup.jpg';
import coverReviewRequest from '@/assets/facilitators/review-request.jpg';
type FacilitatorCategory = 'all' | 'financial' | 'onboarding' | 'followup' | 'sales' | 'productivity' | 'scheduling' | 'integrations' | 'marketing' | 'support';

interface ConnectedChannel {
  type: 'whatsapp' | 'email';
  id: string;
  label: string;
  sublabel?: string;
  status: string;
}

interface RecipientOption {
  type: 'all_clients' | 'tag' | 'manual' | 'specific_client' | 'auto';
  label: string;
  description: string;
}

interface ConfigSection {
  title: string;
  icon?: React.ElementType;
  fields: ConfigField[];
}

interface ConfigField {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'select' | 'number' | 'textarea' | 'channel' | 'toggle' | 'currency' | 'recipient' | 'date' | 'time_select';
  options?: { label: string; value: string }[];
  defaultValue?: string;
  helpText?: string;
  aiHelpPrompt?: string;
  required?: boolean;
  channelType?: 'whatsapp' | 'email' | 'both';
  recipientOptions?: RecipientOption[];
  span?: 'full' | 'half';
}

interface FacilitatorTemplate {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  category: Exclude<FacilitatorCategory, 'all'>;
  icon: React.ElementType;
  iconColor: string;
  hub: 'Omni' | 'Flow' | 'Suite';
  hubColor: string;
  cover: string;
  requiredChannels: ('whatsapp' | 'email')[];
  howItWorks: string[];
  configSections: ConfigSection[];
  buildAutomation: (config: Record<string, string>, channels: ConnectedChannel[]) => {
    name: string;
    description: string;
    trigger_type: string;
    trigger_config: Record<string, any>;
    nodes: any[];
    edges: any[];
    actions: any[];
  };
}

const CATEGORY_FILTERS: { id: FacilitatorCategory; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'all', label: 'Todos', icon: LayoutGrid, description: 'Todos os apps disponíveis' },
  { id: 'financial', label: 'Financeiro', icon: DollarSign, description: 'Cobranças, pagamentos e recibos' },
  { id: 'onboarding', label: 'Onboarding', icon: UserPlus, description: 'Boas-vindas e primeiros passos' },
  { id: 'followup', label: 'Follow-up', icon: RefreshCw, description: 'Reengajamento e acompanhamento' },
  { id: 'sales', label: 'Vendas', icon: TrendingUp, description: 'Propostas, leads e conversão' },
  { id: 'productivity', label: 'Produtividade', icon: Zap, description: 'Tarefas, resumos e organização' },
  { id: 'scheduling', label: 'Agendamento', icon: Calendar, description: 'Reuniões e lembretes' },
  { id: 'marketing', label: 'Marketing', icon: Megaphone, description: 'Campanhas e promoções' },
  { id: 'support', label: 'Atendimento', icon: Headphones, description: 'FAQs, respostas e SLA' },
  { id: 'integrations', label: 'Integrações', icon: Link2, description: 'Webhooks e conexões externas' },
];

const makeNodes = (trigger: any, action: any) => [
  { id: 'trigger-1', type: trigger.type, label: trigger.label, position: { x: 250, y: 50 }, data: {}, config: trigger.config || {} },
  { id: 'action-1', type: action.type, label: action.label, position: { x: 250, y: 250 }, data: {}, config: action.config || {} },
];
const makeEdges = () => [{ id: 'edge-1', source: 'trigger-1', target: 'action-1' }];

// ─── Template data ───

const FACILITATORS: FacilitatorTemplate[] = [
  // ── FINANCEIRO ──
  {
    id: 'overdue-invoice', title: 'Aviso de fatura atrasada',
    description: 'Envia WhatsApp/email ao cliente quando a fatura vence',
    longDescription: 'Automatize a cobrança de faturas vencidas. O sistema verifica diariamente quais clientes possuem faturas em atraso e envia uma mensagem personalizada com os dados da cobrança, incluindo opção de anexar boleto/recibo em PDF.',
    category: 'financial', icon: DollarSign, iconColor: '#EF4444', hub: 'Omni', hubColor: '#10B981', cover: coverOverdueInvoice,
    requiredChannels: ['whatsapp', 'email'],
    howItWorks: [
      'O sistema verifica diariamente às 9h os clientes com faturas vencidas',
      'Filtra apenas os contatos do público-alvo selecionado',
      'Envia a mensagem personalizada pelo canal escolhido',
      'Se ativado, gera e anexa automaticamente o boleto/recibo em PDF'
    ],
    configSections: [
      {
        title: 'Canal de envio', icon: Send,
        fields: [
          { key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'both', required: true, aiHelpPrompt: 'Escolha por qual canal a cobrança será enviada. WhatsApp tem maior taxa de abertura, enquanto email permite anexar PDFs mais facilmente.' },
        ]
      },
      {
        title: 'Público-alvo', icon: Target,
        fields: [
          { key: 'recipient', label: 'Enviar para quem?', type: 'recipient', required: true, aiHelpPrompt: 'Defina quem receberá o aviso de fatura atrasada. Pode ser todos os clientes, apenas os com uma tag específica, ou contatos selecionados manualmente.',
            recipientOptions: [
              { type: 'all_clients', label: 'Todos os clientes', description: 'Envia para todos os contatos com fatura vencida' },
              { type: 'tag', label: 'Por tag/grupo', description: 'Apenas contatos com uma tag específica (ex: "Premium", "Mensalista")' },
              { type: 'manual', label: 'Selecionar manualmente', description: 'Escolher contatos específicos da sua base' },
            ]
          },
          { key: 'recipient_tag', label: 'Tag do contato', type: 'text', placeholder: 'Ex: Mensalista, Premium', helpText: 'Filtra apenas contatos com essa tag', span: 'half' },
        ]
      },
      {
        title: 'Dados da cobrança', icon: DollarSign,
        fields: [
          { key: 'invoice_description', label: 'Descrição da cobrança', type: 'text', placeholder: 'Ex: Mensalidade do plano Pro', defaultValue: '', helpText: 'Use {servico} na mensagem para inserir automaticamente', span: 'half', aiHelpPrompt: 'A descrição aparecerá na mensagem onde houver {servico}. Pode ser dinâmica se vinculada ao cadastro do cliente.' },
          { key: 'invoice_amount', label: 'Valor da fatura', type: 'currency', placeholder: '0,00', defaultValue: '', helpText: 'Deixe vazio para usar o valor do cadastro do cliente', span: 'half' },
          { key: 'days_overdue', label: 'Dias após vencimento para enviar', type: 'number', placeholder: '1', defaultValue: '1', aiHelpPrompt: 'Quantos dias depois do vencimento o aviso será enviado. Ex: 1 = no dia seguinte ao vencimento.', span: 'half' },
          { key: 'payment_link', label: 'Link de pagamento (opcional)', type: 'text', placeholder: 'https://...', helpText: 'Cole aqui o link do gateway de pagamento', span: 'half' },
        ]
      },
      {
        title: 'Mensagem', icon: MessageSquare,
        fields: [
          { key: 'message', label: 'Texto da mensagem', type: 'textarea', defaultValue: 'Olá {nome},\n\nIdentificamos que sua fatura no valor de R$ {valor} referente a "{servico}" encontra-se em atraso desde {data_vencimento}.\n\nPor favor, regularize o pagamento para evitar a suspensão do serviço.\n\n{link_pagamento}\n\nQualquer dúvida estamos à disposição!', helpText: 'Variáveis: {nome}, {valor}, {servico}, {data_vencimento}, {dias_atraso}, {link_pagamento}', aiHelpPrompt: 'A mensagem aceita variáveis dinâmicas entre chaves {}. Elas serão substituídas automaticamente pelos dados reais de cada cliente no momento do envio.' },
        ]
      },
      {
        title: 'Opções avançadas', icon: Paperclip,
        fields: [
          { key: 'attach_pdf', label: 'Gerar e anexar boleto/recibo em PDF', type: 'toggle', defaultValue: 'false', helpText: 'Um PDF será gerado automaticamente com os dados da cobrança' },
          { key: 'send_copy_admin', label: 'Enviar cópia para o administrador', type: 'toggle', defaultValue: 'false', helpText: 'Você receberá uma cópia de cada cobrança enviada' },
        ]
      }
    ],
    buildAutomation: (c) => ({
      name: 'Aviso de fatura atrasada', description: `Envia aviso via ${c.channel === 'email' ? 'email' : 'WhatsApp'} após ${c.days_overdue || 1} dia(s)`,
      trigger_type: 'schedule', trigger_config: { cron: '0 9 * * *', check: 'overdue_invoices', days_overdue: parseInt(c.days_overdue || '1'), recipient_filter: c.recipient, recipient_tag: c.recipient_tag },
      nodes: makeNodes(
        { type: 'schedule', label: 'Verificar faturas vencidas', config: { days_overdue: parseInt(c.days_overdue || '1') } },
        { type: c.channel === 'email' ? 'send_email' : 'send_whatsapp', label: `Enviar ${c.channel === 'email' ? 'email' : 'WhatsApp'}`, config: { message: c.message, attach_pdf: c.attach_pdf === 'true' } }
      ),
      edges: makeEdges(),
      actions: [{ type: c.channel === 'email' ? 'send_email' : 'send_whatsapp', config: { message: c.message, attach_pdf: c.attach_pdf === 'true' } }]
    }),
  },
  {
    id: 'payment-reminder', title: 'Lembrete de pagamento próximo',
    description: 'Avisa X dias antes do vencimento da fatura',
    longDescription: 'Envie lembretes automáticos antes do vencimento. Configure quem receberá, o valor, a descrição e quantos dias antes o lembrete será disparado. Ideal para evitar inadimplência e manter o fluxo de caixa.',
    category: 'financial', icon: Bell, iconColor: '#F59E0B', hub: 'Omni', hubColor: '#10B981', cover: coverPaymentReminder,
    requiredChannels: ['whatsapp', 'email'],
    howItWorks: [
      'Você define para quem enviar e cadastra os dados de vencimento',
      'O sistema verifica diariamente os próximos vencimentos',
      'X dias antes, envia a mensagem personalizada pelo canal escolhido',
      'Inclui automaticamente o valor, serviço e link de pagamento'
    ],
    configSections: [
      {
        title: 'Canal de envio', icon: Send,
        fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'both', required: true }]
      },
      {
        title: 'Público-alvo', icon: Target,
        fields: [
          { key: 'recipient', label: 'Enviar para quem?', type: 'recipient', required: true,
            recipientOptions: [
              { type: 'all_clients', label: 'Todos os clientes', description: 'Envia para todos com data de vencimento cadastrada' },
              { type: 'tag', label: 'Por tag/grupo', description: 'Apenas contatos com uma tag específica' },
              { type: 'manual', label: 'Selecionar contatos', description: 'Escolher contatos específicos da base' },
            ]
          },
          { key: 'recipient_tag', label: 'Tag do contato', type: 'text', placeholder: 'Ex: Mensalista' },
        ]
      },
      {
        title: 'Dados do pagamento', icon: DollarSign,
        fields: [
          { key: 'days_before', label: 'Dias antes do vencimento', type: 'number', placeholder: '3', defaultValue: '3', span: 'half', aiHelpPrompt: 'Quantos dias antes do vencimento o lembrete será enviado. Recomendamos 3 dias para dar tempo ao cliente.' },
          { key: 'invoice_amount', label: 'Valor (R$)', type: 'currency', placeholder: '0,00', span: 'half', helpText: 'Deixe vazio para usar valor do cadastro' },
          { key: 'invoice_description', label: 'Descrição do serviço/produto', type: 'text', placeholder: 'Ex: Assinatura mensal', span: 'full' },
          { key: 'due_date', label: 'Data de vencimento padrão', type: 'text', placeholder: 'Ex: Dia 10 de cada mês', span: 'half', helpText: 'Se não informado, usará o campo de vencimento do cadastro do cliente' },
          { key: 'payment_link', label: 'Link de pagamento', type: 'text', placeholder: 'https://...', span: 'half' },
        ]
      },
      {
        title: 'Mensagem', icon: MessageSquare,
        fields: [
          { key: 'message', label: 'Texto', type: 'textarea', defaultValue: 'Olá {nome}! 👋\n\nLembrando que sua fatura de R$ {valor} referente a "{servico}" vence em {dias} dias ({data_vencimento}).\n\nEvite juros e pague em dia! 😉\n\nLink para pagamento: {link_pagamento}', helpText: 'Variáveis: {nome}, {valor}, {servico}, {dias}, {data_vencimento}, {link_pagamento}' },
        ]
      }
    ],
    buildAutomation: (c) => ({
      name: 'Lembrete de pagamento próximo', description: `Avisa ${c.days_before} dias antes via ${c.channel}`,
      trigger_type: 'schedule', trigger_config: { cron: '0 9 * * *', days_before: parseInt(c.days_before || '3'), recipient_filter: c.recipient, recipient_tag: c.recipient_tag },
      nodes: makeNodes({ type: 'schedule', label: 'Verificar vencimentos' }, { type: c.channel === 'email' ? 'send_email' : 'send_whatsapp', label: 'Enviar lembrete', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: c.channel === 'email' ? 'send_email' : 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'payment-confirmation', title: 'Confirmação de pagamento',
    description: 'Agradece e envia recibo automaticamente após pagamento',
    longDescription: 'Ao receber um pagamento, envia automaticamente uma mensagem de agradecimento ao cliente com os detalhes da transação e opcionalmente gera um recibo em PDF.',
    category: 'financial', icon: CheckCircle, iconColor: '#10B981', hub: 'Omni', hubColor: '#10B981', cover: coverPaymentConfirmation,
    requiredChannels: ['whatsapp', 'email'],
    howItWorks: [
      'Quando um pagamento é registrado no sistema (manual ou webhook)',
      'O facilitador identifica o cliente e os dados da transação',
      'Envia automaticamente a confirmação pelo canal escolhido',
      'Opcionalmente gera e anexa recibo em PDF'
    ],
    configSections: [
      { title: 'Canal de envio', icon: Send, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'both', required: true }] },
      { title: 'Público-alvo', icon: Target, fields: [
        { key: 'recipient', label: 'Enviar para quem?', type: 'recipient', required: true, recipientOptions: [
          { type: 'auto', label: 'Automático', description: 'Envia para o cliente que realizou o pagamento' },
        ] },
      ]},
      { title: 'Mensagem', icon: CheckCircle, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: 'Olá {nome}! ✅\n\nRecebemos seu pagamento de R$ {valor} referente a "{servico}".\n\nData: {data_pagamento}\nMétodo: {metodo_pagamento}\n\nObrigado pela confiança! 🙏', helpText: 'Variáveis: {nome}, {valor}, {servico}, {data_pagamento}, {metodo_pagamento}' },
      ]},
      { title: 'Opções avançadas', icon: FileDown, fields: [
        { key: 'generate_receipt', label: 'Gerar recibo em PDF e enviar junto', type: 'toggle', defaultValue: 'true', helpText: 'Recibo será gerado automaticamente e enviado como anexo' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Confirmação de pagamento', description: 'Agradece e envia recibo após pagamento',
      trigger_type: 'webhook', trigger_config: { event: 'payment_received' },
      nodes: makeNodes({ type: 'webhook', label: 'Pagamento recebido' }, { type: c.channel === 'email' ? 'send_email' : 'send_whatsapp', label: 'Confirmar + recibo', config: { message: c.message, generate_receipt: c.generate_receipt === 'true' } }),
      edges: makeEdges(), actions: [{ type: c.channel === 'email' ? 'send_email' : 'send_whatsapp', config: { message: c.message, generate_receipt: c.generate_receipt === 'true' } }]
    }),
  },

  // ── ONBOARDING ──
  {
    id: 'welcome-email', title: 'Boas-vindas por email',
    description: 'Email de boas-vindas personalizado quando novo lead entra na base',
    longDescription: 'Envie automaticamente um email de boas-vindas sempre que um novo contato for cadastrado. Configure o tipo de contato que dispara o email e personalize o conteúdo.',
    category: 'onboarding', icon: Mail, iconColor: '#374DA4', hub: 'Omni', hubColor: '#10B981', cover: coverWelcomeEmail,
    requiredChannels: ['email'],
    howItWorks: ['Quando um novo contato é cadastrado na base', 'O sistema verifica se atende os filtros configurados', 'Envia automaticamente o email de boas-vindas'],
    configSections: [
      { title: 'Conta de email', icon: AtSign, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'email', required: true }] },
      { title: 'Público-alvo', icon: Target, fields: [
        { key: 'client_type', label: 'Tipo de contato', type: 'select', options: [{ label: 'Todos', value: 'any' }, { label: 'Apenas Leads', value: 'lead' }, { label: 'Apenas Clientes', value: 'client' }], defaultValue: 'any', aiHelpPrompt: 'Escolha se o email de boas-vindas será disparado para todos os novos contatos, somente leads ou somente clientes já convertidos.' },
      ]},
      { title: 'Conteúdo do email', icon: Mail, fields: [
        { key: 'subject', label: 'Assunto do email', type: 'text', placeholder: 'Bem-vindo(a)!', defaultValue: 'Bem-vindo(a) à {empresa}!', span: 'full' },
        { key: 'message', label: 'Corpo do email', type: 'textarea', defaultValue: 'Olá {nome},\n\nSeja muito bem-vindo(a) à {empresa}! 🎉\n\nEstamos felizes em tê-lo(a) conosco. Aqui estão os primeiros passos:\n\n1️⃣ Conheça nossos serviços\n2️⃣ Agende uma reunião de boas-vindas\n3️⃣ Explore nossa base de conhecimento\n\nQualquer dúvida, estamos à disposição!\n\nAbraços,\nEquipe {empresa}', helpText: 'Variáveis: {nome}, {email}, {empresa}, {telefone}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Boas-vindas por email', description: 'Email automático para novos leads/clientes',
      trigger_type: 'new_client', trigger_config: { clientType: c.client_type || 'any' },
      nodes: makeNodes({ type: 'new_client', label: 'Novo contato' }, { type: 'send_email', label: 'Email de boas-vindas', config: { subject: c.subject, message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_email', config: { subject: c.subject, message: c.message } }]
    }),
  },
  {
    id: 'welcome-whatsapp', title: 'Boas-vindas por WhatsApp',
    description: 'Mensagem automática via WhatsApp para novo contato',
    longDescription: 'Receba um novo contato e envie automaticamente uma mensagem de boas-vindas via WhatsApp, criando uma primeira impressão positiva.',
    category: 'onboarding', icon: MessageSquare, iconColor: '#25D366', hub: 'Omni', hubColor: '#10B981', cover: coverWelcomeWhatsapp,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Novo contato é cadastrado no CRM', 'Verifica o tipo de contato configurado', 'Dispara mensagem de boas-vindas via WhatsApp'],
    configSections: [
      { title: 'Conta WhatsApp', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Público-alvo', icon: Target, fields: [
        { key: 'client_type', label: 'Tipo de contato', type: 'select', options: [{ label: 'Todos', value: 'any' }, { label: 'Apenas Leads', value: 'lead' }, { label: 'Apenas Clientes', value: 'client' }], defaultValue: 'any' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto de boas-vindas', type: 'textarea', defaultValue: 'Olá {nome}! 👋\n\nSeja muito bem-vindo(a)! Sou da equipe {empresa}.\n\nComo posso te ajudar hoje?\n\n📋 Conheça nossos serviços\n📅 Agende uma reunião\n💬 Tire suas dúvidas', helpText: 'Variáveis: {nome}, {telefone}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Boas-vindas por WhatsApp', description: 'WhatsApp automático para novos contatos',
      trigger_type: 'new_client', trigger_config: { clientType: c.client_type || 'any' },
      nodes: makeNodes({ type: 'new_client', label: 'Novo contato' }, { type: 'send_whatsapp', label: 'Boas-vindas WhatsApp', config: { message: c.message, session_id: c.channel } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'onboarding-kit', title: 'Kit de onboarding',
    description: 'Sequência de 3 mensagens nos primeiros 7 dias',
    longDescription: 'Crie uma sequência automatizada de boas-vindas com 3 mensagens espaçadas ao longo de 7 dias para engajar novos contatos desde o primeiro momento.',
    category: 'onboarding', icon: Users, iconColor: '#8B5CF6', hub: 'Suite', hubColor: '#374DA4', cover: coverOnboardingKit,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Dia 1: Mensagem de boas-vindas', 'Dia 3: Dica ou conteúdo relevante', 'Dia 7: Check-in de satisfação', 'Tudo automático após o cadastro'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Dia 1 — Boas-vindas', icon: Gift, fields: [{ key: 'msg1', label: 'Mensagem do dia 1', type: 'textarea', defaultValue: 'Olá {nome}! 🎉\n\nSeja bem-vindo(a) à {empresa}!\n\nNos próximos dias, enviaremos dicas especiais para você.', helpText: 'Enviada imediatamente após o cadastro' }] },
      { title: 'Dia 3 — Dica especial', icon: Zap, fields: [{ key: 'msg2', label: 'Mensagem do dia 3', type: 'textarea', defaultValue: 'Olá {nome}! 💡\n\nAqui vai uma dica especial: [Descreva uma dica do seu negócio]\n\nPrecisa de ajuda? Estamos aqui!' }] },
      { title: 'Dia 7 — Check-in', icon: BarChart3, fields: [{ key: 'msg3', label: 'Mensagem do dia 7', type: 'textarea', defaultValue: 'Olá {nome}! 🤗\n\nJá faz uma semana! Como está sendo sua experiência?\n\nDe 1 a 5, como avalia nosso atendimento?' }] },
    ],
    buildAutomation: (c) => ({
      name: 'Kit de onboarding', description: 'Sequência de 3 mensagens em 7 dias',
      trigger_type: 'new_client', trigger_config: { clientType: 'any' },
      nodes: [
        { id: 'trigger-1', type: 'new_client', label: 'Novo cliente', position: { x: 250, y: 50 }, data: {}, config: {} },
        { id: 'action-1', type: 'send_whatsapp', label: 'Msg dia 1', position: { x: 250, y: 200 }, data: {}, config: { message: c.msg1 } },
        { id: 'delay-1', type: 'delay', label: 'Aguardar 3 dias', position: { x: 250, y: 350 }, data: {}, config: { duration: 3, unit: 'days' } },
        { id: 'action-2', type: 'send_whatsapp', label: 'Msg dia 3', position: { x: 250, y: 500 }, data: {}, config: { message: c.msg2 } },
        { id: 'delay-2', type: 'delay', label: 'Aguardar 4 dias', position: { x: 250, y: 650 }, data: {}, config: { duration: 4, unit: 'days' } },
        { id: 'action-3', type: 'send_whatsapp', label: 'Msg dia 7', position: { x: 250, y: 800 }, data: {}, config: { message: c.msg3 } },
      ],
      edges: [{ id: 'e1', source: 'trigger-1', target: 'action-1' }, { id: 'e2', source: 'action-1', target: 'delay-1' }, { id: 'e3', source: 'delay-1', target: 'action-2' }, { id: 'e4', source: 'action-2', target: 'delay-2' }, { id: 'e5', source: 'delay-2', target: 'action-3' }],
      actions: [{ type: 'send_whatsapp', config: { message: c.msg1 } }]
    }),
  },

  // ── FOLLOW-UP ──
  {
    id: 'post-meeting-followup', title: 'Follow-up pós-reunião',
    description: 'Envia resumo e próximos passos após reunião',
    longDescription: 'Após cada reunião, envie automaticamente um email com resumo e próximos passos para manter o relacionamento profissional.',
    category: 'followup', icon: FileText, iconColor: '#0EA5E9', hub: 'Flow', hubColor: '#007DE3', cover: coverPostMeeting,
    requiredChannels: ['email'],
    howItWorks: ['Quando uma reunião do calendário é finalizada', 'Aguarda o tempo configurado', 'Envia email com resumo para todos os participantes'],
    configSections: [
      { title: 'Conta de email', icon: AtSign, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'email', required: true }] },
      { title: 'Timing', icon: Clock, fields: [
        { key: 'delay_hours', label: 'Enviar quantas horas após a reunião?', type: 'number', placeholder: '2', defaultValue: '2', span: 'half', aiHelpPrompt: 'Recomendamos 1-2 horas para que o follow-up chegue enquanto a reunião está fresca na memória.' },
      ]},
      { title: 'Email de follow-up', icon: Mail, fields: [
        { key: 'subject', label: 'Assunto', type: 'text', defaultValue: 'Resumo da nossa reunião — Próximos passos', span: 'full' },
        { key: 'message', label: 'Corpo do email', type: 'textarea', defaultValue: 'Olá {nome},\n\nObrigado pela reunião! 🤝\n\nSegue um resumo e os próximos passos:\n\n📋 Próximos passos:\n1. [Item 1]\n2. [Item 2]\n3. [Item 3]\n\n📅 Próxima reunião: [Data]\n\nFico no aguardo!\n\nAbraços,\n{remetente}', helpText: 'Variáveis: {nome}, {remetente}, {data_reuniao}, {hora_reuniao}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Follow-up pós-reunião', description: `Envia email ${c.delay_hours}h após a reunião`,
      trigger_type: 'schedule', trigger_config: { event: 'meeting_ended', delay_hours: parseInt(c.delay_hours || '2') },
      nodes: makeNodes({ type: 'schedule', label: 'Reunião finalizada' }, { type: 'send_email', label: 'Email follow-up', config: { subject: c.subject, message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_email', config: { subject: c.subject, message: c.message } }]
    }),
  },
  {
    id: 'inactive-client', title: 'Reengajamento de cliente inativo',
    description: 'Contata clientes sem interação há X dias',
    longDescription: 'Identifique e reengaje clientes que não interagem há um período. O sistema verifica automaticamente e envia mensagens para reconectar.',
    category: 'followup', icon: RefreshCw, iconColor: '#374DA4', hub: 'Omni', hubColor: '#10B981', cover: coverInactiveClient,
    requiredChannels: ['whatsapp'],
    howItWorks: ['O sistema verifica periodicamente os clientes inativos', 'Filtra pelo número de dias sem interação', 'Envia mensagem de reengajamento personalizada'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Regra de inatividade', icon: Clock, fields: [
        { key: 'days', label: 'Dias sem interação', type: 'number', placeholder: '30', defaultValue: '30', span: 'half', aiHelpPrompt: 'Defina quantos dias sem contato para considerar um cliente inativo. 30 dias é o padrão recomendado.' },
        { key: 'check_frequency', label: 'Verificar a cada', type: 'select', options: [{ label: 'Todo dia', value: 'daily' }, { label: 'Toda semana', value: 'weekly' }, { label: 'Toda segunda-feira', value: 'monday' }], defaultValue: 'weekly', span: 'half' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: 'Olá {nome}! 😊\n\nSentimos sua falta! Faz um tempinho que não nos falamos.\n\nPreparei algo especial para você: [oferta]\n\nPosso te contar mais?\n\nAbraços, equipe {empresa}', helpText: 'Variáveis: {nome}, {dias_inativo}, {ultima_interacao}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Reengajamento de cliente inativo', description: `Contata inativos há ${c.days} dias`,
      trigger_type: 'schedule', trigger_config: { cron: c.check_frequency === 'daily' ? '0 10 * * *' : '0 10 * * 1', inactivity_days: parseInt(c.days || '30') },
      nodes: makeNodes({ type: 'schedule', label: `Inativos (${c.days}d)` }, { type: 'send_whatsapp', label: 'Reengajar', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'client-birthday', title: 'Aniversário do cliente',
    description: 'Envia parabéns automáticos na data de aniversário',
    longDescription: 'Surpreenda seus clientes com uma mensagem personalizada no dia do aniversário. Requer que o campo "Data de nascimento" esteja preenchido no cadastro.',
    category: 'followup', icon: Gift, iconColor: '#EC4899', hub: 'Omni', hubColor: '#10B981', cover: coverBirthday,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Todo dia, verifica quais clientes fazem aniversário', 'Envia a mensagem personalizada no horário configurado', 'Requer campo birth_date preenchido no cadastro do contato'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Mensagem de aniversário', icon: Gift, fields: [
        { key: 'send_time', label: 'Horário de envio', type: 'select', options: [{ label: '08:00', value: '8' }, { label: '09:00', value: '9' }, { label: '10:00', value: '10' }], defaultValue: '9', span: 'half' },
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: '🎂🎉 Feliz aniversário, {nome}!\n\nDesejamos um dia maravilhoso!\n\nComo presente especial: [cupom/desconto/brinde]\n\nUm abraço de toda a equipe {empresa}! 🎁', helpText: 'Variáveis: {nome}, {empresa}. Requer campo birth_date no cadastro' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Aniversário do cliente', description: 'Parabéns automáticos no aniversário',
      trigger_type: 'schedule', trigger_config: { cron: `0 ${c.send_time || '9'} * * *`, check: 'birthday' },
      nodes: makeNodes({ type: 'schedule', label: 'Verificar aniversários' }, { type: 'send_whatsapp', label: 'Enviar parabéns', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'satisfaction-survey', title: 'Pesquisa de satisfação (NPS)',
    description: 'Envia pesquisa de satisfação após serviço concluído',
    longDescription: 'Colete feedback automaticamente após cada serviço concluído com uma pesquisa NPS simples e objetiva.',
    category: 'followup', icon: BarChart3, iconColor: '#6366F1', hub: 'Suite', hubColor: '#374DA4', cover: coverSatisfaction,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Quando um serviço/proposta é marcado como concluído', 'Aguarda o tempo configurado', 'Envia pesquisa NPS via WhatsApp'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Pesquisa NPS', icon: BarChart3, fields: [
        { key: 'delay_hours', label: 'Horas após conclusão', type: 'number', placeholder: '24', defaultValue: '24', span: 'half' },
        { key: 'message', label: 'Texto da pesquisa', type: 'textarea', defaultValue: 'Olá {nome}! 😊\n\nSeu atendimento referente a "{servico}" foi concluído.\n\nDe 0 a 10, quanto nos recomendaria a um amigo?\n\nResponda com um número de 0 a 10.\n\nSua opinião é muito importante! 🙏', helpText: 'Variáveis: {nome}, {servico}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Pesquisa de satisfação', description: `NPS ${c.delay_hours}h após conclusão`,
      trigger_type: 'proposal_status', trigger_config: { status: 'completed', delay_hours: parseInt(c.delay_hours || '24') },
      nodes: makeNodes({ type: 'proposal_status', label: 'Serviço concluído' }, { type: 'send_whatsapp', label: 'Enviar pesquisa NPS', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },

  // ── VENDAS ──
  {
    id: 'proposal-followup', title: 'Follow-up de proposta',
    description: 'Cobra retorno após envio de proposta',
    longDescription: 'Automatize o acompanhamento de propostas enviadas. Após X dias sem resposta, o sistema envia automaticamente uma mensagem de follow-up.',
    category: 'sales', icon: FileText, iconColor: '#374DA4', hub: 'Suite', hubColor: '#374DA4', cover: coverProposalFollowup,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Quando uma proposta é enviada ao cliente', 'Aguarda o prazo configurado sem resposta', 'Envia follow-up automático via WhatsApp'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Timing', icon: Clock, fields: [{ key: 'days', label: 'Dias após envio da proposta', type: 'number', placeholder: '3', defaultValue: '3', span: 'half' }] },
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: 'Olá {nome}! 📋\n\nEnviei uma proposta referente a "{servico}" há {dias} dias.\n\nConseguiu analisar? Posso esclarecer alguma dúvida?\n\nFico no aguardo! 😊', helpText: 'Variáveis: {nome}, {servico}, {valor_proposta}, {dias}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Follow-up de proposta', description: `Follow-up ${c.days} dias após envio`,
      trigger_type: 'proposal_status', trigger_config: { status: 'sent', delay_days: parseInt(c.days || '3') },
      nodes: [
        { id: 'trigger-1', type: 'proposal_status', label: 'Proposta enviada', position: { x: 250, y: 50 }, data: {}, config: { status: 'sent' } },
        { id: 'delay-1', type: 'delay', label: `Aguardar ${c.days}d`, position: { x: 250, y: 200 }, data: {}, config: { duration: parseInt(c.days || '3'), unit: 'days' } },
        { id: 'action-1', type: 'send_whatsapp', label: 'Follow-up', position: { x: 250, y: 350 }, data: {}, config: { message: c.message } },
      ],
      edges: [{ id: 'e1', source: 'trigger-1', target: 'delay-1' }, { id: 'e2', source: 'delay-1', target: 'action-1' }],
      actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'qualified-lead', title: 'Lead qualificado — alerta',
    description: 'Notifica a equipe quando lead muda para qualificado',
    longDescription: 'Quando um lead é marcado como qualificado no CRM, notifique imediatamente a equipe de vendas para ação rápida.',
    category: 'sales', icon: UserPlus, iconColor: '#10B981', hub: 'Omni', hubColor: '#10B981', cover: coverQualifiedLead,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Quando o status de um contato muda para "qualificado"', 'Envia notificação interna para a equipe', 'Inclui dados do lead para ação imediata'],
    configSections: [
      { title: 'Canal de notificação', icon: Phone, fields: [{ key: 'channel', label: 'Notificar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Notificação interna', icon: Bell, fields: [
        { key: 'notify_to', label: 'Quem notificar?', type: 'select', options: [{ label: 'Administradores', value: 'admins' }, { label: 'Equipe de vendas', value: 'sales' }, { label: 'Todos', value: 'all' }], defaultValue: 'admins', span: 'half' },
        { key: 'message', label: 'Mensagem interna', type: 'textarea', defaultValue: '🎯 Lead qualificado!\n\nNome: {nome}\nEmail: {email}\nTelefone: {telefone}\nOrigem: {origem}\n\nEntre em contato o mais rápido possível!', helpText: 'Variáveis: {nome}, {email}, {telefone}, {origem}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Lead qualificado — alerta', description: 'Notifica sobre leads qualificados',
      trigger_type: 'client_updated', trigger_config: { fields: ['status'], value: 'qualified', notify_to: c.notify_to },
      nodes: makeNodes({ type: 'client_updated', label: 'Lead qualificado' }, { type: 'send_whatsapp', label: 'Notificar equipe', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'abandoned-cart', title: 'Carrinho/interesse abandonado',
    description: 'Relembra cliente sobre interesse não convertido',
    longDescription: 'Quando um cliente demonstra interesse mas não converte, envie automaticamente uma mensagem de reengajamento com opção de desconto.',
    category: 'sales', icon: ShoppingCart, iconColor: '#374DA4', hub: 'Omni', hubColor: '#10B981', cover: coverAbandonedCart,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Identifica clientes com interesse não convertido', 'Aguarda o tempo configurado', 'Envia mensagem de reengajamento com oferta opcional'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Configuração', icon: Clock, fields: [
        { key: 'hours_after', label: 'Horas após abandono', type: 'number', placeholder: '4', defaultValue: '4', span: 'half' },
        { key: 'offer_discount', label: 'Incluir oferta/desconto?', type: 'toggle', defaultValue: 'false' },
        { key: 'discount_text', label: 'Texto da oferta', type: 'text', placeholder: '10% OFF', defaultValue: '10% de desconto se fechar hoje!' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: 'Olá {nome}! 👋\n\nNotamos que você demonstrou interesse em "{servico}" mas não finalizou.\n\nPosso te ajudar com alguma dúvida?\n\n{oferta}', helpText: 'Variáveis: {nome}, {servico}, {oferta}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Carrinho/interesse abandonado', description: `Relembra ${c.hours_after}h após abandono`,
      trigger_type: 'schedule', trigger_config: { cron: '0 14 * * *', check: 'abandoned_interest', hours_after: parseInt(c.hours_after || '4') },
      nodes: makeNodes({ type: 'schedule', label: 'Verificar abandonos' }, { type: 'send_whatsapp', label: 'Reengajar', config: { message: c.message, offer_discount: c.offer_discount === 'true', discount_text: c.discount_text } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },

  // ── PRODUTIVIDADE ──
  {
    id: 'overdue-task', title: 'Tarefa atrasada — alerta',
    description: 'Notifica responsável quando tarefa passa do prazo',
    longDescription: 'Mantenha a produtividade da equipe com alertas automáticos para tarefas atrasadas.',
    category: 'productivity', icon: ClipboardList, iconColor: '#EF4444', hub: 'Flow', hubColor: '#007DE3', cover: coverOverdueTask,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Verifica diariamente tarefas com prazo vencido', 'Identifica o responsável de cada tarefa', 'Envia alerta via WhatsApp'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Notificar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Quem será notificado?', icon: Target, fields: [
        { key: 'recipient', label: 'Enviar alerta para', type: 'recipient', required: true, aiHelpPrompt: 'Defina quem receberá o alerta de tarefa atrasada. Pode ser o próprio responsável, os gestores ou toda a equipe.',
          recipientOptions: [
            { type: 'auto', label: 'Responsável da tarefa', description: 'Envia diretamente para quem está atribuído à tarefa' },
            { type: 'all_clients', label: 'Todos os gestores', description: 'Notifica todos os administradores/gestores da empresa' },
            { type: 'manual', label: 'Pessoas específicas', description: 'Escolha quem será notificado manualmente' },
          ]
        },
      ]},
      { title: 'Configuração', icon: Clock, fields: [
        { key: 'check_time', label: 'Horário da verificação', type: 'select', options: [{ label: '08:00', value: '08' }, { label: '09:00', value: '09' }, { label: '10:00', value: '10' }], defaultValue: '09', span: 'half', aiHelpPrompt: 'Horário em que o sistema verifica se há tarefas atrasadas.' },
        { key: 'min_days_overdue', label: 'Dias de atraso mínimo', type: 'number', placeholder: '1', defaultValue: '1', span: 'half', helpText: 'Só notifica tarefas com pelo menos X dias de atraso' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto do alerta', type: 'textarea', defaultValue: '⚠️ Alerta de tarefa atrasada!\n\nTarefa: "{tarefa}"\nPrazo: {prazo}\nAtraso: {dias_atraso} dia(s)\nResponsável: {responsavel}\n\nPor favor, atualize o status.', helpText: 'Variáveis: {tarefa}, {prazo}, {dias_atraso}, {responsavel}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Tarefa atrasada — alerta', description: 'Alerta tarefas atrasadas diariamente',
      trigger_type: 'schedule', trigger_config: { cron: '0 9 * * *', check: 'overdue_tasks' },
      nodes: makeNodes({ type: 'schedule', label: 'Verificar atrasadas' }, { type: 'send_whatsapp', label: 'Alerta', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'daily-task-summary', title: 'Resumo diário de tarefas',
    description: 'Envia resumo das tarefas pendentes no horário escolhido',
    longDescription: 'Receba toda manhã um resumo das suas tarefas pendentes e atrasadas para organizar o dia.',
    category: 'productivity', icon: Clock, iconColor: '#6366F1', hub: 'Flow', hubColor: '#007DE3', cover: coverDailySummary,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Todo dia no horário configurado', 'Coleta todas as tarefas pendentes', 'Envia resumo organizado via WhatsApp'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Receber por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Quem recebe o resumo?', icon: Target, fields: [
        { key: 'recipient', label: 'Enviar para', type: 'recipient', required: true,
          recipientOptions: [
            { type: 'auto', label: 'Apenas eu', description: 'Envia o resumo somente para você (admin)' },
            { type: 'all_clients', label: 'Toda a equipe', description: 'Cada membro recebe seu próprio resumo' },
            { type: 'manual', label: 'Pessoas específicas', description: 'Escolha quem recebe o resumo' },
          ]
        },
      ]},
      { title: 'Configuração', icon: Clock, fields: [
        { key: 'time', label: 'Horário de envio', type: 'select', options: [{ label: '07:00', value: '07:00' }, { label: '08:00', value: '08:00' }, { label: '09:00', value: '09:00' }, { label: '10:00', value: '10:00' }], defaultValue: '08:00', span: 'half' },
        { key: 'include_overdue', label: 'Incluir tarefas atrasadas?', type: 'toggle', defaultValue: 'true' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Resumo diário de tarefas', description: `Resumo diário às ${c.time}`,
      trigger_type: 'schedule', trigger_config: { cron: `0 ${c.time?.split(':')[0] || '8'} * * *`, include_overdue: c.include_overdue === 'true' },
      nodes: makeNodes({ type: 'schedule', label: `Diário às ${c.time}` }, { type: 'send_whatsapp', label: 'Enviar resumo', config: {} }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: {} }]
    }),
  },
  {
    id: 'task-assigned', title: 'Nova tarefa atribuída',
    description: 'Notifica membro da equipe quando recebe tarefa',
    longDescription: 'Quando uma tarefa é atribuída a um membro da equipe, ele recebe uma notificação automática via WhatsApp com os detalhes.',
    category: 'productivity', icon: Send, iconColor: '#0EA5E9', hub: 'Flow', hubColor: '#007DE3', cover: coverTaskAssigned,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Quando uma tarefa é criada ou reatribuída', 'Identifica o membro responsável', 'Envia notificação com detalhes da tarefa'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Notificar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Quem será notificado?', icon: Target, fields: [
        { key: 'recipient', label: 'Notificar', type: 'recipient', required: true,
          recipientOptions: [
            { type: 'auto', label: 'O responsável atribuído', description: 'A pessoa que recebeu a tarefa será notificada' },
            { type: 'all_clients', label: 'Responsável + gestores', description: 'Notifica o responsável e copia os gestores' },
          ]
        },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: '📌 Nova tarefa atribuída a você!\n\nTarefa: "{tarefa}"\nPrioridade: {prioridade}\nPrazo: {prazo}\nAtribuída por: {atribuidor}', helpText: 'Variáveis: {tarefa}, {prioridade}, {prazo}, {atribuidor}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Nova tarefa atribuída', description: 'Notifica sobre novas tarefas',
      trigger_type: 'task_assigned', trigger_config: {},
      nodes: makeNodes({ type: 'task_assigned', label: 'Tarefa atribuída' }, { type: 'send_whatsapp', label: 'Notificar', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },

  // ── AGENDAMENTO ──
  {
    id: 'booking-confirmation', title: 'Confirmação de agendamento',
    description: 'Confirma automaticamente reunião agendada',
    longDescription: 'Quando um agendamento é confirmado, envia automaticamente uma mensagem ao cliente com os detalhes.',
    category: 'scheduling', icon: Calendar, iconColor: '#10B981', hub: 'Flow', hubColor: '#007DE3', cover: coverBookingConfirmation,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Quando um agendamento é feito via link ou manualmente', 'Envia confirmação automática ao cliente', 'Inclui data, hora e link da reunião'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Quem recebe a confirmação?', icon: Target, fields: [
        { key: 'recipient', label: 'Enviar para', type: 'recipient', required: true,
          recipientOptions: [
            { type: 'auto', label: 'O cliente que agendou', description: 'Envia confirmação automaticamente para quem fez o agendamento' },
            { type: 'all_clients', label: 'Cliente + responsável interno', description: 'Confirma para o cliente e notifica o atendente' },
          ]
        },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto de confirmação', type: 'textarea', defaultValue: '✅ Agendamento confirmado!\n\n📅 Data: {data}\n🕐 Hora: {hora}\n📍 {tipo_reuniao}\n\n{link_reuniao}\n\nSe precisar reagendar, me avise! 😊', helpText: 'Variáveis: {nome}, {data}, {hora}, {tipo_reuniao}, {link_reuniao}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Confirmação de agendamento', description: 'Confirma agendamento automaticamente',
      trigger_type: 'booking_created', trigger_config: {},
      nodes: makeNodes({ type: 'booking_created', label: 'Agendamento criado' }, { type: 'send_whatsapp', label: 'Confirmar', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'meeting-reminder', title: 'Lembrete de reunião',
    description: 'Avisa 1h antes da reunião por WhatsApp',
    longDescription: 'Envie um lembrete automático antes de cada reunião para reduzir faltas e atrasos.',
    category: 'scheduling', icon: Bell, iconColor: '#F59E0B', hub: 'Flow', hubColor: '#007DE3', cover: coverMeetingReminder,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Monitora reuniões agendadas no calendário', 'X minutos antes, envia lembrete ao participante', 'Inclui link de acesso à reunião'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Quem recebe o lembrete?', icon: Target, fields: [
        { key: 'recipient', label: 'Enviar para', type: 'recipient', required: true,
          recipientOptions: [
            { type: 'auto', label: 'Todos os participantes', description: 'Envia lembrete para cada participante da reunião' },
            { type: 'all_clients', label: 'Apenas participantes externos', description: 'Lembra apenas clientes/convidados, não a equipe interna' },
          ]
        },
      ]},
      { title: 'Configuração', icon: Clock, fields: [
        { key: 'minutes_before', label: 'Minutos antes', type: 'select', options: [{ label: '15 min', value: '15' }, { label: '30 min', value: '30' }, { label: '60 min (1h)', value: '60' }, { label: '120 min (2h)', value: '120' }], defaultValue: '60', span: 'half' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto do lembrete', type: 'textarea', defaultValue: '⏰ Lembrete!\n\nSua reunião "{titulo}" começa em {minutos} minutos.\n\n📅 {data} às {hora}\n\n🔗 {link_reuniao}\n\nTe esperamos! 😊', helpText: 'Variáveis: {nome}, {titulo}, {data}, {hora}, {minutos}, {link_reuniao}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Lembrete de reunião', description: `Lembrete ${c.minutes_before}min antes`,
      trigger_type: 'schedule', trigger_config: { event: 'meeting_reminder', minutes_before: parseInt(c.minutes_before || '60') },
      nodes: makeNodes({ type: 'schedule', label: `${c.minutes_before}min antes` }, { type: 'send_whatsapp', label: 'Lembrete', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'auto-reschedule', title: 'Reagendamento automático',
    description: 'Oferece nova data quando cliente cancela',
    longDescription: 'Quando um cliente cancela uma reunião, o sistema oferece automaticamente opções de reagendamento.',
    category: 'scheduling', icon: RefreshCw, iconColor: '#8B5CF6', hub: 'Flow', hubColor: '#007DE3', cover: coverAutoReschedule,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Quando uma reunião é cancelada', 'Envia mensagem com link para reagendamento', 'Facilita a remarcação sem esforço manual'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Quem recebe?', icon: Target, fields: [
        { key: 'recipient', label: 'Enviar para', type: 'recipient', required: true,
          recipientOptions: [
            { type: 'auto', label: 'O cliente que cancelou', description: 'Envia opção de reagendamento para quem cancelou' },
          ]
        },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: 'Olá {nome}! 📅\n\nVimos que sua reunião foi cancelada. Sem problemas!\n\nQue tal remarcar? Acesse o link abaixo para escolher um novo horário:\n\n🔗 {link_agendamento}\n\nFico no aguardo! 😊', helpText: 'Variáveis: {nome}, {titulo_reuniao}, {link_agendamento}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Reagendamento automático', description: 'Oferece reagendamento ao cancelar',
      trigger_type: 'booking_cancelled', trigger_config: {},
      nodes: makeNodes({ type: 'booking_cancelled', label: 'Reunião cancelada' }, { type: 'send_whatsapp', label: 'Reagendar', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },

  // ── INTEGRAÇÕES ──
  {
    id: 'webhook-lead', title: 'Webhook — processar lead',
    description: 'Recebe dados de formulário externo e cria contato',
    longDescription: 'Quando um formulário externo envia dados via webhook, o sistema cria automaticamente o contato no CRM e notifica a equipe.',
    category: 'integrations', icon: Globe, iconColor: '#6366F1', hub: 'Suite', hubColor: '#374DA4', cover: coverWebhookLead,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Recebe dados via webhook (POST)', 'Cria contato automaticamente no CRM', 'Notifica a equipe sobre o novo lead'],
    configSections: [
      { title: 'Canal de notificação', icon: Phone, fields: [{ key: 'channel', label: 'Notificar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Mapeamento de campos', icon: Globe, fields: [
        { key: 'name_field', label: 'Campo do nome', type: 'text', placeholder: 'name', defaultValue: 'name', span: 'half' },
        { key: 'email_field', label: 'Campo do email', type: 'text', placeholder: 'email', defaultValue: 'email', span: 'half' },
        { key: 'phone_field', label: 'Campo do telefone', type: 'text', placeholder: 'phone', defaultValue: 'phone', span: 'half' },
      ]},
      { title: 'Notificação', icon: Bell, fields: [
        { key: 'notify_message', label: 'Mensagem de notificação', type: 'textarea', defaultValue: '🆕 Novo lead via formulário!\n\nNome: {nome}\nEmail: {email}\nTelefone: {telefone}\n\nAcesse o CRM para mais detalhes.', helpText: 'Variáveis: {nome}, {email}, {telefone}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Webhook — processar lead', description: 'Cria contato e notifica via webhook',
      trigger_type: 'webhook', trigger_config: { field_mapping: { name: c.name_field, email: c.email_field, phone: c.phone_field } },
      nodes: makeNodes({ type: 'webhook', label: 'Webhook recebido' }, { type: 'send_whatsapp', label: 'Notificar', config: { message: c.notify_message } }),
      edges: makeEdges(), actions: [{ type: 'create_client', config: {} }, { type: 'send_whatsapp', config: { message: c.notify_message } }]
  }),
  },

  // ── MARKETING ──
  {
    id: 'mass-broadcast', title: 'Disparo em massa WhatsApp',
    description: 'Envie mensagens em massa para grupos ou tags de contatos',
    longDescription: 'Selecione um grupo de contatos por tag, envie mensagens personalizadas em massa via WhatsApp com controle de intervalo entre envios para evitar bloqueios.',
    category: 'marketing', icon: Send, iconColor: '#EC4899', hub: 'Omni', hubColor: '#10B981', cover: coverMassBroadcast,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Selecione o público por tag ou grupo', 'Configure a mensagem personalizada com variáveis', 'O sistema envia com intervalo seguro entre cada mensagem', 'Acompanhe o progresso do disparo em tempo real'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Público-alvo', icon: Target, fields: [
        { key: 'recipient', label: 'Enviar para quem?', type: 'recipient', required: true, recipientOptions: [
          { type: 'all_clients', label: 'Todos os contatos', description: 'Envia para toda a base de contatos' },
          { type: 'tag', label: 'Por tag', description: 'Apenas contatos com uma tag específica' },
          { type: 'manual', label: 'Selecionar manualmente', description: 'Escolher contatos específicos' },
        ] },
        { key: 'recipient_tag', label: 'Tag', type: 'text', placeholder: 'Ex: Clientes VIP' },
      ]},
      { title: 'Intervalo de envio', icon: Clock, fields: [
        { key: 'interval_seconds', label: 'Segundos entre cada envio', type: 'number', placeholder: '10', defaultValue: '10', span: 'half', aiHelpPrompt: 'Intervalo entre cada mensagem para evitar bloqueio do WhatsApp. Mínimo recomendado: 10 segundos.' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto do disparo', type: 'textarea', defaultValue: 'Olá {nome}! 🎉\n\n[Sua mensagem aqui]\n\nAbraços, equipe {empresa}', helpText: 'Variáveis: {nome}, {empresa}, {telefone}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Disparo em massa WhatsApp', description: `Disparo para ${c.recipient === 'all_clients' ? 'todos' : `tag: ${c.recipient_tag}`}`,
      trigger_type: 'manual', trigger_config: { recipient_filter: c.recipient, recipient_tag: c.recipient_tag, interval_seconds: parseInt(c.interval_seconds || '10') },
      nodes: makeNodes({ type: 'manual', label: 'Disparo manual' }, { type: 'send_whatsapp', label: 'Enviar em massa', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'auto-instagram', title: 'Publicar carrossel automático',
    description: 'Gera e publica carrossel no Instagram sobre um tema',
    longDescription: 'Defina um tema e o sistema gera automaticamente um carrossel com conteúdo relevante e publica no seu Instagram conectado.',
    category: 'marketing', icon: BarChart3, iconColor: '#E1306C', hub: 'Suite', hubColor: '#374DA4', cover: coverAutoInstagram,
    requiredChannels: [],
    howItWorks: ['Defina o tema/assunto do carrossel', 'O sistema gera o conteúdo automaticamente com IA', 'Publica diretamente no Instagram conectado', 'Acompanhe as métricas de engajamento'],
    configSections: [
      { title: 'Conteúdo', icon: FileText, fields: [
        { key: 'topic', label: 'Tema do carrossel', type: 'text', placeholder: 'Ex: 5 dicas de produtividade', span: 'full', aiHelpPrompt: 'Descreva o tema do post. A IA vai gerar o conteúdo completo.' },
        { key: 'card_count', label: 'Quantidade de cards', type: 'select', options: [{ label: '5 cards', value: '5' }, { label: '7 cards', value: '7' }, { label: '10 cards', value: '10' }], defaultValue: '7', span: 'half' },
      ]},
      { title: 'Agendamento', icon: Calendar, fields: [
        { key: 'frequency', label: 'Frequência', type: 'select', options: [{ label: 'Uma vez', value: 'once' }, { label: 'Diário', value: 'daily' }, { label: 'Semanal', value: 'weekly' }], defaultValue: 'once', span: 'half' },
        { key: 'auto_caption', label: 'Gerar legenda automaticamente', type: 'toggle', defaultValue: 'true' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Publicar carrossel automático', description: `Carrossel sobre: ${c.topic}`,
      trigger_type: c.frequency === 'once' ? 'manual' : 'schedule', trigger_config: { frequency: c.frequency },
      nodes: makeNodes({ type: 'schedule', label: 'Gerar conteúdo' }, { type: 'publish_instagram', label: 'Publicar', config: { topic: c.topic, cardCount: parseInt(c.card_count || '7') } }),
      edges: makeEdges(), actions: [{ type: 'publish_instagram', config: { topic: c.topic } }]
    }),
  },

  // ── ATENDIMENTO ──
  {
    id: 'auto-reply-offhours', title: 'Resposta fora do horário',
    description: 'Responde automaticamente fora do horário comercial',
    longDescription: 'Configure uma resposta automática para mensagens recebidas fora do horário comercial, informando o cliente sobre o horário de atendimento.',
    category: 'support', icon: Clock, iconColor: '#F59E0B', hub: 'Omni', hubColor: '#10B981', cover: coverAutoReplyOffhours,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Monitora mensagens recebidas no WhatsApp', 'Se fora do horário comercial configurado, responde automaticamente', 'Informa o cliente sobre o horário de retorno'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Monitorar', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Horário comercial', icon: Clock, fields: [
        { key: 'start_hour', label: 'Início do expediente', type: 'select', options: [{ label: '07:00', value: '07' }, { label: '08:00', value: '08' }, { label: '09:00', value: '09' }, { label: '10:00', value: '10' }], defaultValue: '08', span: 'half' },
        { key: 'end_hour', label: 'Fim do expediente', type: 'select', options: [{ label: '17:00', value: '17' }, { label: '18:00', value: '18' }, { label: '19:00', value: '19' }, { label: '20:00', value: '20' }], defaultValue: '18', span: 'half' },
        { key: 'work_days', label: 'Dias de atendimento', type: 'select', options: [{ label: 'Seg a Sex', value: 'weekdays' }, { label: 'Seg a Sáb', value: 'weekdays_sat' }, { label: 'Todos os dias', value: 'all' }], defaultValue: 'weekdays', span: 'half' },
      ]},
      { title: 'Mensagem automática', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: 'Olá! 👋\n\nObrigado por entrar em contato!\n\nNosso horário de atendimento é de {horario_inicio} às {horario_fim}, {dias_semana}.\n\nSua mensagem foi recebida e responderemos assim que possível! 😊\n\nEquipe {empresa}', helpText: 'Variáveis: {nome}, {empresa}, {horario_inicio}, {horario_fim}, {dias_semana}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Resposta fora do horário', description: `Auto-resposta fora do horário (${c.start_hour}h-${c.end_hour}h)`,
      trigger_type: 'whatsapp_message', trigger_config: { outside_hours: true, start_hour: c.start_hour, end_hour: c.end_hour, work_days: c.work_days },
      nodes: makeNodes({ type: 'whatsapp_channel', label: 'Mensagem recebida' }, { type: 'send_whatsapp', label: 'Auto-resposta', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'faq-whatsapp', title: 'FAQ automático WhatsApp',
    description: 'Responde perguntas frequentes automaticamente com IA',
    longDescription: 'Configure respostas automáticas para as perguntas mais frequentes dos seus clientes. O sistema usa IA para identificar a intenção e responder instantaneamente.',
    category: 'support', icon: HelpCircle, iconColor: '#6366F1', hub: 'Omni', hubColor: '#10B981', cover: coverFaqWhatsapp,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Cliente envia mensagem no WhatsApp', 'IA analisa a intenção da mensagem', 'Se for uma pergunta frequente, responde automaticamente', 'Se não souber, encaminha para atendente humano'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Monitorar', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Perguntas e respostas', icon: HelpCircle, fields: [
        { key: 'faq_1_q', label: 'Pergunta 1', type: 'text', placeholder: 'Ex: Qual o horário de funcionamento?', span: 'full' },
        { key: 'faq_1_a', label: 'Resposta 1', type: 'textarea', placeholder: 'Ex: Funcionamos de seg a sex, das 8h às 18h.', defaultValue: '' },
        { key: 'faq_2_q', label: 'Pergunta 2', type: 'text', placeholder: 'Ex: Quais formas de pagamento?', span: 'full' },
        { key: 'faq_2_a', label: 'Resposta 2', type: 'textarea', placeholder: 'Ex: Aceitamos PIX, cartão e boleto.', defaultValue: '' },
        { key: 'faq_3_q', label: 'Pergunta 3', type: 'text', placeholder: 'Ex: Qual o prazo de entrega?', span: 'full' },
        { key: 'faq_3_a', label: 'Resposta 3', type: 'textarea', placeholder: 'Ex: O prazo é de 3 a 5 dias úteis.', defaultValue: '' },
      ]},
      { title: 'Fallback', icon: Users, fields: [
        { key: 'fallback_action', label: 'Se não souber responder', type: 'select', options: [{ label: 'Encaminhar para humano', value: 'transfer' }, { label: 'Pedir para aguardar', value: 'wait' }, { label: 'Usar IA para responder', value: 'ai' }], defaultValue: 'transfer', span: 'half' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'FAQ automático WhatsApp', description: 'Responde perguntas frequentes com IA',
      trigger_type: 'whatsapp_message', trigger_config: { faq: [{ q: c.faq_1_q, a: c.faq_1_a }, { q: c.faq_2_q, a: c.faq_2_a }, { q: c.faq_3_q, a: c.faq_3_a }], fallback: c.fallback_action },
      nodes: makeNodes({ type: 'whatsapp_channel', label: 'Mensagem recebida' }, { type: 'condition', label: 'FAQ match?', config: {} }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: {} }]
    }),
  },
  {
    id: 'ai-auto-response', title: 'Atendente IA automático',
    description: 'IA responde todas as mensagens do WhatsApp automaticamente',
    longDescription: 'Ative um agente de IA para responder automaticamente todas as mensagens do WhatsApp, 24 horas por dia, com base nas instruções que você definir.',
    category: 'support', icon: Bot, iconColor: '#8B5CF6', hub: 'Omni', hubColor: '#10B981', cover: coverAiAutoResponse,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Toda mensagem recebida é processada pela IA', 'A IA responde baseada nas instruções configuradas', 'Se necessário, transfere para atendente humano', 'Funciona 24h, sem pausa'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Ativar no WhatsApp', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Personalidade da IA', icon: Bot, fields: [
        { key: 'ai_name', label: 'Nome do atendente IA', type: 'text', placeholder: 'Ex: Ana', defaultValue: 'Assistente', span: 'half' },
        { key: 'ai_tone', label: 'Tom de voz', type: 'select', options: [{ label: 'Formal', value: 'formal' }, { label: 'Amigável', value: 'friendly' }, { label: 'Profissional', value: 'professional' }, { label: 'Descontraído', value: 'casual' }], defaultValue: 'friendly', span: 'half' },
        { key: 'ai_instructions', label: 'Instruções para a IA', type: 'textarea', defaultValue: 'Você é assistente da {empresa}. Responda de forma clara e objetiva. Se não souber algo, diga que vai verificar e retornar.', helpText: 'Descreva como a IA deve se comportar, quais informações pode fornecer, etc.', aiHelpPrompt: 'Aqui você define o comportamento da IA. Quanto mais detalhado, melhor será o atendimento.' },
      ]},
      { title: 'Limites', icon: AlertTriangle, fields: [
        { key: 'transfer_on_request', label: 'Transferir quando cliente pedir humano', type: 'toggle', defaultValue: 'true' },
        { key: 'max_messages', label: 'Máx. mensagens antes de transferir', type: 'number', placeholder: '10', defaultValue: '10', span: 'half', helpText: 'Após esse número de mensagens, transfere para humano' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Atendente IA automático', description: `IA "${c.ai_name}" no WhatsApp`,
      trigger_type: 'whatsapp_message', trigger_config: { ai_enabled: true, ai_name: c.ai_name, ai_tone: c.ai_tone, ai_instructions: c.ai_instructions, transfer_on_request: c.transfer_on_request === 'true', max_messages: parseInt(c.max_messages || '10') },
      nodes: makeNodes({ type: 'whatsapp_channel', label: 'Mensagem recebida' }, { type: 'transfer_ai_agent', label: `IA: ${c.ai_name}`, config: { instructions: c.ai_instructions } }),
      edges: makeEdges(), actions: [{ type: 'transfer_ai_agent', config: { instructions: c.ai_instructions } }]
    }),
  },

  // ── NOVOS FINANCEIRO ──
  {
    id: 'auto-receipt', title: 'Gerar recibo automático',
    description: 'Gera e envia recibo em PDF após pagamento recebido',
    longDescription: 'Automatize a geração de recibos. Quando um pagamento é registrado, o sistema gera o recibo em PDF e envia ao cliente pelo canal configurado.',
    category: 'financial', icon: FileDown, iconColor: '#059669', hub: 'Suite', hubColor: '#374DA4', cover: coverAutoReceipt,
    requiredChannels: ['whatsapp', 'email'],
    howItWorks: ['Pagamento é registrado no sistema', 'Recibo é gerado automaticamente em PDF', 'Enviado ao cliente pelo canal escolhido', 'Cópia arquivada no sistema'],
    configSections: [
      { title: 'Canal de envio', icon: Send, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'both', required: true }] },
      { title: 'Dados do recibo', icon: FileText, fields: [
        { key: 'company_name_receipt', label: 'Nome da empresa no recibo', type: 'text', placeholder: 'Sua Empresa LTDA', span: 'full' },
        { key: 'payment_method', label: 'Método de pagamento padrão', type: 'select', options: [{ label: 'PIX', value: 'PIX' }, { label: 'Cartão', value: 'Cartão' }, { label: 'Boleto', value: 'Boleto' }, { label: 'Dinheiro', value: 'Dinheiro' }], defaultValue: 'PIX', span: 'half' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: 'Olá {nome}! ✅\n\nSegue em anexo o recibo referente ao pagamento de R$ {valor}.\n\nObrigado! 🙏', helpText: 'Variáveis: {nome}, {valor}, {servico}, {data_pagamento}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Gerar recibo automático', description: 'Gera PDF e envia recibo automaticamente',
      trigger_type: 'webhook', trigger_config: { event: 'payment_received' },
      nodes: makeNodes({ type: 'webhook', label: 'Pagamento recebido' }, { type: 'create_receipt', label: 'Gerar + enviar recibo', config: { payment_method: c.payment_method, send_method: c.channel } }),
      edges: makeEdges(), actions: [{ type: 'create_receipt', config: { payment_method: c.payment_method } }]
    }),
  },

  // ── NOVOS VENDAS ──
  {
    id: 'new-sale-alert', title: 'Alerta de nova venda',
    description: 'Notifica a equipe quando uma venda é fechada',
    longDescription: 'Receba uma notificação instantânea por WhatsApp quando uma nova venda ou proposta é aprovada, mantendo toda a equipe informada.',
    category: 'sales', icon: ShoppingCart, iconColor: '#10B981', hub: 'Suite', hubColor: '#374DA4', cover: coverNewSaleAlert,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Quando uma proposta é aprovada ou venda registrada', 'Envia notificação para a equipe por WhatsApp', 'Inclui dados do cliente e valor da venda'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Notificar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Notificação', icon: Bell, fields: [
        { key: 'notify_to', label: 'Quem notificar?', type: 'select', options: [{ label: 'Administradores', value: 'admins' }, { label: 'Equipe de vendas', value: 'sales' }, { label: 'Todos', value: 'all' }], defaultValue: 'all', span: 'half' },
        { key: 'message', label: 'Mensagem', type: 'textarea', defaultValue: '🎉 Nova venda fechada!\n\nCliente: {nome}\nValor: R$ {valor}\nServiço: {servico}\n\nParabéns equipe! 🏆', helpText: 'Variáveis: {nome}, {valor}, {servico}, {vendedor}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Alerta de nova venda', description: 'Notifica equipe sobre novas vendas',
      trigger_type: 'proposal_status', trigger_config: { status: 'approved', notify_to: c.notify_to },
      nodes: makeNodes({ type: 'proposal_status', label: 'Venda fechada' }, { type: 'send_whatsapp', label: 'Notificar equipe', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'goal-achieved', title: 'Meta atingida — celebração',
    description: 'Celebra com a equipe quando uma meta é batida',
    longDescription: 'Configure metas de vendas mensais e, quando atingidas, o sistema envia automaticamente uma mensagem de celebração para toda a equipe.',
    category: 'sales', icon: Zap, iconColor: '#F59E0B', hub: 'Suite', hubColor: '#374DA4', cover: coverGoalAchieved,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Defina o valor da meta mensal', 'O sistema acompanha o total de vendas', 'Quando a meta é atingida, notifica a equipe', 'Mensagem de celebração personalizada'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Notificar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Meta', icon: Target, fields: [
        { key: 'goal_amount', label: 'Meta mensal (R$)', type: 'currency', placeholder: '10.000,00', span: 'half', aiHelpPrompt: 'Defina o valor total de vendas para considerar a meta batida no mês.' },
        { key: 'goal_type', label: 'Tipo de meta', type: 'select', options: [{ label: 'Valor em vendas', value: 'revenue' }, { label: 'Quantidade de vendas', value: 'count' }], defaultValue: 'revenue', span: 'half' },
      ]},
      { title: 'Mensagem de celebração', icon: Gift, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: '🏆🎉 META BATIDA!\n\nParabéns equipe! Atingimos a meta de R$ {meta} este mês!\n\nTotal: R$ {total_vendas}\nVendas: {qtd_vendas}\n\nContinuem assim! 💪🔥', helpText: 'Variáveis: {meta}, {total_vendas}, {qtd_vendas}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Meta atingida — celebração', description: `Meta: R$ ${c.goal_amount}`,
      trigger_type: 'schedule', trigger_config: { cron: '0 18 * * *', check: 'goal_reached', goal_amount: c.goal_amount, goal_type: c.goal_type },
      nodes: makeNodes({ type: 'schedule', label: 'Verificar meta' }, { type: 'send_whatsapp', label: 'Celebrar!', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },

  // ── NOVOS FOLLOW-UP ──
  {
    id: 'referral-thanks', title: 'Agradecimento por indicação',
    description: 'Agradece automaticamente quando recebe uma indicação',
    longDescription: 'Quando um cliente indica alguém, envie automaticamente uma mensagem de agradecimento personalizada.',
    category: 'followup', icon: Gift, iconColor: '#EC4899', hub: 'Omni', hubColor: '#10B981', cover: coverReferralThanks,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Quando um contato é cadastrado com indicação', 'Identifica quem fez a indicação', 'Envia mensagem de agradecimento ao indicador'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Recompensa', icon: Gift, fields: [
        { key: 'offer_reward', label: 'Oferecer recompensa?', type: 'toggle', defaultValue: 'true', helpText: 'Ex: desconto, brinde ou crédito' },
        { key: 'reward_text', label: 'Texto da recompensa', type: 'text', placeholder: 'Ex: 10% de desconto no próximo serviço', defaultValue: '10% de desconto no próximo serviço' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: 'Olá {nome}! 🙏\n\nMuito obrigado por indicar {indicado} para nós!\n\nComo agradecimento: {recompensa}\n\nSua confiança é muito importante! ❤️\n\nEquipe {empresa}', helpText: 'Variáveis: {nome}, {indicado}, {recompensa}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Agradecimento por indicação', description: 'Agradece indicações automaticamente',
      trigger_type: 'new_client', trigger_config: { has_referral: true },
      nodes: makeNodes({ type: 'new_client', label: 'Indicação recebida' }, { type: 'send_whatsapp', label: 'Agradecer', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },

  // ── NOVOS PRODUTIVIDADE ──
  {
    id: 'weekly-report', title: 'Relatório semanal',
    description: 'Envia resumo semanal de performance toda segunda-feira',
    longDescription: 'Receba toda segunda-feira um relatório completo com métricas de vendas, atendimentos, tarefas concluídas e metas atingidas.',
    category: 'productivity', icon: BarChart3, iconColor: '#374DA4', hub: 'Suite', hubColor: '#374DA4', cover: coverWeeklyReport,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Toda segunda-feira no horário configurado', 'Coleta métricas da semana anterior', 'Gera relatório resumido', 'Envia via WhatsApp para os gestores'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Receber por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Configuração', icon: BarChart3, fields: [
        { key: 'send_time', label: 'Horário de envio', type: 'select', options: [{ label: '07:00', value: '07' }, { label: '08:00', value: '08' }, { label: '09:00', value: '09' }], defaultValue: '08', span: 'half' },
        { key: 'include_sales', label: 'Incluir métricas de vendas', type: 'toggle', defaultValue: 'true' },
        { key: 'include_tasks', label: 'Incluir tarefas concluídas', type: 'toggle', defaultValue: 'true' },
        { key: 'include_messages', label: 'Incluir volume de atendimentos', type: 'toggle', defaultValue: 'true' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Relatório semanal', description: `Toda segunda às ${c.send_time}h`,
      trigger_type: 'schedule', trigger_config: { cron: `0 ${c.send_time} * * 1`, report_type: 'weekly', include_sales: c.include_sales === 'true', include_tasks: c.include_tasks === 'true', include_messages: c.include_messages === 'true' },
      nodes: makeNodes({ type: 'schedule', label: 'Segunda-feira' }, { type: 'send_whatsapp', label: 'Enviar relatório', config: {} }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: {} }]
    }),
  },

  // ── NOVOS INTEGRAÇÕES ──
  {
    id: 'send-contract', title: 'Enviar contrato automático',
    description: 'Envia contrato para assinatura após proposta aprovada',
    longDescription: 'Quando uma proposta é aprovada, gera e envia automaticamente o contrato baseado em um template para o cliente assinar.',
    category: 'integrations', icon: FileText, iconColor: '#374DA4', hub: 'Suite', hubColor: '#374DA4', cover: coverSendContract,
    requiredChannels: ['whatsapp', 'email'],
    howItWorks: ['Proposta é aprovada pelo cliente', 'Contrato é gerado a partir do template selecionado', 'Enviado automaticamente para assinatura', 'Notifica o responsável após assinatura'],
    configSections: [
      { title: 'Canal de envio', icon: Send, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'both', required: true }] },
      { title: 'Contrato', icon: FileText, fields: [
        { key: 'contract_template', label: 'Template do contrato', type: 'select', options: [{ label: 'Contrato padrão', value: 'default' }, { label: 'Contrato de prestação de serviço', value: 'service' }, { label: 'Contrato de venda', value: 'sale' }], defaultValue: 'default', span: 'half' },
        { key: 'require_signature', label: 'Exigir assinatura digital', type: 'toggle', defaultValue: 'true' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: 'Olá {nome}! 📄\n\nSua proposta foi aprovada! Segue em anexo o contrato para assinatura.\n\nPor favor, revise e assine digitalmente.\n\nQualquer dúvida, estamos à disposição! 😊', helpText: 'Variáveis: {nome}, {servico}, {valor}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Enviar contrato automático', description: 'Contrato automático após aprovação',
      trigger_type: 'proposal_status', trigger_config: { status: 'approved' },
      nodes: makeNodes({ type: 'proposal_status', label: 'Proposta aprovada' }, { type: 'send_email', label: 'Enviar contrato', config: { message: c.message, template: c.contract_template } }),
      edges: makeEdges(), actions: [{ type: 'send_email', config: { message: c.message } }]
    }),
  },
  {
    id: 'contract-reminder', title: 'Lembrete de contrato pendente',
    description: 'Relembra o cliente sobre contrato aguardando assinatura',
    longDescription: 'Se um contrato foi enviado mas não assinado após X dias, envia automaticamente um lembrete ao cliente pedindo a assinatura.',
    category: 'integrations', icon: Bell, iconColor: '#374DA4', hub: 'Suite', hubColor: '#374DA4', cover: coverContractReminder,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Contrato é enviado ao cliente', 'Se não assinado após X dias, envia lembrete', 'Pode enviar até 3 lembretes espaçados'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Configuração', icon: Clock, fields: [
        { key: 'days_after', label: 'Dias após envio do contrato', type: 'number', placeholder: '3', defaultValue: '3', span: 'half' },
        { key: 'max_reminders', label: 'Máx. lembretes', type: 'select', options: [{ label: '1 lembrete', value: '1' }, { label: '2 lembretes', value: '2' }, { label: '3 lembretes', value: '3' }], defaultValue: '2', span: 'half' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: 'Olá {nome}! 📋\n\nNotamos que o contrato referente a "{servico}" ainda está pendente de assinatura.\n\nPode assinar quando tiver um momento? O link está no email enviado anteriormente.\n\nSe tiver dúvidas, estamos aqui! 😊', helpText: 'Variáveis: {nome}, {servico}, {dias}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Lembrete de contrato pendente', description: `Lembrete ${c.days_after} dias após envio`,
      trigger_type: 'schedule', trigger_config: { cron: '0 10 * * *', check: 'pending_contracts', days_after: parseInt(c.days_after || '3'), max_reminders: parseInt(c.max_reminders || '2') },
      nodes: makeNodes({ type: 'schedule', label: 'Verificar contratos' }, { type: 'send_whatsapp', label: 'Lembrete', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },

  // ── NOVOS: FOLLOW-UP ──
  {
    id: 'collect-feedback', title: 'Coletar feedback pós-serviço',
    description: 'Pede avaliação ao cliente após serviço concluído',
    longDescription: 'Após a conclusão de um serviço ou entrega, envia automaticamente uma mensagem pedindo feedback/avaliação com escala de 1 a 5 estrelas.',
    category: 'followup', icon: BarChart3, iconColor: '#F59E0B', hub: 'Omni', hubColor: '#10B981', cover: coverCollectFeedback,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Serviço é marcado como concluído', 'Aguarda o tempo configurado', 'Envia mensagem pedindo avaliação', 'Armazena o feedback no sistema'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Público-alvo', icon: Target, fields: [
        { key: 'recipient', label: 'Enviar para', type: 'recipient', required: true, recipientOptions: [
          { type: 'auto', label: 'Cliente do serviço', description: 'Envia para o cliente que recebeu o serviço' },
        ] },
      ]},
      { title: 'Timing', icon: Clock, fields: [
        { key: 'delay_hours', label: 'Horas após conclusão', type: 'number', placeholder: '2', defaultValue: '2', span: 'half', aiHelpPrompt: 'Tempo de espera após o serviço ser concluído para pedir feedback. 2h é o ideal.' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: 'Olá {nome}! 😊\n\nComo foi sua experiência com o serviço "{servico}"?\n\nDe 1 a 5, qual nota você daria?\n⭐ 1 - Ruim\n⭐⭐ 2 - Regular\n⭐⭐⭐ 3 - Bom\n⭐⭐⭐⭐ 4 - Muito bom\n⭐⭐⭐⭐⭐ 5 - Excelente\n\nSua opinião é muito importante! 🙏', helpText: 'Variáveis: {nome}, {servico}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Coletar feedback pós-serviço', description: `Pede feedback ${c.delay_hours}h após serviço`,
      trigger_type: 'service_completed', trigger_config: { delay_hours: parseInt(c.delay_hours || '2') },
      nodes: makeNodes({ type: 'service_completed', label: 'Serviço concluído' }, { type: 'send_whatsapp', label: 'Pedir feedback', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'win-back', title: 'Recuperar cliente perdido',
    description: 'Reativa clientes que cancelaram com oferta especial',
    longDescription: 'Quando um cliente cancela ou fica inativo por muito tempo, envia uma mensagem personalizada com uma oferta especial para reconquistá-lo.',
    category: 'followup', icon: RefreshCw, iconColor: '#374DA4', hub: 'Omni', hubColor: '#10B981', cover: coverWinBack,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Identifica clientes que cancelaram ou estão inativos há X dias', 'Envia mensagem com oferta de retorno', 'Inclui desconto ou benefício especial', 'Registra tentativa no CRM'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Público-alvo', icon: Target, fields: [
        { key: 'recipient', label: 'Quem reconquistar?', type: 'recipient', required: true, recipientOptions: [
          { type: 'all_clients', label: 'Todos os inativos', description: 'Contata todos os clientes inativos há X dias' },
          { type: 'tag', label: 'Por tag', description: 'Apenas clientes com tag específica' },
        ] },
        { key: 'inactive_days', label: 'Dias de inatividade', type: 'number', placeholder: '60', defaultValue: '60', span: 'half' },
      ]},
      { title: 'Oferta', icon: Gift, fields: [
        { key: 'discount', label: 'Desconto oferecido', type: 'text', placeholder: 'Ex: 20% de desconto', defaultValue: '20% de desconto', span: 'half' },
        { key: 'offer_validity', label: 'Validade da oferta', type: 'text', placeholder: 'Ex: 7 dias', defaultValue: '7 dias', span: 'half' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: 'Olá {nome}! 👋\n\nSentimos sua falta! Faz tempo que não nos vemos.\n\nPreparamos algo especial para você: {desconto} na sua próxima compra!\n\n⏰ Válido por {validade}\n\nQueremos você de volta! ❤️\n\nEquipe {empresa}', helpText: 'Variáveis: {nome}, {desconto}, {validade}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Recuperar cliente perdido', description: `Win-back após ${c.inactive_days} dias`,
      trigger_type: 'schedule', trigger_config: { cron: '0 10 * * 1', check: 'inactive_clients', inactive_days: parseInt(c.inactive_days || '60') },
      nodes: makeNodes({ type: 'schedule', label: 'Verificar inativos' }, { type: 'send_whatsapp', label: 'Oferta win-back', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },

  // ── NOVOS: ONBOARDING ──
  {
    id: 'onboarding-checklist', title: 'Checklist de onboarding',
    description: 'Envia etapas de ativação para novos clientes',
    longDescription: 'Guie novos clientes passo a passo com uma sequência de mensagens automáticas nos primeiros dias, garantindo que completem todas as etapas de ativação.',
    category: 'onboarding', icon: ClipboardList, iconColor: '#10B981', hub: 'Flow', hubColor: '#007DE3', cover: coverOnboardingChecklist,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Novo cliente é cadastrado', 'Dia 1: Envia boas-vindas + primeira etapa', 'Dia 3: Envia segunda etapa', 'Dia 7: Verifica se completou e oferece ajuda'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Público-alvo', icon: Target, fields: [
        { key: 'recipient', label: 'Enviar para', type: 'recipient', required: true, recipientOptions: [
          { type: 'auto', label: 'Novos clientes', description: 'Envia automaticamente para cada novo cliente cadastrado' },
        ] },
      ]},
      { title: 'Etapas do onboarding', icon: ClipboardList, fields: [
        { key: 'step1', label: 'Etapa 1 (Dia 1)', type: 'text', placeholder: 'Ex: Preencher perfil completo', defaultValue: 'Preencher perfil completo', span: 'full' },
        { key: 'step2', label: 'Etapa 2 (Dia 3)', type: 'text', placeholder: 'Ex: Agendar primeira reunião', defaultValue: 'Agendar primeira reunião', span: 'full' },
        { key: 'step3', label: 'Etapa 3 (Dia 7)', type: 'text', placeholder: 'Ex: Enviar documentos', defaultValue: 'Enviar documentos necessários', span: 'full' },
      ]},
      { title: 'Mensagem inicial', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto do Dia 1', type: 'textarea', defaultValue: 'Olá {nome}! 🎉\n\nBem-vindo(a)! Para começar da melhor forma, siga estas etapas:\n\n✅ Etapa 1: {etapa1}\n⬜ Etapa 2: {etapa2}\n⬜ Etapa 3: {etapa3}\n\nVamos juntos! 💪', helpText: 'Variáveis: {nome}, {etapa1}, {etapa2}, {etapa3}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Checklist de onboarding', description: 'Sequência de ativação em 7 dias',
      trigger_type: 'new_client', trigger_config: { sequence: [{ day: 1, step: c.step1 }, { day: 3, step: c.step2 }, { day: 7, step: c.step3 }] },
      nodes: makeNodes({ type: 'new_client', label: 'Novo cliente' }, { type: 'send_whatsapp', label: 'Enviar checklist', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },

  // ── NOVOS: MARKETING ──
  {
    id: 'promo-campaign', title: 'Campanha promocional',
    description: 'Dispara promoção para base segmentada',
    longDescription: 'Crie campanhas promocionais segmentadas por tag, grupo ou base completa. Defina o desconto, prazo e mensagem personalizada.',
    category: 'marketing', icon: Send, iconColor: '#EC4899', hub: 'Omni', hubColor: '#10B981', cover: coverPromoCampaign,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Defina o público-alvo por tag ou grupo', 'Configure a promoção (desconto, prazo)', 'O sistema envia para cada contato', 'Acompanhe conversões'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Público-alvo', icon: Target, fields: [
        { key: 'recipient', label: 'Enviar para', type: 'recipient', required: true, recipientOptions: [
          { type: 'all_clients', label: 'Toda a base', description: 'Envia para todos os contatos' },
          { type: 'tag', label: 'Por tag', description: 'Apenas contatos com tag específica' },
          { type: 'manual', label: 'Selecionar', description: 'Escolher contatos manualmente' },
        ] },
        { key: 'recipient_tag', label: 'Tag', type: 'text', placeholder: 'Ex: Clientes ativos' },
      ]},
      { title: 'Promoção', icon: DollarSign, fields: [
        { key: 'promo_name', label: 'Nome da promoção', type: 'text', placeholder: 'Ex: Black Friday 2025', span: 'full' },
        { key: 'discount', label: 'Desconto/benefício', type: 'text', placeholder: 'Ex: 30% OFF', defaultValue: '30% OFF', span: 'half' },
        { key: 'validity', label: 'Válido até', type: 'text', placeholder: 'Ex: 31/12/2025', span: 'half' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: '🔥 {promo}!\n\nOlá {nome}!\n\nAproveite: {desconto} em todos os nossos serviços!\n\n⏰ Válido até {validade}\n\nNão perca essa oportunidade! 🚀\n\n{empresa}', helpText: 'Variáveis: {nome}, {promo}, {desconto}, {validade}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: `Campanha: ${c.promo_name || 'Promocional'}`, description: `Promoção ${c.discount}`,
      trigger_type: 'manual', trigger_config: { recipient_filter: c.recipient, recipient_tag: c.recipient_tag },
      nodes: makeNodes({ type: 'manual', label: 'Iniciar campanha' }, { type: 'send_whatsapp', label: 'Enviar promoção', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'seasonal-campaign', title: 'Campanha sazonal',
    description: 'Envie mensagens em datas comemorativas automaticamente',
    longDescription: 'Configure campanhas para datas como Natal, Dia das Mães, Dia dos Namorados etc. O sistema envia automaticamente na data programada.',
    category: 'marketing', icon: Gift, iconColor: '#EF4444', hub: 'Omni', hubColor: '#10B981', cover: coverSeasonalCampaign,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Escolha a data comemorativa', 'Configure a mensagem e oferta', 'O sistema envia automaticamente na data', 'Ideal para fidelização'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Público-alvo', icon: Target, fields: [
        { key: 'recipient', label: 'Enviar para', type: 'recipient', required: true, recipientOptions: [
          { type: 'all_clients', label: 'Toda a base', description: 'Envia para todos os contatos' },
          { type: 'tag', label: 'Por tag', description: 'Apenas contatos com tag específica' },
        ] },
      ]},
      { title: 'Data comemorativa', icon: Calendar, fields: [
        { key: 'event_name', label: 'Evento', type: 'select', options: [
          { label: 'Natal', value: 'natal' }, { label: 'Ano Novo', value: 'ano_novo' }, { label: 'Dia das Mães', value: 'dia_maes' },
          { label: 'Dia dos Pais', value: 'dia_pais' }, { label: 'Dia dos Namorados', value: 'dia_namorados' },
          { label: 'Black Friday', value: 'black_friday' }, { label: 'Páscoa', value: 'pascoa' },
        ], defaultValue: 'natal', span: 'half' },
        { key: 'send_date', label: 'Data de envio', type: 'text', placeholder: 'Ex: 25/12', span: 'half' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: '🎄 Feliz Natal, {nome}!\n\nA equipe {empresa} deseja um Natal cheio de alegria e prosperidade!\n\nComo presente, preparamos uma condição especial para você. Entre em contato! 🎁\n\nBoas festas! ✨', helpText: 'Variáveis: {nome}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: `Campanha sazonal: ${c.event_name}`, description: `Envio em ${c.send_date}`,
      trigger_type: 'schedule', trigger_config: { date: c.send_date, event: c.event_name },
      nodes: makeNodes({ type: 'schedule', label: c.event_name || 'Data comemorativa' }, { type: 'send_whatsapp', label: 'Enviar', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'expiring-offer', title: 'Oferta com prazo expirando',
    description: 'Avisa que a oferta/desconto está prestes a expirar',
    longDescription: 'Envie lembretes automáticos para clientes que receberam uma oferta mas ainda não compraram, criando urgência antes do prazo acabar.',
    category: 'marketing', icon: AlertTriangle, iconColor: '#374DA4', hub: 'Omni', hubColor: '#10B981', cover: coverExpiringOffer,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Cliente recebeu oferta com prazo', 'X dias antes de expirar, envia lembrete', 'Cria senso de urgência', 'Aumenta taxa de conversão'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Público-alvo', icon: Target, fields: [
        { key: 'recipient', label: 'Enviar para', type: 'recipient', required: true, recipientOptions: [
          { type: 'tag', label: 'Clientes com oferta pendente', description: 'Contatos que receberam proposta/oferta em aberto' },
        ] },
        { key: 'recipient_tag', label: 'Tag dos contatos', type: 'text', placeholder: 'Ex: Proposta enviada', defaultValue: 'Proposta enviada' },
      ]},
      { title: 'Configuração', icon: Clock, fields: [
        { key: 'hours_before', label: 'Horas antes de expirar', type: 'number', placeholder: '24', defaultValue: '24', span: 'half' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: '⏰ {nome}, sua oferta expira em breve!\n\nO desconto especial que preparamos para você está acabando.\n\n🔥 Aproveite antes que expire!\n\nDúvidas? Estamos aqui! 😊\n\n{empresa}', helpText: 'Variáveis: {nome}, {empresa}, {oferta}, {prazo}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Oferta com prazo expirando', description: `Lembrete ${c.hours_before}h antes`,
      trigger_type: 'schedule', trigger_config: { cron: '0 9 * * *', check: 'expiring_offers', hours_before: parseInt(c.hours_before || '24') },
      nodes: makeNodes({ type: 'schedule', label: 'Verificar prazos' }, { type: 'send_whatsapp', label: 'Lembrete urgente', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },

  // ── NOVOS: VENDAS ──
  {
    id: 'lead-scoring', title: 'Classificar lead automaticamente',
    description: 'Pontua e classifica leads com base em interações',
    longDescription: 'Automatize a classificação de leads com scoring baseado em interações (abriu email, respondeu WhatsApp, visitou site). Leads quentes são notificados para a equipe de vendas.',
    category: 'sales', icon: Target, iconColor: '#6366F1', hub: 'Suite', hubColor: '#374DA4', cover: coverLeadScoring,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Sistema monitora interações do lead', 'Atribui pontuação por ação', 'Quando atinge pontuação mínima, classifica como "quente"', 'Notifica equipe de vendas'],
    configSections: [
      { title: 'Canal de notificação', icon: Phone, fields: [{ key: 'channel', label: 'Notificar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Quem notificar?', icon: Target, fields: [
        { key: 'recipient', label: 'Notificar', type: 'recipient', required: true, recipientOptions: [
          { type: 'all_clients', label: 'Equipe de vendas', description: 'Notifica todos os vendedores' },
          { type: 'manual', label: 'Pessoas específicas', description: 'Escolher quem será notificado' },
        ] },
      ]},
      { title: 'Critérios de pontuação', icon: BarChart3, fields: [
        { key: 'min_score', label: 'Pontuação mínima para "quente"', type: 'number', placeholder: '50', defaultValue: '50', span: 'half', aiHelpPrompt: 'Quando o lead atingir essa pontuação, será classificado como quente e a equipe será notificada.' },
        { key: 'score_reply', label: 'Pontos por resposta WhatsApp', type: 'number', placeholder: '20', defaultValue: '20', span: 'half' },
        { key: 'score_open', label: 'Pontos por abrir email', type: 'number', placeholder: '10', defaultValue: '10', span: 'half' },
      ]},
      { title: 'Notificação', icon: Bell, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: '🔥 Lead quente identificado!\n\nNome: {nome}\nTelefone: {telefone}\nPontuação: {pontuacao} pontos\n\nEsse lead está engajado! Entre em contato agora! 🚀', helpText: 'Variáveis: {nome}, {telefone}, {email}, {pontuacao}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Classificar lead automaticamente', description: `Score mínimo: ${c.min_score}`,
      trigger_type: 'client_updated', trigger_config: { check: 'lead_score', min_score: parseInt(c.min_score || '50') },
      nodes: makeNodes({ type: 'client_updated', label: 'Lead pontuado' }, { type: 'send_whatsapp', label: 'Notificar vendas', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'upsell-cross', title: 'Upsell e cross-sell',
    description: 'Sugere produtos/serviços complementares após compra',
    longDescription: 'Após uma venda, envie automaticamente sugestões de produtos ou serviços complementares, aumentando o ticket médio.',
    category: 'sales', icon: BarChart3, iconColor: '#10B981', hub: 'Omni', hubColor: '#10B981', cover: coverUpsellCross,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Cliente finaliza uma compra', 'Após X dias, envia sugestão personalizada', 'Oferece produto/serviço complementar', 'Aumenta receita por cliente'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Público-alvo', icon: Target, fields: [
        { key: 'recipient', label: 'Enviar para', type: 'recipient', required: true, recipientOptions: [
          { type: 'auto', label: 'Cliente que comprou', description: 'Envia para quem acabou de comprar' },
        ] },
      ]},
      { title: 'Configuração', icon: Clock, fields: [
        { key: 'days_after', label: 'Dias após a compra', type: 'number', placeholder: '7', defaultValue: '7', span: 'half' },
        { key: 'suggestion', label: 'Produto/serviço sugerido', type: 'text', placeholder: 'Ex: Manutenção preventiva', span: 'full' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: 'Olá {nome}! 😊\n\nComo está sendo sua experiência com "{servico}"?\n\nTemos uma sugestão perfeita para complementar: {sugestao}\n\n🎁 Condição especial para quem já é cliente!\n\nQuer saber mais? 💬', helpText: 'Variáveis: {nome}, {servico}, {sugestao}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Upsell e cross-sell', description: `Sugestão ${c.days_after} dias após compra`,
      trigger_type: 'schedule', trigger_config: { check: 'recent_purchases', days_after: parseInt(c.days_after || '7') },
      nodes: makeNodes({ type: 'schedule', label: 'Verificar compras' }, { type: 'send_whatsapp', label: 'Sugerir', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },

  // ── NOVOS: FINANCEIRO ──
  {
    id: 'subscription-renewal', title: 'Renovação de assinatura',
    description: 'Avisa sobre renovação próxima de plano/assinatura',
    longDescription: 'Envie lembretes automáticos antes do vencimento de assinaturas, permitindo que o cliente renove ou ajuste o plano.',
    category: 'financial', icon: RefreshCw, iconColor: '#374DA4', hub: 'Suite', hubColor: '#374DA4', cover: coverSubscriptionRenewal,
    requiredChannels: ['whatsapp', 'email'],
    howItWorks: ['Monitora datas de vencimento de assinaturas', 'X dias antes, envia lembrete de renovação', 'Inclui opções de planos e link de pagamento', 'Reduz churn involuntário'],
    configSections: [
      { title: 'Canal', icon: Send, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'both', required: true }] },
      { title: 'Público-alvo', icon: Target, fields: [
        { key: 'recipient', label: 'Enviar para', type: 'recipient', required: true, recipientOptions: [
          { type: 'all_clients', label: 'Todos com assinatura', description: 'Todos os assinantes com vencimento próximo' },
          { type: 'tag', label: 'Por plano/tag', description: 'Apenas assinantes de um plano específico' },
        ] },
        { key: 'recipient_tag', label: 'Plano/Tag', type: 'text', placeholder: 'Ex: Plano Pro' },
      ]},
      { title: 'Configuração', icon: Clock, fields: [
        { key: 'days_before', label: 'Dias antes do vencimento', type: 'number', placeholder: '7', defaultValue: '7', span: 'half' },
        { key: 'renewal_link', label: 'Link de renovação', type: 'text', placeholder: 'https://...', span: 'half' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: 'Olá {nome}! 📋\n\nSua assinatura vence em {dias} dias ({data_vencimento}).\n\nRenove agora para não perder acesso:\n🔗 {link_renovacao}\n\nDúvidas sobre planos? Estamos aqui! 😊\n\n{empresa}', helpText: 'Variáveis: {nome}, {dias}, {data_vencimento}, {plano}, {link_renovacao}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Renovação de assinatura', description: `Lembrete ${c.days_before} dias antes`,
      trigger_type: 'schedule', trigger_config: { cron: '0 9 * * *', check: 'expiring_subscriptions', days_before: parseInt(c.days_before || '7') },
      nodes: makeNodes({ type: 'schedule', label: 'Verificar assinaturas' }, { type: c.channel === 'email' ? 'send_email' : 'send_whatsapp', label: 'Lembrete renovação', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: c.channel === 'email' ? 'send_email' : 'send_whatsapp', config: { message: c.message } }]
    }),
  },

  // ── NOVOS: ATENDIMENTO ──
  {
    id: 'sla-alert', title: 'Alerta de SLA',
    description: 'Avisa quando atendimento ultrapassa tempo máximo',
    longDescription: 'Monitore o tempo de resposta dos atendimentos e receba alertas quando um cliente está esperando além do SLA configurado.',
    category: 'support', icon: AlertTriangle, iconColor: '#EF4444', hub: 'Flow', hubColor: '#007DE3', cover: coverSlaAlert,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Monitora tempo de espera dos atendimentos', 'Se ultrapassar o SLA, envia alerta', 'Notifica gestor ou atendente responsável', 'Evita clientes insatisfeitos'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Alertar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Quem alertar?', icon: Target, fields: [
        { key: 'recipient', label: 'Notificar', type: 'recipient', required: true, recipientOptions: [
          { type: 'all_clients', label: 'Gestores', description: 'Notifica todos os gestores' },
          { type: 'manual', label: 'Pessoas específicas', description: 'Escolher quem será alertado' },
        ] },
      ]},
      { title: 'SLA', icon: Clock, fields: [
        { key: 'max_minutes', label: 'Tempo máximo (minutos)', type: 'number', placeholder: '30', defaultValue: '30', span: 'half', aiHelpPrompt: 'Tempo máximo de espera antes de gerar alerta. 30 minutos é padrão para atendimentos.' },
        { key: 'check_interval', label: 'Verificar a cada (minutos)', type: 'select', options: [{ label: '5 min', value: '5' }, { label: '10 min', value: '10' }, { label: '15 min', value: '15' }], defaultValue: '10', span: 'half' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto do alerta', type: 'textarea', defaultValue: '🚨 ALERTA SLA!\n\nO cliente {nome_cliente} está aguardando há {minutos} minutos sem resposta.\n\nCanal: WhatsApp\nAtendente: {atendente}\n\nPor favor, responda imediatamente! ⚡', helpText: 'Variáveis: {nome_cliente}, {minutos}, {atendente}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Alerta de SLA', description: `Alerta após ${c.max_minutes} min`,
      trigger_type: 'schedule', trigger_config: { cron: `*/${c.check_interval} * * * *`, check: 'sla_breach', max_minutes: parseInt(c.max_minutes || '30') },
      nodes: makeNodes({ type: 'schedule', label: 'Verificar SLA' }, { type: 'send_whatsapp', label: 'Alertar', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'lead-capture-bot', title: 'Bot captura de leads',
    description: 'Chatbot que qualifica e captura leads no WhatsApp',
    longDescription: 'Um chatbot automático que faz perguntas de qualificação para novos contatos no WhatsApp, coleta dados e salva no CRM.',
    category: 'support', icon: Bot, iconColor: '#10B981', hub: 'Omni', hubColor: '#10B981', cover: coverLeadCaptureBot,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Novo contato envia mensagem no WhatsApp', 'Bot faz perguntas de qualificação', 'Coleta nome, email, interesse', 'Salva no CRM e notifica vendedor'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Ativar no', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Perguntas de qualificação', icon: HelpCircle, fields: [
        { key: 'q1', label: 'Pergunta 1', type: 'text', placeholder: 'Ex: Qual seu nome?', defaultValue: 'Qual seu nome completo?', span: 'full' },
        { key: 'q2', label: 'Pergunta 2', type: 'text', placeholder: 'Ex: Qual seu email?', defaultValue: 'Qual seu email para contato?', span: 'full' },
        { key: 'q3', label: 'Pergunta 3', type: 'text', placeholder: 'Ex: Qual serviço te interessa?', defaultValue: 'Qual serviço você tem interesse?', span: 'full' },
      ]},
      { title: 'Mensagem de boas-vindas', icon: MessageSquare, fields: [
        { key: 'welcome_message', label: 'Texto', type: 'textarea', defaultValue: 'Olá! 👋 Bem-vindo(a) à {empresa}!\n\nSou o assistente virtual e vou te ajudar. Para começar, preciso de algumas informações rápidas.\n\n{pergunta1}', helpText: 'Variáveis: {empresa}, {pergunta1}' },
      ]},
      { title: 'Notificação', icon: Bell, fields: [
        { key: 'notify_sales', label: 'Notificar equipe de vendas', type: 'toggle', defaultValue: 'true', helpText: 'Avisa a equipe quando um lead é qualificado' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Bot captura de leads', description: 'Chatbot de qualificação no WhatsApp',
      trigger_type: 'whatsapp_message', trigger_config: { bot_mode: true, questions: [c.q1, c.q2, c.q3], welcome: c.welcome_message },
      nodes: makeNodes({ type: 'whatsapp_channel', label: 'Mensagem recebida' }, { type: 'create_client', label: 'Criar lead', config: {} }),
      edges: makeEdges(), actions: [{ type: 'create_client', config: {} }]
    }),
  },

  // ── NOVOS: PRODUTIVIDADE ──
  {
    id: 'meeting-notes', title: 'Resumo de reunião automático',
    description: 'Envia resumo e próximos passos após reunião',
    longDescription: 'Após uma reunião ser concluída, envia automaticamente um resumo com os pontos discutidos e próximos passos para todos os participantes.',
    category: 'productivity', icon: FileText, iconColor: '#8B5CF6', hub: 'Flow', hubColor: '#007DE3', cover: coverMeetingNotes,
    requiredChannels: ['whatsapp', 'email'],
    howItWorks: ['Reunião é marcada como concluída', 'Sistema gera resumo dos pontos principais', 'Envia para todos os participantes', 'Inclui próximos passos e prazos'],
    configSections: [
      { title: 'Canal', icon: Send, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'both', required: true }] },
      { title: 'Quem recebe?', icon: Target, fields: [
        { key: 'recipient', label: 'Enviar para', type: 'recipient', required: true, recipientOptions: [
          { type: 'auto', label: 'Participantes da reunião', description: 'Envia para todos que participaram' },
        ] },
      ]},
      { title: 'Template do resumo', icon: FileText, fields: [
        { key: 'include_transcript', label: 'Incluir transcrição (se disponível)', type: 'toggle', defaultValue: 'false' },
        { key: 'include_action_items', label: 'Listar ações e responsáveis', type: 'toggle', defaultValue: 'true' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: '📝 Resumo da reunião: {titulo}\n\nData: {data}\nParticipantes: {participantes}\n\n📌 Pontos discutidos:\n{pontos}\n\n✅ Próximos passos:\n{acoes}\n\nQualquer dúvida, entre em contato!\n\n{empresa}', helpText: 'Variáveis: {titulo}, {data}, {participantes}, {pontos}, {acoes}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Resumo de reunião automático', description: 'Envia resumo pós-reunião',
      trigger_type: 'meeting_completed', trigger_config: { include_transcript: c.include_transcript === 'true', include_action_items: c.include_action_items === 'true' },
      nodes: makeNodes({ type: 'meeting_completed', label: 'Reunião concluída' }, { type: c.channel === 'email' ? 'send_email' : 'send_whatsapp', label: 'Enviar resumo', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: c.channel === 'email' ? 'send_email' : 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'new-team-member', title: 'Boas-vindas novo membro',
    description: 'Mensagem de boas-vindas quando alguém entra na equipe',
    longDescription: 'Quando um novo membro é adicionado à equipe, envia automaticamente uma mensagem de boas-vindas com informações úteis e links importantes.',
    category: 'productivity', icon: UserPlus, iconColor: '#10B981', hub: 'Flow', hubColor: '#007DE3', cover: coverNewTeamMember,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Novo membro é adicionado à empresa', 'Sistema envia mensagem de boas-vindas', 'Inclui links úteis e contatos importantes', 'Facilita a integração'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Quem recebe?', icon: Target, fields: [
        { key: 'recipient', label: 'Enviar para', type: 'recipient', required: true, recipientOptions: [
          { type: 'auto', label: 'Novo membro', description: 'Envia para quem acabou de entrar' },
        ] },
      ]},
      { title: 'Informações', icon: Info, fields: [
        { key: 'team_contact', label: 'Contato do gestor', type: 'text', placeholder: 'Ex: João - (11) 99999-9999', span: 'full' },
        { key: 'useful_links', label: 'Links úteis', type: 'textarea', placeholder: 'Ex:\nManual: https://...\nSistema: https://...', defaultValue: '' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: '🎉 Bem-vindo(a) à equipe {empresa}!\n\nEstamos muito felizes em ter você conosco, {nome}!\n\n📋 Seu gestor: {gestor}\n🔗 Links importantes:\n{links}\n\nQualquer dúvida, estamos aqui! 💪\n\nBoa jornada! 🚀', helpText: 'Variáveis: {nome}, {empresa}, {gestor}, {links}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Boas-vindas novo membro', description: 'Onboarding de equipe',
      trigger_type: 'team_member_added', trigger_config: {},
      nodes: makeNodes({ type: 'team_member_added', label: 'Novo membro' }, { type: 'send_whatsapp', label: 'Boas-vindas', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },

  // ── NOVOS: VENDAS ──
  {
    id: 'loyalty-program', title: 'Programa de fidelidade',
    description: 'Recompensa clientes fiéis automaticamente',
    longDescription: 'Configure um programa de fidelidade que recompensa clientes após X compras ou valor acumulado, enviando cupons ou benefícios automaticamente.',
    category: 'sales', icon: Gift, iconColor: '#F59E0B', hub: 'Suite', hubColor: '#374DA4', cover: coverLoyaltyProgram,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Cliente acumula compras no sistema', 'Ao atingir o marco, dispara recompensa', 'Envia cupom/benefício automaticamente', 'Incentiva novas compras'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Público-alvo', icon: Target, fields: [
        { key: 'recipient', label: 'Quem participa?', type: 'recipient', required: true, recipientOptions: [
          { type: 'all_clients', label: 'Todos os clientes', description: 'Qualquer cliente que atingir o marco' },
          { type: 'tag', label: 'Por tag', description: 'Apenas clientes com tag específica' },
        ] },
      ]},
      { title: 'Regra de fidelidade', icon: Target, fields: [
        { key: 'trigger_type_loyalty', label: 'Recompensar quando', type: 'select', options: [
          { label: 'Atingir X compras', value: 'count' }, { label: 'Atingir R$ X acumulado', value: 'amount' },
        ], defaultValue: 'count', span: 'half' },
        { key: 'trigger_value', label: 'Quantidade/Valor', type: 'number', placeholder: '10', defaultValue: '10', span: 'half' },
        { key: 'reward', label: 'Recompensa', type: 'text', placeholder: 'Ex: 15% de desconto', defaultValue: '15% de desconto na próxima compra', span: 'full' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: '🏆 Parabéns {nome}!\n\nVocê é um cliente fiel e merece ser recompensado!\n\n🎁 Sua recompensa: {recompensa}\n\nUse agora mesmo! Obrigado pela confiança. ❤️\n\n{empresa}', helpText: 'Variáveis: {nome}, {recompensa}, {total_compras}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Programa de fidelidade', description: `Recompensa após ${c.trigger_value} ${c.trigger_type_loyalty === 'count' ? 'compras' : 'reais'}`,
      trigger_type: 'client_updated', trigger_config: { check: 'loyalty', type: c.trigger_type_loyalty, value: parseInt(c.trigger_value || '10') },
      nodes: makeNodes({ type: 'client_updated', label: 'Marco atingido' }, { type: 'send_whatsapp', label: 'Enviar recompensa', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },

  // ── NOVOS: INTEGRAÇÕES ──
  {
    id: 'warranty-expiry', title: 'Aviso de garantia expirando',
    description: 'Avisa cliente que a garantia está prestes a expirar',
    longDescription: 'Envie lembretes automáticos quando a garantia de um produto/serviço está próxima do vencimento, oferecendo extensão ou manutenção.',
    category: 'integrations', icon: AlertTriangle, iconColor: '#374DA4', hub: 'Suite', hubColor: '#374DA4', cover: coverWarrantyExpiry,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Sistema monitora datas de garantia', 'X dias antes, envia lembrete', 'Oferece opção de extensão', 'Previne reclamações'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Público-alvo', icon: Target, fields: [
        { key: 'recipient', label: 'Enviar para', type: 'recipient', required: true, recipientOptions: [
          { type: 'all_clients', label: 'Todos com garantia ativa', description: 'Clientes com garantia próxima do vencimento' },
          { type: 'tag', label: 'Por produto/tag', description: 'Apenas clientes de um produto específico' },
        ] },
      ]},
      { title: 'Configuração', icon: Clock, fields: [
        { key: 'days_before', label: 'Dias antes do vencimento', type: 'number', placeholder: '30', defaultValue: '30', span: 'half' },
        { key: 'offer_extension', label: 'Oferecer extensão de garantia', type: 'toggle', defaultValue: 'true' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: 'Olá {nome}! 🛡️\n\nA garantia do seu {produto} expira em {dias} dias ({data_vencimento}).\n\nDeseja estender a garantia por mais um período? Temos condições especiais!\n\nFale conosco! 😊\n\n{empresa}', helpText: 'Variáveis: {nome}, {produto}, {dias}, {data_vencimento}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Aviso de garantia expirando', description: `Alerta ${c.days_before} dias antes`,
      trigger_type: 'schedule', trigger_config: { cron: '0 9 * * *', check: 'expiring_warranty', days_before: parseInt(c.days_before || '30') },
      nodes: makeNodes({ type: 'schedule', label: 'Verificar garantias' }, { type: 'send_whatsapp', label: 'Avisar cliente', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },

  // ── NOVOS: MAIS TEMPLATES ──
  {
    id: 'post-purchase-thankyou', title: 'Agradecimento pós-compra',
    description: 'Mensagem de obrigado após cada compra realizada',
    longDescription: 'Encante seus clientes com uma mensagem personalizada logo após a compra, fortalecendo o relacionamento e incentivando recompras.',
    category: 'sales', icon: ShoppingCart, iconColor: '#10B981', hub: 'Omni', hubColor: '#10B981', cover: coverPostPurchase,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Compra é registrada no sistema', 'Envia agradecimento personalizado', 'Pode incluir cupom de próxima compra', 'Fortalece o relacionamento'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'include_coupon', label: 'Incluir cupom de desconto', type: 'toggle', defaultValue: 'false', helpText: 'Adiciona um código de desconto na mensagem' },
        { key: 'coupon_code', label: 'Código do cupom', type: 'text', placeholder: 'Ex: OBRIGADO10', span: 'half' },
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: 'Olá {nome}! 🎉\n\nObrigado pela sua compra! Esperamos que goste.\n\nSe precisar de algo, estamos aqui.\n\nAbraços, {empresa} ❤️', helpText: 'Variáveis: {nome}, {empresa}, {produto}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Agradecimento pós-compra', description: 'Agradece após cada compra',
      trigger_type: 'webhook', trigger_config: { event: 'purchase_completed' },
      nodes: makeNodes({ type: 'webhook', label: 'Compra realizada' }, { type: 'send_whatsapp', label: 'Agradecer', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'contract-signed-notify', title: 'Contrato assinado',
    description: 'Notifica equipe e cliente quando contrato é assinado',
    longDescription: 'Automatize as notificações de contratos assinados para que toda a equipe fique alinhada e o cliente receba confirmação.',
    category: 'sales', icon: FileText, iconColor: '#059669', hub: 'Suite', hubColor: '#374DA4', cover: coverContractSigned,
    requiredChannels: ['whatsapp', 'email'],
    howItWorks: ['Contrato muda status para "assinado"', 'Notifica responsável interno', 'Envia confirmação ao cliente', 'Atualiza pipeline de vendas'],
    configSections: [
      { title: 'Canal', icon: Send, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'both', required: true }] },
      { title: 'Notificações', icon: Bell, fields: [
        { key: 'notify_team', label: 'Notificar equipe interna', type: 'toggle', defaultValue: 'true' },
        { key: 'notify_client', label: 'Enviar confirmação ao cliente', type: 'toggle', defaultValue: 'true' },
      ]},
      { title: 'Mensagem ao cliente', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: 'Olá {nome}! ✅\n\nSeu contrato foi assinado com sucesso!\n\nPróximos passos:\n1. Nosso time entrará em contato em 24h\n2. Início dos trabalhos conforme acordado\n\nObrigado pela confiança! 🤝\n\n{empresa}', helpText: 'Variáveis: {nome}, {empresa}, {contrato}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Contrato assinado', description: 'Notifica sobre contrato assinado',
      trigger_type: 'webhook', trigger_config: { event: 'contract_signed' },
      nodes: makeNodes({ type: 'webhook', label: 'Contrato assinado' }, { type: 'send_whatsapp', label: 'Confirmar', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'announcement-broadcast', title: 'Comunicado geral',
    description: 'Envie avisos e novidades para toda a base de contatos',
    longDescription: 'Dispare comunicados importantes para toda ou parte da sua base: novas funcionalidades, mudanças de horário, feriados, etc.',
    category: 'marketing', icon: Megaphone, iconColor: '#F59E0B', hub: 'Omni', hubColor: '#10B981', cover: coverAnnouncement,
    requiredChannels: ['whatsapp', 'email'],
    howItWorks: ['Selecione o público-alvo', 'Escreva o comunicado', 'Defina data/hora do envio', 'Disparo automático no horário escolhido'],
    configSections: [
      { title: 'Canal', icon: Send, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'both', required: true }] },
      { title: 'Público-alvo', icon: Target, fields: [
        { key: 'recipient', label: 'Enviar para', type: 'recipient', required: true, recipientOptions: [
          { type: 'all_clients', label: 'Toda a base', description: 'Todos os contatos cadastrados' },
          { type: 'tag', label: 'Por tag/grupo', description: 'Apenas um segmento específico' },
        ] },
      ]},
      { title: 'Comunicado', icon: MessageSquare, fields: [
        { key: 'subject', label: 'Assunto (para email)', type: 'text', placeholder: 'Novidade importante!', span: 'full' },
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: '📢 Olá {nome}!\n\nTemos uma novidade importante:\n\n[Descreva aqui o comunicado]\n\nFique atento(a) às próximas atualizações!\n\nEquipe {empresa}', helpText: 'Variáveis: {nome}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Comunicado geral', description: 'Disparo de comunicado para a base',
      trigger_type: 'manual', trigger_config: { recipient_filter: c.recipient },
      nodes: makeNodes({ type: 'manual', label: 'Disparar comunicado' }, { type: c.channel === 'email' ? 'send_email' : 'send_whatsapp', label: 'Enviar', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: c.channel === 'email' ? 'send_email' : 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'monthly-report', title: 'Relatório mensal automático',
    description: 'Resume métricas do mês e envia para a equipe',
    longDescription: 'Gere e envie automaticamente um resumo mensal com as principais métricas: novos clientes, tarefas concluídas, receita e mais.',
    category: 'productivity', icon: BarChart3, iconColor: '#8B5CF6', hub: 'Suite', hubColor: '#374DA4', cover: coverMonthlyReport,
    requiredChannels: ['email'],
    howItWorks: ['No primeiro dia útil do mês', 'O sistema coleta as métricas do mês anterior', 'Gera um relatório resumido', 'Envia por email para os destinatários'],
    configSections: [
      { title: 'Conta de email', icon: AtSign, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'email', required: true }] },
      { title: 'Público-alvo', icon: Target, fields: [
        { key: 'recipient', label: 'Quem recebe?', type: 'recipient', required: true, recipientOptions: [
          { type: 'auto', label: 'Apenas eu (admin)', description: 'Apenas o administrador recebe' },
          { type: 'all_clients', label: 'Toda a equipe', description: 'Todos os membros da equipe' },
        ] },
      ]},
      { title: 'Métricas inclusas', icon: BarChart3, fields: [
        { key: 'include_clients', label: 'Novos clientes', type: 'toggle', defaultValue: 'true' },
        { key: 'include_tasks', label: 'Tarefas concluídas', type: 'toggle', defaultValue: 'true' },
        { key: 'include_meetings', label: 'Reuniões realizadas', type: 'toggle', defaultValue: 'true' },
      ]},
      { title: 'Email', icon: Mail, fields: [
        { key: 'subject', label: 'Assunto', type: 'text', defaultValue: '📊 Relatório mensal — {mes}/{ano}', span: 'full' },
        { key: 'message', label: 'Texto adicional', type: 'textarea', defaultValue: 'Olá!\n\nSegue o resumo do mês anterior:\n\n📈 Métricas serão inseridas automaticamente abaixo.\n\nBom trabalho! 🚀\n\n{empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Relatório mensal', description: 'Resumo automático no início do mês',
      trigger_type: 'schedule', trigger_config: { cron: '0 9 1 * *', report_type: 'monthly' },
      nodes: makeNodes({ type: 'schedule', label: 'Primeiro dia do mês' }, { type: 'send_email', label: 'Enviar relatório', config: { subject: c.subject, message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_email', config: { subject: c.subject, message: c.message } }]
    }),
  },
  {
    id: 'event-invite', title: 'Convite para evento',
    description: 'Dispare convites para eventos, workshops ou lives',
    longDescription: 'Automatize o envio de convites para eventos presenciais ou online. Ideal para workshops, lives, webinars e confraternizações.',
    category: 'scheduling', icon: Calendar, iconColor: '#0EA5E9', hub: 'Flow', hubColor: '#007DE3', cover: coverEventInvite,
    requiredChannels: ['whatsapp', 'email'],
    howItWorks: ['Defina os dados do evento', 'Selecione o público-alvo', 'O convite é enviado automaticamente', 'Pode incluir link de inscrição'],
    configSections: [
      { title: 'Canal', icon: Send, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'both', required: true }] },
      { title: 'Público-alvo', icon: Target, fields: [
        { key: 'recipient', label: 'Convidar', type: 'recipient', required: true, recipientOptions: [
          { type: 'all_clients', label: 'Toda a base', description: 'Todos os contatos' },
          { type: 'tag', label: 'Por tag', description: 'Apenas um grupo específico' },
          { type: 'manual', label: 'Selecionar', description: 'Escolher manualmente' },
        ] },
      ]},
      { title: 'Dados do evento', icon: Calendar, fields: [
        { key: 'event_name', label: 'Nome do evento', type: 'text', placeholder: 'Ex: Workshop de vendas', span: 'full' },
        { key: 'event_date', label: 'Data e hora', type: 'text', placeholder: '15/04/2026 às 14h', span: 'half' },
        { key: 'event_link', label: 'Link (reunião/inscrição)', type: 'text', placeholder: 'https://...', span: 'half' },
      ]},
      { title: 'Convite', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: '🎯 Olá {nome}!\n\nVocê está convidado(a) para:\n\n📌 {evento}\n📅 {data_evento}\n\n🔗 Inscreva-se: {link_evento}\n\nNão perca! Vagas limitadas.\n\n{empresa}', helpText: 'Variáveis: {nome}, {evento}, {data_evento}, {link_evento}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Convite para evento', description: `Convite: ${c.event_name || 'Evento'}`,
      trigger_type: 'manual', trigger_config: { event_name: c.event_name, event_date: c.event_date },
      nodes: makeNodes({ type: 'manual', label: 'Disparar convites' }, { type: c.channel === 'email' ? 'send_email' : 'send_whatsapp', label: 'Enviar convite', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: c.channel === 'email' ? 'send_email' : 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'partnership-followup', title: 'Follow-up de parceria',
    description: 'Acompanha propostas de parceria enviadas',
    longDescription: 'Automatize o acompanhamento de propostas de parceria. Após X dias sem resposta, envie um lembrete amigável para manter o contato.',
    category: 'followup', icon: Users, iconColor: '#7C3AED', hub: 'Suite', hubColor: '#374DA4', cover: coverPartnershipFollowup,
    requiredChannels: ['email'],
    howItWorks: ['Proposta de parceria é enviada', 'Sistema aguarda X dias', 'Se não houve resposta, envia follow-up', 'Pode escalonar para ligação'],
    configSections: [
      { title: 'Conta de email', icon: AtSign, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'email', required: true }] },
      { title: 'Timing', icon: Clock, fields: [{ key: 'days', label: 'Dias após envio', type: 'number', placeholder: '5', defaultValue: '5', span: 'half' }] },
      { title: 'Email de follow-up', icon: Mail, fields: [
        { key: 'subject', label: 'Assunto', type: 'text', defaultValue: 'Sobre nossa proposta de parceria', span: 'full' },
        { key: 'message', label: 'Corpo', type: 'textarea', defaultValue: 'Olá {nome}!\n\nPassando para verificar se teve a oportunidade de avaliar nossa proposta de parceria.\n\nEstamos à disposição para esclarecer qualquer dúvida e agendar uma conversa.\n\nAbraços,\n{remetente}', helpText: 'Variáveis: {nome}, {remetente}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Follow-up de parceria', description: `Follow-up ${c.days} dias após proposta`,
      trigger_type: 'schedule', trigger_config: { event: 'partnership_sent', days: parseInt(c.days || '5') },
      nodes: makeNodes({ type: 'schedule', label: 'Verificar propostas' }, { type: 'send_email', label: 'Follow-up', config: { subject: c.subject, message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_email', config: { subject: c.subject, message: c.message } }]
    }),
  },
  {
    id: 'ai-smart-followup', title: 'Follow-up inteligente com IA',
    description: 'IA analisa contexto e gera follow-up personalizado',
    longDescription: 'Use inteligência artificial para gerar follow-ups contextualizados. A IA analisa o histórico de interações e cria uma mensagem sob medida.',
    category: 'followup', icon: Bot, iconColor: '#6366F1', hub: 'Omni', hubColor: '#10B981', cover: coverAiFollowup,
    requiredChannels: ['whatsapp'],
    howItWorks: ['IA analisa o histórico de conversas', 'Identifica o melhor momento para follow-up', 'Gera mensagem personalizada baseada no contexto', 'Envia automaticamente via WhatsApp'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Público-alvo', icon: Target, fields: [
        { key: 'recipient', label: 'Aplicar para', type: 'recipient', required: true, recipientOptions: [
          { type: 'all_clients', label: 'Todos os leads', description: 'Leads sem resposta nos últimos dias' },
          { type: 'tag', label: 'Por tag', description: 'Apenas leads de um segmento' },
        ] },
      ]},
      { title: 'Configuração da IA', icon: Bot, fields: [
        { key: 'days_inactive', label: 'Dias sem resposta', type: 'number', placeholder: '3', defaultValue: '3', span: 'half' },
        { key: 'tone', label: 'Tom da mensagem', type: 'select', options: [
          { label: 'Profissional', value: 'professional' }, { label: 'Amigável', value: 'friendly' }, { label: 'Urgente', value: 'urgent' },
        ], defaultValue: 'friendly', span: 'half' },
        { key: 'max_length', label: 'Tamanho máximo (caracteres)', type: 'number', placeholder: '500', defaultValue: '500', span: 'half' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Follow-up inteligente com IA', description: `IA gera follow-up após ${c.days_inactive} dias`,
      trigger_type: 'schedule', trigger_config: { cron: '0 10 * * *', check: 'ai_followup', days: parseInt(c.days_inactive || '3'), tone: c.tone },
      nodes: makeNodes({ type: 'schedule', label: 'Verificar inativos' }, { type: 'ai_generate_send', label: 'IA gera e envia', config: { tone: c.tone, max_length: c.max_length } }),
      edges: makeEdges(), actions: [{ type: 'ai_generate_send', config: { tone: c.tone } }]
    }),
  },
  {
    id: 'review-request', title: 'Pedido de avaliação',
    description: 'Pede avaliação no Google ou redes sociais após atendimento',
    longDescription: 'Após concluir um serviço, envie automaticamente um pedido de avaliação com link direto para Google, Instagram ou outra plataforma.',
    category: 'marketing', icon: Star, iconColor: '#EAB308', hub: 'Omni', hubColor: '#10B981', cover: coverReviewRequest,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Serviço é marcado como concluído', 'Aguarda X horas', 'Envia mensagem com link de avaliação', 'Monitora taxa de resposta'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Timing', icon: Clock, fields: [
        { key: 'delay_hours', label: 'Horas após conclusão', type: 'number', placeholder: '48', defaultValue: '48', span: 'half' },
      ]},
      { title: 'Link de avaliação', icon: Star, fields: [
        { key: 'review_url', label: 'URL da avaliação (Google, etc.)', type: 'text', placeholder: 'https://g.page/r/...', span: 'full', helpText: 'Cole o link da sua página do Google Meu Negócio ou rede social' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: 'Olá {nome}! ⭐\n\nEsperamos que tenha gostado do nosso atendimento!\n\nSua avaliação nos ajuda muito a melhorar. Pode nos dar uma nota?\n\n🔗 Avaliar aqui: {link_avaliacao}\n\nLeva menos de 1 minuto! 🙏\n\nObrigado, {empresa}', helpText: 'Variáveis: {nome}, {empresa}, {link_avaliacao}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Pedido de avaliação', description: `Solicita avaliação ${c.delay_hours}h após conclusão`,
      trigger_type: 'proposal_status', trigger_config: { status: 'completed', delay_hours: parseInt(c.delay_hours || '48') },
      nodes: makeNodes({ type: 'proposal_status', label: 'Serviço concluído' }, { type: 'send_whatsapp', label: 'Pedir avaliação', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'appointment-reminder-sms', title: 'Lembrete de compromisso',
    description: 'Avisa cliente X horas antes do compromisso agendado',
    longDescription: 'Reduza faltas em compromissos com lembretes automáticos. O sistema avisa o cliente horas antes, incluindo data, hora e link se necessário.',
    category: 'scheduling', icon: Clock, iconColor: '#0891B2', hub: 'Flow', hubColor: '#007DE3', cover: coverAppointmentReminderSms,
    requiredChannels: ['whatsapp'],
    howItWorks: ['Compromisso é agendado no calendário', 'Sistema programa lembrete', 'X horas antes, envia mensagem', 'Cliente confirma presença'],
    configSections: [
      { title: 'Canal', icon: Phone, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'whatsapp', required: true }] },
      { title: 'Configuração', icon: Clock, fields: [
        { key: 'hours_before', label: 'Horas antes do compromisso', type: 'number', placeholder: '2', defaultValue: '2', span: 'half' },
        { key: 'allow_cancel', label: 'Permitir cancelamento por resposta', type: 'toggle', defaultValue: 'true' },
      ]},
      { title: 'Mensagem', icon: MessageSquare, fields: [
        { key: 'message', label: 'Texto', type: 'textarea', defaultValue: 'Olá {nome}! ⏰\n\nLembrando do seu compromisso:\n\n📌 {titulo}\n📅 {data} às {hora}\n\nConfirma sua presença? Responda SIM ou NÃO.\n\n{empresa}', helpText: 'Variáveis: {nome}, {titulo}, {data}, {hora}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Lembrete de compromisso', description: `Avisa ${c.hours_before}h antes`,
      trigger_type: 'schedule', trigger_config: { event: 'appointment', hours_before: parseInt(c.hours_before || '2') },
      nodes: makeNodes({ type: 'schedule', label: 'Verificar compromissos' }, { type: 'send_whatsapp', label: 'Enviar lembrete', config: { message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_whatsapp', config: { message: c.message } }]
    }),
  },
  {
    id: 'security-alert', title: 'Alerta de segurança',
    description: 'Notifica sobre login suspeito ou alteração de dados',
    longDescription: 'Mantenha a segurança da conta com alertas automáticos sobre atividades suspeitas, como logins de novos dispositivos ou alterações de senha.',
    category: 'integrations', icon: Shield, iconColor: '#DC2626', hub: 'Suite', hubColor: '#374DA4', cover: coverPasswordExpiry,
    requiredChannels: ['email'],
    howItWorks: ['Atividade suspeita é detectada', 'Sistema identifica o tipo de alerta', 'Notifica o usuário imediatamente', 'Registra log de segurança'],
    configSections: [
      { title: 'Conta de email', icon: AtSign, fields: [{ key: 'channel', label: 'Enviar por', type: 'channel', channelType: 'email', required: true }] },
      { title: 'Tipos de alerta', icon: Shield, fields: [
        { key: 'alert_login', label: 'Login de novo dispositivo', type: 'toggle', defaultValue: 'true' },
        { key: 'alert_password', label: 'Alteração de senha', type: 'toggle', defaultValue: 'true' },
        { key: 'alert_data', label: 'Alteração de dados cadastrais', type: 'toggle', defaultValue: 'false' },
      ]},
      { title: 'Email de alerta', icon: Mail, fields: [
        { key: 'subject', label: 'Assunto', type: 'text', defaultValue: '🔒 Alerta de segurança — {empresa}', span: 'full' },
        { key: 'message', label: 'Corpo', type: 'textarea', defaultValue: 'Olá {nome},\n\nDetectamos uma atividade incomum na sua conta:\n\n⚠️ {tipo_alerta}\n📅 {data}\n🌐 IP: {ip}\n\nSe não foi você, altere sua senha imediatamente.\n\nEquipe {empresa}', helpText: 'Variáveis: {nome}, {tipo_alerta}, {data}, {ip}, {empresa}' },
      ]}
    ],
    buildAutomation: (c) => ({
      name: 'Alerta de segurança', description: 'Notifica sobre atividades suspeitas',
      trigger_type: 'webhook', trigger_config: { event: 'security_alert', types: { login: c.alert_login === 'true', password: c.alert_password === 'true', data: c.alert_data === 'true' } },
      nodes: makeNodes({ type: 'webhook', label: 'Atividade detectada' }, { type: 'send_email', label: 'Alertar', config: { subject: c.subject, message: c.message } }),
      edges: makeEdges(), actions: [{ type: 'send_email', config: { subject: c.subject, message: c.message } }]
    }),
  },
];

const AIHelpButton: React.FC<{ prompt: string; fieldLabel: string }> = ({ prompt, fieldLabel }) => {
  const [open, setOpen] = useState(false);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const askAI = async () => {
    if (response) { setOpen(!open); return; }
    setOpen(true);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: {
          messages: [{ role: 'user', content: `Explique de forma clara e simples para um usuário não técnico o seguinte campo de configuração de automação. Campo: "${fieldLabel}". Contexto: ${prompt}. Responda em português do Brasil, de forma amigável, com no máximo 3 parágrafos curtos.` }],
          skipHistory: true,
        }
      });
      if (data?.response) {
        setResponse(data.response);
      } else {
        setResponse(prompt);
      }
    } catch {
      setResponse(prompt);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={askAI}
        className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors font-medium"
      >
        <Sparkles className="h-3 w-3" />
        Pedir ajuda à IA
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -5, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -5, height: 0 }}
            className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-foreground leading-relaxed"
          >
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                A IA está pensando...
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5 text-primary font-semibold text-[11px]">
                  <Bot className="h-3.5 w-3.5" />
                  Assistente IA
                </div>
                <p className="whitespace-pre-line">{response}</p>
                <button onClick={() => setOpen(false)} className="mt-2 text-[10px] text-muted-foreground hover:text-foreground">Fechar</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main Component ───

// Extracted card component
const FacilitatorCard: React.FC<{ f: FacilitatorTemplate; index: number; onClick: () => void }> = ({ f, index, onClick }) => (
  <motion.button 
    initial={{ opacity: 0, y: 15 }} 
    animate={{ opacity: 1, y: 0 }} 
    transition={{ duration: 0.4, delay: index * 0.03, ease: [0.22, 1, 0.36, 1] }} 
    onClick={onClick}
    className="group text-left rounded-2xl overflow-hidden border border-border bg-card hover:border-[#374DA4]/40 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 hover:-translate-y-1.5"
  >
    <div className="relative w-full aspect-[16/10] overflow-hidden">
      <img src={f.cover} alt={f.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
      <div className="absolute bottom-3 left-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center backdrop-blur-md ring-1 ring-white/20 shadow-lg" style={{ backgroundColor: `${f.iconColor}30` }}>
          <f.icon className="h-5 w-5" style={{ color: f.iconColor }} />
        </div>
      </div>
    </div>
    <div className="p-4">
      <h3 className="text-base font-bold text-foreground mb-1.5 leading-tight group-hover:text-[#374DA4] transition-colors">{f.title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{f.description}</p>
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border text-[#374DA4] text-xs font-bold tracking-wide">
        CONFIGURAR AGORA <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  </motion.button>
);

const AppsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedFacilitator, setSelectedFacilitator] = useState<FacilitatorTemplate | null>(null);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [isActivating, setIsActivating] = useState(false);
  const [activeCategory, setActiveCategory] = useState<FacilitatorCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [connectedChannels, setConnectedChannels] = useState<ConnectedChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [dialogTab, setDialogTab] = useState<'config' | 'preview'>('config');
  const [manualContacts, setManualContacts] = useState<{ name: string; phone: string }[]>([]);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [clientSearchResults, setClientSearchResults] = useState<any[]>([]);
  const [searchingClients, setSearchingClients] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [aiSearching, setAiSearching] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const aiDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('company_users').select('company_id').eq('user_id', user.id).single().then(({ data }) => {
      if (data) setCompanyId(data.company_id);
    });
  }, [user?.id]);

  const fetchChannels = useCallback(async () => {
    if (!companyId || !user?.id) return;
    setLoadingChannels(true);
    try {
      const [whatsappRes, emailRes] = await Promise.all([
        supabase.from('whatsapp_sessions').select('id, instance_name, phone_number, status').eq('company_id', companyId).eq('status', 'connected'),
        supabase.from('user_email_accounts').select('id, email, provider').eq('user_id', user.id),
      ]);
      const channels: ConnectedChannel[] = [];
      whatsappRes.data?.forEach(s => channels.push({ type: 'whatsapp', id: s.id, label: s.instance_name || s.phone_number || 'WhatsApp', sublabel: s.phone_number || undefined, status: 'connected' }));
      emailRes.data?.forEach(e => channels.push({ type: 'email', id: e.id, label: e.email, sublabel: e.provider, status: 'connected' }));
      setConnectedChannels(channels);
    } catch (err) {
      console.error('Error fetching channels:', err);
    } finally {
      setLoadingChannels(false);
    }
  }, [companyId, user?.id]);

  const searchClients = useCallback(async (query: string) => {
    if (!companyId || query.length < 2) { setClientSearchResults([]); return; }
    setSearchingClients(true);
    try {
      const { data } = await supabase.from('clients').select('id, name, phone, email').eq('company_id', companyId).or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`).limit(8);
      setClientSearchResults(data || []);
    } catch { setClientSearchResults([]); }
    finally { setSearchingClients(false); }
  }, [companyId]);

  useEffect(() => {
    const timer = setTimeout(() => { if (clientSearchQuery) searchClients(clientSearchQuery); }, 300);
    return () => clearTimeout(timer);
  }, [clientSearchQuery, searchClients]);

  const openDialog = (f: FacilitatorTemplate) => {
    const defaults: Record<string, string> = {};
    f.configSections.forEach(section => {
      section.fields.forEach(field => { defaults[field.key] = field.defaultValue || ''; });
    });
    setConfig(defaults);
    setSelectedFacilitator(f);
    setDialogTab('config');
    setManualContacts([]);
    setAddContactOpen(false);
    setClientSearchQuery('');
    setClientSearchResults([]);
    fetchChannels();
  };

  const activateFacilitator = async () => {
    if (!selectedFacilitator || !user?.id || !companyId) return;
    const channelField = selectedFacilitator.configSections.flatMap(s => s.fields).find(f => f.type === 'channel');
    if (channelField && !config[channelField.key]) {
      toast({ title: 'Canal não selecionado', description: 'Selecione um canal de envio antes de ativar.', variant: 'destructive' });
      return;
    }
    setIsActivating(true);
    try {
      const automation = selectedFacilitator.buildAutomation(config, connectedChannels);
      const { error } = await supabase.from('automations').insert({
        company_id: companyId, created_by: user.id,
        name: automation.name, description: automation.description,
        trigger_type: automation.trigger_type, trigger_config: { ...automation.trigger_config, manual_contacts: manualContacts.length > 0 ? manualContacts : undefined },
        nodes: automation.nodes, edges: automation.edges, actions: automation.actions, is_active: true,
      });
      if (error) throw error;
      toast({ title: '✅ Facilitador ativado!', description: `"${automation.name}" foi criado e está ativo.` });
      setSelectedFacilitator(null);
    } catch (err: any) {
      toast({ title: 'Erro ao ativar', description: err.message, variant: 'destructive' });
    } finally { setIsActivating(false); }
  };

  const addContact = () => {
    if (!newContactName.trim() || !newContactPhone.trim()) return;
    setManualContacts(prev => [...prev, { name: newContactName.trim(), phone: newContactPhone.trim() }]);
    setNewContactName('');
    setNewContactPhone('');
    setAddContactOpen(false);
  };

  const addClientAsContact = (client: any) => {
    if (client.phone && !manualContacts.some(c => c.phone === client.phone)) {
      setManualContacts(prev => [...prev, { name: client.name, phone: client.phone }]);
    }
    setClientSearchQuery('');
    setClientSearchResults([]);
  };

  // AI-powered search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowAiSuggestions(false);
    if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    if (value.length >= 3) {
      aiDebounceRef.current = setTimeout(() => runAiSearch(value), 600);
    } else {
      setAiSuggestions([]);
    }
  };

  const runAiSearch = async (query: string) => {
    setAiSearching(true);
    try {
      const allTitles = FACILITATORS.map(f => f.title).join(', ');
      const { data } = await supabase.functions.invoke('ai-assistant', {
        body: {
          messages: [{ role: 'user', content: `O usuário pesquisou: "${query}". Baseado nos apps disponíveis (${allTitles}), sugira até 5 termos de busca alternativos ou nomes de apps que possam atender o que ele quer. Retorne APENAS uma lista separada por "|", sem explicações. Se a busca já é precisa, retorne os nomes dos apps que combinam.` }],
          skipHistory: true,
        }
      });
      if (data?.response) {
        const suggestions = data.response.split('|').map((s: string) => s.trim()).filter((s: string) => s.length > 0).slice(0, 5);
        setAiSuggestions(suggestions);
        setShowAiSuggestions(true);
      }
    } catch { /* silent */ }
    finally { setAiSearching(false); }
  };

  const filtered = useMemo(() => FACILITATORS.filter(f => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesSearch = f.title.toLowerCase().includes(q) || 
                           f.description.toLowerCase().includes(q) || 
                           f.longDescription.toLowerCase().includes(q) || 
                           f.category.includes(q);
      
      // Se houver busca, ignoramos a categoria ativa para mostrar todos os resultados relevantes
      return matchesSearch;
    }
    
    // Se não houver busca, respeitamos a categoria selecionada
    if (activeCategory !== 'all' && f.category !== activeCategory) return false;
    return true;
  }), [activeCategory, searchQuery]);

  // Group by category
  const groupedByCategory = useMemo(() => {
    const groups: Record<string, FacilitatorTemplate[]> = {};
    for (const f of filtered) {
      if (!groups[f.category]) groups[f.category] = [];
      groups[f.category].push(f);
    }
    return groups;
  }, [filtered]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of FACILITATORS) {
      counts[f.category] = (counts[f.category] || 0) + 1;
    }
    return counts;
  }, []);

  const getChannelOptions = (channelType: 'whatsapp' | 'email' | 'both') => {
    return connectedChannels.filter(c => channelType === 'both' ? true : c.type === channelType);
  };

  const getMessagePreview = () => {
    if (!selectedFacilitator) return '';
    const msgField = selectedFacilitator.configSections.flatMap(s => s.fields).find(f => f.key === 'message' || f.key === 'msg1');
    let msg = config[msgField?.key || 'message'] || '';
    const replacements: Record<string, string> = {
      '{nome}': 'Maria Silva', '{valor}': config.invoice_amount || '150,00', '{servico}': config.invoice_description || 'Serviço exemplo',
      '{empresa}': 'Sua Empresa', '{data_vencimento}': '15/04/2026', '{dias}': config.days_before || '3',
      '{dias_atraso}': config.days_overdue || '1', '{link_pagamento}': config.payment_link || 'https://pay.exemplo.com/abc',
      '{telefone}': '(11) 99999-0000', '{email}': 'maria@email.com', '{remetente}': 'Você',
      '{data_reuniao}': '10/04/2026', '{hora_reuniao}': '14:00', '{tarefa}': 'Revisar proposta',
      '{prazo}': '08/04/2026', '{responsavel}': 'João', '{atribuidor}': 'Admin',
      '{prioridade}': 'Alta', '{titulo}': 'Reunião de alinhamento', '{data}': '10/04/2026',
      '{hora}': '14:00', '{minutos}': '60', '{link_reuniao}': 'https://meet.exemplo.com/abc',
      '{tipo_reuniao}': 'Videoconferência', '{titulo_reuniao}': 'Alinhamento semanal',
      '{link_agendamento}': 'https://agendar.exemplo.com', '{origem}': 'Site',
      '{oferta}': config.offer_discount === 'true' ? config.discount_text || '10% OFF' : '',
      '{ultima_interacao}': '15/02/2026', '{dias_inativo}': config.days || '30',
      '{metodo_pagamento}': 'Cartão de Crédito', '{data_pagamento}': '05/04/2026',
    };
    Object.entries(replacements).forEach(([key, value]) => { msg = msg.split(key).join(value); });
    return msg;
  };

  const renderField = (field: ConfigField) => {
    switch (field.type) {
      case 'channel': {
        const options = getChannelOptions(field.channelType || 'both');
        const noChannels = options.length === 0 && !loadingChannels;
        const neededType = field.channelType === 'both' ? 'WhatsApp ou Email' : field.channelType === 'whatsapp' ? 'WhatsApp' : 'Email';
        if (loadingChannels) return <Skeleton className="h-10 w-full rounded-lg" />;
        if (noChannels) {
          return (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-destructive text-sm font-medium"><WifiOff className="h-4 w-4" />Nenhum canal de {neededType} conectado</div>
              <p className="text-xs text-muted-foreground">{field.channelType === 'email' || field.channelType === 'both' ? 'Conecte uma conta Gmail em Configurações' : 'Conecte uma sessão WhatsApp em Omni → WhatsApp'}</p>
              <div className="flex gap-2">
                {(field.channelType === 'whatsapp' || field.channelType === 'both') && (
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => { setSelectedFacilitator(null); navigate('/dashboard/crm-whatsapp'); }}><Phone className="h-3 w-3 mr-1" /> Conectar WhatsApp</Button>
                )}
                {(field.channelType === 'email' || field.channelType === 'both') && (
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => { setSelectedFacilitator(null); navigate('/dashboard/email-tracker'); }}><Mail className="h-3 w-3 mr-1" /> Conectar Email</Button>
                )}
              </div>
            </div>
          );
        }
        return (
          <div className="space-y-2">
            {options.map(ch => (
              <button key={ch.id} type="button" onClick={() => setConfig(prev => ({ ...prev, [field.key]: ch.id }))}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${config[field.key] === ch.id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/20 bg-card'}`}>
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${ch.type === 'whatsapp' ? 'bg-green-500/10' : 'bg-[#374DA4]/10'}`}>
                  {ch.type === 'whatsapp' ? <Phone className="h-4 w-4 text-green-600" /> : <Mail className="h-4 w-4 text-[#2F428D]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{ch.label}</p>
                  {ch.sublabel && <p className="text-[11px] text-muted-foreground truncate">{ch.sublabel}</p>}
                </div>
                <div className="flex items-center gap-1.5"><Wifi className="h-3 w-3 text-green-500" /><span className="text-[10px] text-green-600 font-semibold">Conectado</span></div>
              </button>
            ))}
          </div>
        );
      }
      case 'recipient': {
        const opts = field.recipientOptions || [];
        return (
          <div className="space-y-2">
            {opts.map(opt => (
              <button key={opt.type} type="button" onClick={() => setConfig(prev => ({ ...prev, [field.key]: opt.type }))}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${config[field.key] === opt.type ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/20 bg-card'}`}>
                <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center shrink-0">
                  {opt.type === 'all_clients' ? <Users className="h-4 w-4 text-foreground" /> :
                   opt.type === 'tag' ? <Hash className="h-4 w-4 text-foreground" /> :
                   opt.type === 'auto' ? <Zap className="h-4 w-4 text-foreground" /> :
                   <User className="h-4 w-4 text-foreground" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{opt.label}</p>
                  <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                </div>
              </button>
            ))}

            {/* Manual contacts area */}
            {config[field.key] === 'manual' && (
              <div className="mt-3 space-y-3 rounded-xl border border-border p-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">Contatos selecionados ({manualContacts.length})</p>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAddContactOpen(true)}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </div>

                {/* Search existing clients */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Buscar na base de contatos..." value={clientSearchQuery}
                    onChange={(e) => setClientSearchQuery(e.target.value)} className="pl-9 h-9 text-xs" />
                </div>

                {clientSearchResults.length > 0 && (
                  <div className="border border-border rounded-lg bg-card max-h-32 overflow-y-auto">
                    {clientSearchResults.map(c => (
                      <button key={c.id} type="button" onClick={() => addClientAsContact(c)}
                        className="w-full flex items-center gap-2 p-2 hover:bg-accent text-left text-xs border-b border-border last:border-0">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium text-foreground truncate">{c.name}</span>
                        <span className="text-muted-foreground ml-auto">{c.phone || c.email || 'Sem contato'}</span>
                      </button>
                    ))}
                  </div>
                )}

                {manualContacts.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 bg-card rounded-lg p-2 border border-border">
                    <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium text-foreground">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.phone}</span>
                    <button type="button" onClick={() => setManualContacts(prev => prev.filter((_, ii) => ii !== i))} className="ml-auto text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ))}

                {/* Add new contact inline */}
                <AnimatePresence>
                  {addContactOpen && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="border border-primary/20 rounded-lg p-3 bg-primary/5 space-y-2">
                      <p className="text-[11px] font-semibold text-foreground">Novo contato (será adicionado à base)</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Nome" value={newContactName} onChange={(e) => setNewContactName(e.target.value)} className="h-8 text-xs" />
                        <Input placeholder="Telefone" value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs" onClick={addContact}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAddContactOpen(false)}>Cancelar</Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        );
      }
      case 'textarea':
        return (
          <div>
            <Textarea placeholder={field.placeholder} value={config[field.key] || ''} onChange={(e) => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))} className="min-h-[120px] text-sm" />
            {field.helpText && <p className="text-[10px] text-muted-foreground mt-1.5">💡 {field.helpText}</p>}
            {field.aiHelpPrompt && <AIHelpButton prompt={field.aiHelpPrompt} fieldLabel={field.label} />}
          </div>
        );
      case 'toggle':
        return (
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <p className="text-sm text-foreground">{field.label}</p>
              {field.helpText && <p className="text-[10px] text-muted-foreground mt-0.5">{field.helpText}</p>}
            </div>
            <Switch checked={config[field.key] === 'true'} onCheckedChange={(v) => setConfig(prev => ({ ...prev, [field.key]: v ? 'true' : 'false' }))} />
          </div>
        );
      case 'currency':
        return (
          <div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">R$</span>
              <Input type="text" placeholder={field.placeholder} value={config[field.key] || ''} onChange={(e) => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))} className="pl-10" />
            </div>
            {field.helpText && <p className="text-[10px] text-muted-foreground mt-1">💡 {field.helpText}</p>}
          </div>
        );
      case 'select':
        return (
          <select className="w-full rounded-xl border border-input bg-background text-foreground text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring" value={config[field.key] || ''} onChange={(e) => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))}>
            {field.options?.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
        );
      default:
        return (
          <div>
            <Input type={field.type || 'text'} placeholder={field.placeholder} value={config[field.key] || ''} onChange={(e) => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))} />
            {field.helpText && <p className="text-[10px] text-muted-foreground mt-1">💡 {field.helpText}</p>}
            {field.aiHelpPrompt && <AIHelpButton prompt={field.aiHelpPrompt} fieldLabel={field.label} />}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-[#374DA4] flex items-center justify-center shadow-lg shadow-[#374DA4]/10 ring-4 ring-background">
                <LayoutGrid className="h-7 w-7 text-white" />
              </div>
              <div className="pt-1">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                  Apps & Automações
                </h1>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Explore e ative templates prontos para automatizar seu negócio em segundos.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* AI Search Bar */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-10">
          <div className="relative max-w-3xl">
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                ref={searchInputRef}
                placeholder="O que você deseja automatizar hoje? (ex: cobrança, boas-vindas...)"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full h-14 pl-14 pr-28 rounded-2xl border border-border bg-card text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#374DA4]/20 focus:border-[#374DA4] transition-all shadow-sm"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3">
                {aiSearching && <Loader2 className="h-4 w-4 animate-spin text-[#374DA4]" />}
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setAiSuggestions([]); setShowAiSuggestions(false); }}
                    className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground transition-colors"><X className="h-4 w-4" /></button>
                )}
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#374DA4]/10 text-[#374DA4] border border-[#374DA4]/20">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-bold tracking-wide">IA</span>
                </div>
              </div>
            </div>

            {/* AI Suggestions dropdown */}
            <AnimatePresence>
              {showAiSuggestions && aiSuggestions.length > 0 && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 right-0 mt-3 z-50 rounded-2xl border border-border bg-card shadow-2xl p-4">
                  <div className="flex items-center gap-2 mb-3 text-[11px] text-[#374DA4] font-bold uppercase tracking-wider">
                    <Bot className="h-4 w-4" /> Sugestões Inteligentes
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {aiSuggestions.map((s, i) => (
                      <button key={i} onClick={() => { setSearchQuery(s); setShowAiSuggestions(false); }}
                        className="px-4 py-2 rounded-xl text-xs bg-muted hover:bg-[#374DA4]/10 text-foreground transition-all border border-border hover:border-[#374DA4]/30">
                        {s}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Category Pills */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <div className="flex flex-wrap gap-2">
            {CATEGORY_FILTERS.map((cat) => {
              const count = cat.id === 'all' ? FACILITATORS.length : (categoryCounts[cat.id] || 0);
              return (
                <button key={cat.id} onClick={() => { setActiveCategory(cat.id); setSearchQuery(''); setAiSuggestions([]); }}
                  className={`group flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-[13px] font-bold transition-all border ${activeCategory === cat.id
                    ? 'bg-[#374DA4] text-white shadow-lg shadow-[#374DA4]/20 border-[#374DA4]'
                    : 'bg-card text-muted-foreground hover:text-foreground hover:border-[#374DA4]/30 border-border'}`}>
                  <cat.icon className={`h-4 w-4 ${activeCategory === cat.id ? 'text-white' : 'text-muted-foreground group-hover:text-[#374DA4]'}`} />
                  <span>{cat.label}</span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${activeCategory === cat.id ? 'bg-white/20' : 'bg-muted'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Content */}
        {activeCategory === 'all' && !searchQuery ? (
          /* Category Sections View */
          <div className="space-y-14">
            {CATEGORY_FILTERS.filter(c => c.id !== 'all').map((cat) => {
              const items = FACILITATORS.filter(f => f.category === cat.id);
              if (items.length === 0) return null;
              return (
                <motion.section key={cat.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm">
                        <cat.icon className="h-5 w-5 text-[#374DA4]" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                          {cat.label}
                          <span className="text-sm font-medium text-muted-foreground">({items.length})</span>
                        </h2>
                        <p className="text-xs text-muted-foreground">{cat.description}</p>
                      </div>
                    </div>
                    <button onClick={() => setActiveCategory(cat.id)}
                      className="flex items-center gap-1.5 text-sm text-[#374DA4] hover:text-[#2F428D] font-bold transition-colors">
                      VER TUDO <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {items.slice(0, 4).map((f, i) => (
                      <FacilitatorCard key={f.id} f={f} index={i} onClick={() => openDialog(f)} />
                    ))}
                  </div>
                </motion.section>
              );
            })}
          </div>
        ) : (
          /* Filtered Grid View */
          <div>
            {searchQuery && (
              <div className="mb-4 flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "<span className="font-medium text-foreground">{searchQuery}</span>"
                </span>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((f, i) => (
                <FacilitatorCard key={f.id} f={f} index={i} onClick={() => openDialog(f)} />
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Search className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-base font-medium text-foreground mb-1">Nenhum app encontrado</p>
            <p className="text-sm text-muted-foreground mb-4">Tente buscar de outra forma ou explore as categorias</p>
            <Button variant="outline" onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}>
              Ver todos os apps
            </Button>
          </motion.div>
        )}
      </div>

      {/* ─── Wide Two-Column Dialog ─── */}
      <Dialog open={!!selectedFacilitator} onOpenChange={(open) => { if (!open) setSelectedFacilitator(null); }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] p-0 overflow-hidden gap-0">
          {selectedFacilitator && (
            <div className="flex flex-col h-full max-h-[90vh]">
              {/* Dialog Header */}
              <div className="px-8 pt-7 pb-6 border-b border-border bg-card">
                <div className="flex items-start gap-5">
                  <div className="h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ring-1 ring-border" style={{ backgroundColor: `${selectedFacilitator.iconColor}15` }}>
                    <selectedFacilitator.icon className="h-8 w-8" style={{ color: selectedFacilitator.iconColor }} />
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <h2 className="text-2xl font-bold text-foreground">{selectedFacilitator.title}</h2>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{selectedFacilitator.longDescription}</p>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mt-8">
                  <button onClick={() => setDialogTab('config')}
                    className={`px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all ${dialogTab === 'config' ? 'bg-[#374DA4] text-white shadow-md shadow-[#374DA4]/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                    <ClipboardList className="h-4 w-4 inline mr-2" />CONFIGURAÇÃO
                  </button>
                  <button onClick={() => setDialogTab('preview')}
                    className={`px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all ${dialogTab === 'preview' ? 'bg-[#374DA4] text-white shadow-md shadow-[#374DA4]/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                    <Eye className="h-4 w-4 inline mr-2" />PRÉ-VISUALIZAÇÃO
                  </button>
                </div>
              </div>

              {/* Dialog Body */}
              <ScrollArea className="flex-1 overflow-y-auto bg-muted">
                <div className="p-8">
                  {dialogTab === 'config' ? (
                    <div className="space-y-8">
                      {/* How it works */}
                      <div className="rounded-2xl bg-card border border-border p-6 shadow-sm">
                        <div className="flex items-center gap-2.5 mb-5">
                          <div className="h-8 w-8 rounded-lg bg-[#374DA4]/10 flex items-center justify-center">
                            <Info className="h-4 w-4 text-[#374DA4]" />
                          </div>
                          <h4 className="text-[11px] font-bold text-foreground uppercase tracking-widest">Fluxo de Funcionamento</h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {selectedFacilitator.howItWorks.map((step, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted transition-colors">
                              <div className="h-6 w-6 rounded-lg bg-[#374DA4] flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-[#374DA4]/20">
                                <span className="text-[10px] font-black text-white">{i + 1}</span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-normal">{step}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Config sections */}
                      {selectedFacilitator.configSections.map((section, si) => (
                        <div key={si}>
                          {si > 0 && <Separator className="mb-5" />}
                          <div className="flex items-center gap-2 mb-4">
                            {section.icon && <section.icon className="h-4 w-4 text-primary" />}
                            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">{section.title}</h4>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {section.fields.map((field) => (
                              <div key={field.key} className={`space-y-1.5 ${field.span === 'half' ? '' : field.type === 'channel' || field.type === 'recipient' || field.type === 'textarea' || field.type === 'toggle' ? 'sm:col-span-2' : ''}`}>
                                {field.type !== 'toggle' && field.type !== 'channel' && field.type !== 'recipient' && (
                                  <div className="flex items-center gap-1.5">
                                    <Label className="text-xs text-muted-foreground">{field.label}</Label>
                                    {field.aiHelpPrompt && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <HelpCircle className="h-3 w-3 text-muted-foreground/50 cursor-help" />
                                          </TooltipTrigger>
                                          <TooltipContent className="max-w-xs text-xs">{field.aiHelpPrompt}</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                )}
                                {renderField(field)}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Preview Tab */
                    <div className="space-y-6">
                      <div className="rounded-xl bg-muted/50 border border-border p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <Eye className="h-4 w-4 text-primary" />
                          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Pré-visualização da mensagem</h4>
                        </div>

                        {/* Phone mockup */}
                        <div className="mx-auto max-w-sm">
                          <div className="rounded-2xl border-2 border-border bg-card overflow-hidden shadow-lg">
                            <div className="bg-primary px-4 py-3 flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                                {config.channel && connectedChannels.find(c => c.id === config.channel)?.type === 'email' ?
                                  <Mail className="h-4 w-4 text-primary-foreground" /> :
                                  <Phone className="h-4 w-4 text-primary-foreground" />}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-primary-foreground">Maria Silva</p>
                                <p className="text-[10px] text-primary-foreground/70">Exemplo de envio</p>
                              </div>
                            </div>
                            <div className="p-4 min-h-[200px] bg-background">
                              <div className="bg-accent rounded-2xl rounded-tl-sm p-3 max-w-[85%]">
                                <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{getMessagePreview()}</p>
                                <p className="text-[9px] text-muted-foreground text-right mt-2">09:00 ✓✓</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="rounded-xl bg-accent/50 border border-border p-5 space-y-3">
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">📋 Resumo da automação</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg bg-card border border-border p-3">
                            <p className="text-[10px] text-muted-foreground mb-0.5">Canal</p>
                            <p className="text-sm font-medium text-foreground">{connectedChannels.find(c => c.id === config.channel)?.label || 'Não selecionado'}</p>
                          </div>
                          <div className="rounded-lg bg-card border border-border p-3">
                            <p className="text-[10px] text-muted-foreground mb-0.5">Público</p>
                            <p className="text-sm font-medium text-foreground">
                              {config.recipient === 'all_clients' ? 'Todos os clientes' :
                               config.recipient === 'tag' ? `Tag: ${config.recipient_tag || '—'}` :
                               config.recipient === 'manual' ? `${manualContacts.length} contato(s)` :
                               config.recipient === 'auto' ? 'Automático' : 'Não definido'}
                            </p>
                          </div>
                          {config.invoice_amount && (
                            <div className="rounded-lg bg-card border border-border p-3">
                              <p className="text-[10px] text-muted-foreground mb-0.5">Valor</p>
                              <p className="text-sm font-medium text-foreground">R$ {config.invoice_amount}</p>
                            </div>
                          )}
                          {config.days_before && (
                            <div className="rounded-lg bg-card border border-border p-3">
                              <p className="text-[10px] text-muted-foreground mb-0.5">Dias antes</p>
                              <p className="text-sm font-medium text-foreground">{config.days_before} dia(s)</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Footer */}
              <div className="px-8 py-5 border-t border-border bg-card flex items-center justify-between gap-4">
                <Button variant="ghost" onClick={() => setSelectedFacilitator(null)} className="text-muted-foreground font-bold text-xs uppercase tracking-wider">Cancelar</Button>
                <div className="flex items-center gap-3">
                  {dialogTab === 'config' && (
                    <Button variant="outline" onClick={() => setDialogTab('preview')} className="rounded-xl border-border text-[13px] font-bold h-11 px-6">
                      <Eye className="h-4 w-4 mr-2" /> PRÉ-VISUALIZAR
                    </Button>
                  )}
                  <Button onClick={activateFacilitator} disabled={isActivating} className="bg-[#374DA4] hover:bg-[#2F428D] text-white rounded-xl text-[13px] font-bold h-11 px-8 shadow-lg shadow-[#374DA4]/20 transition-all active:scale-95">
                    {isActivating ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> ATIVANDO...</>) : (<><Zap className="h-4 w-4 mr-2" /> ATIVAR FACILITADOR</>)}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppsPage;
