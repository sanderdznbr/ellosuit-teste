import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Play, Pause, Volume2, VolumeX, Maximize, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface TrackingData {
  sessionId: string;
  videoId: string;
  enteredAt: string;
  playCount: number;
  pauseCount: number;
  totalWatchTime: number;
  totalPauseTime: number;
  percentWatched: number;
  seekCount: number;
  lastPosition: number;
  completedWatch: boolean;
}

const PublicVideoPlayer: React.FC = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  // Tracking state
  const [tracking, setTracking] = useState<TrackingData>({
    sessionId: Math.random().toString(36).substring(7),
    videoId: videoId || '',
    enteredAt: new Date().toISOString(),
    playCount: 0,
    pauseCount: 0,
    totalWatchTime: 0,
    totalPauseTime: 0,
    percentWatched: 0,
    seekCount: 0,
    lastPosition: 0,
    completedWatch: false
  });
  
  const watchStartRef = useRef<number | null>(null);
  const pauseStartRef = useRef<number | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track page visibility and exit
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        sendTrackingData('page_hidden');
      }
    };

    const handleBeforeUnload = () => {
      sendTrackingData('page_exit');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      sendTrackingData('page_exit');
    };
  }, [tracking]);

  // Load video data (demo)
  useEffect(() => {
    // In a real app, fetch video data from database
    // For demo, we'll use a placeholder video
    setTimeout(() => {
      setVideoUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
      setVideoTitle('Demo Video');
      setLoading(false);
    }, 1000);
  }, [videoId]);

  // Hide controls after inactivity
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false);
        }
      }, 3000);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      return () => container.removeEventListener('mousemove', handleMouseMove);
    }
  }, [isPlaying]);

  const sendTrackingData = (event: string) => {
    // Calculate final stats
    const finalTracking = { ...tracking };
    
    if (isPlaying && watchStartRef.current) {
      finalTracking.totalWatchTime += (Date.now() - watchStartRef.current) / 1000;
    }
    if (!isPlaying && pauseStartRef.current) {
      finalTracking.totalPauseTime += (Date.now() - pauseStartRef.current) / 1000;
    }

    console.log(`[Tracking] Event: ${event}`, {
      ...finalTracking,
      exitedAt: new Date().toISOString(),
      timeOnPage: (Date.now() - new Date(tracking.enteredAt).getTime()) / 1000
    });

    // In production, send to your tracking endpoint
    // await fetch('/api/track-video', { method: 'POST', body: JSON.stringify(finalTracking) });
  };

  const handlePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleVideoPlay = () => {
    setIsPlaying(true);
    watchStartRef.current = Date.now();
    
    if (pauseStartRef.current) {
      setTracking(prev => ({
        ...prev,
        totalPauseTime: prev.totalPauseTime + (Date.now() - pauseStartRef.current!) / 1000,
        playCount: prev.playCount + 1
      }));
      pauseStartRef.current = null;
    } else {
      setTracking(prev => ({ ...prev, playCount: prev.playCount + 1 }));
    }
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
    pauseStartRef.current = Date.now();
    
    if (watchStartRef.current) {
      setTracking(prev => ({
        ...prev,
        totalWatchTime: prev.totalWatchTime + (Date.now() - watchStartRef.current!) / 1000,
        pauseCount: prev.pauseCount + 1
      }));
      watchStartRef.current = null;
    } else {
      setTracking(prev => ({ ...prev, pauseCount: prev.pauseCount + 1 }));
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    setCurrentTime(video.currentTime);
    
    const percent = duration > 0 ? (video.currentTime / duration) * 100 : 0;
    setTracking(prev => ({
      ...prev,
      percentWatched: Math.max(prev.percentWatched, percent),
      lastPosition: video.currentTime,
      completedWatch: percent >= 90
    }));
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = value[0];
    setTracking(prev => ({ ...prev, seekCount: prev.seekCount + 1 }));
  };

  const handleVolumeChange = (value: number[]) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = value[0];
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.volume = volume || 1;
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p>Carregando vídeo...</p>
        </div>
      </div>
    );
  }

  if (!videoUrl) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-xl">Vídeo não encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-black flex items-center justify-center cursor-pointer"
      onClick={handlePlay}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-contain"
        onPlay={handleVideoPlay}
        onPause={handleVideoPause}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => sendTrackingData('video_completed')}
      />

      {/* Controls Overlay */}
      <div 
        className={`absolute inset-0 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent">
          <h1 className="text-white text-xl font-medium">{videoTitle}</h1>
        </div>

        {/* Center Play Button */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              size="lg"
              className="rounded-full w-20 h-20 bg-white/20 hover:bg-white/30 backdrop-blur-sm"
              onClick={handlePlay}
            >
              <Play className="h-10 w-10 text-white fill-white" />
            </Button>
          </div>
        )}

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          {/* Progress Bar */}
          <div className="mb-4">
            <Slider
              value={[currentTime]}
              max={duration}
              step={0.1}
              onValueChange={handleSeek}
              className="w-full"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Play/Pause */}
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={handlePlay}
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6" />
                )}
              </Button>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={toggleMute}
                >
                  {isMuted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.1}
                  onValueChange={handleVolumeChange}
                  className="w-24"
                />
              </div>

              {/* Time */}
              <span className="text-white text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Fullscreen */}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={toggleFullscreen}
            >
              <Maximize className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicVideoPlayer;
