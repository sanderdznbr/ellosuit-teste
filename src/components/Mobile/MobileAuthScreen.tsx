import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, AlertCircle, Mail, Lock, User, Building2, ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { EllosuitMark } from '@/components/shared/EllosuitMark';


 const MobileAuthScreen = () => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
   const [mode, setMode] = useState<'signin' | 'signup'>('signin');
   const [step, setStep] = useState<'identifier' | 'password'>('identifier');
 
   // Force white status bar on auth screen
   useEffect(() => {
     const meta = document.querySelector('meta[name="theme-color"]');
     const prevTheme = meta?.getAttribute('content') || '#374DA4';
     const prevBg = document.documentElement.style.backgroundColor || '';
     const prevBodyBg = document.body.style.backgroundColor || '';
 
     if (meta) meta.setAttribute('content', '#ffffff');
     document.documentElement.style.backgroundColor = '#ffffff';
     document.body.style.backgroundColor = '#ffffff';
 
     return () => {
       if (meta) meta.setAttribute('content', prevTheme);
       document.documentElement.style.backgroundColor = prevBg;
       document.body.style.backgroundColor = prevBodyBg;
     };
   }, []);
 
   const [loading, setLoading] = useState(false);
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [name, setName] = useState('');
   const [company, setCompany] = useState('');
   const [error, setError] = useState<string | null>(null);
   const [success, setSuccess] = useState<string | null>(null);
   const [rememberMe, setRememberMe] = useState(true);
   const [showPassword, setShowPassword] = useState(false);
 
    const handleContinueIdentifier = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      const value = email.trim().toLowerCase();
      if (!value) {
        setError('Informe seu email ou nome de usuário.');
        setLoading(false);
        return;
      }
      if (value.includes('@')) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          setError('Email inválido.');
          setLoading(false);
          return;
        }
      }
      
      try {
        const { data, error: checkError } = await supabase.rpc('check_user_exists', { identifier: value });
        if (checkError) {
          setError('Ocorreu um erro ao validar seu acesso.');
          return;
        }
        if (!data) {
          setError('Este usuário ou e-mail não está cadastrado.');
          return;
        }
        setStep('password');
      } finally {
        setLoading(false);
      }
    };

    const handleSignIn = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email || !password) return;
      setLoading(true);
      setError(null);
      try {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          if (signInError.message.includes('Invalid login credentials')) setError('Email ou senha incorretos.');
          else setError(String(signInError.message));
        } else {
          if (rememberMe) {
            localStorage.setItem('ellosuit_remember_me', 'true');
            sessionStorage.removeItem('ellosuit_session_active');
          } else {
            localStorage.setItem('ellosuit_remember_me', 'false');
            sessionStorage.setItem('ellosuit_session_active', 'true');
          }
          // Reset splash timestamp on login to ensure it shows
          sessionStorage.removeItem('ellosuit_splash_timestamp');
        }
      } catch { setError('Erro inesperado.'); }
      finally { setLoading(false); }
    };

   const handleSignUp = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!email || !password || !name) return;
     if (password.length < 6) { setError('Senha deve ter no mínimo 6 caracteres.'); return; }
     setLoading(true);
     setError(null);
     try {
       const { data, error } = await signUp(email, password, name, company);
       if (error) { setError(String(error.message)); return; }
       if (data?.user && !data.session) {
         setSuccess('Conta criada! Verifique seu email.');
         setMode('signin');
       }
     } catch { setError('Erro inesperado.'); }
     finally { setLoading(false); }
   };


  const switchMode = () => {
    // Unified signup flow lives at /register.
    navigate('/register');
  };

  return (
    <div className="min-h-screen bg-[#faf9f7] flex flex-col pt-safe pb-safe overflow-x-hidden font-['SF Pro Display']">
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[360px] space-y-8"
        >
          <div className="text-center space-y-6">
            <div className="flex justify-center mb-2">
              <EllosuitMark className="h-12 w-12" />
            </div>
            <div className="space-y-3">
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-3xl font-extrabold tracking-tight text-gray-950"
            >
              {mode === 'signin' ? 'Bem-vindo' : 'Criar conta'}
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-gray-500 font-medium px-4"
            >
              {mode === 'signin' ? 'Acesse sua conta para continuar evoluindo seu negócio.' : 'A plataforma completa para gerenciar sua empresa.'}
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
                  <AlertDescription className="text-sm">{error}</AlertDescription>
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
                  <AlertDescription className="text-green-800 font-medium text-sm">{success}</AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-8">
            {mode === 'signin' ? (
              step === 'identifier' ? (
                <div className="space-y-6">
                  <form onSubmit={handleContinueIdentifier} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">E-mail ou Usuário</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          type="text"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="voce@empresa.com"
                          className="h-14 pl-12 bg-white border-gray-100 rounded-2xl focus:ring-[#374DA4] transition-all shadow-sm"
                          autoFocus
                        />
                      </div>
                    </div>
                    <motion.div whileTap={{ scale: 0.96 }}>
                      <Button
                        type="submit"
                        className="w-full h-14 rounded-2xl bg-[#374DA4] text-white hover:bg-[#374DA4]/90 text-base font-bold shadow-lg shadow-[#374DA4]/20 flex items-center justify-center gap-2"
                        disabled={loading}
                      >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                          <>
                            Continuar
                            <ChevronRight className="h-5 w-5" />
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </form>
                  
                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-100"></span></div>
                    <div className="relative flex justify-center text-xs uppercase tracking-[0.2em]"><span className="bg-[#faf9f7] px-3 text-gray-300 font-bold">ou</span></div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={switchMode}
                    className="w-full h-14 rounded-2xl border-2 border-gray-100 text-[#374DA4] font-bold text-sm bg-white active:bg-gray-50 transition-colors shadow-sm"
                  >
                    Criar conta agora
                  </motion.button>
                </div>
              ) : (
                <form onSubmit={handleSignIn} className="space-y-6">
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between border border-gray-100"
                  >
                    <span className="text-sm font-bold text-gray-600 truncate mr-4">{email}</span>
                    <button
                      type="button"
                      onClick={() => { setStep('identifier'); setPassword(''); setError(null); }}
                      className="text-xs font-bold text-[#374DA4] active:opacity-60 shrink-0"
                    >
                      Alterar
                    </button>
                  </motion.div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Sua senha</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-14 pl-12 pr-12 bg-white border-gray-100 rounded-2xl focus:ring-[#374DA4] transition-all shadow-sm"
                        autoFocus
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between px-1">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="peer h-5 w-5 rounded-lg border-gray-200 transition-all appearance-none checked:bg-[#374DA4] checked:border-[#374DA4] cursor-pointer"
                        />
                        <svg className="absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm font-semibold text-gray-500">Lembrar de mim</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => navigate('/forgot-password')}
                      className="text-sm font-bold text-[#374DA4]"
                    >
                      Esqueceu?
                    </button>
                  </div>

                  <motion.div whileTap={{ scale: 0.96 }}>
                    <Button
                      type="submit"
                      className="w-full h-14 rounded-2xl bg-[#374DA4] text-white hover:bg-[#374DA4]/90 text-base font-bold shadow-lg shadow-[#374DA4]/20"
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Entrar na conta'}
                    </Button>
                  </motion.div>
                </form>
              )
            ) : (
                <form onSubmit={handleSignUp} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Seu Nome</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Como devemos te chamar?"
                        className="h-14 pl-12 bg-white border-gray-100 rounded-2xl focus:ring-[#374DA4] transition-all shadow-sm"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Sua Empresa</label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="Nome da sua empresa"
                        className="h-14 pl-12 bg-white border-gray-100 rounded-2xl focus:ring-[#374DA4] transition-all shadow-sm"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">E-mail profissional</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="voce@empresa.com"
                        className="h-14 pl-12 bg-white border-gray-100 rounded-2xl focus:ring-[#374DA4] transition-all shadow-sm"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Sua senha</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="h-14 pl-12 pr-12 bg-white border-gray-100 rounded-2xl focus:ring-[#374DA4] transition-all shadow-sm"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                  <motion.div whileTap={{ scale: 0.96 }} className="pt-2">
                    <Button
                      type="submit"
                      className="w-full h-14 rounded-2xl bg-[#374DA4] text-white hover:bg-[#374DA4]/90 text-base font-bold shadow-lg shadow-[#374DA4]/20"
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Criar minha conta'}
                    </Button>
                  </motion.div>
                  
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={switchMode}
                      className="text-sm font-bold text-[#374DA4]"
                    >
                      Já tem conta? Fazer login
                    </button>
                  </div>
                </form>
           )}
          </div>

          <div className="pt-10 flex flex-col items-center gap-3">
            <div className="flex gap-6">
              <button 
                onClick={() => navigate('/privacidade')}
                className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.1em] active:text-[#374DA4]"
              >
                Privacidade
              </button>
              <button 
                onClick={() => navigate('/termos')}
                className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.1em] active:text-[#374DA4]"
              >
                Termos
              </button>
              <button 
                onClick={() => navigate('/sobre')}
                className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.1em] active:text-[#374DA4]"
              >
                Sobre
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default MobileAuthScreen;
