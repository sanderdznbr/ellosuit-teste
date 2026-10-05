import React from 'react';
import { CalendarDays, Users, Mail, Zap, Bot, MessageSquare, FileText, Clock, Phone, ArrowRight, CheckCircle2, XCircle, Link as LinkIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useHubColor, DEFAULT_COLOR } from '@/hooks/useHubColor';
import { useTheme } from '@/hooks/useTheme';

export type CardType = 'event' | 'contact' | 'email' | 'automation' | 'chatbot' | 'agent' | 'task' | 'proposal' | 'receipt' | 'conversation' | 'document' | 'service' | 'booking' | 'summary';

export interface RichCard {
  type: CardType;
  title: string;
  subtitle?: string;
  details?: string[];
  status?: string;
  statusColor?: 'green' | 'red' | 'yellow' | 'blue' | 'gray';
  link?: string;
  icon?: string;
  value?: string;
  extra?: Record<string, any>;
}

const STATUS_COLORS: Record<string, string> = {
  green: 'bg-emerald-500/10 text-emerald-500',
  red: 'bg-red-500/10 text-red-500',
  yellow: 'bg-amber-500/10 text-amber-500',
  blue: 'bg-[#374DA4]/10 text-[#374DA4]',
  gray: 'bg-gray-500/10 text-gray-400',
};

const TYPE_ICONS: Record<CardType, React.ElementType> = {
  event: CalendarDays,
  contact: Users,
  email: Mail,
  automation: Zap,
  chatbot: Bot,
  agent: Bot,
  task: CheckCircle2,
  proposal: FileText,
  receipt: FileText,
  conversation: MessageSquare,
  document: FileText,
  service: FileText,
  booking: LinkIcon,
  summary: Clock,
};

const TYPE_COLORS: Record<CardType, string> = {
  event: '#6366f1',
  contact: '#8b5cf6',
  email: '#ec4899',
  automation: '#f59e0b',
  chatbot: '#10b981',
  agent: '#06b6d4',
  task: '#374DA4',
  proposal: '#f97316',
  receipt: '#14b8a6',
  conversation: '#22c55e',
  document: '#64748b',
  service: '#8b5cf6',
  booking: '#6366f1',
  summary: '#374DA4',
};

interface AIAssistantCardsProps {
  cards: RichCard[];
}

const AIAssistantCards: React.FC<AIAssistantCardsProps> = ({ cards }) => {
  const navigate = useNavigate();
  const { color: hubColor } = useHubColor();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (!cards?.length) return null;

  // Summary cards (single stat cards in a grid)
  if (cards[0]?.type === 'summary') {
    return (
      <div className="grid grid-cols-2 gap-2 mt-2">
        {cards.map((card, i) => {
          const Icon = TYPE_ICONS[card.type];
          return (
            <div
              key={i}
              className={`rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'}`}
              onClick={() => card.link && navigate(card.link)}
            >
              <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${card.extra?.color || TYPE_COLORS.summary}20` }}>
                <Icon className="h-4.5 w-4.5" style={{ color: card.extra?.color || TYPE_COLORS.summary }} />
              </div>
              <div className="min-w-0">
                <p className={`text-lg font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{card.value}</p>
                <p className={`text-[11px] truncate ${isDark ? 'text-white/40' : 'text-gray-500'}`}>{card.title}</p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2 mt-2">
      {cards.map((card, i) => {
        const Icon = TYPE_ICONS[card.type] || FileText;
        const accentColor = TYPE_COLORS[card.type] || hubColor || DEFAULT_COLOR;

        return (
          <div
            key={i}
            className={`rounded-xl p-3 transition-all cursor-pointer group border ${isDark ? 'bg-white/5 hover:bg-white/10 border-white/5' : 'bg-gray-50 hover:bg-gray-100 border-gray-100'}`}
            onClick={() => card.link && navigate(card.link)}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: `${accentColor}18` }}
              >
                <Icon className="h-4.5 w-4.5" style={{ color: accentColor }} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{card.title}</h4>
                  {card.status && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${isDark ? STATUS_COLORS[card.statusColor || 'gray'] : (card.statusColor === 'gray' ? 'bg-gray-100 text-gray-600' : (card.statusColor === 'green' ? 'bg-emerald-100 text-emerald-700' : (card.statusColor === 'red' ? 'bg-red-100 text-red-700' : (card.statusColor === 'yellow' ? 'bg-amber-100 text-amber-700' : 'bg-[#DFE4FB] text-[#253573]'))))}`}>
                      {card.status}
                    </span>
                  )}
                </div>

                {card.subtitle && (
                  <p className={`text-xs mt-0.5 truncate ${isDark ? 'text-white/50' : 'text-gray-500'}`}>{card.subtitle}</p>
                )}

                {card.details && card.details.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {card.details.map((detail, j) => (
                      <span key={j} className={`text-[11px] ${isDark ? 'text-white/30' : 'text-gray-400'}`}>{detail}</span>
                    ))}
                  </div>
                )}

                {card.value && (
                  <p className="text-sm font-bold mt-1" style={{ color: accentColor }}>{card.value}</p>
                )}
              </div>

              {/* Arrow */}
              {card.link && (
                <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 shrink-0 mt-1 transition-colors" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AIAssistantCards;
