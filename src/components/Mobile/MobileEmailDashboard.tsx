
import React, { useState } from 'react';
import { Mail, Send, Users, TrendingUp, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { vibrate } from '@/utils/mobile-helpers';

const MobileEmailDashboard = () => {
  const [activeTab, setActiveTab] = useState('inbox');

  const emailStats = [
    { 
      icon: Mail, 
      label: 'Recebidos', 
      value: '24', 
      color: 'text-[#2F428D]',
      bgColor: 'bg-[#F0F2FE]'
    },
    { 
      icon: Send, 
      label: 'Enviados', 
      value: '127', 
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    { 
      icon: Users, 
      label: 'Campanhas', 
      value: '8', 
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    { 
      icon: TrendingUp, 
      label: 'Taxa Abertura', 
      value: '68%', 
      color: 'text-[#2F428D]',
      bgColor: 'bg-[#F0F2FE]'
    }
  ];

  const recentEmails = [
    { from: 'João Silva', subject: 'Proposta comercial', time: '2 min', status: 'unread' },
    { from: 'Maria Santos', subject: 'Feedback do projeto', time: '1 hora', status: 'read' },
    { from: 'Pedro Costa', subject: 'Reunião de amanhã', time: '3 horas', status: 'replied' },
    { from: 'Ana Oliveira', subject: 'Documentos pendentes', time: '1 dia', status: 'read' }
  ];

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    vibrate(30);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unread': return 'bg-[#374DA4]';
      case 'replied': return 'bg-green-500';
      default: return 'bg-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-6 pb-24 space-y-6">
        {/* Search Bar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center space-x-3">
            <Search className="h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar emails..."
              className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-500"
            />
          </div>
        </div>

        {/* Email Stats */}
        <div className="grid grid-cols-2 gap-4">
          {emailStats.map((stat, index) => (
            <div 
              key={index} 
              className="bg-white rounded-2xl p-4 shadow-sm animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={cn("inline-flex p-2 rounded-xl mb-3", stat.bgColor)}>
                <stat.icon className={cn("h-5 w-5", stat.color)} />
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</p>
              <p className="text-sm text-gray-600">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filter Pills */}
        <div className="flex space-x-3">
          {[
            { id: 'inbox', label: 'Inbox' },
            { id: 'sent', label: 'Enviados' },
            { id: 'campaigns', label: 'Campanhas' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "px-4 py-2 rounded-full font-medium transition-all duration-200",
                activeTab === tab.id
                  ? "bg-[#2F428D] text-white shadow-md"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Email List */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Emails Recentes</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {recentEmails.map((email, index) => (
              <div 
                key={index} 
                className="p-4 hover:bg-gray-50 transition-colors animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-center space-x-4">
                  <div className={cn("w-3 h-3 rounded-full", getStatusColor(email.status))}></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">{email.from}</h4>
                      <span className="text-xs text-gray-500">{email.time}</span>
                    </div>
                    <p className="text-sm text-gray-600 truncate mt-1">{email.subject}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center justify-center space-x-3 p-4 bg-[#2F428D] text-white rounded-xl hover:bg-[#253573] transition-colors">
              <Plus className="h-5 w-5" />
              <span className="font-medium">Novo Email</span>
            </button>
            <button className="w-full flex items-center justify-center space-x-3 p-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors">
              <Users className="h-5 w-5" />
              <span className="font-medium">Nova Campanha</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileEmailDashboard;
