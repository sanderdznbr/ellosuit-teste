import { MessageSquare, Mail, Bot, GitBranch, Key, Megaphone, Zap } from "lucide-react";
import HubModuleCard from "./HubModuleCard";
import { useTheme } from "@/hooks/useTheme";

const OMNI_COLOR = "#374DA4";

const omniModules = [
  { id: "crm-whatsapp", title: "CRM WhatsApp", description: "Conversas, leads e atendimentos via WhatsApp", icon: MessageSquare, path: "/dashboard/crm-ello" },
  { id: "api-whatsapp", title: "API WhatsApp", description: "API restrita para integrar sistemas externos ao CRM", icon: Key, path: "/dashboard/api-whatsapp" },
  { id: "disparos", title: "Disparos em Massa", description: "Envie mensagens para vários contatos", icon: Megaphone, path: "/dashboard/disparos" },
  { id: "chatbot-builder", title: "ChatBot Builder", description: "Fluxos de atendimento automatizados", icon: GitBranch, path: "/dashboard/chatbot" },
  { id: "email-marketing", title: "Email Marketing", description: "Campanhas, templates e automações", icon: Mail, path: "/dashboard/email" },
  { id: "agentes-ia", title: "Agentes de IA", description: "Chatbots inteligentes para atendimento", icon: Bot, path: "/dashboard/bot-ia" },
  { id: "automacoes", title: "Automações", description: "Fluxos com webhooks, e-mails e ações", icon: Zap, path: "/dashboard/automacoes" },
];

export default function OmniHub() {
  const { theme } = useTheme();
  const coloredBg = theme !== 'dark' ? OMNI_COLOR : undefined;

  return (
    <div className="flex-1" style={{ backgroundColor: coloredBg || 'hsl(var(--background))', minHeight: '100%' }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-2 pb-24 md:py-6">
        <div className="mb-4">
          <h1 className="text-xl font-bold" style={{ color: coloredBg ? '#fff' : undefined }}>Omni</h1>
          <p className="text-xs" style={{ color: coloredBg ? 'rgba(255,255,255,0.7)' : undefined }}>Comunicação Multicanal</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
          {omniModules.map((module) => (
            <HubModuleCard key={module.id} {...module} color={OMNI_COLOR} />
          ))}
        </div>
      </div>
    </div>
  );
}
