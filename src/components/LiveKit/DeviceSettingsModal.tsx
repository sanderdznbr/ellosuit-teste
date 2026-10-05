import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { AlertCircle, Loader2, RefreshCw, Mic, Camera, Monitor, FlipHorizontal, Sparkles, Image as ImageIcon, Layout } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface DeviceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId?: string;
}

const DeviceSettingsModal: React.FC<DeviceSettingsModalProps> = ({
  isOpen,
  onClose,
  companyId = ''
}) => {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');
   const [mirrorWebcam, setMirrorWebcam] = useState(true);
   const [backgroundEffect, setBackgroundEffect] = useState<'none' | 'blur' | 'image'>('none');
   const [gimbalEnabled, setGimbalEnabled] = useState(false);
  const [permissionError, setPermissionError] = useState<string>('');
  const [requestingPermissions, setRequestingPermissions] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const { toast } = useToast();

  // Start monitoring audio level for selected microphone
  useEffect(() => {
    if (!isOpen || !selectedMicrophone) return;

    let cancelled = false;

    const startMonitoring = async () => {
      // Cleanup previous
      stopAudioMonitoring();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: selectedMicrophone } }
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        micStreamRef.current = stream;
        const ctx = new AudioContext();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (cancelled) return;
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        // Silently fail - device might not be available
      }
    };

    startMonitoring();

    return () => {
      cancelled = true;
      stopAudioMonitoring();
    };
  }, [isOpen, selectedMicrophone]);

  const stopAudioMonitoring = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
    audioContextRef.current = null;
    analyserRef.current = null;
    micStreamRef.current = null;
    animFrameRef.current = null;
    setAudioLevel(0);
  };

  useEffect(() => {
    if (isOpen) {
      const getDevices = async () => {
        try {
           // Tentar solicitar permissões de forma resiliente
           let stream: MediaStream | null = null;
           try {
             stream = await navigator.mediaDevices.getUserMedia({ 
               video: { width: { ideal: 1280 }, height: { ideal: 720 } },
               audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
             });
           } catch (e) {
             console.warn('⚠️ Falha no acesso total em DeviceSettings, tentando apenas um deles...');
             try {
               stream = await navigator.mediaDevices.getUserMedia({ audio: true });
             } catch (e2) {
               try {
                 stream = await navigator.mediaDevices.getUserMedia({ video: true });
               } catch (e3) {
                 console.error('❌ Falha total ao solicitar mídia para listar dispositivos');
               }
             }
           }
           
           const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
          
          setCameras(videoDevices);
          setMicrophones(audioInputDevices);
          
          const savedCamera = localStorage.getItem('preferred_video_device');
          const savedMic = localStorage.getItem('preferred_audio_device');
          
          if (savedCamera && videoDevices.some(d => d.deviceId === savedCamera)) {
            setSelectedCamera(savedCamera);
          } else if (videoDevices.length > 0) {
            setSelectedCamera(videoDevices[0].deviceId);
          }
          
          if (savedMic && audioInputDevices.some(d => d.deviceId === savedMic)) {
            setSelectedMicrophone(savedMic);
          } else if (audioInputDevices.length > 0) {
            setSelectedMicrophone(audioInputDevices[0].deviceId);
          }

           const savedMirror = localStorage.getItem('meeting_mirror_webcam');
           if (savedMirror !== null) {
             setMirrorWebcam(savedMirror === 'true');
           }

           const savedBg = localStorage.getItem('meeting_background_effect');
           if (savedBg) setBackgroundEffect(savedBg as any);

           const savedGimbal = localStorage.getItem('meeting_gimbal_enabled');
           if (savedGimbal !== null) setGimbalEnabled(savedGimbal === 'true');
          
          stream.getTracks().forEach(track => track.stop());
        } catch (error: any) {
          let errorMessage = "Não foi possível acessar os dispositivos.";
          if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMessage = "Permissão negada. Por favor, permita o acesso à câmera e microfone nas configurações do navegador.";
          } else if (error.name === 'NotFoundError') {
            errorMessage = "Nenhum dispositivo de câmera ou microfone foi encontrado.";
          } else if (error.name === 'NotReadableError') {
            errorMessage = "Os dispositivos estão sendo usados por outro aplicativo.";
          }
          setPermissionError(errorMessage);
          console.error("Erro ao acessar dispositivos:", errorMessage);
        }
      };
      getDevices();
    } else {
      stopAudioMonitoring();
    }
  }, [isOpen, toast]);

   const handleSave = () => {
     if (selectedCamera) localStorage.setItem('preferred_video_device', selectedCamera);
     if (selectedMicrophone) localStorage.setItem('preferred_audio_device', selectedMicrophone);
     localStorage.setItem('meeting_mirror_webcam', String(mirrorWebcam));
     localStorage.setItem('meeting_background_effect', backgroundEffect);
     localStorage.setItem('meeting_gimbal_enabled', String(gimbalEnabled));
     console.log("Configurações de dispositivos salvas");
     onClose();
   };

  const requestPermissionsAgain = async () => {
    setRequestingPermissions(true);
    setPermissionError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(devices.filter(d => d.kind === 'videoinput'));
      setMicrophones(devices.filter(d => d.kind === 'audioinput'));
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      const audioDevices = devices.filter(d => d.kind === 'audioinput');
      if (videoDevices.length > 0) setSelectedCamera(videoDevices[0].deviceId);
      if (audioDevices.length > 0) setSelectedMicrophone(audioDevices[0].deviceId);
      stream.getTracks().forEach(track => track.stop());
      console.log("Permissões de mídia concedidas");
    } catch (error: any) {
      const errorMsg = error.name === 'NotAllowedError' ? 'Você precisa permitir acesso aos dispositivos' :
        error.name === 'NotFoundError' ? 'Nenhum dispositivo encontrado' : 'Erro ao acessar dispositivos';
      setPermissionError(errorMsg);
      console.error("Erro ao solicitar permissões:", errorMsg);
    } finally {
      setRequestingPermissions(false);
    }
  };

  // Determine audio level color
  const getLevelColor = () => {
    if (audioLevel > 60) return 'bg-green-500';
    if (audioLevel > 20) return 'bg-green-400';
    return 'bg-gray-300';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal={true}>
      <DialogContent 
        className="sm:max-w-md bg-white border-gray-200"
        style={{ zIndex: 99999 }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-gray-900 flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Configurações de Dispositivos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {permissionError && cameras.length === 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-600 mb-2">{permissionError}</p>
                  <Button onClick={requestPermissionsAgain} disabled={requestingPermissions} size="sm" className="bg-red-600 hover:bg-red-700">
                    {requestingPermissions ? (<><Loader2 className="w-3 h-3 mr-2 animate-spin" />Solicitando...</>) : (<><RefreshCw className="w-3 h-3 mr-2" />Tentar novamente</>)}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Camera */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Câmera
            </Label>
            <Select value={selectedCamera} onValueChange={setSelectedCamera}>
              <SelectTrigger className="bg-white border-gray-300">
                <SelectValue placeholder="Selecione uma câmera" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-300" style={{ zIndex: 999999 }}>
                {cameras.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-gray-500">Nenhuma câmera encontrada</div>
                ) : cameras.map((camera) => (
                  <SelectItem key={camera.deviceId} value={camera.deviceId}>
                    {camera.label || `Câmera ${camera.deviceId.substring(0, 8)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Microphone */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Microfone
            </Label>
            <Select value={selectedMicrophone} onValueChange={setSelectedMicrophone}>
              <SelectTrigger className="bg-white border-gray-300">
                <SelectValue placeholder="Selecione um microfone" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-300" style={{ zIndex: 999999 }}>
                {microphones.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-gray-500">Nenhum microfone encontrado</div>
                ) : microphones.map((mic) => (
                  <SelectItem key={mic.deviceId} value={mic.deviceId}>
                    {mic.label || `Microfone ${mic.deviceId.substring(0, 8)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

           {/* Mirror Webcam Toggle */}
           <div className="flex items-center justify-between py-1">
             <div className="space-y-0.5">
               <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                 <FlipHorizontal className="h-4 w-4" />
                 Espelhar Webcam
               </Label>
             </div>
             <Switch 
               checked={mirrorWebcam}
               onCheckedChange={setMirrorWebcam}
             />
           </div>

           {/* Background Effect */}
           <div className="space-y-2">
             <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
               <Sparkles className="h-4 w-4" />
               Efeito de Fundo
             </Label>
             <Select value={backgroundEffect} onValueChange={(val: any) => setBackgroundEffect(val)}>
               <SelectTrigger className="bg-white border-gray-300">
                 <SelectValue placeholder="Selecione um efeito" />
               </SelectTrigger>
               <SelectContent className="bg-white border-gray-300" style={{ zIndex: 999999 }}>
                 <SelectItem value="none">Nenhum</SelectItem>
                 <SelectItem value="blur">Desfoque (Beta)</SelectItem>
                 <SelectItem value="image">Fundo Virtual (Beta)</SelectItem>
               </SelectContent>
             </Select>
           </div>

           {/* Gimbal (Auto-centering) Toggle */}
           <div className="flex items-center justify-between py-1">
             <div className="space-y-0.5">
               <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                 <Layout className="h-4 w-4" />
                 Gimbal Automático (Centralizar Rosto)
               </Label>
               <p className="text-xs text-gray-500">A câmera segue seu rosto lentamente</p>
             </div>
             <Switch 
               checked={gimbalEnabled}
               onCheckedChange={setGimbalEnabled}
             />
           </div>

          {/* Audio Level Meter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Nível do Microfone
            </Label>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                <div
                  className={`h-full rounded-full transition-all duration-100 ${getLevelColor()}`}
                  style={{ width: `${audioLevel}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 w-8 text-right font-mono">{audioLevel}%</span>
            </div>
            <p className="text-xs text-gray-400">
              {audioLevel > 5 ? '✅ Áudio detectado — microfone funcionando' : '🔇 Fale algo para testar o microfone'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
            <Button onClick={onClose} variant="outline" className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50">
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-[#2F428D] hover:bg-[#253573] text-white">
              Salvar Configurações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeviceSettingsModal;
