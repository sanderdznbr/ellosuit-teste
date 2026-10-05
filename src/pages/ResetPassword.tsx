import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, AlertCircle, Loader2, CheckCircle } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
        return;
      }
      setSuccess(true);
      setTimeout(() => navigate('/auth'), 2000);
    } catch {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Redefinir senha</h1>
          <p className="text-sm text-muted-foreground">
            Crie uma nova senha para sua conta
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center space-y-3">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
            <div>
              <p className="text-sm font-medium text-green-800">Senha redefinida com sucesso!</p>
              <p className="text-xs text-green-600 mt-1">Redirecionando para o login...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Nova senha</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="h-12 bg-muted/50 border-border rounded-md"
                autoFocus
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Confirmar nova senha</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                className="h-12 bg-muted/50 border-border rounded-md"
                required
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-md bg-foreground text-background hover:bg-foreground/90 text-sm font-semibold"
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Redefinir senha'}
            </Button>
          </form>
        )}

        <button
          type="button"
          onClick={() => navigate('/auth')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao login
        </button>
      </div>
    </div>
  );
}
