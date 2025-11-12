
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Barcode, Camera, CameraOff } from 'lucide-react';

interface BarcodeScannerProps {
  onBarcodeDetected: (barcode: string) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onBarcodeDetected }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState('');
  const [isQuaggaRunning, setIsQuaggaRunning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setIsScanning(true);
        startBarcodeDetection();
      }
    } catch (error) {
      console.error('Erro ao acessar câmera:', error);
      alert('Erro ao acessar a câmera. Verifique as permissões.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsScanning(false);
    }
  };

  const stopQuagga = () => {
    if (typeof window !== 'undefined' && window.Quagga && isQuaggaRunning) {
      try {
        window.Quagga.stop();
        setIsQuaggaRunning(false);
        console.log('Quagga parado com sucesso');
      } catch (error) {
        console.error('Erro ao parar Quagga:', error);
        setIsQuaggaRunning(false);
      }
    }
  };

  const startBarcodeDetection = () => {
    if (typeof window !== 'undefined' && window.Quagga && !isQuaggaRunning) {
      window.Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: videoRef.current,
          constraints: {
            width: 640,
            height: 480,
            facingMode: "environment"
          },
        },
        decoder: {
          readers: [
            "code_128_reader",
            "ean_reader",
            "ean_8_reader",
            "code_39_reader",
            "code_39_vin_reader",
            "codabar_reader",
            "upc_reader",
            "upc_e_reader"
          ]
        },
      }, (err: any) => {
        if (err) {
          console.log('Erro ao inicializar Quagga:', err);
          return;
        }
        window.Quagga.start();
        setIsQuaggaRunning(true);
        console.log('Quagga iniciado com sucesso');
      });

      window.Quagga.onDetected((data: any) => {
        const code = data.codeResult.code;
        setScanResult(code);
        onBarcodeDetected(code);
        setIsOpen(false);
        stopQuagga();
        stopCamera();
      });
    }
  };

  const handleManualSubmit = () => {
    if (manualBarcode.trim()) {
      onBarcodeDetected(manualBarcode.trim());
      setManualBarcode('');
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (isOpen && !isScanning) {
      startCamera();
    } else if (!isOpen) {
      stopQuagga();
      stopCamera();
    }

    return () => {
      stopQuagga();
      stopCamera();
    };
  }, [isOpen]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopQuagga();
      stopCamera();
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Barcode className="w-4 h-4 mr-2" />
          Código de Barras
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ler Código de Barras</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Câmera Scanner</Label>
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-48 bg-gray-100 rounded border"
              />
              {isScanning && (
                <div className="absolute inset-0 border-2 border-red-500 rounded">
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 animate-pulse"></div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={isScanning ? () => { stopQuagga(); stopCamera(); } : startCamera}
              >
                {isScanning ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                {isScanning ? 'Parar' : 'Iniciar'} Câmera
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {isScanning ? 'Aponte para o código de barras' : 'Clique para iniciar a câmera'}
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="manual-barcode">Ou digite manualmente:</Label>
            <div className="flex gap-2">
              <Input
                id="manual-barcode"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                placeholder="Digite o código de barras"
                onKeyPress={(e) => e.key === 'Enter' && handleManualSubmit()}
              />
              <Button onClick={handleManualSubmit}>OK</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScanner;
