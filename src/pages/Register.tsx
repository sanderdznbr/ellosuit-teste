import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, Loader2, Mail, User, Building2, Smartphone, FileText, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import ellosuitLogo from '@/assets/logoellosuit.png';
import authHero from '@/assets/auth-hero.webp';

  const TOTAL_STEPS = 1;

const STEP_SUBTITLES = [
  'Leva menos de 30 segundos',
];

const formatDocument = (value: string) => {
  const v = value.replace(/\D/g, '');
  if (v.length <= 11) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

const formatPhone = (value: string) => {
  const v = value.replace(/\D/g, '').substring(0, 11);
  if (v.length <= 10) return v.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
};

export default function Register() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [username, setUsername] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [document, setDocument] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
   const [confirmPassword, setConfirmPassword] = useState('');
   const [emailMarketingConfig, setEmailMarketingConfig] = useState('');
   const [whatsappConfig, setWhatsappConfig] = useState('');

  const validateStep = (): boolean => {
    setError(null);
    if (!username.trim()) { setError('Informe seu nome.'); return false; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) { setError('Informe um e-mail válido.'); return false; }
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return false; }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
    else navigate('/');
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: signUpError } = await signUp(email, password, username, companyName || username, phone);
      if (signUpError) {
        if (signUpError.message.includes('User already registered')) {
          setError('Este email já está cadastrado.');
        } else {
          setError(signUpError.message);
        }
        return;
      }
       if (data?.user) {
         // Auto-approved registration — dados adicionais são coletados no onboarding.
         try {
          supabase.functions.invoke('send-system-email', {
            body: {
              template_key: 'welcome',
              recipient_email: email,
              recipient_name: username || email.split('@')[0],
            },
          }).catch(() => {});
        } catch {}
        navigate('/dashboard');
      }
    } catch {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#FDFDFF]">
      {/* Left — Form */}
      <div className="flex-1 flex flex-col relative">
        {/* Header */}
        <div className="px-8 pt-8 flex items-center justify-between absolute top-0 left-0 right-0 z-10">
          <motion.img 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            src={ellosuitLogo} 
            alt="Ellosuit" 
            className="h-8 w-auto grayscale brightness-0 opacity-80" 
          />
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-[#374DA4] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {step === 0 ? 'Voltar ao login' : 'Voltar'}
          </motion.button>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-6 sm:px-12 py-20 mt-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md space-y-8"
          >
            {/* Progress bar (only shows on multi-step flows) */}
            {TOTAL_STEPS > 1 && (
              <div className="flex gap-2 mb-2">
                {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                  <div key={i} className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                    <motion.div
                      initial={false}
                      animate={{ width: i <= step ? '100%' : '0%' }}
                      className="h-full bg-[#374DA4]"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Title */}
            <div className="space-y-1">
              <h1 className="text-3xl font-bold text-gray-950 tracking-tight">
                Crie sua conta grátis
              </h1>
              <p className="text-gray-500 font-medium">{STEP_SUBTITLES[0]} · sem cartão de crédito</p>
            </div>

            {/* Error */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Alert variant="destructive" className="rounded-2xl border-red-100 bg-red-50/50">
                    <AlertDescription className="font-medium">{error}</AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Step 0 — Personal */}
                {step === 0 && (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Nome completo</Label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Ex: João Silva"
                          className="h-14 pl-12 bg-white border-gray-100 rounded-2xl focus:ring-[#374DA4] shadow-sm transition-all"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Sua Empresa <span className="text-gray-300 normal-case tracking-normal font-medium">(opcional)</span></Label>
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Nome da sua empresa ou projeto"
                          className="h-14 pl-12 bg-white border-gray-100 rounded-2xl focus:ring-[#374DA4] shadow-sm transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">E-mail</Label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="voce@empresa.com"
                          className="h-14 pl-12 bg-white border-gray-100 rounded-2xl focus:ring-[#374DA4] shadow-sm transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="h-14 pl-12 pr-12 bg-white border-gray-100 rounded-2xl focus:ring-[#374DA4] shadow-sm transition-all"
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
                  </div>
                )}

                {/* Step 1 — Business & Account Data */}
                {step === 1 && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">CPF ou CNPJ <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <FileText className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                          <Input
                            value={document}
                            onChange={(e) => setDocument(formatDocument(e.target.value))}
                            placeholder="000.000.000-00"
                            className="h-14 pl-12 bg-white border-gray-100 rounded-2xl focus:ring-[#374DA4] shadow-sm"
                            autoFocus
                            required
                            aria-required="true"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Telefone <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                          <Input
                            value={phone}
                            onChange={(e) => setPhone(formatPhone(e.target.value))}
                            placeholder="(11) 99999-9999"
                            className="h-14 pl-12 bg-white border-gray-100 rounded-2xl focus:ring-[#374DA4] shadow-sm"
                            required
                            aria-required="true"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Seu E-mail principal</Label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="voce@empresa.com"
                          className="h-14 pl-12 bg-white border-gray-100 rounded-2xl focus:ring-[#374DA4] shadow-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">E-mail para envios</Label>
                        <Input
                          type="email"
                          value={emailMarketingConfig}
                          onChange={(e) => setEmailMarketingConfig(e.target.value)}
                          placeholder="contato@empresa.com"
                          className="h-14 bg-white border-gray-100 rounded-2xl focus:ring-[#374DA4] shadow-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">WhatsApp de disparo</Label>
                        <Input
                          value={whatsappConfig}
                          onChange={(e) => setWhatsappConfig(formatPhone(e.target.value))}
                          placeholder="(11) 99999-9999"
                          className="h-14 bg-white border-gray-100 rounded-2xl focus:ring-[#374DA4] shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2 — Credentials */}
                {step === 2 && (
                  <div className="space-y-6">
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="bg-[#374DA4]/5 p-4 rounded-2xl flex items-center gap-3 border border-[#374DA4]/10"
                    >
                      <div className="h-10 w-10 bg-[#374DA4] rounded-xl flex items-center justify-center text-white shrink-0">
                        <Mail className="h-5 w-5" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-[10px] font-bold text-[#374DA4] uppercase tracking-widest">E-mail selecionado</p>
                        <p className="text-sm font-bold text-gray-900 truncate">{email}</p>
                      </div>
                    </motion.div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Defina sua senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="h-14 pl-12 pr-12 bg-white border-gray-100 rounded-2xl focus:ring-[#374DA4] shadow-sm"
                          minLength={6}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      {password.length > 0 && (
                        <div className="flex gap-1.5 mt-3 px-1">
                          <div className={`h-1 flex-1 rounded-full transition-colors ${password.length >= 6 ? 'bg-[#374DA4]' : 'bg-gray-100'}`} />
                          <div className={`h-1 flex-1 rounded-full transition-colors ${password.length >= 10 ? 'bg-[#374DA4]' : 'bg-gray-100'}`} />
                          <div className={`h-1 flex-1 rounded-full transition-colors ${/[A-Z]/.test(password) && /\d/.test(password) ? 'bg-[#374DA4]' : 'bg-gray-100'}`} />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Confirme sua senha</Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                          type={showConfirm ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="h-14 pl-12 pr-12 bg-white border-gray-100 rounded-2xl focus:ring-[#374DA4] shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                        >
                          {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                      {confirmPassword.length > 0 && password !== confirmPassword && (
                        <p className="text-xs text-red-500 font-bold ml-1 mt-1.5">As senhas não coincidem</p>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* CTA Button */}
            <div className="pt-2">
              {step < TOTAL_STEPS - 1 ? (
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={handleNext}
                    className="w-full h-14 rounded-2xl bg-[#374DA4] text-white hover:bg-[#374DA4]/90 text-base font-bold shadow-lg shadow-[#374DA4]/20 flex items-center justify-center gap-2"
                  >
                    Próximo passo
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </motion.div>
              ) : (
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                  <Button 
                    onClick={handleSubmit} 
                    className="w-full h-14 rounded-2xl bg-[#374DA4] text-white hover:bg-[#374DA4]/90 text-base font-bold shadow-lg shadow-[#374DA4]/20" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Criando conta...</>
                    ) : (
                      'Criar conta grátis'
                    )}
                  </Button>
                </motion.div>
              )}
            </div>

            {/* Login link */}
            <div className="text-center pt-2">
              <p className="text-sm text-gray-500 font-medium">
                Já tem uma conta?{' '}
                <button 
                  onClick={() => navigate('/')} 
                  className="text-[#374DA4] font-bold hover:underline underline-offset-4"
                >
                  Entrar na plataforma
                </button>
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right — Hero image (desktop only) */}
      <div className="hidden lg:block flex-1 relative bg-[#F4F4F9] m-6 rounded-[40px] overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5 }}
          className="absolute inset-0"
        >
          <img
            src={authHero}
            alt="Ellosuit"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#374DA4]/60 via-[#374DA4]/20 to-transparent mix-blend-multiply" />
          
          <div className="absolute bottom-16 left-16 right-16">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="space-y-4"
            >
              <div className="h-1 bg-white/30 w-12 rounded-full" />
              <h2 className="text-4xl font-extrabold text-white leading-tight">Escalabilidade com inteligência de verdade.</h2>
              <p className="text-white/80 text-xl font-medium max-w-md">Junte-se a centenas de empresas que já operam com Ellosuit.</p>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
