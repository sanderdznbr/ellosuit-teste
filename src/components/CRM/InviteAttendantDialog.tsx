import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus } from 'lucide-react';

interface InviteAttendantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  onInvited?: () => void;
}

export default function InviteAttendantDialog({ open, onOpenChange, companyId, onInvited }: InviteAttendantDialogProps) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast({ title: 'E-mail inválido', description: 'Digite um e-mail válido.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('team-invite', {
        body: {
          action: 'send-invite',
          email: trimmed,
          role: 'attendant',
          permissions: ['crm.view'],
          companyId,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: 'Convite enviado', description: `Enviamos um convite para ${trimmed}.` });
      setEmail('');
      onOpenChange(false);
      onInvited?.();
    } catch (e: any) {
      toast({ title: 'Erro ao convidar', description: e?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" /> Convidar atendente
          </DialogTitle>
          <DialogDescription>
            Envie um convite por e-mail. O atendente verá apenas as conversas atribuídas a ele.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="invite-email">E-mail</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="atendente@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleInvite(); }}
            disabled={loading}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleInvite} disabled={loading || !email.trim()}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
            Enviar convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}