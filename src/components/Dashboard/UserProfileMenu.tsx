import React from 'react';
import { Link } from 'react-router-dom';
import { User, CreditCard, Settings, LogOut, Crown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';

interface UserProfileMenuProps {
  onLinkClick?: () => void;
}

export function UserProfileMenu({ onLinkClick }: UserProfileMenuProps) {
  const { user, signOut } = useAuth();

  if (!user) return null;

  const handleSignOut = () => {
    signOut();
    onLinkClick?.();
  };

  // Mock plan - in real app, fetch from user's subscription data
  const currentPlan = 'Starter'; // Could be 'Starter', 'Professional', 'Enterprise'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="focus:outline-none">
          <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-transparent hover:ring-white/30 transition-all">
            <AvatarImage src={user.user_metadata?.avatar_url} />
            <AvatarFallback className="bg-white/20 text-white text-xs">
              {user.email?.substring(0, 2).toUpperCase() || 'US'}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        side="right" 
        align="end" 
        className="w-64 rounded-xl shadow-xl border-border/50"
        sideOffset={12}
      >
        {/* User Info Header */}
        <DropdownMenuLabel className="p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {user.email?.substring(0, 2).toUpperCase() || 'US'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">
                {user.user_metadata?.full_name || 'Usuário'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user.email}
              </p>
              <Badge variant="secondary" className="mt-1 text-xs">
                <Crown className="h-3 w-3 mr-1" />
                {currentPlan}
              </Badge>
            </div>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {/* Menu Items */}
        <div className="p-1">
          <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
            <Link 
              to="/dashboard/perfil" 
              onClick={onLinkClick}
              className="flex items-center gap-3 py-2.5"
            >
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="font-medium">Meu Perfil</span>
                <p className="text-xs text-muted-foreground">Editar informações pessoais</p>
              </div>
            </Link>
          </DropdownMenuItem>
          
          <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
            <Link 
              to="/dashboard/assinatura" 
              onClick={onLinkClick}
              className="flex items-center gap-3 py-2.5"
            >
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="font-medium">Assinatura</span>
                <p className="text-xs text-muted-foreground">Gerenciar plano e pagamentos</p>
              </div>
            </Link>
          </DropdownMenuItem>
          
          <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
            <Link 
              to="/dashboard/configuracoes" 
              onClick={onLinkClick}
              className="flex items-center gap-3 py-2.5"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              <div>
                <span className="font-medium">Configurações</span>
                <p className="text-xs text-muted-foreground">Preferências gerais</p>
              </div>
            </Link>
          </DropdownMenuItem>
        </div>
        
        <DropdownMenuSeparator />
        
        <div className="p-1">
          <DropdownMenuItem 
            onClick={handleSignOut}
            className="rounded-lg cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-3" />
            Sair da conta
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
