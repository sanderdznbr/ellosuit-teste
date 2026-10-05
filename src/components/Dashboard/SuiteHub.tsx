import { Users, FolderOpen, BarChart3, FileText, FileSignature, Target, LayoutGrid, Eye } from "lucide-react";
import { isPathHidden } from "@/config/featureFlags";
import HubModuleCard from "./HubModuleCard";
import { useTheme } from "@/hooks/useTheme";

const SUITE_COLOR = "#374DA4";

const suiteModules = [
  { id: "cadastros", title: "Cadastros", description: "Clientes, leads e contatos", icon: Users, path: "/dashboard/cadastros" },
  { id: "drive", title: "Arquivos", description: "Drive de documentos da empresa", icon: FolderOpen, path: "/dashboard/drive" },
  { id: "habitos", title: "Hábitos", description: "Metas e rotinas diárias", icon: Target, path: "/dashboard/habitos" },
  { id: "contratos", title: "Contratos", description: "Templates e contratos gerados", icon: FileText, path: "/dashboard/contratos" },
  { id: "propostas", title: "Ordem de Serviço", description: "Orçamentos profissionais em PDF", icon: FileSignature, path: "/dashboard/propostas" },
  { id: "recibos", title: "Recibos", description: "Recibos de pagamento", icon: FileText, path: "/dashboard/recibos" },
  { id: "analytics", title: "Analytics", description: "Métricas e indicadores", icon: BarChart3, path: "/dashboard/analytics" },
  { id: "ello-vision", title: "Ello Vision", description: "Visão inteligente com IA", icon: Eye, path: "/dashboard/ello-vision" },
  { id: "apps", title: "Templates prontos", description: "Automações prontas para ativar", icon: LayoutGrid, path: "/dashboard/apps" },
];

export default function SuiteHub() {
  const { theme } = useTheme();
  const coloredBg = theme !== 'dark' ? SUITE_COLOR : undefined;

  return (
    <div className="flex-1" style={{ backgroundColor: coloredBg || 'hsl(var(--background))', minHeight: '100%' }}>
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-2 pb-24 md:py-6">
        <div className="mb-4">
          <h1 className="text-xl font-bold" style={{ color: coloredBg ? '#fff' : undefined }}>Suite</h1>
          <p className="text-xs" style={{ color: coloredBg ? 'rgba(255,255,255,0.7)' : undefined }}>Central de Gestão e Análises</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
          {suiteModules.filter((it: any) => !isPathHidden(it.path)).map((module) => (
            <HubModuleCard key={module.id} {...module} color={SUITE_COLOR} />
          ))}
        </div>
      </div>
    </div>
  );
}
