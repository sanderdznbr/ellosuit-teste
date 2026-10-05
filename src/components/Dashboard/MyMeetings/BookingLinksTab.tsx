import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Globe, Plus, Copy, ExternalLink, Edit2, Trash2, 
  Calendar, Clock, Settings, Palette 
} from 'lucide-react';
import { useMyMeetings } from '@/hooks/useMyMeetings';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import BookingLinkCustomizer from './BookingLinkCustomizer';
import AvailabilityCalendar from './AvailabilityCalendar';

interface BookingLinksTabProps {
  bookingLinks: any[];
}

const BookingLinksTab: React.FC<BookingLinksTabProps> = ({ bookingLinks }) => {
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [activeTab, setActiveTab] = useState('links');
  const { createBookingLink, schedules, createSchedule, refreshData } = useMyMeetings();
  const { toast } = useToast();

  const handleCreateLink = async (linkData: any) => {
    await createBookingLink(linkData);
    setIsAddingLink(false);
  };

  const handleSaveAvailability = async (schedulesToSave: any[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: companyUser } = await supabase
        .from('company_users')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!companyUser) throw new Error('Usuário não associado a empresa');

      // Delete all existing schedules for this user
      await supabase
        .from('availability_schedules')
        .delete()
        .eq('user_id', user.id);

      // Insert new schedules
      if (schedulesToSave.length > 0) {
        const { error } = await supabase
          .from('availability_schedules')
          .insert(schedulesToSave.map(s => ({
            ...s,
            user_id: user.id,
            company_id: companyUser.company_id
          })));

        if (error) throw error;
      }

      toast({
        title: 'Sucesso',
        description: 'Disponibilidade salva com sucesso!'
      });

      refreshData();
    } catch (error) {
      console.error('Error saving availability:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao salvar disponibilidade',
        variant: 'destructive'
      });
    }
  };

  const toggleLinkStatus = async (linkId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('public_booking_links')
        .update({ is_active: !currentStatus })
        .eq('id', linkId);

      if (error) throw error;

      toast({
        title: 'Status atualizado',
        description: `Link ${!currentStatus ? 'ativado' : 'desativado'} com sucesso`
      });

      refreshData();
    } catch (error) {
      console.error('Error toggling link status:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar status do link',
        variant: 'destructive'
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado!',
      description: 'Link copiado para a área de transferência'
    });
  };

  const getPublicUrl = (slug: string) => {
    return `https://ellosuit.online/agendamentos/${slug}`;
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-6">
          <TabsList className="grid grid-cols-2 w-auto">
            <TabsTrigger value="links" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Links de Agendamento
            </TabsTrigger>
            <TabsTrigger value="availability" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Disponibilidade
            </TabsTrigger>
          </TabsList>
          
          {activeTab === 'links' && !isAddingLink && (
            <Button 
              onClick={() => setIsAddingLink(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Criar Link
            </Button>
          )}
        </div>

        <TabsContent value="links" className="space-y-6">
          {isAddingLink ? (
            <BookingLinkCustomizer
              onSave={handleCreateLink}
              onCancel={() => setIsAddingLink(false)}
            />
          ) : (
            <div className="grid gap-4">
              {bookingLinks.length === 0 ? (
                <Card className="p-8 text-center border-dashed border-2">
                  <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum link criado</h3>
                  <p className="text-muted-foreground mb-4">
                    Crie links públicos para que clientes possam agendar reuniões
                  </p>
                  <Button onClick={() => setIsAddingLink(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeiro Link
                  </Button>
                </Card>
              ) : (
                bookingLinks.map((link) => (
                  <Card key={link.id} className="hover:shadow-lg transition-all">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          {link.logo_url ? (
                            <img 
                              src={link.logo_url} 
                              alt={link.title}
                              className="w-14 h-14 rounded-xl object-cover"
                            />
                          ) : (
                            <div 
                              className="w-14 h-14 rounded-xl flex items-center justify-center"
                              style={{ backgroundColor: `${link.primary_color || '#3600FF'}20` }}
                            >
                              <Globe 
                                className="h-6 w-6" 
                                style={{ color: link.primary_color || '#3600FF' }}
                              />
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold truncate">{link.title}</h4>
                              <Badge variant={link.is_active ? 'default' : 'secondary'}>
                                {link.is_active ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </div>
                            
                            {link.description && (
                              <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                                {link.description}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {link.duration_minutes} min
                              </span>
                              <span>Buffer: {link.buffer_minutes} min</span>
                              {link.expires_at ? (
                                <span>
                                  Expira: {new Date(link.expires_at).toLocaleDateString('pt-BR')}
                                </span>
                              ) : (
                                <span className="text-green-600">Nunca expira</span>
                              )}
                            </div>
                            
                            <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center justify-between gap-2">
                                <code className="text-sm truncate flex-1">
                                  {getPublicUrl(link.link_slug)}
                                </code>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => copyToClipboard(getPublicUrl(link.link_slug))}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => window.open(getPublicUrl(link.link_slug), '_blank')}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={link.is_active}
                            onCheckedChange={() => toggleLinkStatus(link.id, link.is_active)}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="availability">
          <AvailabilityCalendar
            schedules={schedules}
            onSave={handleSaveAvailability}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BookingLinksTab;
