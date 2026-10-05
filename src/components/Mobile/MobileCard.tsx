import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MobileCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
}

const MobileCard: React.FC<MobileCardProps> = ({
  title,
  children,
  className,
  onClick,
  icon
}) => {
  return (
    <Card 
      className={cn(
        "bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200",
        onClick && "cursor-pointer hover:border-primary/20 active:scale-[0.98]",
        className
      )}
      onClick={onClick}
    >
      {title && (
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={title ? "pt-0" : "p-6"}>
        {children}
      </CardContent>
    </Card>
  );
};

export default MobileCard;