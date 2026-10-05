import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate, Outlet, Navigate } from 'react-router-dom';
import { useAdminMaster } from '@/hooks/useAdminMaster';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';
import {
    LayoutDashboard, Users, CreditCard, Activity, HeadphonesIcon,
    Shield, ChevronLeft, ChevronRight, LogOut, Menu, X, Bell, DollarSign, Video, Download, CloudCog,
    MessageSquare,
     Zap, UserPlus, Image, History as HistoryIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ElloLogo } from '@/components/shared/ElloLogo';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard/admin' },
  { label: 'Logos dos Hubs', icon: Image, path: '/dashboard/admin/hub-logos' },
  { label: 'Cobranças Spreedly', icon: DollarSign, path: '/dashboard/admin/charges' },
  { label: 'Solicitações de Registro', icon: UserPlus, path: '/dashboard/admin/registrations' },
  { label: 'Empresas & Usuários', icon: Users, path: '/dashboard/admin/users' },
  { label: 'Assinaturas & Planos', icon: CreditCard, path: '/dashboard/admin/subs' },
  { label: 'Logs & Notificações', icon: Bell, path: '/dashboard/admin/notifications' },
  { label: 'Saúde do Sistema', icon: Activity, path: '/dashboard/admin/system' },
  { label: 'Suporte & Bugs', icon: HeadphonesIcon, path: '/dashboard/admin/support' },
  { label: 'Custos', icon: DollarSign, path: '/dashboard/admin/costs' },
  { label: 'Tutoriais', icon: Video, path: '/dashboard/admin/tutorials' },
  { label: 'Ícones', icon: Download, path: '/dashboard/admin/icons' },
  { label: 'Evolution API', icon: MessageSquare, path: '/dashboard/admin/evolution' },
  { label: 'Logs Auditoria', icon: HistoryIcon, path: '/dashboard/admin/logs' },
];

const AdminLayout = () => {
  const { isAdminMaster, loading: authLoading } = useAdminMaster();
  const { user, signOut } = useAuth();
  const { isMobile } = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Skeleton className="h-64 w-full max-w-md" />
      </div>
    );
  }

  if (!isAdminMaster) return <Navigate to="/dashboard" replace />;

  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-[260px]';

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#f5f4ef] dark:bg-[#111110]">
      {/* Logo */}
      <div className={cn(
        "flex items-center justify-center px-4 h-16 border-b border-black/[0.06] dark:border-white/[0.06]",
        collapsed && "px-2"
      )}>
        <ElloLogo
          className={cn("h-7 w-auto text-[#374DA4] dark:text-white", collapsed && "h-5")}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
        <TooltipProvider delayDuration={0}>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const linkContent = (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/dashboard/admin'}
                onClick={() => isMobile && setMobileOpen(false)}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200",
                  collapsed && "justify-center px-2",
                  isActive
                    ? "bg-white dark:bg-white/[0.06] text-[#1a1a18] dark:text-white shadow-sm border border-black/[0.06]"
                    : "text-[#6b6962] dark:text-white/50 hover:bg-black/[0.04] hover:text-[#1a1a18] dark:hover:text-white"
                )}
              >
                <item.icon className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-colors",
                  isActive ? "text-[#374DA4]" : "text-[#8a877f] group-hover:text-[#1a1a18] dark:group-hover:text-white"
                )} />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {isActive && !collapsed && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[#374DA4]" />
                )}
              </NavLink>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right" className="rounded-lg font-medium bg-[#1a1a18] text-white border-0">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }
            return linkContent;
          })}
        </TooltipProvider>
      </nav>

      {/* Footer */}
      <div className="border-t border-black/[0.06] dark:border-white/[0.06] p-3 space-y-1">
        {user && !collapsed && (
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <Avatar className="h-8 w-8 ring-1 ring-black/[0.06]">
              <AvatarFallback className="bg-[#374DA4] text-white text-[10px] font-bold">
                {user.email?.substring(0, 2).toUpperCase() || 'AD'}
              </AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-[#1a1a18] dark:text-white truncate">{user.user_metadata?.full_name || 'Admin'}</p>
              <p className="text-[10px] text-[#8a877f] truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => navigate('/dashboard')}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#6b6962] hover:bg-black/[0.04] hover:text-[#1a1a18] dark:hover:text-white transition-all",
            collapsed && "justify-center px-2"
          )}
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Voltar ao Dashboard</span>}
        </button>
        <button
          onClick={() => signOut()}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-[#6b6962] hover:bg-red-500/10 hover:text-red-600 transition-all",
            collapsed && "justify-center px-2"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-[#faf9f7] dark:bg-[#0b0b0a] flex overflow-hidden">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col transition-all duration-300 border-r border-black/[0.06] dark:border-white/[0.06]",
          sidebarWidth
        )}>
          <SidebarContent />
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-3.5 top-8 z-40 flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-[#1a1a18] border border-black/[0.08] shadow-sm hover:border-black/20 transition-all group"
          >
            {collapsed
              ? <ChevronRight className="h-3.5 w-3.5 text-[#6b6962]" />
              : <ChevronLeft className="h-3.5 w-3.5 text-[#6b6962]" />
            }
          </button>
        </aside>
      )}

      {/* Mobile Header + Drawer */}
      {isMobile && (
        <>
          <header className="fixed top-0 inset-x-0 z-40 h-14 bg-[#faf9f7] dark:bg-[#111110] border-b border-black/[0.06] flex items-center px-4">
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="relative z-10 text-[#1a1a18] dark:text-white hover:bg-black/[0.04]">
              <Menu className="h-5 w-5" />
            </Button>
            {/* Centered brand logo — matches the dashboard header */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <ElloLogo className="h-6 w-auto text-[#374DA4] dark:text-white" />
            </div>
          </header>

          {/* Overlay */}
          {mobileOpen && (
            <div className="fixed inset-0 z-50 flex">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
              <aside className="relative w-[280px] h-full shadow-2xl animate-in slide-in-from-left duration-300">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-3 right-3 z-10 text-[#6b6962] hover:bg-black/[0.04]"
                  onClick={() => setMobileOpen(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
                <SidebarContent />
              </aside>
            </div>
          )}
        </>
      )}

      {/* Main content */}
      <main className={cn(
        "flex-1 overflow-y-auto transition-all duration-300",
        !isMobile && (collapsed ? 'ml-[72px]' : 'ml-[260px]'),
        isMobile && 'pt-14'
      )}>
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
