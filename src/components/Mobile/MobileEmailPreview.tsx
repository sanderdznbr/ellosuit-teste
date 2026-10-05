
import React from 'react';
import { Mail, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface MobileEmailPreviewProps {
  onNavigate: (item: string) => void;
}

const MobileEmailPreview: React.FC<MobileEmailPreviewProps> = ({ onNavigate }) => {
  // Mock data para preview
  const mockEmails = [
    {
      id: '1',
      subject: 'Proposta de Parceria',
      recipient: 'cliente@empresa.com',
      status: 'opened',
      opens: 3,
      sent_at: new Date().toISOString()
    },
    {
      id: '2',
      subject: 'Newsletter Semanal',
      recipient: 'contato@cliente.com',
      status: 'delivered',
      opens: 1,
      sent_at: new Date(Date.now() - 86400000).toISOString()
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'opened':
        return 'bg-green-100 text-green-700';
      case 'delivered':
        return 'bg-[#DFE4FB] text-[#253573]';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Mail className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold text-gray-900">Emails</h3>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => onNavigate('email')}
        >
          Ver todos
        </Button>
      </div>

      <div className="space-y-3">
        {mockEmails.map((email) => (
          <div key={email.id} className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {email.subject}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {email.recipient}
                </p>
              </div>
              <Badge className={`text-xs ${getStatusColor(email.status)}`}>
                {email.status}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-500">{email.opens} aberturas</span>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(email.sent_at).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default MobileEmailPreview;
