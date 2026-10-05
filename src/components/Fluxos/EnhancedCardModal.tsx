import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { 
  X, Trash2, Edit2, CheckSquare, FileText, Paperclip, MessageSquare, 
  Users, Star, Share2, Loader2, Sparkles, Upload, Tag, 
  ExternalLink, User, Calendar as CalendarIcon, Clock, MoreHorizontal, Bell, Eye, Copy, 
  Check, ChevronDown, List, Layout, Plus, Send, Zap, Download, Flag
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { labelColors, priorityConfig, defaultCardLabels, WorkflowCard } from './types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EnhancedCardModalProps {
  card: WorkflowCard | null;
  open: boolean;
  onClose: () => void;
  onSave: (cardData: Partial<WorkflowCard>) => void;
  onDelete?: () => void;
  onDuplicate?: (card: WorkflowCard) => void;
  employees?: any[];
  companyId?: string | null;
  userId?: string;
  columnName?: string;
}

export const EnhancedCardModal: React.FC<EnhancedCardModalProps> = ({ 
  card, open, onClose, onSave, onDelete, onDuplicate, employees = [], companyId, userId, columnName 
}) => {
  const { theme } = useTheme();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>('none');
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [comments, setComments] = useState<{ author: string; text: string; date: string; edited_at?: string; history?: { text: string; date: string }[] }[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingCommentIdx, setEditingCommentIdx] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [historyOpenIdx, setHistoryOpenIdx] = useState<number | null>(null);
  const [assignedUserId, setAssignedUserId] = useState<string>('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [activeTab, setActiveTab] = useState('comments');
  
  // New features state
  const [checklist, setChecklist] = useState<{ id: string; text: string; completed: boolean }[]>([]);
  const [showChecklistInput, setShowChecklistInput] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitingMember, setInvitingMember] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [newLabelText, setNewLabelText] = useState('');
  const [newLabelColor, setNewLabelColor] = useState<string>(labelColors[0].value);
  const [userLabels, setUserLabels] = useState<{ id: string; name: string; color: string }[]>([]);
  const [automationButtons, setAutomationButtons] = useState<{ id: string; label: string; action: string }[]>([]);
  const [newAutoLabel, setNewAutoLabel] = useState('');

  // Combined labels: defaults + user-created
  const allLabels = useMemo(
    () => [
      ...defaultCardLabels,
      ...userLabels.map(l => ({ name: l.name, color: l.color })),
    ],
    [userLabels]
  );
  const colorForLabel = (name: string) =>
    allLabels.find(l => l.name === name)?.color || labelColors[0].value;
  const [newAutoAction, setNewAutoAction] = useState('mark_done');

  const dateValue = useMemo(() => (dueDate ? parseISO(dueDate) : undefined), [dueDate]);

  const toLocalInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  useEffect(() => {
    if (card) {
      setTitle(card.title);
      setDescription(card.description || '');
      setPriority(card.priority && card.priority !== 'medium' ? card.priority : 'none');
      setDueDate(card.due_date ? toLocalInput(new Date(card.due_date)) : '');
      setTags(card.tags || []);
      setComments(card.comments || []);
      setAssignedUserId(card.assigned_user_id || '');
      setAttachments(card.attachments || []);
      setChecklist(((card as any).checklist as any) || []);
      setCoverImage((card as any).cover_url || null);
      setAutomationButtons(((card as any).automation_buttons as any) || []);
    } else {
      setTitle(''); setDescription(''); setPriority('medium'); setDueDate('');
      setTags([]); setComments([]); setAssignedUserId(''); setAttachments([]);
      setChecklist([]); setCoverImage(null); setAutomationButtons([]);
    }
  }, [card, open]);

  // Snapshot for dirty detection
  const snapshot = useMemo(() => JSON.stringify({
    title, description, priority, dueDate, tags, comments,
    assignedUserId, attachments, checklist, coverImage, automationButtons,
  }), [title, description, priority, dueDate, tags, comments, assignedUserId, attachments, checklist, coverImage, automationButtons]);
  const initialSnapshotRef = useRef<string>('');
  useEffect(() => { if (open) initialSnapshotRef.current = snapshot; /* eslint-disable-next-line */ }, [open, card]);

  const handleClose = () => {
    const dirty = snapshot !== initialSnapshotRef.current;
    if (dirty) {
      const ok = window.confirm('Você tem alterações não salvas. Deseja sair sem salvar?');
      if (!ok) return;
    }
    onClose();
  };

  // Load user-created labels
  useEffect(() => {
    if (!open || !userId) return;
    (async () => {
      const { data } = await supabase
        .from('user_card_labels' as any)
        .select('id, name, color')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (data) setUserLabels(data as any);
    })();
  }, [open, userId]);

  const handleSave = () => {
    onSave({
      title, description,
      priority: priority === 'none' ? null : priority,
      due_date: dueDate || null,
      tags: tags.length > 0 ? tags : [],
      comments: comments.length > 0 ? comments : [],
      assigned_user_id: assignedUserId || null,
      attachments: attachments.length > 0 ? attachments : [],
      checklist: checklist as any,
      cover_url: coverImage,
      automation_buttons: automationButtons as any,
    } as any);
  };

  const addComment = async () => {
    if (!newComment.trim() || !card?.id || !userId) return;
    
    const commentData = {
      card_id: card.id,
      user_id: userId,
      text: newComment,
      author: 'Você' // Ideally we would get the user's name
    };

    const newCommentObj = { author: commentData.author, text: commentData.text, date: new Date().toISOString() };
    const updatedComments = [...comments, newCommentObj];
    
    setComments(updatedComments);
    setNewComment('');

    // Save to card directly
    const { error } = await supabase
      .from('workflow_cards')
      .update({ comments: updatedComments })
      .eq('id', card.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao salvar comentário', description: error.message });
    }
  };

  const persistComments = async (next: typeof comments) => {
    setComments(next);
    if (!card?.id) return;
    const { error } = await supabase.from('workflow_cards').update({ comments: next }).eq('id', card.id);
    if (error) toast({ variant: 'destructive', title: 'Erro ao atualizar comentário', description: error.message });
  };

  const startEditComment = (idx: number) => {
    setEditingCommentIdx(idx);
    setEditingCommentText(comments[idx]?.text || '');
  };

  const cancelEditComment = () => {
    setEditingCommentIdx(null);
    setEditingCommentText('');
  };

  const saveEditComment = async () => {
    if (editingCommentIdx === null) return;
    const txt = editingCommentText.trim();
    const original = comments[editingCommentIdx];
    if (!txt || !original || txt === original.text) { cancelEditComment(); return; }
    const history = [...(original.history || []), { text: original.text, date: original.edited_at || original.date }];
    const next = comments.map((c, i) => i === editingCommentIdx
      ? { ...c, text: txt, edited_at: new Date().toISOString(), history }
      : c
    );
    cancelEditComment();
    await persistComments(next);
  };

  const deleteComment = async (idx: number) => {
    const next = comments.filter((_, i) => i !== idx);
    await persistComments(next);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !card?.id || !userId) return;

    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${card.id}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('workflow-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('workflow-attachments')
        .getPublicUrl(filePath);

      const newAttachment = {
        name: file.name,
        url: publicUrl,
        type: file.type,
        size: file.size,
        date: new Date().toISOString()
      };

      const updatedAttachments = [...attachments, newAttachment];
      setAttachments(updatedAttachments);

      await supabase
        .from('workflow_cards')
        .update({ attachments: updatedAttachments })
        .eq('id', card.id);

      toast({ title: 'Sucesso', description: 'Arquivo anexado com sucesso' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro no upload', description: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !card?.id) return;
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${card.id}/cover-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('workflow-attachments').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('workflow-attachments').getPublicUrl(path);
      setCoverImage(publicUrl);
      await supabase.from('workflow_cards').update({ cover_url: publicUrl } as any).eq('id', card.id);
      toast({ title: 'Capa atualizada' });
      setCoverOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao enviar capa', description: e.message });
    } finally {
      setIsUploading(false);
    }
  };

  const removeCover = async () => {
    setCoverImage(null);
    if (card?.id) await supabase.from('workflow_cards').update({ cover_url: null } as any).eq('id', card.id);
    toast({ title: 'Capa removida' });
    setCoverOpen(false);
  };

  const toggleAssignee = async (userId: string) => {
    const newId = assignedUserId === userId ? '' : userId;
    setAssignedUserId(newId);
    if (card?.id) await supabase.from('workflow_cards').update({ assigned_user_id: newId || null }).eq('id', card.id);
  };

  const inviteMemberByEmail = async () => {
    const email = inviteEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({ title: 'Email inválido', description: 'Digite um email válido.', variant: 'destructive' });
      return;
    }
    if (!companyId) {
      toast({ title: 'Erro', description: 'Empresa não identificada.', variant: 'destructive' });
      return;
    }
    setInvitingMember(true);
    try {
      const { data, error } = await supabase.functions.invoke('team-invite', {
        body: { action: 'send-invite', email, role: 'employee', permissions: [], companyId },
      });
      if (error) throw error;
      toast({ title: 'Convite enviado!', description: `Convite enviado para ${email}.` });
      setInviteEmail('');
    } catch (e: any) {
      toast({ title: 'Erro ao convidar', description: e?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setInvitingMember(false);
    }
  };

  const toggleLabel = async (label: string) => {
    const next = tags.includes(label) ? tags.filter(t => t !== label) : [...tags, label];
    setTags(next);
    if (card?.id) await supabase.from('workflow_cards').update({ tags: next }).eq('id', card.id);
  };

  const addCustomLabel = async () => {
    const name = newLabelText.trim();
    if (!name || !userId) return;
    // Save label to user's library
    const { data, error } = await supabase
      .from('user_card_labels' as any)
      .insert({ user_id: userId, name, color: newLabelColor })
      .select('id, name, color')
      .maybeSingle();
    if (error && !String(error.message).includes('duplicate')) {
      toast({ title: 'Erro ao criar etiqueta', description: error.message, variant: 'destructive' });
      return;
    }
    if (data) setUserLabels(prev => [...prev, data as any]);
    // Apply to current card
    if (!tags.includes(name)) {
      const next = [...tags, name];
      setTags(next);
      if (card?.id) await supabase.from('workflow_cards').update({ tags: next }).eq('id', card.id);
    }
    setNewLabelText('');
    toast({ title: 'Etiqueta criada', description: name });
  };

  const removeUserLabel = async (id: string, name: string) => {
    await supabase.from('user_card_labels' as any).delete().eq('id', id);
    setUserLabels(prev => prev.filter(l => l.id !== id));
    if (tags.includes(name)) {
      const next = tags.filter(t => t !== name);
      setTags(next);
      if (card?.id) await supabase.from('workflow_cards').update({ tags: next }).eq('id', card.id);
    }
  };

  const addAutomationButton = async () => {
    if (!newAutoLabel.trim()) return;
    const next = [...automationButtons, { id: Math.random().toString(36).slice(2), label: newAutoLabel.trim(), action: newAutoAction }];
    setAutomationButtons(next);
    setNewAutoLabel('');
    if (card?.id) await supabase.from('workflow_cards').update({ automation_buttons: next as any }).eq('id', card.id);
  };

  const removeAutomationButton = async (id: string) => {
    const next = automationButtons.filter(b => b.id !== id);
    setAutomationButtons(next);
    if (card?.id) await supabase.from('workflow_cards').update({ automation_buttons: next as any }).eq('id', card.id);
  };

  const runAutomation = async (action: string) => {
    if (!card?.id) return;
    if (action === 'mark_done') {
      const done = checklist.map(c => ({ ...c, completed: true }));
      setChecklist(done);
      await supabase.from('workflow_cards').update({ checklist: done as any }).eq('id', card.id);
      toast({ title: 'Tudo marcado como concluído' });
    } else if (action === 'set_today') {
      const today = new Date().toISOString().slice(0, 16);
      setDueDate(today);
      await supabase.from('workflow_cards').update({ due_date: today }).eq('id', card.id);
      toast({ title: 'Data definida para hoje' });
    } else if (action === 'set_high') {
      setPriority('high');
      await supabase.from('workflow_cards').update({ priority: 'high' }).eq('id', card.id);
      toast({ title: 'Prioridade alta' });
    }
  };

  const duplicateCard = async () => {
    if (!card || !companyId || !userId) return;
    const { data, error } = await supabase.from('workflow_cards').insert({
      column_id: card.column_id,
      title: `${card.title} (cópia)`,
      description: card.description || null,
      priority: card.priority || 'medium',
      due_date: card.due_date || null,
      tags: card.tags || [],
      attachments: card.attachments || [],
      comments: [] as any,
      assigned_user_id: card.assigned_user_id || null,
      checklist: (card as any).checklist || [],
      cover_url: (card as any).cover_url || null,
      position: (card.position || 0) + 1,
      company_id: companyId,
      created_by: userId,
    } as any).select().single();
    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao copiar', description: error.message });
      return;
    }
    toast({ title: 'Cartão duplicado' });
    onDuplicate?.(data as any);
    onClose();
  };

  const saveAsTemplate = () => {
    if (!card) return;
    try {
      const templates = JSON.parse(localStorage.getItem('fluxos_card_templates') || '[]');
      templates.push({
        id: Math.random().toString(36).slice(2),
        title: title,
        description,
        priority,
        tags,
        checklist,
        cover_url: coverImage,
        savedAt: new Date().toISOString(),
      });
      localStorage.setItem('fluxos_card_templates', JSON.stringify(templates));
      toast({ title: 'Modelo salvo', description: 'Disponível para reutilizar neste navegador.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar modelo' });
    }
  };

  const assignedUser = employees.find(e => e.user_id === assignedUserId);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className={`max-w-[768px] w-[95vw] h-[90vh] md:h-auto md:max-h-[85vh] overflow-hidden flex flex-col rounded-xl shadow-2xl p-0 border-none ${theme === 'dark' ? 'bg-[#1d2125] text-[#B6C2CF]' : 'bg-white text-gray-800'}`}>
        {/* Cover Image Section */}
        {coverImage && (
          <div className="h-32 w-full bg-cover bg-center" style={{ backgroundImage: `url(${coverImage})` }} />
        )}

        {/* Header Section */}
        <div className="px-6 py-4 flex flex-col gap-1">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <Layout className={`h-5 w-5 mt-1.5 ${theme === 'dark' ? 'text-[#B6C2CF]' : 'text-gray-500'}`} />
              <div className="flex-1">
                {isEditingTitle ? (
                  <Input 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => setIsEditingTitle(false)}
                    autoFocus
                    className={`text-xl font-bold rounded-lg h-9 px-2 -ml-2 ${theme === 'dark' ? 'bg-white/5 border-primary/50 text-white' : 'bg-gray-100 border-gray-300 text-gray-900'}`}
                  />
                ) : (
                  <h2 
                    className={`text-xl font-bold cursor-pointer px-2 -ml-2 rounded-lg py-1 transition-colors ${theme === 'dark' ? 'text-white hover:bg-white/5' : 'text-gray-900 hover:bg-gray-100'}`}
                    onClick={() => setIsEditingTitle(true)}
                  >
                    {title || 'Sem título'}
                  </h2>
                )}
                <p className={`text-sm ${theme === 'dark' ? 'text-[#B6C2CF]/60' : 'text-gray-500'}`}>
                  na lista <span className={`underline cursor-pointer transition-colors ${theme === 'dark' ? 'hover:text-white' : 'hover:text-gray-900'}`}>{columnName || 'Demandas'}</span>
                </p>

              </div>
            </div>
            <div className="flex items-center gap-1 -mt-1 mr-8">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => {
                  setIsFavorite(!isFavorite);
                  toast({ title: !isFavorite ? "Favoritado" : "Removido dos favoritos", description: title });
                }}
                className={`h-8 w-8 rounded-lg ${theme === 'dark' ? 'text-[#B6C2CF] hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <Star className={`h-4 w-4 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
              </Button>
              <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-lg ${theme === 'dark' ? 'text-[#B6C2CF] hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'}`}><Eye className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={handleClose} className={`h-8 w-8 rounded-lg ${theme === 'dark' ? 'text-[#B6C2CF] hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'}`}><X className="h-5 w-5" /></Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_192px] gap-8">
            {/* Main Content Area */}
            <div className="space-y-8">
              {/* Badges Row (Members, Labels, Dates) */}
              <div className="flex flex-wrap gap-6">
                <div className="space-y-1.5">
                  <h3 className={`text-[12px] font-bold uppercase tracking-tight ${theme === 'dark' ? 'text-[#B6C2CF]/60' : 'text-gray-500'}`}>Membros</h3>
                  <div className="flex items-center gap-2 group cursor-pointer" onClick={() => toast({ title: "Membros", description: "Gerenciamento de membros em breve." })}>
                    {assignedUser && (
                      <Avatar className="h-8 w-8 ring-2 ring-[#1d2125]">
                        <AvatarImage src={assignedUser.avatar_url} />
                        <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                          {assignedUser.name?.[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}>
                      <Plus className="h-4 w-4" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h3 className={`text-[12px] font-bold uppercase tracking-tight ${theme === 'dark' ? 'text-[#B6C2CF]/60' : 'text-gray-500'}`}>Etiquetas</h3>
                  <div className="flex flex-wrap gap-1">
                    {tags.length > 0 ? tags.map((tag, i) => (
                      <div
                        key={i}
                        onClick={() => setLabelsOpen(true)}
                        className="h-8 px-3 rounded font-bold text-xs flex items-center text-white hover:brightness-110 cursor-pointer transition-all"
                        style={{ backgroundColor: colorForLabel(tag) }}
                      >
                        {tag}
                      </div>
                    )) : (
                      <div
                        onClick={() => setLabelsOpen(true)}
                        className={`h-8 px-3 rounded font-bold text-xs flex items-center transition-all cursor-pointer ${theme === 'dark' ? 'bg-white/5 text-[#B6C2CF] hover:bg-white/10' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        Adicionar etiquetas
                      </div>
                    )}
                    {tags.length > 0 && (
                      <div onClick={() => setLabelsOpen(true)} className={`h-8 w-8 rounded flex items-center justify-center transition-colors cursor-pointer ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}>
                        <Plus className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 relative">
                  <h3 className={`text-[12px] font-bold uppercase tracking-tight ${theme === 'dark' ? 'text-[#B6C2CF]/60' : 'text-gray-500'}`}>Data de entrega</h3>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsDatePickerOpen(true)}
                    className={`h-8 px-3 rounded justify-start font-medium w-[220px] text-xs transition-all ${
                      theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-[#B6C2CF] border-white/10' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200'
                    }`}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {dueDate ? format(dateValue!, "PPp", { locale: ptBR }) : <span>Definir data</span>}
                    {dueDate && <Check className="ml-auto h-3 w-3 text-[#374DA4]" />}
                  </Button>
                </div>
              </div>
              
              {/* Checklist Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckSquare className={`h-5 w-5 ${theme === 'dark' ? 'text-[#B6C2CF]' : 'text-gray-500'}`} />
                    <h3 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Checklist</h3>
                  </div>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => setShowChecklistInput(true)}
                    className={`h-8 rounded font-bold text-xs ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                  >
                    Adicionar
                  </Button>
                </div>
                
                {checklist.length > 0 && (
                  <div className="space-y-2">
                    {checklist.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 group">
                        <div 
                          onClick={() => {
                            setChecklist(checklist.map(i => i.id === item.id ? { ...i, completed: !i.completed } : i));
                          }}
                          className={`h-4 w-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                            item.completed 
                              ? 'bg-primary border-primary' 
                              : (theme === 'dark' ? 'border-[#B6C2CF]/40' : 'border-gray-300')
                          }`}
                        >
                          {item.completed && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span className={`text-sm flex-1 ${item.completed ? 'line-through opacity-50' : ''} ${theme === 'dark' ? 'text-[#B6C2CF]' : 'text-gray-700'}`}>
                          {item.text}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setChecklist(checklist.filter(i => i.id !== item.id))}
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                {showChecklistInput && (
                  <div className="space-y-2">
                    <Input 
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      placeholder="Adicionar item..."
                      className={`h-9 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200'}`}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newChecklistItem.trim()) {
                          setChecklist([...checklist, { id: Math.random().toString(), text: newChecklistItem, completed: false }]);
                          setNewChecklistItem('');
                        }
                      }}
                    />
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => {
                          if (newChecklistItem.trim()) {
                            setChecklist([...checklist, { id: Math.random().toString(), text: newChecklistItem, completed: false }]);
                            setNewChecklistItem('');
                          }
                          setShowChecklistInput(false);
                        }}
                      >
                        Adicionar
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowChecklistInput(false)}>Cancelar</Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Description Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className={`h-5 w-5 ${theme === 'dark' ? 'text-[#B6C2CF]' : 'text-gray-500'}`} />
                    <h3 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Descrição</h3>

                  </div>
                </div>
                <div className="group relative">
                  <Textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Adicionar uma descrição mais detalhada..."
                    className={`min-h-[100px] w-full px-3 py-2 rounded-lg transition-colors text-sm leading-relaxed whitespace-pre-wrap resize-none ${theme === 'dark' ? 'bg-white/5 focus:bg-white/10 text-[#B6C2CF] border-white/10' : 'bg-gray-50 focus:bg-gray-100 text-gray-700 border-gray-200'}`}
                  />
                </div>
              </div>

              {/* Attachments Section */}
              {attachments.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Paperclip className={`h-5 w-5 ${theme === 'dark' ? 'text-[#B6C2CF]' : 'text-gray-500'}`} />
                    <h3 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Anexos</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {attachments.map((file, i) => (
                      <div key={i} className={`flex items-center gap-3 p-2 rounded-lg border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="h-10 w-12 bg-primary/10 rounded flex items-center justify-center text-primary font-bold text-[10px] uppercase">
                          {file.name.split('.').pop() || 'FILE'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{file.name}</p>
                          <p className="text-[10px] opacity-60">Adicionado em {format(new Date(file.date), 'PP', { locale: ptBR })}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(file.url, '_blank')}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className={`h-5 w-5 ${theme === 'dark' ? 'text-[#B6C2CF]' : 'text-gray-500'}`} />
                    <h3 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Atividade</h3>

                  </div>
                </div>

                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="bg-primary text-white text-xs font-bold">V</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <div className="relative">
                      <Textarea 
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Escreva um comentário..."
                        className={`rounded-lg min-h-[40px] shadow-sm resize-none py-2 px-3 text-sm placeholder:text-[#B6C2CF]/40 ${theme === 'dark' ? 'bg-[#22272b] border-[#333] text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                      />
                      {newComment.trim() && (
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" onClick={addComment} className="bg-primary hover:bg-primary/90 text-white font-bold h-8 px-4">Salvar</Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6 pt-2">
                  {comments.map((comment, i) => {
                    const isEditing = editingCommentIdx === i;
                    const hasHistory = (comment.history?.length || 0) > 0;
                    return (
                      <div key={i} className="flex gap-3">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">{comment.author?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{comment.author}</span>
                            <span className={`text-xs ${theme === 'dark' ? 'text-[#B6C2CF]/60' : 'text-gray-500'}`}>{format(new Date(comment.date), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}</span>
                            {comment.edited_at && (
                              <span className="text-[11px] italic text-muted-foreground">(editado {format(new Date(comment.edited_at), "d MMM HH:mm", { locale: ptBR })})</span>
                            )}
                          </div>
                          {isEditing ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editingCommentText}
                                onChange={(e) => setEditingCommentText(e.target.value)}
                                className="min-h-[70px] text-sm rounded-lg"
                                autoFocus
                              />
                              <div className="flex items-center gap-2">
                                <Button size="sm" onClick={saveEditComment} className="h-8 px-4 bg-[#374DA4] hover:bg-[#374DA4]/90 text-white text-xs font-bold">Salvar</Button>
                                <Button size="sm" variant="ghost" onClick={cancelEditComment} className="h-8 px-3 text-xs">Cancelar</Button>
                              </div>
                            </div>
                          ) : (
                            <div className={`px-3 py-2 rounded-lg text-sm shadow-sm inline-block min-w-[100px] border ${theme === 'dark' ? 'bg-[#22272b] text-white border-white/5' : 'bg-white text-gray-800 border-gray-100'} whitespace-pre-wrap break-words`}>
                              {comment.text}
                            </div>
                          )}
                          {!isEditing && (
                            <div className="flex items-center gap-3 mt-1 px-1">
                              <button onClick={() => startEditComment(i)} className="text-[12px] underline hover:text-[#374DA4] transition-colors">Editar</button>
                              <span className="text-[12px] text-muted-foreground/40">•</span>
                              <button onClick={() => deleteComment(i)} className="text-[12px] underline hover:text-destructive transition-colors">Excluir</button>
                              {hasHistory && (
                                <>
                                  <span className="text-[12px] text-muted-foreground/40">•</span>
                                  <Popover open={historyOpenIdx === i} onOpenChange={(o) => setHistoryOpenIdx(o ? i : null)}>
                                    <PopoverTrigger asChild>
                                      <button className="text-[12px] underline hover:text-[#374DA4] transition-colors">
                                        Histórico ({comment.history!.length})
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent align="start" className="w-80 p-3 rounded-xl z-[200]">
                                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Histórico de edições</p>
                                      <ScrollArea className="max-h-64">
                                        <div className="space-y-2">
                                          {[...(comment.history || [])].reverse().map((h, hi) => (
                                            <div key={hi} className="border border-border rounded-lg p-2 bg-muted/30">
                                              <p className="text-[10px] text-muted-foreground mb-1">
                                                {format(new Date(h.date), "d 'de' MMM 'às' HH:mm", { locale: ptBR })}
                                              </p>
                                              <p className="text-xs whitespace-pre-wrap break-words text-foreground">{h.text}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </ScrollArea>
                                    </PopoverContent>
                                  </Popover>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sidebar Actions Area */}
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className={`text-[12px] font-bold uppercase tracking-tight px-1 ${theme === 'dark' ? 'text-[#B6C2CF]/60' : 'text-gray-500'}`}>Adicionar ao cartão</h3>
                <div className="flex flex-col gap-2">
                  <Popover open={membersOpen} onOpenChange={setMembersOpen}>
                    <PopoverTrigger asChild><div><SidebarButton icon={User} label="Membros" onClick={() => setMembersOpen(true)} /></div></PopoverTrigger>
                    <PopoverContent align="end" className="w-72 p-2 rounded-xl z-[120]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">Atribuir membro</p>
                      <ScrollArea className="max-h-64">
                        <div className="space-y-1">
                          {employees.length === 0 && <p className="text-xs text-muted-foreground p-2">Nenhum membro encontrado</p>}
                          {employees.map(e => {
                            const active = assignedUserId === e.user_id;
                            return (
                              <button key={e.user_id} onClick={() => toggleAssignee(e.user_id)} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm ${active ? 'bg-[#374DA4]/10 text-[#374DA4]' : 'hover:bg-muted'}`}>
                                <Avatar className="h-7 w-7"><AvatarImage src={e.avatar_url} /><AvatarFallback className="text-[10px] bg-primary/20 text-primary font-bold">{e.name?.[0]?.toUpperCase()}</AvatarFallback></Avatar>
                                <span className="flex-1 truncate">{e.name}</span>
                                {active && <Check className="h-4 w-4" />}
                              </button>
                            );
                          })}
                        </div>
                      </ScrollArea>
                      <Separator className="my-2" />
                      <div className="px-1 pb-1 space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Convidar por email</p>
                        <div className="flex gap-1.5">
                          <Input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="email@exemplo.com"
                            className="h-8 text-xs"
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); inviteMemberByEmail(); } }}
                          />
                          <Button
                            size="sm"
                            onClick={inviteMemberByEmail}
                            disabled={invitingMember || !inviteEmail.trim()}
                            className="h-8 px-3 bg-[#374DA4] hover:bg-[#374DA4]/90 text-white text-xs"
                          >
                            {invitingMember ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">O convidado receberá um link por email para entrar na equipe.</p>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Popover open={labelsOpen} onOpenChange={setLabelsOpen}>
                    <PopoverTrigger asChild><div><SidebarButton icon={Tag} label="Etiquetas" onClick={() => setLabelsOpen(true)} /></div></PopoverTrigger>
                    <PopoverContent align="end" className="w-80 p-3 rounded-xl z-[200] space-y-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Etiquetas</p>
                      <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                        {allLabels.map((lc) => {
                          const active = tags.includes(lc.name);
                          const custom = userLabels.find(u => u.name === lc.name);
                          return (
                            <div key={lc.name} className="flex items-center gap-2">
                              <button
                                onClick={() => toggleLabel(lc.name)}
                                className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted text-left"
                              >
                                <div className="h-6 w-10 rounded" style={{ backgroundColor: lc.color }} />
                                <span className="text-xs flex-1 font-medium">{lc.name}</span>
                                {active && <Check className="h-4 w-4 text-[#374DA4]" />}
                              </button>
                              {custom && (
                                <button
                                  onClick={() => removeUserLabel(custom.id, custom.name)}
                                  className="h-7 w-7 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center"
                                  title="Remover etiqueta"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <Separator />
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Criar nova</p>
                        <Input
                          value={newLabelText}
                          onChange={e => setNewLabelText(e.target.value)}
                          placeholder="Nome da etiqueta..."
                          className="h-8 text-xs"
                          onKeyDown={e => { if (e.key === 'Enter') addCustomLabel(); }}
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {labelColors.map(c => (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => setNewLabelColor(c.value)}
                              className={`h-6 w-6 rounded-md transition-all ${newLabelColor === c.value ? 'ring-2 ring-offset-2 ring-[#374DA4] ring-offset-background scale-110' : 'hover:scale-105'}`}
                              style={{ backgroundColor: c.value }}
                              title={c.name}
                            />
                          ))}
                        </div>
                        <Button
                          size="sm"
                          onClick={addCustomLabel}
                          disabled={!newLabelText.trim()}
                          className="w-full h-8 bg-[#374DA4] hover:bg-[#2400b3] text-white"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" /> Criar etiqueta
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <SidebarButton icon={CheckSquare} label="Checklist" onClick={() => setShowChecklistInput(true)} />
                  <Popover>
                    <PopoverTrigger asChild>
                      <div><SidebarButton icon={Flag} label="Prioridade" /></div>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-56 p-2 rounded-xl z-[200]">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">Prioridade</p>
                      <div className="space-y-1">
                         {[
                           { value: 'none', label: 'Sem prioridade', color: 'bg-muted-foreground/40' },
                          { value: 'low', label: 'Baixa', color: 'bg-emerald-500' },
                          { value: 'high', label: 'Alta', color: 'bg-rose-500' },
                        ].map(opt => {
                          const active = priority === opt.value;
                          return (
                            <button
                              key={opt.value}
                              onClick={async () => {
                                setPriority(opt.value);
                                if (card?.id) {
                                   await supabase.from('workflow_cards').update({ priority: opt.value === 'none' ? null : opt.value }).eq('id', card.id);
                                }
                              }}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm ${active ? 'bg-[#374DA4]/10 text-[#374DA4]' : 'hover:bg-muted'}`}
                            >
                              <span className={`h-3 w-3 rounded-full ${opt.color}`} />
                              <span className="flex-1">{opt.label}</span>
                              {active && <Check className="h-4 w-4" />}
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen} modal={false}>
                    <PopoverTrigger asChild>
                      <div><SidebarButton icon={Clock} label="Datas" /></div>
                    </PopoverTrigger>
                    <PopoverContent
                      side="left"
                      align="start"
                      sideOffset={12}
                      collisionPadding={16}
                      avoidCollisions
                      onOpenAutoFocus={(e) => e.preventDefault()}
                      className="w-auto p-0 rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl z-[200] overflow-hidden"
                    >
                      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/40">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-[#374DA4]/10 flex items-center justify-center">
                            <CalendarIcon className="h-3.5 w-3.5 text-[#374DA4]" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[13px] font-semibold leading-none text-foreground">Data de entrega</span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">
                              {dueDate && dateValue ? format(dateValue, "EEE, dd MMM 'às' HH:mm", { locale: ptBR }) : 'Nenhuma data selecionada'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="p-2 pointer-events-auto">
                        <Calendar
                          mode="single"
                          selected={dateValue}
                          onSelect={(date) => {
                             if (date) {
                               const current = dateValue || new Date();
                               const d = new Date(date);
                               d.setHours(current.getHours() || 12, current.getMinutes() || 0, 0, 0);
                               setDueDate(toLocalInput(d));
                             }
                           }}
                          initialFocus
                          locale={ptBR}
                          className="pointer-events-auto p-2"
                        />
                      </div>
                      <div className="px-4 pb-3 pt-1 space-y-3">
                        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-muted/50 border border-border">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[12px] font-medium text-foreground">Horário</span>
                          </div>
                          <Input
                            type="time"
                            value={dueDate && dateValue ? format(dateValue, "HH:mm") : "12:00"}
                            onChange={(e) => {
                               const value = e.target.value;
                               if (!value) return;
                               const [hours, minutes] = value.split(':');
                               const current = dateValue || new Date();
                               const newDate = new Date(current);
                               newDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
                               setDueDate(toLocalInput(newDate));
                             }}
                            className="h-8 w-28 text-sm font-semibold rounded-lg bg-background border-border"
                          />
                        </div>
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <Button
                            size="sm"
                            className="h-9 text-xs font-semibold rounded-lg bg-[#374DA4] hover:bg-[#2400b3] text-white"
                            onClick={async () => {
                              const finalDate = dueDate || new Date().toISOString().slice(0, 16);
                              if (!dueDate) setDueDate(finalDate);
                              if (card?.id) {
                                await supabase.from('workflow_cards').update({ due_date: new Date(finalDate).toISOString() }).eq('id', card.id);
                                toast({ title: 'Data definida', description: format(new Date(finalDate), "PPp", { locale: ptBR }) });
                              }
                              setIsDatePickerOpen(false);
                            }}
                          >
                            <Check className="h-3.5 w-3.5 mr-1.5" /> Salvar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 text-xs font-medium rounded-lg text-muted-foreground hover:text-destructive"
                            onClick={() => { setDueDate(''); setIsDatePickerOpen(false); }}
                          >
                            Limpar
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Popover open={coverOpen} onOpenChange={setCoverOpen}>
                    <PopoverTrigger asChild><div><SidebarButton icon={Layout} label="Capa" onClick={() => setCoverOpen(true)} /></div></PopoverTrigger>
                    <PopoverContent align="end" className="w-72 p-3 rounded-xl z-[120] space-y-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Capa do cartão</p>
                      {coverImage && <img src={coverImage} alt="capa" className="w-full h-24 object-cover rounded-lg" />}
                      <input type="file" accept="image/*" ref={coverInputRef} className="hidden" onChange={handleCoverUpload} />
                      <Button size="sm" onClick={() => coverInputRef.current?.click()} disabled={isUploading} className="w-full bg-[#374DA4] hover:bg-[#2400b3] h-8 text-xs">
                        {isUploading ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Enviando...</> : <><Upload className="h-3 w-3 mr-1" />Enviar imagem</>}
                      </Button>
                      {coverImage && <Button size="sm" variant="ghost" onClick={removeCover} className="w-full h-8 text-xs text-destructive">Remover capa</Button>}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className={`text-[12px] font-bold uppercase tracking-tight px-1 ${theme === 'dark' ? 'text-[#B6C2CF]/60' : 'text-gray-500'}`}>Automação</h3>
                <div className="flex flex-col gap-2">
                  <Popover open={autoOpen} onOpenChange={setAutoOpen}>
                    <PopoverTrigger asChild><div><SidebarButton icon={Zap} label="Adicionar botão" onClick={() => setAutoOpen(true)} /></div></PopoverTrigger>
                    <PopoverContent align="end" className="w-80 p-3 rounded-xl z-[120] space-y-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Botão de automação</p>
                      <Input value={newAutoLabel} onChange={e => setNewAutoLabel(e.target.value)} placeholder="Rótulo (ex: Concluir tudo)" className="h-8 text-xs" />
                      <Select value={newAutoAction} onValueChange={setNewAutoAction}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="z-[130]">
                          <SelectItem value="mark_done">Marcar checklist como feito</SelectItem>
                          <SelectItem value="set_today">Definir data para hoje</SelectItem>
                          <SelectItem value="set_high">Definir prioridade alta</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={addAutomationButton} className="w-full h-8 text-xs bg-[#374DA4] hover:bg-[#2400b3]">Criar botão</Button>
                      {automationButtons.length > 0 && (
                        <div className="space-y-1 pt-2 border-t">
                          {automationButtons.map(b => (
                            <div key={b.id} className="flex items-center gap-1">
                              <Button size="sm" onClick={() => runAutomation(b.action)} className="flex-1 h-7 text-xs justify-start bg-muted text-foreground hover:bg-muted/70">
                                <Zap className="h-3 w-3 mr-1.5 text-[#374DA4]" />{b.label}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => removeAutomationButton(b.id)} className="h-7 w-7 p-0"><X className="h-3 w-3" /></Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                  {automationButtons.length > 0 && automationButtons.map(b => (
                    <Button key={b.id} size="sm" variant="secondary" onClick={() => runAutomation(b.action)} className="w-full justify-start h-8 px-3 rounded font-bold text-xs">
                      <Zap className="h-3.5 w-3.5 mr-2 text-[#374DA4]" />{b.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <h3 className={`text-[12px] font-bold uppercase tracking-tight px-1 ${theme === 'dark' ? 'text-[#B6C2CF]/60' : 'text-gray-500'}`}>Ações</h3>
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <SidebarButton 
                    icon={Paperclip} 
                    label={isUploading ? "Enviando..." : "Anexar arquivo"} 
                    onClick={() => fileInputRef.current?.click()} 
                  />
                  <SidebarButton icon={Share2} label="Compartilhar" onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    toast({ title: "Link copiado!", description: "O link do cartão foi copiado para a área de transferência." });
                  }} />
                  <SidebarButton icon={Copy} label="Copiar" onClick={duplicateCard} />
                  <SidebarButton icon={Layout} label="Salvar como modelo" onClick={saveAsTemplate} />
                  <Separator className={theme === 'dark' ? 'bg-white/5 my-1' : 'bg-gray-100 my-1'} />
                  <SidebarButton icon={Trash2} label="Excluir" variant="destructive" onClick={onDelete} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer for saving changes if needed (Trello usually auto-saves, but we have onSave) */}
        <div className={`px-6 py-4 border-t flex justify-end gap-3 ${theme === 'dark' ? 'border-white/5 bg-[#1d2125]' : 'border-gray-100 bg-gray-50'}`}>
           <Button variant="ghost" onClick={handleClose} className={`font-bold text-sm hover:bg-black/5 ${theme === 'dark' ? 'text-[#B6C2CF] hover:bg-white/5' : 'text-gray-500 hover:text-gray-900'}`}>Fechar</Button>

           <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-white font-bold px-6">Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const SidebarButton: React.FC<{ 
  icon: any; 
  label: string; 
  variant?: 'default' | 'destructive';
  onClick?: () => void;
}> = ({ icon: Icon, label, variant = 'default', onClick }) => {
  const { theme } = useTheme();
  return (
    <Button 
      variant="secondary" 
      size="sm" 
      onClick={onClick}
      className={`w-full justify-start h-8 px-3 rounded font-bold text-xs transition-all ${
        variant === 'destructive' 
          ? 'hover:bg-rose-500/20 hover:text-rose-400 text-rose-500/70 bg-white/5' 
          : (theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-[#B6C2CF] hover:text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900')
      }`}
    >
      <Icon className="h-4 w-4 mr-2" />
      {label}
    </Button>
  );
};

