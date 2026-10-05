 import React, { useState } from 'react';
  import { Brain, ChevronLeft, Check, Info, Plus } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Switch } from '@/components/ui/switch';
  import { useToast } from '@/hooks/use-toast';
  import { ALL_SKILLS, Skill } from '@/constants/skills';
 import { useNavigate } from 'react-router-dom';
 
  export default function SkillsHub() {
    const { toast } = useToast();
    const navigate = useNavigate();
 
   return (
     <div className="min-h-screen bg-[#0A0A0B] text-white p-4 md:p-8">
       <div className="max-w-6xl mx-auto space-y-8">
         {/* Header */}
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
           <div className="space-y-2">
             <button 
               onClick={() => navigate('/dashboard/meet-hub')}
               className="flex items-center gap-2 text-white/50 hover:text-white transition-colors mb-4 group"
             >
               <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
               Voltar ao Meet Hub
             </button>
             <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
               <Brain className="h-10 w-10 text-[#3600FF]" />
               ElloSuit Meeting Skills
             </h1>
             <p className="text-white/40 text-lg max-w-2xl">
               Agentes de IA especialistas que entram na sua reunião para analisar, dar insights e gerar resultados reais.
             </p>
            </div>
          </div>
 
         {/* Grid de Skills */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ALL_SKILLS.map((skill) => (
              <Card key={skill.id} className="bg-[#121214] border-white/5 hover:border-[#3600FF]/50 transition-all duration-300 overflow-hidden group">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 rounded-2xl transition-transform group-hover:scale-110" style={{ backgroundColor: `${skill.color}20`, color: skill.color }}>
                      <skill.icon className="h-7 w-7" />
                    </div>
                    <Badge className="bg-[#3600FF]/10 text-[#3600FF] border-[#3600FF]/20 px-3 py-1">
                      Grátis
                    </Badge>
                  </div>
                  <CardTitle className="text-xl text-white group-hover:text-[#3600FF] transition-colors">{skill.name}</CardTitle>
                  <CardDescription className="text-white/50 leading-relaxed mt-2 line-clamp-2">
                    {skill.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-white/30 uppercase tracking-widest">
                      <Info className="h-3 w-3" />
                      O que ele faz
                    </div>
                    <p className="text-sm text-white/70 italic leading-relaxed">
                      "{skill.details}"
                    </p>
                  </div>
  
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2 text-xs text-green-500 font-medium">
                      <Check className="h-3 w-3" />
                      Disponível para suas reuniões
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
 
           {/* Coming Soon Card */}
           <Card className="bg-white/5 border-dashed border-white/10 flex flex-col items-center justify-center p-8 text-center space-y-4">
             <div className="h-12 w-12 rounded-full border border-white/10 flex items-center justify-center text-white/20">
               <Plus className="h-6 w-6" />
             </div>
             <div className="space-y-1">
               <p className="font-bold text-white/40">Novas Skills em breve</p>
               <p className="text-xs text-white/20">Estamos treinando novos agentes especialistas.</p>
             </div>
           </Card>
         </div>
       </div>
     </div>
   );
 }