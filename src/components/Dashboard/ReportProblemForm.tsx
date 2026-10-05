import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Send, CheckCircle2, Bug, Zap, HelpCircle, AlertTriangle, Image, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ReportProblemForm = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    category: '',
    title: '',
    description: '',
    steps: '',
    expected: '',
    screenshot: null as File | null,
  });

  const categories = [
    { value: 'bug', label: 'Bug / Erro', icon: Bug, color: '#EF4444' },
    { value: 'performance', label: 'Lentidão', icon: Zap, color: '#F59E0B' },
    { value: 'feature', label: 'Sugestão', icon: HelpCircle, color: '#374DA4' },
    { value: 'other', label: 'Outro', icon: AlertTriangle, color: '#64748B' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category || !formData.title || !formData.description) {
      toast({ title: 'Campos obrigatórios', description: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setLoading(false);
    setSubmitted(true);
    toast({ title: 'Problema reportado!', description: 'Recebemos seu report e vamos analisar em breve.' });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFormData({ ...formData, screenshot: file });
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-5">
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-1">Obrigado pelo feedback!</h2>
          <p className="text-xs text-muted-foreground mb-6">
            Nossa equipe irá analisar em breve. Você receberá atualizações por email.
          </p>
          <div className="rounded-xl bg-muted/50 p-4 mb-6">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Ticket</p>
            <p className="font-mono font-bold text-base text-foreground">
              #ELLO-{Math.random().toString(36).substring(2, 8).toUpperCase()}
            </p>
          </div>
          <Button className="w-full h-10 rounded-xl text-xs" variant="outline" onClick={() => setSubmitted(false)}>
            Reportar outro problema
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 md:px-6 pt-2 pb-24 md:py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">Reportar Problema</h1>
          <p className="text-xs text-muted-foreground">Encontrou um bug ou tem uma sugestão? Conte para nós</p>
        </div>

        {/* Category Selection */}
        <div className="mb-5">
          <p className="text-xs font-medium text-muted-foreground mb-2.5">Categoria *</p>
          <div className="grid grid-cols-4 gap-2">
            {categories.map((cat) => {
              const isSelected = formData.category === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, category: cat.value })}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all text-center"
                  style={{
                    borderColor: isSelected ? cat.color : 'hsl(var(--border))',
                    backgroundColor: isSelected ? `${cat.color}10` : 'transparent',
                  }}
                >
                  <cat.icon
                    className="h-4.5 w-4.5"
                    style={{ color: isSelected ? cat.color : 'hsl(var(--muted-foreground))' }}
                  />
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: isSelected ? cat.color : 'hsl(var(--muted-foreground))' }}
                  >
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Título *</label>
              <Input
                placeholder="Ex: Erro ao carregar documentos"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="h-10 rounded-xl text-sm border-border/60"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Descrição *</label>
              <Textarea
                placeholder="Descreva o problema com detalhes..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="rounded-xl text-sm border-border/60 resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Passos para reproduzir</label>
              <Textarea
                placeholder={"1. Clique em...\n2. Navegue até...\n3. O erro aparece quando..."}
                value={formData.steps}
                onChange={(e) => setFormData({ ...formData, steps: e.target.value })}
                rows={3}
                className="rounded-xl text-sm border-border/60 resize-none"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Comportamento esperado</label>
              <Input
                placeholder="O que deveria acontecer?"
                value={formData.expected}
                onChange={(e) => setFormData({ ...formData, expected: e.target.value })}
                className="h-10 rounded-xl text-sm border-border/60"
              />
            </div>

            {/* Screenshot upload */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Screenshot</label>
              <Input type="file" accept="image/*" onChange={handleFileChange} className="hidden" id="screenshot-upload" />
              <label
                htmlFor="screenshot-upload"
                className="flex items-center justify-center gap-2 h-20 rounded-xl border border-dashed border-border/80 cursor-pointer hover:bg-muted/30 transition-colors"
              >
                {formData.screenshot ? (
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Image className="h-4 w-4" />
                    <span className="text-xs font-medium">{formData.screenshot.name}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Upload className="h-5 w-5" />
                    <span className="text-[10px]">Clique para enviar uma imagem</span>
                  </div>
                )}
              </label>
            </div>
          </div>

          <Button type="submit" className="w-full h-10 rounded-xl text-xs gap-2" disabled={loading}>
            {loading ? 'Enviando...' : (
              <>
                <Send className="h-3.5 w-3.5" />
                Enviar Report
              </>
            )}
          </Button>
        </form>

        {/* Tips - compact */}
        <div className="mt-6 rounded-2xl border border-border/60 bg-card p-4">
          <p className="text-xs font-semibold text-foreground mb-3">Dicas para um bom report</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              'Seja específico sobre o que aconteceu',
              'Inclua os passos para reproduzir',
              'Adicione screenshots se possível',
              'Informe navegador e dispositivo',
            ].map((tip, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                <span className="text-foreground/40 font-bold text-[10px] mt-px">{i + 1}.</span>
                <span>{tip}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-border/40 text-[10px] text-muted-foreground">
            Tempo médio de resposta: <strong className="text-foreground">24 horas</strong>
          </div>
        </div>

        {/* WhatsApp contact */}
        <div className="mt-8 text-center">
          <p className="text-[10px] text-muted-foreground mb-2">Precisa de ajuda urgente?</p>
          <a
            href="https://wa.me/5541989015612?text=Olá! Preciso de ajuda com a Ellosuit."
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="sm" className="gap-2 text-[11px] h-8 text-muted-foreground hover:text-foreground">
              <MessageCircle className="h-3.5 w-3.5" />
              Fale conosco pelo WhatsApp
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
};

export default ReportProblemForm;
