 import React, { useState, useEffect, useRef, useCallback } from 'react';
 import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, MousePointer2, HelpCircle, MessageSquare, Loader2, ChevronRight, Layout, Bot, User } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import { useAuth } from '@/hooks/useAuth';
 import { useLocation } from 'react-router-dom';
 import { supabase } from '@/integrations/supabase/client';
 import { useToast } from '@/hooks/use-toast';
 import { useHubColor, DEFAULT_COLOR } from '@/hooks/useHubColor';
 import { useTheme } from '@/hooks/useTheme';
 import { useIsMobile } from '@/hooks/use-mobile';
 import { Badge } from '@/components/ui/badge';
 import { ScrollArea } from '@/components/ui/scroll-area';
 
 interface Message {
   role: 'user' | 'assistant';
   content: string;
   isLoading?: boolean;
 }
 
 export const FloatingAIAssistant: React.FC = () => {
   const { user } = useAuth();
   const { toast } = useToast();
   const location = useLocation();
   const { color: hubColor } = useHubColor();
   const { theme } = useTheme();
    const { isMobile } = useIsMobile(); // Mobile check will be used to hide
   
    const [isOpen, setIsOpen] = useState(false);
    const [isSelectingElement, setIsSelectingElement] = useState(false);
   const [input, setInput] = useState('');
   const [messages, setMessages] = useState<any[]>([]);
   const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
   // Fetch initial conversation if exists
   useEffect(() => {
     const fetchLastConversation = async () => {
       if (!user?.id) return;
       const { data: convs } = await supabase
         .from('ai_assistant_conversations')
         .select('id')
         .eq('user_id', user.id)
         .order('updated_at', { ascending: false })
         .limit(1);
       
       if (convs && convs.length > 0) {
         setActiveConversationId(convs[0].id);
         // Load messages
         const { data: msgs } = await supabase
           .from('ai_assistant_messages')
           .select('*')
           .eq('conversation_id', convs[0].id)
           .order('created_at', { ascending: true });
         
         if (msgs) {
           setMessages(msgs.map(m => ({
             role: m.role,
             content: m.content
           })));
         }
       }
     };
     fetchLastConversation();
   }, [user?.id]);
 
   const [isProcessing, setIsProcessing] = useState(false);
   const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
   const [companyId, setCompanyId] = useState<string | null>(null);
   
    const scrollEndRef = useRef<HTMLDivElement>(null);
   const inputRef = useRef<HTMLInputElement>(null);
   const isDark = theme === 'dark';
   const accentColor = hubColor || DEFAULT_COLOR;
 
   useEffect(() => {
     const fetchCompany = async () => {
       if (!user?.id) return;
       const { data } = await supabase.from('company_users').select('company_id').eq('user_id', user.id).maybeSingle();
       if (data) setCompanyId(data.company_id);
     };
     fetchCompany();
   }, [user?.id]);
 
   useEffect(() => {
     const handleMouseMove = (e: MouseEvent) => {
       setMousePos({ x: e.clientX, y: e.clientY });
     };
     window.addEventListener('mousemove', handleMouseMove);
     return () => window.removeEventListener('mousemove', handleMouseMove);
   }, []);
 
    const scrollToBottom = useCallback(() => {
      if (scrollEndRef.current) {
        scrollEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, []);

    useEffect(() => {
      if (isOpen) {
        setTimeout(scrollToBottom, 100);
      }
    }, [isOpen, messages, scrollToBottom, isProcessing]);

    // Element Selection Mode Logic
    useEffect(() => {
      if (!isSelectingElement) return;

      const handleMouseOver = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target && !target.closest('.floating-ai-assistant')) {
          target.style.outline = `2px solid ${accentColor}`;
          target.style.outlineOffset = '2px';
          target.style.cursor = 'help';
        }
      };

      const handleMouseOut = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target) {
          target.style.outline = '';
          target.style.outlineOffset = '';
          target.style.cursor = '';
        }
      };

      const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const assistantContainer = target.closest('.floating-ai-assistant');
        
        if (assistantContainer) return;

        e.preventDefault();
        e.stopPropagation();
        
        if (target) {
          const text = target.innerText?.trim().slice(0, 100) || target.getAttribute('aria-label') || 'este elemento';
          handleSubmit(`Para que serve este elemento "${text}"? Explique sua função nesta tela.`);
          
          target.style.outline = '';
          target.style.outlineOffset = '';
          target.style.cursor = '';
        }
        
        setIsSelectingElement(false);
        setIsOpen(true);
      };

      window.addEventListener('mouseover', handleMouseOver);
      window.addEventListener('mouseout', handleMouseOut);
      window.addEventListener('click', handleClick, true);

      return () => {
        window.removeEventListener('mouseover', handleMouseOver);
        window.removeEventListener('mouseout', handleMouseOut);
        window.removeEventListener('click', handleClick, true);
      };
    }, [isSelectingElement, accentColor]);
 
   const getContext = () => {
     const el = document.elementFromPoint(mousePos.x, mousePos.y);
     const elementInfo = el ? {
       tag: el.tagName,
       text: el.textContent?.slice(0, 150).trim(),
       ariaLabel: el.getAttribute('aria-label'),
       placeholder: el.getAttribute('placeholder'),
       role: el.getAttribute('role'),
       id: el.id
     } : null;
 
     // Get some visible text from the page
     const visibleText = document.body.innerText.slice(0, 1000).replace(/\s+/g, ' ');
 
     return {
       path: location.pathname,
       title: document.title,
       elementUnderMouse: elementInfo ? JSON.stringify(elementInfo) : 'Nenhum',
       visibleText
     };
   };
 
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const handleSubmit = async (text?: string, isAutoAction = false) => {
     const msg = text || input.trim();
     if (!msg || isProcessing) return;
 
     const newMessages = [...messages, { role: 'user', content: msg }];
     setMessages(newMessages);
     setInput('');
     setIsProcessing(true);
 
     try {
       const context = getContext();
       
       // Persistence logic (same as AIAssistantHome)
       let currentConvId = activeConversationId;
       if (!currentConvId) {
         const { data: newConv } = await supabase
           .from('ai_assistant_conversations')
           .insert({
             user_id: user?.id,
             company_id: companyId,
             title: msg.substring(0, 60) || 'Conversa Assistente',
             last_message_preview: msg.substring(0, 100),
             message_count: 1
           })
           .select('id')
           .single();
         if (newConv) {
           currentConvId = newConv.id;
           setActiveConversationId(currentConvId);
         }
       } else {
         await supabase.from('ai_assistant_conversations').update({
           last_message_preview: msg.substring(0, 100),
           message_count: messages.length + 1,
           updated_at: new Date().toISOString()
         }).eq('id', currentConvId);
       }
 
       if (currentConvId) {
         await supabase.from('ai_assistant_messages').insert({
           conversation_id: currentConvId,
           role: 'user',
           content: msg
         });
       }
 
        // Enhanced system instructions for more humanized/shorter responses
        const systemPrompt = `Você é um assistente humano e prestativo. 
Responda de forma breve, direta e natural, como em um chat.
NÃO use formatação excessiva como asteriscos (*****) ou negrito desnecessário.
Se a resposta for longa, divida-a em parágrafos curtos.
Não escreva textos gigantes. Seja conciso.`;

        const { data, error } = await supabase.functions.invoke('ai-assistant', {
         body: {
           message: msg,
           userId: user?.id,
           companyId,
           timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              messages: [
                { role: 'system', content: systemPrompt },
                ...messages.map(m => ({ role: m.role, content: m.content }))
              ],
             activeConversationId: currentConvId,
           screenContext: context
         }
       });
 
       if (error) throw error;
 
          let assistantContent = data.response || 'Desculpe, não consegui processar sua solicitação.';
          
          // Humanize: Remove formatting like *****
          assistantContent = assistantContent.replace(/\*+/g, '');

          // Split into multiple messages for a more human feel
          const chunks = assistantContent.split('\n\n').filter((c: string) => c.trim().length > 0);
          
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            if (i > 0) await sleep(800); // Small delay between messages for "human" effect
            
            setMessages(prev => [...prev, { role: 'assistant', content: chunk }]);
            
            if (currentConvId) {
              await supabase.from('ai_assistant_messages').insert({
                conversation_id: currentConvId,
                role: 'assistant',
                content: chunk
              });
              
              await supabase.from('ai_assistant_conversations').update({
                last_message_preview: chunk.substring(0, 100),
                message_count: messages.length + 2 + i,
                updated_at: new Date().toISOString()
              }).eq('id', currentConvId);
            }
          }
     } catch (err: any) {
       console.error('Error in floating assistant:', err);
       toast({
         title: 'Erro no assistente',
         description: 'Não foi possível obter uma resposta agora.',
         variant: 'destructive'
       });
     } finally {
       setIsProcessing(false);
     }
   };
 
   const handleExplainScreen = () => {
     handleSubmit("O que faz essa tela? Explique brevemente o que estou vendo.");
   };
 
    const handleStartSelection = () => {
      setIsSelectingElement(true);
      setIsOpen(false);
      toast({
        title: "Modo de seleção ativado",
        description: "Clique em qualquer elemento da tela para que eu explique sua função.",
      });
    };

      const isHiddenPath = location.pathname.includes('/dashboard/meet-hub') || 
                          location.pathname.includes('/meeting/') || 
                          location.pathname.includes('/dashboard/meeting/');
      if (!user || isMobile || isHiddenPath) return null;
 
    return (
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-4 pointer-events-none floating-ai-assistant">
       <AnimatePresence>
         {isOpen && (
           <motion.div
             initial={{ opacity: 0, scale: 0.9, y: 20 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             exit={{ opacity: 0, scale: 0.9, y: 20 }}
             className="w-[350px] sm:w-[400px] h-[500px] bg-background border shadow-2xl rounded-2xl flex flex-col overflow-hidden pointer-events-auto"
           >
              {/* Header - Cleaned up as requested */}
              <div className="p-5 flex items-center justify-between border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
                <h3 className="text-base font-bold text-foreground/90">Faça sua pergunta</h3>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 rounded-full hover:bg-muted transition-colors" 
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </Button>
              </div>
 
             {/* Quick Actions */}
             <div className="px-4 py-2 flex gap-2 border-b bg-muted/30 overflow-x-auto no-scrollbar">
               <Button 
                 variant="outline" 
                 size="sm" 
                 className="h-7 text-[10px] gap-1 px-2 whitespace-nowrap"
                 onClick={handleExplainScreen}
               >
                 <Layout className="h-3 w-3" />
                 O que essa tela faz?
               </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-[10px] gap-1 px-2 whitespace-nowrap hover:bg-primary/10 hover:text-primary transition-colors"
                  onClick={handleStartSelection}
                >
                  <MousePointer2 className="h-3 w-3" />
                  O que é isso? (Selecionar)
                </Button>
             </div>
 
              {/* Chat Messages - Improved style matching dashboard chat */}
              <ScrollArea className="flex-1 p-5">
                <div className="space-y-6 pb-4">
                  {messages.length === 0 && (
                    <div className="text-center py-12 space-y-4">
                      <div className="w-16 h-16 mx-auto bg-primary/10 rounded-2xl flex items-center justify-center">
                        <Bot className="h-8 w-8 text-primary" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground px-8 leading-relaxed">
                        Olá! Como posso ajudar você hoje? Posso explicar esta tela ou tirar qualquer dúvida.
                      </p>
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {m.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div className="flex flex-col gap-1 max-w-[85%]">
                        <div 
                          className={`p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                            m.role === 'user' 
                              ? 'bg-primary text-primary-foreground rounded-tr-none' 
                              : 'bg-muted border border-border/50 rounded-tl-none'
                          }`}
                        >
                          {m.content}
                        </div>
                      </div>
                      {m.role === 'user' && (
                        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
                          <User className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                  {isProcessing && (
                    <div className="flex gap-3 justify-start">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                      <div className="bg-muted border border-border/50 p-3.5 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-xs text-muted-foreground font-medium">Digitando...</span>
                      </div>
                    </div>
                  )}
                  <div ref={scrollEndRef} />
                </div>
              </ScrollArea>
 
              {/* Input Area - Improved for clean look */}
              <div className="p-5 border-t bg-background/50 backdrop-blur-sm">
               <div className="relative flex items-center gap-2">
                 <input
                   ref={inputRef}
                   value={input}
                   onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
                    placeholder="Digite sua mensagem..."
                    className="w-full bg-muted/50 hover:bg-muted border border-border/50 focus:border-primary/50 rounded-2xl px-5 py-3.5 text-sm focus:ring-2 focus:ring-primary/10 outline-none transition-all pr-12"
                 />
                 <Button 
                    size="icon"
                    className="absolute right-2 h-10 w-10 rounded-xl shadow-lg"
                   disabled={!input.trim() || isProcessing}
                   onClick={() => handleSubmit()}
                 >
                   <Send className="h-4 w-4" />
                 </Button>
               </div>
             </div>
           </motion.div>
         )}
       </AnimatePresence>
 
       {/* Toggle Button */}
       <motion.button
         whileHover={{ scale: 1.05 }}
         whileTap={{ scale: 0.95 }}
         onClick={() => setIsOpen(!isOpen)}
         className="h-14 w-14 rounded-full shadow-xl flex items-center justify-center pointer-events-auto relative group overflow-hidden"
         style={{ backgroundColor: accentColor }}
       >
         <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          {isOpen ? <X className="h-6 w-6 text-white" /> : <MessageSquare className="h-6 w-6 text-white" />}
         
         {/* Tooltip hint on hover (only if closed) */}
         {!isOpen && (
           <div className="absolute right-16 bg-background border shadow-lg px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
              (pergunte o que quiser)
           </div>
         )}
       </motion.button>
     </div>
   );
 };
 
 export default FloatingAIAssistant;