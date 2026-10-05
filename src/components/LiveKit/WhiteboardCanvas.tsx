import React, { useEffect, useRef, useState } from 'react';
import { Canvas as FabricCanvas, PencilBrush, Rect, Circle, IText } from 'fabric';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Pencil, Square, Circle as CircleIcon, Type, Eraser, Download, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRoomContext } from '@livekit/components-react';
import { useToast } from '@/hooks/use-toast';

interface WhiteboardCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  backgroundColor?: 'white' | 'black';
}

const WhiteboardCanvas: React.FC<WhiteboardCanvasProps> = ({ 
  isOpen, 
  onClose,
  backgroundColor = 'white' 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeTool, setActiveTool] = useState<'draw' | 'rectangle' | 'circle' | 'text' | 'eraser'>('draw');
  const [drawColor, setDrawColor] = useState(backgroundColor === 'white' ? '#000000' : '#ffffff');
  const room = useRoomContext();
  const { toast } = useToast();

  useEffect(() => {
    if (!canvasRef.current || !isOpen) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: window.innerWidth * 0.9,
      height: window.innerHeight * 0.75,
      backgroundColor: backgroundColor === 'white' ? '#ffffff' : '#1a1a1a',
    });

    // Configure drawing brush
    const brush = new PencilBrush(canvas);
    brush.color = drawColor;
    brush.width = 3;
    canvas.freeDrawingBrush = brush;

    setFabricCanvas(canvas);

    // Broadcast canvas changes to other participants
    canvas.on('object:added', () => {
      broadcastCanvasState(canvas);
    });

    canvas.on('object:modified', () => {
      broadcastCanvasState(canvas);
    });

    canvas.on('object:removed', () => {
      broadcastCanvasState(canvas);
    });

    // Handle window resize
    const handleResize = () => {
      canvas.setWidth(window.innerWidth * 0.9);
      canvas.setHeight(window.innerHeight * 0.75);
      canvas.renderAll();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.dispose();
    };
  }, [isOpen, backgroundColor]);

  useEffect(() => {
    if (!fabricCanvas) return;

    fabricCanvas.isDrawingMode = activeTool === 'draw' || activeTool === 'eraser';
    
    if (fabricCanvas.freeDrawingBrush) {
      if (activeTool === 'eraser') {
        fabricCanvas.freeDrawingBrush.color = backgroundColor === 'white' ? '#ffffff' : '#1a1a1a';
        fabricCanvas.freeDrawingBrush.width = 20;
      } else {
        fabricCanvas.freeDrawingBrush.color = drawColor;
        fabricCanvas.freeDrawingBrush.width = 3;
      }
    }
  }, [activeTool, drawColor, fabricCanvas, backgroundColor]);

  // Listen for canvas updates from other participants
  useEffect(() => {
    if (!room || !fabricCanvas) return;

    const handleDataReceived = (payload: Uint8Array, participant: any) => {
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));
        
        if (data.type === 'whiteboard') {
          fabricCanvas.loadFromJSON(data.canvasState, () => {
            fabricCanvas.renderAll();
          });
        }
      } catch (error) {
        console.error('Erro ao processar dados da lousa:', error);
      }
    };

    room.on('dataReceived', handleDataReceived);
    
    return () => {
      room.off('dataReceived', handleDataReceived);
    };
  }, [room, fabricCanvas]);

  const broadcastCanvasState = (canvas: FabricCanvas) => {
    if (!room) return;

    try {
      const canvasState = canvas.toJSON();
      const messageData = {
        type: 'whiteboard',
        canvasState: canvasState,
        timestamp: new Date().toISOString()
      };

      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(messageData));
      
      room.localParticipant.publishData(data, { reliable: true });
    } catch (error) {
      console.error('Erro ao transmitir estado da lousa:', error);
    }
  };

  const handleToolClick = (tool: typeof activeTool) => {
    setActiveTool(tool);

    if (!fabricCanvas) return;

    if (tool === 'rectangle') {
      const rect = new Rect({
        left: 100,
        top: 100,
        fill: 'transparent',
        stroke: drawColor,
        strokeWidth: 3,
        width: 150,
        height: 100,
      });
      fabricCanvas.add(rect);
    } else if (tool === 'circle') {
      const circle = new Circle({
        left: 100,
        top: 100,
        fill: 'transparent',
        stroke: drawColor,
        strokeWidth: 3,
        radius: 50,
      });
      fabricCanvas.add(circle);
    } else if (tool === 'text') {
      const text = new IText('Digite aqui...', {
        left: 100,
        top: 100,
        fill: drawColor,
        fontSize: 24,
      });
      fabricCanvas.add(text);
    }
  };

  const handleClear = () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = backgroundColor === 'white' ? '#ffffff' : '#1a1a1a';
    fabricCanvas.renderAll();
    broadcastCanvasState(fabricCanvas);
    toast({
      title: "Lousa limpa",
      description: "O conteúdo da lousa foi removido",
    });
  };

  const handleDownload = () => {
    if (!fabricCanvas) return;
    const dataURL = fabricCanvas.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: 1,
    });
    const link = document.createElement('a');
    link.download = `lousa-${new Date().getTime()}.png`;
    link.href = dataURL;
    link.click();
    toast({
      title: "Download concluído",
      description: "A imagem da lousa foi baixada",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-[95vw] h-[90vh] flex flex-col bg-background">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">
            Lousa Colaborativa
          </h3>
          <Button
            onClick={onClose}
            size="sm"
            variant="ghost"
            className="rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 p-3 border-b border-border bg-muted/30">
          <Button
            onClick={() => handleToolClick('draw')}
            size="sm"
            variant={activeTool === 'draw' ? 'default' : 'outline'}
            className="gap-2"
          >
            <Pencil className="h-4 w-4" />
            Desenhar
          </Button>
          <Button
            onClick={() => handleToolClick('rectangle')}
            size="sm"
            variant={activeTool === 'rectangle' ? 'default' : 'outline'}
          >
            <Square className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => handleToolClick('circle')}
            size="sm"
            variant={activeTool === 'circle' ? 'default' : 'outline'}
          >
            <CircleIcon className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => handleToolClick('text')}
            size="sm"
            variant={activeTool === 'text' ? 'default' : 'outline'}
          >
            <Type className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => handleToolClick('eraser')}
            size="sm"
            variant={activeTool === 'eraser' ? 'default' : 'outline'}
          >
            <Eraser className="h-4 w-4" />
          </Button>

          <div className="flex-1" />

          {/* Color picker */}
          <input
            type="color"
            value={drawColor}
            onChange={(e) => setDrawColor(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer border-2 border-border"
            title="Escolher cor"
          />

          <Button onClick={handleDownload} size="sm" variant="outline">
            <Download className="h-4 w-4" />
          </Button>
          <Button onClick={handleClear} size="sm" variant="destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
          <canvas ref={canvasRef} className="border border-border rounded-lg shadow-xl" />
        </div>
      </Card>
    </div>
  );
};

export default WhiteboardCanvas;