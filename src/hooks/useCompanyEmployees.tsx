import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Employee {
  id: string;
  user_id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: string;
}

export const useCompanyEmployees = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadEmployees();
    }
  }, [user]);

  const loadEmployees = async () => {
    if (!user) return;

    try {
      // Get company
      const { data: companyUser } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyUser) return;
      setCompanyId(companyUser.company_id);

      // Get all employees in company
      const { data: companyUsers, error } = await supabase
        .from('company_users')
        .select(`
          id,
          user_id,
          role,
          profiles:user_id (
            id,
            full_name,
            avatar_url,
            email
          )
        `)
        .eq('company_id', companyUser.company_id);

      if (error) {
        console.error('Error loading employees:', error);
        return;
      }

      // Map to employee format - handle the case where profiles might not exist
      const employeeList: Employee[] = (companyUsers || []).map((cu: any) => {
        const profile = cu.profiles;
        return {
          id: cu.id,
          user_id: cu.user_id,
          email: profile?.email || 'Email não disponível',
          name: profile?.full_name || 'Usuário',
          avatar_url: profile?.avatar_url,
          role: cu.role
        };
      });

      setEmployees(employeeList);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return { employees, loading, companyId, refetch: loadEmployees };
};
