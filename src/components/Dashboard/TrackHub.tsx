import { FileText, Link2, Mail, Users, Bug } from "lucide-react";
import { isPathHidden } from "@/config/featureFlags";
import HubModuleCard from "./HubModuleCard";
import { useTheme } from "@/hooks/useTheme";

const TRACK_COLOR = "#2ECC71";

const trackModules = [
  { id: "rastreamento", title: "Rastrear Conteúdo", description: "PDFs, vídeos e imagens com links rastreáveis", icon: FileText, path: "/dashboard/rastreamento" },
  { id: "encurtador", title: "Encurtador Rastreável", description: "Encurte URLs e acompanhe cliques", icon: Link2, path: "/dashboard/encurtador" },
  { id: "email-tracker", title: "Rastrear Emails", description: "Saiba quando seus emails foram abertos", icon: Mail, path: "/dashboard/email-tracker" },
  { id: "leads", title: "Captura de Leads", description: "Funis interativos para capturar e qualificar leads", icon: Users, path: "/dashboard/leads" },
  { id: "test", title: "Diagnóstico", description: "Verificar saúde do módulo Track", icon: Bug, path: "/dashboard/track/test" },
];

export default function TrackHub() {
  const { theme } = useTheme();
  const coloredBg = theme !== 'dark' ? TRACK_COLOR : undefined;

  return (
    <div className="flex-1" style={{ backgroundColor: coloredBg || 'hsl(var(--background))', minHeight: '100%' }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-2 pb-24 md:py-6">
        <div className="mb-4">
          <h1 className="text-xl font-bold" style={{ color: coloredBg ? '#fff' : undefined }}>Track</h1>
          <p className="text-xs" style={{ color: coloredBg ? 'rgba(255,255,255,0.7)' : undefined }}>Rastreamento inteligente de conteúdo</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
          {trackModules.filter((it: any) => !isPathHidden(it.path)).map((module) => (
            <HubModuleCard key={module.id} {...module} color={TRACK_COLOR} />
          ))}
        </div>
      </div>
    </div>
  );
}
