import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';

interface ComingSoonIntegrationCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  description?: string;
  iconBgClassName?: string;
}

/**
 * Card padrão exibido no lugar de integrações que dependem de OAuth do
 * Google enquanto o app não está verificado no Google Cloud Console.
 */
const ComingSoonIntegrationCard: React.FC<ComingSoonIntegrationCardProps> = ({
  icon,
  title,
  subtitle,
  description,
  iconBgClassName = 'bg-muted',
}) => {
  return (
    <Card className="shadow-lg border-0 rounded-2xl opacity-80">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconBgClassName}`}>
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{title}</h3>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Em breve
          </Badge>
          <Button disabled className="min-w-[140px]">
            Em Desenvolvimento
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {description ??
            'Esta integração estará disponível assim que concluirmos a verificação oficial junto ao Google.'}
        </p>
      </CardContent>
    </Card>
  );
};

export default ComingSoonIntegrationCard;