import React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CheckCircle2, 
  AlertCircle, 
  Mail, 
  ChevronDown,
  LogOut,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { GmailAlias } from '@/hooks/useGmail';
import { Save } from 'lucide-react';

interface EmailConnectionPopoverProps {
  isConnected: boolean;
  loading: boolean;
  emailAccount: any;
  aliases?: GmailAlias[];
  selectedAlias?: string;
  savedAlias?: string;
  savingAlias?: boolean;
  onAliasChange?: (email: string) => void;
  onSaveAlias?: (email: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

const EmailConnectionPopover: React.FC<EmailConnectionPopoverProps> = ({
  isConnected,
  loading,
  emailAccount,
  aliases = [],
  selectedAlias,
  savedAlias,
  savingAlias,
  onAliasChange,
  onSaveAlias,
  onConnect,
  onDisconnect
}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className={`h-9 gap-2 ${
            isConnected 
              ? 'border-green-200 text-green-700 hover:bg-green-50' 
              : 'border-amber-200 text-amber-700 hover:bg-amber-50'
          }`}
        >
          {isConnected ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <span className="hidden sm:inline max-w-[150px] truncate">
                {emailAccount?.email || 'Conectado'}
              </span>
              <span className="sm:hidden">Gmail</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4" />
              <span>Conectar Email</span>
            </>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      
      <PopoverContent align="end" className="w-80 p-4">
        {isConnected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Mail className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground">Gmail Conectado</p>
                <p className="text-xs text-muted-foreground truncate">
                  {emailAccount?.email}
                </p>
              </div>
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                Ativo
              </Badge>
            </div>
            
            {aliases.length > 1 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-2">Enviar como:</p>
                <Select value={selectedAlias || emailAccount?.email} onValueChange={(val) => onAliasChange?.(val)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {aliases.map((alias) => (
                      <SelectItem key={alias.email} value={alias.email}>
                        {alias.displayName ? `${alias.displayName} <${alias.email}>` : alias.email}
                        {alias.isPrimary ? ' ★' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAlias && selectedAlias !== savedAlias && (
                  <Button
                    size="sm"
                    className="w-full mt-2 gap-2"
                    onClick={() => onSaveAlias?.(selectedAlias)}
                    disabled={savingAlias}
                  >
                    {savingAlias ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Salvar como padrão
                  </Button>
                )}
              </div>
            )}
            <div className="pt-2 border-t">
              <Button 
                variant="outline"
                size="sm"
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                onClick={onDisconnect}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4 mr-2" />
                )}
                Desconectar Gmail
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-sm text-foreground">Email não conectado</p>
                <p className="text-xs text-muted-foreground">
                  Conecte para enviar campanhas
                </p>
              </div>
            </div>
            
            <Button 
              className="w-full bg-primary hover:bg-primary/90"
              onClick={onConnect}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Conectar Gmail
                </>
              )}
            </Button>
            
            <p className="text-xs text-muted-foreground text-center">
              Emails serão enviados do seu endereço Gmail
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default EmailConnectionPopover;
