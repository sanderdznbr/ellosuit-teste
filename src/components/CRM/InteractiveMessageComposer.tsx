import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, Send, List, ToggleLeft, ChevronDown, Reply } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FollowUpMapping {
  [buttonId: string]: string; // button/row id -> follow-up message
}

interface InteractiveMessageComposerProps {
  open: boolean;
  onClose: () => void;
  onSend: (data: { message_type: string; message: string; interactive: any; followUps?: FollowUpMapping }) => void;
  sending?: boolean;
}

interface ListRow {
  id: string;
  title: string;
  description?: string;
}

interface ListSection {
  title: string;
  rows: ListRow[];
}

const InteractiveMessageComposer: React.FC<InteractiveMessageComposerProps> = ({ open, onClose, onSend, sending }) => {
  const [tab, setTab] = useState<'buttons' | 'list'>('buttons');
  const [bodyText, setBodyText] = useState('');
  const [headerText, setHeaderText] = useState('');
  const [footerText, setFooterText] = useState('');

  // Buttons state
  const [buttons, setButtons] = useState<{ id: string; title: string; followUp: string }[]>([
    { id: 'btn_1', title: '', followUp: '' },
  ]);

  // List state
  const [listButtonText, setListButtonText] = useState('Ver opções');
  const [sections, setSections] = useState<ListSection[]>([
    { title: '', rows: [{ id: 'row_1', title: '', description: '' }] },
  ]);
  const [rowFollowUps, setRowFollowUps] = useState<FollowUpMapping>({});

  const [showFollowUps, setShowFollowUps] = useState(false);

  const addButton = () => {
    if (buttons.length >= 3) return;
    setButtons([...buttons, { id: `btn_${Date.now()}`, title: '', followUp: '' }]);
  };

  const removeButton = (idx: number) => {
    setButtons(buttons.filter((_, i) => i !== idx));
  };

  const addRow = (sectionIdx: number) => {
    const totalRows = sections.reduce((acc, s) => acc + s.rows.length, 0);
    if (totalRows >= 10) return;
    const updated = [...sections];
    updated[sectionIdx].rows.push({ id: `row_${Date.now()}`, title: '', description: '' });
    setSections(updated);
  };

  const removeRow = (sectionIdx: number, rowIdx: number) => {
    const updated = [...sections];
    updated[sectionIdx].rows = updated[sectionIdx].rows.filter((_, i) => i !== rowIdx);
    setSections(updated);
  };

  const addSection = () => {
    setSections([...sections, { title: '', rows: [{ id: `row_${Date.now()}`, title: '' }] }]);
  };

  const handleSend = () => {
    if (!bodyText.trim()) return;

    if (tab === 'buttons') {
      const validButtons = buttons.filter(b => b.title.trim());
      if (validButtons.length === 0) return;

      const interactive: any = {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: validButtons.map(b => ({
            type: 'reply',
            reply: { id: b.id, title: b.title.trim().substring(0, 20) },
          })),
        },
      };
      if (headerText.trim()) interactive.header = { type: 'text', text: headerText };
      if (footerText.trim()) interactive.footer = { text: footerText };

      // Build follow-up mapping
      const followUps: FollowUpMapping = {};
      validButtons.forEach(b => {
        if (b.followUp.trim()) followUps[b.id] = b.followUp.trim();
      });

      onSend({ message_type: 'interactive', message: bodyText, interactive, followUps: Object.keys(followUps).length > 0 ? followUps : undefined });
    } else {
      const validSections = sections
        .map(s => ({
          title: s.title || 'Opções',
          rows: s.rows.filter(r => r.title.trim()).map(r => ({
            id: r.id,
            title: r.title.trim().substring(0, 24),
            description: r.description?.substring(0, 72) || undefined,
          })),
        }))
        .filter(s => s.rows.length > 0);

      if (validSections.length === 0) return;

      const interactive: any = {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: listButtonText || 'Ver opções',
          sections: validSections,
        },
      };
      if (headerText.trim()) interactive.header = { type: 'text', text: headerText };
      if (footerText.trim()) interactive.footer = { text: footerText };

      // Build follow-up mapping from rows
      const followUps: FollowUpMapping = {};
      Object.entries(rowFollowUps).forEach(([id, text]) => {
        if (text.trim()) followUps[id] = text.trim();
      });

      onSend({ message_type: 'interactive', message: bodyText, interactive, followUps: Object.keys(followUps).length > 0 ? followUps : undefined });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg rounded-2xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-lg">Mensagem Interativa</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 space-y-4">
          <Tabs value={tab} onValueChange={v => setTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="buttons" className="gap-1.5">
                <ToggleLeft className="h-3.5 w-3.5" /> Botões
              </TabsTrigger>
              <TabsTrigger value="list" className="gap-1.5">
                <List className="h-3.5 w-3.5" /> Lista
              </TabsTrigger>
            </TabsList>

            {/* Shared fields */}
            <div className="mt-4 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Cabeçalho (opcional)</Label>
                <Input value={headerText} onChange={e => setHeaderText(e.target.value)}
                  placeholder="Título da mensagem" className="mt-1" maxLength={60} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Corpo da mensagem *</Label>
                <Textarea value={bodyText} onChange={e => setBodyText(e.target.value)}
                  placeholder="Texto principal da mensagem..." className="mt-1 min-h-[80px]" maxLength={1024} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Rodapé (opcional)</Label>
                <Input value={footerText} onChange={e => setFooterText(e.target.value)}
                  placeholder="Texto do rodapé" className="mt-1" maxLength={60} />
              </div>
            </div>

            <TabsContent value="buttons" className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label>Botões de Resposta</Label>
                <Badge variant="secondary" className="text-xs">{buttons.length}/3</Badge>
              </div>
              {buttons.map((btn, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Input
                      value={btn.title}
                      onChange={e => {
                        const updated = [...buttons];
                        updated[idx].title = e.target.value;
                        setButtons(updated);
                      }}
                      placeholder={`Botão ${idx + 1}`}
                      maxLength={20}
                      className="flex-1"
                    />
                    {buttons.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeButton(idx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {showFollowUps && (
                    <div className="flex items-center gap-2 pl-4">
                      <Reply className="h-3.5 w-3.5 text-muted-foreground shrink-0 rotate-180" />
                      <Input
                        value={btn.followUp}
                        onChange={e => {
                          const updated = [...buttons];
                          updated[idx].followUp = e.target.value;
                          setButtons(updated);
                        }}
                        placeholder={`Resposta automática ao selecionar "${btn.title || `Botão ${idx + 1}`}"`}
                        className="flex-1 text-xs h-8 border-dashed"
                      />
                    </div>
                  )}
                </div>
              ))}
              {buttons.length < 3 && (
                <Button variant="outline" size="sm" onClick={addButton} className="w-full">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar botão
                </Button>
              )}

              {/* Toggle follow-ups */}
              <Collapsible open={showFollowUps} onOpenChange={setShowFollowUps}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                    <Reply className="h-3.5 w-3.5 rotate-180" />
                    {showFollowUps ? 'Ocultar respostas automáticas' : 'Configurar respostas automáticas'}
                    <ChevronDown className={cn("h-3 w-3 transition-transform", showFollowUps && "rotate-180")} />
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>

              {/* Preview */}
              <div className="mt-4 p-3 rounded-2xl bg-muted/50 border space-y-2">
                <p className="text-[10px] uppercase text-muted-foreground font-medium">Preview</p>
                {headerText && <p className="text-sm font-semibold">{headerText}</p>}
                <p className="text-sm">{bodyText || 'Corpo da mensagem...'}</p>
                {footerText && <p className="text-xs text-muted-foreground">{footerText}</p>}
                <div className="border-t pt-2 space-y-1.5">
                  {buttons.filter(b => b.title.trim()).map((btn, i) => (
                    <div key={i} className="space-y-1">
                      <div className="text-center py-1.5 rounded-lg bg-background border text-sm text-[#374DA4] font-medium">
                        {btn.title}
                      </div>
                      {btn.followUp && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 justify-center">
                          <Reply className="h-2.5 w-2.5 rotate-180" /> {btn.followUp.substring(0, 40)}{btn.followUp.length > 40 ? '...' : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="list" className="mt-4 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Texto do botão</Label>
                <Input value={listButtonText} onChange={e => setListButtonText(e.target.value)}
                  placeholder="Ver opções" className="mt-1" maxLength={20} />
              </div>

              {/* Toggle follow-ups for list */}
              <Collapsible open={showFollowUps} onOpenChange={setShowFollowUps}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                    <Reply className="h-3.5 w-3.5 rotate-180" />
                    {showFollowUps ? 'Ocultar respostas automáticas' : 'Configurar respostas automáticas'}
                    <ChevronDown className={cn("h-3 w-3 transition-transform", showFollowUps && "rotate-180")} />
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>

              {sections.map((section, sIdx) => (
                <div key={sIdx} className="border rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={section.title}
                      onChange={e => {
                        const updated = [...sections];
                        updated[sIdx].title = e.target.value;
                        setSections(updated);
                      }}
                      placeholder="Nome da seção"
                      className="flex-1 text-sm font-medium"
                      maxLength={24}
                    />
                    {sections.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={() => setSections(sections.filter((_, i) => i !== sIdx))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  {section.rows.map((row, rIdx) => (
                    <div key={rIdx} className="space-y-1">
                      <div className="flex items-start gap-2 pl-2">
                        <div className="flex-1 space-y-1">
                          <Input
                            value={row.title}
                            onChange={e => {
                              const updated = [...sections];
                              updated[sIdx].rows[rIdx].title = e.target.value;
                              setSections(updated);
                            }}
                            placeholder="Título da opção"
                            className="text-sm h-8"
                            maxLength={24}
                          />
                          <Input
                            value={row.description || ''}
                            onChange={e => {
                              const updated = [...sections];
                              updated[sIdx].rows[rIdx].description = e.target.value;
                              setSections(updated);
                            }}
                            placeholder="Descrição (opcional)"
                            className="text-xs h-7"
                            maxLength={72}
                          />
                        </div>
                        {section.rows.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive mt-0.5"
                            onClick={() => removeRow(sIdx, rIdx)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {showFollowUps && (
                        <div className="flex items-center gap-2 pl-6">
                          <Reply className="h-3 w-3 text-muted-foreground shrink-0 rotate-180" />
                          <Input
                            value={rowFollowUps[row.id] || ''}
                            onChange={e => setRowFollowUps(prev => ({ ...prev, [row.id]: e.target.value }))}
                            placeholder={`Resposta ao selecionar "${row.title || 'opção'}"`}
                            className="flex-1 text-xs h-7 border-dashed"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => addRow(sIdx)}
                    className="w-full text-xs h-7">
                    <Plus className="h-3 w-3 mr-1" /> Opção
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addSection} className="w-full">
                <Plus className="h-3.5 w-3.5 mr-1" /> Seção
              </Button>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="px-5 py-3 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSend} disabled={sending || !bodyText.trim()} className="bg-[#374DA4] hover:bg-[#374DA4]/90">
            {sending ? '...' : <><Send className="h-4 w-4 mr-1" /> Enviar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InteractiveMessageComposer;
