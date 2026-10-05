
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Clock, Edit } from 'lucide-react';
import { useMyMeetings } from '@/hooks/useMyMeetings';

interface SchedulesTabProps {
  schedules: any[];
}

const SchedulesTab: React.FC<SchedulesTabProps> = ({ schedules }) => {
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    day_of_week: 1,
    start_time: '09:00',
    end_time: '17:00',
    is_active: true
  });
  
  const { createSchedule, updateSchedule } = useMyMeetings();

  const daysOfWeek = [
    'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'
  ];

  const handleCreateSchedule = async () => {
    await createSchedule(newSchedule);
    setIsAddingSchedule(false);
    setNewSchedule({
      day_of_week: 1,
      start_time: '09:00',
      end_time: '17:00',
      is_active: true
    });
  };

  const toggleScheduleActive = async (id: string, isActive: boolean) => {
    await updateSchedule(id, { is_active: !isActive });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Horários de Trabalho</h3>
          <p className="text-gray-500 mt-1">Configure seus horários disponíveis para agendamento</p>
        </div>
        <Button 
          onClick={() => setIsAddingSchedule(true)}
          className="bg-[#3600FF] hover:bg-[#3600FF]/90 text-white flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Adicionar Horário</span>
        </Button>
      </div>

      {isAddingSchedule && (
        <Card className="border-[#3600FF] border-2">
          <CardHeader>
            <CardTitle className="text-lg">Novo Horário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="day">Dia da Semana</Label>
                <select
                  id="day"
                  value={newSchedule.day_of_week}
                  onChange={(e) => setNewSchedule({...newSchedule, day_of_week: parseInt(e.target.value)})}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  {daysOfWeek.map((day, index) => (
                    <option key={index} value={index}>{day}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="start">Hora Início</Label>
                <Input
                  id="start"
                  type="time"
                  value={newSchedule.start_time}
                  onChange={(e) => setNewSchedule({...newSchedule, start_time: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="end">Hora Fim</Label>
                <Input
                  id="end"
                  type="time"
                  value={newSchedule.end_time}
                  onChange={(e) => setNewSchedule({...newSchedule, end_time: e.target.value})}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  checked={newSchedule.is_active}
                  onCheckedChange={(checked) => setNewSchedule({...newSchedule, is_active: checked})}
                />
                <Label>Ativo</Label>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => setIsAddingSchedule(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateSchedule} className="bg-[#3600FF] hover:bg-[#3600FF]/90">
                  Salvar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {schedules.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhum horário configurado</h3>
            <p className="text-gray-500 mb-4">Configure seus horários disponíveis para que clientes possam agendar</p>
            <Button 
              onClick={() => setIsAddingSchedule(true)}
              className="bg-[#3600FF] hover:bg-[#3600FF]/90"
            >
              Adicionar Primeiro Horário
            </Button>
          </Card>
        ) : (
          schedules.map((schedule) => (
            <Card key={schedule.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-[#3600FF]/10 rounded-lg flex items-center justify-center">
                      <Clock className="h-6 w-6 text-[#3600FF]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {daysOfWeek[schedule.day_of_week]}
                      </h4>
                      <p className="text-gray-500">
                        {schedule.start_time} - {schedule.end_time}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <Switch
                      checked={schedule.is_active}
                      onCheckedChange={() => toggleScheduleActive(schedule.id, schedule.is_active)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default SchedulesTab;
