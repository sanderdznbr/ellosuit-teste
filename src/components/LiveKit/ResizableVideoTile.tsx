import React, { useState, useRef } from 'react';
import { VideoTrack, TrackReference } from '@livekit/components-react';
import { Track, Participant } from 'livekit-client';
import { cn } from '@/lib/utils';
import { MicOff } from 'lucide-react';

interface ResizableVideoTileProps {
  trackRef: TrackReference;
  isScreenShare?: boolean;
  defaultWidth?: number;
  defaultHeight?: number;
}

const ResizableVideoTile: React.FC<ResizableVideoTileProps> = ({
  trackRef,
  isScreenShare = false,
  defaultWidth = 320,
  defaultHeight = 180,
}) => {
  const [dimensions, setDimensions] = useState({
    width: isScreenShare ? Math.min(800, defaultWidth * 1.5) : defaultWidth,
    height: isScreenShare ? Math.min(600, defaultHeight * 1.5) : defaultHeight,
  });
  const [isResizing, setIsResizing] = useState(false);
  const tileRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  const participant = trackRef.participant;
  const isLocal = participant.isLocal;
  const isMuted = !participant.isMicrophoneEnabled;

  const getParticipantName = (participant: Participant) => {
    return participant.name || participant.identity || 'Participante';
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return; // Only on resize handle
    
    e.preventDefault();
    setIsResizing(true);
    
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: dimensions.width,
      height: dimensions.height,
    };

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartRef.current.x;
      const deltaY = e.clientY - resizeStartRef.current.y;
      
      const newWidth = Math.max(200, Math.min(800, resizeStartRef.current.width + deltaX));
      const newHeight = Math.max(150, Math.min(600, resizeStartRef.current.height + deltaY));
      
      setDimensions({
        width: newWidth,
        height: newHeight,
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      ref={tileRef}
      className={cn(
        "relative rounded-2xl overflow-hidden border-2 transition-all duration-300",
        isScreenShare 
          ? "bg-black border-green-400 shadow-xl shadow-green-100/50 hover:border-green-500" 
          : "bg-black border-gray-300 hover:border-[#5A74D1] shadow-lg hover:shadow-xl",
        isResizing && "border-[#374DA4] shadow-2xl"
      )}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        aspectRatio: isScreenShare ? 'auto' : '16/9',
      }}
    >
      {trackRef.publication?.kind === Track.Kind.Video ? (
        <VideoTrack 
          trackRef={trackRef} 
          className={cn(
            "w-full h-full",
            isScreenShare ? "object-contain" : "object-contain bg-black"
          )}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-[#374DA4] to-indigo-600 rounded-full flex items-center justify-center mb-3 mx-auto shadow-lg">
              <span className="text-white text-xl font-bold">
                {getParticipantName(participant).charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="text-white text-sm font-medium">
              {getParticipantName(participant)}
            </p>
          </div>
        </div>
      )}

      {/* Participant Name */}
      <div className="absolute bottom-3 left-3 bg-white/90 text-gray-800 text-sm px-3 py-1.5 rounded-lg backdrop-blur-sm font-medium shadow-sm">
        {getParticipantName(participant)}
        {isLocal && " (Você)"}
        {isScreenShare && " - Compartilhando Tela"}
      </div>

      {/* Mute Indicator */}
      {isMuted && (
        <div className="absolute top-3 left-3 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
          <MicOff className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Resize Handles */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Corner Resize Handle */}
        <div
          className={cn(
            "absolute bottom-0 right-0 w-4 h-4 bg-[#374DA4] rounded-tl-lg cursor-se-resize pointer-events-auto opacity-0 hover:opacity-100 transition-opacity",
            isResizing && "opacity-100"
          )}
          onMouseDown={handleMouseDown}
        />
        
        {/* Side Resize Handles */}
        <div
          className={cn(
            "absolute right-0 top-1/2 -translate-y-1/2 w-2 h-8 bg-[#5A74D1] rounded-l cursor-e-resize pointer-events-auto opacity-0 hover:opacity-100 transition-opacity",
            isResizing && "opacity-100"
          )}
          onMouseDown={handleMouseDown}
        />
        
        <div
          className={cn(
            "absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-2 bg-[#5A74D1] rounded-t cursor-s-resize pointer-events-auto opacity-0 hover:opacity-100 transition-opacity",
            isResizing && "opacity-100"
          )}
          onMouseDown={handleMouseDown}
        />
      </div>

      {/* Resize Indicator */}
      {isResizing && (
        <div className="absolute top-3 right-3 bg-[#374DA4] text-white text-xs px-2 py-1 rounded">
          {dimensions.width} × {dimensions.height}
        </div>
      )}
    </div>
  );
};

export default ResizableVideoTile;