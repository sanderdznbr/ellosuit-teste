
import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import TarefasMobile from '@/components/Tarefas/TarefasMobile';
import TarefasDesktop from '@/components/Tarefas/TarefasDesktop';
import TaskLogin from '@/components/Tarefas/TaskLogin';

const Tarefas = () => {
  const { user, loading: authLoading } = useAuth();
  const { isMobile, isLoading: deviceLoading } = useIsMobile();

  // Exibir loading durante verificações iniciais
  if (authLoading || deviceLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-lg">Carregando...</div>
      </div>
    );
  }

  // Se não há usuário autenticado, mostrar tela de login
  if (!user) {
    return <TaskLogin />;
  }

  // Se há usuário autenticado, mostrar tarefas normais
  return isMobile ? <TarefasMobile /> : <TarefasDesktop />;
};

export default Tarefas;
