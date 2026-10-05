 import React, { useEffect, useState } from 'react';
 import { useNavigate } from 'react-router-dom';
 import { motion } from 'framer-motion';
 import { Clock, X, LogOut, MessageSquare, ShieldCheck } from 'lucide-react';
 import { useApprovalStatus } from '@/hooks/useApprovalStatus';
 import { useAuth } from '@/hooks/useAuth';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import ellosuitLogo from '@/assets/ellosuit-logo.png';
 import pendingApprovalHero from '@/assets/pending-approval-hero.webp';
 import { useIsMobile } from '@/hooks/use-mobile';
 
  const CountdownTimer = ({ startTime }: { startTime?: string }) => {
    const [timeLeft, setTimeLeft] = useState(24 * 60 * 60);
  
    useEffect(() => {
      const calculateTimeLeft = () => {
        const start = startTime ? new Date(startTime).getTime() : Date.now();
        const target = start + 24 * 60 * 60 * 1000;
        const now = Date.now();
        const difference = Math.max(0, Math.floor((target - now) / 1000));
        setTimeLeft(difference);
      };
  
      calculateTimeLeft();
      const timer = setInterval(calculateTimeLeft, 1000);
      return () => clearInterval(timer);
    }, [startTime]);
  
    const hours = Math.floor(timeLeft / 3600);
    const minutes = Math.floor((timeLeft % 3600) / 60);
    const seconds = timeLeft % 60;
  
    return (
      <div className="flex gap-4 justify-center mt-6">
        <div className="flex flex-col items-center">
          <span className="text-3xl font-bold text-[#374DA4]">{String(hours).padStart(2, '0')}</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Horas</span>
        </div>
        <span className="text-3xl font-bold text-slate-300 dark:text-slate-600">:</span>
        <div className="flex flex-col items-center">
          <span className="text-3xl font-bold text-[#374DA4]">{String(minutes).padStart(2, '0')}</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Minutos</span>
        </div>
        <span className="text-3xl font-bold text-slate-300 dark:text-slate-600">:</span>
        <div className="flex flex-col items-center">
          <span className="text-3xl font-bold text-[#374DA4]">{String(seconds).padStart(2, '0')}</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">Segundos</span>
        </div>
      </div>
    );
  };
 
   const PendingApproval = () => {
     const { status, loading, createdAt } = useApprovalStatus();
    const { signOut, user } = useAuth();
    const navigate = useNavigate();
    const { isMobile } = useIsMobile();
 
   useEffect(() => {
     if (!loading && status === 'approved') {
       navigate('/dashboard');
     }
   }, [status, loading, navigate]);
 
   if (loading) {
     return (
      <div className="min-h-screen flex items-center justify-center bg-background">
         <div className="w-8 h-8 border-4 border-muted border-t-[#374DA4] rounded-full animate-spin" />
       </div>
     );
   }
 
   const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Error during signOut:', err);
    }
    // Clear local session flags so the user is fully logged out
    try {
      localStorage.removeItem('ellosuit_remember_me');
      sessionStorage.removeItem('ellosuit_session_active');
      sessionStorage.removeItem('ellosuit_splash_timestamp');
    } catch {}
    // Hard redirect to ensure all React state, contexts and realtime
    // channels are torn down before showing the auth screen again.
    window.location.replace('/auth');
   };
 
    const handleContactSupport = () => {
      const message = encodeURIComponent(`Olá, sou o usuário ${user?.email} e gostaria de informações sobre a aprovação do meu cadastro na Ellosuit.`);
      window.open(`https://wa.me/5511910543666?text=${message}`, '_blank');
    };
  
    return (
     <div className="min-h-screen flex bg-background">
       {/* Left side - Info */}
       <div className="flex-1 flex flex-col p-6 lg:p-12">
         <div className="mb-8 lg:mb-12">
           <img src={ellosuitLogo} alt="Ellosuit" className="h-8 w-auto" />
         </div>
 
         <div className="flex-1 flex items-center justify-center">
           <div className="w-full max-w-md">
             <motion.div
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               className="text-left"
             >
               {status === 'rejected' ? (
                 <>
                   <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-6">
                     <X className="h-6 w-6 text-red-500" />
                   </div>
                   <h1 className="text-3xl font-bold text-foreground mb-4">Acesso Negado</h1>
                   <p className="text-muted-foreground mb-8 text-base leading-relaxed">
                     Infelizmente seu cadastro não foi aprovado. Para entender o motivo ou contestar a decisão, fale com nosso suporte através do botão abaixo.
                   </p>
                 </>
               ) : (
                 <>
                   <div className="w-12 h-12 rounded-2xl bg-[#F0F2FE] dark:bg-[#374DA4]/15 flex items-center justify-center mb-6">
                     <ShieldCheck className="h-6 w-6 text-[#374DA4]" />
                   </div>
                   <h1 className="text-3xl font-bold text-foreground mb-3">Registro em Análise</h1>
                   <p className="text-muted-foreground text-base mb-8 leading-relaxed">
                     Olá, <span className="text-foreground font-semibold">{user?.email}</span>!<br />
                     Seu cadastro foi enviado e está sendo revisado por nossa equipe de segurança.
                   </p>
 
                   <div className="bg-slate-50 dark:bg-white/5 rounded-3xl p-8 mb-8 border border-slate-100 dark:border-white/10">
                     <div className="flex items-center gap-2 mb-2">
                       <Clock className="h-4 w-4 text-[#374DA4]" />
                       <span className="text-[11px] uppercase font-bold tracking-[2px] text-muted-foreground">Previsão de Ativação</span>
                     </div>
                      <CountdownTimer startTime={createdAt} />
                   </div>
                 </>
               )}
 
               <div className="flex flex-col gap-4">
                 <Button 
                   className="w-full bg-[#374DA4] hover:bg-[#2000a3] text-white h-12 rounded-xl font-medium shadow-lg shadow-[#374DA4]/20"
                   onClick={handleContactSupport}
                 >
                   <MessageSquare className="mr-2 h-4 w-4" />
                   Falar com suporte via WhatsApp
                 </Button>
                 
                 <Button 
                   variant="ghost" 
                   className="w-full text-muted-foreground hover:text-foreground h-10 text-xs font-normal hover:bg-muted"
                   onClick={handleSignOut}
                 >
                   <LogOut className="mr-2 h-3.5 w-3.5" />
                   {status === 'rejected' ? 'Sair da Conta' : 'Sair e entrar com outra conta'}
                 </Button>
               </div>
 
               <div className="mt-12 flex items-center gap-4">
                 <Badge variant="secondary" className="bg-[#374DA4]/10 text-[#374DA4] dark:bg-[#374DA4]/20 dark:text-[#879CE0] border-none px-4 py-1.5 text-[11px] font-medium rounded-full">
                   Status: Aguardando Aprovação
                 </Badge>
                 <p className="text-muted-foreground text-[11px]">
                   Análise em até 24h úteis.
                 </p>
               </div>
             </motion.div>
           </div>
         </div>
 
         <div className="mt-8 flex justify-between items-center text-slate-300 dark:text-slate-600 text-[10px] uppercase tracking-widest">
           <p>&copy; {new Date().getFullYear()} ElloSuit.</p>
           <div className="flex gap-4">
             <a href="#" className="hover:text-slate-400 dark:hover:text-slate-400 transition-colors">Privacidade</a>
             <a href="#" className="hover:text-slate-400 dark:hover:text-slate-400 transition-colors">Termos</a>
           </div>
         </div>
       </div>
 
         {/* Right side - Hero image */}
         {!isMobile && (
           <div className="hidden lg:block flex-1 relative overflow-hidden border-l border-slate-100 dark:border-white/10">
             <img
               src={pendingApprovalHero}
               alt="Ellosuit"
               className="absolute inset-0 w-full h-full object-cover"
             />
           </div>
         )}
     </div>
    );
  };
  
  export default PendingApproval;