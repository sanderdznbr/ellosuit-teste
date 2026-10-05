import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { 
  MessageSquare, Send, ArrowDownLeft, Bot, 
  DollarSign, Users, Zap
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { format, subDays } from 'date-fns';

export interface WhatsAppStats {
  totalMessages: number;
  sentMessages: number;
  receivedMessages: number;
  aiResponses: number;
  activeConversations: number;
  conversions: number;
  conversionRate: number;
  hasWhatsApp: boolean;
}

interface DailyMessageData {
  date: string;
  enviadas: number;
  recebidas: number;
  ia: number;
}

const CONVERSION_KEYWORDS = [
  'paguei', 'comprei', 'fechado', 'fechar', 'aprovado', 'pago',
  'pagamento confirmado', 'transferi', 'pix enviado', 'pix feito',
  'compra realizada', 'pedido feito', 'vou comprar', 'quero comprar',
  'finalizar compra', 'finalizar pedido', 'confirmo', 'confirmado',
  'deal', 'aceito', 'vamos fechar', 'pode fechar', 'fecha pra mim',
  'manda o link', 'link de pagamento', 'boleto', 'cartão'
];

const BRAND_BLUE = '#4D7CFF';
const BRAND_BLUE_DARK = '#005BB5';

interface Props {
  companyId: string;
  startDate: Date;
  endDate: Date;
  onStatsLoaded?: (stats: WhatsAppStats) => void;
  showChart?: boolean;
}

const WhatsAppDashboardWidget: React.FC<Props> = ({ companyId, startDate, endDate, onStatsLoaded, showChart = true }) => {
  const [stats, setStats] = useState<WhatsAppStats>({
    totalMessages: 0, sentMessages: 0, receivedMessages: 0,
    aiResponses: 0, activeConversations: 0, conversions: 0,
    conversionRate: 0, hasWhatsApp: false
  });
  const [dailyData, setDailyData] = useState<DailyMessageData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWhatsAppData();
  }, [companyId, startDate, endDate]);

  const loadWhatsAppData = async () => {
    if (!companyId) return;
    setLoading(true);

    try {
      const { data: sessions } = await supabase
        .from('whatsapp_sessions')
        .select('id, status')
        .eq('company_id', companyId)
        .limit(1);

      if (!sessions || sessions.length === 0) {
        const noWhatsApp = { ...stats, hasWhatsApp: false };
        setStats(noWhatsApp);
        onStatsLoaded?.(noWhatsApp);
        setLoading(false);
        return;
      }

      const { data: messages, count: totalCount } = await supabase
        .from('whatsapp_messages')
        .select('id, from_me, is_ai_response, timestamp, content, message_type', { count: 'exact' })
        .eq('company_id', companyId)
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString())
        .neq('message_type', 'system')
        .order('timestamp', { ascending: true });

      const { count: activeConvos } = await supabase
        .from('whatsapp_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('last_message_at', subDays(new Date(), 1).toISOString());

      const allMessages = messages || [];
      const sent = allMessages.filter(m => m.from_me);
      const received = allMessages.filter(m => !m.from_me);
      const aiMessages = allMessages.filter(m => m.is_ai_response);

      const conversationConversions = new Set<string>();
      for (const msg of received) {
        if (msg.content) {
          const contentLower = msg.content.toLowerCase();
          if (CONVERSION_KEYWORDS.some(kw => contentLower.includes(kw))) {
            conversationConversions.add(format(new Date(msg.timestamp), 'yyyy-MM-dd') + msg.id.substring(0, 8));
          }
        }
      }

      const totalConversations = activeConvos || 1;
      const conversions = conversationConversions.size;
      const conversionRate = totalConversations > 0 ? (conversions / totalConversations) * 100 : 0;

      const newStats: WhatsAppStats = {
        totalMessages: totalCount || 0,
        sentMessages: sent.length,
        receivedMessages: received.length,
        aiResponses: aiMessages.length,
        activeConversations: activeConvos || 0,
        conversions,
        conversionRate: Math.min(conversionRate, 100),
        hasWhatsApp: true
      };
      setStats(newStats);
      onStatsLoaded?.(newStats);

      // Build daily chart data
      const dailyMap: Record<string, { enviadas: number; recebidas: number; ia: number }> = {};
      for (let i = 29; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'dd/MM');
        dailyMap[date] = { enviadas: 0, recebidas: 0, ia: 0 };
      }
      for (const msg of allMessages) {
        const date = format(new Date(msg.timestamp), 'dd/MM');
        if (dailyMap[date]) {
          if (msg.from_me) {
            dailyMap[date].enviadas++;
            if (msg.is_ai_response) dailyMap[date].ia++;
          } else {
            dailyMap[date].recebidas++;
          }
        }
      }
      setDailyData(Object.entries(dailyMap).map(([date, data]) => ({ date, ...data })));
    } catch (error) {
      console.error('Error loading WhatsApp dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-xl shadow-xl border border-gray-100 text-sm">
          <p className="font-semibold text-gray-900 mb-1">{label}</p>
          {payload.map((entry: any, i: number) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-600">{entry.name}:</span>
              <span className="font-semibold">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-48 bg-gray-100 rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!stats.hasWhatsApp || !showChart) return null;

  const hasData = stats.totalMessages > 0;

  return (
    <Card className="border-0 shadow-sm mb-8">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ backgroundColor: `${BRAND_BLUE}15` }}>
              <MessageSquare className="h-5 w-5" style={{ color: BRAND_BLUE }} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Fluxo de Mensagens WhatsApp</h3>
              <p className="text-xs text-gray-400">Últimos 30 dias</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BRAND_BLUE }} />
              <span className="text-xs text-gray-500">Enviadas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#374DA4]" />
              <span className="text-xs text-gray-500">Recebidas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#8B5CF6]" />
              <span className="text-xs text-gray-500">IA</span>
            </div>
          </div>
        </div>

        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Nenhuma mensagem no período</p>
            <p className="text-sm text-gray-400 mt-1">As mensagens enviadas e recebidas aparecerão aqui</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="colorEnviadas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={BRAND_BLUE} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={BRAND_BLUE} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRecebidas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#374DA4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#374DA4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorIA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="enviadas" name="Enviadas" stroke={BRAND_BLUE} strokeWidth={2} fillOpacity={1} fill="url(#colorEnviadas)" />
              <Area type="monotone" dataKey="recebidas" name="Recebidas" stroke="#374DA4" strokeWidth={2} fillOpacity={1} fill="url(#colorRecebidas)" />
              <Area type="monotone" dataKey="ia" name="IA" stroke="#8B5CF6" strokeWidth={2} fillOpacity={1} fill="url(#colorIA)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default WhatsAppDashboardWidget;
