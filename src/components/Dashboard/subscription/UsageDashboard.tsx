import React from 'react';
import { Users, HardDrive, Mail, Bot, MessageCircle, Calendar, Video, FileText, Link2, Film, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SubscriptionLimits, SubscriptionUsage, ResourceType } from '@/hooks/useSubscription';

interface UsageDashboardProps {
  limits: SubscriptionLimits;
  usage: SubscriptionUsage;
  hasOmni: boolean;
  hasFlow: boolean;
  hasTrack: boolean;
  onUpgrade: (resource: ResourceType) => void;
}

interface UsageItem {
  resource: ResourceType;
  label: string;
  icon: React.ElementType;
  current: number;
  max: number;
  unit: string;
  module?: 'omni' | 'flow' | 'track';
}

export function UsageDashboard({ limits, usage, hasOmni, hasFlow, hasTrack, onUpgrade }: UsageDashboardProps) {
  const usageItems: UsageItem[] = [
    {
      resource: 'users',
      label: 'Usuários',
      icon: Users,
      current: usage.currentUsers,
      max: limits.maxUsers,
      unit: 'usuários',
    },
    {
      resource: 'storage_gb',
      label: 'Armazenamento',
      icon: HardDrive,
      current: usage.storageUsedGb,
      max: limits.maxStorageGb,
      unit: 'GB',
    },
    {
      resource: 'emails_sent',
      label: 'Emails Enviados',
      icon: Mail,
      current: usage.emailsSentThisMonth,
      max: limits.maxEmailsMonth,
      unit: 'emails',
      module: 'omni',
    },
    {
      resource: 'ai_agents_active',
      label: 'Agentes de IA',
      icon: Bot,
      current: usage.aiAgentsActive,
      max: limits.maxAiAgents,
      unit: 'agentes',
      module: 'omni',
    },
    {
      resource: 'whatsapp_sessions_active',
      label: 'WhatsApp CRM',
      icon: MessageCircle,
      current: usage.whatsappSessionsActive,
      max: limits.maxWhatsappSessions,
      unit: 'sessões',
      module: 'omni',
    },
    {
      resource: 'booking_links_active',
      label: 'Agendas Online',
      icon: Calendar,
      current: usage.bookingLinksActive,
      max: limits.maxBookingLinks,
      unit: 'agendas',
      module: 'flow',
    },
    {
      resource: 'meeting_hours_used',
      label: 'Gravação de Reuniões',
      icon: Video,
      current: usage.meetingHoursUsed,
      max: limits.maxMeetingHours,
      unit: 'horas',
      module: 'flow',
    },
    {
      resource: 'tracked_docs_created',
      label: 'Documentos Rastreados',
      icon: FileText,
      current: usage.trackedDocsCreated,
      max: limits.maxTrackedDocs,
      unit: 'docs',
      module: 'track',
    },
    {
      resource: 'tracked_links_created',
      label: 'Links Rastreados',
      icon: Link2,
      current: usage.trackedLinksCreated,
      max: limits.maxTrackedLinks,
      unit: 'links',
      module: 'track',
    },
    {
      resource: 'tracked_videos_created',
      label: 'Vídeos Rastreados',
      icon: Film,
      current: usage.trackedVideosCreated,
      max: limits.maxTrackedVideos,
      unit: 'vídeos',
      module: 'track',
    },
  ];

  // Filter by active modules
  const filteredItems = usageItems.filter(item => {
    if (!item.module) return true;
    if (item.module === 'omni' && !hasOmni) return false;
    if (item.module === 'flow' && !hasFlow) return false;
    if (item.module === 'track' && !hasTrack) return false;
    return true;
  });

  const getProgressColor = (percent: number) => {
    if (percent >= 90) return 'bg-destructive';
    if (percent >= 75) return 'bg-yellow-500';
    return 'bg-primary';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Uso Atual</CardTitle>
        <CardDescription>
          Acompanhe o uso dos recursos do seu plano
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const percent = item.max > 0 ? (item.current / item.max) * 100 : 0;
            const isNearLimit = percent >= 75;
            const isAtLimit = percent >= 100;

            return (
              <div 
                key={item.resource}
                className={cn(
                  'p-4 rounded-lg border transition-colors',
                  isAtLimit && 'border-destructive bg-destructive/5',
                  isNearLimit && !isAtLimit && 'border-yellow-500 bg-yellow-500/5'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon className={cn(
                      'h-4 w-4',
                      isAtLimit ? 'text-destructive' : 'text-muted-foreground'
                    )} />
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  {isAtLimit && (
                    <Badge variant="destructive" className="text-xs">
                      Limite
                    </Badge>
                  )}
                </div>

                <Progress 
                  value={Math.min(percent, 100)} 
                  className={cn('h-2 mb-2', getProgressColor(percent))}
                />

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {item.current} / {item.max} {item.unit}
                  </span>
                  {isNearLimit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => onUpgrade(item.resource)}
                    >
                      Upgrade
                      <ArrowUpRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
