// Ellosuit WhatsApp Agent - AI agent with tool calling for ALL platform operations
import { createClient } from "npm:@supabase/supabase-js@2";
import { chatCompletion, mapModel } from '../_shared/llm.ts';

async function logUsage(params: { service_type: string; action: string; model?: string; input_tokens?: number; output_tokens?: number; total_cost: number; user_id?: string; company_id?: string; metadata?: Record<string, any> }) {
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await sb.from('api_usage_logs').insert({
      service_type: params.service_type, action: params.action, model: params.model || null,
      input_tokens: params.input_tokens || 0, output_tokens: params.output_tokens || 0,
      total_cost: params.total_cost, unit_cost: params.total_cost,
      user_id: params.user_id || null, company_id: params.company_id || null,
      metadata: params.metadata || {},
    });
  } catch (e) { console.error('logUsage error:', e); }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============== TOOL DEFINITIONS ==============
const TOOLS = [
  // === TAREFAS / LEMBRETES ===
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "Listar tarefas/lembretes do usuário na plataforma Ellosuit",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "in_progress", "completed", "all"], description: "Filtrar por status (padrão: all)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Criar uma nova tarefa/lembrete na plataforma Ellosuit",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título da tarefa" },
          description: { type: "string", description: "Descrição da tarefa (opcional)" },
          due_date: { type: "string", description: "Data de vencimento no formato YYYY-MM-DD (opcional)" }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Atualizar uma tarefa existente (título, descrição, status ou data)",
      parameters: {
        type: "object",
        properties: {
          task_title: { type: "string", description: "Título da tarefa a ser atualizada (busca parcial)" },
          new_title: { type: "string", description: "Novo título (opcional)" },
          new_status: { type: "string", enum: ["pending", "completed", "cancelled"], description: "Novo status (opcional)" },
          new_description: { type: "string", description: "Nova descrição (opcional)" }
        },
        required: ["task_title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "Excluir uma tarefa/lembrete",
      parameters: {
        type: "object",
        properties: {
          task_title: { type: "string", description: "Título da tarefa a excluir (busca parcial)" }
        },
        required: ["task_title"]
      }
    }
  },

  // === AGENDA / CALENDÁRIO ===
  {
    type: "function",
    function: {
      name: "list_calendar_events",
      description: "Listar eventos/compromissos da agenda do usuário",
      parameters: {
        type: "object",
        properties: {
          days_ahead: { type: "number", description: "Quantos dias à frente buscar (padrão: 7)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description: "Criar um novo evento/compromisso na agenda",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título do evento" },
          start_date: { type: "string", description: "Data/hora início no formato YYYY-MM-DDTHH:mm:ss" },
          end_date: { type: "string", description: "Data/hora fim no formato YYYY-MM-DDTHH:mm:ss" },
          description: { type: "string", description: "Descrição do evento (opcional)" }
        },
        required: ["title", "start_date", "end_date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_calendar_event",
      description: "Excluir um evento da agenda",
      parameters: {
        type: "object",
        properties: {
          event_title: { type: "string", description: "Título do evento a excluir (busca parcial)" }
        },
        required: ["event_title"]
      }
    }
  },

  // === CRM / CONTATOS ===
  {
    type: "function",
    function: {
      name: "list_contacts",
      description: "Listar contatos/clientes do CRM",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Buscar por nome, email ou telefone (opcional)" },
          limit: { type: "number", description: "Quantidade de resultados (padrão: 10)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_contact",
      description: "Criar um novo contato/cliente no CRM",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome do contato" },
          email: { type: "string", description: "Email (opcional)" },
          phone: { type: "string", description: "Telefone (opcional)" },
          company_name: { type: "string", description: "Empresa do contato (opcional)" },
          notes: { type: "string", description: "Observações (opcional)" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_contact",
      description: "Atualizar dados de um contato existente",
      parameters: {
        type: "object",
        properties: {
          contact_name: { type: "string", description: "Nome do contato a atualizar (busca parcial)" },
          new_name: { type: "string", description: "Novo nome (opcional)" },
          new_email: { type: "string", description: "Novo email (opcional)" },
          new_phone: { type: "string", description: "Novo telefone (opcional)" },
          new_notes: { type: "string", description: "Novas observações (opcional)" },
          new_status: { type: "string", enum: ["active", "inactive", "lead"], description: "Novo status (opcional)" }
        },
        required: ["contact_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_contact",
      description: "Excluir um contato do CRM",
      parameters: {
        type: "object",
        properties: {
          contact_name: { type: "string", description: "Nome do contato a excluir (busca parcial)" }
        },
        required: ["contact_name"]
      }
    }
  },

  // === DRIVE / DOCUMENTOS ===
  {
    type: "function",
    function: {
      name: "list_documents",
      description: "Listar arquivos no Drive",
      parameters: {
        type: "object",
        properties: {
          folder_name: { type: "string", description: "Nome da pasta para filtrar (opcional)" },
          limit: { type: "number", description: "Quantidade (padrão: 10)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "upload_to_drive",
      description: "Salvar um arquivo enviado pelo usuário no Drive da Ellosuit. Use quando o usuário enviar um arquivo e pedir para salvar.",
      parameters: {
        type: "object",
        properties: {
          folder_name: { type: "string", description: "Nome da pasta onde salvar (opcional, padrão: pasta principal)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_folder",
      description: "Criar uma nova pasta no Drive",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome da pasta" },
          description: { type: "string", description: "Descrição da pasta (opcional)" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_folders",
      description: "Listar pastas do Drive",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_document",
      description: "Excluir um documento do Drive",
      parameters: {
        type: "object",
        properties: {
          document_name: { type: "string", description: "Nome do documento a excluir (busca parcial)" }
        },
        required: ["document_name"]
      }
    }
  },

  // === ASSINATURA / PLANO ===
  {
    type: "function",
    function: {
      name: "check_subscription",
      description: "Verificar status da assinatura, plano e módulos ativos",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },

  // === PROPOSTAS ===
  {
    type: "function",
    function: {
      name: "list_proposals",
      description: "Listar propostas comerciais da empresa",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["draft", "sent", "approved", "rejected", "all"], description: "Filtrar por status (padrão: all)" },
          limit: { type: "number", description: "Quantidade (padrão: 10)" }
        },
        required: []
      }
    }
  },

  // === CONTRATOS ===
  {
    type: "function",
    function: {
      name: "list_contracts",
      description: "Listar contratos gerados",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["draft", "signed", "cancelled", "all"], description: "Filtrar por status (padrão: all)" },
          limit: { type: "number", description: "Quantidade (padrão: 10)" }
        },
        required: []
      }
    }
  },

  // === RECIBOS ===
  {
    type: "function",
    function: {
      name: "list_receipts",
      description: "Listar recibos emitidos",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Quantidade (padrão: 10)" }
        },
        required: []
      }
    }
  },

  // === SERVIÇOS ===
  {
    type: "function",
    function: {
      name: "list_services",
      description: "Listar serviços/produtos cadastrados na empresa",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Buscar por nome (opcional)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_service",
      description: "Cadastrar um novo serviço/produto",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome do serviço" },
          unit_price: { type: "number", description: "Preço unitário em reais" },
          description: { type: "string", description: "Descrição (opcional)" },
          category: { type: "string", description: "Categoria (opcional)" }
        },
        required: ["name", "unit_price"]
      }
    }
  },

  // === EMAIL MARKETING ===
  {
    type: "function",
    function: {
      name: "list_email_templates",
      description: "Listar templates de email disponíveis",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "list_email_campaigns",
      description: "Listar campanhas de email marketing",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["draft", "active", "paused", "completed", "all"], description: "Filtrar por status (padrão: all)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_sent_emails",
      description: "Listar emails enviados recentes com estatísticas de abertura",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Quantidade (padrão: 10)" }
        },
        required: []
      }
    }
  },

  // === AUTOMAÇÕES ===
  {
    type: "function",
    function: {
      name: "list_automations",
      description: "Listar automações configuradas",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "toggle_automation",
      description: "Ativar ou desativar uma automação",
      parameters: {
        type: "object",
        properties: {
          automation_name: { type: "string", description: "Nome da automação (busca parcial)" },
          active: { type: "boolean", description: "true para ativar, false para desativar" }
        },
        required: ["automation_name", "active"]
      }
    }
  },

  // === CHATBOTS ===
  {
    type: "function",
    function: {
      name: "list_chatbots",
      description: "Listar fluxos de chatbot configurados",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "toggle_chatbot",
      description: "Ativar ou desativar um chatbot",
      parameters: {
        type: "object",
        properties: {
          chatbot_name: { type: "string", description: "Nome do chatbot (busca parcial)" },
          active: { type: "boolean", description: "true para ativar, false para desativar" }
        },
        required: ["chatbot_name", "active"]
      }
    }
  },

  // === CRIAR AUTOMAÇÃO ===
  {
    type: "function",
    function: {
      name: "create_automation",
      description: "Criar uma nova automação no sistema. O usuário descreve o que quer automatizar e a IA monta os nodes e edges.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome da automação" },
          description: { type: "string", description: "Descrição do que a automação faz" },
          trigger_type: { type: "string", enum: ["new_client", "new_event", "form_submit", "tag_added", "manual"], description: "Tipo de gatilho" },
          actions: {
            type: "array",
            description: "Lista de ações a executar",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["send_email", "send_whatsapp", "create_task", "add_tag", "wait", "notify"], description: "Tipo da ação" },
                config: { type: "object", description: "Configurações da ação" }
              }
            }
          }
        },
        required: ["name", "trigger_type"]
      }
    }
  },

  // === CRIAR CHATBOT ===
  {
    type: "function",
    function: {
      name: "create_chatbot",
      description: "Criar um novo fluxo de chatbot para WhatsApp. O usuário descreve o fluxo e a IA monta os blocos.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome do chatbot" },
          description: { type: "string", description: "Descrição do fluxo" },
          trigger: { type: "string", enum: ["whatsapp_channel", "keyword", "conversation_start"], description: "Tipo de gatilho" },
          steps: {
            type: "array",
            description: "Passos do fluxo do chatbot",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["message", "buttons", "wait_response", "condition", "transfer_human", "transfer_ai_agent", "set_variable"], description: "Tipo do bloco" },
                content: { type: "string", description: "Texto da mensagem ou condição" },
                options: { type: "array", items: { type: "string" }, description: "Opções para botões" }
              }
            }
          }
        },
        required: ["name", "trigger"]
      }
    }
  },

  // === CRIAR AGENTE DE IA ===
  {
    type: "function",
    function: {
      name: "create_ai_agent",
      description: "Criar um novo agente de IA. O usuário descreve o perfil, personalidade e instruções do agente.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome do agente" },
          description: { type: "string", description: "Descrição breve do agente" },
          personality: { type: "string", description: "Personalidade do agente (ex: profissional, amigável, técnico)" },
          instructions: { type: "string", description: "Instruções detalhadas de como o agente deve se comportar" },
          model: { type: "string", enum: ["google/gemini-3-flash-preview", "google/gemini-2.5-flash", "google/gemini-2.5-pro"], description: "Modelo de IA" }
        },
        required: ["name", "personality", "instructions"]
      }
    }
  },

  // === AGENTES DE IA ===
  {
    type: "function",
    function: {
      name: "list_ai_agents",
      description: "Listar agentes de IA configurados",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },

  // === AGENDA ABERTA / BOOKING ===
  {
    type: "function",
    function: {
      name: "list_booking_links",
      description: "Listar links de agendamento online",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },

  // === WHATSAPP / CONVERSAS ===
  {
    type: "function",
    function: {
      name: "list_whatsapp_conversations",
      description: "Listar conversas recentes do WhatsApp",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Quantidade (padrão: 10)" },
          unread_only: { type: "boolean", description: "Apenas não lidas (padrão: false)" }
        },
        required: []
      }
    }
  },

  // === GRUPOS DE CONTATOS ===
  {
    type: "function",
    function: {
      name: "list_contact_groups",
      description: "Listar grupos de contatos",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },

  // === GERAL ===
  {
    type: "function",
    function: {
      name: "get_dashboard_summary",
      description: "Obter um resumo geral do dashboard: total de contatos, eventos hoje, documentos, propostas pendentes, etc.",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "general_info",
      description: "Responder perguntas gerais sobre a plataforma Ellosuit ou sobre a conta do usuário",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "Pergunta do usuário" }
        },
        required: ["question"]
      }
    }
  }
];

// ============== TOOL EXECUTION ==============
type ToolContext = {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  companyId: string;
  lastMedia?: { url: string; fileName?: string; type?: string; mimeType?: string };
};

async function executeTool(toolName: string, args: Record<string, unknown>, context: ToolContext): Promise<string> {
  const { supabase, userId, companyId } = context;

  switch (toolName) {

    // ==================== TAREFAS ====================
    case 'list_tasks': {
      let query = supabase
        .from('calendar_events')
        .select('id, title, description, status, start_date, event_type')
        .eq('company_id', companyId)
        .eq('event_type', 'reminder')
        .order('start_date', { ascending: false })
        .limit(15);
      const status = args.status as string;
      if (status && status !== 'all') query = query.eq('status', status);
      const { data, error } = await query;
      if (error) return `Erro ao buscar tarefas: ${error.message}`;
      if (!data?.length) return 'Nenhuma tarefa encontrada.';
      return `Tarefas (${data.length}):\n` + data.map((t: any, i: number) =>
        `${i + 1}. "${t.title}" - Status: ${t.status || 'pending'}${t.start_date ? `, Data: ${new Date(t.start_date).toLocaleDateString('pt-BR')}` : ''}`
      ).join('\n');
    }

    case 'create_task': {
      const dueDate = (args.due_date as string) || new Date().toISOString().split('T')[0];
      const { data, error } = await supabase.from('calendar_events').insert({
        title: args.title as string, description: (args.description as string) || null,
        start_date: `${dueDate}T08:00:00`, end_date: `${dueDate}T08:30:00`,
        event_type: 'reminder', status: 'pending', source: 'whatsapp',
        company_id: companyId, created_by: userId,
      }).select('id, title').single();
      if (error) return `Erro ao criar tarefa: ${error.message}`;
      return `Tarefa "${data.title}" criada para ${dueDate}!`;
    }

    case 'update_task': {
      const { data: tasks } = await supabase.from('calendar_events')
        .select('id, title').eq('company_id', companyId).eq('event_type', 'reminder')
        .ilike('title', `%${args.task_title}%`).limit(1).single();
      if (!tasks) return `Tarefa "${args.task_title}" não encontrada.`;
      const updates: any = {};
      if (args.new_title) updates.title = args.new_title;
      if (args.new_status) updates.status = args.new_status;
      if (args.new_description) updates.description = args.new_description;
      const { error } = await supabase.from('calendar_events').update(updates).eq('id', tasks.id);
      if (error) return `Erro ao atualizar: ${error.message}`;
      return `Tarefa "${tasks.title}" atualizada com sucesso!`;
    }

    case 'delete_task': {
      const { data: task } = await supabase.from('calendar_events')
        .select('id, title').eq('company_id', companyId).eq('event_type', 'reminder')
        .ilike('title', `%${args.task_title}%`).limit(1).single();
      if (!task) return `Tarefa "${args.task_title}" não encontrada.`;
      const { error } = await supabase.from('calendar_events').delete().eq('id', task.id);
      if (error) return `Erro ao excluir: ${error.message}`;
      return `Tarefa "${task.title}" excluída!`;
    }

    // ==================== AGENDA ====================
    case 'list_calendar_events': {
      const daysAhead = (args.days_ahead as number) || 7;
      const now = new Date();
      const end = new Date(now.getTime() + daysAhead * 86400000);
      const { data, error } = await supabase.from('calendar_events')
        .select('id, title, start_date, end_date, description, event_type')
        .eq('company_id', companyId)
        .gte('start_date', now.toISOString()).lte('start_date', end.toISOString())
        .order('start_date', { ascending: true }).limit(15);
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return `Nenhum evento nos próximos ${daysAhead} dias.`;
      return `Eventos (${data.length}):\n` + data.map((e: any, i: number) => {
        const s = new Date(e.start_date);
        return `${i + 1}. "${e.title}" - ${s.toLocaleDateString('pt-BR')} às ${s.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} (${e.event_type})`;
      }).join('\n');
    }

    case 'create_calendar_event': {
      const { data, error } = await supabase.from('calendar_events').insert({
        title: args.title as string, start_date: args.start_date as string,
        end_date: args.end_date as string, description: (args.description as string) || null,
        event_type: 'reminder', status: 'pending', source: 'whatsapp',
        company_id: companyId, created_by: userId,
      }).select('id, title').single();
      if (error) return `Erro ao criar evento: ${error.message}`;
      return `Evento "${data.title}" criado na agenda!`;
    }

    case 'delete_calendar_event': {
      const { data: ev } = await supabase.from('calendar_events')
        .select('id, title').eq('company_id', companyId)
        .ilike('title', `%${args.event_title}%`).limit(1).single();
      if (!ev) return `Evento "${args.event_title}" não encontrado.`;
      const { error } = await supabase.from('calendar_events').delete().eq('id', ev.id);
      if (error) return `Erro: ${error.message}`;
      return `Evento "${ev.title}" excluído!`;
    }

    // ==================== CRM / CONTATOS ====================
    case 'list_contacts': {
      let query = supabase.from('clients')
        .select('id, name, email, phone, company_name, status')
        .eq('company_id', companyId).order('created_at', { ascending: false })
        .limit((args.limit as number) || 10);
      if (args.search) query = query.or(`name.ilike.%${args.search}%,email.ilike.%${args.search}%,phone.ilike.%${args.search}%`);
      const { data, error } = await query;
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhum contato encontrado.';
      return `Contatos (${data.length}):\n` + data.map((c: any, i: number) =>
        `${i + 1}. ${c.name}${c.email ? ` - ${c.email}` : ''}${c.phone ? ` - ${c.phone}` : ''}${c.company_name ? ` (${c.company_name})` : ''}`
      ).join('\n');
    }

    case 'create_contact': {
      const { data, error } = await supabase.from('clients').insert({
        name: args.name as string, email: (args.email as string) || null,
        phone: (args.phone as string) || null, company_name: (args.company_name as string) || null,
        notes: (args.notes as string) || null, company_id: companyId, created_by: userId,
      }).select('id, name').single();
      if (error) return `Erro ao criar contato: ${error.message}`;
      return `Contato "${data.name}" criado com sucesso!`;
    }

    case 'update_contact': {
      const { data: contact } = await supabase.from('clients')
        .select('id, name').eq('company_id', companyId)
        .ilike('name', `%${args.contact_name}%`).limit(1).single();
      if (!contact) return `Contato "${args.contact_name}" não encontrado.`;
      const updates: any = {};
      if (args.new_name) updates.name = args.new_name;
      if (args.new_email) updates.email = args.new_email;
      if (args.new_phone) updates.phone = args.new_phone;
      if (args.new_notes) updates.notes = args.new_notes;
      if (args.new_status) updates.status = args.new_status;
      const { error } = await supabase.from('clients').update(updates).eq('id', contact.id);
      if (error) return `Erro: ${error.message}`;
      return `Contato "${contact.name}" atualizado!`;
    }

    case 'delete_contact': {
      const { data: contact } = await supabase.from('clients')
        .select('id, name').eq('company_id', companyId)
        .ilike('name', `%${args.contact_name}%`).limit(1).single();
      if (!contact) return `Contato "${args.contact_name}" não encontrado.`;
      const { error } = await supabase.from('clients').delete().eq('id', contact.id);
      if (error) return `Erro: ${error.message}`;
      return `Contato "${contact.name}" excluído!`;
    }

    // ==================== DRIVE ====================
    case 'list_documents': {
      let query = supabase.from('documents')
        .select('id, name, file_type, file_size, created_at, folder_id')
        .eq('company_id', companyId).order('created_at', { ascending: false })
        .limit((args.limit as number) || 10);
      if (args.folder_name) {
        const { data: folder } = await supabase.from('document_folders').select('id')
          .eq('company_id', companyId).ilike('name', args.folder_name as string).maybeSingle();
        if (folder) query = query.eq('folder_id', folder.id);
      }
      const { data, error } = await query;
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhum documento encontrado.';
      return `Documentos (${data.length}):\n` + data.map((d: any, i: number) =>
        `${i + 1}. ${d.name} (${d.file_type}) - ${new Date(d.created_at).toLocaleDateString('pt-BR')}`
      ).join('\n');
    }

    case 'upload_to_drive': {
      const mediaInfo = context.lastMedia;
      if (!mediaInfo?.url) return 'Nenhum arquivo recebido. Peça ao usuário para enviar o arquivo primeiro.';
      try {
        const mediaResp = await fetch(mediaInfo.url);
        if (!mediaResp.ok) return `Erro ao baixar: HTTP ${mediaResp.status}`;
        const fileBytes = new Uint8Array(await mediaResp.arrayBuffer());
        const fileName = mediaInfo.fileName || `whatsapp-${Date.now()}.bin`;
        const storagePath = `${companyId}/${Date.now()}-${fileName}`;
        const mimeType = mediaInfo.mimeType || 'application/octet-stream';
        const { error: upErr } = await supabase.storage.from('documents')
          .upload(storagePath, fileBytes, { contentType: mimeType, upsert: false });
        if (upErr) return `Erro no upload: ${upErr.message}`;
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(storagePath);
        let folderId: string | null = null;
        if (args.folder_name) {
          const { data: f } = await supabase.from('document_folders').select('id')
            .eq('company_id', companyId).ilike('name', args.folder_name as string).maybeSingle();
          if (f) folderId = f.id;
        }
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        const typeMap: Record<string, string> = { pdf:'pdf', doc:'word', docx:'word', xls:'excel', xlsx:'excel', png:'image', jpg:'image', jpeg:'image', gif:'image', webp:'image', mp4:'video', mp3:'audio' };
        const { data: docData, error: docErr } = await supabase.from('documents').insert({
          name: fileName, file_type: typeMap[ext] || 'other', file_url: urlData.publicUrl,
          file_size: fileBytes.length, company_id: companyId, created_by: userId, folder_id: folderId,
        }).select('id').single();
        if (docErr) return `Upload OK mas erro ao registrar: ${docErr.message}`;
        await supabase.from('document_files').insert({
          document_id: docData.id, file_path: storagePath, file_size: fileBytes.length,
          mime_type: mimeType, original_filename: fileName,
        });
        return `Arquivo "${fileName}" salvo no Drive${folderId ? ` na pasta "${args.folder_name}"` : ''}!`;
      } catch (err) {
        return `Erro: ${err instanceof Error ? err.message : 'erro desconhecido'}`;
      }
    }

    case 'create_folder': {
      const { data, error } = await supabase.from('document_folders').insert({
        name: args.name as string, description: (args.description as string) || null,
        company_id: companyId, created_by: userId,
      }).select('id, name').single();
      if (error) return `Erro ao criar pasta: ${error.message}`;
      return `Pasta "${data.name}" criada!`;
    }

    case 'list_folders': {
      const { data, error } = await supabase.from('document_folders')
        .select('id, name, description').eq('company_id', companyId)
        .order('name', { ascending: true });
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhuma pasta encontrada.';
      return `Pastas (${data.length}):\n` + data.map((f: any, i: number) =>
        `${i + 1}. ${f.name}${f.description ? ` - ${f.description}` : ''}`
      ).join('\n');
    }

    case 'delete_document': {
      const { data: doc } = await supabase.from('documents')
        .select('id, name').eq('company_id', companyId)
        .ilike('name', `%${args.document_name}%`).limit(1).single();
      if (!doc) return `Documento "${args.document_name}" não encontrado.`;
      const { error } = await supabase.from('documents').delete().eq('id', doc.id);
      if (error) return `Erro: ${error.message}`;
      return `Documento "${doc.name}" excluído!`;
    }

    // ==================== ASSINATURA ====================
    case 'check_subscription': {
      const { data: sub } = await supabase.from('subscriptions')
        .select('plan_type, status, monthly_price, trial_ends_at, current_period_end')
        .eq('company_id', companyId).single();
      if (!sub) return 'Assinatura não encontrada.';
      const { data: modules } = await supabase.from('subscription_modules')
        .select('module_type, is_active').eq('company_id', companyId);
      const active = (modules || []).filter((m: any) => m.is_active).map((m: any) => m.module_type);
      return [
        `Plano: ${sub.plan_type}`, `Status: ${sub.status}`, `Valor: R$${sub.monthly_price}/mês`,
        sub.trial_ends_at ? `Trial até: ${new Date(sub.trial_ends_at).toLocaleDateString('pt-BR')}` : '',
        sub.current_period_end ? `Renovação: ${new Date(sub.current_period_end).toLocaleDateString('pt-BR')}` : '',
        active.length ? `Módulos: ${active.join(', ')}` : 'Sem módulos extras',
      ].filter(Boolean).join('\n');
    }

    // ==================== PROPOSTAS ====================
    case 'list_proposals': {
      let query = supabase.from('proposals')
        .select('id, proposal_number, title, status, total_value, created_at')
        .eq('company_id', companyId).order('created_at', { ascending: false })
        .limit((args.limit as number) || 10);
      if (args.status && args.status !== 'all') query = query.eq('status', args.status as string);
      const { data, error } = await query;
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhuma proposta encontrada.';
      return `Propostas (${data.length}):\n` + data.map((p: any, i: number) =>
        `${i + 1}. ${p.proposal_number} - "${p.title}" - R$${p.total_value || 0} - ${p.status}`
      ).join('\n');
    }

    // ==================== CONTRATOS ====================
    case 'list_contracts': {
      let query = supabase.from('generated_contracts')
        .select('id, title, status, created_at')
        .eq('company_id', companyId).order('created_at', { ascending: false })
        .limit((args.limit as number) || 10);
      if (args.status && args.status !== 'all') query = query.eq('status', args.status as string);
      const { data, error } = await query;
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhum contrato encontrado.';
      return `Contratos (${data.length}):\n` + data.map((c: any, i: number) =>
        `${i + 1}. "${c.title}" - ${c.status} - ${new Date(c.created_at).toLocaleDateString('pt-BR')}`
      ).join('\n');
    }

    // ==================== RECIBOS ====================
    case 'list_receipts': {
      const { data, error } = await supabase.from('receipts')
        .select('id, receipt_number, description, amount, status, created_at')
        .eq('company_id', companyId).order('created_at', { ascending: false })
        .limit((args.limit as number) || 10);
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhum recibo encontrado.';
      return `Recibos (${data.length}):\n` + data.map((r: any, i: number) =>
        `${i + 1}. ${r.receipt_number} - "${r.description}" - R$${r.amount} - ${r.status}`
      ).join('\n');
    }

    // ==================== SERVIÇOS ====================
    case 'list_services': {
      let query = supabase.from('company_services')
        .select('id, name, unit_price, category, description, is_active')
        .eq('company_id', companyId).order('name', { ascending: true });
      if (args.search) query = query.ilike('name', `%${args.search}%`);
      const { data, error } = await query;
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhum serviço cadastrado.';
      return `Serviços (${data.length}):\n` + data.map((s: any, i: number) =>
        `${i + 1}. ${s.name} - R$${s.unit_price}${s.category ? ` (${s.category})` : ''} - ${s.is_active ? 'Ativo' : 'Inativo'}`
      ).join('\n');
    }

    case 'create_service': {
      const { data, error } = await supabase.from('company_services').insert({
        name: args.name as string, unit_price: args.unit_price as number,
        description: (args.description as string) || null, category: (args.category as string) || null,
        company_id: companyId, created_by: userId,
      }).select('id, name').single();
      if (error) return `Erro: ${error.message}`;
      return `Serviço "${data.name}" cadastrado com sucesso!`;
    }

    // ==================== EMAIL ====================
    case 'list_email_templates': {
      const { data, error } = await supabase.from('email_templates')
        .select('id, name, category, is_active')
        .eq('company_id', companyId).eq('is_active', true).order('name');
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhum template de email encontrado.';
      return `Templates (${data.length}):\n` + data.map((t: any, i: number) =>
        `${i + 1}. "${t.name}" - Categoria: ${t.category}`
      ).join('\n');
    }

    case 'list_email_campaigns': {
      let query = supabase.from('email_campaigns')
        .select('id, name, status, created_at')
        .eq('company_id', companyId).order('created_at', { ascending: false }).limit(10);
      if (args.status && args.status !== 'all') query = query.eq('status', args.status as string);
      const { data, error } = await query;
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhuma campanha encontrada.';
      return `Campanhas (${data.length}):\n` + data.map((c: any, i: number) =>
        `${i + 1}. "${c.name}" - ${c.status} - ${new Date(c.created_at).toLocaleDateString('pt-BR')}`
      ).join('\n');
    }

    case 'list_sent_emails': {
      const { data, error } = await supabase.from('emails')
        .select('id, subject, recipient_email, status, open_count, sent_at')
        .eq('company_id', companyId).order('sent_at', { ascending: false })
        .limit((args.limit as number) || 10);
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhum email enviado.';
      return `Emails enviados (${data.length}):\n` + data.map((e: any, i: number) =>
        `${i + 1}. "${e.subject}" → ${e.recipient_email} - ${e.status}${e.open_count ? ` (${e.open_count}x aberto)` : ''}`
      ).join('\n');
    }

    // ==================== AUTOMAÇÕES ====================
    case 'list_automations': {
      const { data, error } = await supabase.from('automations')
        .select('id, name, is_active, trigger_type, execution_count, last_executed_at')
        .eq('company_id', companyId).order('name');
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhuma automação configurada.';
      return `Automações (${data.length}):\n` + data.map((a: any, i: number) =>
        `${i + 1}. "${a.name}" - ${a.is_active ? 'Ativa' : 'Inativa'} - Gatilho: ${a.trigger_type} - Execuções: ${a.execution_count || 0}`
      ).join('\n');
    }

    case 'toggle_automation': {
      const { data: auto } = await supabase.from('automations')
        .select('id, name').eq('company_id', companyId)
        .ilike('name', `%${args.automation_name}%`).limit(1).single();
      if (!auto) return `Automação "${args.automation_name}" não encontrada.`;
      const { error } = await supabase.from('automations').update({ is_active: args.active as boolean }).eq('id', auto.id);
      if (error) return `Erro: ${error.message}`;
      return `Automação "${auto.name}" ${args.active ? 'ativada' : 'desativada'}!`;
    }

    // ==================== CHATBOTS ====================
    case 'list_chatbots': {
      const { data, error } = await supabase.from('chatbot_flows')
        .select('id, name, is_active, execution_count')
        .eq('company_id', companyId).order('name');
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhum chatbot configurado.';
      return `Chatbots (${data.length}):\n` + data.map((c: any, i: number) =>
        `${i + 1}. "${c.name}" - ${c.is_active ? 'Ativo' : 'Inativo'} - Execuções: ${c.execution_count || 0}`
      ).join('\n');
    }

    case 'toggle_chatbot': {
      const { data: bot } = await supabase.from('chatbot_flows')
        .select('id, name').eq('company_id', companyId)
        .ilike('name', `%${args.chatbot_name}%`).limit(1).single();
      if (!bot) return `Chatbot "${args.chatbot_name}" não encontrado.`;
      const { error } = await supabase.from('chatbot_flows').update({ is_active: args.active as boolean }).eq('id', bot.id);
      if (error) return `Erro: ${error.message}`;
      return `Chatbot "${bot.name}" ${args.active ? 'ativado' : 'desativado'}!`;
    }

    // ==================== AGENTES DE IA ====================
    case 'list_ai_agents': {
      const { data, error } = await supabase.from('ai_agents')
        .select('id, name, is_active, model, whatsapp_enabled')
        .eq('company_id', companyId).order('name');
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhum agente de IA configurado.';
      return `Agentes de IA (${data.length}):\n` + data.map((a: any, i: number) =>
        `${i + 1}. "${a.name}" - ${a.is_active ? 'Ativo' : 'Inativo'} - Modelo: ${a.model || 'padrão'}${a.whatsapp_enabled ? ' - WhatsApp ✅' : ''}`
      ).join('\n');
    }

    // ==================== BOOKING ====================
    case 'list_booking_links': {
      const { data, error } = await supabase.from('booking_links')
        .select('id, title, link_slug, duration_minutes, is_active')
        .eq('company_id', companyId).order('title');
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhum link de agendamento encontrado.';
      return `Links de agendamento (${data.length}):\n` + data.map((b: any, i: number) =>
        `${i + 1}. "${b.title}" - ${b.duration_minutes}min - ${b.is_active ? 'Ativo' : 'Inativo'} - /booking/${b.link_slug}`
      ).join('\n');
    }

    // ==================== WHATSAPP ====================
    case 'list_whatsapp_conversations': {
      let query = supabase.from('whatsapp_conversations')
        .select('id, contact_name, contact_phone, last_message, last_message_at, unread_count')
        .eq('company_id', companyId).order('last_message_at', { ascending: false })
        .limit((args.limit as number) || 10);
      if (args.unread_only) query = query.gt('unread_count', 0);
      const { data, error } = await query;
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhuma conversa encontrada.';
      return `Conversas (${data.length}):\n` + data.map((c: any, i: number) =>
        `${i + 1}. ${c.contact_name || c.contact_phone}${c.unread_count ? ` (${c.unread_count} não lidas)` : ''} - "${(c.last_message || '').substring(0, 40)}..."`
      ).join('\n');
    }

    // ==================== GRUPOS DE CONTATOS ====================
    case 'list_contact_groups': {
      const { data, error } = await supabase.from('contact_groups')
        .select('id, name, description').eq('company_id', companyId).order('name');
      if (error) return `Erro: ${error.message}`;
      if (!data?.length) return 'Nenhum grupo de contatos encontrado.';
      // Get member counts
      const counts = await Promise.all(data.map(async (g: any) => {
        const { count } = await supabase.from('contact_group_members').select('id', { count: 'exact', head: true }).eq('group_id', g.id);
        return { ...g, count: count || 0 };
      }));
      return `Grupos (${counts.length}):\n` + counts.map((g: any, i: number) =>
        `${i + 1}. "${g.name}" - ${g.count} membros${g.description ? ` - ${g.description}` : ''}`
      ).join('\n');
    }

    // ==================== DASHBOARD SUMMARY ====================
    case 'get_dashboard_summary': {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      const [contacts, todayEvents, pendingTasks, proposals, docs, unreadChats] = await Promise.all([
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('calendar_events').select('id, title, start_date').eq('company_id', companyId)
          .gte('start_date', todayStart).lt('start_date', todayEnd).order('start_date'),
        supabase.from('calendar_events').select('id', { count: 'exact', head: true })
          .eq('company_id', companyId).eq('event_type', 'reminder').eq('status', 'pending'),
        supabase.from('proposals').select('id', { count: 'exact', head: true })
          .eq('company_id', companyId).eq('status', 'sent'),
        supabase.from('documents').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('whatsapp_conversations').select('id', { count: 'exact', head: true })
          .eq('company_id', companyId).gt('unread_count', 0),
      ]);
      const evList = (todayEvents.data || []).map((e: any) =>
        `  - ${new Date(e.start_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ${e.title}`
      ).join('\n');
      return [
        `Resumo do dia:`,
        `Contatos no CRM: ${contacts.count || 0}`,
        `Tarefas pendentes: ${pendingTasks.count || 0}`,
        `Propostas enviadas: ${proposals.count || 0}`,
        `Documentos no Drive: ${docs.count || 0}`,
        `Conversas não lidas: ${unreadChats.count || 0}`,
        todayEvents.data?.length ? `\nEventos hoje:\n${evList}` : 'Nenhum evento hoje.',
      ].join('\n');
    }

    // ==================== GERAL ====================
    case 'general_info': {
      return `A Ellosuit é uma plataforma completa de gestão empresarial com: CRM WhatsApp, Email Marketing, Agenda, Tarefas, Drive, Contratos, Propostas, Recibos, Videoconferência, Chatbots, Agentes de IA, Automações, Agenda Aberta (booking), Serviços e muito mais. Posso verificar qualquer informação diretamente na conta do usuário.`;
    }

    // ==================== CREATE AUTOMATION ====================
    case 'create_automation': {
      const triggerType = (args.trigger_type as string) || 'manual';
      const actions = (args.actions as any[]) || [];

      const triggerTypeMap: Record<string, string> = {
        'new_client': 'new_client', 'new_event': 'schedule', 'form_submit': 'webhook',
        'tag_added': 'client_updated', 'manual': 'webhook', 'webhook': 'webhook',
        'schedule': 'schedule', 'client_updated': 'client_updated', 'proposal_status': 'proposal_status',
      };
      const actionTypeMap: Record<string, string> = {
        'send_email': 'send_email', 'send_whatsapp': 'send_whatsapp', 'create_task': 'create_task',
        'add_tag': 'update_client', 'wait': 'delay', 'notify': 'send_email',
        'create_client': 'create_client', 'update_client': 'update_client',
        'http_request': 'http_request', 'create_proposal': 'create_proposal',
        'create_receipt': 'create_receipt', 'condition': 'condition',
      };
      const defaultConfigs: Record<string, any> = {
        'webhook': { method: 'POST', path: '' }, 'new_client': { clientType: 'any' },
        'client_updated': { fields: [] }, 'schedule': { cron: '0 9 * * *' },
        'proposal_status': { status: 'approved' }, 'send_email': { templateId: '', subject: '', to: '' },
        'send_whatsapp': { message: '', to: '' }, 'create_task': { title: '', dueDate: '' },
        'update_client': { fields: {} }, 'create_client': { fieldMapping: {} },
        'http_request': { url: '', method: 'POST', headers: {}, body: '' },
        'create_proposal': { templateId: '' },
        'create_receipt': { title: '', amount: '', payment_method: 'PIX', send_method: 'none', description: '' },
        'delay': { duration: 5, unit: 'minutes' }, 'condition': { field: '', operator: 'equals', value: '' },
      };
      const labelMap: Record<string, string> = {
        'webhook': 'Webhook', 'new_client': 'Novo Cliente', 'client_updated': 'Cliente Atualizado',
        'schedule': 'Agendamento', 'proposal_status': 'Status Proposta', 'send_email': 'Enviar Email',
        'send_whatsapp': 'Enviar WhatsApp', 'create_task': 'Criar Tarefa', 'update_client': 'Atualizar Cliente',
        'create_client': 'Criar Cliente', 'http_request': 'Requisição HTTP',
        'create_proposal': 'Criar Ordem de Serviço', 'create_receipt': 'Criar Recibo',
        'delay': 'Aguardar', 'condition': 'Condição',
      };

      const nodes: any[] = [];
      const edges: any[] = [];
      const resolvedTrigger = triggerTypeMap[triggerType] || 'webhook';
      const triggerId = crypto.randomUUID();
      nodes.push({
        id: triggerId, type: resolvedTrigger, position: { x: 250, y: 50 },
        data: { label: labelMap[resolvedTrigger] || 'Gatilho', config: { ...defaultConfigs[resolvedTrigger] } }
      });
      let prevNodeId = triggerId;
      let yPos = 200;
      for (const action of actions) {
        const nodeId = crypto.randomUUID();
        const resolvedAction = actionTypeMap[action.type] || action.type || 'send_email';
        nodes.push({
          id: nodeId, type: resolvedAction, position: { x: 250, y: yPos },
          data: { label: labelMap[resolvedAction] || action.type || 'Ação', config: { ...defaultConfigs[resolvedAction], ...(action.config || {}) } }
        });
        edges.push({ id: `e-${prevNodeId}-${nodeId}`, source: prevNodeId, target: nodeId });
        prevNodeId = nodeId;
        yPos += 150;
      }
      const { data: automation, error } = await supabase.from('automations').insert({
        name: args.name as string, description: (args.description as string) || null,
        trigger_type: resolvedTrigger, nodes, edges, is_active: false,
        company_id: companyId, created_by: userId,
      }).select('id, name').single();
      if (error) return `Erro ao criar automação: ${error.message}`;
      return `Automação "${automation.name}" criada com ${nodes.length} blocos! Está desativada por padrão.`;
    }

    // ==================== CREATE CHATBOT ====================
    case 'create_chatbot': {
      const trigger = (args.trigger as string) || 'whatsapp_channel';
      const steps = (args.steps as any[]) || [];
      const nodes: any[] = [];
      const edgesArr: any[] = [];
      const triggerId = crypto.randomUUID();
      nodes.push({ id: triggerId, type: 'trigger', subType: trigger, position: { x: 250, y: 50 }, data: { label: 'Gatilho', config: { triggerType: trigger } } });
      let prevNodeId = triggerId;
      let yPos = 200;
      for (const step of steps) {
        const nodeId = crypto.randomUUID();
        const nodeType = step.type === 'buttons' ? 'message' : step.type === 'wait_response' ? 'delay' : step.type === 'condition' ? 'condition' : (step.type === 'transfer_human' || step.type === 'transfer_ai_agent' || step.type === 'set_variable') ? 'action' : 'message';
        const subType = step.type === 'buttons' ? 'buttons' : step.type === 'wait_response' ? 'wait_response' : step.type || 'text';
        nodes.push({ id: nodeId, type: nodeType, subType, position: { x: 250, y: yPos }, data: { label: step.content || step.type, config: { message: step.content, buttons: step.options?.map((opt: string, i: number) => ({ id: `btn-${i}`, label: opt })) || [] } } });
        edgesArr.push({ id: `e-${prevNodeId}-${nodeId}`, source: prevNodeId, target: nodeId });
        prevNodeId = nodeId;
        yPos += 150;
      }
      const { data: chatbot, error } = await supabase.from('chatbot_flows').insert({
        name: args.name as string, description: (args.description as string) || null,
        nodes, edges: edgesArr, trigger_config: { triggerType: trigger },
        is_active: false, company_id: companyId, created_by: userId,
      }).select('id, name').single();
      if (error) return `Erro ao criar chatbot: ${error.message}`;
      return `Chatbot "${chatbot.name}" criado com ${nodes.length} blocos! Está desativado por padrão.`;
    }

    // ==================== CREATE AI AGENT ====================
    case 'create_ai_agent': {
      const { data: agent, error } = await supabase.from('ai_agents').insert({
        name: args.name as string,
        description: (args.description as string) || null,
        personality: (args.personality as string) || 'Assistente profissional e amigável',
        instructions: (args.instructions as string) || 'Responda de forma clara e útil.',
        model: (args.model as string) || 'google/gemini-3-flash-preview',
        is_active: true, company_id: companyId, created_by: userId,
        settings: { temperature: 0.7, maxResponseChars: 500 },
      }).select('id, name').single();
      if (error) return `Erro ao criar agente: ${error.message}`;
      return `Agente de IA "${agent.name}" criado com sucesso! Você pode editá-lo na plataforma.`;
    }

    default:
      return `Ferramenta "${toolName}" não reconhecida.`;
  }
}

// ============== MAIN HANDLER ==============
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userId, companyId, contactPhone, agentInstructions, agentPersonality, agentSettings, lastMedia } = await req.json();

    if (!userId || !companyId) {
      return new Response(JSON.stringify({ error: 'userId e companyId são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const [{ data: companyData }, { data: userData }] = await Promise.all([
      supabase.from('companies').select('name').eq('id', companyId).single(),
      supabase.from('company_users').select('role').eq('user_id', userId).eq('company_id', companyId).single(),
    ]);

    const settings = agentSettings || {};
    const temperature = (settings.temperature as number) ?? 0.7;
    const maxChars = (settings.maxResponseChars as number) ?? 500;
    const humor = (settings.humor as string) ?? 'profissional';

    const now = new Date();
    const todayStr = now.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const isoToday = now.toISOString().split('T')[0];

    const systemPrompt = [
      `Personalidade: ${agentPersonality || 'Assistente profissional e amigável da plataforma Ellosuit'}`,
      `Tom/Humor: ${humor}`,
      '',
      agentInstructions || 'Você é o assistente da Ellosuit via WhatsApp. Ajude o cliente a gerenciar TODA a sua conta usando as ferramentas disponíveis.',
      '',
      `DATA E HORA ATUAL: ${todayStr}, ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      `DATA ISO HOJE: ${isoToday}`,
      '',
      `CONTEXTO DO USUARIO:`,
      `- Empresa: ${companyData?.name || 'N/A'}`,
      `- Cargo: ${userData?.role || 'N/A'}`,
      `- WhatsApp: ${contactPhone || 'N/A'}`,
      '',
      'REGRAS:',
      '1. Responda APENAS o que foi perguntado. Seja direto.',
      '2. Use as ferramentas disponíveis para EXECUTAR ações na conta do usuário.',
      '3. Envie UMA mensagem curta por vez.',
      '4. NAO use markdown, asteriscos ou formatação especial.',
      '5. Escreva como uma pessoa digitando no WhatsApp.',
      `6. Limite: ${maxChars} caracteres no máximo.`,
      '7. Responda sempre em português brasileiro.',
      '8. Quando o usuário enviar um arquivo, use upload_to_drive para salvá-lo.',
      '9. Você tem acesso a TODAS as funções do sistema: CRM, agenda, tarefas, drive, propostas, contratos, recibos, serviços, email, automações, chatbots, agentes de IA, booking e WhatsApp.',
      '10. Quando o usuário pedir para CRIAR uma automação, use create_automation. Pergunte o gatilho e as ações.',
      '11. Quando o usuário pedir para CRIAR um chatbot, use create_chatbot. Pergunte o objetivo do fluxo.',
      '12. Quando o usuário pedir para CRIAR um agente de IA, use create_ai_agent. Pergunte nome, personalidade e instruções.',
      '',
      lastMedia ? `ARQUIVO RECEBIDO: O usuário enviou um arquivo (${lastMedia.fileName || 'arquivo'}). Use upload_to_drive para salvá-lo se solicitado.` : '',
      '',
      'TRANSFERENCIA PARA ATENDENTE:',
      'Se o cliente pedir para falar com um humano, inclua [HANDOFF] no final.',
    ].filter(Boolean).join('\n');

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...(messages || []),
    ];

    console.log(`🤖 [ELLOSUIT-AGENT] Processing for user=${userId}, company=${companyId}, msgs=${apiMessages.length}, tools=${TOOLS.length}`);

    // First AI call
    const response = await chatCompletion({
        model: (settings.model as string) || 'google/gemini-3-flash-preview',
        messages: apiMessages, tools: TOOLS, tool_choice: 'auto', temperature,
      });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ AI Gateway error:', response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices[0];

    // Log first AI call cost
    const u1 = data.usage || {};
    const model = (settings.model as string) || 'google/gemini-3-flash-preview';
    const cost1 = ((u1.prompt_tokens || 0) / 1000) * 0.00015 + ((u1.completion_tokens || 0) / 1000) * 0.0006;
    logUsage({
      service_type: 'openai', action: 'whatsapp_agent_call1', model: mapModel(model),
      input_tokens: u1.prompt_tokens || 0, output_tokens: u1.completion_tokens || 0,
      total_cost: cost1, user_id: userId, company_id: companyId,
      metadata: { has_tool_calls: !!choice.message.tool_calls?.length },
    });

    // Handle tool calls (support multiple rounds)
    if (choice.message.tool_calls?.length > 0) {
      console.log(`🔧 [ELLOSUIT-AGENT] ${choice.message.tool_calls.length} tool call(s)`);
      const toolResults: Array<{ role: string; tool_call_id: string; content: string }> = [];
      for (const toolCall of choice.message.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        console.log(`🔧 Executing: ${toolName}`, toolArgs);
        const result = await executeTool(toolName, toolArgs, { supabase, userId, companyId, lastMedia });
        console.log(`🔧 Result: ${result.substring(0, 100)}`);
        toolResults.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
      }

      const followUpResponse = await chatCompletion({
          model: (settings.model as string) || 'google/gemini-3-flash-preview',
          messages: [...apiMessages, choice.message, ...toolResults], temperature,
        });

      if (followUpResponse.ok) {
        const followUpData = await followUpResponse.json();
        const finalMessage = followUpData.choices[0].message.content || '';

        // Log second AI call cost
        const u2 = followUpData.usage || {};
        const cost2 = ((u2.prompt_tokens || 0) / 1000) * 0.00015 + ((u2.completion_tokens || 0) / 1000) * 0.0006;
        logUsage({
          service_type: 'openai', action: 'whatsapp_agent_call2', model: mapModel(model),
          input_tokens: u2.prompt_tokens || 0, output_tokens: u2.completion_tokens || 0,
          total_cost: cost2, user_id: userId, company_id: companyId,
        });

        console.log(`✅ [ELLOSUIT-AGENT] Final: ${finalMessage.substring(0, 100)}...`);
        return new Response(JSON.stringify({ response: finalMessage }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const message = choice.message.content || 'Desculpe, não consegui processar.';
    return new Response(JSON.stringify({ response: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ [ELLOSUIT-AGENT] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Erro interno',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
