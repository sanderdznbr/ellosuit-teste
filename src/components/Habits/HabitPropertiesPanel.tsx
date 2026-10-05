import React from 'react';
import { X, Clock, Calendar, CheckSquare, Video, MessageCircle, User, Bell, Repeat, Mail, FileText, Link, UserPlus, Filter, CalendarPlus, CalendarClock, Megaphone, BarChart3 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { HabitFlowNode } from './types';
import { useCompanyEmployees } from '@/hooks/useCompanyEmployees';

const SUITE_COLOR = '#374DA4';
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface HabitPropertiesPanelProps {
  node: HabitFlowNode;
  onClose: () => void;
  onUpdate: (nodeId: string, updates: Partial<HabitFlowNode>) => void;
}

const HabitPropertiesPanel: React.FC<HabitPropertiesPanelProps> = ({ node, onClose, onUpdate }) => {
  const { employees } = useCompanyEmployees();
  const config = node.data.config || {};

  const updateConfig = (key: string, value: any) => {
    onUpdate(node.id, {
      data: { ...node.data, config: { ...config, [key]: value } },
    });
  };

  const toggleDay = (day: number) => {
    const days: number[] = config.days || [];
    updateConfig('days', days.includes(day) ? days.filter((d: number) => d !== day) : [...days, day].sort());
  };

  return (
    <div className="w-80 bg-white border-l shadow-sm flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">Configurar Bloco</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Label */}
          <div>
            <Label className="text-xs">Nome do bloco</Label>
            <Input
              value={node.data.label}
              onChange={e => onUpdate(node.id, { data: { ...node.data, label: e.target.value } })}
              className="mt-1 rounded-xl text-sm"
            />
          </div>

          <Separator />

          {/* TRIGGER configs */}
          {node.type === 'trigger' && (
            <>
              <div>
                <Label className="text-xs">Horário</Label>
                <div className="relative mt-1">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input type="time" value={config.time || '09:00'} onChange={e => updateConfig('time', e.target.value)} className="pl-10 rounded-xl" />
                </div>
              </div>
              {node.subType === 'weekly' && (
                <div>
                  <Label className="text-xs">Dias da semana</Label>
                  <div className="flex gap-1.5 mt-2">
                    {DAYS.map((d, i) => (
                      <button key={i} onClick={() => toggleDay(i)} className="w-9 h-9 rounded-lg text-xs font-medium transition-all"
                        style={(config.days || []).includes(i) ? { backgroundColor: SUITE_COLOR, color: 'white' } : { backgroundColor: 'hsl(var(--muted))' }}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {node.subType === 'monthly' && (
                <div>
                  <Label className="text-xs">Dia do mês</Label>
                  <Select value={String(config.dayOfMonth || 1)} onValueChange={v => updateConfig('dayOfMonth', Number(v))}>
                    <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl max-h-48">
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                        <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {/* ACTION: create_task */}
          {node.subType === 'create_task' && (
            <>
              <div>
                <Label className="text-xs">Título da tarefa</Label>
                <Input value={config.title || ''} onChange={e => updateConfig('title', e.target.value)} className="mt-1 rounded-xl" placeholder="Ex: Standup diário" />
              </div>
              <div>
                <Label className="text-xs">Descrição</Label>
                <Textarea value={config.description || ''} onChange={e => updateConfig('description', e.target.value)} className="mt-1 rounded-xl resize-none" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Prioridade</Label>
                  <Select value={config.priority || 'medium'} onValueChange={v => updateConfig('priority', v)}>
                    <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Duração (min)</Label>
                  <Input type="number" value={config.duration || 60} onChange={e => updateConfig('duration', Number(e.target.value))} className="mt-1 rounded-xl" min={15} step={15} />
                </div>
              </div>
            </>
          )}

          {/* ACTION: add_calendar_event */}
          {node.subType === 'add_calendar_event' && (
            <>
              <div>
                <Label className="text-xs">Título do evento</Label>
                <Input value={config.title || ''} onChange={e => updateConfig('title', e.target.value)} className="mt-1 rounded-xl" placeholder="Ex: Revisão semanal" />
              </div>
              <div>
                <Label className="text-xs">Descrição</Label>
                <Textarea value={config.description || ''} onChange={e => updateConfig('description', e.target.value)} className="mt-1 rounded-xl resize-none" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tipo de evento</Label>
                  <Select value={config.eventType || 'task'} onValueChange={v => updateConfig('eventType', v)}>
                    <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="task">Tarefa</SelectItem>
                      <SelectItem value="meeting">Reunião</SelectItem>
                      <SelectItem value="reminder">Lembrete</SelectItem>
                      <SelectItem value="event">Evento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Duração (min)</Label>
                  <Input type="number" value={config.duration || 60} onChange={e => updateConfig('duration', Number(e.target.value))} className="mt-1 rounded-xl" min={15} step={15} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Cor</Label>
                <Input type="color" value={config.color || '#374DA4'} onChange={e => updateConfig('color', e.target.value)} className="mt-1 rounded-xl h-9 w-full" />
              </div>
            </>
          )}

          {/* ACTION: create_meeting */}
          {node.subType === 'create_meeting' && (
            <>
              <div>
                <Label className="text-xs">Título da reunião</Label>
                <Input value={config.title || ''} onChange={e => updateConfig('title', e.target.value)} className="mt-1 rounded-xl" placeholder="Ex: Daily standup" />
              </div>
              <div>
                <Label className="text-xs">Duração (min)</Label>
                <Input type="number" value={config.duration || 30} onChange={e => updateConfig('duration', Number(e.target.value))} className="mt-1 rounded-xl" min={15} step={15} />
              </div>
            </>
          )}

          {/* ACTION: create_booking */}
          {node.subType === 'create_booking' && (
            <>
              <div>
                <Label className="text-xs">Título do agendamento</Label>
                <Input value={config.title || ''} onChange={e => updateConfig('title', e.target.value)} className="mt-1 rounded-xl" placeholder="Ex: Consulta inicial" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Duração (min)</Label>
                  <Input type="number" value={config.duration || 30} onChange={e => updateConfig('duration', Number(e.target.value))} className="mt-1 rounded-xl" min={15} step={15} />
                </div>
                <div>
                  <Label className="text-xs">Buffer (min)</Label>
                  <Input type="number" value={config.buffer || 15} onChange={e => updateConfig('buffer', Number(e.target.value))} className="mt-1 rounded-xl" min={0} step={5} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Descrição pública</Label>
                <Textarea value={config.description || ''} onChange={e => updateConfig('description', e.target.value)} className="mt-1 rounded-xl resize-none" rows={2} placeholder="Visível para quem agenda" />
              </div>
            </>
          )}

          {/* ACTION: send_whatsapp */}
          {node.subType === 'send_whatsapp' && (
            <>
              <div>
                <Label className="text-xs">Número (com DDD)</Label>
                <Input value={config.phone || ''} onChange={e => updateConfig('phone', e.target.value)} className="mt-1 rounded-xl" placeholder="5511999999999" />
              </div>
              <div>
                <Label className="text-xs">Mensagem</Label>
                <Textarea value={config.message || ''} onChange={e => updateConfig('message', e.target.value)} className="mt-1 rounded-xl resize-none" rows={3} placeholder="Olá! Lembrete da reunião de hoje..." />
              </div>
            </>
          )}

          {/* ACTION: send_email */}
          {node.subType === 'send_email' && (
            <>
              <div>
                <Label className="text-xs">Para (e-mail)</Label>
                <Input value={config.to || ''} onChange={e => updateConfig('to', e.target.value)} className="mt-1 rounded-xl" placeholder="contato@email.com" />
              </div>
              <div>
                <Label className="text-xs">Assunto</Label>
                <Input value={config.subject || ''} onChange={e => updateConfig('subject', e.target.value)} className="mt-1 rounded-xl" placeholder="Relatório semanal" />
              </div>
              <div>
                <Label className="text-xs">Corpo do e-mail</Label>
                <Textarea value={config.body || ''} onChange={e => updateConfig('body', e.target.value)} className="mt-1 rounded-xl resize-none" rows={4} placeholder="Olá, segue o relatório..." />
              </div>
              <div>
                <Label className="text-xs">ID do Template (opcional)</Label>
                <Input value={config.templateId || ''} onChange={e => updateConfig('templateId', e.target.value)} className="mt-1 rounded-xl" placeholder="Deixe vazio para e-mail livre" />
              </div>
            </>
          )}

          {/* ACTION: notification */}
          {node.subType === 'notification' && (
            <div>
              <Label className="text-xs">Mensagem da notificação</Label>
              <Textarea value={config.message || ''} onChange={e => updateConfig('message', e.target.value)} className="mt-1 rounded-xl resize-none" rows={2} />
            </div>
          )}

          {/* ACTION: create_document */}
          {node.subType === 'create_document' && (
            <>
              <div>
                <Label className="text-xs">Nome do documento</Label>
                <Input value={config.name || ''} onChange={e => updateConfig('name', e.target.value)} className="mt-1 rounded-xl" placeholder="Ata de reunião" />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={config.fileType || 'document'} onValueChange={v => updateConfig('fileType', v)}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="document">Documento</SelectItem>
                    <SelectItem value="spreadsheet">Planilha</SelectItem>
                    <SelectItem value="presentation">Apresentação</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Descrição</Label>
                <Textarea value={config.description || ''} onChange={e => updateConfig('description', e.target.value)} className="mt-1 rounded-xl resize-none" rows={2} />
              </div>
            </>
          )}

          {/* ACTION: create_tracked_link */}
          {node.subType === 'create_tracked_link' && (
            <>
              <div>
                <Label className="text-xs">URL original</Label>
                <Input value={config.originalUrl || ''} onChange={e => updateConfig('originalUrl', e.target.value)} className="mt-1 rounded-xl" placeholder="https://..." />
              </div>
              <div>
                <Label className="text-xs">Título do link</Label>
                <Input value={config.title || ''} onChange={e => updateConfig('title', e.target.value)} className="mt-1 rounded-xl" placeholder="Campanha Janeiro" />
              </div>
            </>
          )}

          {/* ACTION: add_crm_contact */}
          {node.subType === 'add_crm_contact' && (
            <>
              <div>
                <Label className="text-xs">Nome do contato</Label>
                <Input value={config.name || ''} onChange={e => updateConfig('name', e.target.value)} className="mt-1 rounded-xl" placeholder="João Silva" />
              </div>
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input value={config.email || ''} onChange={e => updateConfig('email', e.target.value)} className="mt-1 rounded-xl" placeholder="joao@email.com" />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={config.phone || ''} onChange={e => updateConfig('phone', e.target.value)} className="mt-1 rounded-xl" placeholder="5511999999999" />
              </div>
              <div>
                <Label className="text-xs">Tags (separadas por vírgula)</Label>
                <Input value={(config.tags || []).join(', ')} onChange={e => updateConfig('tags', e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean))} className="mt-1 rounded-xl" placeholder="lead, marketing" />
              </div>
            </>
          )}

          {/* ACTION: create_campaign */}
          {node.subType === 'create_campaign' && (
            <>
              <div>
                <Label className="text-xs">Tipo de campanha</Label>
                <Select value={config.type || 'email'} onValueChange={v => updateConfig('type', v)}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">ID do Template</Label>
                <Input value={config.templateId || ''} onChange={e => updateConfig('templateId', e.target.value)} className="mt-1 rounded-xl" placeholder="ID do template de envio" />
              </div>
              <div>
                <Label className="text-xs">ID do Grupo de contatos</Label>
                <Input value={config.groupId || ''} onChange={e => updateConfig('groupId', e.target.value)} className="mt-1 rounded-xl" placeholder="ID do grupo" />
              </div>
            </>
          )}

          {/* ACTION: generate_report */}
          {node.subType === 'generate_report' && (
            <>
              <div>
                <Label className="text-xs">Tipo de relatório</Label>
                <Select value={config.reportType || 'tasks'} onValueChange={v => updateConfig('reportType', v)}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="tasks">Tarefas</SelectItem>
                    <SelectItem value="meetings">Reuniões</SelectItem>
                    <SelectItem value="emails">E-mails</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="crm">CRM / Contatos</SelectItem>
                    <SelectItem value="links">Links rastreados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Período</Label>
                <Select value={config.period || 'weekly'} onValueChange={v => updateConfig('period', v)}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* CONFIG: assign_user */}
          {node.subType === 'assign_user' && (
            <div>
              <Label className="text-xs">Colaborador</Label>
              <Select value={config.userId || '_none'} onValueChange={v => {
                const emp = employees.find(e => e.user_id === v);
                updateConfig('userId', v);
                updateConfig('userName', emp?.name || '');
              }}>
                <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="_none">Nenhum</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.user_id} value={emp.user_id}>
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5" /> {emp.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* CONFIG: repeat */}
          {node.subType === 'repeat' && (
            <div>
              <Label className="text-xs">Repetir quantas vezes</Label>
              <Input type="number" value={config.times || 1} onChange={e => updateConfig('times', Number(e.target.value))} className="mt-1 rounded-xl" min={1} max={100} />
            </div>
          )}

          {/* CONFIG: delay */}
          {node.subType === 'delay' && (
            <div>
              <Label className="text-xs">Aguardar (minutos)</Label>
              <Input type="number" value={config.delayMinutes || 30} onChange={e => updateConfig('delayMinutes', Number(e.target.value))} className="mt-1 rounded-xl" min={1} />
            </div>
          )}

          {/* CONFIG: filter_contacts */}
          {node.subType === 'filter_contacts' && (
            <>
              <div>
                <Label className="text-xs">Filtrar por</Label>
                <Select value={config.filterType || 'tag'} onValueChange={v => updateConfig('filterType', v)}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="tag">Tag</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="group">Grupo</SelectItem>
                    <SelectItem value="city">Cidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Valor do filtro</Label>
                <Input value={config.filterValue || ''} onChange={e => updateConfig('filterValue', e.target.value)} className="mt-1 rounded-xl" placeholder="Ex: lead, ativo, São Paulo" />
              </div>
            </>
          )}

          {/* CONDITION: if_weekday */}
          {node.subType === 'if_weekday' && (
            <div>
              <Label className="text-xs">Dias que deve executar</Label>
              <div className="flex gap-1.5 mt-2">
                {DAYS.map((d, i) => (
                  <button key={i} onClick={() => toggleDay(i)} className="w-9 h-9 rounded-lg text-xs font-medium transition-all"
                    style={(config.days || []).includes(i) ? { backgroundColor: SUITE_COLOR, color: 'white' } : { backgroundColor: 'hsl(var(--muted))' }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CONDITION: if_time */}
          {node.subType === 'if_time' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">De</Label>
                <Input type="number" value={config.startHour || 8} onChange={e => updateConfig('startHour', Number(e.target.value))} className="mt-1 rounded-xl" min={0} max={23} />
              </div>
              <div>
                <Label className="text-xs">Até</Label>
                <Input type="number" value={config.endHour || 18} onChange={e => updateConfig('endHour', Number(e.target.value))} className="mt-1 rounded-xl" min={0} max={23} />
              </div>
            </div>
          )}

          {/* CONDITION: if_contact_exists */}
          {node.subType === 'if_contact_exists' && (
            <div>
              <Label className="text-xs">Verificar por</Label>
              <Select value={config.field || 'phone'} onValueChange={v => updateConfig('field', v)}>
                <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="phone">Telefone</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="name">Nome</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default HabitPropertiesPanel;
