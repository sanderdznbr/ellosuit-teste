 import { Video, Mic, History as HistoryIcon, ChevronRight, Play, Home, Link, Copy, Calendar, Plus, Zap, Brain, Sparkles, X, Check } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
 import { useLocation, useNavigate } from "react-router-dom";
import InPersonMeeting from "./InPersonMeeting";
import MeetingRecordings from "./MeetingRecordings";
import SavedMeetings from "./SavedMeetings";
import SimplifiedMeetingRooms from "./SimplifiedMeetingRooms";
 import SkillsDialog from "./SkillsDialog";
 import { ALL_SKILLS } from "@/constants/skills";
 import { useTheme } from "@/hooks/useTheme";
 import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMeetingRooms } from "@/hooks/useMeetingRooms";
import { APP_CONFIG } from "@/config/app";
import { useToast } from "@/hooks/use-toast";

const MEET_COLOR = "#faf9f7";

 export default function MeetHub() {
   const { theme } = useTheme();
   const location = useLocation();
  const navigate = useNavigate();
  const { createRoom } = useMeetingRooms();
  const { toast } = useToast();
  
    const [activeView, setActiveView] = useState<'hub' | 'in-person' | 'recordings' | 'rooms'>('hub');
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const [showStartMeetingDialog, setShowStartMeetingDialog] = useState(false);
    const [showRecordingsDialog, setShowRecordingsDialog] = useState(false);
    const [showInPersonDialog, setShowInPersonDialog] = useState(false);
    const [showSkillsDialog, setShowSkillsDialog] = useState(false);
    const [meetingLink, setMeetingLink] = useState<string | null>(null);
    const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
    const [showSkillSelection, setShowSkillSelection] = useState(false);
    const [meetingIntentImmediate, setMeetingIntentImmediate] = useState(true);

    const DEFAULT_PREVIEW = "/lovable-uploads/meet-hub-placeholder-new.png";
    
    const getPreviewImage = () => {
      if (hoveredItem === "Gravar uma nova reunião") return "/lovable-uploads/meet-hub-placeholder-new.png";
      if (hoveredItem === "Ver reuniões recentes") return "/lovable-uploads/meet-hub-placeholder-new.png";
       if (hoveredItem === "Minhas Ello Skills") return "/lovable-uploads/meet-hub-placeholder-new.png";
      return DEFAULT_PREVIEW;
    };
   
   useEffect(() => {
     const params = new URLSearchParams(location.search);
     if (params.get('action') === 'record') {
       setActiveView('in-person');
     }
   }, [location]);
 
    const handleStartMeeting = useCallback(async (immediate: boolean, skillId?: string) => {
      const room = await createRoom({
        title: `Reunião ${new Date().toLocaleDateString('pt-BR')}`,
        recording_enabled: false,
        chat_enabled: true,
        screen_sharing_enabled: true,
      });
      
      if (room) {
        let url = APP_CONFIG.getMeetingUrl(room.room_code);
        if (skillId || selectedSkill) {
          url += `?skill=${skillId || selectedSkill}`;
        }
        
         // Convert full URL to relative path for internal navigation
         const relativePath = url.includes('/meet/') ? `/meet/${url.split('/meet/')[1]}` : url;
         
         if (immediate) {
           navigate(relativePath);
         } else {
           setMeetingLink(url);
         }
      }
    }, [createRoom, selectedSkill]);

    const copyLink = () => {
      if (meetingLink) {
        navigator.clipboard.writeText(meetingLink);
        toast({
          title: "Link Copiado!",
          description: "O link da reunião foi copiado para sua área de transferência.",
        });
      }
    };

    const handleAction = (view: string) => {
      if (view === 'rooms') setShowStartMeetingDialog(true);
      else if (view === 'recordings') setShowRecordingsDialog(true);
      else if (view === 'in-person') setShowInPersonDialog(true);
      else if (view === 'skills') setShowSkillsDialog(true);
      else setActiveView(view as any);
    };

    return (
      <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden relative bg-background text-foreground">
        {activeView === 'hub' && (
          <div className="hidden md:block absolute top-0 right-0 bottom-0 w-1/2 z-0 overflow-hidden">
            <div className="relative w-full h-full">
              <img 
                key={getPreviewImage()}
                src={getPreviewImage()} 
                alt="ElloMeeting Preview" 
                className="w-full h-full object-cover object-center animate-in fade-in duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent w-full z-10" />
            </div>
          </div>
       )}

      {activeView === 'hub' ? (
        <>
          <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-8 md:p-16 z-20">
            <div className="w-full max-w-md space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                   {[
                      { icon: Video, title: "Iniciar uma reunião", sub: "Salas de vídeo instantâneas", view: 'rooms' },
                      { icon: HistoryIcon, title: "Ver reuniões recentes", sub: "Histórico e gravações salvas", view: 'recordings' },
                      { icon: Mic, title: "Gravar uma nova reunião", sub: "Gravação presencial e transcrição", view: 'in-person' },
                       { icon: Brain, title: "Minhas Ello Skills", sub: "Seus agentes especialistas", view: 'skills' }
                   ].map((item, idx) => (
                     <button 
                       key={idx}
                         onClick={() => handleAction(item.view)}
                       onMouseEnter={() => setHoveredItem(item.title)}
                       onMouseLeave={() => setHoveredItem(null)}
                        className="w-full group flex items-center justify-between py-6 px-4 hover:bg-white/10 dark:hover:bg-white/5 rounded-xl transition-all text-left"
                      >
                      <div className="flex items-center gap-6">
                          <item.icon className="h-6 w-6 group-hover:scale-110 transition-transform shrink-0 text-[#374DA4]" />
                        <div>
                           <h3 className="text-lg font-medium text-foreground">{item.title}</h3>
                           <p className="text-sm text-muted-foreground">{item.sub}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="hidden md:block w-1/2 h-full" />
        </>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 md:px-6 pt-2 pb-24 md:py-6">
            {activeView === 'in-person' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <InPersonMeeting onBack={() => setActiveView('hub')} />
              </div>
            )}

            {activeView === 'recordings' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="mb-4 flex items-center gap-3">
                  <button 
                    onClick={() => setActiveView('hub')}
                     className="p-2 rounded-full hover:bg-white/10 text-foreground transition-colors"
                   >
                     <ChevronRight className="h-5 w-5 rotate-180" />
                   </button>
                   <h1 className="text-xl font-bold text-foreground">Reuniões Recentes</h1>
                </div>
                <div className="bg-card rounded-2xl overflow-hidden border border-border/10">
                  <SavedMeetings />
                </div>
              </div>
            )}

            {activeView === 'rooms' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="mb-4 flex items-center gap-3">
                  <button 
                    onClick={() => setActiveView('hub')}
                     className="p-2 rounded-full hover:bg-white/10 text-foreground transition-colors"
                   >
                     <ChevronRight className="h-5 w-5 rotate-180" />
                   </button>
                   <h1 className="text-xl font-bold text-foreground">Salas de Reunião</h1>
                </div>
                <div className="bg-card rounded-2xl overflow-hidden border border-border/10">
                  <SimplifiedMeetingRooms />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Minimal Popups */}
       <Dialog open={showStartMeetingDialog} onOpenChange={(open) => {
         setShowStartMeetingDialog(open);
         if (!open) {
           setMeetingLink(null);
           setSelectedSkill(null);
           setShowSkillSelection(false);
         }
       }}>
          <DialogContent className="sm:max-w-[600px] bg-background border-border rounded-[28px] p-6 text-foreground">
           <div className="space-y-8">
             <div className="space-y-1">
               <h2 className="text-xl font-bold text-foreground">
                  {meetingLink ? "Link Gerado" : showSkillSelection ? "Ativar Skill de IA" : "Iniciar uma reunião"}
               </h2>
               <p className="text-muted-foreground text-sm">
                  {meetingLink ? "Copie o link para enviar aos participantes" : showSkillSelection ? "Escolha um agente para acompanhar sua reunião" : "Escolha como deseja começar sua videoconferência"}
               </p>
             </div>
             
             {!meetingLink && !showSkillSelection && (
              <div className="grid grid-cols-1 gap-3">
                 {[
                   {
                     title: "Criar uma reunião para depois",
                     icon: Calendar,
                     action: () => {
                       setMeetingIntentImmediate(false);
                       setShowSkillSelection(true);
                     }
                   },
                   {
                     title: "Criar reunião instantânea",
                     icon: Zap,
                     action: () => {
                       setMeetingIntentImmediate(true);
                       setShowSkillSelection(true);
                     }
                   },
                   {
                     title: "Colocar na Ello agenda",
                     icon: Plus,
                     action: () => toast({ title: "Em breve", description: "Integração com Ello Agenda estará disponível em breve." })
                   }
                 ].map((opt, i) => (
                      <button
                        key={i}
                        onClick={opt.action}
                         className="group flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:border-[#374DA4]/30 hover:bg-accent transition-all text-left cursor-pointer active:scale-[0.98] shadow-sm"
                       >
                        <div className="p-3 rounded-xl bg-[#374DA4]/10 text-[#374DA4] group-hover:scale-105 transition-all">
                          <opt.icon className="h-6 w-6" />
                        </div>
                        <span className="font-bold text-base leading-tight text-foreground/90">{opt.title}</span>
                      </button>
                 ))}
               </div>
             )}

             {!meetingLink && showSkillSelection && (
               <div className="space-y-6">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                   <button
                     onClick={() => setSelectedSkill(null)}
                     className={`p-4 rounded-xl border transition-all text-left flex flex-col gap-2 ${
                        selectedSkill === null 
                          ? 'bg-[#374DA4]/20 border-[#374DA4] ring-1 ring-[#374DA4]/50' 
                          : 'bg-card border-border hover:border-foreground/20 shadow-sm'
                      }`}
                   >
                       <div className="p-2 rounded-lg bg-muted w-fit">
                         <X className="h-4 w-4 text-muted-foreground" />
                      </div>
                     <span className="font-medium text-sm">Sem Skill</span>
                   </button>
                   
                   {ALL_SKILLS.map((skill) => (
                     <button
                       key={skill.id}
                       onClick={() => setSelectedSkill(skill.id)}
                       className={`p-4 rounded-xl border transition-all text-left flex flex-col gap-2 ${
                          selectedSkill === skill.id 
                            ? 'bg-[#374DA4]/20 border-[#374DA4] ring-1 ring-[#374DA4]/50' 
                            : 'bg-card border-border hover:border-foreground/20 shadow-sm'
                        }`}
                     >
                       <div className="p-2 rounded-lg w-fit" style={{ backgroundColor: `${skill.color}20`, color: skill.color }}>
                         <skill.icon className="h-4 w-4" />
                       </div>
                       <div className="overflow-hidden">
                         <span className="font-medium text-sm block truncate">{skill.name}</span>
                         <span className="text-[10px] text-muted-foreground truncate block">{skill.description}</span>
                       </div>
                     </button>
                   ))}
                 </div>

                 <div className="flex gap-4 pt-4">
                   <Button 
                     variant="ghost" 
                     onClick={() => setShowSkillSelection(false)}
                     className="flex-1 h-14 rounded-2xl border border-border hover:bg-muted text-foreground font-bold"
                   >
                     Voltar
                   </Button>
                    <Button 
                      onClick={() => handleStartMeeting(meetingIntentImmediate)}
                      className="flex-[2] h-14 rounded-2xl bg-[#374DA4] text-white hover:bg-[#374DA4]/90 font-bold transition-all"
                    >
                      {selectedSkill 
                        ? (meetingIntentImmediate ? "Ativar e Iniciar" : "Ativar e Gerar Link") 
                        : (meetingIntentImmediate ? "Iniciar sem Skill" : "Gerar Link sem Skill")}
                    </Button>
                 </div>
               </div>
             )}

             {meetingLink && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                  <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between group shadow-sm">
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-muted-foreground text-xs mb-1 uppercase tracking-wider font-bold">Link da Reunião</span>
                      <span className="text-foreground text-sm truncate font-medium">{meetingLink}</span>
                    </div>
                   <Button size="icon" variant="ghost" onClick={copyLink} className="h-10 w-10 hover:bg-[#374DA4]/10 hover:text-[#374DA4] shrink-0 rounded-xl transition-colors">
                     <Copy className="h-5 w-5" />
                   </Button>
                 </div>
                 <Button 
                   onClick={() => {
                     const relativePath = meetingLink?.includes('/meet/') ? `/meet/${meetingLink.split('/meet/')[1]}` : meetingLink;
                     if (relativePath) navigate(relativePath);
                   }}
                   className="w-full h-14 rounded-2xl bg-[#374DA4] text-white hover:bg-[#374DA4]/90 text-lg font-bold transition-all shadow-sm"
                 >
                   Entrar na reunião agora
                 </Button>
               </div>
             )}
           </div>
         </DialogContent>
       </Dialog>

        <Dialog open={showRecordingsDialog} onOpenChange={setShowRecordingsDialog}>
          <DialogContent className="sm:max-w-[880px] h-[88vh] bg-background border-border rounded-[32px] p-0 text-foreground overflow-hidden flex flex-col">
            <SavedMeetings />
          </DialogContent>
        </Dialog>

        <Dialog open={showInPersonDialog} onOpenChange={setShowInPersonDialog}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-background border-border rounded-[32px] p-0 text-foreground scrollbar-hide">
            <InPersonMeeting onBack={() => setShowInPersonDialog(false)} />
          </DialogContent>
        </Dialog>

      <SkillsDialog open={showSkillsDialog} onOpenChange={setShowSkillsDialog} />
    </div>
  );
 }