
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Globe, Plus } from 'lucide-react';
import SchedulesTab from './MyMeetings/SchedulesTab';
import HolidaysTab from './MyMeetings/HolidaysTab';
import BookingLinksTab from './MyMeetings/BookingLinksTab';
import { useMyMeetings } from '@/hooks/useMyMeetings';

const FLOW_COLOR = "#4D7CFF";

const MyMeetings = () => {
  const [activeTab, setActiveTab] = useState('schedules');
  const { schedules, holidays, bookingLinks, loading } = useMyMeetings();

  if (loading) {
    return (
      <div className="p-6 min-h-screen bg-white">
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-white">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Clean Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda Online</h1>
          <p className="text-sm text-gray-500">Configure seus horários e links de agendamento</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${FLOW_COLOR}15` }}>
              <Clock className="h-5 w-5" style={{ color: FLOW_COLOR }} />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{schedules.length}</p>
              <p className="text-xs text-gray-500">Horários</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-50">
              <Calendar className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{holidays.length}</p>
              <p className="text-xs text-gray-500">Feriados</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-50">
              <Globe className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{bookingLinks.length}</p>
              <p className="text-xs text-gray-500">Links</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b px-6 pt-4">
              <TabsList className="bg-transparent h-auto p-0 gap-6">
                <TabsTrigger 
                  value="schedules" 
                  className="flex items-center gap-2 px-0 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-current data-[state=active]:shadow-none bg-transparent"
                  style={{ '--tw-border-opacity': 1 } as any}
                >
                  <Clock className="h-4 w-4" />
                  Horários
                </TabsTrigger>
                <TabsTrigger 
                  value="holidays" 
                  className="flex items-center gap-2 px-0 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-current data-[state=active]:shadow-none bg-transparent"
                >
                  <Calendar className="h-4 w-4" />
                  Feriados
                </TabsTrigger>
                <TabsTrigger 
                  value="booking-links" 
                  className="flex items-center gap-2 px-0 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-current data-[state=active]:shadow-none bg-transparent"
                >
                  <Globe className="h-4 w-4" />
                  Links Públicos
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="schedules" className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Horários de Disponibilidade</h3>
                  <p className="text-sm text-gray-500">Configure quando você está disponível para reuniões</p>
                </div>
                <Button size="sm" className="rounded-xl" style={{ backgroundColor: FLOW_COLOR }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Horário
                </Button>
              </div>
              <SchedulesTab schedules={schedules} />
            </TabsContent>

            <TabsContent value="holidays" className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Feriados e Bloqueios</h3>
                  <p className="text-sm text-gray-500">Defina datas em que você não estará disponível</p>
                </div>
                <Button size="sm" className="rounded-xl bg-red-500 hover:bg-red-600">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Feriado
                </Button>
              </div>
              <HolidaysTab holidays={holidays} />
            </TabsContent>

            <TabsContent value="booking-links" className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Links de Agendamento</h3>
                  <p className="text-sm text-gray-500">Crie links para que clientes agendem reuniões</p>
                </div>
                <Button size="sm" className="rounded-xl bg-green-500 hover:bg-green-600">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Link
                </Button>
              </div>
              <BookingLinksTab bookingLinks={bookingLinks} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default MyMeetings;
