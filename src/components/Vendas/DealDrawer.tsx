import { useState } from 'react';
import { ArrowLeft, Building2, Copy, Flame, Mail, MessageSquare, Phone, Plus, Trash2, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatBRL, relativeTime, TEMP_COLORS } from './FunnelKanban';
import {
  FunnelDeal,
  LocalDeal,
  PIPELINE_TEMPLATES,
  SalesFunnel,
  SOURCE_LABELS,
  SourceType,
} from './types';
import { Drawer, FunnelData, isFrioAt, StageView } from './useFunnelData';

const TEMPS = ['frio', 'morno', 'quente', 'negociando', 'pagou', 'perdido'];

/** Drawer lateral: lista de leads da etapa ou ficha de uma negociação. */
export function DealDrawer({
  data,
  drawer,
  setDrawer,
  onOpenCRM,
}: {
  data: FunnelData;
  drawer: Exclude<Drawer, null>;
  setDrawer: (d: Drawer) => void;
  onOpenCRM: () => void;
}) {
  const { toast } = useToast();
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');

  // Negociações e leads locais agora são do documento (workspace), não do funil.
  const { funnel, rows, stages, activePipeline, isCrmPipeline, deals, localDeals } = data;
  if (!funnel) return null;

  const stageOf = (stageId?: string | null) => stages.find((s) => s.id === stageId);
  const stageIdForDrawer: string | null =
    drawer.mode === 'stage'
      ? drawer.stageId
      : drawer.mode === 'crm'
        ? rows.find((r) => r.id === drawer.leadId)?.pipeline_stage || null
        : localDeals.find((d) => d.id === drawer.dealId)?.stageId || null;
  const stage = stageOf(stageIdForDrawer);

  const stageLeads =
    drawer.mode === 'stage'
      ? isCrmPipeline
        ? rows.filter((r) =>
            drawer.stageId === '__none__' ? !r.pipeline_stage : r.pipeline_stage === drawer.stageId,
          )
        : localDeals.filter(
            (d) => d.pipelineId === activePipeline?.id && d.stageId === drawer.stageId,
          )
      : [];

  const stageSum = stageLeads.reduce(
    (sum, l) =>
      sum + ('pipeline_stage' in l ? deals[l.id]?.value || 0 : (l as LocalDeal).value || 0),
    0,
  );

  const crmLead = drawer.mode === 'crm' ? rows.find((r) => r.id === drawer.leadId) : null;
  const localDeal = drawer.mode === 'local' ? localDeals.find((d) => d.id === drawer.dealId) : null;
  const crmDeal = crmLead ? deals[crmLead.id] || {} : {};

  const handleAdd = async () => {
    if (drawer.mode !== 'stage') return;
    if (isCrmPipeline && !addPhone) return;
    const res = await data.addLead(drawer.stageId, addName, addPhone);
    if (!res.ok) {
      toast({ title: 'Erro ao criar lead', description: res.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Lead criado', description: 'Já aparece na lista da etapa.' });
    setAddName('');
    setAddPhone('');
    data.refresh();
  };

  return (
    <>
      <div className="fixed inset-0 z-[120] bg-black/40" onClick={() => setDrawer(null)} />
      <aside className="fixed right-0 top-0 bottom-0 z-[130] w-full sm:w-[420px] bg-background border-l shadow-2xl flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          {drawer.mode !== 'stage' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Voltar para a etapa"
              onClick={() =>
                stageIdForDrawer
                  ? setDrawer({ mode: 'stage', stageId: stageIdForDrawer })
                  : setDrawer(null)
              }
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <span
            className="h-3 w-3 rounded-full shrink-0"
            style={{ backgroundColor: stage?.color || '#94A3B8' }}
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">
              {drawer.mode === 'stage'
                ? stage?.title || 'Etapa'
                : drawer.mode === 'crm'
                  ? crmDeal.contact || crmLead?.contact_name || crmLead?.contact_phone || 'Negociação'
                  : localDeal?.name || 'Negociação'}
            </p>
            <p className="text-xs text-muted-foreground">
              {drawer.mode === 'stage'
                ? `${stageLeads.length} leads · ${formatBRL(stageSum) || 'R$ 0'}`
                : drawer.mode === 'crm'
                  ? `${formatBRL(crmDeal.value) || 'sem valor'} · atividade ${relativeTime(crmLead?.last_message_at)}`
                  : `${formatBRL(localDeal?.value) || 'sem valor'} · ${activePipeline?.name || ''}`}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setDrawer(null)} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {drawer.mode === 'stage' ? (
            <>
              {stageLeads.length === 0 && (
                <p className="px-4 pt-4 text-center text-sm text-muted-foreground">
                  Nenhum lead nesta etapa ainda.
                </p>
              )}
              {stageLeads.map((item) => {
                const isCrm = 'pipeline_stage' in item;
                const lead = item as (typeof rows)[number];
                const deal = isCrm ? deals[lead.id] || {} : {};
                const loc = !isCrm ? (item as LocalDeal) : null;
                const t = loc
                  ? loc.temperature || null
                  : deal.temperature || lead.temperature_stage || null;
                const at = loc ? loc.updatedAt : lead.last_message_at;
                const name = loc
                  ? loc.contact || loc.name
                  : deal.contact || lead.contact_name || lead.contact_phone;
                const value = loc ? loc.value : deal.value;
                const notes = loc ? loc.notes : deal.notes || lead.last_message;
                return (
                  <button
                    key={item.id}
                    onClick={() =>
                      setDrawer(
                        isCrm ? { mode: 'crm', leadId: item.id } : { mode: 'local', dealId: item.id },
                      )
                    }
                    className="w-full text-left px-4 py-3 border-b hover:bg-muted/50 transition-colors flex items-start gap-3"
                  >
                    <span
                      className="h-9 w-9 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                      style={{ backgroundColor: stage?.color || '#94A3B8' }}
                    >
                      {(name || '?').slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{name}</span>
                        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-emerald-600">
                          {formatBRL(value)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        {t && (
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: `${TEMP_COLORS[t] || '#6B7280'}1f`,
                              color: TEMP_COLORS[t] || '#6B7280',
                            }}
                          >
                            {t}
                          </span>
                        )}
                        {isFrioAt(at) && (
                          <span className="rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-500">
                            7d+ parado
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground">{relativeTime(at)}</span>
                      </span>
                      {notes && (
                        <span className="mt-1 block truncate text-[11px] italic text-muted-foreground">
                          {notes}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}

              <div className="space-y-2 p-4 border-t">
                <p className="text-xs font-medium text-muted-foreground">
                  Adicionar lead em {stage?.title}
                </p>
                <Input
                  placeholder="Nome do lead"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="h-9"
                />
                <div className="flex gap-2">
                  <Input
                    placeholder={isCrmPipeline ? 'WhatsApp (55…)' : 'Telefone (opcional)'}
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    className="h-9"
                  />
                  <Button size="sm" className="h-9" onClick={handleAdd} disabled={!addName && !addPhone}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : crmLead ? (
            <DealFields
              name={crmDeal.contact ?? crmLead.contact_name ?? ''}
              phone={crmLead.contact_phone}
              company={crmDeal.company || ''}
              email={crmDeal.email || ''}
              owner={crmDeal.owner || ''}
              value={crmDeal.value}
              notes={crmDeal.notes || ''}
              stageId={crmLead.pipeline_stage || ''}
              temp={crmDeal.temperature || crmLead.temperature_stage || null}
              iaTemp={crmLead.temperature_stage || null}
              lastMessage={crmLead.last_message}
              lastAt={crmLead.last_message_at}
              stages={stages}
              onChange={(patch) => data.setDeal(crmLead.id, patch)}
              onMove={(s) => data.moveTo(crmLead.id, s)}
              onOpenCRM={onOpenCRM}
            />
          ) : localDeal ? (
            <DealFields
              name={localDeal.contact || localDeal.name}
              phone={localDeal.phone || ''}
              company={localDeal.company || ''}
              email={localDeal.email || ''}
              owner={localDeal.owner || ''}
              value={localDeal.value}
              notes={localDeal.notes || ''}
              stageId={localDeal.stageId}
              temp={localDeal.temperature || null}
              iaTemp={null}
              lastMessage={undefined}
              lastAt={localDeal.updatedAt}
              stages={stages}
              onChange={(patch) => data.setLocalDeal(localDeal.id, patch)}
              onMove={(s) => data.moveTo(localDeal.id, s)}
              onDelete={() => {
                data.deleteLocalDeal(localDeal.id);
                setDrawer(null);
                toast({ title: 'Lead excluído' });
              }}
            />
          ) : (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Lead não encontrado com os filtros atuais.
            </p>
          )}
        </div>
      </aside>
    </>
  );
}

export function DealFields({
  name,
  phone,
  company,
  email,
  owner,
  value,
  notes,
  stageId,
  temp,
  iaTemp,
  lastMessage,
  lastAt,
  stages,
  onChange,
  onMove,
  onOpenCRM,
  onDelete,
}: {
  name: string;
  phone: string;
  company: string;
  email: string;
  owner: string;
  value?: number;
  notes: string;
  stageId: string;
  temp: string | null;
  iaTemp: string | null;
  lastMessage?: string | null;
  lastAt?: string | null;
  stages: StageView[];
  onChange: (patch: Partial<FunnelDeal & LocalDeal>) => void;
  onMove: (stageId: string) => void;
  onOpenCRM?: () => void;
  onDelete?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const brl = formatBRL(value);

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Etapa do funil</Label>
        <Select value={stageId || ''} onValueChange={(v) => v && onMove(v)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Selecione a etapa" />
          </SelectTrigger>
          <SelectContent>
            {stages.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span
                  className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                  style={{ backgroundColor: c.color }}
                />
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Valor da negociação (R$)</Label>
          <Input
            type="number"
            min={0}
            step={10}
            placeholder="0"
            value={value ?? ''}
            onChange={(e) => onChange({ value: Number(e.target.value) || 0 })}
            className="h-9 tabular-nums"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Temperatura</Label>
          <Select
            value={temp || '__auto__'}
            onValueChange={(v) => onChange({ temperature: v === '__auto__' ? undefined : v })}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={iaTemp ? `IA: ${iaTemp}` : 'Sem classificação'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__auto__">Automático (IA)</SelectItem>
              {TEMPS.map((t) => (
                <SelectItem key={t} value={t}>
                  <span
                    className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ backgroundColor: TEMP_COLORS[t] }}
                  />
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {iaTemp && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Flame className="h-3.5 w-3.5" />
          IA classificou esta conversa como <b>{iaTemp}</b>
          {temp && temp !== iaTemp && <> (você sobrescreveu)</>}
        </p>
      )}

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            <User className="mr-1 inline h-3 w-3" />
            Contato / negócio
          </Label>
          <Input
            value={name}
            placeholder="Nome do contato"
            onChange={(e) => onChange({ contact: e.target.value, name: e.target.value })}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            <Building2 className="mr-1 inline h-3 w-3" />
            Empresa
          </Label>
          <Input
            value={company}
            placeholder="Nome da empresa"
            onChange={(e) => onChange({ company: e.target.value })}
            className="h-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              <Mail className="mr-1 inline h-3 w-3" />
              Email
            </Label>
            <Input
              value={email}
              placeholder="email@empresa.com"
              onChange={(e) => onChange({ email: e.target.value })}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Responsável</Label>
            <Input
              value={owner}
              placeholder="Quem conduz"
              onChange={(e) => onChange({ owner: e.target.value })}
              className="h-9"
            />
          </div>
        </div>

        {phone && (
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2">
            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-sm tabular-nums">{phone}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Copiar telefone"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(phone);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  // clipboard indisponível — ignora
                }
              }}
            >
              {copied ? (
                <span className="text-[10px] text-emerald-600">ok</span>
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
            <a
              href={`https://wa.me/${phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600"
            >
              WhatsApp
            </a>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Observações (anotações da IA + equipe)</Label>
        <Textarea
          value={notes}
          placeholder="Ex.: pediu proposta com desconto, retorno na quinta…"
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={4}
          className="text-sm"
        />
        {!notes && lastMessage && (
          <p className="text-[11px] text-muted-foreground italic">
            Última conversa: “{lastMessage.slice(0, 120)}”
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-[11px] text-muted-foreground">
          {brl ? `${brl} em negociação` : 'Sem valor definido'}
          {lastAt ? ` · atualizado ${relativeTime(lastAt)} atrás` : ''}
        </span>
        <div className="flex gap-2">
          {onDelete && (
            <Button variant="outline" size="sm" className="text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {onOpenCRM && (
            <Button size="sm" onClick={onOpenCRM}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Abrir conversa
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Diálogo de criação de pipeline. */
export function NewPipelineDialog({
  open,
  onOpenChange,
  hasCrmPipeline,
  funnels = [],
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hasCrmPipeline: boolean;
  /** Funis disponíveis para vincular (opcional) o pipeline novo. */
  funnels?: SalesFunnel[];
  onCreate: (name: string, template: string, crmSync: boolean, funnelId: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState(PIPELINE_TEMPLATES[0].id);
  const [crmSync, setCrmSync] = useState(false);
  const [funnelId, setFunnelId] = useState<string>('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo pipeline</DialogTitle>
          <DialogDescription>
            Cada pipeline tem suas próprias etapas, leads e regras.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              autoFocus
              placeholder="Ex.: Pipeline Inbound"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' && onCreate(name, template, crmSync, funnelId || null)
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Funil vinculado</Label>
            <Select value={funnelId || 'none'} onValueChange={(v) => setFunnelId(v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem vínculo (etapas próprias)</SelectItem>
                {funnels.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.name} ({f.stages.length} etapas)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Com vínculo, o pipeline mostra as mesmas etapas do funil.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Modelo de etapas</Label>
            <Select
              value={template}
              onValueChange={setTemplate}
              disabled={crmSync || !!funnelId}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.stages.length} etapas)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label
            className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm ${
              hasCrmPipeline ? 'opacity-50' : ''
            }`}
          >
            <span>
              Sincronizar com o CRM WhatsApp
              <span className="block text-xs text-muted-foreground">
                {hasCrmPipeline
                  ? 'Já existe um pipeline sincronizado'
                  : 'Usa as etapas do kanban do CRM'}
              </span>
            </span>
            <Checkbox
              checked={crmSync}
              disabled={hasCrmPipeline}
              onCheckedChange={(v) => setCrmSync(v === true)}
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => onCreate(name, template, crmSync, funnelId || null)}>
            Criar pipeline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Botão + diálogo rápido para adicionar uma origem de leads. */
export function AddSourceButton({ onAdd }: { onAdd: (type: SourceType) => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<SourceType>('webhook');
  const LABELS = SOURCE_LABELS;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Adicionar origem
      </Button>
      {open && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border bg-background p-5 space-y-4 shadow-2xl">
            <p className="font-semibold">Nova origem de leads</p>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LABELS) as SourceType[]).map((t) => (
                  <SelectItem key={t} value={t}>
                    {LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onAdd(type);
                  setOpen(false);
                }}
              >
                Adicionar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
