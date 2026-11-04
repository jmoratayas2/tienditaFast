'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, Button, Input, Space, Alert, Typography } from 'antd';
import {
  ScanOutlined,
  CheckCircleOutlined,
  CameraOutlined,
} from '@ant-design/icons';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const { Text } = Typography;

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
}

// Reproducir beep nativo usando Web Audio API con protección total
function playScanBeep() {
  try {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
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
    osc.stop(ctx.currentTime + 0.1);
  } catch {
    // Silencioso en caso de restricciones de autoplay
  }
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  visible,
  onClose,
  onScan,
  title = 'Escanear Código de Barras / QR',
}) => {
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);

  // ID único para cada instancia para evitar colisiones en el DOM
  const containerIdRef = useRef(`scanner-box-${Math.random().toString(36).substring(2, 9)}`);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isCancelledRef = useRef(false);
  const isStartingRef = useRef(false);

  // Detener el escáner y la cámara de forma 100% segura
  const safeStopScanner = useCallback(async () => {
    isCancelledRef.current = true;
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setIsScanning(false);

    // 1. Apagar directamente las pistas de video activas en el hardware del dispositivo
    try {
      const container = document.getElementById(containerIdRef.current);
      if (container) {
        const video = container.querySelector('video') as HTMLVideoElement | null;
        if (video && video.srcObject) {
          const stream = video.srcObject as MediaStream;
          stream.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch {}
          });
          video.srcObject = null;
        }
      }
    } catch {}

    // 2. Detener Html5Qrcode si está activo
    if (scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch (err) {
        // Ignorar errores normales de transición al detener
      }

      // 3. Limpiar el contenedor sólo si aún existe en el DOM
      try {
        const container = document.getElementById(containerIdRef.current);
        if (container) {
          scanner.clear();
          container.innerHTML = '';
        }
      } catch (err) {
        // Ignorar
      }
    }
  }, []);

  // Manejar el cierre controlado de la ventana
  const handleControlledClose = async () => {
    if (stopping) return;
    setStopping(true);
    try {
      await safeStopScanner();
    } finally {
      setStopping(false);
      setLastScanned(null);
      setCameraError(null);
      onClose();
    }
  };

  useEffect(() => {
    if (!visible) {
      safeStopScanner();
      return;
    }

    isCancelledRef.current = false;
    let timer: NodeJS.Timeout | null = null;

    const startScanner = async () => {
      try {
        setCameraError(null);
        isStartingRef.current = true;

        // Esperar a que el contenedor esté renderizado y visible en el DOM
        await new Promise((resolve) => {
          timer = setTimeout(resolve, 350);
        });

        if (isCancelledRef.current) return;

        const container = document.getElementById(containerIdRef.current);
        if (!container) return;

        const html5QrCode = new Html5Qrcode(containerIdRef.current, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
          verbose: false,
        });

        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: { width: 260, height: 180 },
            aspectRatio: 1.333333,
          },
          (decodedText) => {
            playScanBeep();
            setLastScanned(decodedText);
            onScan(decodedText);
          },
          () => {
            // Escaneo continuo normal
          }
        );

        if (isCancelledRef.current) {
          await safeStopScanner();
          return;
        }

        setIsScanning(true);
      } catch (err: any) {
        if (isCancelledRef.current) return;
        console.warn('Acceso a cámara no disponible o cancelado:', err);
        setCameraError(
          err.message ||
            'No se pudo iniciar la cámara. Verifica los permisos de cámara en tu navegador o escribe el código manualmente.'
        );
      } finally {
        isStartingRef.current = false;
      }
    };

    startScanner();

    return () => {
      if (timer) clearTimeout(timer);
      safeStopScanner();
    };
  }, [visible, safeStopScanner, onScan]);

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) return;
    playScanBeep();
    setLastScanned(code);
    onScan(code);
    setManualCode('');
  };

  return (
    <Modal
      open={visible}
      onCancel={handleControlledClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ScanOutlined style={{ color: '#0d9488', fontSize: 20 }} />
          <span>{title}</span>
        </div>
      }
      footer={[
        <Button
          key="close"
          onClick={handleControlledClose}
          loading={stopping}
        >
          Cerrar Escáner
        </Button>,
      ]}
      width={460}
      maskClosable={false}
      // NO USAR destroyOnClose para evitar destruir el nodo mientras la cámara se apaga
    >
      <div style={{ padding: '8px 0' }}>
        {/* Contenedor del Visor de Cámara */}
        <div
          id={containerIdRef.current}
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
            color: '#94a3b8',
          }}
        >
          {!isScanning && !cameraError && (
            <div style={{ textAlign: 'center', padding: 20 }}>
              <CameraOutlined style={{ fontSize: 32, marginBottom: 8 }} />
              <div>Iniciando cámara...</div>
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

        {/* Alerta de permisos si falló */}
        {cameraError && (
          <Alert
            type="warning"
            showIcon
            message="Cámara no disponible"
            description={cameraError}
            style={{ marginTop: 12 }}
          />
        )}

        {/* Entrada manual / Lector USB */}
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
      </div>
    </Modal>
  );
};
