import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, Users, LogIn } from 'lucide-react';

const AcceptInvite = () => {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'ready' | 'accepting' | 'success' | 'error' | 'login_required'>('loading');
  const [invitation, setInvitation] = useState<any>(null);
  const [companyName, setCompanyName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadInvitation();
  }, [token]);

  useEffect(() => {
    if (user && status === 'login_required') {
      setStatus('ready');
    }
  }, [user]);

  const loadInvitation = async () => {
    try {
      const { data, error } = await supabase
        .from('team_invitations')
        .select('*, companies:company_id(name)')
        .eq('token', token)
        .single();

      if (error || !data) {
        setErrorMsg('Convite não encontrado ou inválido.');
        setStatus('error');
        return;
      }

      if (data.status !== 'pending') {
        setErrorMsg(data.status === 'accepted' ? 'Este convite já foi aceito.' : 'Este convite foi cancelado ou expirou.');
        setStatus('error');
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setErrorMsg('Este convite expirou.');
        setStatus('error');
        return;
      }

      setInvitation(data);
      setCompanyName((data as any).companies?.name || 'Empresa');
      setStatus(user ? 'ready' : 'login_required');
    } catch {
      setErrorMsg('Erro ao carregar convite.');
      setStatus('error');
    }
  };

  const handleAccept = async () => {
    setStatus('accepting');
    try {
      const { data, error } = await supabase.functions.invoke('team-invite', {
        body: { action: 'accept-invite', token },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setStatus('success');
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao aceitar convite');
      setStatus('error');
    }
  };

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrador',
    manager: 'Gerente',
    employee: 'Colaborador',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="p-8 text-center space-y-6">
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">Carregando convite...</p>
            </>
          )}

          {status === 'login_required' && (
            <>
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <LogIn className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">Convite para {companyName}</h2>
                <p className="text-muted-foreground text-sm mb-1">
                  Você foi convidado como <Badge variant="outline">{ROLE_LABELS[invitation?.role] || 'Colaborador'}</Badge>
                </p>
                <p className="text-muted-foreground text-sm">
                  Para aceitar, faça login ou crie uma conta com o email <strong>{invitation?.email}</strong>
                </p>
              </div>
              <Button onClick={() => navigate(`/auth?redirect=/convite/${token}`)} className="w-full">
                <LogIn className="h-4 w-4 mr-2" /> Fazer Login / Criar Conta
              </Button>
            </>
          )}

          {status === 'ready' && invitation && (
            <>
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">Entrar em {companyName}</h2>
                <p className="text-muted-foreground text-sm">
                  Você foi convidado como <Badge variant="outline">{ROLE_LABELS[invitation.role] || 'Colaborador'}</Badge>
                </p>
                {invitation.permissions?.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">{invitation.permissions.length} permissão(ões) pré-configuradas</p>
                )}
              </div>
              <Button onClick={handleAccept} className="w-full" size="lg">
                Aceitar Convite
              </Button>
            </>
          )}

          {status === 'accepting' && (
            <>
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">Aceitando convite...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">Bem-vindo à equipe!</h2>
                <p className="text-muted-foreground text-sm">Redirecionando para o dashboard...</p>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">Ops!</h2>
                <p className="text-muted-foreground text-sm">{errorMsg}</p>
              </div>
              <Button variant="outline" onClick={() => navigate('/')}>Voltar ao Início</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvite;
