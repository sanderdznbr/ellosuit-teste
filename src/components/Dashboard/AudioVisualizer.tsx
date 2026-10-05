import React, { useEffect, useRef, useState } from 'react';

interface AudioVisualizerProps {
  stream: MediaStream | null;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ stream }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode>();
  const [volume, setVolume] = useState(0);
  const [primaryColor, setPrimaryColor] = useState('rgb(99, 102, 241)'); // Fallback color

  useEffect(() => {
    // Get computed primary color from CSS variable
    if (canvasRef.current) {
      const computedStyle = getComputedStyle(canvasRef.current);
      const primaryHsl = computedStyle.getPropertyValue('--primary').trim();
      
      if (primaryHsl) {
        // Convert HSL to RGB for canvas
        const hslValues = primaryHsl.split(' ').map(v => parseFloat(v));
        if (hslValues.length >= 3) {
          const [h, s, l] = hslValues;
          setPrimaryColor(`hsl(${h}, ${s}%, ${l}%)`);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!stream) {
      return;
    }

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256; // Smaller for cleaner bars
    
    source.connect(analyser);
    analyserRef.current = analyser;
    
    visualize();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      audioContext.close();
    };
  }, [stream, primaryColor]);

  const visualize = () => {
    if (!analyserRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!analyserRef.current) return;
      
      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteFrequencyData(dataArray);

      // Calculate volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const avgVolume = (sum / bufferLength) / 255 * 100;
      setVolume(Math.round(avgVolume));

      // Clear canvas
      ctx.fillStyle = 'transparent';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw bars
      const barCount = 32;
      const barWidth = canvas.width / barCount;
      const gap = 2;

      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * bufferLength);
        const barHeight = (dataArray[dataIndex] / 255) * canvas.height;
        
        // Use direct color values that canvas can understand
        ctx.fillStyle = primaryColor;
        ctx.globalAlpha = 0.6 + (barHeight / canvas.height) * 0.4; // Vary opacity
        
        ctx.fillRect(
          i * barWidth + gap / 2,
          canvas.height - barHeight,
          barWidth - gap,
          barHeight
        );
      }
      
      ctx.globalAlpha = 1.0; // Reset alpha
    };

    draw();
  };

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        width={600}
        height={60}
        className="w-full h-16 rounded-lg"
      />

      <div className="flex items-center gap-2 justify-center">
        <span className="text-xs text-muted-foreground">Volume:</span>
        <div className="w-32 h-1.5 bg-background/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary/60 transition-all duration-100 rounded-full"
            style={{ width: `${volume}%` }}
          />
        </div>
        <span className="text-xs font-mono text-muted-foreground">{volume}%</span>
      </div>
    </div>
  );
};
