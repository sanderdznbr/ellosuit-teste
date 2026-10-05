import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

 export type PlanType = 'free' | 'base' | 'pro' | 'business' | 'enterprise' | 'custom' | 'partner';
export type BillingCycle = 'monthly' | 'yearly';
export type SubscriptionStatus = 'free' | 'active' | 'canceled' | 'past_due' | 'trialing';
export type ModuleType = 'omni' | 'flow' | 'track' | 'suite';
export type AddonType = 'users' | 'storage' | 'emails' | 'ai_agents' | 'whatsapp_sessions' | 'booking_links' | 'meeting_hours' | 'tracked_docs' | 'priority_support';
export type ResourceType = 'users' | 'storage_gb' | 'emails_sent' | 'ai_agents_active' | 'whatsapp_sessions_active' | 'booking_links_active' | 'meeting_hours_used' | 'tracked_docs_created' | 'tracked_links_created' | 'tracked_videos_created';

export interface SubscriptionLimits {
  maxUsers: number;
  maxStorageGb: number;
  maxEmailsMonth: number;
  maxAiAgents: number;
  maxWhatsappSessions: number;
  maxBookingLinks: number;
  maxMeetingHours: number;
  maxTrackedDocs: number;
  maxTrackedLinks: number;
  maxTrackedVideos: number;
  maxChatbotFlows: number;
  maxMeetingParticipants: number;
  hasMeetingRecording: boolean;
  hasPrioritySupport: boolean;
}

export interface SubscriptionUsage {
  currentUsers: number;
  storageUsedGb: number;
  emailsSentThisMonth: number;
  aiAgentsActive: number;
  whatsappSessionsActive: number;
  bookingLinksActive: number;
  meetingHoursUsed: number;
  trackedDocsCreated: number;
  trackedLinksCreated: number;
  trackedVideosCreated: number;
}

export interface SubscriptionModule {
  type: ModuleType;
  isActive: boolean;
  monthlyPrice: number;
}

export interface SubscriptionAddon {
  type: AddonType;
  quantity: number;
  unitPrice: number;
  isActive: boolean;
}

export interface SubscriptionData {
  isLoading: boolean;
  isActive: boolean;
  isFree: boolean;
  planType: PlanType;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  monthlyPrice: number;
  baseUsersIncluded: number;
  isTrialActive: boolean;
  isTrialExpired: boolean;
  trialDaysRemaining: number;
  modules: SubscriptionModule[];
  hasOmni: boolean;
  hasFlow: boolean;
  hasTrack: boolean;
  addons: SubscriptionAddon[];
  limits: SubscriptionLimits;
  usage: SubscriptionUsage;
  hasModule: (module: ModuleType) => boolean;
  hasModuleAccess: (module: ModuleType) => boolean;
  checkLimit: (resource: ResourceType) => boolean;
  getUsagePercent: (resource: ResourceType) => number;
  canAddUser: () => boolean;
  canAddWhatsApp: () => boolean;
  canAddBookingLink: () => boolean;
  canAddAiAgent: () => boolean;
  canSendEmail: () => boolean;
  canCreateTrackedDoc: () => boolean;
  refetch: () => Promise<void>;
}

const defaultLimits: SubscriptionLimits = {
  maxUsers: 2,
  maxStorageGb: 5,
  maxEmailsMonth: 0,
  maxAiAgents: 0,
  maxWhatsappSessions: 0,
  maxBookingLinks: 0,
  maxMeetingHours: 0,
  maxTrackedDocs: 0,
  maxTrackedLinks: 0,
  maxTrackedVideos: 0,
  maxChatbotFlows: 0,
  maxMeetingParticipants: 4,
  hasMeetingRecording: false,
  hasPrioritySupport: false,
};

const defaultUsage: SubscriptionUsage = {
  currentUsers: 0,
  storageUsedGb: 0,
  emailsSentThisMonth: 0,
  aiAgentsActive: 0,
  whatsappSessionsActive: 0,
  bookingLinksActive: 0,
  meetingHoursUsed: 0,
  trackedDocsCreated: 0,
  trackedLinksCreated: 0,
  trackedVideosCreated: 0,
};

const SubscriptionContext = createContext<SubscriptionData | undefined>(undefined);

function useCompanyId() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCompanyId() {
      if (!user) {
        setCompanyId(null);
        return;
      }
      const { data } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      setCompanyId(data?.company_id || null);
    }
    fetchCompanyId();
  }, [user]);

  return companyId;
}

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const companyId = useCompanyId();
  const [isLoading, setIsLoading] = useState(true);
  const hasFetchedOnce = useRef(false);
  const [planType, setPlanType] = useState<PlanType>('free');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [status, setStatus] = useState<SubscriptionStatus>('free');
  const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<Date | null>(null);
  const [monthlyPrice, setMonthlyPrice] = useState(97);
  const [baseUsersIncluded, setBaseUsersIncluded] = useState(2);
  const [modules, setModules] = useState<SubscriptionModule[]>([]);
  const [addons, setAddons] = useState<SubscriptionAddon[]>([]);
  const [limits, setLimits] = useState<SubscriptionLimits>(defaultLimits);
  const [usage, setUsage] = useState<SubscriptionUsage>(defaultUsage);

  const fetchSubscriptionData = useCallback(async () => {
    if (!companyId) {
      setIsLoading(false);
      return;
    }

    try {
      // Only show loading on first fetch — subsequent fetches are silent
      if (!hasFetchedOnce.current) {
        setIsLoading(true);
      }

      const [
        { data: subscription },
        { data: modulesData },
        { data: addonsData },
        { data: limitsData },
      ] = await Promise.all([
        supabase.from('subscriptions').select('*').eq('company_id', companyId).single(),
        supabase.from('subscription_modules').select('*').eq('company_id', companyId),
        supabase.from('subscription_addons').select('*').eq('company_id', companyId).eq('is_active', true),
        supabase.from('subscription_limits').select('*').eq('company_id', companyId).single(),
      ]);

      if (subscription) {
        setPlanType(subscription.plan_type as PlanType);
        setBillingCycle(subscription.billing_cycle as BillingCycle);
        setStatus(subscription.status as SubscriptionStatus);
        setTrialEndsAt(subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null);
        setCurrentPeriodEnd(subscription.current_period_end ? new Date(subscription.current_period_end) : null);
        setMonthlyPrice(Number(subscription.monthly_price));
        setBaseUsersIncluded(subscription.base_users_included);
      }

      if (modulesData) {
        setModules(modulesData.map(m => ({
          type: m.module_type as ModuleType,
          isActive: m.is_active,
          monthlyPrice: Number(m.monthly_price),
        })));
      }

      if (addonsData) {
        setAddons(addonsData.map(a => ({
          type: a.addon_type as AddonType,
          quantity: a.quantity,
          unitPrice: Number(a.unit_price),
          isActive: a.is_active,
        })));
      }

      if (limitsData) {
        setLimits({
          maxUsers: limitsData.max_users,
          maxStorageGb: limitsData.max_storage_gb,
          maxEmailsMonth: limitsData.max_emails_month,
          maxAiAgents: limitsData.max_ai_agents,
          maxWhatsappSessions: limitsData.max_whatsapp_sessions,
          maxBookingLinks: limitsData.max_booking_links,
          maxMeetingHours: limitsData.max_meeting_hours,
          maxTrackedDocs: limitsData.max_tracked_docs,
          maxTrackedLinks: limitsData.max_tracked_links,
          maxTrackedVideos: limitsData.max_tracked_videos,
          maxChatbotFlows: limitsData.max_chatbot_flows,
          maxMeetingParticipants: limitsData.max_meeting_participants,
          hasMeetingRecording: limitsData.has_meeting_recording,
          hasPrioritySupport: limitsData.has_priority_support,
        });
      }

      const [
        { count: usersCount },
        { count: aiAgentsCount },
        { count: whatsappSessionsCount },
        { count: bookingLinksCount },
      ] = await Promise.all([
        supabase.from('company_users').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
        supabase.from('ai_agents').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true),
        supabase.from('whatsapp_sessions').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'connected'),
        supabase.from('booking_links').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('is_active', true),
      ]);

      setUsage(prev => ({
        ...prev,
        currentUsers: usersCount || 0,
        aiAgentsActive: aiAgentsCount || 0,
        whatsappSessionsActive: whatsappSessionsCount || 0,
        bookingLinksActive: bookingLinksCount || 0,
      }));

      hasFetchedOnce.current = true;
    } catch (error) {
      console.error('Error fetching subscription data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      fetchSubscriptionData();
    } else if (!user) {
      // No user = not loading
      setIsLoading(false);
    }
  }, [companyId, fetchSubscriptionData, user]);

  const now = new Date();
  const isTrialActive = status === 'trialing' && trialEndsAt !== null && trialEndsAt > now;
  const isTrialExpired = status === 'trialing' && trialEndsAt !== null && trialEndsAt <= now;
  const trialDaysRemaining = isTrialActive && trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

   const hasModule = useCallback((module: ModuleType): boolean => {
     if (planType === 'partner' || planType === 'enterprise' || planType === 'business') return true;
    if (planType === 'pro' && (module === 'omni' || module === 'flow')) return true;
    return modules.some(m => m.type === module && m.isActive);
  }, [planType, modules]);

   const isFree = (status === 'free' || planType === 'free') && planType !== 'partner';

  const hasModuleAccess = useCallback((module: ModuleType): boolean => {
    if (isFree) return false;
    if (isTrialActive) return true;
    return hasModule(module);
  }, [isFree, isTrialActive, hasModule]);

  const hasOmni = hasModule('omni');
  const hasFlow = hasModule('flow');
  const hasTrack = hasModule('track');

  const checkLimit = useCallback((resource: ResourceType): boolean => {
    switch (resource) {
      case 'users': return usage.currentUsers < limits.maxUsers;
      case 'storage_gb': return usage.storageUsedGb < limits.maxStorageGb;
      case 'emails_sent': return usage.emailsSentThisMonth < limits.maxEmailsMonth;
      case 'ai_agents_active': return usage.aiAgentsActive < limits.maxAiAgents;
      case 'whatsapp_sessions_active': return usage.whatsappSessionsActive < limits.maxWhatsappSessions;
      case 'booking_links_active': return usage.bookingLinksActive < limits.maxBookingLinks;
      case 'meeting_hours_used': return usage.meetingHoursUsed < limits.maxMeetingHours;
      case 'tracked_docs_created': return usage.trackedDocsCreated < limits.maxTrackedDocs;
      case 'tracked_links_created': return usage.trackedLinksCreated < limits.maxTrackedLinks;
      case 'tracked_videos_created': return usage.trackedVideosCreated < limits.maxTrackedVideos;
      default: return true;
    }
  }, [usage, limits]);

  const getUsagePercent = useCallback((resource: ResourceType): number => {
    switch (resource) {
      case 'users': return limits.maxUsers > 0 ? (usage.currentUsers / limits.maxUsers) * 100 : 0;
      case 'storage_gb': return limits.maxStorageGb > 0 ? (usage.storageUsedGb / limits.maxStorageGb) * 100 : 0;
      case 'emails_sent': return limits.maxEmailsMonth > 0 ? (usage.emailsSentThisMonth / limits.maxEmailsMonth) * 100 : 0;
      case 'ai_agents_active': return limits.maxAiAgents > 0 ? (usage.aiAgentsActive / limits.maxAiAgents) * 100 : 0;
      case 'whatsapp_sessions_active': return limits.maxWhatsappSessions > 0 ? (usage.whatsappSessionsActive / limits.maxWhatsappSessions) * 100 : 0;
      case 'booking_links_active': return limits.maxBookingLinks > 0 ? (usage.bookingLinksActive / limits.maxBookingLinks) * 100 : 0;
      case 'meeting_hours_used': return limits.maxMeetingHours > 0 ? (usage.meetingHoursUsed / limits.maxMeetingHours) * 100 : 0;
      case 'tracked_docs_created': return limits.maxTrackedDocs > 0 ? (usage.trackedDocsCreated / limits.maxTrackedDocs) * 100 : 0;
      case 'tracked_links_created': return limits.maxTrackedLinks > 0 ? (usage.trackedLinksCreated / limits.maxTrackedLinks) * 100 : 0;
      case 'tracked_videos_created': return limits.maxTrackedVideos > 0 ? (usage.trackedVideosCreated / limits.maxTrackedVideos) * 100 : 0;
      default: return 0;
    }
  }, [usage, limits]);

  const canAddUser = useCallback(() => checkLimit('users'), [checkLimit]);
  const canAddWhatsApp = useCallback(() => hasModuleAccess('omni') && checkLimit('whatsapp_sessions_active'), [hasModuleAccess, checkLimit]);
  const canAddBookingLink = useCallback(() => hasModuleAccess('flow') && checkLimit('booking_links_active'), [hasModuleAccess, checkLimit]);
  const canAddAiAgent = useCallback(() => hasModuleAccess('omni') && checkLimit('ai_agents_active'), [hasModuleAccess, checkLimit]);
  const canSendEmail = useCallback(() => hasModuleAccess('omni') && checkLimit('emails_sent'), [hasModuleAccess, checkLimit]);
  const canCreateTrackedDoc = useCallback(() => hasModuleAccess('track') && checkLimit('tracked_docs_created'), [hasModuleAccess, checkLimit]);

   const isActive = (status === 'active' || isTrialActive || planType === 'partner') && !isFree;

  const value: SubscriptionData = {
    isLoading,
    isActive,
    isFree,
    planType,
    billingCycle,
    status,
    trialEndsAt,
    currentPeriodEnd,
    monthlyPrice,
    baseUsersIncluded,
    isTrialActive,
    isTrialExpired,
    trialDaysRemaining,
    modules,
    hasOmni,
    hasFlow,
    hasTrack,
    addons,
    limits,
    usage,
    hasModule,
    hasModuleAccess,
    checkLimit,
    getUsagePercent,
    canAddUser,
    canAddWhatsApp,
    canAddBookingLink,
    canAddAiAgent,
    canSendEmail,
    canCreateTrackedDoc,
    refetch: fetchSubscriptionData,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export function useSubscriptionContext(): SubscriptionData {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscriptionContext must be used within a SubscriptionProvider');
  }
  return context;
}
