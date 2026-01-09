import { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, CameraOff, RefreshCw, SwitchCamera } from 'lucide-react';
import { toast } from 'sonner';

interface CameraCaptureProps {
  onCapture: (imageBase64: string) => void;
  isProcessing?: boolean;
}

export function CameraCapture({ onCapture, isProcessing }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      
      setStream(mediaStream);
      setIsActive(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Could not access camera. Please grant camera permissions.');
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsActive(false);
  }, [stream]);

  const switchCamera = useCallback(() => {
    stopCamera();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  }, [stopCamera]);

  useEffect(() => {
    if (isActive && !stream) {
      startCamera();
    }
  }, [facingMode, isActive, stream, startCamera]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Mirror the image for front camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, 0, 0);
    
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);
    onCapture(imageBase64);
  }, [facingMode, onCapture]);

  return (
    <Card className="p-4 bg-card">
      <div className="relative aspect-video bg-muted rounded-lg overflow-hidden mb-4">
        {isActive ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Camera className="w-12 h-12" />
          </div>
        )}
        
        {isProcessing && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2 text-foreground">Processing...</span>
          </div>
        )}
      </div>
      
      <canvas ref={canvasRef} className="hidden" />
      
      <div className="flex gap-2">
        {!isActive ? (
          <Button onClick={startCamera} className="flex-1">
            <Camera className="w-4 h-4 mr-2" />
            Start Camera
          </Button>
        ) : (
          <>
            <Button onClick={stopCamera} variant="outline" size="icon">
              <CameraOff className="w-4 h-4" />
            </Button>
            <Button onClick={switchCamera} variant="outline" size="icon">
              <SwitchCamera className="w-4 h-4" />
            </Button>
            <Button 
              onClick={captureImage} 
              className="flex-1"
              disabled={isProcessing}
            >
              <Camera className="w-4 h-4 mr-2" />
              Capture & Recognize
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
