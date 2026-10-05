
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Mail, Eye, Clock, Search, Filter } from 'lucide-react';

interface Email {
  id: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  sent_at: string;
  status: string;
  email_events: Array<{
    event_type: string;
    timestamp: string;
  }>;
}

const EmailList = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchEmails();
  }, []);

  const fetchEmails = async () => {
    try {
      const { data, error } = await supabase
        .from('emails')
        .select(`
          *,
          email_events (
            event_type,
            timestamp
          )
        `)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      setEmails(data || []);
    } catch (error) {
      console.error('Erro ao buscar emails:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmails = emails.filter(email =>
    email.recipient_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    email.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse bg-gray-200 h-8 rounded"></div>
        <div className="animate-pulse bg-gray-200 h-32 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Histórico de Emails</h2>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar emails..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filtros
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredEmails.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <Mail className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">Nenhum email encontrado</p>
            </CardContent>
          </Card>
        ) : (
          filteredEmails.map((email) => (
            <Card key={email.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{email.recipient_email}</span>
                      <Badge variant={email.status === 'sent' ? 'default' : 'destructive'}>
                        {email.status}
                      </Badge>
                    </div>
                    <h3 className="font-semibold mb-2">{email.subject}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(email.sent_at), { 
                          addSuffix: true, 
                          locale: ptBR 
                        })}
                      </div>
                      {email.email_events.some(e => e.event_type === 'opened') && (
                        <div className="flex items-center gap-1 text-green-600">
                          <Eye className="h-3 w-3" />
                          Aberto
                        </div>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Ver Detalhes
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default EmailList;
