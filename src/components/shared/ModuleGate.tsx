import React from 'react';
import { useSubscription, type ModuleType } from '@/hooks/useSubscription';
 import { useAdminMaster } from '@/hooks/useAdminMaster';
 import { useApprovalStatus } from '@/hooks/useApprovalStatus';
 import { Navigate } from 'react-router-dom';
import LockedFeaturePage from './LockedFeaturePage';

interface ModuleGateProps {
  module: ModuleType;
  children: React.ReactNode;
}

export default function ModuleGate({ module, children }: ModuleGateProps) {
   const { isLoading, hasModuleAccess } = useSubscription();
   const { isAdminMaster, loading: adminLoading } = useAdminMaster();
   const { status, loading: statusLoading } = useApprovalStatus();
 
   if (isLoading || adminLoading || statusLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-[#374DA4] rounded-full animate-spin" />
      </div>
    );
  }

   // Only block explicitly rejected users. Pending/null is treated as approved
   // to avoid the 24h friction that killed trial conversion.
   if (status === 'rejected') {
     return <Navigate to="/pending-approval" replace />;
   }

    if (isAdminMaster) {
      return <>{children}</>;
    }
 
   if (!hasModuleAccess(module)) {
     return <LockedFeaturePage module={module}>{children}</LockedFeaturePage>;
   }
 
   return <>{children}</>;
 }
