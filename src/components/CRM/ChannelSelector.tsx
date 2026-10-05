import React, { useState } from 'react';
import { Plus, Phone, Check, ChevronDown, Trash2, RefreshCw, Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface WhatsAppSession {
  id: string;
  instance_name: string;
  status: string;
  phone_number?: string;
  phone_name?: string;
  profile_picture?: string;
}

interface ChannelSelectorProps {
  sessions: WhatsAppSession[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onAddNew: () => void;
  onReconnect?: () => void;
  onSessionDeleted?: () => void;
}

export function ChannelSelector({ 
  sessions, 
  selectedSessionId, 
  onSelectSession, 
  onAddNew,
  onReconnect,
  onSessionDeleted
}: ChannelSelectorProps) {
  const { toast } = useToast();
  const [deleteSession, setDeleteSession] = useState<WhatsAppSession | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmCleanup, setConfirmCleanup] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);

  const connectedSessions = sessions.filter(s => s.status === 'connected');
  const inactiveSessions = sessions.filter(s => s.status !== 'connected');
  const isAll = selectedSessionId === 'ALL';
  const selectedSession = isAll ? null : (sessions.find(s => s.id === selectedSessionId) || connectedSessions[0]);
  
  const formatPhoneNumber = (phone?: string) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  const getChannelTitle = (s: WhatsAppSession) => {
    const formatted = formatPhoneNumber(s.phone_number);
    if (formatted) return formatted;
    if (s.phone_name) return s.phone_name;
    return 'WhatsApp';
  };

  const handleDeleteSession = async () => {
    if (!deleteSession) return;
    
    setDeleting(true);
    try {
      // First, disconnect & delete the instance on Evolution API (best-effort)
      try {
        await supabase.functions.invoke('whatsapp-api', {
          body: { action: 'delete_session', sessionId: deleteSession.id },
        });
      } catch (e) {
        console.warn('[ChannelSelector] delete_session remote call failed:', e);
      }

      // Delete all conversations for this session
      await supabase
        .from('whatsapp_conversations')
        .delete()
        .eq('session_id', deleteSession.id);
      
      // Delete the session
      const { error } = await supabase
        .from('whatsapp_sessions')
        .delete()
        .eq('id', deleteSession.id);
      
      if (error) throw error;
      
      toast({
        title: 'Canal excluído',
        description: `O canal ${deleteSession.phone_name || deleteSession.instance_name} foi desconectado e removido.`
      });
      
      onSessionDeleted?.();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setDeleting(false);
      setDeleteSession(null);
    }
  };

  const handleCleanupInactive = async () => {
    setCleaningUp(true);
    try {
      const ids = inactiveSessions.map(s => s.id);
      if (ids.length === 0) {
        setConfirmCleanup(false);
        return;
      }
      await supabase
        .from('whatsapp_conversations')
        .delete()
        .in('session_id', ids);

      const { error } = await supabase
        .from('whatsapp_sessions')
        .delete()
        .in('id', ids);

      if (error) throw error;

      toast({
        title: 'Sessões inativas removidas',
        description: `${ids.length} sessão(ões) inativa(s) excluída(s).`
      });
      onSessionDeleted?.();
    } catch (error: any) {
      toast({
        title: 'Erro ao limpar sessões',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setCleaningUp(false);
      setConfirmCleanup(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-1 p-2 border-b bg-muted/30">
        {/* Channel Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="flex-1 justify-start gap-2 h-12 px-2 hover:bg-muted"
            >
              {isAll ? (
                <>
                  <div className="h-8 w-8 rounded-full bg-[#374DA4]/10 flex items-center justify-center">
                    <Phone className="h-4 w-4 text-[#374DA4]" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium truncate">Todos os canais</p>
                    <p className="text-xs text-muted-foreground truncate">Mensagens de todas as conexões</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                </>
              ) : selectedSession ? (
                <>
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={selectedSession.profile_picture} />
                      <AvatarFallback className="bg-[#25D366] text-white text-xs">
                        <Phone className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <span className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                      selectedSession.status === 'connected' ? "bg-green-500" : "bg-red-500"
                    )} />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium truncate">
                      {getChannelTitle(selectedSession)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedSession.phone_name || 'Canal ativo'}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                </>
              ) : (
                <>
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">Selecionar canal</p>
                    <p className="text-xs text-muted-foreground">Nenhum conectado</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </>
              )}
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuItem
              onClick={() => onSelectSession('ALL')}
              className="flex items-center gap-3 p-2 cursor-pointer"
            >
              <div className="h-8 w-8 rounded-full bg-[#374DA4]/10 flex items-center justify-center">
                <Phone className="h-4 w-4 text-[#374DA4]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Ver todos os canais</p>
                <p className="text-xs text-muted-foreground truncate">Mensagens de todas as conexões</p>
              </div>
              {isAll && <Check className="h-4 w-4 text-[#374DA4] shrink-0" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {sessions.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Nenhum canal configurado
              </div>
            ) : (
              sessions.map(session => (
                <DropdownMenuItem 
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className="flex items-center gap-3 p-2 cursor-pointer"
                >
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={session.profile_picture} />
                      <AvatarFallback className="bg-[#25D366] text-white text-xs">
                        <Phone className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <span className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                      session.status === 'connected' ? "bg-green-500" : "bg-red-500"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {getChannelTitle(session)}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {session.phone_name || (session.status === 'connected' ? 'Conectado' : 'Desconectado')}
                    </p>
                  </div>
                  {selectedSession?.id === session.id && (
                    <Check className="h-4 w-4 text-[#25D366] shrink-0" />
                  )}
                  {/* Reconnect button for disconnected sessions */}
                  {session.status !== 'connected' && onReconnect && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-[#374DA4] hover:bg-[#374DA4]/10"
                      title="Reconectar sessão"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSession(session.id);
                        onReconnect();
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                  {/* Delete button — disconnects and removes the session */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Apagar sessão (desconecta automaticamente)"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteSession(session);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </DropdownMenuItem>
              ))
            )}
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem 
              onClick={onAddNew}
              className="flex items-center gap-2 text-[#374DA4] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Adicionar novo canal</span>
            </DropdownMenuItem>
            {inactiveSessions.length > 0 && (
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setConfirmCleanup(true);
                }}
                className="flex items-center gap-2 text-destructive cursor-pointer"
              >
                <Eraser className="h-4 w-4" />
                <span>Limpar todas sessões inativas ({inactiveSessions.length})</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Quick Add Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="shrink-0 h-10 w-10 hover:bg-[#374DA4]/10 hover:text-[#374DA4]"
                onClick={onAddNew}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Conectar novo WhatsApp</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteSession} onOpenChange={(open) => !open && setDeleteSession(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir canal?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá remover o canal <strong>{deleteSession?.phone_name || deleteSession?.instance_name}</strong> e todas as suas conversas. 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSession}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Excluir canal'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmCleanup} onOpenChange={(open) => !open && setConfirmCleanup(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar sessões inativas?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá remover <strong>{inactiveSessions.length}</strong> sessão(ões) desconectada(s) e todas as suas conversas.
              Sessões conectadas não serão afetadas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cleaningUp}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCleanupInactive}
              disabled={cleaningUp}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cleaningUp ? 'Limpando...' : 'Limpar todas'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
