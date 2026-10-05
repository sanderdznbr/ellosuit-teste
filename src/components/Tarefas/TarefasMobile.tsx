
import React, { useState, useEffect } from 'react';
import { Plus, ArrowDown, Trash2, RotateCcw, Settings } from 'lucide-react';
import TarefasList from './TarefasList';
import NovoLembreteModal from './NovoLembreteModal';
import NotificationSettingsModal from './NotificationSettingsModal';
import GoogleCalendarConnectionModal from './GoogleCalendarConnectionModal';
import { useTarefas } from '@/hooks/useTarefas';
import { usePullToRefresh } from '@/hooks/use-mobile-gestures';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { useIOSPushNotifications } from '@/hooks/useIOSPushNotifications';
import { cn } from '@/lib/utils';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { vibrate } from '@/utils/mobile-helpers';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { 
  getServerDate, 
  getServerTodayString, 
  getServerTomorrowString, 
  initializeServerDateFromEvents,
  formatBrazilDate,
  isToday,
  isTomorrow
} from '@/utils/date-server';

type FilterType = 'hoje' | 'amanha' | 'semana' | 'mes';

const TarefasMobile = () => {
  const [showNovoLembrete, setShowNovoLembrete] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showGoogleCalendarModal, setShowGoogleCalendarModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('hoje');
  const [showDeleted, setShowDeleted] = useState(false);
  const { tarefas, loading, createTarefa, updateTarefa, deleteTarefa, deletedTarefas, restoreTarefa, refreshEvents } = useTarefas();
  const { user } = useAuth();
  const { isConnected: isGoogleConnected } = useGoogleCalendar();
  const { 
    isRegistered, 
    isRegistering, 
    isIOSWebView,
    permissionStatus,
    requestPermissions,
    sendTestNotification 
  } = useIOSPushNotifications();
  const { toast } = useToast();

  // Initialize server date when component mounts
  useEffect(() => {
    console.log('TarefasMobile mounted, current server date:', getServerDate());
    console.log('Today string:', getServerTodayString());
    console.log('Tomorrow string:', getServerTomorrowString());
    
    if (tarefas.length > 0) {
      initializeServerDateFromEvents(tarefas);
    }
  }, [tarefas]);

  // Check Google Calendar connection and show modal if needed
  useEffect(() => {
    const hasShownModal = localStorage.getItem('google-calendar-modal-shown');
    
    if (user && !isGoogleConnected && !hasShownModal) {
      // Show modal after a small delay to let the page load
      const timer = setTimeout(() => {
        setShowGoogleCalendarModal(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [user, isGoogleConnected]);

  // Close modal when Google Calendar gets connected
  useEffect(() => {
    if (isGoogleConnected && showGoogleCalendarModal) {
      setShowGoogleCalendarModal(false);
      localStorage.setItem('google-calendar-modal-shown', 'true');
    }
  }, [isGoogleConnected, showGoogleCalendarModal]);

  const handleGoogleCalendarModalClose = () => {
    setShowGoogleCalendarModal(false);
    // Mark that the modal has been shown to avoid showing it again
    localStorage.setItem('google-calendar-modal-shown', 'true');
  };

  const filterOptions: FilterType[] = ['hoje', 'amanha', 'semana', 'mes'];
  
  const {
    isSwipeGesturing,
    swipeProgress,
    onTouchStart: onSwipeStart,
    onTouchMove: onSwipeMove,
    onTouchEnd: onSwipeEnd
  } = useSwipeNavigation({
    filters: filterOptions,
    activeFilter,
    onFilterChange: setActiveFilter
  });

  const {
    isPulling,
    isRefreshing,
    pullDistance,
    onTouchStart,
    onTouchMove,
    onTouchEnd
  } = usePullToRefresh({
    onRefresh: async () => {
      vibrate(50);
      await refreshEvents();
    }
  });

  const handleCreateTarefa = async (tarefaData: any) => {
    await createTarefa(tarefaData);
    vibrate(30);
    await refreshEvents();
  };

  const handleUpdateTarefa = async (id: string, updates: any) => {
    await updateTarefa(id, updates);
    vibrate(30);
  };

  const handleDeleteTarefa = async (id: string) => {
    await deleteTarefa(id);
    vibrate([50, 100, 50]);
  };

  const handleNotificationSettings = async () => {
    try {
      if (!user) {
        toast({
          title: "Login necessário",
          description: "Faça login para ativar as notificações",
        });
        return;
      }

      if (!isIOSWebView) {
        toast({
          title: "Aviso",
          description: "Para notificações push, use o app iOS nativo",
        });
        return;
      }

      if (isRegistered) {
        await sendTestNotification();
      } else if (permissionStatus === 'denied') {
        toast({
          title: "Notificações desativadas",
          description: "Vá em Configurações > Notificações > [Nome do App] e ative as notificações",
          variant: "destructive"
        });
      } else {
        const granted = await requestPermissions();
        if (granted) {
          toast({
            title: "Solicitação enviada",
            description: "Aguarde a resposta do iOS...",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível configurar as notificações",
        variant: "destructive"
      });
    }
  };

  const getFilteredTarefas = (tarefasList: any[], filter: FilterType) => {
    const serverDate = getServerDate();
    const activeTarefas = tarefasList.filter(tarefa => tarefa.status !== 'deleted');

    console.log('Filtering tarefas:', {
      filter,
      serverDate,
      totalTarefas: activeTarefas.length,
      todayString: getServerTodayString(),
      tomorrowString: getServerTomorrowString()
    });

    switch (filter) {
      case 'hoje':
        const todayTarefas = activeTarefas.filter(tarefa => isToday(tarefa.start_date));
        console.log('Today tarefas found:', todayTarefas.length);
        return todayTarefas;
      
      case 'amanha':
        const tomorrowTarefas = activeTarefas.filter(tarefa => isTomorrow(tarefa.start_date));
        console.log('Tomorrow tarefas found:', tomorrowTarefas.length);
        return tomorrowTarefas;
      
      case 'semana':
        const weekStart = startOfWeek(serverDate, { weekStartsOn: 0 });
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

  const getFilterOptions = () => [
    { 
      id: 'hoje' as FilterType, 
      label: 'Hoje', 
      count: getFilteredTarefas(tarefas, 'hoje').length
    },
    { 
      id: 'amanha' as FilterType, 
      label: 'Amanhã', 
      count: getFilteredTarefas(tarefas, 'amanha').length
    },
    { 
      id: 'semana' as FilterType, 
      label: 'Semana', 
      count: getFilteredTarefas(tarefas, 'semana').length
    },
    { 
      id: 'mes' as FilterType, 
      label: 'Mês', 
      count: getFilteredTarefas(tarefas, 'mes').length
    }
  ];

  const groupTarefasByPeriod = (tarefas: any[]) => {
    const morning = tarefas.filter(t => {
      const hour = new Date(t.start_date).getHours();
      return hour >= 6 && hour < 12;
    });
    
    const afternoon = tarefas.filter(t => {
      const hour = new Date(t.start_date).getHours();
      return hour >= 12 && hour < 18;
    });
    
    const evening = tarefas.filter(t => {
      const hour = new Date(t.start_date).getHours();
      return hour >= 18 || hour < 6;
    });

    return { morning, afternoon, evening };
  };

  if (loading) {
    return (
      <div className="min-h-full bg-background">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border pb-4 pt-2">
          <div className="px-4">
            <div className="h-8 w-48 bg-gray-200 rounded-lg mb-2 animate-pulse"></div>
            <div className="h-4 w-32 bg-gray-200 rounded-lg animate-pulse"></div>
          </div>
        </div>
        <div className="px-4 pt-4 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="h-4 w-full bg-gray-200 rounded mb-2 animate-pulse"></div>
              <div className="h-3 w-3/4 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const filteredTarefas = getFilteredTarefas(tarefas, activeFilter);
  const groupedTarefas = activeFilter === 'hoje' ? groupTarefasByPeriod(filteredTarefas) : null;

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div 
        className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border pt-2 pb-4"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Pull-to-Refresh Indicator */}
        <div 
          className={cn(
            "absolute top-10 left-1/2 transform -translate-x-1/2 transition-all duration-300",
            isPulling ? "opacity-100" : "opacity-0"
          )}
          style={{ transform: `translateX(-50%) translateY(${Math.min(pullDistance - 60, 20)}px)` }}
        >
          <div className="flex items-center justify-center space-x-2 text-gray-500">
            <ArrowDown className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            <span className="text-sm">
              {isRefreshing ? 'Atualizando...' : 'Puxe para atualizar'}
            </span>
          </div>
        </div>

        <div className="px-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Lembretes</h1>
              <p className="text-gray-500 text-sm">
                {formatBrazilDate(getServerDate())}
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Notifications Settings Button */}
              {user && (
                <button
                  onClick={() => {
                    setShowNotificationSettings(true);
                    vibrate(30);
                  }}
                  className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <Settings className="h-5 w-5 text-gray-600" />
                </button>
              )}
              
              {/* Deleted Items Button */}
              {deletedTarefas.length > 0 && (
                <button
                  onClick={() => {
                    setShowDeleted(!showDeleted);
                    vibrate(30);
                  }}
                  className="relative p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <Trash2 className="h-5 w-5 text-gray-600" />
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {deletedTarefas.length}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Filter Pills with Swipe */}
          <div 
            className="relative overflow-hidden"
            onTouchStart={onSwipeStart}
            onTouchMove={onSwipeMove}
            onTouchEnd={onSwipeEnd}
          >
            <div 
              className={cn(
                "flex space-x-2 mb-4 transition-transform duration-200",
                isSwipeGesturing && "transition-none"
              )}
              style={{ 
                transform: `translateX(${swipeProgress * 20}px)` 
              }}
            >
              {getFilterOptions().map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    setActiveFilter(option.id);
                    vibrate(30);
                  }}
                  className={cn(
                    "flex items-center space-x-2 px-4 py-2 rounded-full transition-all duration-200 whitespace-nowrap",
                    activeFilter === option.id 
                      ? "bg-[#374DA4] text-white shadow-lg" 
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )}
                >
                  <span className="font-medium">{option.label}</span>
                  <span className={cn(
                    "text-xs px-2 py-1 rounded-full min-w-[20px] text-center",
                    activeFilter === option.id 
                      ? "bg-white/20 text-white" 
                      : "bg-gray-200 text-gray-600"
                  )}>
                    {option.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-32">
        {showDeleted ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <DeletedTarefasList 
              deletedTarefas={deletedTarefas}
              onRestore={restoreTarefa}
              onClose={() => setShowDeleted(false)}
            />
          </div>
        ) : (
          <>
            {activeFilter === 'hoje' && groupedTarefas ? (
              <div className="space-y-6">
                {/* Manhã */}
                {groupedTarefas.morning.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                      Manhã
                    </h2>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                      <TarefasList
                        tarefas={groupedTarefas.morning}
                        onUpdate={handleUpdateTarefa}
                        onDelete={handleDeleteTarefa}
                        filter={activeFilter}
                        showPeriodDivision={false}
                      />
                    </div>
                  </div>
                )}

                {/* Tarde */}
                {groupedTarefas.afternoon.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <span className="w-2 h-2 bg-[#374DA4] rounded-full mr-2"></span>
                      Tarde
                    </h2>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                      <TarefasList
                        tarefas={groupedTarefas.afternoon}
                        onUpdate={handleUpdateTarefa}
                        onDelete={handleDeleteTarefa}
                        filter={activeFilter}
                        showPeriodDivision={false}
                      />
                    </div>
                  </div>
                )}

                {/* Noite */}
                {groupedTarefas.evening.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <span className="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>
                      Noite
                    </h2>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                      <TarefasList
                        tarefas={groupedTarefas.evening}
                        onUpdate={handleUpdateTarefa}
                        onDelete={handleDeleteTarefa}
                        filter={activeFilter}
                        showPeriodDivision={false}
                      />
                    </div>
                  </div>
                )}

                {/* Empty state para hoje */}
                {filteredTarefas.length === 0 && (
                  <div className="text-center py-16">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                      <span className="text-4xl">📝</span>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhuma tarefa para hoje</h3>
                    <p className="text-gray-500">Adicione um novo lembrete para começar</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <TarefasList
                  tarefas={filteredTarefas}
                  onUpdate={handleUpdateTarefa}
                  onDelete={handleDeleteTarefa}
                  filter={activeFilter}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => {
            setShowNovoLembrete(true);
            vibrate(50);
          }}
          className="w-14 h-14 bg-[#374DA4] text-white rounded-full shadow-lg hover:bg-[#2F428D] active:scale-95 transition-all duration-200 flex items-center justify-center"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* Modals */}
      <NovoLembreteModal
        isOpen={showNovoLembrete}
        onClose={() => setShowNovoLembrete(false)}
        onSave={handleCreateTarefa}
      />

      <NotificationSettingsModal
        isOpen={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
        onActivateNotifications={handleNotificationSettings}
        isRegistered={isRegistered}
        isRegistering={isRegistering}
        permissionStatus={permissionStatus}
        isIOSWebView={isIOSWebView}
      />

      <GoogleCalendarConnectionModal
        isOpen={showGoogleCalendarModal}
        onClose={handleGoogleCalendarModalClose}
      />
    </div>
  );
};

// Component para itens excluídos
const DeletedTarefasList: React.FC<{
  deletedTarefas: any[];
  onRestore: (id: string) => void;
  onClose: () => void;
}> = ({ deletedTarefas, onRestore, onClose }) => {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Itens Excluídos</h2>
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          Fechar
        </button>
      </div>

      <div className="space-y-3">
        {deletedTarefas.map((tarefa) => (
          <div key={tarefa.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 line-through opacity-60 mb-1">
                {tarefa.title}
              </h3>
              {tarefa.description && (
                <p className="text-sm text-gray-500 line-through opacity-60">
                  {tarefa.description}
                </p>
              )}
            </div>
            <button
              onClick={() => {
                onRestore(tarefa.id);
                vibrate([50, 100, 50]);
              }}
              className="ml-4 p-2 rounded-full bg-green-100 hover:bg-green-200 transition-colors"
            >
              <RotateCcw className="h-4 w-4 text-green-600" />
            </button>
          </div>
        ))}
      </div>

      {deletedTarefas.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🗑️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum item excluído</h3>
          <p className="text-gray-500">Os itens excluídos aparecerão aqui</p>
        </div>
      )}
    </div>
  );
};

export default TarefasMobile;
