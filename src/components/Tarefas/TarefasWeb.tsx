import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, CheckSquare, Sparkles } from 'lucide-react';
import { useTarefas } from '@/hooks/useTarefas';
import TarefasList from './TarefasList';
import NovoLembreteModal from './NovoLembreteModal';
import { cn } from '@/lib/utils';

const TarefasWeb: React.FC = () => {
  const { tarefas, createTarefa, updateTarefa, deleteTarefa } = useTarefas();
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<'hoje' | 'amanha' | 'semana' | 'mes'>('hoje');

  const filters = [
    { id: 'hoje' as const, label: 'Hoje' },
    { id: 'amanha' as const, label: 'Amanhã' },
    { id: 'semana' as const, label: 'Semana' },
    { id: 'mes' as const, label: 'Mês' },
  ];

  return (
    <div className="relative min-h-full bg-[#faf9f7] dark:bg-background transition-colors duration-300">
      {/* Ambient glows - refined for Claude style */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-[#374DA4]/10 blur-3xl" />
        <div className="absolute top-40 right-0 h-72 w-72 rounded-full bg-[#374DA4]/5 blur-3xl" />
      </div>

      <div className="relative p-4 md:p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white/40 dark:bg-white/5 backdrop-blur-xl border border-border/40 rounded-3xl p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[#374DA4] flex items-center justify-center shadow-lg shadow-[#374DA4]/20">
              <CheckSquare className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#374DA4]">Tarefas</h1>
              <p className="text-sm text-muted-foreground">
                Organize suas atividades e lembretes
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="rounded-full bg-[#374DA4] hover:bg-[#2e418a] text-white shadow-lg shadow-[#374DA4]/20"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Tarefa
          </Button>
        </div>

        {/* Filter Tabs (glass pill) */}
        <div className="bg-[#ecebe4] dark:bg-white/5 p-1.5 inline-flex gap-1 rounded-full">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium transition-all",
                filter === f.id
                  ? "bg-[#374DA4] text-white shadow-md shadow-[#374DA4]/20"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Tasks List */}
        <div className="rounded-3xl border border-border bg-white dark:bg-card shadow-sm overflow-hidden">
          <div className="p-6">
            <TarefasList
              tarefas={tarefas}
              onUpdate={updateTarefa}
              onDelete={deleteTarefa}
              filter={filter}
              showPeriodDivision
            />
          </div>
        </div>
      </div>

      {showCreate && (
        <NovoLembreteModal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          onSave={async (data) => {
            await createTarefa(data);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
};

export default TarefasWeb;
