import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  hasSeenTour: boolean;
  hasCompany: boolean;
  preferences: {
    segment?: string;
    companySize?: string;
    mainGoals?: string[];
    recommendedTools?: string[];
    businessDescription?: string;
  } | null;
}

export const useOnboarding = () => {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState>({
    hasCompletedOnboarding: true, // Default true to prevent flash during load
    hasSeenTour: true,
    hasCompany: true,
    preferences: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Check localStorage first for quick response
        const localOnboarding = localStorage.getItem(`onboarding_${user.id}`);
        const localTour = localStorage.getItem(`tour_${user.id}`);
        
        // Check if user has a company
        const { data: companyUsers, error: companyError } = await supabase
          .from('company_users')
          .select('company_id')
          .eq('user_id', user.id)
          .limit(1);
        
        const hasCompany = !companyError && companyUsers && companyUsers.length > 0;
        
        console.log('🔍 Onboarding check:', { 
          userId: user.id, 
          hasCompany, 
          localOnboarding: !!localOnboarding,
          userCreatedAt: user.created_at
        });
        
        if (localOnboarding) {
          const parsed = JSON.parse(localOnboarding);
          setState({
            hasCompletedOnboarding: true,
            hasSeenTour: localTour === 'completed',
            hasCompany,
            preferences: parsed,
          });
        } else {
          // Check if user was created recently (within last 24 hours) - new user needs onboarding
          const createdAt = new Date(user.created_at || '');
          const now = new Date();
          const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          
          const isNewUser = createdAt > dayAgo;
          
          // If no company exists, always show onboarding regardless of creation time
          const needsOnboarding = !hasCompany || isNewUser;
          
          console.log('🆕 New user check:', { isNewUser, needsOnboarding, hasCompany, createdAt: createdAt.toISOString() });
          
          setState({
            hasCompletedOnboarding: !needsOnboarding,
            hasSeenTour: !needsOnboarding,
            hasCompany,
            preferences: null,
          });
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        // On error, default to showing the dashboard
        setState(prev => ({ ...prev, hasCompletedOnboarding: true, hasSeenTour: true }));
      } finally {
        setLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user]);

  const ensureCompanyExists = async (companyName?: string): Promise<string | null> => {
    if (!user) return null;

    try {
      // Check if company already exists
      const { data: existingCompany } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (existingCompany?.company_id) {
        console.log('✅ Company already exists:', existingCompany.company_id);
        return existingCompany.company_id;
      }

      // Create a new company
      const finalCompanyName = companyName || 
                              user.user_metadata?.company_name || 
                              user.user_metadata?.username || 
                              user.email?.split('@')[0] || 
                              'Minha Empresa';

      console.log('🏢 Creating company:', finalCompanyName);

      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({ name: finalCompanyName, settings: {} })
        .select('id')
        .single();

      if (companyError || !newCompany) {
        console.error('❌ Error creating company:', companyError);
        return null;
      }

      // Associate user with company
      const { error: associationError } = await supabase
        .from('company_users')
        .insert({ 
          company_id: newCompany.id, 
          user_id: user.id, 
          role: 'admin' 
        });

      if (associationError) {
        console.error('❌ Error associating user with company:', associationError);
        return null;
      }

      console.log('✅ Company created successfully:', newCompany.id);
      setState(prev => ({ ...prev, hasCompany: true }));
      return newCompany.id;
    } catch (error) {
      console.error('❌ Error in ensureCompanyExists:', error);
      return null;
    }
  };

  const completeOnboarding = async (preferences: OnboardingState['preferences']) => {
    if (!user) return;

    try {
      // Ensure company exists first with proper name from preferences
      const companyName = preferences?.businessDescription || 
                         user.user_metadata?.company_name;
      await ensureCompanyExists(companyName);

      // Save to localStorage
      localStorage.setItem(`onboarding_${user.id}`, JSON.stringify(preferences));
      
      setState(prev => ({
        ...prev,
        hasCompletedOnboarding: true,
        hasCompany: true,
        preferences,
      }));

      // Also try to save sidebar settings with recommended tools
      const { data: companyUser } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (companyUser && preferences?.recommendedTools) {
        // Update sidebar settings with recommended tools order
        const { data: existingSettings } = await supabase
          .from('user_sidebar_settings')
          .select('id')
          .eq('user_id', user.id)
          .eq('company_id', companyUser.company_id)
          .single();

        if (!existingSettings) {
          await supabase
            .from('user_sidebar_settings')
            .insert({
              user_id: user.id,
              company_id: companyUser.company_id,
              menu_order: preferences.recommendedTools,
            });
        }
      }
    } catch (error) {
      console.error('Error saving onboarding preferences:', error);
    }
  };

  const completeTour = () => {
    if (!user) return;
    
    localStorage.setItem(`tour_${user.id}`, 'completed');
    setState(prev => ({ ...prev, hasSeenTour: true }));
  };

  const skipOnboarding = async () => {
    if (!user) return;
    
    // Ensure company exists even when skipping
    await ensureCompanyExists();
    
    localStorage.setItem(`onboarding_${user.id}`, JSON.stringify({ skipped: true }));
    setState(prev => ({ 
      ...prev, 
      hasCompletedOnboarding: true,
      hasSeenTour: true,
      hasCompany: true
    }));
  };

  const resetOnboarding = () => {
    if (!user) return;
    
    localStorage.removeItem(`onboarding_${user.id}`);
    localStorage.removeItem(`tour_${user.id}`);
    setState({
      hasCompletedOnboarding: false,
      hasSeenTour: false,
      hasCompany: state.hasCompany,
      preferences: null,
    });
  };

  return {
    ...state,
    loading,
    completeOnboarding,
    completeTour,
    skipOnboarding,
    resetOnboarding,
    ensureCompanyExists,
  };
};

export default useOnboarding;
