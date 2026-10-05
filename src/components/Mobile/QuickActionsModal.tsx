import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search, Home, Calendar, Mail, Users, FolderOpen, Video, FileText, BarChart3, 
  Link, Play, Eye, Shield, HelpCircle, AlertTriangle, Bot, CheckSquare, Workflow, CalendarClock, Settings, MessageSquare, Briefcase } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { TRACKED_TOOLS, type ToolInfo } from '@/hooks/useToolUsageTracker';
import { isPathHidden } from '@/config/featureFlags';

interface QuickAction {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  category: string;
  color: string;
}

interface QuickActionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QuickActionsModal: React.FC<QuickActionsModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const hubMeta: Record<ToolInfo['hub'], { label: string; color: string; description: string }> = {
    omni: { label: 'Omni', color: '#374DA4', description: 'Comunicação e automações' },
    flow: { label: 'Flow', color: '#4D7CFF', description: 'Produtividade e organização' },
    track: { label: 'Track', color: '#2ECC71', description: 'Rastreamento e leads' },
    meet: { label: 'Meet', color: '#101010', description: 'Reuniões e gravações' },
    suite: { label: 'Suite', color: '#374DA4', description: 'Gestão e documentos' },
  };

  const iconByPath: Record<string, QuickAction['icon']> = {
    '/dashboard/omni': MessageSquare,
    '/dashboard/flows': Workflow,
    '/dashboard/track': FileText,
    '/dashboard/meet-hub': Video,
    '/dashboard/suite': Briefcase,
    '/dashboard/crm-ello': MessageSquare,
    '/dashboard/crm-whatsapp': MessageSquare,
    '/dashboard/api-whatsapp': Shield,
    '/dashboard/disparos': Play,
    '/dashboard/chatbot': Workflow,
    '/dashboard/bot-ia': Bot,
    '/dashboard/email': Mail,
    '/dashboard/email-templates': Mail,
    '/dashboard/automacoes': Settings,
    '/dashboard/agenda': Calendar,
    '/dashboard/agenda-aberta': CalendarClock,
    '/dashboard/tasks': CheckSquare,
    '/dashboard/reunioes': Video,
    '/dashboard/fluxos': Workflow,
    '/dashboard/rastreamento': Eye,
    '/dashboard/encurtador': Link,
    '/dashboard/email-tracker': Mail,
    '/dashboard/leads': Users,
    '/dashboard/track/leads': Users,
    '/dashboard/cadastros': Users,
    '/dashboard/drive': FolderOpen,
    '/dashboard/habitos': CheckSquare,
    '/dashboard/contratos': FileText,
    '/dashboard/propostas': FileText,
    '/dashboard/recibos': FileText,
    '/dashboard/analytics': BarChart3,
    '/dashboard/apps': Home,
    '/dashboard/ello-vision': Eye,
  };

  const actions: (QuickAction & { description: string })[] = TRACKED_TOOLS.filter(t => !isPathHidden(t.path)).map((tool) => ({
    id: tool.path,
    icon: iconByPath[tool.path] || HelpCircle,
    label: tool.title,
    description: hubMeta[tool.hub].description,
    path: tool.path,
    category: hubMeta[tool.hub].label,
    color: hubMeta[tool.hub].color,
  }));

  const filteredActions = actions.filter(action => {
    const query = searchQuery.toLowerCase();
    return action.label.toLowerCase().includes(query) ||
      action.category.toLowerCase().includes(query) ||
      action.description.toLowerCase().includes(query);
  });

  const categories = [...new Set(filteredActions.map(a => a.category))];

  const handleAction = (path: string) => {
    navigate(path);
    onClose();
    setSearchQuery('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="absolute bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl rounded-t-[2.5rem] animate-in slide-in-from-bottom duration-300 max-h-[90vh] flex flex-col shadow-[0_-8px_40px_-10px_rgba(0,0,0,0.3)] border-t border-border/50">
        {/* Handle for drag indicator */}
        <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto mt-3 mb-1" />
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Central de Ações</h2>
            <p className="text-xs text-muted-foreground">Tudo o que você precisa em um só lugar</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2.5 rounded-full bg-muted/50 hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pb-6">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-[#374DA4] transition-colors" />
            <Input
              placeholder="Pesquisar funcionalidades..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 rounded-3xl bg-muted/30 border-2 border-transparent focus-visible:border-[#374DA4]/30 focus-visible:ring-0 transition-all text-base shadow-inner"
            />
          </div>
        </div>

        {/* Actions List */}
        <div className="flex-1 overflow-y-auto px-5 pb-10">
          {categories.map((category) => (
            <div key={category} className="mb-6">
              <div className="flex items-center gap-2 mb-4 px-1">
                <div 
                  className="w-1.5 h-4 rounded-full" 
                  style={{ backgroundColor: actions.find(a => a.category === category)?.color }} 
                />
                <h3 className="text-[13px] font-black uppercase tracking-[0.1em] text-muted-foreground/80">
                  {category}
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {filteredActions
                  .filter(a => a.category === category)
                  .map((action) => (
                    <button
                      key={action.id}
                      onClick={() => handleAction(action.path)}
                      className="w-full flex items-center gap-5 p-4 rounded-[2rem] bg-card hover:bg-muted/40 active:scale-[0.97] transition-all border border-border/40 shadow-sm"
                    >
                      <div
                        className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${action.color}, ${action.color}CC)`,
                          boxShadow: `0 12px 24px -8px ${action.color}88`,
                        }}
                      >
                        <action.icon className="h-8 w-8 text-white stroke-[2.5px]" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-lg font-bold text-foreground leading-tight mb-0.5">{action.label}</div>
                        <div className="text-[13px] text-muted-foreground font-medium">{action.description}</div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          ))}

          {filteredActions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Nenhum resultado para "{searchQuery}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickActionsModal;
