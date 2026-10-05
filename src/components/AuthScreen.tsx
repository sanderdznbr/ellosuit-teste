
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { motion, AnimatePresence } from 'framer-motion';

import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, Loader2, ArrowLeft, Mail, Lock, User, Building2, Eye, EyeOff } from 'lucide-react';
import { EllosuitMark } from '@/components/shared/EllosuitMark';
import authHero from '@/assets/auth-hero.webp';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileAuthScreen from '@/components/Mobile/MobileAuthScreen';
import { useAdminMaster } from '@/hooks/useAdminMaster';
import { useApprovalStatus } from '@/hooks/useApprovalStatus';

const AuthScreen = () => {
  const { isMobile } = useIsMobile();
  
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);
  const [step, setStep] = useState<'identifier' | 'password'>('identifier');
  
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
   const { user, signIn, signUp } = useAuth();
   const { isAdminMaster, loading: adminLoading } = useAdminMaster();
   const { status: approvalStatus, loading: statusLoading } = useApprovalStatus();
   const navigate = useNavigate();
  const location = useLocation();

    const getReturnPath = () => {
      const urlParams = new URLSearchParams(location.search);
      const returnTo = urlParams.get('returnTo');
      if (returnTo === 'tarefas') return '/tarefas';
      // Only rejected users hit the wall — pending/null flows straight to the dashboard.
      if (user && approvalStatus === 'rejected') return '/pending-approval';
      if (isAdminMaster) return '/dashboard/admin';
      return '/dashboard';
    };

   useEffect(() => {
     if (user && !adminLoading && !statusLoading) {
       // Reset splash timestamp on login to ensure it shows
       sessionStorage.removeItem('ellosuit_splash_timestamp');
       navigate(getReturnPath(), { replace: true });
     }
   }, [user, adminLoading, statusLoading, isAdminMaster, navigate, location.search, approvalStatus]);

  if (isMobile) {
    return <MobileAuthScreen />;
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError('Email ou senha incorretos.');
        } else if (error.message.includes('Email not confirmed')) {
          setError('Confirme seu email antes de fazer login.');
        } else {
          setError(String(error.message));
        }
        return;
      }
      // Salvar preferência de "manter conectado"
      if (rememberMe) {
        localStorage.setItem('ellosuit_remember_me', 'true');
        sessionStorage.removeItem('ellosuit_session_active');
      } else {
        localStorage.setItem('ellosuit_remember_me', 'false');
        sessionStorage.setItem('ellosuit_session_active', 'true');
      }
      navigate(getReturnPath(), { replace: true });
    } catch {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      setIsLoading(false);
      return;
    }
    try {
      const { data, error } = await signUp(email, password, username, companyName);
      if (error) {
        if (error.message.includes('User already registered')) {
          setError('Este email já está cadastrado.');
          setMode('signin');
        } else {
          setError(String(error.message));
        }
        return;
      }
      if (data?.user) {
        // Send welcome email
        supabase.functions.invoke('send-system-email', {
          body: { template_key: 'welcome', recipient_email: email, recipient_name: username || email.split('@')[0] },
        }).catch(() => {});
        
        if (!data.session) {
          setSuccess('Cadastro realizado! Verifique seu email.');
          setMode('signin');
        } else {
          navigate(getReturnPath(), { replace: true });
        }
      }
    } catch {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };


    const handleContinueIdentifier = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setError(null);
      const value = email.trim().toLowerCase();
      if (!value) {
        setError('Informe seu email ou nome de usuário.');
        setIsLoading(false);
        return;
      }
      if (value.includes('@')) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          setError('Email inválido.');
          setIsLoading(false);
          return;
        }
      }
      
      try {
        const { data, error } = await supabase.rpc('check_user_exists', { identifier: value });
        
        if (error) {
          console.error('Error checking user existence:', error);
          setError('Ocorreu um erro ao validar seu acesso.');
          return;
        }
        
        if (!data) {
          setError('Este usuário ou e-mail não está cadastrado.');
          return;
        }
        
        setStep('password');
      } finally {
        setIsLoading(false);
      }
    };

  const switchMode = () => {
    // Unified signup flow lives at /register — no duplicate form here.
    navigate('/register');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedForgotEmail = forgotEmail.trim().toLowerCase();
    if (!normalizedForgotEmail) {
      setError('Informe seu email.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedForgotEmail)) {
      setError('Email inválido.');
      return;
    }
    setForgotLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedForgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setError(error.message);
        return;
      }
      setForgotSuccess(true);
    } catch {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setForgotLoading(false);
    }
  };

  const startForgotPassword = () => {
    setForgotMode(true);
    setForgotEmail(email);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="min-h-screen flex bg-[#faf9f7] font-['SF Pro Display']">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[400px] space-y-8"
        >
          <div className="text-center space-y-6">
            <div className="flex justify-center mb-4">
              <EllosuitMark className="h-12 w-12" />
            </div>
            <div className="space-y-2">
              <motion.h1 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-bold tracking-tight text-gray-900"
              >
                {forgotMode ? 'Recuperar senha' : mode === 'signin' ? 'Bem-vindo de volta' : 'Comece agora'}
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-gray-500 font-medium"
              >
                {forgotMode ? 'Informe seu e-mail para continuar' : mode === 'signin' ? 'Entre na sua conta ellosuit' : 'Crie sua conta gratuitamente em segundos'}
              </motion.p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Alert variant="destructive" className="rounded-2xl border-red-100 bg-red-50/50">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Alert className="rounded-2xl border-green-100 bg-green-50/50">
                  <AlertCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 font-medium">{success}</AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {forgotMode ? (
            <div className="space-y-6">
              {forgotSuccess ? (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-3xl border border-green-100 bg-green-50/30 p-8 text-center space-y-4"
                >
                  <div className="h-12 w-12 bg-green-100 rounded-2xl flex items-center justify-center mx-auto text-green-600">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-green-900">E-mail enviado!</p>
                    <p className="text-sm text-green-700/80">Verifique sua caixa de entrada para redefinir sua senha.</p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => { setForgotMode(false); setForgotSuccess(false); setForgotEmail(''); setError(null); }}
                    className="text-sm text-[#374DA4] font-bold hover:underline underline-offset-4 pt-2"
                  >
                    Voltar ao login
                  </motion.button>
                </motion.div>
              ) : (
                <div className="space-y-6">
                  <form onSubmit={handleForgotPassword} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700 ml-1">E-mail cadastrado</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          type="email"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="voce@empresa.com"
                          className="h-14 pl-12 bg-white border-gray-200 rounded-2xl focus:ring-[#374DA4] transition-all shadow-sm"
                          autoFocus
                        />
                      </div>
                    </div>
                    <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        type="submit"
                        className="w-full h-14 rounded-2xl bg-[#374DA4] text-white hover:bg-[#374DA4]/90 text-base font-bold shadow-lg shadow-[#374DA4]/20"
                        disabled={forgotLoading}
                      >
                        {forgotLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enviar link de recuperação'}
                      </Button>
                    </motion.div>
                  </form>
                  <button
                    type="button"
                    onClick={() => { setForgotMode(false); setForgotEmail(''); setError(null); }}
                    className="flex items-center gap-2 text-sm text-gray-500 font-semibold hover:text-gray-900 transition-colors mx-auto"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar ao login
                  </button>
                </div>
              )}
            </div>
          ) : mode === 'signin' ? (
            step === 'identifier' ? (
              <div className="space-y-6">
                 <form onSubmit={handleContinueIdentifier} className="space-y-5">
                   <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 ml-1">Identificação</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="E-mail ou usuário"
                        className="h-14 pl-12 bg-white border-gray-200 rounded-2xl focus:ring-[#374DA4] transition-all shadow-sm"
                        autoFocus
                      />
                    </div>
                   </div>
                   <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                     <Button
                       type="submit"
                       className="w-full h-14 rounded-2xl bg-[#374DA4] text-white hover:bg-[#374DA4]/90 text-base font-bold shadow-lg shadow-[#374DA4]/20"
                       disabled={isLoading}
                     >
                       {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Continuar'}
                     </Button>
                   </motion.div>
                </form>
                
                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-100"></span></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#faf9f7] px-2 text-gray-400 font-medium">Não tem uma conta?</span></div>
                </div>

                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={switchMode}
                    variant="outline"
                    className="w-full h-14 rounded-2xl border-gray-200 hover:bg-gray-50 text-[#374DA4] font-bold shadow-sm"
                  >
                    Criar conta agora
                  </Button>
                </motion.div>
              </div>
            ) : (
              <form onSubmit={handleSignIn} className="space-y-6">
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between border border-gray-100"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="h-8 w-8 bg-white rounded-xl flex items-center justify-center border border-gray-100 shrink-0">
                      <User className="h-4 w-4 text-gray-400" />
                    </div>
                    <span className="text-sm font-bold text-gray-700 truncate">{email}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setStep('identifier'); setPassword(''); setError(null); }}
                    className="text-xs font-bold text-[#374DA4] hover:underline whitespace-nowrap px-2 py-1"
                  >
                    Alterar
                  </button>
                </motion.div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-sm font-semibold text-gray-700">Sua senha</label>
                    <button
                      type="button"
                      onClick={startForgotPassword}
                      className="text-xs font-bold text-[#374DA4] hover:underline"
                    >
                      Esqueceu?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-14 pl-12 pr-12 bg-white border-gray-200 rounded-2xl focus:ring-[#374DA4] transition-all shadow-sm"
                      autoFocus
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#374DA4] transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-start ml-1">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="peer h-5 w-5 rounded-lg border-gray-300 transition-all appearance-none checked:bg-[#374DA4] checked:border-[#374DA4] cursor-pointer"
                      />
                      <svg className="absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">Manter conectado</span>
                  </label>
                </div>

                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    type="submit"
                    className="w-full h-14 rounded-2xl bg-[#374DA4] text-white hover:bg-[#374DA4]/90 text-base font-bold shadow-lg shadow-[#374DA4]/20"
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Entrar na conta'}
                  </Button>
                </motion.div>
              </form>
            )
          ) : (
            <form onSubmit={handleSignUp} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 ml-1">Nome de usuário</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Como devemos te chamar?"
                    className="h-14 pl-12 bg-white border-gray-200 rounded-2xl focus:ring-[#374DA4] transition-all shadow-sm"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 ml-1">Nome da empresa</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Sua empresa ou projeto"
                    className="h-14 pl-12 bg-white border-gray-200 rounded-2xl focus:ring-[#374DA4] transition-all shadow-sm"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 ml-1">Seu e-mail</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@empresa.com"
                    className="h-14 pl-12 bg-white border-gray-200 rounded-2xl focus:ring-[#374DA4] transition-all shadow-sm"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 ml-1">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    className="h-14 pl-12 pr-12 bg-white border-gray-200 rounded-2xl focus:ring-[#374DA4] transition-all shadow-sm"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#374DA4] transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="pt-2">
                <Button
                  type="submit"
                  className="w-full h-14 rounded-2xl bg-[#374DA4] text-white hover:bg-[#374DA4]/90 text-base font-bold shadow-lg shadow-[#374DA4]/20"
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Criar minha conta'}
                </Button>
              </motion.div>
              
              <div className="text-center pt-2">
                <p className="text-sm text-gray-500 font-medium">
                  Já tem uma conta?{' '}
                  <button
                    type="button"
                    onClick={switchMode}
                    className="text-[#374DA4] font-bold hover:underline underline-offset-4"
                  >
                    Fazer login
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* Legal and links */}
          <div className="pt-4 flex flex-col items-center gap-2">
            <div className="flex gap-4">
              <button 
                onClick={() => navigate('/privacidade')}
                className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.1em] hover:text-[#374DA4] transition-colors"
              >
                Privacidade
              </button>
              <button 
                onClick={() => navigate('/termos')}
                className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.1em] hover:text-[#374DA4] transition-colors"
              >
                Termos
              </button>
              <button 
                onClick={() => navigate('/sobre')}
                className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.1em] hover:text-[#374DA4] transition-colors"
              >
                Sobre nós
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right side - Removed as per request */}
    </div>
  );
};

export default AuthScreen;
