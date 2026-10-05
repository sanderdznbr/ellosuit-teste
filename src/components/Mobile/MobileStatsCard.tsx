import React from 'react';
import { Card } from '@/components/ui/card';

interface MobileStatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  onClick?: () => void;
}

const MobileStatsCard: React.FC<MobileStatsCardProps> = ({ 
  title, 
  value, 
  subtitle,
  icon, 
  color,
  onClick 
}) => {
  const colorClasses = {
    blue: 'bg-[#374DA4]',
    green: 'bg-[#374DA4]',
    purple: 'bg-[#2F428D]',
    orange: 'bg-[#374DA4]',
    red: 'bg-[#2F428D]'
  };

  return (
    <Card 
      className="p-4 cursor-pointer hover:shadow-lg transition-all bg-white border-0 shadow-md rounded-2xl active:scale-95"
      onClick={onClick}
    >
      <div className="flex items-center space-x-3">
        <div className={`p-2.5 rounded-xl ${colorClasses[color]} text-white shadow-sm`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">{title}</p>
          <p className="text-xl font-bold text-foreground">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
    </Card>
  );
};

export default MobileStatsCard;
