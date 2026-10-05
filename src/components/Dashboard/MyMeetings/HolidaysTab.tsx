
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar, Plus } from 'lucide-react';

interface HolidaysTabProps {
  holidays: any[];
}

const HolidaysTab: React.FC<HolidaysTabProps> = ({ holidays }) => {
  const [isAddingHoliday, setIsAddingHoliday] = useState(false);
  
  // Feriados brasileiros padrão
  const defaultHolidays = [
    { name: 'Ano Novo', date: '2024-01-01' },
    { name: 'Carnaval', date: '2024-02-12' },
    { name: 'Carnaval', date: '2024-02-13' },
    { name: 'Sexta-feira Santa', date: '2024-03-29' },
    { name: 'Tiradentes', date: '2024-04-21' },
    { name: 'Dia do Trabalhador', date: '2024-05-01' },
    { name: 'Independência do Brasil', date: '2024-09-07' },
    { name: 'Nossa Senhora Aparecida', date: '2024-10-12' },
    { name: 'Finados', date: '2024-11-02' },
    { name: 'Proclamação da República', date: '2024-11-15' },
    { name: 'Natal', date: '2024-12-25' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Feriados</h3>
          <p className="text-gray-500 mt-1">Gerencie os feriados que bloqueiam agendamentos</p>
        </div>
        <Button 
          onClick={() => setIsAddingHoliday(true)}
          className="bg-[#3600FF] hover:bg-[#3600FF]/90 text-white flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Adicionar Feriado</span>
        </Button>
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Feriados Brasileiros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {defaultHolidays.map((holiday, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-[#3600FF]/10 rounded-lg flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-[#3600FF]" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{holiday.name}</h4>
                    <p className="text-sm text-gray-500">
                      {new Date(holiday.date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <Switch defaultChecked />
              </div>
            ))}
          </CardContent>
        </Card>

        {holidays.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Feriados Personalizados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {holidays.map((holiday) => (
                <div key={holiday.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{holiday.name}</h4>
                      <p className="text-sm text-gray-500">
                        {new Date(holiday.date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <Switch checked={holiday.is_active} />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default HolidaysTab;
