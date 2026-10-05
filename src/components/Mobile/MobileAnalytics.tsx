
import React from 'react';
import { TrendingUp, TrendingDown, BarChart3, PieChart } from 'lucide-react';
import MobileCard from '@/components/ui/mobile-card';

const MobileAnalytics = () => {
  const metrics = [
    { title: 'Vendas', value: 'R$ 45.200', change: '+12%', trend: 'up', color: 'text-green-500' },
    { title: 'Leads', value: '128', change: '+8%', trend: 'up', color: 'text-[#374DA4]' },
    { title: 'Conversão', value: '24%', change: '-2%', trend: 'down', color: 'text-[#2F428D]' },
    { title: 'Reuniões', value: '32', change: '+15%', trend: 'up', color: 'text-purple-500' }
  ];

  const recentReports = [
    { title: 'Relatório Mensal', date: '15 Jan 2024', type: 'PDF' },
    { title: 'Análise de Leads', date: '12 Jan 2024', type: 'Excel' },
    { title: 'Performance Email', date: '10 Jan 2024', type: 'PDF' }
  ];

  return (
    <div className="ios-scroll" style={{ backgroundColor: 'var(--ios-bg-grouped)' }}>
      <div className="px-4 pb-6 space-y-6">
        {/* Metrics */}
        <div className="ios-card-section">
          <div className="ios-section-header">
            <h2 className="ios-title-3">Métricas Principais</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 p-4">
            {metrics.map((metric, index) => (
              <MobileCard 
                key={index} 
                className="ios-card p-4 text-center ios-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="ios-caption text-gray-500">{metric.title}</span>
                  {metric.trend === 'up' ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <p className="ios-title-2 font-bold mb-1">{metric.value}</p>
                <p className={`ios-caption ${metric.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                  {metric.change}
                </p>
              </MobileCard>
            ))}
          </div>
        </div>

        {/* Charts Preview */}
        <div className="ios-card-section">
          <div className="ios-section-header">
            <h2 className="ios-title-3">Gráficos</h2>
          </div>
          <div className="p-4 space-y-3">
            <div className="ios-card p-4 text-center">
              <BarChart3 className="h-12 w-12 text-[#374DA4] mx-auto mb-2" />
              <h3 className="ios-headline">Vendas por Período</h3>
              <p className="ios-subheadline">Últimos 30 dias</p>
            </div>
            <div className="ios-card p-4 text-center">
              <PieChart className="h-12 w-12 text-purple-500 mx-auto mb-2" />
              <h3 className="ios-headline">Fontes de Lead</h3>
              <p className="ios-subheadline">Distribuição por canal</p>
            </div>
          </div>
        </div>

        {/* Recent Reports */}
        <div className="ios-card-section">
          <div className="ios-section-header">
            <h2 className="ios-title-3">Relatórios Recentes</h2>
          </div>
          <div className="space-y-1">
            {recentReports.map((report, index) => (
              <div key={index} className="ios-list-item ios-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-lg bg-[#DFE4FB] flex items-center justify-center">
                    <span className="ios-caption font-bold text-[#2F428D]">{report.type}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="ios-headline">{report.title}</h3>
                    <p className="ios-subheadline">{report.date}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileAnalytics;
