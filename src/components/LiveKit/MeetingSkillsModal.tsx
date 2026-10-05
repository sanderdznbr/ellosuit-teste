 import React, { useState, useEffect } from 'react';
 import { 
   Dialog, 
   DialogContent, 
   DialogHeader, 
   DialogTitle, 
   DialogDescription 
 } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { ScrollArea } from '@/components/ui/scroll-area';
  import { Check, Loader2, Sparkles, X, Info, Brain } from 'lucide-react';
  import { supabase } from '@/integrations/supabase/client';
  import { ALL_SKILLS, Skill as AISkill } from '@/constants/skills';
 import { useAuth } from '@/hooks/useAuth';
 import { useToast } from '@/hooks/use-toast';
 
  interface MeetingSkillsModalProps {
   isOpen: boolean;
   onClose: () => void;
   roomId: string;
   companyId: string;
    onSkillActivated?: (skillId: string) => void;
 }
 
  const MeetingSkillsModal: React.FC<MeetingSkillsModalProps> = ({
    isOpen,
    onClose,
    roomId,
     companyId,
     onSkillActivated
  }) => {
    const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
    const { user } = useAuth();
    const { toast } = useToast();
  
    useEffect(() => {
      if (isOpen) {
        fetchActiveSkills();
      }
    }, [isOpen, roomId]);
  
    const fetchActiveSkills = async () => {
      setIsLoading(true);
      try {
       const { data: active, error: activeError } = await (supabase as any)
         .from('room_active_skills')
         .select('skill_id')
         .eq('room_id', roomId);
 
       if (activeError) throw activeError;
       if (active && active.length > 0) {
         setActiveSkillId(active[0].skill_id);
       } else {
         setActiveSkillId(null);
       }
      } catch (error) {
        console.error('Error fetching active skills:', error);
      } finally {
        setIsLoading(false);
      }
    };
 
    const activateSkill = async (skill: AISkill) => {
      const isCurrentlyActive = activeSkillId === skill.id;
      setIsActionLoading(skill.id);
  
      try {
        if (isCurrentlyActive) {
          // Skill já ativa não pode ser desativada — apenas substituída por outra
          console.log(`${skill.name} já está ativa.`);
          return;
        } else {
          if (activeSkillId) {
            // Substituir Skill ativa pela nova
            const { error: delErr } = await supabase
              .from('room_active_skills' as any)
              .delete()
              .eq('room_id', roomId);
            if (delErr) throw delErr;
          }

          const { error } = await supabase
            .from('room_active_skills' as any)
            .insert({
              room_id: roomId,
              skill_id: skill.id,
              activated_by: user?.id
            });
  
          if (error) throw error;
          setActiveSkillId(skill.id);
          onSkillActivated?.(skill.id);
          
          console.log(`Skill ${skill.name} Ativada!`);
          
          // Close modal after activation to show the result
          setTimeout(() => onClose(), 1000);
        }
      } catch (error) {
        console.error('Error toggling skill:', error);
        toast({
          title: "Erro",
          description: "Não foi possível alterar o estado da Skill.",
          variant: "destructive"
        });
      } finally {
        setIsActionLoading(null);
      }
    };
  
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[1100px] bg-[#101010] border-white/10 rounded-[32px] p-8 md:p-12 text-white">
          <div className="space-y-8">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#374DA4]/10 text-[#374DA4]">
                  <Brain className="h-6 w-6" />
                </div>
                <h2 className="text-3xl font-bold text-white">Minhas Ello Skills</h2>
              </div>
              <p className="text-white/50 text-lg">
                Selecione um agente especialista para acompanhar e analisar sua reunião em tempo real.
              </p>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-12 w-12 text-[#374DA4] animate-spin" />
                <p className="text-white/40">Sincronizando Skills...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                {ALL_SKILLS.map((skill) => {
                  const isActive = activeSkillId === skill.id;
                  const isLoadingItem = isActionLoading === skill.id;

                  return (
                    <button
                      key={skill.id}
                      onClick={() => !isLoadingItem && !isActive && activateSkill(skill)}
                      disabled={isLoadingItem || isActive}
                      className={`group p-6 rounded-[24px] border transition-all text-left flex flex-col gap-4 relative overflow-hidden ${
                        isActive 
                          ? 'bg-[#374DA4]/20 border-[#374DA4] ring-1 ring-[#374DA4]/50 shadow-[0_0_20px_rgba(55,77,164,0.2)]' 
                          : 'bg-white/5 border-white/5 hover:border-[#374DA4]/30 hover:bg-white/[0.08]'
                      } ${isActive ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div 
                          className="p-3 rounded-xl transition-all group-hover:scale-110" 
                          style={{ 
                            backgroundColor: isActive ? '#374DA4' : `${skill.color}15`, 
                            color: isActive ? 'white' : skill.color 
                          }}
                        >
                          <skill.icon className="h-6 w-6" />
                        </div>
                        
                        {isActive && (
                          <div className="bg-green-500/20 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-500/30 flex items-center gap-1">
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                            ATIVO
                          </div>
                        )}
                        
                        {isLoadingItem && (
                          <Loader2 className="h-5 w-5 animate-spin text-[#374DA4]" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-bold text-lg text-white group-hover:text-[#374DA4] transition-colors">
                          {skill.name}
                        </h3>
                        <p className="text-xs text-white/40 line-clamp-2 leading-relaxed">
                          {skill.description}
                        </p>
                      </div>

                      {isActive && (
                        <div className="absolute top-2 right-2 p-1 text-white/20">
                          <Check className="h-4 w-4" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button 
                variant="ghost" 
                onClick={onClose}
                className="h-12 px-8 rounded-xl border border-white/10 hover:bg-white/5 text-white font-bold"
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };
 
 export default MeetingSkillsModal;