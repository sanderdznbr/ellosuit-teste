import React, { useRef, useState } from 'react';
import { useAdminMaster } from '@/hooks/useAdminMaster';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import {
  MessageSquare, Mail, Users, Bot, Calendar, CheckSquare, Video, Zap,
  FileText, Link2, Eye, BarChart3, FolderOpen,
  Briefcase, Key, Megaphone, Target, FileSignature, Workflow,
  GitBranch, LayoutGrid
} from 'lucide-react';
import JSZip from 'jszip';

const COLORS = {
  omni: "#10B981",
  flow: "#3600FF",
  track: "#14B8A6",
  suite: "#374DA4",
  meet: "#101010",
};

interface IconItem {
  id: string;
  label: string;
  icon: React.ElementType;
  hub: keyof typeof COLORS;
}

const ALL_ICONS: IconItem[] = [
  { id: 'crm-whatsapp', label: 'CRM WhatsApp', icon: MessageSquare, hub: 'omni' },
  { id: 'disparos', label: 'Disparos em Massa', icon: Megaphone, hub: 'omni' },
  { id: 'chatbot', label: 'ChatBot Builder', icon: GitBranch, hub: 'omni' },
  { id: 'email-marketing', label: 'Email Marketing', icon: Mail, hub: 'omni' },
  { id: 'templates-email', label: 'Templates de Email', icon: FileText, hub: 'omni' },
  { id: 'agentes-ia', label: 'Agentes de IA', icon: Bot, hub: 'omni' },
  { id: 'automacoes', label: 'Automações', icon: Workflow, hub: 'omni' },
  { id: 'api-whatsapp', label: 'API WhatsApp', icon: Key, hub: 'omni' },
  { id: 'crm-meta', label: 'CRM Meta', icon: MessageSquare, hub: 'omni' },
  { id: 'agenda', label: 'Minha Agenda', icon: Calendar, hub: 'flow' },
  { id: 'agenda-online', label: 'Agenda Online', icon: Calendar, hub: 'flow' },
  { id: 'tarefas', label: 'Tarefas', icon: CheckSquare, hub: 'flow' },
  { id: 'fluxos', label: 'Fluxos', icon: Zap, hub: 'flow' },
  { id: 'videoconferencia', label: 'Videoconferência', icon: Video, hub: 'flow' },
  { id: 'gravacoes', label: 'Gravações', icon: Video, hub: 'flow' },
  { id: 'rastrear-conteudo', label: 'Rastrear Conteúdo', icon: FileText, hub: 'track' },
  { id: 'encurtador', label: 'Encurtador Rastreável', icon: Link2, hub: 'track' },
  { id: 'rastrear-emails', label: 'Rastrear Emails', icon: Eye, hub: 'track' },
  { id: 'captura-leads', label: 'Captura de Leads', icon: Users, hub: 'track' },
  { id: 'cadastros', label: 'Cadastros', icon: Users, hub: 'suite' },
  { id: 'arquivos', label: 'Arquivos', icon: FolderOpen, hub: 'suite' },
  { id: 'equipe', label: 'Equipe', icon: Briefcase, hub: 'suite' },
  { id: 'habitos', label: 'Criar Hábitos', icon: Target, hub: 'suite' },
  { id: 'contratos', label: 'Criação de Contratos', icon: FileSignature, hub: 'suite' },
  { id: 'ordem-servico', label: 'Ordem de Serviço', icon: FileText, hub: 'suite' },
  { id: 'recibos', label: 'Criar Recibos', icon: FileText, hub: 'suite' },
  { id: 'templates-prontos', label: 'Templates Prontos', icon: LayoutGrid, hub: 'suite' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, hub: 'suite' },
  { id: 'ello-vision', label: 'Ello Vision', icon: BarChart3, hub: 'suite' },
  { id: 'relatorios', label: 'Relatórios', icon: FileText, hub: 'suite' },
  { id: 'meet-hub', label: 'Meet Hub', icon: Video, hub: 'meet' },
  { id: 'meet-skills', label: 'Meet Skills', icon: Bot, hub: 'meet' },
];

const HUB_LABELS: Record<string, string> = {
  omni: 'Omni',
  flow: 'Flow',
  track: 'Track',
  suite: 'Suite',
  meet: 'Meet-Hub',
};

function renderIconPng(wrapperEl: HTMLDivElement, color: string, size: number = 512): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const svg = wrapperEl.querySelector('svg');
    if (!svg) return reject(new Error('SVG not found'));

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('No canvas context'));

    const radius = size * 0.22;

    // Rounded rect background
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius);
    ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size);
    ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fill();

    // Clone SVG, force white
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', '24');
    clone.setAttribute('height', '24');
    clone.setAttribute('stroke', 'white');
    clone.setAttribute('color', 'white');
    clone.querySelectorAll('*').forEach(el => {
      if (el.getAttribute('stroke') && el.getAttribute('stroke') !== 'none') {
        el.setAttribute('stroke', 'white');
      }
    });

    const svgData = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const iconSize = size * 0.45;
      const offset = (size - iconSize) / 2;
      ctx.drawImage(img, offset, offset, iconSize, iconSize);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Blob failed'));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG load failed'));
    };
    img.src = url;
  });
}

const AdminIconsDownload: React.FC = () => {
  const { isAdminMaster, loading: authLoading } = useAdminMaster();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const iconRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  if (authLoading) return <div className="p-6 text-muted-foreground">Carregando...</div>;
  if (!isAdminMaster) return <Navigate to="/dashboard" replace />;

  const setRef = (id: string, el: HTMLDivElement | null) => {
    if (el) iconRefs.current.set(id, el);
  };

  const handleDownloadAll = async () => {
    setDownloading(true);
    try {
      const zip = new JSZip();
      for (const item of ALL_ICONS) {
        const el = iconRefs.current.get(item.id);
        if (!el) continue;
        try {
          const blob = await renderIconPng(el, COLORS[item.hub], 512);
          zip.file(`${item.hub}/${item.id}.png`, blob);
        } catch (err) {
          console.warn(`Skip ${item.id}:`, err);
        }
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = 'ellosuit-icons.zip';
      a.click();
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadSingle = async (item: IconItem) => {
    const el = iconRefs.current.get(item.id);
    if (!el) return;
    try {
      const blob = await renderIconPng(el, COLORS[item.hub], 512);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${item.id}.png`;
      a.click();
    } catch (err) {
      console.error(err);
    }
  };

  const groupedByHub = Object.entries(
    ALL_ICONS.reduce((acc, item) => {
      if (!acc[item.hub]) acc[item.hub] = [];
      acc[item.hub].push(item);
      return acc;
    }, {} as Record<string, IconItem[]>)
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Ícones dos Módulos</h1>
            <p className="text-sm text-muted-foreground">{ALL_ICONS.length} ícones · 512×512 PNG</p>
          </div>
        </div>
        <Button onClick={handleDownloadAll} disabled={downloading} className="gap-2">
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {downloading ? 'Gerando...' : 'Baixar Todos (ZIP)'}
        </Button>
      </div>

      {groupedByHub.map(([hub, items]) => (
        <div key={hub}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {HUB_LABELS[hub]}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.id}
                  className="border border-border/60 hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => handleDownloadSingle(item)}
                >
                  <CardContent className="p-4 flex flex-col items-center gap-3">
                    <div
                      ref={(el) => setRef(item.id, el)}
                      className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ backgroundColor: COLORS[item.hub] }}
                    >
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium text-foreground leading-tight">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{HUB_LABELS[hub]}</p>
                    </div>
                    <Download className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminIconsDownload;
