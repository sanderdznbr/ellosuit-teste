
import React, { useState } from 'react';
import { Users, Plus, Search, Phone, Mail, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { vibrate } from '@/utils/mobile-helpers';

const MobileClientsManager = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const clients = [
    { 
      name: 'João Silva', 
      company: 'Tech Solutions', 
      email: 'joao@tech.com', 
      phone: '(11) 99999-9999', 
      status: 'active',
      avatar: 'JS'
    },
    { 
      name: 'Maria Santos', 
      company: 'Digital Agency', 
      email: 'maria@digital.com', 
      phone: '(11) 88888-8888', 
      status: 'prospect',
      avatar: 'MS'
    },
    { 
      name: 'Pedro Costa', 
      company: 'StartUp Inc', 
      email: 'pedro@startup.com', 
      phone: '(11) 77777-7777', 
      status: 'active',
      avatar: 'PC'
    },
    { 
      name: 'Ana Oliveira', 
      company: 'Creative Studio', 
      email: 'ana@creative.com', 
      phone: '(11) 66666-6666', 
      status: 'inactive',
      avatar: 'AO'
    }
  ];

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.company.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'prospect': return 'bg-[#2F428D]';
      case 'inactive': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'prospect': return 'Prospect';
      case 'inactive': return 'Inativo';
      default: return 'Desconhecido';
    }
  };

  const handleClientClick = (client: any) => {
    vibrate(30);
    console.log('Client clicked:', client);
  };

  const clientStats = [
    { label: 'Ativos', value: '24', color: 'text-green-600', bgColor: 'bg-green-50' },
    { label: 'Prospects', value: '8', color: 'text-[#253573]', bgColor: 'bg-[#F0F2FE]' },
    { label: 'Inativos', value: '3', color: 'text-gray-600', bgColor: 'bg-gray-50' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-6 pb-24 space-y-6">
        {/* Search Bar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center space-x-3">
            <Search className="h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-500"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {clientStats.map((stat, index) => (
            <div 
              key={index} 
              className="bg-white rounded-2xl p-4 text-center shadow-sm animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={cn("inline-flex p-2 rounded-xl mb-2", stat.bgColor)}>
                <Users className={cn("h-4 w-4", stat.color)} />
              </div>
              <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-600">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Add Client Button */}
        <button className="w-full flex items-center justify-center space-x-3 p-4 bg-[#2F428D] text-white rounded-2xl hover:bg-[#253573] transition-colors shadow-sm">
          <Plus className="h-5 w-5" />
          <span className="font-medium">Adicionar Cliente</span>
        </button>

        {/* Clients List */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">
              Clientes ({filteredClients.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {filteredClients.map((client, index) => (
              <div
                key={index}
                className="p-4 hover:bg-gray-50 transition-colors cursor-pointer animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => handleClientClick(client)}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-[#DFE4FB] flex items-center justify-center">
                    <span className="text-[#2F428D] font-medium text-sm">{client.avatar}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900">{client.name}</h4>
                      <span className={cn(
                        "px-2 py-1 text-xs font-medium rounded-full",
                        client.status === 'active' ? 'bg-green-100 text-green-600' :
                        client.status === 'prospect' ? 'bg-[#DFE4FB] text-[#253573]' :
                        'bg-gray-100 text-gray-600'
                      )}>
                        {getStatusLabel(client.status)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{client.company}</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <div className="flex items-center space-x-1">
                        <Mail className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500 truncate">{client.email}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Phone className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">{client.phone}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Empty State */}
        {filteredClients.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum cliente encontrado</h3>
            <p className="text-gray-500">Tente ajustar sua pesquisa ou adicione novos clientes</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileClientsManager;
