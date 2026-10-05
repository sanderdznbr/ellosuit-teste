import React, { useState } from 'react';
import { CheckCircle, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const TaskLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSignUp) {
      if (!email || !password || !username || !companyName) {
        setError('Por favor, preencha todos os campos');
        return;
      }
      if (password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres');
        return;
      }
    } else {
      if (!email || !password) {
        setError('Por favor, preencha todos os campos');
        return;
      }
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, username, companyName);
        if (error) {
          if (error.message.includes('already registered')) {
            setError('Este email já está cadastrado. Tente fazer login.');
          } else {
            setError('Erro ao criar conta. Tente novamente.');
          }
        } else {
          setSuccess('Conta criada com sucesso! Verifique seu email para confirmação.');
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            setError('Email ou senha inválidos');
          } else if (error.message.includes('Email not confirmed')) {
            setError('Por favor, confirme seu email antes de fazer login');
          } else {
            setError('Erro ao fazer login. Tente novamente.');
          }
        }
      }
    } catch (error) {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setSuccess('');
    setEmail('');
    setPassword('');
    setUsername('');
    setCompanyName('');
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-md mx-auto px-6 py-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#DFE4FB] rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-[#2F428D]" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Seus Lembretes
            </h1>
            <p className="text-gray-600">
              {isSignUp ? 'Crie sua conta para começar' : 'Faça login para acessar suas tarefas'}
            </p>
          </div>
        </div>
      </div>

      {/* Login Form */}
      <div className="max-w-md mx-auto px-6 py-8">
        <div className="bg-gray-50 rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-medium text-gray-700">
                    Nome de usuário
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-white border-gray-200"
                    placeholder="Seu nome"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyName" className="text-sm font-medium text-gray-700">
                    Nome da empresa
                  </Label>
                  <Input
                    id="companyName"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="bg-white border-gray-200"
                    placeholder="Nome da sua empresa"
                    required
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-white border-gray-200"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Senha
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-white border-gray-200"
                  placeholder={isSignUp ? "Mínimo 6 caracteres" : "Digite sua senha"}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700 text-sm">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-200 bg-green-50">
                <AlertDescription className="text-green-700 text-sm">
                  {success}
                </AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full bg-[#2F428D] hover:bg-[#253573] text-white"
              disabled={loading}
            >
              {loading ? (isSignUp ? 'Criando conta...' : 'Entrando...') : (isSignUp ? 'Criar conta' : 'Entrar')}
            </Button>

            <div className="text-center pt-4">
              <button
                type="button"
                onClick={toggleMode}
                className="text-[#2F428D] hover:text-[#253573] text-sm font-medium"
              >
                {isSignUp ? 'Já tem uma conta? Faça login' : 'Não tem conta? Cadastre-se'}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-gray-500">
            Seus dados são seguros e criptografados
          </p>
        </div>
      </div>
    </div>
  );
};

export default TaskLogin;