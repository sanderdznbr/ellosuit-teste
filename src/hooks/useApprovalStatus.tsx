 import { useState, useEffect } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from './useAuth';
 
 export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | null;
 
 export const useApprovalStatus = () => {
   const { user } = useAuth();
    const [status, setStatus] = useState<{ status: ApprovalStatus; createdAt?: string }>({ status: null });
   const [loading, setLoading] = useState(true);
 
   useEffect(() => {
     const fetchStatus = async () => {
       if (!user?.id) {
         setLoading(false);
         return;
       }
 
       try {
          const { data, error } = await supabase
            .from('profiles')
            .select('approval_status, created_at')
            .eq('id', user.id)
            .single();
  
          if (error) throw error;
          setStatus({ 
            status: data?.approval_status as ApprovalStatus,
            createdAt: data?.created_at
          });
       } catch (err) {
         console.error('Error fetching approval status:', err);
       } finally {
         setLoading(false);
       }
     };
 
     fetchStatus();
 
     // Set up real-time listener for status changes
     const channel = supabase
       .channel('profile-status-changes')
       .on(
         'postgres_changes',
         {
           event: 'UPDATE',
           schema: 'public',
           table: 'profiles',
           filter: `id=eq.${user?.id}`,
         },
          (payload) => {
            if (payload.new && 'approval_status' in payload.new) {
              setStatus(prev => ({
                ...prev,
                status: payload.new.approval_status as ApprovalStatus
              }));
            }
          }
       )
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
     };
   }, [user?.id]);
 
    return { status: status.status, loading, createdAt: status.createdAt };
 };