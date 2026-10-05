import React, { useState, useEffect } from 'react';
import { Settings, Mic, Video, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface DeviceSettingsProps {
  onDeviceChange: (deviceType: 'audio' | 'video' | 'speaker', deviceId: string) => void;
}

interface MediaDeviceInfo {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

const DeviceSettings: React.FC<DeviceSettingsProps> = ({ onDeviceChange }) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<string>('');
  const [selectedVideo, setSelectedVideo] = useState<string>('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');

  const loadDevices = async () => {
    try {
      // Request permissions first
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      
      const deviceList = await navigator.mediaDevices.enumerateDevices();
      setDevices(deviceList.map(device => ({
        deviceId: device.deviceId,
        label: device.label || `${device.kind} ${device.deviceId.slice(0, 5)}`,
        kind: device.kind
      })));

      // Load saved preferences
      const savedAudio = localStorage.getItem('selectedAudioDevice');
      const savedVideo = localStorage.getItem('selectedVideoDevice');
      const savedSpeaker = localStorage.getItem('selectedSpeakerDevice');

      if (savedAudio) setSelectedAudio(savedAudio);
      if (savedVideo) setSelectedVideo(savedVideo);
      if (savedSpeaker) setSelectedSpeaker(savedSpeaker);

    } catch (error) {
      console.error('Error loading devices:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar dispositivos",
        variant: "destructive",
      });
    }
  };

  const handleDeviceChange = (deviceType: 'audio' | 'video' | 'speaker', deviceId: string) => {
    // Save to localStorage
    localStorage.setItem(`selected${deviceType.charAt(0).toUpperCase() + deviceType.slice(1)}Device`, deviceId);
    
    // Update state
    if (deviceType === 'audio') setSelectedAudio(deviceId);
    else if (deviceType === 'video') setSelectedVideo(deviceId);
    else if (deviceType === 'speaker') setSelectedSpeaker(deviceId);

    // Notify parent
    onDeviceChange(deviceType, deviceId);

    toast({
      title: "Dispositivo alterado",
      description: `${deviceType === 'audio' ? 'Microfone' : deviceType === 'video' ? 'Câmera' : 'Alto-falante'} alterado com sucesso`,
    });
  };

  useEffect(() => {
    if (isOpen) {
      loadDevices();
    }
  }, [isOpen]);

  const audioDevices = devices.filter(d => d.kind === 'audioinput');
  const videoDevices = devices.filter(d => d.kind === 'videoinput');
  const speakerDevices = devices.filter(d => d.kind === 'audiooutput');

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações de Dispositivos</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Microfone
            </Label>
            <Select value={selectedAudio} onValueChange={(value) => handleDeviceChange('audio', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar microfone" />
              </SelectTrigger>
              <SelectContent>
                {audioDevices.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Câmera
            </Label>
            <Select value={selectedVideo} onValueChange={(value) => handleDeviceChange('video', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar câmera" />
              </SelectTrigger>
              <SelectContent>
                {videoDevices.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {speakerDevices.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                Alto-falante
              </Label>
              <Select value={selectedSpeaker} onValueChange={(value) => handleDeviceChange('speaker', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar alto-falante" />
                </SelectTrigger>
                <SelectContent>
                  {speakerDevices.map((device) => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeviceSettings;