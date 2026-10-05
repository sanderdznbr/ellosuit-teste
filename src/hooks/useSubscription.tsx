// Re-export everything from the context for backward compatibility
export type { 
  PlanType, 
  BillingCycle, 
  SubscriptionStatus, 
  ModuleType, 
  AddonType, 
  ResourceType, 
  SubscriptionLimits, 
  SubscriptionUsage, 
  SubscriptionModule, 
  SubscriptionAddon, 
  SubscriptionData 
} from '@/contexts/SubscriptionContext';

export { useSubscriptionContext as useSubscription } from '@/contexts/SubscriptionContext';
