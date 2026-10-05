 import React, { useState } from 'react';
 import { Brain, Shield, Info, Sparkles, X, Zap } from 'lucide-react';
 import { Dialog, DialogContent } from "@/components/ui/dialog";
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { motion, AnimatePresence } from 'framer-motion';
 import { ALL_SKILLS, Skill } from '@/constants/skills';
 
 export default function SkillsDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
   const [activeTab, setActiveTab] = useState<Skill['category']>('strategy');
   const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
    const tabs = [
     { id: 'strategy', label: 'Estratégia', icon: Sparkles },
     { id: 'monitoring', label: 'Monitoramento', icon: Shield },
     { id: 'support', label: 'Suporte', icon: Brain },
     { id: 'productivity', label: 'Produtividade', icon: Zap },
   ];
 
    const filteredSkills = ALL_SKILLS.filter(skill => skill.category === activeTab);
   const selectedSkill = ALL_SKILLS.find(s => s.id === selectedSkillId);
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[1200px] sm:w-[95vw] h-auto min-h-[500px] bg-[#0A0A0A] border-white/5 p-0 overflow-hidden text-white flex flex-col md:flex-row gap-0 rounded-[32px]">
         {/* Sidebar Navigation */}
         <div className="w-full md:w-64 bg-[#111111] p-6 flex flex-col gap-8 border-r border-white/5">
           <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-[#3600FF]/20 text-white">
                <Brain className="h-6 w-6 text-[#3600FF]" />
              </div>
               <h2 className="text-xl font-bold tracking-tight text-white">Minhas Ello Skills</h2>
           </div>
 
           <nav className="flex flex-col gap-2">
             {tabs.map((tab) => (
               <button
                 key={tab.id}
                 onClick={() => {
                   setActiveTab(tab.id as any);
                   setSelectedSkillId(null);
                 }}
                 className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                   activeTab === tab.id 
                     ? 'bg-white/10 text-white font-medium shadow-sm' 
                     : 'text-white/40 hover:text-white hover:bg-white/5'
                 }`}
               >
                 <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? 'text-[#3600FF]' : ''}`} />
                 <span className="text-sm">{tab.label}</span>
               </button>
             ))}
           </nav>
 
         </div>
 
         {/* Main Content Area */}
         <div className="flex-1 flex flex-col min-w-0 bg-[#0A0A0A] relative">
            <div className="p-8 pb-4">
              <div className="space-y-1">
                <h3 className="text-2xl font-bold">
                  {tabs.find(t => t.id === activeTab)?.label}
                </h3>
                <p className="text-white/40 text-sm">Agentes de IA prontos para atuar na sua reunião</p>
              </div>
            </div>
 
           <div className="flex-1 overflow-y-auto p-8 pt-4 scrollbar-hide">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <AnimatePresence mode="wait">
                 {filteredSkills.map((skill) => (
                   <motion.div
                     key={skill.id}
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                     className={`p-5 rounded-2xl border transition-all cursor-pointer group flex flex-col gap-4 ${
                       selectedSkillId === skill.id 
                         ? 'bg-white/5 border-[#3600FF]/50 ring-1 ring-[#3600FF]/20' 
                         : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                     }`}
                     onClick={() => setSelectedSkillId(skill.id)}
                   >
                      <div className="flex justify-between items-start">
                        <div className="p-3 rounded-xl transition-transform group-hover:scale-110" style={{ backgroundColor: `${skill.color}15`, color: skill.color }}>
                          <skill.icon className="h-6 w-6" />
                        </div>
                      </div>
                     
                     <div className="space-y-1">
                       <h4 className="font-bold text-white group-hover:text-[#3600FF] transition-colors">{skill.name}</h4>
                       <p className="text-xs text-white/40 leading-relaxed line-clamp-2">
                         {skill.description}
                       </p>
                     </div>
 
                     <div className="mt-auto flex items-center justify-between pt-2">
                       <Badge variant="outline" className="text-[10px] bg-white/5 border-white/10 text-white/50 uppercase tracking-widest px-2">
                         Grátis
                       </Badge>
                       <div className="flex items-center gap-1.5 text-xs text-white/20 font-medium">
                         <Info className="h-3 w-3" />
                         <span className="group-hover:text-white/40 transition-colors">Ver detalhes</span>
                       </div>
                     </div>
                   </motion.div>
                 ))}
               </AnimatePresence>
             </div>
           </div>
 
           {/* Floating Info Panel when a skill is selected */}
           <AnimatePresence>
             {selectedSkillId && selectedSkill && (
               <motion.div
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: 20 }}
                 className="absolute top-0 right-0 w-80 h-full bg-[#111111] border-l border-white/5 p-8 flex flex-col gap-8 z-20 shadow-2xl"
               >
                  <div className="flex justify-start items-start">
                    <div className="p-4 rounded-2xl" style={{ backgroundColor: `${selectedSkill.color}20`, color: selectedSkill.color }}>
                      <selectedSkill.icon className="h-8 w-8" />
                    </div>
                  </div>
 
                 <div className="space-y-4">
                   <div className="space-y-1">
                     <h4 className="text-2xl font-bold">{selectedSkill.name}</h4>
                     <Badge className="bg-[#3600FF]/10 text-[#3600FF] border-[#3600FF]/20 px-3 py-1">
                       {tabs.find(t => t.id === selectedSkill.category)?.label}
                     </Badge>
                   </div>
                   <p className="text-white/60 leading-relaxed italic">
                     "{selectedSkill.description}"
                   </p>
                 </div>
 
                 <div className="space-y-4 pt-4 border-t border-white/5">
                   <h5 className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">O que este agente faz:</h5>
                   <p className="text-sm text-white/50 leading-loose">
                     {selectedSkill.details}
                   </p>
                 </div>
 
                  <div className="mt-auto space-y-4">
                    <Button 
                      className="w-full h-14 rounded-2xl bg-[#3600FF] text-white hover:bg-[#3600FF]/90 font-bold transition-all"
                      onClick={() => setSelectedSkillId(null)}
                    >
                      Fechar Detalhes
                    </Button>
                  </div>
               </motion.div>
             )}
           </AnimatePresence>
         </div>
       </DialogContent>
     </Dialog>
   );
 }