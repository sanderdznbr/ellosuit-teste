import { Calendar, CheckSquare, Video, Zap, CalendarCheck, Mic } from "lucide-react";
import HubModuleCard from "./HubModuleCard";
import { useTheme } from "@/hooks/useTheme";

const FLOW_COLOR = "#4D7CFF";

const flowModules = [
  { id: "agenda", title: "Minha Agenda", description: "Compromissos e eventos", icon: Calendar, path: "/dashboard/agenda" },
  { id: "agenda-online", title: "Agenda Online", description: "Links de agendamento para clientes", icon: CalendarCheck, path: "/dashboard/agenda-aberta" },
  { id: "tasks", title: "Tarefas", description: "Listas, prioridades e lembretes", icon: CheckSquare, path: "/dashboard/tasks" },
  { id: "fluxos", title: "Fluxos de Trabalho", description: "Kanban e automações de projetos", icon: Zap, path: "/dashboard/fluxos" },
];

export default function FlowsHub() {
  const { theme } = useTheme();
  const coloredBg = theme !== 'dark' ? FLOW_COLOR : undefined;

  return (
    <div className="flex-1" style={{ backgroundColor: coloredBg || 'hsl(var(--background))', minHeight: '100%' }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-2 pb-24 md:py-6">
        <div className="mb-4">
          <h1 className="text-xl font-bold" style={{ color: coloredBg ? '#fff' : undefined }}>Flow</h1>
          <p className="text-xs" style={{ color: coloredBg ? 'rgba(255,255,255,0.7)' : undefined }}>Produtividade e organização</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
          {flowModules.map((module) => (
            <HubModuleCard key={module.id} {...module} color={FLOW_COLOR} />
          ))}
        </div>
      </div>
    </div>
  );
}
