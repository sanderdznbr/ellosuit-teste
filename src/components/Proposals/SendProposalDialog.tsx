import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Mail, MessageCircle, Send, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const SUITE_COLOR = '#374DA4';

interface SendProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  proposalTitle: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  onSent?: () => void;
}

export default function SendProposalDialog({
  open, onOpenChange, proposalId, proposalTitle, clientName, clientEmail, clientPhone, onSent,
}: SendProposalDialogProps) {
  const { toast } = useToast();
  const [sendMethod, setSendMethod] = useState<'email' | 'whatsapp' | 'both'>('email');
  const [scopeMessage, setScopeMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [improving, setImproving] = useState(false);
  const [sent, setSent] = useState(false);

  const handleImproveWithAI = async () => {
    if (!scopeMessage.trim()) {
      toast({ title: 'Escreva uma mensagem primeiro', variant: 'destructive' });
      return;
    }
    setImproving(true);
    try {
      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          messages: [
            { role: 'system', content: 'Você é um especialista em propostas comerciais. Melhore o texto a seguir para soar mais profissional, persuasivo e claro. Mantenha o tom cordial e objetivo. Responda APENAS com o texto melhorado, sem explicações adicionais.' },
            { role: 'user', content: scopeMessage },
          ],
        },
      });
      if (error) throw error;
      // Handle streaming response - get text
      if (typeof data === 'string') {
        // Parse SSE
        const lines = data.split('\n');
        let result = '';
        for (const line of lines) {
          if (line.startsWith('data: ') && line.slice(6).trim() !== '[DONE]') {
            try {
              const parsed = JSON.parse(line.slice(6));
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) result += content;
            } catch { /* skip */ }
          }
        }
        if (result) setScopeMessage(result);
      }
    } catch {
      toast({ title: 'Erro ao melhorar com IA', variant: 'destructive' });
    } finally {
      setImproving(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-proposal', {
        body: { proposal_id: proposalId, send_method: sendMethod, scope_message: scopeMessage },
      });
      if (error) throw error;

      const results = data?.results || {};
      const msgs: string[] = [];
      if (results.email?.success) msgs.push('✅ Email enviado');
      if (results.email && !results.email.success) msgs.push(`❌ Email: ${results.email.error}`);
      if (results.whatsapp?.success) msgs.push('✅ WhatsApp enviado');
      if (results.whatsapp && !results.whatsapp.success) msgs.push(`❌ WhatsApp: ${results.whatsapp.error}`);

      setSent(true);
      toast({ title: 'Proposta enviada!', description: msgs.join('\n') });
      onSent?.();
      setTimeout(() => {
        onOpenChange(false);
        setSent(false);
        setScopeMessage('');
      }, 1500);
    } catch (e: any) {
      toast({ title: 'Erro ao enviar proposta', description: e.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md rounded-2xl">
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: '#16A34A20' }}>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Proposta Enviada!</h3>
            <p className="text-sm text-gray-500 mt-1">A proposta foi registrada como "Enviada"</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" style={{ color: SUITE_COLOR }} />
            Enviar Proposta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info */}
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500">Proposta</p>
            <p className="font-semibold text-sm text-gray-900">{proposalTitle}</p>
            <p className="text-xs text-gray-500 mt-1">Cliente: {clientName}</p>
          </div>

          {/* Send method */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Método de Envio</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'email' as const, icon: Mail, label: 'E-mail', info: clientEmail || 'Sem email', disabled: !clientEmail },
                { key: 'whatsapp' as const, icon: MessageCircle, label: 'WhatsApp', info: clientPhone || 'Sem telefone', disabled: !clientPhone },
                { key: 'both' as const, icon: Send, label: 'Ambos', info: 'Email + WhatsApp', disabled: !clientEmail && !clientPhone },
              ]).map(m => (
                <button
                  key={m.key}
                  onClick={() => !m.disabled && setSendMethod(m.key)}
                  disabled={m.disabled}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    sendMethod === m.key ? 'border-current shadow-sm' : 'border-gray-100 hover:border-gray-200'
                  } ${m.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                  style={sendMethod === m.key ? { borderColor: SUITE_COLOR, color: SUITE_COLOR } : {}}
                >
                  <m.icon className="h-5 w-5 mb-1" />
                  <p className="text-xs font-semibold text-gray-900">{m.label}</p>
                  <p className="text-[10px] text-gray-400 truncate">{m.info}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Scope message */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase">Mensagem do Escopo</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleImproveWithAI}
                disabled={improving || !scopeMessage.trim()}
                className="rounded-lg h-7 text-[11px] gap-1"
                style={{ color: SUITE_COLOR }}
              >
                {improving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Melhorar com IA
              </Button>
            </div>
            <Textarea
              value={scopeMessage}
              onChange={e => setScopeMessage(e.target.value)}
              placeholder="Descreva o escopo da proposta... (ex: Conforme alinhado em nossa reunião, segue proposta para o projeto de...)"
              className="rounded-xl min-h-[100px] text-sm"
            />
            <p className="text-[10px] text-gray-400 mt-1">Esta mensagem será incluída no envio ao cliente</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending}
              className="flex-1 rounded-xl text-white gap-2"
              style={{ background: SUITE_COLOR }}
            >
              {sending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
              ) : (
                <><Send className="h-4 w-4" /> Enviar Proposta</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
