'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, Button, Input, Space, Alert, Typography } from 'antd';
import {
  ScanOutlined,
  CheckCircleOutlined,
  CameraOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
}

// Web Audio API beep
function playScanBeep() {
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1040, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } catch {
    // Silencioso en caso de restricciones de autoplay
  }
}

// React Error Boundary para blindar contra cualquier excepción de hardware/navegador
interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class ScannerErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset?: () => void },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; onReset?: () => void }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage:
        error?.message ||
        'Ocurrió una incompatibilidad con el controlador de video en este navegador.',
    };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.warn('ScannerErrorBoundary capturó excepción:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '16px 0' }}>
          <Alert
            type="warning"
            showIcon
            message="No se pudo iniciar la cámara en este dispositivo"
            description={this.state.errorMessage}
            style={{ marginBottom: 16 }}
          />
        </div>
      );
    }
    return this.props.children;
  }
}

function getFriendlyErrorMessage(err: any): string {
  const msg = (err?.message || String(err || '')).toLowerCase();
  if (msg.includes('permission') || msg.includes('notallowederror')) {
    return 'Permiso de cámara denegado. Permite el acceso a la cámara en la barra de direcciones de tu navegador o escribe el código manualmente.';
  }
  if (msg.includes('notfounderror') || msg.includes('devices not found')) {
    return 'No se detectó ninguna cámara disponible en tu dispositivo.';
  }
  if (
    msg.includes('notreadableerror') ||
    msg.includes('trackstarterror') ||
    msg.includes('in use')
  ) {
    return 'La cámara está siendo ocupada por otra app o pestaña del navegador.';
  }
  if (msg.includes('secure') || msg.includes('https')) {
    return 'El navegador requiere conexión HTTPS para activar la cámara.';
  }
  return 'No fue posible abrir el visor de cámara en este navegador. Puedes escribir el código de barra o nombre del producto abajo.';
}

const ScannerContent: React.FC<BarcodeScannerModalProps & { onRequestClose: () => void }> = ({
  onClose,
  onScan,
  onRequestClose,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // ID único y fijo para esta instancia de escaneo
  const containerIdRef = useRef(
    `scanner-viewport-${Math.random().toString(36).substring(2, 9)}`
  );
  const scannerRef = useRef<any>(null);
  const isCancelledRef = useRef(false);
  const lastScannedTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');

  // Detener la cámara de forma 100% segura
  const safeStopScanner = useCallback(async () => {
    isCancelledRef.current = true;
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setIsScanning(false);

    // 1. Detener pistas de hardware de video directamente en el DOM
    try {
      const container = document.getElementById(containerIdRef.current);
      if (container) {
        const videos = container.querySelectorAll('video');
        videos.forEach((video) => {
          if (video && video.srcObject) {
            const stream = video.srcObject as MediaStream;
            stream.getTracks().forEach((track) => {
              try {
                track.stop();
              } catch {}
            });
            video.srcObject = null;
          }
        });
      }
    } catch {}

    // 2. Detener y limpiar la instancia de Html5Qrcode si estaba activa
    if (scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch {}
      try {
        scanner.clear();
      } catch {}
    }
  }, []);

  const handleControlledClose = useCallback(async () => {
    await safeStopScanner();
    onRequestClose();
  }, [safeStopScanner, onRequestClose]);

  // Manejo de lectura exitosa con debouncing
  const handleDecodedText = useCallback(
    (decodedText: string) => {
      const code = decodedText.trim();
      if (!code) return;

      const now = Date.now();
      // Evitar lecturas duplicadas en ráfaga (menos de 1.5s para el mismo código)
      if (
        code === lastScannedCodeRef.current &&
        now - lastScannedTimeRef.current < 1500
      ) {
        return;
      }

      lastScannedTimeRef.current = now;
      lastScannedCodeRef.current = code;

      playScanBeep();
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(70);
        }
      } catch {}

      setLastScanned(code);
      onScan(code);
    },
    [onScan]
  );

  useEffect(() => {
    isCancelledRef.current = false;
    let timer: NodeJS.Timeout | null = null;

    const startScanner = async () => {
      try {
        setCameraError(null);

        // Esperar a que el contenedor esté renderizado y visible en el DOM
        await new Promise((resolve) => {
          timer = setTimeout(resolve, 350);
        });

        if (isCancelledRef.current) return;

        // Validar soporte de getUserMedia
        if (
          typeof navigator === 'undefined' ||
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          setCameraError(
            'Tu navegador no admite acceso a la cámara en este entorno o requiere HTTPS.'
          );
          return;
        }

        const container = document.getElementById(containerIdRef.current);
        if (!container || isCancelledRef.current) return;

        // Carga dinámica de html5-qrcode para evitar problemas de SSR o empaquetado
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import(
          'html5-qrcode'
        );

        if (isCancelledRef.current) return;

        // IMPORTANTE: useBarCodeDetectorIfSupported: false desactiva el BarcodeDetector
        // nativo de Android/Chrome que lanza excepciones no controladas en navegadores móviles.
        // Utiliza el motor ZXing puro garantizando 100% de compatibilidad móvil y escritorio.
        const html5QrCode = new Html5Qrcode(containerIdRef.current, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.ITF,
          ],
          useBarCodeDetectorIfSupported: false,
          verbose: false,
        });

        scannerRef.current = html5QrCode;

        const scanConfig = {
          fps: 15,
          qrbox: { width: 260, height: 180 },
          aspectRatio: 1.333333,
        };

        // Intento 1: Cámara trasera (ideal para escanear en celular)
        try {
          await html5QrCode.start(
            { facingMode: 'environment' },
            scanConfig,
            handleDecodedText,
            () => {}
          );
        } catch (envError) {
          if (isCancelledRef.current) return;
          console.warn('Cámara trasera no disponible, probando cámara estándar:', envError);

          // Intento 2: Cualquier cámara disponible (modo usuario/frontal o predeterminada)
          await html5QrCode.start(
            { facingMode: 'user' },
            scanConfig,
            handleDecodedText,
            () => {}
          );
        }

        if (isCancelledRef.current) {
          await safeStopScanner();
          return;
        }

        setIsScanning(true);
      } catch (err: any) {
        if (isCancelledRef.current) return;
        console.warn('Error al iniciar cámara de escáner:', err);
        setCameraError(getFriendlyErrorMessage(err));
      }
    };

    startScanner();

    return () => {
      if (timer) clearTimeout(timer);
      safeStopScanner();
    };
  }, [retryCount, handleDecodedText, safeStopScanner]);

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) return;
    playScanBeep();
    setLastScanned(code);
    onScan(code);
    setManualCode('');
  };

  return (
    <div style={{ padding: '8px 0' }}>
      {/* Contenedor del visor de cámara */}
      <div
        style={{
          width: '100%',
          minHeight: 250,
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: '#0f172a',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* IMPORTANTE: El div donde html5-qrcode inyecta el video debe mantenerse
            completamente vacío sin hijos de React para evitar desincronización de reconciliación DOM */}
        <div
          id={containerIdRef.current}
          style={{
            width: '100%',
            height: '100%',
            minHeight: 250,
          }}
        />

        {/* Capa visual de estado "Iniciando cámara..." (renderizada fuera del contenedor del escáner) */}
        {!isScanning && !cameraError && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#0f172a',
              color: '#94a3b8',
              zIndex: 2,
              pointerEvents: 'none',
            }}
          >
            <CameraOutlined style={{ fontSize: 36, color: '#0d9488', marginBottom: 10 }} />
            <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>
              Iniciando cámara...
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
              Apunta al código de barras o QR
            </div>
          </div>
        )}
      </div>

      {/* Indicador de último escaneado */}
      {lastScanned && (
        <div
          style={{
            marginTop: 10,
            padding: '8px 12px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 16 }} />
          <Text style={{ color: '#166534', fontSize: 13, fontWeight: 600 }}>
            Último escaneado: {lastScanned}
          </Text>
        </div>
      )}

      {/* Alerta si la cámara no está disponible */}
      {cameraError && (
        <Alert
          type="warning"
          showIcon
          message="Cámara no disponible"
          description={cameraError}
          action={
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => setRetryCount((c) => c + 1)}
            >
              Reintentar
            </Button>
          }
          style={{ marginTop: 12 }}
        />
      )}

      {/* Entrada manual / Lector USB o Bluetooth */}
      <div style={{ marginTop: 16 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          O escribe o escanea con lector USB / Bluetooth:
        </Text>
        <Space.Compact style={{ width: '100%', marginTop: 4 }}>
          <Input
            placeholder="Código de barra (ej: 7401001) o nombre..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onPressEnter={handleManualSubmit}
            prefix={<ScanOutlined style={{ color: '#94a3b8' }} />}
            allowClear
          />
          <Button
            type="primary"
            style={{ background: '#0d9488' }}
            onClick={handleManualSubmit}
          >
            Agregar
          </Button>
        </Space.Compact>
      </div>

      {/* Botón de cierre en el cuerpo */}
      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <Button onClick={handleControlledClose}>
          Cerrar Escáner
        </Button>
      </div>
    </div>
  );
};

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onClose,
  onScan,
  title = 'Escanear Código de Barras / QR',
}) => {
  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ScanOutlined style={{ color: '#0d9488', fontSize: 20 }} />
          <span>{title}</span>
        </div>
      }
      footer={null}
      width={460}
      maskClosable={false}
      destroyOnClose
    >
      <ScannerErrorBoundary onReset={onClose}>
        {visible && (
          <ScannerContent
            visible={visible}
            onClose={onClose}
            onScan={onScan}
            title={title}
            onRequestClose={onClose}
          />
        )}
      </ScannerErrorBoundary>
    </Modal>
  );
};
