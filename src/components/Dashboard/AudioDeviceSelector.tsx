import React, { useState, useEffect } from 'react';
 import { Mic, Settings2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface AudioDevice {
  deviceId: string;
  label: string;
}

interface AudioDeviceSelectorProps {
  onDeviceSelect: (deviceId: string) => void;
  selectedDeviceId?: string;
}

export const AudioDeviceSelector: React.FC<AudioDeviceSelectorProps> = ({
  onDeviceSelect,
  selectedDeviceId
}) => {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [testing, setTesting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadDevices();
    
    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
    };
  }, []);

  const loadDevices = async () => {
    try {
      // Request permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      
      // Filter audio input devices and exclude loopback/virtual devices
      const suspiciousNames = [
        'stereo mix', 'loopback', 'monitor', 'what u hear', 
        'blackhole', 'soundflower', 'virtual audio', 'voicemeeter',
        'wave out mix', 'mixage stéréo', 'estéreo mix'
      ];
      
      const audioInputs = allDevices
        .filter(device => device.kind === 'audioinput')
        .filter(device => {
          const labelLower = device.label.toLowerCase();
          const isSuspicious = suspiciousNames.some(name => labelLower.includes(name));
          if (isSuspicious) {
            console.warn('⚠️ Dispositivo suspeito filtrado:', device.label);
          }
          return !isSuspicious;
        })
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microfone ${device.deviceId.slice(0, 5)}`
        }));
      
      console.log('🎤 Dispositivos de áudio encontrados:', audioInputs);
      setDevices(audioInputs);
      
      // Auto-select first device if none selected
      if (!selectedDeviceId && audioInputs.length > 0) {
        onDeviceSelect(audioInputs[0].deviceId);
      }
    } catch (error) {
      console.error('Erro ao carregar dispositivos:', error);
      toast({
        title: "Erro",
        description: "Não foi possível acessar os dispositivos de áudio",
        variant: "destructive"
      });
    }
  };

  const testMicrophone = async () => {
    if (!selectedDeviceId) {
      toast({
        title: "Selecione um microfone",
        description: "Por favor, selecione um microfone antes de testar",
        variant: "destructive"
      });
      return;
    }

    setTesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: selectedDeviceId } }
      });

      // Test for 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      stream.getTracks().forEach(track => track.stop());
      
      toast({
        title: "Teste Concluído",
        description: "Microfone funcionando corretamente!",
      });
    } catch (error) {
      console.error('Erro no teste:', error);
      toast({
        title: "Erro no Teste",
        description: "Não foi possível testar o microfone",
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  return (
     <div className="space-y-4 p-0">
       <div className="space-y-2">
         <Label className="text-white/70 flex items-center gap-2 text-sm">
           <Settings2 className="h-4 w-4 text-[#3600FF]" />
           Dispositivo de Áudio
         </Label>
         
         <Select value={selectedDeviceId} onValueChange={onDeviceSelect}>
           <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl text-white focus:ring-[#3600FF]/50">
             <SelectValue placeholder="Selecione um microfone" />
           </SelectTrigger>
           <SelectContent className="bg-[#1a1a1a] border-white/10 text-white">
             {devices.map(device => (
               <SelectItem key={device.deviceId} value={device.deviceId} className="focus:bg-[#3600FF]/20 focus:text-white">
                 {device.label}
               </SelectItem>
             ))}
           </SelectContent>
         </Select>
         
         {selectedDeviceId && (
           <Button
             onClick={testMicrophone}
             variant="ghost"
             size="sm"
             disabled={testing}
             className="w-full h-10 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-all text-xs"
           >
             {testing ? 'Testando...' : 'Testar Microfone'}
           </Button>
         )}
       </div>
     </div>
  );
};
