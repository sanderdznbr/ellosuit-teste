import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type Permission = 
  | 'view_calendar'
  | 'manage_calendar'
  | 'view_clients'
  | 'manage_clients'
  | 'view_emails'
  | 'send_emails'
  | 'manage_email_campaigns'
  | 'view_documents'
  | 'manage_documents'
  | 'view_meetings'
  | 'create_meetings'
  | 'view_tasks'
  | 'manage_tasks'
  | 'view_analytics'
  | 'manage_settings'
  | 'manage_users'
  | 'view_crm'
  | 'manage_crm'
  | 'view_tracking'
  | 'manage_tracking';

interface PermissionsHook {
  permissions: Permission[];
  hasPermission: (permission: Permission) => boolean;
  isAdmin: boolean;
  isManager: boolean;
  loading: boolean;
}

export const usePermissions = (): PermissionsHook => {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const loadPermissions = async () => {
      try {
        // Get company and role
        const { data: companyUser } = await supabase
          .from('company_users')
          .select('company_id, role')
          .eq('user_id', user.id)
          .single();

        if (!companyUser) {
          setLoading(false);
          return;
        }

        setIsAdmin(companyUser.role === 'admin' || companyUser.role === 'adminmaster');
        setIsManager(companyUser.role === 'manager');

        // Admins have all permissions
        if (companyUser.role === 'admin' || companyUser.role === 'adminmaster') {
          setPermissions([
            'view_calendar', 'manage_calendar',
            'view_clients', 'manage_clients',
            'view_emails', 'send_emails', 'manage_email_campaigns',
            'view_documents', 'manage_documents',
            'view_meetings', 'create_meetings',
            'view_tasks', 'manage_tasks',
            'view_analytics', 'manage_settings', 'manage_users',
            'view_crm', 'manage_crm',
            'view_tracking', 'manage_tracking'
          ]);
          setLoading(false);
          return;
        }

        // Load specific permissions
        const { data: userPerms } = await supabase
          .from('user_permissions')
          .select('permission')
          .eq('user_id', user.id)
          .eq('company_id', companyUser.company_id);

        setPermissions((userPerms || []).map(p => p.permission as Permission));
      } catch (error) {
        console.error('Erro ao carregar permissões:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [user?.id]);

  const hasPermission = (permission: Permission): boolean => {
    if (isAdmin) return true;
    return permissions.includes(permission);
  };

  return {
    permissions,
    hasPermission,
    isAdmin,
    isManager,
    loading
  };
};
