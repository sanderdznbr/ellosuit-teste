// AI Assistant Orchestrator - Full platform assistant with tool calling
import { createClient } from 'npm:@supabase/supabase-js@2';
import { chatCompletion } from '../_shared/llm.ts';

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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ============== TOOL DEFINITIONS ==============
const TOOLS = [
  // === TAREFAS ===
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "Listar tarefas/lembretes do usuário",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "in_progress", "completed", "all"], description: "Filtrar por status" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Criar uma nova tarefa/lembrete",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título da tarefa" },
          description: { type: "string", description: "Descrição (opcional)" },
          due_date: { type: "string", description: "Data de vencimento YYYY-MM-DD (opcional)" }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Atualizar uma tarefa existente",
      parameters: {
        type: "object",
        properties: {
          task_title: { type: "string", description: "Título da tarefa (busca parcial)" },
          new_title: { type: "string" },
          new_status: { type: "string", enum: ["pending", "completed", "cancelled"] },
          new_description: { type: "string" }
        },
        required: ["task_title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "Excluir uma tarefa",
      parameters: {
        type: "object",
        properties: { task_title: { type: "string", description: "Título da tarefa (busca parcial)" } },
        required: ["task_title"]
      }
    }
  },

  // === AGENDA ===
  {
    type: "function",
    function: {
      name: "list_calendar_events",
      description: "Listar eventos/compromissos da agenda",
      parameters: {
        type: "object",
        properties: { days_ahead: { type: "number", description: "Dias à frente (padrão: 7)" } },
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
          start_date: { type: "string", description: "Data/hora início YYYY-MM-DDTHH:mm:ss" },
          end_date: { type: "string", description: "Data/hora fim YYYY-MM-DDTHH:mm:ss" },
          description: { type: "string", description: "Descrição (opcional)" },
          event_type: { type: "string", enum: ["meeting", "reminder", "task", "other"], description: "Tipo (padrão: meeting)" }
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
        properties: { event_title: { type: "string", description: "Título do evento (busca parcial)" } },
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
          search: { type: "string", description: "Buscar por nome, email ou telefone" },
          limit: { type: "number", description: "Quantidade (padrão: 10)" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_contact",
      description: "Criar um novo contato/cliente",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          company_name: { type: "string" },
          notes: { type: "string" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_contact",
      description: "Atualizar um contato existente",
      parameters: {
        type: "object",
        properties: {
          contact_name: { type: "string", description: "Nome do contato (busca parcial)" },
          new_name: { type: "string" },
          new_email: { type: "string" },
          new_phone: { type: "string" },
          new_notes: { type: "string" },
          new_status: { type: "string", enum: ["active", "inactive", "lead"] }
        },
        required: ["contact_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_contact",
      description: "Excluir um contato",
      parameters: {
        type: "object",
        properties: { contact_name: { type: "string" } },
        required: ["contact_name"]
      }
    }
  },

  // === DRIVE ===
  {
    type: "function",
    function: {
      name: "save_to_drive",
      description: "Salvar um arquivo anexado no Drive",
      parameters: {
        type: "object",
        properties: {
          folder_name: { type: "string", description: "Pasta destino (opcional)" },
          create_folder: { type: "boolean" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_documents",
      description: "Listar documentos no Drive",
      parameters: {
        type: "object",
        properties: {
          folder_name: { type: "string" },
          limit: { type: "number" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_folder",
      description: "Criar pasta no Drive",
      parameters: {
        type: "object",
        properties: { folder_name: { type: "string" } },
        required: ["folder_name"]
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

  // === NAVEGAÇÃO ===
  {
    type: "function",
    function: {
      name: "navigate",
      description: "Navegar para um módulo do sistema",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Rota, ex: /dashboard/crm-whatsapp" },
          label: { type: "string", description: "Nome amigável" }
        },
        required: ["path", "label"]
      }
    }
  },

  // === SERVIÇOS ===
  {
    type: "function",
    function: {
      name: "list_services",
      description: "Listar serviços/produtos cadastrados",
      parameters: {
        type: "object",
        properties: { search: { type: "string" } },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_service",
      description: "Cadastrar novo serviço/produto",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          unit_price: { type: "number" },
          description: { type: "string" },
          category: { type: "string" }
        },
        required: ["name", "unit_price"]
      }
    }
  },

  // === ASSINATURA ===
  {
    type: "function",
    function: {
      name: "check_subscription",
      description: "Verificar status da assinatura e módulos ativos",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },

  // === PROPOSTAS / CONTRATOS / RECIBOS ===
  {
    type: "function",
    function: {
      name: "list_proposals",
      description: "Listar propostas comerciais",
      parameters: {
        type: "object",
        properties: { status: { type: "string", enum: ["draft", "sent", "approved", "rejected", "all"] }, limit: { type: "number" } },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_contracts",
      description: "Listar contratos",
      parameters: {
        type: "object",
        properties: { status: { type: "string", enum: ["draft", "signed", "cancelled", "all"] }, limit: { type: "number" } },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_receipts",
      description: "Listar recibos emitidos",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
        required: []
      }
    }
  },

  // === EMAIL ===
  {
    type: "function",
    function: {
      name: "list_email_templates",
      description: "Listar templates de email",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "list_sent_emails",
      description: "Listar emails enviados com estatísticas",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
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
      description: "Ativar/desativar uma automação",
      parameters: {
        type: "object",
        properties: {
          automation_name: { type: "string" },
          active: { type: "boolean" }
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
      description: "Listar chatbots",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "toggle_chatbot",
      description: "Ativar/desativar chatbot",
      parameters: {
        type: "object",
        properties: { chatbot_name: { type: "string" }, active: { type: "boolean" } },
        required: ["chatbot_name", "active"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "set_active_hours",
      description: "Configura horário de funcionamento (dias e faixas) de um chatbot ou automação. Fora desse horário a execução é pulada e uma mensagem de ausência é enviada.",
      parameters: {
        type: "object",
        properties: {
          target_type: { type: "string", enum: ["chatbot", "automation"], description: "chatbot ou automation" },
          name: { type: "string", description: "Nome do chatbot/automação (busca parcial)" },
          enabled: { type: "boolean", description: "true para ativar a restrição de horário" },
          out_of_hours_message: { type: "string", description: "Mensagem enviada fora do horário" },
          schedule: {
            type: "object",
            description: "Horários por dia da semana (chaves: mon,tue,wed,thu,fri,sat,sun)",
            properties: {
              mon: { type: "object", properties: { enabled: {type:"boolean"}, start: {type:"string"}, end: {type:"string"} } },
              tue: { type: "object", properties: { enabled: {type:"boolean"}, start: {type:"string"}, end: {type:"string"} } },
              wed: { type: "object", properties: { enabled: {type:"boolean"}, start: {type:"string"}, end: {type:"string"} } },
              thu: { type: "object", properties: { enabled: {type:"boolean"}, start: {type:"string"}, end: {type:"string"} } },
              fri: { type: "object", properties: { enabled: {type:"boolean"}, start: {type:"string"}, end: {type:"string"} } },
              sat: { type: "object", properties: { enabled: {type:"boolean"}, start: {type:"string"}, end: {type:"string"} } },
              sun: { type: "object", properties: { enabled: {type:"boolean"}, start: {type:"string"}, end: {type:"string"} } }
            }
          }
        },
        required: ["target_type", "name", "enabled"]
      }
    }
  },

  // === AGENTES IA ===
  {
    type: "function",
    function: {
      name: "list_ai_agents",
      description: "Listar agentes de IA",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "list_whatsapp_sessions",
      description: "Listar todas as sessões do WhatsApp CRM-ELLO conectadas na conta (com número e status)",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },

  // === WHATSAPP ===
  {
    type: "function",
    function: {
      name: "list_whatsapp_conversations",
      description: "Listar conversas recentes do WhatsApp",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" }, unread_only: { type: "boolean" } },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_whatsapp_message",
      description: "Enviar uma mensagem de WhatsApp para um contato. SEMPRE use esta ferramenta para enviar mensagens. Ela detecta automaticamente se o usuário tem sessões conectadas e permite a escolha entre elas.",
      parameters: {
        type: "object",
        properties: {
          contact_name: { type: "string", description: "Nome do contato (busca no CRM)" },
          phone: { type: "string", description: "Número do telefone direto (ex: 5541999999999)" },
          message: { type: "string", description: "Texto da mensagem a enviar" },
          session_id: { type: "string", description: "ID da sessão específica para enviar (opcional)" }
        },
        required: ["message"]
      }
    }
  },


  // === DISPAROS (BULK WHATSAPP) ===
  {
    type: "function",
    function: {
      name: "list_dispatch_campaigns",
      description: "Listar campanhas de disparo em massa de WhatsApp (histórico, status, enviados).",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },
  {
    type: "function",
    function: {
      name: "create_dispatch_campaign",
      description: "Criar um disparo em massa no WhatsApp, seguindo as MESMAS etapas da página Disparos. NUNCA envie direto: chame primeiro com confirmed=false para gerar o RESUMO e só chame com confirmed=true depois que o usuário aprovar explicitamente.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Nome da campanha" },
          recipients: {
            type: "array",
            description: "Lista de destinatários",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                phone: { type: "string", description: "Telefone com DDI/DDD, ex: 5541999999999" }
              },
              required: ["phone"]
            }
          },
          message: { type: "string", description: "Texto da mensagem. Use @nome para personalizar com o nome do contato." },
          delay_seconds: { type: "number", description: "Intervalo em segundos entre cada envio (padrão 5)" },
          session_id: { type: "string", description: "ID da sessão de WhatsApp (opcional, usa a conectada)" },
          media_type: { type: "string", enum: ["text", "image", "video", "document", "audio", "voice"], description: "voice = áudio gerado por IA a partir do roteiro" },
          media_url: { type: "string", description: "URL pública da mídia (quando media_type não for text/voice)" },
          voice_script: { type: "string", description: "Roteiro falado quando media_type = voice. Use @nome para citar o nome." },
          voice_id: { type: "string", description: "ID da voz ElevenLabs (opcional)" },
          follow_ups: {
            type: "array",
            description: "Mensagens enviadas em seguida",
            items: { type: "object", properties: { message: { type: "string" }, media_url: { type: "string" }, media_type: { type: "string" } }, required: ["message"] }
          },
          ai_agent_id: { type: "string", description: "Agente de IA que assume a conversa se o destinatário responder" },
          chatbot_flow_id: { type: "string", description: "Fluxo de chatbot disparado se o destinatário responder" },
          confirmed: { type: "boolean", description: "false (padrão) = apenas gera o resumo para aprovação. true = usuário já aprovou o resumo e o disparo pode ser iniciado." }
        },
        required: ["recipients", "message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "control_dispatch_campaign",
      description: "Pausar, retomar ou cancelar uma campanha de disparo.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string" },
          action: { type: "string", enum: ["pause", "resume", "cancel"] }
        },
        required: ["campaign_id", "action"]
      }
    }
  },

  // === BOOKING ===
  {
    type: "function",
    function: {
      name: "list_booking_links",
      description: "Listar links de agendamento online",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },

  // === CONNECT WHATSAPP ===
  {
    type: "function",
    function: {
      name: "connect_whatsapp",
      description: "Conectar um número de WhatsApp gerando QR Code para escaneamento. Use quando o usuário quer conectar o WhatsApp dele ou reconectar um número que já estava conectado mas parou de funcionar (sessão desconectada).",
      parameters: {
        type: "object",
        properties: {
          force: { type: "boolean", description: "Se true, força a criação de uma nova sessão mesmo se já houver uma conectada. Use para reconectar ou quando o usuário pedir para 'criar sessão' ou 'reconectar'." }
        },
        required: []
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
                config: { type: "object", description: "Configurações da ação (template, message, delay, etc.)" }
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
          instructions: { type: "string", description: "Instruções detalhadas de como o agente deve se comportar e responder" },
          model: { type: "string", enum: ["google/gemini-3-flash-preview", "google/gemini-2.5-flash", "google/gemini-2.5-pro"], description: "Modelo de IA (padrão: gemini-3-flash-preview)" }
        },
        required: ["name", "personality", "instructions"]
      }
    }
  },

  // === DASHBOARD SUMMARY ===
  {
    type: "function",
    function: {
      name: "get_dashboard_summary",
      description: "Resumo geral: contatos, eventos hoje, tarefas, propostas, etc.",
      parameters: { type: "object", properties: {}, required: [] }
    }
  },

  // === REQUEST FILE ===
  {
    type: "function",
    function: {
      name: "request_file",
      description: "Pedir que o usuário anexe um arquivo",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string" },
          purpose: { type: "string", enum: ["save_to_drive", "import_contacts", "general"] },
          folder_name: { type: "string" }
        },
        required: ["message", "purpose"]
      }
    }
  },

  // === IMPORT CONTACTS ===
  {
    type: "function",
    function: {
      name: "import_contacts",
      description: "Importar contatos de arquivo CSV/XLSX",
      parameters: {
        type: "object",
        properties: { target: { type: "string", enum: ["cadastros", "email_marketing", "disparos"] } },
        required: ["target"]
      }
    }
  },

  // === BULK CREATE CONTACTS ===
  {
    type: "function",
    function: {
      name: "bulk_create_contacts",
      description: "Criar múltiplos contatos de uma vez a partir de dados extraídos de um arquivo (CSV, XLSX, etc). Use quando o usuário enviar um arquivo com lista de clientes/contatos e pedir para cadastrar. Extraia os dados do arquivo e passe como array.",
      parameters: {
        type: "object",
        properties: {
          contacts: {
            type: "array",
            description: "Lista de contatos a cadastrar",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Nome do contato (obrigatório)" },
                email: { type: "string" },
                phone: { type: "string" },
                company_name: { type: "string" },
                notes: { type: "string" },
                client_type: { type: "string", enum: ["cliente", "fornecedor", "prospecto"], description: "Tipo de contato (padrão: cliente)" }
              },
              required: ["name"]
            }
          }
        },
        required: ["contacts"]
      }
    }
  },

  // === GENERATE IMAGE ===
  {
    type: "function",
    function: {
      name: "generate_image",
      description: "Gerar uma imagem/post estático usando o ElloContent IA (sistema de IA do ecossistema Ellosuit). Use SOMENTE depois de já ter coletado todas as informações: tema, formato, estilo, cores, logo. Gere um prompt DETALHADO em inglês.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Prompt detalhado em INGLÊS descrevendo a imagem desejada. Seja específico sobre cores, estilo, composição, textos overlay, etc." },
          style: { type: "string", enum: ["social_post", "story", "banner", "thumbnail", "logo", "general"], description: "Tipo de imagem" },
          aspect_ratio: { type: "string", enum: ["1:1", "4:5", "9:16", "16:9"], description: "Proporção" },
          reference_image_urls: { type: "array", items: { type: "string" }, description: "URLs de imagens de referência de estilo (do marketplace_styles) para a IA seguir o mesmo padrão visual" },
          logo_url: { type: "string", description: "URL do logo da empresa para incluir no post" },
          brand_colors: { type: "array", items: { type: "string" }, description: "Cores da marca em hex (ex: #FF4500, #1a1a2e)" }
        },
        required: ["prompt"]
      }
    }
  },

  // === LIST STYLES ===
  {
    type: "function",
    function: {
      name: "list_styles",
      description: "Listar estilos visuais disponíveis no marketplace do ElloContent IA. Cada estilo tem imagens de referência e configurações. Use para mostrar opções de estilos ao usuário antes de gerar uma imagem.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "Filtrar por categoria (opcional)" }
        },
        required: []
      }
    }
  },

  // === GET BRAND ASSETS (LOGOS) ===
  {
    type: "function",
    function: {
      name: "get_brand_assets",
      description: "Buscar logos e assets de marca da empresa do usuário. Use para verificar se o usuário já tem logo cadastrada antes de gerar posts.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["logo", "icon", "banner", "all"], description: "Tipo de asset (padrão: logo)" }
        },
        required: []
      }
    }
  },

  // === PARSE FILE CONTENT ===
  {
    type: "function",
    function: {
      name: "parse_uploaded_file",
      description: "Baixar e ler o conteúdo de um arquivo anexado (CSV, XLSX, TXT). Use quando o usuário anexar um arquivo e quiser que você processe os dados dele (ex: importar contatos, analisar planilha). Retorna o conteúdo do arquivo como texto.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },

  // === GENERATE CHART ===
  {
    type: "function",
    function: {
      name: "generate_chart",
      description: "Gerar um gráfico interativo com métricas da plataforma. Use quando o usuário pedir gráficos, relatórios visuais, análises de dados, estatísticas, desempenho, evolução, comparativos ou qualquer visualização de dados. Busque os dados reais do sistema e monte o gráfico.",
      parameters: {
        type: "object",
        properties: {
          chart_type: { type: "string", enum: ["bar", "line", "area", "pie"], description: "Tipo do gráfico" },
          title: { type: "string", description: "Título do gráfico" },
          description: { type: "string", description: "Descrição breve do que o gráfico mostra" },
          data_source: { type: "string", enum: ["contacts", "events", "tasks", "proposals", "emails", "conversations", "services", "automations", "receipts", "custom"], description: "Fonte dos dados" },
          period: { type: "string", enum: ["7d", "15d", "30d", "90d", "12m"], description: "Período de análise (padrão: 30d)" },
          group_by: { type: "string", enum: ["day", "week", "month", "status", "type", "category"], description: "Agrupar por (padrão: day)" },
          custom_data: {
            type: "array",
            description: "Dados customizados quando data_source=custom. Cada item é {name, value, ...extras}",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                value: { type: "number" },
                value2: { type: "number" },
                label: { type: "string" }
              },
              required: ["name", "value"]
            }
          },
          colors: { type: "array", items: { type: "string" }, description: "Cores hex para o gráfico (opcional)" },
          series_names: { type: "array", items: { type: "string" }, description: "Nomes das séries (para value, value2, etc)" }
        },
        required: ["chart_type", "title", "data_source"]
      }
    }
  },

  // === GENERATE PDF ===
  {
    type: "function",
    function: {
      name: "generate_pdf",
      description: "Gerar um documento PDF profissional (contrato, proposta, resumo, relatório, etc). Use quando o usuário pedir para criar, redigir, gerar ou exportar um documento em PDF. Pode usar conteúdo de um arquivo anexado como base. SEMPRE inclui 'Criado com Ellosuit' no rodapé.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título do documento" },
          content: { type: "string", description: "Conteúdo completo do documento em texto. Use seções, parágrafos e formatação clara. Pode incluir cláusulas, itens, valores, etc. NÃO use markdown - use texto limpo." },
          document_type: { type: "string", enum: ["contrato", "proposta", "resumo", "relatorio", "carta", "outro"], description: "Tipo do documento" },
          parties: {
            type: "array",
            description: "Partes envolvidas (para contratos/propostas)",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                role: { type: "string", description: "Ex: Contratante, Contratado, Prestador" },
                document: { type: "string", description: "CPF/CNPJ" },
                address: { type: "string" }
              },
              required: ["name"]
            }
          },
          values: {
            type: "object",
            description: "Valores financeiros do documento",
            properties: {
              total: { type: "number" },
              currency: { type: "string", description: "Moeda (padrão: BRL)" },
              payment_terms: { type: "string", description: "Condições de pagamento" }
            }
          }
        },
        required: ["title", "content", "document_type"]
      }
    }
  },

   {
     type: "function",
     function: {
       name: "start_in_person_meeting",
       description: "Iniciar uma gravação de reunião presencial. Use quando o usuário pedir para gravar uma reunião, conversa física ou áudio ambiente para transcrição.",
       parameters: {
         type: "object",
         properties: {
           title: { type: "string", description: "Título sugerido para a reunião" }
         },
         required: []
       }
     }
   },
  // === ANALYZE PDF VISUAL ===
  {
    type: "function",
    function: {
      name: "analyze_pdf_visual",
      description: "Analisar visualmente um documento PDF página por página. Extrai o conteúdo e faz análise detalhada de cada página incluindo design, layout, conteúdo, cores, tipografia e sugestões de melhoria. Use quando o usuário enviar um PDF e pedir sua opinião, análise, sugestões ou quiser melhorar o design.",
      parameters: {
        type: "object",
        properties: {
          focus: { type: "string", enum: ["design", "content", "both"], description: "Foco da análise: design (visual/layout), content (texto/informação), both (ambos). Padrão: both" },
          improve_design: { type: "boolean", description: "Se true, gera sugestões detalhadas de melhoria de design com exemplos visuais" }
        },
        required: []
      }
    }
  },
];

// ============== TOOL EXECUTION ==============
type ToolContext = {
  supabase: ReturnType<typeof createClient>;
  userId: string;
  companyId: string;
  fileUrl?: string;
  fileName?: string;
};

async function executeTool(toolName: string, args: Record<string, unknown>, context: ToolContext): Promise<{ result: string; action?: any }> {
  const { supabase, userId, companyId, fileUrl, fileName } = context;

  switch (toolName) {

    // ==================== TAREFAS ====================
    case 'list_tasks': {
      let query = supabase.from('calendar_events')
        .select('id, title, description, status, start_date, event_type')
        .eq('company_id', companyId).eq('event_type', 'reminder')
        .order('start_date', { ascending: false }).limit(15);
      const status = args.status as string;
      if (status && status !== 'all') query = query.eq('status', status);
      const { data, error } = await query;
      if (error) return { result: `Erro: ${error.message}` };
      if (!data?.length) return { result: 'Nenhuma tarefa encontrada.' };
      const cards = data.map((t: any) => ({
        type: 'task', title: t.title,
        subtitle: t.description || undefined,
        status: t.status === 'completed' ? 'Concluída' : t.status === 'pending' ? 'Pendente' : t.status,
        statusColor: t.status === 'completed' ? 'green' : t.status === 'pending' ? 'yellow' : 'gray',
        details: t.start_date ? [new Date(t.start_date).toLocaleDateString('pt-BR')] : [],
        link: '/dashboard/agenda',
      }));
      return {
        result: `Tarefas (${data.length}):\n` + data.map((t: any, i: number) =>
          `${i + 1}. "${t.title}" - Status: ${t.status || 'pending'}${t.start_date ? `, Data: ${new Date(t.start_date).toLocaleDateString('pt-BR')}` : ''}`
        ).join('\n'),
        action: { action: 'list_tasks', data, cards }
      };
    }

    case 'create_task': {
      const dueDate = (args.due_date as string) || new Date().toISOString().split('T')[0];
      const { data, error } = await supabase.from('calendar_events').insert({
        title: args.title as string, description: (args.description as string) || null,
        start_date: `${dueDate}T08:00:00`, end_date: `${dueDate}T08:30:00`,
        event_type: 'reminder', status: 'pending', source: 'assistant',
        company_id: companyId, created_by: userId,
      }).select('id, title').single();
      if (error) return { result: `Erro ao criar tarefa: ${error.message}` };
      return {
        result: `✅ Tarefa "${data.title}" criada para ${dueDate}!`,
        action: { action: 'task_created', data }
      };
    }

    case 'update_task': {
      const { data: tasks } = await supabase.from('calendar_events')
        .select('id, title').eq('company_id', companyId).eq('event_type', 'reminder')
        .ilike('title', `%${args.task_title}%`).limit(1).single();
      if (!tasks) return { result: `Tarefa "${args.task_title}" não encontrada.` };
      const updates: any = {};
      if (args.new_title) updates.title = args.new_title;
      if (args.new_status) updates.status = args.new_status;
      if (args.new_description) updates.description = args.new_description;
      const { error } = await supabase.from('calendar_events').update(updates).eq('id', tasks.id);
      if (error) return { result: `Erro: ${error.message}` };
      return { result: `✅ Tarefa "${tasks.title}" atualizada!`, action: { action: 'task_updated' } };
    }

    case 'delete_task': {
      const { data: task } = await supabase.from('calendar_events')
        .select('id, title').eq('company_id', companyId).eq('event_type', 'reminder')
        .ilike('title', `%${args.task_title}%`).limit(1).single();
      if (!task) return { result: `Tarefa "${args.task_title}" não encontrada.` };
      const { error } = await supabase.from('calendar_events').delete().eq('id', task.id);
      if (error) return { result: `Erro: ${error.message}` };
      return { result: `✅ Tarefa "${task.title}" excluída!`, action: { action: 'task_deleted' } };
    }

    // ==================== AGENDA ====================
    case 'list_calendar_events': {
      const daysAhead = (args.days_ahead as number) || 7;
      const now = new Date();
      const end = new Date(now.getTime() + daysAhead * 86400000);
      const { data, error } = await supabase.from('calendar_events')
        .select('id, title, start_date, end_date, description, event_type, meeting_link, meeting_provider')
        .eq('company_id', companyId)
        .gte('start_date', now.toISOString()).lte('start_date', end.toISOString())
        .order('start_date', { ascending: true }).limit(20);
      if (error) return { result: `Erro: ${error.message}` };
      if (!data?.length) return { result: `Nenhum evento nos próximos ${daysAhead} dias.` };
      const cards = data.map((e: any) => {
        const s = new Date(e.start_date);
        return {
          type: 'event', title: e.title,
          subtitle: `${s.toLocaleDateString('pt-BR')} às ${s.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
          details: [e.event_type === 'meeting' ? '📹 Reunião' : e.event_type === 'reminder' ? '🔔 Lembrete' : '📅 Evento', ...(e.meeting_link ? [`🔗 ${e.meeting_link}`] : [])],
          link: '/dashboard/agenda',
        };
      });
      return {
        result: `Eventos (${data.length}):\n` + data.map((e: any, i: number) => {
          const s = new Date(e.start_date);
          let line = `${i + 1}. "${e.title}" - ${s.toLocaleDateString('pt-BR')} às ${s.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
          if (e.meeting_link) line += `\n   🔗 Link: ${e.meeting_link}`;
          return line;
        }).join('\n'),
        action: { action: 'list_events', data, cards }
      };
    }

    case 'create_calendar_event': {
      const eventType = (args.event_type as string) || 'meeting';
      // Generate Ellomeeting link for meetings
      let meetingLink: string | null = null;
      if (eventType === 'meeting') {
        const roomCode = crypto.randomUUID().split('-')[0];
        meetingLink = `https://www.ellosuit.app/meet/${roomCode}`;
      }
      const insertData: any = {
        title: args.title as string, start_date: args.start_date as string,
        end_date: args.end_date as string, description: (args.description as string) || null,
        event_type: eventType, status: 'pending', source: 'assistant',
        company_id: companyId, created_by: userId,
      };
      if (meetingLink) {
        insertData.meeting_link = meetingLink;
        insertData.meeting_provider = 'ellosuit';
      }
      const { data, error } = await supabase.from('calendar_events').insert(insertData).select('id, title, start_date, meeting_link').single();
      if (error) return { result: `Erro ao criar evento: ${error.message}` };
      const s = new Date(data.start_date);
      const dateStr = s.toLocaleDateString('pt-BR');
      const timeStr = s.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      let resultText = `✅ Evento "${data.title}" criado para ${dateStr} às ${timeStr}!`;
      if (data.meeting_link) {
        resultText += `\nLink da reunião: ${data.meeting_link}`;
      }
      return {
        result: resultText,
        action: { action: 'event_created', data, navigate: '/dashboard/agenda' }
      };
    }

    case 'delete_calendar_event': {
      const { data: ev } = await supabase.from('calendar_events')
        .select('id, title').eq('company_id', companyId)
        .ilike('title', `%${args.event_title}%`).limit(1).single();
      if (!ev) return { result: `Evento "${args.event_title}" não encontrado.` };
      const { error } = await supabase.from('calendar_events').delete().eq('id', ev.id);
      if (error) return { result: `Erro: ${error.message}` };
      return { result: `✅ Evento "${ev.title}" excluído!`, action: { action: 'event_deleted' } };
    }

    // ==================== CONTATOS ====================
    case 'list_contacts': {
      let query = supabase.from('clients')
        .select('id, name, email, phone, company_name, status')
        .eq('company_id', companyId).order('created_at', { ascending: false })
        .limit((args.limit as number) || 10);
      if (args.search) query = query.or(`name.ilike.%${args.search}%,email.ilike.%${args.search}%,phone.ilike.%${args.search}%`);
      const { data, error } = await query;
      if (error) return { result: `Erro: ${error.message}` };
      if (!data?.length) return { result: 'Nenhum contato encontrado.' };
      const cards = data.map((c: any) => ({
        type: 'contact', title: c.name,
        subtitle: c.company_name || undefined,
        details: [c.email, c.phone].filter(Boolean),
        status: c.status === 'active' ? 'Ativo' : c.status === 'lead' ? 'Lead' : c.status,
        statusColor: c.status === 'active' ? 'green' : c.status === 'lead' ? 'blue' : 'gray',
        link: '/dashboard/cadastros',
      }));
      return {
        result: `Contatos (${data.length}):\n` + data.map((c: any, i: number) =>
          `${i + 1}. ${c.name}${c.email ? ` - ${c.email}` : ''}${c.phone ? ` - ${c.phone}` : ''}`
        ).join('\n'),
        action: { action: 'list_contacts', data, cards }
      };
    }

    case 'create_contact': {
      const { data, error } = await supabase.from('clients').insert({
        name: args.name as string, email: (args.email as string) || null,
        phone: (args.phone as string) || null, company_name: (args.company_name as string) || null,
        notes: (args.notes as string) || null, company_id: companyId, created_by: userId,
      }).select('id, name').single();
      if (error) return { result: `Erro: ${error.message}` };
      return {
        result: `✅ Contato "${data.name}" criado com sucesso!`,
        action: { action: 'contact_created', data, navigate: '/dashboard/cadastros' }
      };
    }

    case 'update_contact': {
      const { data: contact } = await supabase.from('clients')
        .select('id, name').eq('company_id', companyId)
        .ilike('name', `%${args.contact_name}%`).limit(1).single();
      if (!contact) return { result: `Contato "${args.contact_name}" não encontrado.` };
      const updates: any = {};
      if (args.new_name) updates.name = args.new_name;
      if (args.new_email) updates.email = args.new_email;
      if (args.new_phone) updates.phone = args.new_phone;
      if (args.new_notes) updates.notes = args.new_notes;
      if (args.new_status) updates.status = args.new_status;
      const { error } = await supabase.from('clients').update(updates).eq('id', contact.id);
      if (error) return { result: `Erro: ${error.message}` };
      return { result: `✅ Contato "${contact.name}" atualizado!`, action: { action: 'contact_updated' } };
    }

    case 'delete_contact': {
      const { data: contact } = await supabase.from('clients')
        .select('id, name').eq('company_id', companyId)
        .ilike('name', `%${args.contact_name}%`).limit(1).single();
      if (!contact) return { result: `Contato "${args.contact_name}" não encontrado.` };
      const { error } = await supabase.from('clients').delete().eq('id', contact.id);
      if (error) return { result: `Erro: ${error.message}` };
      return { result: `✅ Contato "${contact.name}" excluído!`, action: { action: 'contact_deleted' } };
    }

    // ==================== DRIVE ====================
    case 'save_to_drive': {
      if (!fileUrl || !fileName) return { result: 'Nenhum arquivo anexado para salvar.', action: { action: 'request_file', purpose: 'save_to_drive' } };
      let folderId: string | null = null;
      if (args.folder_name) {
        const { data: f } = await supabase.from('document_folders').select('id')
          .eq('company_id', companyId).eq('name', args.folder_name as string).is('parent_folder_id', null).maybeSingle();
        if (f) { folderId = f.id; }
        else if (args.create_folder !== false) {
          const { data: nf } = await supabase.from('document_folders')
            .insert({ name: args.folder_name as string, company_id: companyId, created_by: userId })
            .select('id').single();
          if (nf) folderId = nf.id;
        }
      }
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      const typeMap: Record<string, string> = { pdf:'pdf', doc:'doc', docx:'doc', xls:'spreadsheet', xlsx:'spreadsheet', csv:'spreadsheet', png:'image', jpg:'image', jpeg:'image', gif:'image', webp:'image', mp4:'video', mp3:'audio' };
      const { data: doc, error } = await supabase.from('documents').insert({
        name: fileName, file_type: typeMap[ext] || 'other', file_url: fileUrl,
        company_id: companyId, created_by: userId, folder_id: folderId,
      }).select('id').single();
      if (error) return { result: `Erro ao salvar: ${error.message}` };
      const folderMsg = args.folder_name ? ` na pasta "${args.folder_name}"` : '';
      return {
        result: `✅ Arquivo "${fileName}" salvo no Drive${folderMsg}!`,
        action: { action: 'saved_to_drive', documentId: doc.id, navigate: '/dashboard/drive' }
      };
    }

    case 'list_documents': {
      let query = supabase.from('documents')
        .select('id, name, file_type, created_at')
        .eq('company_id', companyId).order('created_at', { ascending: false })
        .limit((args.limit as number) || 10);
      if (args.folder_name) {
        const { data: folder } = await supabase.from('document_folders').select('id')
          .eq('company_id', companyId).ilike('name', args.folder_name as string).maybeSingle();
        if (folder) query = query.eq('folder_id', folder.id);
      }
      const { data, error } = await query;
      if (error) return { result: `Erro: ${error.message}` };
      if (!data?.length) return { result: 'Nenhum documento encontrado.' };
      return {
        result: `Documentos (${data.length}):\n` + data.map((d: any, i: number) =>
          `${i + 1}. ${d.name} (${d.file_type}) - ${new Date(d.created_at).toLocaleDateString('pt-BR')}`
        ).join('\n'),
        action: { action: 'list_documents', data }
      };
    }

    case 'create_folder': {
      const { data, error } = await supabase.from('document_folders')
        .insert({ name: args.folder_name as string, company_id: companyId, created_by: userId })
        .select('id, name').single();
      if (error) return { result: `Erro: ${error.message}` };
      return { result: `✅ Pasta "${data.name}" criada!`, action: { action: 'folder_created', navigate: '/dashboard/drive' } };
    }

    case 'list_folders': {
      const { data, error } = await supabase.from('document_folders')
        .select('id, name, description').eq('company_id', companyId).order('name');
      if (error) return { result: `Erro: ${error.message}` };
      if (!data?.length) return { result: 'Nenhuma pasta encontrada.' };
      return {
        result: `Pastas (${data.length}):\n` + data.map((f: any, i: number) => `${i + 1}. ${f.name}`).join('\n'),
        action: { action: 'list_folders', data }
      };
    }

    // ==================== NAVEGAÇÃO ====================
    case 'navigate': {
      return { result: `Abrindo ${args.label}...`, action: { action: 'navigate', path: args.path, label: args.label } };
    }

    // ==================== SERVIÇOS ====================
    case 'list_services': {
      let query = supabase.from('company_services')
        .select('id, name, unit_price, category, is_active')
        .eq('company_id', companyId).order('name');
      if (args.search) query = query.ilike('name', `%${args.search}%`);
      const { data, error } = await query;
      if (error) return { result: `Erro: ${error.message}` };
      if (!data?.length) return { result: 'Nenhum serviço cadastrado.' };
      return {
        result: `Serviços (${data.length}):\n` + data.map((s: any, i: number) =>
          `${i + 1}. ${s.name} - R$${s.unit_price}${s.category ? ` (${s.category})` : ''}`
        ).join('\n'),
        action: { action: 'list_services', data }
      };
    }

    case 'create_service': {
      const { data, error } = await supabase.from('company_services').insert({
        name: args.name as string, unit_price: args.unit_price as number,
        description: (args.description as string) || null, category: (args.category as string) || null,
        company_id: companyId, created_by: userId,
      }).select('id, name').single();
      if (error) return { result: `Erro: ${error.message}` };
      return { result: `✅ Serviço "${data.name}" cadastrado!`, action: { action: 'service_created' } };
    }

    // ==================== ASSINATURA ====================
    case 'check_subscription': {
      const { data: sub } = await supabase.from('subscriptions')
        .select('plan_type, status, monthly_price, trial_ends_at, current_period_end')
        .eq('company_id', companyId).single();
      if (!sub) return { result: 'Assinatura não encontrada.' };
      const { data: modules } = await supabase.from('subscription_modules')
        .select('module_type, is_active').eq('company_id', companyId);
      const active = (modules || []).filter((m: any) => m.is_active).map((m: any) => m.module_type);
      return {
        result: [
          `Plano: ${sub.plan_type}`, `Status: ${sub.status}`, `Valor: R$${sub.monthly_price}/mês`,
          active.length ? `Módulos: ${active.join(', ')}` : 'Sem módulos extras',
        ].join('\n'),
        action: { action: 'subscription_info' }
      };
    }

    // ==================== PROPOSTAS/CONTRATOS/RECIBOS ====================
    case 'list_proposals': {
      let query = supabase.from('proposals')
        .select('id, proposal_number, title, status, total_value, created_at')
        .eq('company_id', companyId).order('created_at', { ascending: false })
        .limit((args.limit as number) || 10);
      if (args.status && args.status !== 'all') query = query.eq('status', args.status as string);
      const { data, error } = await query;
      if (error) return { result: `Erro: ${error.message}` };
      if (!data?.length) return { result: 'Nenhuma proposta encontrada.' };
      return {
        result: `Propostas (${data.length}):\n` + data.map((p: any, i: number) =>
          `${i + 1}. ${p.proposal_number} - "${p.title}" - R$${p.total_value || 0} - ${p.status}`
        ).join('\n'),
        action: { action: 'list_proposals', data }
      };
    }

    case 'list_contracts': {
      let query = supabase.from('generated_contracts')
        .select('id, title, status, created_at')
        .eq('company_id', companyId).order('created_at', { ascending: false })
        .limit((args.limit as number) || 10);
      if (args.status && args.status !== 'all') query = query.eq('status', args.status as string);
      const { data, error } = await query;
      if (error) return { result: `Erro: ${error.message}` };
      if (!data?.length) return { result: 'Nenhum contrato encontrado.' };
      return {
        result: `Contratos (${data.length}):\n` + data.map((c: any, i: number) =>
          `${i + 1}. "${c.title}" - ${c.status} - ${new Date(c.created_at).toLocaleDateString('pt-BR')}`
        ).join('\n'),
        action: { action: 'list_contracts', data }
      };
    }

    case 'list_receipts': {
      const { data, error } = await supabase.from('receipts')
        .select('id, receipt_number, description, amount, status, created_at')
        .eq('company_id', companyId).order('created_at', { ascending: false })
        .limit((args.limit as number) || 10);
      if (error) return { result: `Erro: ${error.message}` };
      if (!data?.length) return { result: 'Nenhum recibo encontrado.' };
      return {
        result: `Recibos (${data.length}):\n` + data.map((r: any, i: number) =>
          `${i + 1}. ${r.receipt_number} - R$${r.amount} - ${r.status}`
        ).join('\n'),
        action: { action: 'list_receipts', data }
      };
    }

    // ==================== EMAIL ====================
    case 'list_email_templates': {
      const { data, error } = await supabase.from('email_templates')
        .select('id, name, category, is_active')
        .eq('company_id', companyId).eq('is_active', true).order('name');
      if (error) return { result: `Erro: ${error.message}` };
      if (!data?.length) return { result: 'Nenhum template encontrado.' };
      return {
        result: `Templates (${data.length}):\n` + data.map((t: any, i: number) => `${i + 1}. "${t.name}" - ${t.category}`).join('\n'),
        action: { action: 'list_templates', data }
      };
    }

    case 'list_sent_emails': {
      const { data, error } = await supabase.from('emails')
        .select('id, subject, recipient_email, status, open_count, sent_at')
        .eq('company_id', companyId).order('sent_at', { ascending: false })
        .limit((args.limit as number) || 10);
      if (error) return { result: `Erro: ${error.message}` };
      if (!data?.length) return { result: 'Nenhum email enviado.' };
      const cards = data.map((e: any) => ({
        type: 'email', title: e.subject,
        subtitle: e.recipient_email,
        status: e.open_count ? `${e.open_count}x aberto` : 'Não aberto',
        statusColor: e.open_count ? 'green' : 'gray',
        details: e.sent_at ? [new Date(e.sent_at).toLocaleDateString('pt-BR')] : [],
        link: '/dashboard/email-tracker',
      }));
      return {
        result: `Emails (${data.length}):\n` + data.map((e: any, i: number) =>
          `${i + 1}. "${e.subject}" → ${e.recipient_email} ${e.open_count ? `(${e.open_count}x aberto)` : ''}`
        ).join('\n'),
        action: { action: 'list_emails', data, cards }
      };
    }

    // ==================== AUTOMAÇÕES ====================
    case 'list_automations': {
      const { data, error } = await supabase.from('automations')
        .select('id, name, is_active, trigger_type, execution_count')
        .eq('company_id', companyId).order('name');
      if (error) return { result: `Erro: ${error.message}` };
      if (!data?.length) return { result: 'Nenhuma automação configurada.' };
      const cards = data.map((a: any) => ({
        type: 'automation', title: a.name,
        status: a.is_active ? 'Ativa' : 'Inativa',
        statusColor: a.is_active ? 'green' : 'gray',
        details: [`${a.execution_count || 0} execuções`, `Gatilho: ${a.trigger_type}`],
        link: '/dashboard/automacoes',
      }));
      return {
        result: `Automações (${data.length}):\n` + data.map((a: any, i: number) =>
          `${i + 1}. "${a.name}" - ${a.is_active ? 'Ativa' : 'Inativa'} - ${a.execution_count || 0} execuções`
        ).join('\n'),
        action: { action: 'list_automations', data, cards }
      };
    }

    case 'toggle_automation': {
      const { data: auto } = await supabase.from('automations')
        .select('id, name').eq('company_id', companyId)
        .ilike('name', `%${args.automation_name}%`).limit(1).single();
      if (!auto) return { result: `Automação "${args.automation_name}" não encontrada.` };
      const { error } = await supabase.from('automations').update({ is_active: args.active as boolean }).eq('id', auto.id);
      if (error) return { result: `Erro: ${error.message}` };
      return { result: `✅ Automação "${auto.name}" ${args.active ? 'ativada' : 'desativada'}!`, action: { action: 'automation_toggled' } };
    }

    // ==================== CHATBOTS ====================
    case 'list_chatbots': {
      const { data, error } = await supabase.from('chatbot_flows')
        .select('id, name, is_active, execution_count')
        .eq('company_id', companyId).order('name');
      if (error) return { result: `Erro: ${error.message}` };
      if (!data?.length) return { result: 'Nenhum chatbot configurado.' };
      const cards = data.map((c: any) => ({
        type: 'chatbot', title: c.name,
        status: c.is_active ? 'Ativo' : 'Inativo',
        statusColor: c.is_active ? 'green' : 'gray',
        details: [`${c.execution_count || 0} execuções`],
        link: '/dashboard/chatbot-builder',
      }));
      return {
        result: `Chatbots (${data.length}):\n` + data.map((c: any, i: number) =>
          `${i + 1}. "${c.name}" - ${c.is_active ? 'Ativo' : 'Inativo'}`
        ).join('\n'),
        action: { action: 'list_chatbots', data, cards }
      };
    }

    case 'toggle_chatbot': {
      const { data: bot } = await supabase.from('chatbot_flows')
        .select('id, name').eq('company_id', companyId)
        .ilike('name', `%${args.chatbot_name}%`).limit(1).single();
      if (!bot) return { result: `Chatbot "${args.chatbot_name}" não encontrado.` };
      const { error } = await supabase.from('chatbot_flows').update({ is_active: args.active as boolean }).eq('id', bot.id);
      if (error) return { result: `Erro: ${error.message}` };
      return { result: `✅ Chatbot "${bot.name}" ${args.active ? 'ativado' : 'desativado'}!`, action: { action: 'chatbot_toggled' } };
    }

    case 'set_active_hours': {
      const targetType = args.target_type as string;
      const name = args.name as string;
      const table = targetType === 'automation' ? 'automations' : 'chatbot_flows';
      const { data: row } = await supabase.from(table)
        .select('id, name, trigger_config').eq('company_id', companyId)
        .ilike('name', `%${name}%`).limit(1).single();
      if (!row) return { result: `${targetType === 'automation' ? 'Automação' : 'Chatbot'} "${name}" não encontrado.` };

      const DEFAULT_DAYS = {
        mon: { enabled: true, start: '09:00', end: '18:00' },
        tue: { enabled: true, start: '09:00', end: '18:00' },
        wed: { enabled: true, start: '09:00', end: '18:00' },
        thu: { enabled: true, start: '09:00', end: '18:00' },
        fri: { enabled: true, start: '09:00', end: '18:00' },
        sat: { enabled: false, start: '09:00', end: '13:00' },
        sun: { enabled: false, start: '09:00', end: '13:00' },
      };
      const existing = ((row.trigger_config as any) || {}).active_hours || {};
      const incomingDays = (args.schedule as any) || {};
      const days: any = { ...DEFAULT_DAYS, ...(existing.days || {}) };
      for (const k of Object.keys(incomingDays)) {
        days[k] = { ...days[k], ...incomingDays[k] };
      }
      const newCfg = {
        enabled: Boolean(args.enabled),
        timezone: existing.timezone || 'America/Sao_Paulo',
        days,
        outOfHoursMessage: (args.out_of_hours_message as string) || existing.outOfHoursMessage ||
          'Olá! 👋 Nosso atendimento automático está fora do horário no momento. Responderemos assim que retornarmos.',
      };
      const newTrigger = { ...((row.trigger_config as any) || {}), active_hours: newCfg };
      const { error } = await supabase.from(table).update({ trigger_config: newTrigger }).eq('id', row.id);
      if (error) return { result: `Erro: ${error.message}` };
      const summary = newCfg.enabled
        ? Object.entries(newCfg.days).filter(([_,d]:any)=>d.enabled).map(([k,d]:any)=>`${k} ${d.start}-${d.end}`).join(', ')
        : 'desativado';
      return {
        result: `✅ Horário do ${targetType === 'automation' ? 'automação' : 'chatbot'} "${row.name}" atualizado: ${summary}`,
        action: { action: 'active_hours_set', target_type: targetType, name: row.name, config: newCfg }
      };
    }

    // ==================== AGENTES IA ====================
    case 'list_ai_agents': {
      const { data, error } = await supabase.from('ai_agents')
        .select('id, name, is_active, model, whatsapp_enabled')
        .eq('company_id', companyId).order('name');
      if (error) return { result: `Erro: ${error.message}` };
      if (!data?.length) return { result: 'Nenhum agente de IA configurado.' };
      const cards = data.map((a: any) => ({
        type: 'agent', title: a.name,
        status: a.is_active ? 'Ativo' : 'Inativo',
        statusColor: a.is_active ? 'green' : 'gray',
        details: [a.model || 'gemini-3-flash', a.whatsapp_enabled ? 'WhatsApp ✅' : ''].filter(Boolean),
        link: `/dashboard/bot-ia/editar/${a.id}`,
      }));
      return {
        result: `Agentes (${data.length}):\n` + data.map((a: any, i: number) =>
          `${i + 1}. "${a.name}" - ${a.is_active ? 'Ativo' : 'Inativo'}${a.whatsapp_enabled ? ' - WhatsApp ✅' : ''}`
        ).join('\n'),
        action: { action: 'list_agents', data, cards }
      };
    }

    // ==================== DISPAROS ====================
    case 'list_dispatch_campaigns': {
      const { data, error } = await supabase.from('dispatch_campaigns')
        .select('id, title, status, total_recipients, sent_count, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(15);
      if (error) return { result: `Erro: ${error.message}` };
      if (!data?.length) return { result: 'Nenhuma campanha de disparo encontrada.' };
      return {
        result: data.map((c: any, i: number) =>
          `${i + 1}. "${c.title}" - ${c.status} (${c.sent_count || 0}/${c.total_recipients || 0})`
        ).join('\n'),
        action: { action: 'list_dispatch_campaigns', data }
      };
    }

    case 'control_dispatch_campaign': {
      const action = args.action as string;
      const status = action === 'pause' ? 'paused' : action === 'resume' ? 'running' : 'cancelled';
      const { error } = await supabase.from('dispatch_campaigns')
        .update({ status })
        .eq('id', args.campaign_id as string)
        .eq('company_id', companyId);
      if (error) return { result: `Erro: ${error.message}` };
      if (status === 'running') {
        supabase.functions.invoke('bulk-dispatch', { body: { campaign_id: args.campaign_id } }).catch(() => {});
      }
      return { result: `Campanha ${action === 'pause' ? 'pausada' : action === 'resume' ? 'retomada' : 'cancelada'} com sucesso.` };
    }

    case 'create_dispatch_campaign': {
      const recipients = (args.recipients as any[] || [])
        .map((r: any) => ({ name: r?.name || '', phone: String(r?.phone || '').replace(/\D/g, '') }))
        .filter((r: any) => r.phone.length >= 10);
      if (!recipients.length) return { result: 'Informe pelo menos um destinatário com telefone válido.' };

      const message = String(args.message || '');
      const mediaType = (args.media_type as string) || 'text';
      const delaySeconds = Number(args.delay_seconds ?? 5) || 5;
      const voiceScript = (args.voice_script as string) || '';
      if (mediaType === 'voice' && !voiceScript) return { result: 'Para disparo com voz IA, informe o roteiro (voice_script).' };

      const followUpsPreview = (args.follow_ups as any[]) || [];
      if (args.confirmed !== true) {
        const mediaLabel: Record<string, string> = {
          text: 'Somente texto', image: 'Imagem + texto', video: 'Vídeo + texto',
          document: 'Documento + texto', audio: 'Áudio (arquivo) + texto', voice: 'Voz IA (ElevenLabs)'
        };
        const lines = [
          '📋 **Resumo do disparo — confirme antes de enviar**',
          '',
          `**1. Campanha:** ${(args.title as string) || 'Disparo via IA'}`,
          `**2. Destinatários (${recipients.length}):** ${recipients.slice(0, 10).map(r => `${r.name || 'Sem nome'} — ${r.phone}`).join(' | ')}${recipients.length > 10 ? ` +${recipients.length - 10}` : ''}`,
          `**3. Mensagem:** ${message || '(vazia)'}`,
          `**4. Formato:** ${mediaLabel[mediaType] || mediaType}${args.media_url ? ` (${args.media_url})` : ''}${mediaType === 'voice' ? `\n   • Roteiro: ${voiceScript}` : ''}`,
          `**5. Intervalo entre envios:** ${delaySeconds}s`,
          followUpsPreview.length ? `**6. Mensagens em sequência:** ${followUpsPreview.length}` : '**6. Mensagens em sequência:** nenhuma',
          `**7. Ao responder:** ${args.ai_agent_id ? 'Agente de IA vinculado' : ''}${args.chatbot_flow_id ? (args.ai_agent_id ? ' + Chatbot' : 'Chatbot vinculado') : ''}${!args.ai_agent_id && !args.chatbot_flow_id ? 'nenhuma automação' : ''}`,
          '',
          'Quer ajustar algo ou posso enviar?',
          '[QUICK_REPLIES:✅ Enviar agora|✍️ Mudar mensagem|🎙️ Usar voz IA|⏱️ Mudar intervalo]'
        ];
        return { result: lines.join('\n') };
      }

      // Sessão de WhatsApp
      let sessionId = args.session_id as string | undefined;
      if (!sessionId) {
        const { data: sessions } = await supabase.from('whatsapp_sessions')
          .select('id, instance_name, status')
          .eq('company_id', companyId)
          .eq('status', 'connected')
          .order('connected_at', { ascending: false });
        if (!sessions?.length) return { result: 'Nenhuma sessão de WhatsApp conectada. Conecte um número antes de disparar.' };
        sessionId = sessions[0].id;
      }

      const { data: campaign, error: campErr } = await supabase.from('dispatch_campaigns')
        .insert({
          company_id: companyId,
          user_id: userId,
          title: (args.title as string) || `Campanha ${new Date().toLocaleString('pt-BR')}`,
          status: 'pending',
          total_recipients: recipients.length,
          sent_count: 0,
          delay_seconds: delaySeconds,
          session_id: sessionId,
          message_template: message,
          media_type: mediaType,
          media_url: (args.media_url as string) || null,
          ai_enabled: !!args.ai_agent_id,
          ai_agent_id: (args.ai_agent_id as string) || null,
          chatbot_enabled: !!args.chatbot_flow_id,
          chatbot_flow_id: (args.chatbot_flow_id as string) || null,
          follow_ups: (args.follow_ups as any[] || []).map((f: any) => ({
            message: f?.message || '',
            media_type: f?.media_type || 'text',
            media_url: f?.media_url || null,
          })),
          voice_ia_script: mediaType === 'voice' ? voiceScript : null,
          voice_ia_mention_names: mediaType === 'voice' ? /@nome/.test(voiceScript) : false,
          voice_ia_voice_id: mediaType === 'voice' ? ((args.voice_id as string) || null) : null,
        })
        .select()
        .single();
      if (campErr) return { result: `Erro ao criar campanha: ${campErr.message}` };

      const campaignId = (campaign as any).id;

      // Voz IA: gera um áudio por destinatário e salva no storage público
      const audioUrls: Record<string, string> = {};
      if (mediaType === 'voice') {
        for (const r of recipients) {
          const text = voiceScript.replace(/@nome/g, r.name || 'amigo');
          const { data: audio, error: ttsErr } = await supabase.functions.invoke('elevenlabs-tts', {
            body: { text, voiceId: (args.voice_id as string) || undefined },
          });
          if (ttsErr) return { result: `Erro ao gerar áudio de voz IA: ${ttsErr.message}` };
          const blob = audio instanceof Blob ? audio : new Blob([audio as any], { type: 'audio/mpeg' });
          const path = `${companyId}/${campaignId}/${r.phone}-${Date.now()}.mp3`;
          const { error: upErr } = await supabase.storage.from('disparos-media')
            .upload(path, blob, { contentType: 'audio/mpeg', upsert: true });
          if (upErr) return { result: `Erro ao salvar áudio: ${upErr.message}` };
          audioUrls[r.phone] = supabase.storage.from('disparos-media').getPublicUrl(path).data.publicUrl;
        }
      }

      const jobs = recipients.map((r: any) => ({
        campaign_id: campaignId,
        company_id: companyId,
        phone: r.phone,
        contact_name: r.name,
        status: 'pending',
        custom_fields: mediaType === 'voice'
          ? {
              media_url: audioUrls[r.phone],
              media_type: 'voice',
              voice_url: audioUrls[r.phone],
              script: voiceScript.replace(/@nome/g, r.name || 'amigo'),
            }
          : null,
      }));
      const { error: jobsErr } = await supabase.from('dispatch_jobs').insert(jobs);
      if (jobsErr) return { result: `Erro ao criar envios: ${jobsErr.message}` };

      supabase.functions.invoke('bulk-dispatch', { body: { campaign_id: campaignId } }).catch(() => {});

      return {
        result: `Disparo "${(campaign as any).title}" iniciado para ${recipients.length} destinatário(s), com ${delaySeconds}s de intervalo${mediaType === 'voice' ? ' e áudio de voz IA personalizado' : ''}.`,
        action: { action: 'navigate', data: { path: '/dashboard/disparos' } }
      };
    }

    case 'send_whatsapp_message': {
      const contactName = args.contact_name as string | undefined;
      let phone = args.phone as string | undefined;
      const msgText = args.message as string;
      const sessionId = args.session_id as string | undefined;

      // If no phone provided, search CRM by contact name
      if (!phone && contactName) {
        const { data: contact } = await supabase.from('clients')
          .select('name, phone, whatsapp')
          .eq('company_id', companyId)
          .ilike('name', `%${contactName}%`)
          .limit(1).single();
        if (contact) {
          phone = contact.whatsapp || contact.phone || undefined;
          if (!phone) return { result: `Contato "${contact.name}" encontrado, mas não possui telefone/WhatsApp cadastrado.` };
        } else {
          return { result: `Contato "${contactName}" não encontrado no CRM. Informe o número diretamente ou verifique o nome.` };
        }
      }

      if (!phone) return { result: 'Informe o nome do contato ou o número de telefone para enviar a mensagem.' };

      // Clean phone number
      const cleanPhone = phone.replace(/\D/g, '');

      let session: any = null;

      if (sessionId) {
        const { data: s } = await supabase.from('whatsapp_sessions')
          .select('id, instance_name, status, phone_number, baileys_server_url, profile_pic_url')
          .eq('id', sessionId)
          .single();
        session = s;
      } else {
        // Find connected sessions for the company
        const { data: activeSessions } = await supabase.from('whatsapp_sessions')
          .select('id, instance_name, status, phone_number, baileys_server_url, profile_pic_url')
          .eq('company_id', companyId)
          .eq('status', 'connected')
          .order('connected_at', { ascending: false });

        if (activeSessions?.length) {
          // If a session ID was provided as an argument, use it
          if (sessionId) {
            session = activeSessions.find(s => s.id === sessionId);
          }
          
          // If no specific session selected yet, check if there's one in the current screen context
          if (!session && screenContext?.elementUnderMouse) {
            try {
              const element = typeof screenContext.elementUnderMouse === 'string' 
                ? JSON.parse(screenContext.elementUnderMouse) 
                : screenContext.elementUnderMouse;
              
              if (element.whatsapp_session_id) {
                session = activeSessions.find(s => s.id === element.whatsapp_session_id);
              }
            } catch (e) { /* ignore parse error */ }
          }

          // If still no session and multiple active, ask the user
          if (!session && activeSessions.length > 1) {
            return {
              result: `Você tem ${activeSessions.length} conexões de WhatsApp ativas. Por qual número deseja enviar a mensagem?`,
              action: { 
                action: 'whatsapp_session_selection', 
                sessions: activeSessions.map(s => ({
                  id: s.id,
                  name: s.instance_name,
                  number: s.phone_number,
                  status: s.status,
                  photo: s.profile_pic_url || 'https://jwddiyuezqrpuakazvgg.supabase.co/storage/v1/object/public/brand-assets/whatsapp-default.png'
                }))
              }
            };
          } else if (!session) {
            session = activeSessions[0];
          }
        }

        if (!session) {
          // Busca novamente sem o filtro de status para dar um feedback melhor
          const { data: allSessions } = await supabase.from('whatsapp_sessions')
            .select('status')
            .eq('company_id', companyId)
            .limit(1);
            
          const msg = allSessions?.length 
            ? "⚠️ Sua sessão de WhatsApp parece estar desconectada. Precisamos reconectar seu aparelho para eu conseguir enviar a mensagem. Quer fazer isso agora?"
            : "⚠️ Seu WhatsApp não está conectado no momento. Precisamos conectar seu aparelho primeiro para eu conseguir enviar a mensagem por ele. Quer fazer isso agora?";

          return {
            result: msg,
            action: { 
              action: 'whatsapp_qr_code_request',
              quickReplies: ['📱 Conectar WhatsApp', '❌ Agora não']
            }
          };
        }
      }




      const baileysUrl = 'https://baileys-server-novo-production.up.railway.app';
      if (!baileysUrl) {
        return { result: '❌ Servidor WhatsApp não configurado. Contate o suporte.' };
      }

      try {
        // Resolve JID (handle Brazilian 9th digit)
        let jid = `${cleanPhone}@s.whatsapp.net`;
        try {
          const checkRes = await fetch(`${baileysUrl}/api/number/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instanceName: session.instance_name, phone: cleanPhone }),
          });
          const checkData = await checkRes.json();
          if (checkData?.exists && checkData?.jid) {
            jid = checkData.jid;
          }
        } catch (e) {
          console.log('[send_whatsapp] JID check failed, using fallback:', e);
        }

        // Send message
        const sendRes = await fetch(`${baileysUrl}/api/message/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instanceName: session.instance_name,
            jid,
            message: { text: msgText },
          }),
        });

        const sendText = await sendRes.text();
        let sendData: any;
        try { sendData = JSON.parse(sendText); } catch { sendData = null; }

        if (sendRes.ok && sendData) {
          return {
            result: `✅ Mensagem enviada com sucesso para ${contactName || cleanPhone} via WhatsApp!`,
            action: { action: 'whatsapp_sent', phone: cleanPhone }
          };
        } else {
          return { result: `❌ Erro ao enviar: ${sendText.substring(0, 200)}` };
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        return { result: `❌ Erro ao enviar mensagem: ${errMsg}` };
      }
    }
    
    // ==================== WHATSAPP SESSIONS ====================
    case 'list_whatsapp_sessions': {
      const { data, error } = await supabase.from('whatsapp_sessions')
        .select('id, instance_name, status, phone_number, profile_pic_url, connected_at')
        .eq('company_id', companyId)
        .order('status', { ascending: true }) // connected first usually if we sort by status string (c < d)
        .order('connected_at', { ascending: false });
        
      if (error) return { result: `Erro ao buscar sessões: ${error.message}` };
      if (!data?.length) return { result: 'Nenhuma sessão de WhatsApp encontrada na sua conta.' };
      
      const cards = data.map((s: any) => ({
        type: 'whatsapp_session',
        title: s.phone_number ? `WhatsApp ${s.phone_number}` : s.instance_name,
        status: s.status === 'connected' ? 'Conectado' : 'Desconectado',
        statusColor: s.status === 'connected' ? 'green' : 'red',
        details: [
          s.instance_name,
          s.connected_at ? `Desde: ${new Date(s.connected_at).toLocaleDateString('pt-BR')}` : ''
        ].filter(Boolean),
        photo: s.profile_pic_url || 'https://jwddiyuezqrpuakazvgg.supabase.co/storage/v1/object/public/brand-assets/whatsapp-default.png'
      }));

      return {
        result: `Encontrei ${data.length} sessões de WhatsApp:\n` + data.map((s: any) => 
          `- ${s.phone_number || s.instance_name}: ${s.status === 'connected' ? '✅ Conectado' : '❌ Desconectado'}`
        ).join('\n'),
        action: { action: 'list_whatsapp_sessions', data, cards }
      };
    }

    // ==================== WHATSAPP ====================
    case 'list_whatsapp_conversations': {
      let query = supabase.from('whatsapp_conversations')
        .select('id, contact_name, contact_phone, last_message, last_message_at, unread_count')
        .eq('company_id', companyId).order('last_message_at', { ascending: false })
        .limit((args.limit as number) || 10);
      if (args.unread_only) query = query.gt('unread_count', 0);
      const { data, error } = await query;
      if (error) return { result: `Erro: ${error.message}` };
      if (!data?.length) return { result: 'Nenhuma conversa encontrada.' };
      return {
        result: `Conversas (${data.length}):\n` + data.map((c: any, i: number) =>
          `${i + 1}. ${c.contact_name || c.contact_phone}${c.unread_count ? ` (${c.unread_count} não lidas)` : ''}`
        ).join('\n'),
        action: { action: 'list_conversations', data, navigate: '/dashboard/crm-whatsapp' }
      };
    }

    // ==================== BOOKING ====================
    case 'list_booking_links': {
      const { data, error } = await supabase.from('booking_links')
        .select('id, title, link_slug, duration_minutes, is_active')
        .eq('company_id', companyId).order('title');
      if (error) return { result: `Erro: ${error.message}` };
      if (!data?.length) return { result: 'Nenhum link de agendamento.' };
      return {
        result: `Links (${data.length}):\n` + data.map((b: any, i: number) =>
          `${i + 1}. "${b.title}" - ${b.duration_minutes}min - ${b.is_active ? 'Ativo' : 'Inativo'}`
        ).join('\n'),
        action: { action: 'list_booking', data }
      };
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
      const summaryCards = [
        { type: 'summary', title: 'Contatos', value: String(contacts.count || 0), extra: { color: '#8b5cf6' }, link: '/dashboard/cadastros' },
        { type: 'summary', title: 'Tarefas pendentes', value: String(pendingTasks.count || 0), extra: { color: '#f59e0b' }, link: '/dashboard/agenda' },
        { type: 'summary', title: 'Propostas enviadas', value: String(proposals.count || 0), extra: { color: '#f97316' } },
        { type: 'summary', title: 'Documentos', value: String(docs.count || 0), extra: { color: '#64748b' }, link: '/dashboard/drive' },
        { type: 'summary', title: 'Conversas não lidas', value: String(unreadChats.count || 0), extra: { color: '#22c55e' }, link: '/dashboard/crm-whatsapp' },
        { type: 'summary', title: 'Eventos hoje', value: String(todayEvents.data?.length || 0), extra: { color: '#6366f1' }, link: '/dashboard/agenda' },
      ];
      return {
        result: [
          `📊 Resumo do dia:`,
          `👥 Contatos: ${contacts.count || 0}`,
          `📋 Tarefas pendentes: ${pendingTasks.count || 0}`,
          `📄 Propostas enviadas: ${proposals.count || 0}`,
          `📁 Documentos: ${docs.count || 0}`,
          `💬 Conversas não lidas: ${unreadChats.count || 0}`,
          todayEvents.data?.length ? `\n📅 Eventos hoje:\n${evList}` : '📅 Nenhum evento hoje.',
        ].join('\n'),
        action: { action: 'dashboard_summary', cards: summaryCards }
      };
    }

     // ==================== IN-PERSON MEETING ====================
     case 'start_in_person_meeting': {
       return {
         result: `Entendido! Estou abrindo a ferramenta de gravação de reunião presencial para você${args.title ? ` com o título "${args.title}"` : ''}.`,
         action: { action: 'start_in_person_meeting', title: args.title }
       };
     }
 
    // ==================== REQUEST FILE ====================
    case 'request_file': {
      return {
        result: args.message as string,
        action: { action: 'request_file', purpose: args.purpose, folder_name: args.folder_name }
      };
    }

    // ==================== IMPORT CONTACTS ====================
    case 'import_contacts': {
      const targetMap: Record<string, string> = {
        'cadastros': '/dashboard/cadastros',
        'email_marketing': '/dashboard/email',
        'disparos': '/dashboard/disparos',
      };
      return {
        result: `Preparando importação para ${args.target}...`,
        action: { action: 'import_contacts', path: targetMap[(args.target as string)] || '/dashboard/cadastros', target: args.target, fileUrl, fileName }
      };
    }

    // ==================== CONNECT WHATSAPP ====================
    case 'connect_whatsapp': {
      // Check for connected sessions to show selection
      const { data: existingSessions } = await supabase.from('whatsapp_sessions')
        .select('id, instance_name, status, phone_number, connected_at, profile_pic_url')
        .eq('company_id', companyId)
        .order('connected_at', { ascending: false });
      
      const shouldForce = args.force === true;

      // If there are sessions and we're not forcing a NEW one, show selection buttons
      if (existingSessions?.length && !shouldForce) {
        return {
          result: `📱 Identifiquei que você já possui sessões de WhatsApp. Qual delas você gostaria de gerenciar ou usar como principal?\n\nOu, se preferir, posso criar uma **nova conexão** agora.`,
          action: { 
            action: 'whatsapp_session_selection', 
            sessions: existingSessions.map(s => ({
              id: s.id,
              name: s.instance_name,
              number: s.phone_number,
              status: s.status,
              photo: s.profile_pic_url || 'https://jwddiyuezqrpuakazvgg.supabase.co/storage/v1/object/public/brand-assets/whatsapp-default.png'
            }))
          }
        };
      }

      const BAILEYS_URL_ENV = 'https://baileys-server-novo-production.up.railway.app';
      const SUPABASE_URL_ENV = Deno.env.get('SUPABASE_URL') || '';

      const instanceName = `assistant-${companyId.substring(0, 8)}-${Date.now()}`;
      const webhookSecret = crypto.randomUUID();
      const webhookUrl = `${SUPABASE_URL_ENV}/functions/v1/whatsapp-webhook`;

      console.log(`[connect_whatsapp] Creating session for company ${companyId}, user ${userId}, instance ${instanceName}`);

      const { data: session, error: sessionErr } = await supabase
        .from('whatsapp_sessions')
        .insert({
          company_id: companyId,
          user_id: userId,
          instance_name: instanceName,
          status: 'connecting',
          webhook_secret: webhookSecret,
          baileys_server_url: BAILEYS_URL_ENV,
          settings: { webhook_url: webhookUrl, created_from: 'ai-assistant', forced: shouldForce }
        })
        .select()
        .single();

      if (sessionErr) {
        console.error('[connect_whatsapp] session creation error:', sessionErr);
        return { result: `❌ Erro ao criar sessão no banco de dados: ${sessionErr.message}` };
      }

      console.log(`[connect_whatsapp] Session created: ${session.id}. Contacting Baileys server...`);

      // Create instance on Baileys server
      let qrCode: string | null = null;
      try {
        const baileysRes = await fetch(`${BAILEYS_URL_ENV}/api/instance/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: session.id, instanceName, webhookUrl, webhookSecret }),
        });
        
        if (!baileysRes.ok) {
           const errText = await baileysRes.text();
           console.error(`[connect_whatsapp] Baileys server returned ${baileysRes.status}: ${errText}`);
           return { result: `❌ O servidor de WhatsApp retornou um erro: ${baileysRes.status}. Tente novamente em alguns segundos.` };
        }

        const baileysData = await baileysRes.json();
        console.log('[connect_whatsapp] Baileys response:', JSON.stringify(baileysData));
        
        if (baileysData?.qrCode) {
          qrCode = baileysData.qrCode;
          await supabase.from('whatsapp_sessions').update({ qr_code: qrCode }).eq('id', session.id);
        } else if (baileysData?.status === 'error') {
          return { result: `❌ Erro no servidor de WhatsApp: ${baileysData.message || 'Erro desconhecido'}` };
        }
      } catch (e) {
        console.error('[connect_whatsapp] Baileys fetch error:', e);
        return { result: `❌ Não foi possível alcançar o servidor de WhatsApp no momento. Verifique sua conexão ou tente novamente mais tarde.` };
      }

      // If no QR yet, try fetching it one more time with a small wait
      if (!qrCode) {
        console.log('[connect_whatsapp] QR not in create response, waiting 3s to fetch...');
        await new Promise(r => setTimeout(r, 3000));
        try {
          const qrRes = await fetch(`${BAILEYS_URL_ENV}/api/instance/qr?instanceName=${instanceName}`);
          if (qrRes.ok) {
            const qrData = await qrRes.json();
            if (qrData?.qrCode) {
              qrCode = qrData.qrCode;
              await supabase.from('whatsapp_sessions').update({ qr_code: qrCode }).eq('id', session.id);
            }
          }
        } catch (e) {
          console.error('[connect_whatsapp] QR fetch error:', e);
        }
      }

      console.log(`[connect_whatsapp] Final QR status: ${qrCode ? 'Generated' : 'Not generated'}`);

      return {
        result: qrCode 
          ? `📱 Escaneie o QR Code abaixo com seu WhatsApp para conectar!`
          : `⏳ Estou preparando a conexão para você, leva alguns segundinhos. Como ainda não recebi o código do servidor, por favor, clique no botão de atualizar ou me peça para tentar novamente em um momento.`,
        action: { 
          action: 'whatsapp_qr_code', 
          qrCode, 
          sessionId: session.id 
        }
      };
    }

    // ==================== CREATE AUTOMATION ====================
    case 'create_automation': {
      const triggerType = (args.trigger_type as string) || 'manual';
      const actions = (args.actions as any[]) || [];
      
      // Map trigger_type to valid block types from AUTOMATION_BLOCKS
      const triggerTypeMap: Record<string, string> = {
        'new_client': 'new_client',
        'new_event': 'schedule',
        'form_submit': 'webhook',
        'tag_added': 'client_updated',
        'manual': 'webhook',
        'webhook': 'webhook',
        'schedule': 'schedule',
        'client_updated': 'client_updated',
        'proposal_status': 'proposal_status',
      };
      
      // Map action types to valid block types
      const actionTypeMap: Record<string, string> = {
        'send_email': 'send_email',
        'send_whatsapp': 'send_whatsapp',
        'create_task': 'create_task',
        'add_tag': 'update_client',
        'wait': 'delay',
        'notify': 'send_email',
        'create_client': 'create_client',
        'update_client': 'update_client',
        'http_request': 'http_request',
        'create_proposal': 'create_proposal',
        'create_receipt': 'create_receipt',
        'condition': 'condition',
      };

      // Default configs per block type
      const defaultConfigs: Record<string, any> = {
        'webhook': { method: 'POST', path: '' },
        'new_client': { clientType: 'any' },
        'client_updated': { fields: [] },
        'schedule': { cron: '0 9 * * *' },
        'proposal_status': { status: 'approved' },
        'send_email': { templateId: '', subject: '', to: '' },
        'send_whatsapp': { message: '', to: '' },
        'create_task': { title: '', dueDate: '' },
        'update_client': { fields: {} },
        'create_client': { fieldMapping: {} },
        'http_request': { url: '', method: 'POST', headers: {}, body: '' },
        'create_proposal': { templateId: '' },
        'create_receipt': { title: '', amount: '', payment_method: 'PIX', send_method: 'none', description: '' },
        'delay': { duration: 5, unit: 'minutes' },
        'condition': { field: '', operator: 'equals', value: '' },
      };

      // Label map
      const labelMap: Record<string, string> = {
        'webhook': 'Webhook',
        'new_client': 'Novo Cliente',
        'client_updated': 'Cliente Atualizado',
        'schedule': 'Agendamento',
        'proposal_status': 'Status Proposta',
        'send_email': 'Enviar Email',
        'send_whatsapp': 'Enviar WhatsApp',
        'create_task': 'Criar Tarefa',
        'update_client': 'Atualizar Cliente',
        'create_client': 'Criar Cliente',
        'http_request': 'Requisição HTTP',
        'create_proposal': 'Criar Ordem de Serviço',
        'create_receipt': 'Criar Recibo',
        'delay': 'Aguardar',
        'condition': 'Condição',
      };

      const nodes: any[] = [];
      const edges: any[] = [];
      
      // Resolve trigger type to a valid block type
      const resolvedTrigger = triggerTypeMap[triggerType] || 'webhook';
      
      const triggerId = crypto.randomUUID();
      nodes.push({
        id: triggerId,
        type: resolvedTrigger,
        position: { x: 250, y: 50 },
        data: { 
          label: labelMap[resolvedTrigger] || 'Gatilho',
          config: { ...defaultConfigs[resolvedTrigger] }
        }
      });

      let prevNodeId = triggerId;
      let yPos = 200;
      
      for (const action of actions) {
        const nodeId = crypto.randomUUID();
        const resolvedAction = actionTypeMap[action.type] || action.type || 'send_email';
        const mergedConfig = { ...defaultConfigs[resolvedAction], ...(action.config || {}) };
        
        nodes.push({
          id: nodeId,
          type: resolvedAction,
          position: { x: 250, y: yPos },
          data: {
            label: labelMap[resolvedAction] || action.type || 'Ação',
            config: mergedConfig
          }
        });
        edges.push({
          id: `e-${prevNodeId}-${nodeId}`,
          source: prevNodeId,
          target: nodeId
        });
        prevNodeId = nodeId;
        yPos += 150;
      }

      const { data: automation, error } = await supabase.from('automations').insert({
        name: args.name as string,
        description: (args.description as string) || null,
        trigger_type: resolvedTrigger,
        nodes,
        edges,
        is_active: false,
        company_id: companyId,
        created_by: userId,
      }).select('id, name').single();

      if (error) return { result: `❌ Erro ao criar automação: ${error.message}` };
      
      return {
        result: `✅ Automação "${automation.name}" criada com ${nodes.length} blocos! Está desativada por padrão - ative quando estiver pronta.`,
        action: { action: 'automation_created', data: automation, navigate: '/dashboard/automacoes' }
      };
    }

    // ==================== CREATE CHATBOT ====================
    case 'create_chatbot': {
      const trigger = (args.trigger as string) || 'whatsapp_channel';
      const steps = (args.steps as any[]) || [];
      
      const nodes: any[] = [];
      const edgesArr: any[] = [];

      // Trigger node
      const triggerId = crypto.randomUUID();
      nodes.push({
        id: triggerId,
        type: 'trigger',
        subType: trigger,
        position: { x: 250, y: 50 },
        data: { label: 'Gatilho', config: { triggerType: trigger } }
      });

      let prevNodeId = triggerId;
      let yPos = 200;

      for (const step of steps) {
        const nodeId = crypto.randomUUID();
        const nodeType = step.type === 'buttons' ? 'message' : 
                         step.type === 'wait_response' ? 'delay' :
                         step.type === 'condition' ? 'condition' :
                         step.type === 'transfer_human' || step.type === 'transfer_ai_agent' ? 'action' :
                         step.type === 'set_variable' ? 'action' : 'message';
        const subType = step.type === 'buttons' ? 'buttons' : 
                        step.type === 'wait_response' ? 'wait_response' : 
                        step.type || 'text';

        nodes.push({
          id: nodeId,
          type: nodeType,
          subType,
          position: { x: 250, y: yPos },
          data: { 
            label: step.content || step.type,
            config: {
              message: step.content,
              buttons: step.options?.map((opt: string, i: number) => ({ id: `btn-${i}`, label: opt })) || [],
            }
          }
        });
        edgesArr.push({
          id: `e-${prevNodeId}-${nodeId}`,
          source: prevNodeId,
          target: nodeId
        });
        prevNodeId = nodeId;
        yPos += 150;
      }

      const { data: chatbot, error } = await supabase.from('chatbot_flows').insert({
        name: args.name as string,
        description: (args.description as string) || null,
        nodes,
        edges: edgesArr,
        trigger_config: { triggerType: trigger },
        is_active: false,
        company_id: companyId,
        created_by: userId,
      }).select('id, name').single();

      if (error) return { result: `❌ Erro ao criar chatbot: ${error.message}` };
      
      return {
        result: `✅ Chatbot "${chatbot.name}" criado com ${nodes.length} blocos! Está desativado por padrão - ative quando estiver pronto.`,
        action: { action: 'chatbot_created', data: chatbot, navigate: '/dashboard/chatbot-builder' }
      };
    }

    // ==================== CREATE AI AGENT ====================
    case 'create_ai_agent': {
      const { data: agent, error } = await supabase.from('ai_agents').insert({
        name: args.name as string,
        description: (args.description as string) || null,
        personality: (args.personality as string) || 'Assistente profissional e amigável',
        instructions: (args.instructions as string) || 'Responda de forma clara e útil.',
        model: (args.model as string) || 'google/gemini-3-flash-preview',
        is_active: true,
        company_id: companyId,
        created_by: userId,
        settings: { temperature: 0.7, maxResponseChars: 500 },
      }).select('id, name').single();

      if (error) return { result: `❌ Erro ao criar agente: ${error.message}` };
      
      return {
        result: `✅ Agente de IA "${agent.name}" criado com sucesso! Você pode editá-lo e ativá-lo no WhatsApp.`,
        action: { action: 'agent_created', data: agent, navigate: `/dashboard/bot-ia/editar/${agent.id}` }
      };
    }

    // ==================== BULK CREATE CONTACTS ====================
    case 'bulk_create_contacts': {
      const contacts = args.contacts as Array<{ name: string; email?: string; phone?: string; company_name?: string; notes?: string; client_type?: string }>;
      if (!contacts?.length) return { result: 'Nenhum contato fornecido para cadastrar.' };

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Insert in batches of 50
      const batchSize = 50;
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize).map(c => ({
          name: c.name,
          email: c.email || null,
          phone: c.phone || null,
          company_name: c.company_name || null,
          notes: c.notes || null,
          client_type: c.client_type || 'cliente',
          company_id: companyId,
          created_by: userId,
          status: 'active',
        }));

        const { data, error } = await supabase.from('clients').insert(batch).select('id');
        if (error) {
          errorCount += batch.length;
          errors.push(error.message);
        } else {
          successCount += data?.length || 0;
        }
      }

      let resultMsg = `✅ ${successCount} contato(s) cadastrado(s) com sucesso em Cadastros!`;
      if (errorCount > 0) resultMsg += `\n⚠️ ${errorCount} falha(s): ${errors[0]}`;

      return {
        result: resultMsg,
        action: { action: 'contacts_imported', count: successCount, navigate: '/dashboard/cadastros' }
      };
    }

    // ==================== PARSE UPLOADED FILE ====================
    case 'parse_uploaded_file': {
      if (!fileUrl || !fileName) {
        return { result: 'Nenhum arquivo anexado. Peça ao usuário para anexar o arquivo primeiro.', action: { action: 'request_file', purpose: 'general' } };
      }

      try {
        const ext = fileName.split('.').pop()?.toLowerCase() || '';

        // Download file
        const fileRes = await fetch(fileUrl);
        if (!fileRes.ok) return { result: `Erro ao baixar arquivo: ${fileRes.status}` };

        if (ext === 'csv' || ext === 'txt') {
          const text = await fileRes.text();
          // Return first 5000 chars to avoid token limits
          const preview = text.substring(0, 5000);
          const lineCount = text.split('\n').length;
          return {
            result: `Arquivo "${fileName}" lido com sucesso (${lineCount} linhas).\n\nConteúdo:\n${preview}${text.length > 5000 ? '\n... (truncado)' : ''}`,
          };
        }

        if (ext === 'xlsx' || ext === 'xls') {
          // For XLSX, we need to parse the binary data
          // Use a simple approach: fetch as arrayBuffer and parse
          const buffer = await fileRes.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          
          // Simple XLSX parser - extract shared strings and sheet data
          // Using JSZip-like approach to read the xlsx (which is a zip file)
          const { default: JSZip } = await import('https://esm.sh/jszip@3.10.1');
          const zip = await JSZip.loadAsync(bytes);

          // Read shared strings
          const sharedStringsFile = zip.file('xl/sharedStrings.xml');
          let sharedStrings: string[] = [];
          if (sharedStringsFile) {
            const ssXml = await sharedStringsFile.async('string');
            const siMatches = ssXml.match(/<si>[\s\S]*?<\/si>/g) || [];
            sharedStrings = siMatches.map(si => {
              const tMatches = si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
              return tMatches.map(t => t.replace(/<[^>]+>/g, '')).join('');
            });
          }

          // Read first sheet
          const sheet1File = zip.file('xl/worksheets/sheet1.xml');
          if (!sheet1File) return { result: 'Arquivo XLSX não contém planilhas.' };

          const sheetXml = await sheet1File.async('string');
          const rowMatches = sheetXml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || [];

          const rows: string[][] = [];
          for (const rowXml of rowMatches) {
            const cellMatches = rowXml.match(/<c[^>]*>[\s\S]*?<\/c>|<c[^\/]*\/>/g) || [];
            const row: string[] = [];
            for (const cellXml of cellMatches) {
              const isSharedString = cellXml.includes('t="s"');
              const valueMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/);
              if (valueMatch) {
                if (isSharedString) {
                  const idx = parseInt(valueMatch[1]);
                  row.push(sharedStrings[idx] || '');
                } else {
                  row.push(valueMatch[1]);
                }
              } else {
                row.push('');
              }
            }
            if (row.some(c => c.trim())) rows.push(row);
          }

          if (!rows.length) return { result: 'Planilha vazia ou não foi possível ler os dados.' };

          // Format as CSV-like text
          const maxRows = Math.min(rows.length, 100);
          const csvText = rows.slice(0, maxRows).map(r => r.join(' | ')).join('\n');
          
          return {
            result: `Arquivo "${fileName}" lido com sucesso (${rows.length} linhas, ${rows[0]?.length || 0} colunas).\n\nColunas detectadas: ${rows[0]?.join(', ') || 'N/A'}\n\nDados:\n${csvText}${rows.length > maxRows ? `\n... (mais ${rows.length - maxRows} linhas)` : ''}`,
          };
        }

        // Other file types
        const text = await fileRes.text();
        return {
          result: `Arquivo "${fileName}" (${ext}) - Conteúdo:\n${text.substring(0, 3000)}`,
        };
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        return { result: `Erro ao processar arquivo: ${errMsg}` };
      }
    }

    // ==================== LIST STYLES ====================
    case 'list_styles': {
      const category = args.category as string;
      let query = supabase.from('marketplace_styles')
        .select('id, name, description, category, preview_images, tags, is_free, style_config')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(12);
      if (category) query = query.eq('category', category);
      const { data, error } = await query;
      if (error) return { result: `Erro: ${error.message}` };
      if (!data?.length) return { result: 'Nenhum estilo disponível no momento.' };
      
      const styleList = data.map((s: any, i: number) => {
        const previewCount = s.preview_images?.length || 0;
        return `${i + 1}. "${s.name}" (${s.category})${s.description ? ` - ${s.description}` : ''} | ${previewCount} refs | ${s.is_free ? 'Grátis' : 'Premium'}`;
      }).join('\n');
      
      return {
        result: `🎨 Estilos disponíveis no ElloContent IA (${data.length}):\n\n${styleList}`,
        action: { action: 'list_styles', styles: data.map((s: any) => ({ id: s.id, name: s.name, category: s.category, description: s.description, preview_images: s.preview_images, is_free: s.is_free, tags: s.tags })) }
      };
    }

    // ==================== GET BRAND ASSETS ====================
    case 'get_brand_assets': {
      const cat = (args.category as string) || 'logo';
      let query = supabase.from('brand_assets')
        .select('id, name, file_url, category, tags')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (cat !== 'all') query = query.eq('category', cat);
      const { data, error } = await query;
      if (error) return { result: `Erro: ${error.message}` };
      if (!data?.length) {
        return { 
          result: cat === 'logo' 
            ? '📌 Nenhum logo encontrado na sua biblioteca de marca. Você pode enviar seu logo aqui no chat ou fazer upload na Biblioteca de Marca (/dashboard/brand-assets).'
            : `Nenhum asset do tipo "${cat}" encontrado.`,
          action: { action: 'no_brand_assets', category: cat }
        };
      }
      
      const assetList = data.map((a: any, i: number) => `${i + 1}. "${a.name}" (${a.category}) - ${a.file_url}`).join('\n');
      return {
        result: `🏢 Assets da marca (${data.length}):\n${assetList}`,
        action: { action: 'brand_assets_found', assets: data }
      };
    }

    // ==================== GENERATE IMAGE ====================
    case 'generate_image': {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) return { result: 'Erro: LOVABLE_API_KEY não configurada.' };

      const prompt = args.prompt as string;
      const style = (args.style as string) || 'social_post';
      const aspectRatio = (args.aspect_ratio as string) || '1:1';
      const referenceUrls = (args.reference_image_urls as string[]) || [];
      const logoUrl = args.logo_url as string;
      const brandColors = (args.brand_colors as string[]) || [];

      const styleGuide: Record<string, string> = {
        social_post: 'Instagram social media post, modern clean design, professional',
        story: 'Instagram story format, vertical, eye-catching, bold text overlay',
        banner: 'Web banner, wide format, professional business design',
        thumbnail: 'YouTube thumbnail style, bold text, high contrast, attention-grabbing',
        logo: 'Minimalist logo design, clean lines, professional, on white background',
        general: 'High quality professional image',
      };

      let fullPrompt = `${prompt}. Style: ${styleGuide[style] || styleGuide.general}. Aspect ratio: ${aspectRatio}. High resolution, professional quality.`;
      
      if (brandColors.length > 0) {
        fullPrompt += ` Use these brand colors as the primary palette: ${brandColors.join(', ')}.`;
      }
      if (logoUrl) {
        fullPrompt += ` Include the company logo prominently in the design.`;
      }

      console.log(`🎨 [AI-ASSISTANT] Generating image with ${referenceUrls.length} refs, logo=${!!logoUrl}, colors=${brandColors.length}: ${fullPrompt.substring(0, 100)}...`);

      // Helper: proxy external URL to base64
      async function proxyToBase64(url: string): Promise<string | null> {
        try {
          console.log(`[proxyToBase64] Fetching: ${url.substring(0, 100)}...`);
          const res = await fetch(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'image/*,*/*' },
            redirect: 'follow',
          });
          if (!res.ok) { console.warn(`[proxyToBase64] Failed ${url}: ${res.status}`); return null; }
          const contentType = res.headers.get('content-type') || 'image/jpeg';
          if (contentType.includes('text/html')) { console.warn(`[proxyToBase64] Got HTML instead of image for ${url}`); return null; }
          const buf = await res.arrayBuffer();
          const bytes = new Uint8Array(buf);
          console.log(`[proxyToBase64] Got ${bytes.length} bytes, type=${contentType}`);
          // Convert to base64 in chunks to avoid call stack overflow
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
            binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
          }
          const base64 = btoa(binary);
          return `data:${contentType};base64,${base64}`;
        } catch (e) { console.warn(`[proxyToBase64] Error ${url}:`, e); return null; }
      }

      try {
        const imageModel = 'google/gemini-3.1-flash-image-preview';
        
        // Build message content - include reference images if provided
        const messageContent: any[] = [{ type: 'text', text: fullPrompt }];
        
        // Add reference style images (max 3, proxy to base64 for external URLs)
        const refsToUse = referenceUrls.slice(0, 3);
        for (const refUrl of refsToUse) {
          if (refUrl && refUrl.startsWith('http')) {
            // Check if it's a Supabase URL (same project) — can be used directly
            const isSupabaseUrl = refUrl.includes('jwddiyuezqrpuakazvgg.supabase.co');
            let finalUrl = refUrl;
            if (!isSupabaseUrl) {
              console.log(`🔄 [Image Gen] Proxying external ref: ${refUrl.substring(0, 80)}...`);
              const proxied = await proxyToBase64(refUrl);
              if (proxied) {
                finalUrl = proxied;
              } else {
                console.warn(`⚠️ [Image Gen] Skipping unreachable ref: ${refUrl.substring(0, 80)}`);
                continue;
              }
            }
            messageContent.push({
              type: 'image_url',
              image_url: { url: finalUrl }
            });
          }
        }
        
        // Add logo if provided (also proxy if external)
        if (logoUrl) {
          let finalLogoUrl = logoUrl;
          const isSupabaseLogo = logoUrl.includes('jwddiyuezqrpuakazvgg.supabase.co');
          if (!isSupabaseLogo && logoUrl.startsWith('http')) {
            const proxied = await proxyToBase64(logoUrl);
            if (proxied) finalLogoUrl = proxied;
          }
          messageContent.push({
            type: 'image_url',
            image_url: { url: finalLogoUrl }
          });
        }

        const hasMedia = messageContent.length > 1;

        console.log(`🚀 [Image Gen] Calling AI gateway with ${messageContent.length} parts (hasMedia=${hasMedia})`);

        const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: imageModel,
            messages: [{
              role: 'user',
              content: hasMedia ? messageContent : fullPrompt
            }],
            modalities: ['image', 'text'],
          }),
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          console.error('[Image Gen] AI error:', aiRes.status, errText);
          if (aiRes.status === 429) return { result: 'Limite de requisições atingido. Tente novamente em alguns segundos.' };
          if (aiRes.status === 402) return { result: 'Créditos insuficientes para gerar imagem.' };
          return { result: `Erro ao gerar imagem: ${aiRes.status} - ${errText.substring(0, 200)}` };
        }

        const aiData = await aiRes.json();
        const imageBase64 = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!imageBase64) {
          console.error('[Image Gen] No image in response:', JSON.stringify(aiData).substring(0, 500));
          return { result: 'Não foi possível gerar a imagem. Tente reformular o pedido ou simplificar a descrição.' };
        }

        // Upload to storage
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const genFileName = `ai-generated/${companyId}/${Date.now()}.png`;

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const sbClient = createClient(supabaseUrl, supabaseKey);

        const { error: uploadError } = await sbClient.storage
          .from('brand-assets')
          .upload(genFileName, imageBytes, { contentType: 'image/png', upsert: true });

        if (uploadError) {
          console.error('[Image Gen] Upload error:', uploadError);
          return {
            result: '✅ Imagem gerada com sucesso pelo ElloContent IA!',
            action: { action: 'image_generated', imageUrl: imageBase64, style, aspectRatio }
          };
        }

        const { data: urlData } = sbClient.storage.from('brand-assets').getPublicUrl(genFileName);
        const publicUrl = urlData.publicUrl;

        // Log usage
        const usage = aiData.usage || {};
        const cost = ((usage.prompt_tokens || 0) / 1000) * 0.0004 + ((usage.completion_tokens || 0) / 1000) * 0.0016;
        logUsage({
          service_type: 'lovable_ai', action: 'image_generation', model: imageModel,
          input_tokens: usage.prompt_tokens || 0, output_tokens: usage.completion_tokens || 0,
          total_cost: cost, user_id: userId, company_id: companyId,
          metadata: { style, aspect_ratio: aspectRatio, has_references: refsToUse.length > 0, has_logo: !!logoUrl, has_brand_colors: brandColors.length > 0 },
        });

        console.log(`✅ [Image Gen] Generated: ${publicUrl}`);

        return {
          result: `✅ Imagem gerada com sucesso pelo ElloContent IA! A imagem foi salva nos seus assets.`,
          action: { action: 'image_generated', imageUrl: publicUrl, style, aspectRatio }
        };
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error('[Image Gen] Error:', errMsg);
        return { result: `Erro ao gerar imagem: ${errMsg}` };
      }
    }

    // ==================== GENERATE CHART ====================
    case 'generate_chart': {
      const chartType = (args.chart_type as string) || 'bar';
      const title = (args.title as string) || 'Gráfico';
      const description = (args.description as string) || '';
      const dataSource = (args.data_source as string) || 'custom';
      const period = (args.period as string) || '30d';
      const groupBy = (args.group_by as string) || 'day';
      const customData = args.custom_data as any[] | undefined;
      const colors = (args.colors as string[]) || [];
      const seriesNames = (args.series_names as string[]) || [];

      // Calculate date range
      const periodDays: Record<string, number> = { '7d': 7, '15d': 15, '30d': 30, '90d': 90, '12m': 365 };
      const days = periodDays[period] || 30;
      const startDate = new Date(Date.now() - days * 86400000).toISOString();

      let chartData: any[] = [];

      if (dataSource === 'custom' && customData) {
        chartData = customData;
      } else {
        // Query real data based on source
        const tableMap: Record<string, { table: string; dateCol: string; extraSelect?: string }> = {
          contacts: { table: 'clients', dateCol: 'created_at' },
          events: { table: 'calendar_events', dateCol: 'start_date', extraSelect: 'event_type' },
          tasks: { table: 'calendar_events', dateCol: 'start_date', extraSelect: 'status' },
          proposals: { table: 'proposals', dateCol: 'created_at', extraSelect: 'status' },
          emails: { table: 'sent_emails', dateCol: 'sent_at' },
          conversations: { table: 'ycloud_conversations', dateCol: 'created_at' },
          services: { table: 'company_services', dateCol: 'created_at', extraSelect: 'category' },
          automations: { table: 'automations', dateCol: 'created_at' },
          receipts: { table: 'receipts', dateCol: 'created_at' },
        };

        const config = tableMap[dataSource];
        if (!config) {
          return { result: `Fonte de dados "${dataSource}" não suportada.` };
        }

        let selectFields = `id, ${config.dateCol}`;
        if (config.extraSelect) selectFields += `, ${config.extraSelect}`;

        // For tasks, filter event_type
        let query = supabase.from(config.table)
          .select(selectFields)
          .eq('company_id', companyId)
          .gte(config.dateCol, startDate)
          .order(config.dateCol, { ascending: true });

        if (dataSource === 'tasks') {
          query = query.eq('event_type', 'reminder');
        }

        const { data: rawData, error } = await query;
        if (error) return { result: `Erro ao buscar dados: ${error.message}` };

        const records = rawData || [];

        if (groupBy === 'status' || groupBy === 'type' || groupBy === 'category') {
          // Group by categorical field
          const field = config.extraSelect || 'status';
          const groups: Record<string, number> = {};
          for (const r of records) {
            const key = (r as any)[field] || 'Outro';
            groups[key] = (groups[key] || 0) + 1;
          }
          chartData = Object.entries(groups).map(([name, value]) => ({ name, value }));
        } else {
          // Group by time
          const buckets: Record<string, number> = {};
          const formatDate = (d: Date) => {
            if (groupBy === 'month') return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
            if (groupBy === 'week') {
              const weekStart = new Date(d);
              weekStart.setDate(d.getDate() - d.getDay());
              return weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            }
            return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          };

          // Pre-fill buckets for continuous timeline
          for (let i = 0; i < days; i++) {
            const date = new Date(Date.now() - (days - 1 - i) * 86400000);
            const key = formatDate(date);
            if (groupBy === 'day') buckets[key] = 0;
            else if (!buckets[key]) buckets[key] = 0;
          }

          for (const r of records) {
            const date = new Date((r as any)[config.dateCol]);
            const key = formatDate(date);
            buckets[key] = (buckets[key] || 0) + 1;
          }
          chartData = Object.entries(buckets).map(([name, value]) => ({ name, value }));
        }
      }

      const totalItems = chartData.reduce((sum, d) => sum + (d.value || 0), 0);

      return {
        result: `📊 Gráfico "${title}" gerado com ${chartData.length} pontos de dados (total: ${totalItems}).${description ? ` ${description}` : ''}`,
        action: {
          action: 'chart_generated',
          chart: {
            type: chartType,
            title,
            description,
            data: chartData,
            colors: colors.length > 0 ? colors : undefined,
            seriesNames: seriesNames.length > 0 ? seriesNames : undefined,
          }
        }
      };
    }

    // ==================== GENERATE PDF ====================
    case 'generate_pdf': {
      const title = args.title as string;
      const content = args.content as string;
      const docType = (args.document_type as string) || 'outro';
      const parties = args.parties as Array<{ name: string; role?: string; document?: string; address?: string }> | undefined;
      const values = args.values as { total?: number; currency?: string; payment_terms?: string } | undefined;

      const docTypeLabels: Record<string, string> = {
        contrato: 'CONTRATO', proposta: 'PROPOSTA COMERCIAL', resumo: 'RESUMO',
        relatorio: 'RELATÓRIO', carta: 'CARTA', outro: 'DOCUMENTO',
      };
      const docLabel = docTypeLabels[docType] || 'DOCUMENTO';

      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

      // Build HTML for the PDF
      let partiesHtml = '';
      if (parties?.length) {
        partiesHtml = '<div style="margin:24px 0;padding:16px;background:#f8f9fa;border-radius:8px;border:1px solid #e9ecef;">';
        partiesHtml += '<h3 style="margin:0 0 12px;font-size:14px;color:#495057;text-transform:uppercase;letter-spacing:1px;">Partes Envolvidas</h3>';
        for (const p of parties) {
          partiesHtml += `<div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #dee2e6;">`;
          partiesHtml += `<strong style="color:#212529;">${p.name}</strong>`;
          if (p.role) partiesHtml += ` <span style="color:#6c757d;font-size:12px;">(${p.role})</span>`;
          if (p.document) partiesHtml += `<br/><span style="font-size:12px;color:#6c757d;">Doc: ${p.document}</span>`;
          if (p.address) partiesHtml += `<br/><span style="font-size:12px;color:#6c757d;">${p.address}</span>`;
          partiesHtml += '</div>';
        }
        partiesHtml += '</div>';
      }

      let valuesHtml = '';
      if (values?.total) {
        const currency = values.currency || 'BRL';
        const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(values.total);
        valuesHtml = `<div style="margin:24px 0;padding:16px;background:#eef2ff;border-radius:8px;border:1px solid #c7d2fe;">`;
        valuesHtml += `<h3 style="margin:0 0 8px;font-size:14px;color:#4338ca;">Valores</h3>`;
        valuesHtml += `<p style="font-size:22px;font-weight:bold;color:#312e81;margin:0;">${formatted}</p>`;
        if (values.payment_terms) valuesHtml += `<p style="font-size:12px;color:#6366f1;margin:4px 0 0;">${values.payment_terms}</p>`;
        valuesHtml += '</div>';
      }

      // Convert content paragraphs
      const contentHtml = content.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '<br/>';
        // Detect section headers (ALL CAPS or lines ending with :)
        if (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 80) {
          return `<h3 style="margin:20px 0 8px;font-size:14px;font-weight:bold;color:#1a1a2e;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e9ecef;padding-bottom:6px;">${trimmed}</h3>`;
        }
        if (trimmed.endsWith(':') && trimmed.length < 60) {
          return `<h4 style="margin:16px 0 6px;font-size:13px;font-weight:600;color:#333;">${trimmed}</h4>`;
        }
        return `<p style="margin:4px 0;font-size:12px;line-height:1.7;color:#333;text-align:justify;">${trimmed}</p>`;
      }).join('\n');

      const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
@page{size:A4;margin:60px 50px 80px 50px;}
body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#333;margin:0;padding:0;}
.header{text-align:center;margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid #3000E3;}
.header h1{font-size:20px;color:#3000E3;margin:0;letter-spacing:2px;}
.header .doc-type{font-size:11px;color:#6c757d;text-transform:uppercase;letter-spacing:3px;margin-top:4px;}
.header .date{font-size:11px;color:#999;margin-top:8px;}
.content{margin:20px 0;}
.signature-area{margin-top:60px;display:flex;justify-content:space-between;gap:40px;}
.signature-box{flex:1;text-align:center;padding-top:40px;border-top:1px solid #999;}
.signature-box p{font-size:11px;color:#666;margin:4px 0;}
.footer{position:fixed;bottom:20px;left:50px;right:50px;text-align:center;font-size:9px;color:#aaa;border-top:1px solid #e9ecef;padding-top:8px;}
.footer strong{color:#3000E3;}
</style></head><body>
<div class="header">
<h1>${title}</h1>
<div class="doc-type">${docLabel}</div>
<div class="date">${dateStr}</div>
</div>
${partiesHtml}
<div class="content">${contentHtml}</div>
${valuesHtml}
${parties && parties.length >= 2 ? `
<div class="signature-area">
${parties.slice(0, 2).map(p => `<div class="signature-box"><p><strong>${p.name}</strong></p>${p.role ? `<p>${p.role}</p>` : ''}${p.document ? `<p>${p.document}</p>` : ''}</div>`).join('')}
</div>` : ''}
<div class="footer">Documento gerado em ${dateStr} &mdash; <strong>Criado com Ellosuit</strong></div>
</body></html>`;

      // Upload HTML as a file and convert to PDF using a simpler approach:
      // Store as HTML file that can be "printed to PDF" in browser, and also store a proper reference
      const htmlFileName = `ai-documents/${companyId}/${Date.now()}-${docType}.html`;
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const sbClient = createClient(supabaseUrl, supabaseKey);

      const htmlBytes = new TextEncoder().encode(fullHtml);
      const { error: uploadError } = await sbClient.storage
        .from('documents')
        .upload(htmlFileName, htmlBytes, { contentType: 'text/html', upsert: true });

      if (uploadError) {
        console.error('[generate_pdf] Upload error:', uploadError);
        return { result: `Erro ao salvar documento: ${uploadError.message}` };
      }

      const { data: urlData } = sbClient.storage.from('documents').getPublicUrl(htmlFileName);
      const publicUrl = urlData.publicUrl;

      // Also save as a document record
      await sbClient.from('documents').insert({
        name: `${title}.html`,
        file_type: 'document',
        file_url: publicUrl,
        company_id: companyId,
        created_by: userId,
      });

      return {
        result: `✅ Documento "${title}" gerado com sucesso! Você pode visualizar e imprimir como PDF.`,
        action: { 
          action: 'pdf_generated', 
          pdfUrl: publicUrl, 
          title,
          documentType: docType
        }
      };
    }

    // ==================== ANALYZE PDF VISUAL ====================
    case 'analyze_pdf_visual': {
      if (!fileUrl || !fileName) {
        return { result: 'Nenhum arquivo PDF anexado para análise. Por favor, envie um PDF.', action: { action: 'request_file', purpose: 'general' } };
      }

      const ext = fileName.split('.').pop()?.toLowerCase();
      if (ext !== 'pdf') {
        return { result: `O arquivo "${fileName}" não é um PDF. Envie um documento PDF para análise visual.` };
      }

      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) return { result: 'Erro: LOVABLE_API_KEY não configurada.' };

      const focus = (args.focus as string) || 'both';
      const improveDesign = (args.improve_design as boolean) || false;

      try {
        // Download the PDF
        console.log(`📄 [PDF Analysis] Downloading: ${fileUrl.substring(0, 80)}...`);
        const pdfRes = await fetch(fileUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!pdfRes.ok) return { result: `Erro ao baixar o PDF: ${pdfRes.status}` };

        const pdfBuffer = await pdfRes.arrayBuffer();
        const pdfBytes = new Uint8Array(pdfBuffer);
        console.log(`📄 [PDF Analysis] PDF size: ${pdfBytes.length} bytes`);

        // Convert to base64 in chunks
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < pdfBytes.length; i += chunkSize) {
          const chunk = pdfBytes.subarray(i, Math.min(i + chunkSize, pdfBytes.length));
          binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
        }
        const pdfBase64 = btoa(binary);

        // Build the analysis prompt based on focus
        let analysisPrompt = '';
        if (focus === 'design' || focus === 'both') {
          analysisPrompt += `ANÁLISE DE DESIGN: Para cada página, analise:
- Layout e composição visual (hierarquia, espaçamento, alinhamento)
- Tipografia (fontes, tamanhos, legibilidade)
- Paleta de cores (harmonia, contraste, adequação)
- Elementos gráficos (imagens, ícones, formas)
- Identidade visual e branding
- Profissionalismo geral do design
`;
        }
        if (focus === 'content' || focus === 'both') {
          analysisPrompt += `ANÁLISE DE CONTEÚDO: Para cada página, analise:
- Clareza e objetividade do texto
- Estrutura e organização das informações
- Qualidade da argumentação
- Dados e métricas apresentados
- Chamadas à ação (CTAs)
- Pontos fortes e fracos
`;
        }
        if (improveDesign) {
          analysisPrompt += `\nSUGESTÕES DE MELHORIA DE DESIGN: Para cada página, sugira:
- Como melhorar o layout
- Cores mais adequadas
- Tipografia mais profissional
- Elementos que poderiam ser adicionados ou removidos
- Referências de design moderno
`;
        }

        analysisPrompt += `\nRESPONDA em formato JSON com esta estrutura EXATA:
{
  "total_pages": número,
  "overall_score": número de 1-10,
  "overall_summary": "resumo geral em 2-3 frases",
  "pages": [
    {
      "page": número_da_página,
      "comment": "análise detalhada da página em texto corrido, incluindo pontos positivos, negativos e sugestões"
    }
  ],
  "design_suggestions": "sugestões gerais de melhoria (se improve_design=true)"
}

Analise TODAS as páginas do PDF. Seja específico e construtivo.`;

        console.log(`🤖 [PDF Analysis] Sending to Gemini for visual analysis...`);

        const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:application/pdf;base64,${pdfBase64}` }
                },
                {
                  type: 'text',
                  text: analysisPrompt
                }
              ]
            }],
            temperature: 0.4,
          }),
        });

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          console.error('[PDF Analysis] AI error:', aiRes.status, errText);
          if (aiRes.status === 429) return { result: 'Limite de requisições atingido. Tente novamente em alguns segundos.' };
          if (aiRes.status === 402) return { result: 'Créditos insuficientes.' };
          return { result: `Erro na análise visual: ${aiRes.status}` };
        }

        const aiData = await aiRes.json();
        const rawResponse = aiData.choices?.[0]?.message?.content || '';

        // Log usage
        const usage = aiData.usage || {};
        const cost = ((usage.prompt_tokens || 0) / 1000) * 0.00015 + ((usage.completion_tokens || 0) / 1000) * 0.0006;
        logUsage({
          service_type: 'lovable_ai', action: 'pdf_visual_analysis', model: 'google/gemini-2.5-flash',
          input_tokens: usage.prompt_tokens || 0, output_tokens: usage.completion_tokens || 0,
          total_cost: cost, user_id: userId, company_id: companyId,
          metadata: { focus, improve_design: improveDesign, file_name: fileName },
        });

        // Parse JSON from response
        let analysis: any = null;
        try {
          // Try to extract JSON from the response
          const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            analysis = JSON.parse(jsonMatch[0]);
          }
        } catch (parseErr) {
          console.error('[PDF Analysis] JSON parse error, using raw response');
        }

        if (analysis && analysis.pages && analysis.pages.length > 0) {
          // Build a formatted text response from the analysis
          let resultText = `Análise Visual do PDF "${fileName}"`;
          resultText += `\nNota geral: ${analysis.overall_score || 'N/A'}/10`;
          resultText += `\n${analysis.overall_summary || ''}`;
          
          for (const page of analysis.pages) {
            resultText += `\n\nPágina ${page.page}:\n${page.comment}`;
          }

          if (analysis.design_suggestions) {
            resultText += `\n\nSugestões de melhoria de design:\n${analysis.design_suggestions}`;
          }

          return {
            result: resultText,
            action: {
              action: 'pdf_visual_analysis',
              fileUrl,
              fileName,
              pages: analysis.pages,
              overallScore: analysis.overall_score,
              overallSummary: analysis.overall_summary,
              designSuggestions: analysis.design_suggestions,
              totalPages: analysis.total_pages,
            }
          };
        }

        // Fallback: return raw response
        return {
          result: rawResponse || 'Não foi possível analisar o PDF.',
          action: {
            action: 'pdf_visual_analysis',
            fileUrl,
            fileName,
            pages: [],
          }
        };
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error('[PDF Analysis] Error:', errMsg);
        return { result: `Erro ao analisar PDF: ${errMsg}` };
      }
    }

    default:
      return { result: `Ferramenta "${toolName}" não reconhecida.` };
  }
}

// ============== MAIN HANDLER ==============
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, messages, fileUrl, fileName, userId, companyId, timezone, conversationSummaries, activeConversationId, screenContext } = await req.json();

    if (!userId || !companyId) {
      return new Response(JSON.stringify({ error: 'userId e companyId são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user context
    const [{ data: companyData }, { data: userData }] = await Promise.all([
      supabase.from('companies').select('name').eq('id', companyId).single(),
      supabase.from('company_users').select('role').eq('user_id', userId).eq('company_id', companyId).single(),
    ]);

    const userTimezone = timezone || 'America/Sao_Paulo';
    const now = new Date();
    const todayStr = now.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: userTimezone });
    const currentTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: userTimezone });
    
    // Build ISO date in user's local timezone
    const localParts = new Intl.DateTimeFormat('en-CA', { timeZone: userTimezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const isoToday = localParts; // YYYY-MM-DD format
    
    // Also get local hour/minute for precise relative time calculations
    const localHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: userTimezone, hour: 'numeric', hour12: false }).format(now));
    const localMinute = Number(new Intl.DateTimeFormat('en-US', { timeZone: userTimezone, minute: 'numeric' }).format(now));

    let SYSTEM_PROMPT = `Você é o assistente IA da Ellosuit, uma plataforma completa de gestão empresarial. Você é inteligente, proativo e executa ações reais no sistema.

DATA E HORA ATUAL: ${todayStr}, ${currentTime}
DATA ISO HOJE: ${isoToday}
HORA LOCAL: ${String(localHour).padStart(2, '0')}:${String(localMinute).padStart(2, '0')}
TIMEZONE DO USUÁRIO: ${userTimezone}
${screenContext ? `
CONTEXTO DA TELA ATUAL:
- Rota/URL: ${screenContext.path || 'N/A'}
- Título da página: ${screenContext.title || 'N/A'}
${screenContext.elementUnderMouse ? `- Elemento sob o mouse (JSON): ${screenContext.elementUnderMouse}` : ''}
${screenContext.visibleText ? `- Resumo do texto visível: ${screenContext.visibleText.substring(0, 500)}...` : ''}

Use este contexto para ajudar o usuário. Se ele perguntar "o que faz essa tela", use a rota e o título para explicar as funcionalidades.
Se ele perguntar sobre o elemento sob o mouse, analise as propriedades do JSON fornecido (tag, texto, role, aria-label) para explicar para que serve aquele botão ou campo.` : ''}

IMPORTANTE SOBRE HORÁRIOS:
- Quando o usuário disser "daqui X minutos/horas", calcule baseado na HORA LOCAL acima (${String(localHour).padStart(2, '0')}:${String(localMinute).padStart(2, '0')})
- Use a DATA ISO HOJE (${isoToday}) como base para datas
- Formate datas para a tool como: ${isoToday}THH:mm:ss (sem timezone offset, já é hora local)

CONTEXTO:
- Empresa: ${companyData?.name || 'N/A'}
- Cargo: ${userData?.role || 'N/A'}

CAPACIDADES (use as ferramentas para executar):
1. Agenda: Criar, listar e excluir eventos/compromissos
2. Tarefas: CRUD completo de tarefas e lembretes
3. CRM: Criar, buscar, atualizar e excluir contatos
4. Drive: Salvar arquivos, criar pastas, listar documentos
5. Serviços: Cadastrar e listar serviços/produtos
6. Propostas/Contratos/Recibos: Consultar documentos comerciais
7. Email Marketing: Listar templates e emails enviados
8. Automações: Listar, ativar/desativar E CRIAR NOVAS automações
9. Chatbots: Listar, gerenciar E CRIAR NOVOS chatbots
10. WhatsApp: Ver conversas, ENVIAR MENSAGENS e CONECTAR novo número (QR Code)
11. Booking: Ver links de agendamento
12. Dashboard: Resumo geral do dia
13. Navegação: Levar o usuário para qualquer módulo
14. ElloContent IA: Geração de imagens, artes, banners e thumbnails (sistema de IA do ecossistema Ellosuit). NOTA: Criação de posts para redes sociais ou ideias de posts NÃO é mais suportada aqui.
15. Gráficos Interativos: Gerar gráficos de métricas (barras, linhas, áreas, pizza) com dados reais da plataforma
16. Geração de PDF: Criar documentos PDF profissionais (contratos, propostas, resumos, relatórios, cartas) com branding Ellosuit

REGRAS:
- EXECUTE as ações diretamente usando as ferramentas quando o usuário pedir
- Se faltar informação para executar, PERGUNTE de forma inteligente
- Responda SEMPRE em português brasileiro
- ESTILO DE COMUNICAÇÃO HUMANIZADO:
  * Seja natural e conversacional, como um colega de trabalho amigável
  * Use frases curtas e diretas. Evite parágrafos longos ou listas enormes
  * Quebre suas respostas em mensagens menores e naturais, como numa conversa real
  * NÃO liste todas as suas capacidades de uma vez. Responda ao que foi perguntado de forma simples
  * Quando o usuário perguntar "o que você faz", dê uma resposta CURTA e amigável (2-3 linhas), e ofereça ajuda com algo específico.
  * Se o usuário pedir para CRIAR POSTS, IDEIAS DE POSTS ou CONTEÚDO PARA REDES SOCIAIS, você deve responder que essa funcionalidade agora é exclusiva do ElloContent e direcioná-lo para: www.ellocontent.com
  * Use emojis com parcimônia (1-2 por mensagem no máximo), não em cada linha
  * Varie suas saudações e respostas, evite respostas robóticas ou formatadas demais
  * Prefira tom casual: "Pronto! Criei o evento pra você 👍" em vez de "O evento foi criado com sucesso no sistema."
  * Faça perguntas de follow-up naturais: "Quer que eu faça mais alguma coisa?" em vez de listar opções
- Quando criar eventos, infira horários razoáveis se não especificados (ex: reunião = 1h, lembrete = 30min)
- Se o usuário pedir para salvar um arquivo mas NÃO ANEXOU, use request_file
- Confirme as ações executadas de forma breve e natural
- NÃO use markdown com asteriscos (** ou *) nas respostas. Use texto simples e emojis para formatação.
- Para links, use o formato: texto_descritivo (URL) - ex: "Link da reunião: https://..."
- Ao criar reuniões, o link do Ellomeeting é gerado automaticamente pela ferramenta, não invente links externos como Google Meet ou Zoom
- Quando o usuário pedir para ENVIAR uma mensagem via WhatsApp, DISPARAR ou NOTIFICAR alguém, use a ferramenta 'send_whatsapp_message' IMEDIATAMENTE.
- NUNCA diga que o WhatsApp está desconectado sem antes tentar a ferramenta 'send_whatsapp_message' ou verificar as sessões disponíveis.
- Se o usuário disser que "o CRM está conectado" ou "o WhatsApp está conectado", confie que existe uma sessão ativa e use as ferramentas de WhatsApp.
- Se a ferramenta 'send_whatsapp_message' retornar que não há sessões conectadas, aí sim informe ao usuário e ofereça conectar.
- NUNCA mencione "WhatsApp Ellosuit".
- Se o usuário tiver múltiplas sessões conectadas, a ferramenta retornará uma lista para escolha automática no chat.
- Se o usuário pedir para RECONECTAR, CRIAR SESSÃO ou se o WhatsApp estiver realmente desconectado (confirmado pela ferramenta), use connect_whatsapp com force: true para gerar um novo QR code direto aqui no chat.
- NUNCA mencione caminhos inexistentes como "/dashboard/whatsapp-devices".


- Quando o usuário pedir para CRIAR uma automação, use create_automation. Pergunte o gatilho e as ações desejadas.
- Quando o usuário pedir para CRIAR um chatbot, use create_chatbot. Pergunte o objetivo do fluxo e monte os passos.
- Quando o usuário pedir para CRIAR um agente de IA, use create_ai_agent. Pergunte o nome, personalidade e instruções.
- Para AGENTES, ajude o usuário a definir personalidade e instruções detalhadas para obter melhores resultados.
- IMPORTANTE - SOBRE REDES SOCIAIS: Se o usuário pedir especificamente para criar um POST para rede social ou ideias de conteúdo, você NÃO deve seguir o fluxo abaixo. Em vez disso, diga amigavelmente que para posts e estratégias de conteúdo ele deve usar o ElloContent (www.ellocontent.com).
- Quando o usuário pedir para GERAR IMAGEM, ARTE, BANNER ou THUMBNAIL para uso interno, siga este FLUXO PROFISSIONAL obrigatório:
  PASSO 1: Pergunte o OBJETIVO/TEMA (botões: Promoção, Dica, Institucional, Motivacional)
  PASSO 2: Pergunte o FORMATO (botões: Quadrado 1:1, Banner 16:9, Horizontal 4:3, Vertical 2:3)
  PASSO 3: SEMPRE peça ao usuário para ENVIAR O LOGO da empresa. Diga: "📎 Envie o logo da sua empresa usando o botão de anexo (clipe) aqui no chat para que eu inclua na arte!" Use get_brand_assets para verificar se já tem logo salvo. Se encontrar, pergunte: "Encontrei seu logo salvo! Quer usar esse ou prefere enviar outro?" com botões "Usar logo salvo|Enviar outro logo|Sem logo". Se NÃO encontrar, peça para enviar pelo anexo. SEMPRE ofereça a opção de enviar um novo logo.
  PASSO 4: Pergunte se quer usar as CORES DO LOGO/MARCA no post (botões: Sim, usar cores da marca | Não, outras cores). Se quiser outras cores, pergunte quais.
  PASSO 5: Ofereça DUAS opções ao usuário para definir o estilo visual:
    OPÇÃO A: "🎨 Escolher um estilo pronto" — chame list_styles para mostrar a galeria de estilos do banco de dados.
    OPÇÃO B: "📎 Enviar referência própria" — o usuário pode enviar uma imagem ou link de referência pelo anexo do chat para criar um estilo único baseado nessa referência.
    Use botões: [QUICK_REPLIES:🎨 Escolher estilo pronto|📎 Enviar minha referência]
    Se escolher "estilo pronto": chame list_styles e mostre a galeria. Quando escolher um estilo, use as preview_images como reference_image_urls.
    Se escolher "enviar referência": peça para anexar a imagem ou colar o link. Use essa imagem/URL como reference_image_urls no generate_image.
- REGRA CRÍTICA SOBRE ESTILOS: Quando o usuário perguntar sobre estilos, pedir para ver estilos, SEMPRE chame list_styles. NUNCA liste estilos de memória ou inventados. Os estilos vêm do banco de dados e mudam dinamicamente.
- REGRA SOBRE REFERÊNCIA PRÓPRIA: Se o usuário enviar uma imagem junto com a mensagem (fileUrl no contexto), ou colar um link de imagem, use essa URL como reference_image_urls no generate_image. Isso permite criar artes com estilo único baseado na referência do usuário.
  PASSO 6: Pergunte se quer algum TEXTO ESPECÍFICO na imagem.
  PASSO 7: Finalmente, OBRIGATORIAMENTE chame a ferramenta generate_image com TODAS as informações coletadas: prompt detalhado em inglês, reference_image_urls (do estilo escolhido OU da referência enviada pelo usuário), logo_url se selecionado, brand_colors se informadas. NUNCA simule ou narre a geração — você DEVE chamar a tool generate_image. Se não chamar a tool, a imagem NÃO será gerada.
- REGRA CRÍTICA DE GERAÇÃO: NUNCA descreva o processo de gerar uma imagem sem chamar a ferramenta generate_image. NUNCA diga "estou gerando" ou "pronto, sua arte foi criada" sem ter EXECUTADO a tool. Se você não chamou generate_image, a imagem NÃO existe. SEMPRE chame a tool.
- NUNCA redirecione o usuário para outro módulo para "abrir no editor". A geração acontece AQUI, no chat, usando generate_image.
- REGRA DE RE-GERAÇÃO: Quando o usuário pedir "gere novamente", "refaça", "tente de novo", "gere outra vez" ou qualquer variação, NÃO repita os 7 passos. Use as MESMAS informações já coletadas na conversa (prompt, estilo, formato, cores, logo) e chame generate_image IMEDIATAMENTE com os mesmos parâmetros (ou levemente ajustados). NÃO pergunte nada, apenas gere.
- REGRA SOBRE ARQUIVOS ENVIADOS: Quando o usuário enviar um arquivo (imagem) no chat, verifique o contexto. Se estiver no fluxo de geração de imagem: se estava no PASSO 3 (logo), trate como logo. Se estava no PASSO 5 (estilo/referência), trate como referência visual. Pergunte "Recebi sua imagem! Isso é o seu logo ou uma referência de estilo?" se não estiver claro.
- IMPORTANTE: Faça uma pergunta por vez, não todas juntas! Cada passo é uma mensagem separada.
- SEMPRE destaque que a geração é feita pelo "ElloContent IA", um sistema de inteligência artificial do ecossistema Ellosuit.
- Se o usuário pedir ideias de posts ou criação de conteúdo para redes sociais, responda: "Para criação de posts e estratégias de conteúdo, agora temos uma plataforma dedicada! Acesse www.ellocontent.com para resultados profissionais."

BOTÕES INTERATIVOS (QUICK REPLIES):
- Sempre que você precisar perguntar ao usuário entre opções predefinidas (formato, estilo, tipo, etc.), use botões interativos ao invés de listar opções numeradas.
- Para incluir botões, adicione ao FINAL da sua resposta a tag: [QUICK_REPLIES:opção1|opção2|opção3|opção4]
- Exemplos:
  * Perguntando formato: "Qual formato deseja? [QUICK_REPLIES:📱 Feed (4:5)|📐 Quadrado (1:1)|📖 Story (9:16)|🖥️ Banner (16:9)]"
  * Perguntando estilo: "Qual estilo prefere? [QUICK_REPLIES:📸 Foto realista|🎨 Ilustração moderna|✨ Minimalista|🧊 3D]"
  * Perguntando tema: "Qual o objetivo? [QUICK_REPLIES:🏷️ Promoção|💡 Dica|🏢 Institucional|💪 Motivacional]"
- Use no MÁXIMO 4 botões por mensagem. Cada botão com no máximo 25 caracteres.
- Sempre inclua emoji no início de cada botão para tornar visualmente atrativo.
- Faça perguntas uma de cada vez, não todas juntas. Ex: primeiro pergunte o formato, depois o estilo, depois as cores, etc.
- Se o usuário anexar um arquivo XLSX/CSV com lista de contatos/clientes e pedir para CADASTRAR, use parse_uploaded_file primeiro para ler os dados, depois use bulk_create_contacts para inserir todos de uma vez na base. NÃO redirecione para outra página - faça o cadastro direto.
- Quando receber um arquivo de planilha, SEMPRE use parse_uploaded_file para ler o conteúdo antes de tentar processar os dados.

DISPAROS EM MASSA (WhatsApp) — FLUXO OBRIGATÓRIO POR ETAPAS:
- NUNCA dispare direto. Siga as mesmas etapas da página Disparos, uma pergunta por vez, sempre com botões:
  1) Nome da campanha (pode sugerir um).
  2) Destinatários: nome + telefone (ou planilha via parse_uploaded_file).
  3) Mensagem de texto (ofereça @nome para personalizar).
  4) Formato: "Quer anexar algo? [QUICK_REPLIES:💬 Só texto|🖼️ Imagem|🎥 Vídeo|🎙️ Voz IA]" (também aceite documento e áudio se pedirem). Se escolher Voz IA, peça o ROTEIRO falado.
  5) Intervalo entre envios: "[QUICK_REPLIES:⏱️ 5s|⏱️ 15s|⏱️ 30s|⏱️ 60s]".
  6) Mensagens em sequência (follow-ups) e vínculo com Agente de IA / Chatbot para quem responder: "[QUICK_REPLIES:🤖 Agente IA|💬 Chatbot|➕ Outra mensagem|🚫 Nada]".
- Depois de coletar tudo, chame create_dispatch_campaign com confirmed=false para gerar o RESUMO e mostre-o ao usuário.
- Só chame create_dispatch_campaign com confirmed=true quando o usuário aprovar explicitamente ("enviar agora", "pode enviar", "confirmo").

GRÁFICOS E ANÁLISES VISUAIS:
- Quando o usuário pedir gráficos, relatórios visuais, métricas, estatísticas, evolução, comparativos, desempenho ou análises de dados, use generate_chart.
- Escolha o tipo de gráfico mais adequado: bar (comparações), line (evolução temporal), area (volume/tendência), pie (proporções/distribuição).
- Exemplos de uso:
  * "Mostre meus contatos dos últimos 30 dias" → generate_chart(type=area, data_source=contacts, period=30d, group_by=day)
  * "Quais são os status das minhas tarefas?" → generate_chart(type=pie, data_source=tasks, group_by=status)
  * "Evolução de eventos na semana" → generate_chart(type=line, data_source=events, period=7d, group_by=day)
  * "Comparativo de propostas por status" → generate_chart(type=bar, data_source=proposals, group_by=status)
- Use cores vibrantes e títulos descritivos.
- Sempre explique brevemente o que o gráfico mostra após gerá-lo.
- Você pode usar data_source=custom com custom_data para dados calculados ou combinados.

GERAÇÃO DE DOCUMENTOS PDF:
- Quando o usuário pedir para criar, redigir, gerar, exportar ou montar um documento (contrato, proposta, resumo, relatório, carta), use generate_pdf.
- Se o usuário enviar um arquivo (contrato, proposta) para análise, primeiro use parse_uploaded_file para ler o conteúdo, analise, sugira melhorias, e se pedido, gere um novo PDF com as alterações usando generate_pdf.
- O conteúdo do PDF deve ser texto limpo e bem estruturado (sem markdown). Use seções em CAPS LOCK para títulos de cláusulas.
- SEMPRE inclua informações das partes envolvidas quando for contrato/proposta.
- SEMPRE mencione que o documento foi "Criado com Ellosuit" (isso é adicionado automaticamente no rodapé).
- Ao gerar contratos, inclua cláusulas padrão como: objeto, prazo, valor, pagamento, rescisão, foro, etc.
- Use linguagem jurídica simples e acessível.

ANÁLISE VISUAL DE PDF (NOVO):
- Quando o usuário enviar um PDF e pedir opinião, análise, feedback, ou "o que acha", use analyze_pdf_visual ao invés de parse_uploaded_file.
- analyze_pdf_visual faz análise VISUAL página por página usando IA multimodal (Gemini) - analisa design, layout, cores, tipografia, conteúdo.
- O resultado mostra cada página do PDF como miniatura com o comentário da IA ao lado.
- Use focus="design" para análise de design, focus="content" para conteúdo, focus="both" para ambos.
- Use improve_design=true quando o usuário quiser sugestões de melhoria de design.
- QUANDO O USUÁRIO QUISER MELHORAR O DESIGN: analise com analyze_pdf_visual(improve_design=true), depois ofereça criar uma versão melhorada usando generate_pdf.
- Após a análise visual, pergunte se o usuário quer que você crie uma versão melhorada do documento.
- Para PDFs que NÃO são visuais (planilhas, textos simples, CSVs), continue usando parse_uploaded_file.

MEMÓRIA DE CONVERSAS ANTERIORES:
${conversationSummaries && conversationSummaries.length > 0 ? `Você tem acesso ao histórico de conversas anteriores do usuário. Se o usuário perguntar sobre algo que já foi discutido em outra conversa, SUGIRA que ele continue naquela conversa existente.
Para sugerir uma conversa, inclua na sua resposta a tag: [IR_PARA_CHAT:ID_DA_CONVERSA]
Exemplo: "Esse assunto já foi discutido na conversa anterior! [IR_PARA_CHAT:abc-123-def]"

${activeConversationId ? `CONVERSA ATUAL: ${activeConversationId}` : 'CONVERSA NOVA (sem ID ainda)'}

Conversas anteriores:
${conversationSummaries.map((c: any) => `- ID: ${c.id} | Título: "${c.title}" | Última msg: "${c.preview || ''}" | ${c.messageCount} msgs`).join('\n')}

IMPORTANTE: Só sugira ir para outra conversa se o assunto for REALMENTE relevante. Não sugira para toda mensagem.` : 'Nenhuma conversa anterior disponível.'}`;


    // Build conversation
    const apiMessages: any[] = [{ role: 'system', content: SYSTEM_PROMPT }];

    if (messages && Array.isArray(messages)) {
      apiMessages.push(...messages);
    }

    let userContent = message || '';
    if (fileUrl && fileName) {
      userContent += `\n\n[Arquivo anexado: "${fileName}" - URL: ${fileUrl}]`;
    }
    if (userContent) {
      apiMessages.push({ role: 'user', content: userContent });
    }

    console.log(`🤖 [AI-ASSISTANT] Processing: msgs=${apiMessages.length}, hasFile=${!!fileUrl}`);

    // ============================================================
    // AGENTIC CORE — loop de múltiplos passos, plano, subagentes
    // ============================================================
    const MODEL_PLANNER = 'google/gemini-3.1-pro-preview';
    const MODEL_EXEC = 'google/gemini-3.7-flash';
    const MAX_STEPS = 30;
    const FOREGROUND_BUDGET_MS = 100000; // depois disso, migra para background

    // Helper: fetch with retry for AI gateway
    async function fetchAIWithRetry(body: any, maxRetries = 3): Promise<Response> {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const res = await chatCompletion(body);
          if ((res.status === 429 || res.status >= 500) && attempt < maxRetries - 1) {
            const wait = Math.min(2000 * Math.pow(2, attempt), 15000);
            console.warn(`⏳ [AI-ASSISTANT] ${res.status}, retry em ${wait}ms (${attempt + 1}/${maxRetries})`);
            await new Promise(r => setTimeout(r, wait));
            continue;
          }
          return res;
        } catch (e) {
          if (attempt < maxRetries - 1) {
            const wait = 2000 * Math.pow(2, attempt);
            console.warn(`⏳ [AI-ASSISTANT] Fetch error, retry em ${wait}ms:`, e);
            await new Promise(r => setTimeout(r, wait));
            continue;
          }
          throw e;
        }
      }
      throw new Error('AI Gateway: max retries exceeded');
    }

    // ---------- Memória de longo prazo ----------
    const { data: memoryRows } = await supabase
      .from('ai_agent_memory')
      .select('content, kind, importance')
      .eq('company_id', companyId)
      .order('importance', { ascending: false })
      .limit(25);

    if (memoryRows?.length) {
      SYSTEM_PROMPT += `\n\nMEMÓRIA DE LONGO PRAZO (fatos e preferências já aprendidos sobre este cliente):\n` +
        memoryRows.map((m: any) => `- [${m.kind}] ${m.content}`).join('\n');
    }

    SYSTEM_PROMPT += `

MODO AGENTE AUTÔNOMO (MUITO IMPORTANTE):
Você não é um chatbot de uma resposta só. Você é um agente que trabalha em ciclos: pensa, age com ferramentas, verifica o resultado e continua até concluir de verdade.
- Para pedidos com mais de uma etapa, PRIMEIRO chame update_plan com a lista de etapas. Depois execute etapa por etapa, atualizando o plano com update_plan (status done/doing/failed) conforme avança.
- Se uma ferramenta falhar, NÃO desista: leia o erro, tente outro caminho ou outra ferramenta, e só depois relate o problema.
- Você pode chamar VÁRIAS ferramentas na mesma rodada — elas rodam em paralelo.
- Para sub-tarefas grandes e independentes (pesquisar muitos registros, montar roteiros, preparar conteúdo), use spawn_subagent. Você pode disparar vários subagentes de uma vez e eles trabalham em paralelo.
- Antes de dar a resposta final, VERIFIQUE se o objetivo foi realmente cumprido (liste/confira o que criou).
- Use remember_fact quando aprender algo duradouro sobre o cliente (preferências, nomes, processos).
- Ações sensíveis (disparo em massa, envio de e-mail para muita gente, exclusões em lote) exigem request_approval antes de executar.
- Quando terminar, escreva a resposta final em texto simples e humano, sem inventar resultados que você não executou.`;

    // ---------- Ferramentas do agente ----------
    const AGENT_TOOLS = [
      {
        type: 'function',
        function: {
          name: 'update_plan',
          description: 'Cria ou atualiza o plano de etapas da tarefa atual. Use no início de tarefas com mais de uma etapa e sempre que concluir/alterar uma etapa.',
          parameters: {
            type: 'object',
            properties: {
              steps: {
                type: 'array',
                description: 'Lista completa das etapas, em ordem',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    status: { type: 'string', enum: ['todo', 'doing', 'done', 'failed'] },
                  },
                  required: ['title', 'status'],
                },
              },
            },
            required: ['steps'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'spawn_subagent',
          description: 'Delega uma sub-tarefa independente a um subagente com seu próprio ciclo de trabalho e acesso às mesmas ferramentas. Use para trabalhos grandes e paralelizáveis. Retorna apenas o resumo do resultado.',
          parameters: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'Nome curto do subagente (ex: "pesquisa de leads")' },
              task: { type: 'string', description: 'Descrição completa e autossuficiente da sub-tarefa, com todo o contexto necessário' },
              max_steps: { type: 'number', description: 'Máximo de passos do subagente (padrão 8)' },
            },
            required: ['label', 'task'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'remember_fact',
          description: 'Salva na memória de longo prazo um fato ou preferência duradoura do cliente.',
          parameters: {
            type: 'object',
            properties: {
              content: { type: 'string' },
              kind: { type: 'string', enum: ['fact', 'preference', 'process'] },
              importance: { type: 'number', description: '1 a 5' },
            },
            required: ['content'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'request_approval',
          description: 'Pausa a execução e pede autorização do usuário antes de uma ação sensível (disparo em massa, envio de e-mails, exclusões em lote).',
          parameters: {
            type: 'object',
            properties: {
              question: { type: 'string', description: 'Pergunta clara de autorização, com o resumo do que será feito' },
            },
            required: ['question'],
          },
        },
      },
    ];

    const ALL_TOOLS = [...TOOLS, ...AGENT_TOOLS];

    // ---------- Run persistido ----------
    const { data: runRow } = await supabase.from('ai_agent_runs').insert({
      company_id: companyId,
      user_id: userId,
      conversation_id: activeConversationId || null,
      goal: (message || fileName || 'Tarefa do assistente').substring(0, 500),
      status: 'running',
      mode: 'foreground',
      max_steps: MAX_STEPS,
    }).select('id').single();

    const runId: string | null = runRow?.id || null;
    let stepIndex = 0;
    let currentPlan: any[] = [];

    async function logStep(step: {
      kind: string; title?: string; content?: string; tool_name?: string;
      tool_args?: any; tool_result?: string; status?: string; error?: string; agent_label?: string;
    }) {
      if (!runId) return;
      stepIndex += 1;
      try {
        await supabase.from('ai_agent_steps').insert({
          run_id: runId,
          company_id: companyId,
          step_index: stepIndex,
          kind: step.kind,
          agent_label: step.agent_label || 'principal',
          title: step.title || null,
          content: step.content || null,
          tool_name: step.tool_name || null,
          tool_args: step.tool_args || null,
          tool_result: step.tool_result ? String(step.tool_result).substring(0, 4000) : null,
          status: step.status || 'done',
          error: step.error || null,
        });
      } catch (e) { console.warn('logStep falhou', e); }
    }

    // ---------- Subagente ----------
    async function runSubagent(label: string, task: string, maxSteps = 8): Promise<string> {
      const subMessages: any[] = [
        {
          role: 'system',
          content: `Você é um SUBAGENTE especializado da Ellosuit chamado "${label}".
Execute a sub-tarefa recebida do agente principal usando as ferramentas disponíveis.
Trabalhe em ciclos: aja, confira o resultado, corrija se der erro.
Ao terminar, responda APENAS com um resumo objetivo do que foi feito e dos dados relevantes (sem enrolação).
Data de hoje: ${isoToday}. Empresa: ${companyData?.name || 'N/A'}.`,
        },
        { role: 'user', content: task },
      ];

      await logStep({ kind: 'subagent', agent_label: label, title: `Subagente iniciado: ${label}`, content: task.substring(0, 500), status: 'running' });

      for (let i = 0; i < maxSteps; i++) {
        const res = await fetchAIWithRetry({
          model: MODEL_EXEC,
          messages: subMessages,
          tools: TOOLS,
          tool_choice: 'auto',
          temperature: 0.5,
        });
        if (!res.ok) {
          const t = await res.text();
          return `Subagente "${label}" falhou (${res.status}): ${t.substring(0, 200)}`;
        }
        const d = await res.json();
        const ch = d?.choices?.[0];
        if (!ch) return `Subagente "${label}" não retornou resposta.`;

        if (ch.message?.tool_calls?.length) {
          subMessages.push(ch.message);
          const results = await Promise.all(ch.message.tool_calls.map(async (tc: any) => {
            let out = '';
            try {
              const args = JSON.parse(tc.function.arguments || '{}');
              const r = await executeTool(tc.function.name, args, { supabase, userId, companyId, fileUrl, fileName });
              out = r.result;
              await logStep({ kind: 'tool', agent_label: label, tool_name: tc.function.name, tool_args: args, tool_result: out });
            } catch (e: any) {
              out = `Erro na ferramenta ${tc.function.name}: ${e?.message || e}`;
              await logStep({ kind: 'tool', agent_label: label, tool_name: tc.function.name, tool_result: out, status: 'error', error: out });
            }
            return { role: 'tool', tool_call_id: tc.id, content: out };
          }));
          subMessages.push(...results);
          continue;
        }

        const answer = ch.message?.content || 'Subagente concluiu sem resumo.';
        await logStep({ kind: 'subagent', agent_label: label, title: `Subagente concluído: ${label}`, content: answer.substring(0, 1500), status: 'done' });
        return answer;
      }

      const timeoutMsg = `Subagente "${label}" atingiu o limite de passos.`;
      await logStep({ kind: 'subagent', agent_label: label, title: timeoutMsg, status: 'error' });
      return timeoutMsg;
    }

    // ---------- Loop principal ----------
    const startedAt = Date.now();
    let lastAction: any = null;
    let finalMessage = '';
    let pendingApproval: string | null = null;
    let hitBudget = false;
    let totalCost = 0;

    for (let step = 0; step < MAX_STEPS; step++) {
      if (Date.now() - startedAt > FOREGROUND_BUDGET_MS) { hitBudget = true; break; }

      const usePlanner = step === 0 && (message || '').length > 40;
      const res = await fetchAIWithRetry({
        model: usePlanner ? MODEL_PLANNER : MODEL_EXEC,
        messages: apiMessages,
        tools: ALL_TOOLS,
        tool_choice: 'auto',
        temperature: 0.7,
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ AI Gateway error:', res.status, errorText);
        if (runId) await supabase.from('ai_agent_runs').update({ status: 'failed', error: `${res.status}`, finished_at: new Date().toISOString() }).eq('id', runId);
        if (res.status === 429) {
          return new Response(JSON.stringify({ error: 'Limite de requisições. Tente novamente em alguns segundos.' }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (res.status === 402) {
          return new Response(JSON.stringify({ error: 'Créditos de IA insuficientes. Adicione créditos para continuar.' }), {
            status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (res.status === 403) {
          return new Response(JSON.stringify({ error: 'Acesso à IA bloqueado pelas configurações do workspace.' }), {
            status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw new Error(`AI Gateway error: ${res.status}`);
      }

      const data = await res.json();
      const choice = data?.choices?.[0];
      if (!choice) {
        console.error('❌ [AI-ASSISTANT] Sem choices:', JSON.stringify(data).substring(0, 400));
        finalMessage = 'Desculpe, a IA não retornou uma resposta. Tente novamente.';
        break;
      }

      const u = data.usage || {};
      totalCost += ((u.prompt_tokens || 0) / 1000) * 0.00015 + ((u.completion_tokens || 0) / 1000) * 0.0006;
      logUsage({
        service_type: 'lovable_ai', action: `ai_assistant_step_${step + 1}`,
        model: usePlanner ? MODEL_PLANNER : MODEL_EXEC,
        input_tokens: u.prompt_tokens || 0, output_tokens: u.completion_tokens || 0,
        total_cost: totalCost, user_id: userId, company_id: companyId,
        metadata: { run_id: runId, step: step + 1 },
      });

      const toolCalls = choice.message?.tool_calls || [];
      if (!toolCalls.length) {
        finalMessage = choice.message?.content || '';
        if (finalMessage) await logStep({ kind: 'answer', title: 'Resposta final', content: finalMessage.substring(0, 2000) });
        break;
      }

      apiMessages.push(choice.message);
      console.log(`🔧 [AGENT] passo ${step + 1}: ${toolCalls.length} ferramenta(s)`);

      const toolResults = await Promise.all(toolCalls.map(async (toolCall: any) => {
        const toolName = toolCall.function.name;
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(toolCall.function.arguments || '{}'); } catch { /* ignore */ }

        // --- Ferramentas do próprio agente ---
        if (toolName === 'update_plan') {
          currentPlan = (args.steps as any[]) || [];
          if (runId) await supabase.from('ai_agent_runs').update({ plan: currentPlan }).eq('id', runId);
          await logStep({ kind: 'plan', title: 'Plano atualizado', content: currentPlan.map((s: any) => `${s.status === 'done' ? '✅' : s.status === 'doing' ? '⏳' : s.status === 'failed' ? '❌' : '⬜'} ${s.title}`).join('\n') });
          return { role: 'tool', tool_call_id: toolCall.id, content: 'Plano registrado. Continue executando as etapas.' };
        }

        if (toolName === 'remember_fact') {
          await supabase.from('ai_agent_memory').insert({
            company_id: companyId, user_id: userId,
            content: String(args.content || '').substring(0, 1000),
            kind: (args.kind as string) || 'fact',
            importance: Math.min(5, Math.max(1, Number(args.importance) || 3)),
            last_used_at: new Date().toISOString(),
          });
          await logStep({ kind: 'memory', title: 'Memória salva', content: String(args.content || '') });
          return { role: 'tool', tool_call_id: toolCall.id, content: 'Fato memorizado.' };
        }

        if (toolName === 'request_approval') {
          pendingApproval = String(args.question || 'Posso continuar?');
          await logStep({ kind: 'approval', title: 'Aguardando autorização', content: pendingApproval });
          return { role: 'tool', tool_call_id: toolCall.id, content: 'Autorização solicitada ao usuário. Pare aqui e apresente o resumo do que será feito.' };
        }

        if (toolName === 'spawn_subagent') {
          const summary = await runSubagent(
            String(args.label || 'subagente'),
            String(args.task || ''),
            Math.min(12, Number(args.max_steps) || 8),
          );
          return { role: 'tool', tool_call_id: toolCall.id, content: summary };
        }

        // --- Ferramentas normais da plataforma ---
        try {
          const result = await executeTool(toolName, args, { supabase, userId, companyId, fileUrl, fileName });
          if (result.action) lastAction = result.action;
          await logStep({ kind: 'tool', tool_name: toolName, tool_args: args, tool_result: result.result });
          return { role: 'tool', tool_call_id: toolCall.id, content: result.result };
        } catch (e: any) {
          const errMsg = `Erro ao executar ${toolName}: ${e?.message || e}. Analise o erro e tente outro caminho.`;
          await logStep({ kind: 'tool', tool_name: toolName, tool_args: args, tool_result: errMsg, status: 'error', error: errMsg });
          return { role: 'tool', tool_call_id: toolCall.id, content: errMsg };
        }
      }));

      apiMessages.push(...toolResults);

      if (pendingApproval) {
        // pede resposta curta ao modelo e para
        const wrap = await fetchAIWithRetry({ model: MODEL_EXEC, messages: apiMessages, temperature: 0.6 });
        if (wrap.ok) {
          const wd = await wrap.json();
          finalMessage = wd?.choices?.[0]?.message?.content || pendingApproval;
        } else {
          finalMessage = pendingApproval;
        }
        break;
      }
    }

    if (!finalMessage && hitBudget) {
      finalMessage = 'Essa tarefa é longa — deixei ela rodando em segundo plano. Pode continuar usando o sistema que eu te aviso quando terminar. 👍';
    }
    if (!finalMessage) {
      finalMessage = 'Cheguei ao limite de passos desta execução. Quer que eu continue de onde parei?';
    }

    if (runId) {
      await supabase.from('ai_agent_runs').update({
        status: pendingApproval ? 'awaiting_approval' : hitBudget ? 'background' : 'completed',
        plan: currentPlan,
        final_answer: finalMessage,
        steps_used: stepIndex,
        needs_approval: !!pendingApproval,
        approval_question: pendingApproval,
        messages: apiMessages.slice(-40),
        finished_at: hitBudget || pendingApproval ? null : new Date().toISOString(),
      }).eq('id', runId);

      // Continua em segundo plano quando estourou o orçamento do primeiro ciclo
      if (hitBudget) {
        try {
          const workerUrl = `${supabaseUrl}/functions/v1/ai-agent-worker`;
          // dispara sem aguardar
          fetch(workerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({ runId }),
          }).catch((e) => console.warn('worker dispatch falhou', e));
        } catch (e) { console.warn('worker dispatch erro', e); }
      }
    }

    console.log(`✅ [AGENT] concluído em ${stepIndex} passos (${Date.now() - startedAt}ms)`);

    return new Response(JSON.stringify({
      response: finalMessage,
      action: lastAction || { action: 'message' },
      runId,
      plan: currentPlan,
      steps_used: stepIndex,
      background: hitBudget,
      needs_approval: !!pendingApproval,
      success: true,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('❌ [AI-ASSISTANT] Error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Erro interno',
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
