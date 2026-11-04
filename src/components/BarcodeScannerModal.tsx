'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Modal, Button, Input, Space, Alert, Typography } from 'antd';
import {
  ScanOutlined,
  CameraOutlined,
  CloseOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

const { Text } = Typography;

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
}

// Reproducir beep nativo usando Web Audio API
function playScanBeep() {
  try {
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
    // ignore
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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const readerElementId = 'html5-barcode-scanner-viewport';

  useEffect(() => {
    if (!visible) {
      stopScanner();
      setLastScanned(null);
      setCameraError(null);
      return;
    }

    let isMounted = true;

    const startScanner = async () => {
      try {
        setCameraError(null);
        // Esperar a que el elemento del DOM exista en el modal
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (!isMounted) return;

        const html5QrCode = new Html5Qrcode(readerElementId, {
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
            // escaneo continuo sin error
          }
        );

        if (isMounted) setIsScanning(true);
      } catch (err: any) {
        if (!isMounted) return;
        console.warn('Error inicializando cámara:', err);
        setCameraError(
          err.message ||
            'No se pudo acceder a la cámara. Por favor autoriza el permiso de cámara en tu navegador o ingresa el código manualmente.'
        );
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [visible]);

  const stopScanner = () => {
    if (scannerRef.current) {
      if (scannerRef.current.isScanning) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .then(() => {
            scannerRef.current?.clear();
            scannerRef.current = null;
            setIsScanning(false);
          });
      } else {
        scannerRef.current.clear();
        scannerRef.current = null;
        setIsScanning(false);
      }
    }
  };

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
      onCancel={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ScanOutlined style={{ color: '#0d9488', fontSize: 20 }} />
          <span>{title}</span>
        </div>
      }
      footer={[
        <Button key="close" onClick={onClose}>
          Cerrar Escáner
        </Button>,
      ]}
      width={460}
      destroyOnClose
    >
      <div style={{ padding: '8px 0' }}>
        {/* Viewport de Cámara */}
        <div
          id={readerElementId}
          style={{
            width: '100%',
            minHeight: 250,
            borderRadius: 12,
            overflow: 'hidden',
            backgroundColor: '#000000',
            position: 'relative',
          }}
        />

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

        {cameraError && (
          <Alert
            type="warning"
            showIcon
            message="Acceso a Cámara no disponible"
            description={cameraError}
            style={{ marginTop: 12 }}
          />
        )}

        {/* Input manual rápido (para lector USB o teclado) */}
        <div style={{ marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            O escribe o escanea con pistola USB/Bluetooth:
          </Text>
          <Space.Compact style={{ width: '100%', marginTop: 4 }}>
            <Input
              placeholder="Código de barra (ej: 7401001) o ID..."
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

