import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';

interface HubModuleCardProps {
  id: string;
  title: string;
  description: string;
  icon: any;
  path: string;
  color: string;
  isComingSoon?: boolean;
}

export default function HubModuleCard({ title, description, icon: Icon, path, color, isComingSoon }: HubModuleCardProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Link
      to={isComingSoon ? '#' : path}
      className={`group block rounded-2xl overflow-hidden transition-all duration-300 ${isComingSoon ? 'opacity-70 grayscale-[0.5] cursor-not-allowed' : 'active:scale-[0.98] hover:scale-[1.02]'}`}
      style={{
        background: isDark
          ? `linear-gradient(135deg, ${color}22 0%, ${color}11 100%)`
          : 'rgba(255,255,255,0.95)',
        border: isDark ? `1px solid ${color}20` : '1px solid rgba(255,255,255,0.3)',
        boxShadow: isDark ? 'none' : '0 4px 20px -4px rgba(0,0,0,0.15)',
      }}
    >
      <div className="relative flex flex-col items-center justify-center px-4 py-8 md:py-10">
        {/* Decorative background circle */}
        <div
          className="absolute rounded-full transition-opacity duration-500"
          style={{
            width: 120,
            height: 120,
            opacity: isDark ? 0.1 : 0.08,
            background: isComingSoon ? 'rgba(0,0,0,0.2)' : `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          }}
        />
        
        {/* Icon */}
        <div
          className="relative z-10 flex items-center justify-center w-14 h-14 rounded-2xl mb-4 transition-transform duration-300 group-hover:scale-110"
          style={{
            background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`,
            boxShadow: `0 8px 24px -4px ${color}40`,
          }}
        >
          {typeof Icon === 'string' ? (
             <span className="text-xl">{Icon}</span>
          ) : (
            <Icon className="w-7 h-7 text-white" strokeWidth={1.8} />
          )}
          {isComingSoon && (
            <div className="absolute -top-1 -right-1 bg-amber-500 text-white text-[8px] font-bold px-1 rounded-full border border-white">EM BREVE</div>
          )}
        </div>

        {/* Title & Description */}
        <h3
          className="text-sm font-semibold text-center leading-tight"
          style={{ color: isDark ? '#fff' : '#1a1a2e' }}
        >
          {title}
        </h3>
        <p
          className="text-[11px] text-center mt-1 line-clamp-1"
          style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' }}
        >
          {description}
        </p>
      </div>
    </Link>
  );
}
