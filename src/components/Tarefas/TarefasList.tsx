
import React from 'react';
import TarefaItem from './TarefaItem';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { getServerDate, isToday, isTomorrow } from '@/utils/date-server';

interface TarefasListProps {
  tarefas: any[];
  onUpdate: (id: string, updates: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  filter: 'hoje' | 'amanha' | 'semana' | 'mes';
  showPeriodDivision?: boolean;
}

const TarefasList: React.FC<TarefasListProps> = ({ 
  tarefas, 
  onUpdate, 
  onDelete, 
  filter, 
  showPeriodDivision = true 
}) => {
  const serverDate = getServerDate();

  const getFilteredTarefas = () => {
    // Filtrar apenas tarefas ativas (não excluídas)
    const activeTarefas = tarefas.filter(tarefa => tarefa.status !== 'deleted');
    
    switch (filter) {
      case 'hoje':
        return activeTarefas.filter(tarefa => isToday(tarefa.start_date));
      
      case 'amanha':
        return activeTarefas.filter(tarefa => isTomorrow(tarefa.start_date));
      
      case 'semana':
        const weekStart = startOfWeek(serverDate, { weekStartsOn: 0 }); // Domingo
        const weekEnd = endOfWeek(serverDate, { weekStartsOn: 0 });
        return activeTarefas.filter(tarefa => {
          try {
            const tarefaDate = parseISO(tarefa.start_date);
            return isWithinInterval(tarefaDate, { start: weekStart, end: weekEnd });
          } catch {
            return false;
          }
        });
      
      case 'mes':
        const monthStart = startOfMonth(serverDate);
        const monthEnd = endOfMonth(serverDate);
        return activeTarefas.filter(tarefa => {
          try {
            const tarefaDate = parseISO(tarefa.start_date);
            return isWithinInterval(tarefaDate, { start: monthStart, end: monthEnd });
          } catch {
            return false;
          }
        });
      
      default:
        return activeTarefas;
    }
  };

  const getEmptyMessage = () => {
    switch (filter) {
      case 'hoje':
        return 'Nenhuma tarefa para hoje';
      case 'amanha':
        return 'Nenhuma tarefa para amanhã';
      case 'semana':
        return 'Nenhuma tarefa para esta semana';
      case 'mes':
        return 'Nenhuma tarefa para este mês';
      default:
        return 'Nenhuma tarefa encontrada';
    }
  };

  const filteredTarefas = showPeriodDivision ? getFilteredTarefas() : tarefas;

  return (
    <div className="divide-y divide-gray-100">
      {filteredTarefas.map((tarefa, index) => (
        <div key={tarefa.id} className={index === 0 ? '' : ''}>
          <TarefaItem
            tarefa={tarefa}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        </div>
      ))}
      
      {filteredTarefas.length === 0 && showPeriodDivision && (
        <div className="text-center py-16">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4 mx-auto">
            <span className="text-4xl">📝</span>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{getEmptyMessage()}</h3>
          <p className="text-gray-500">Adicione um novo lembrete para começar</p>
        </div>
      )}
    </div>
  );
};

export default TarefasList;
