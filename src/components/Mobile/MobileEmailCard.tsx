import React from 'react';
import { Mail, Eye, Clock, TrendingUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MobileEmailCardProps {
  email: {
    id: string;
    subject: string;
    recipient: string;
    sent_at: string;
    status: 'sent' | 'delivered' | 'opened' | 'clicked';
    opens?: number;
    clicks?: number;
  };
  onClick?: () => void;
}

const MobileEmailCard: React.FC<MobileEmailCardProps> = ({ email, onClick }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-gray-100 text-gray-700';
      case 'delivered':
        return 'bg-[#DFE4FB] text-[#253573]';
      case 'opened':
        return 'bg-green-100 text-green-700';
      case 'clicked':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'opened':
        return <Eye className="h-3 w-3" />;
      case 'clicked':
        return <ExternalLink className="h-3 w-3" />;
      default:
        return <Mail className="h-3 w-3" />;
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short'
      });
    }
  };

  return (
    <div 
      className="bg-white rounded-2xl border border-gray-200 p-4 mb-3 shadow-sm active:scale-[0.98] transition-all"
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-base leading-tight truncate">
            {email.subject}
          </h3>
          <p className="text-sm text-gray-500 mt-1 truncate">
            Para: {email.recipient}
          </p>
        </div>
        
        <div className="ml-3 flex items-center space-x-2">
          <Badge className={cn("text-xs", getStatusColor(email.status))}>
            {getStatusIcon(email.status)}
            <span className="ml-1 capitalize">{email.status}</span>
          </Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {email.opens !== undefined && (
            <div className="flex items-center space-x-1">
              <Eye className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-gray-700">{email.opens}</span>
            </div>
          )}
          
          {email.clicks !== undefined && (
            <div className="flex items-center space-x-1">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium text-gray-700">{email.clicks}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-1 text-gray-400">
          <Clock className="h-3 w-3" />
          <span className="text-xs">{formatTime(email.sent_at)}</span>
        </div>
      </div>
    </div>
  );
};

export default MobileEmailCard;