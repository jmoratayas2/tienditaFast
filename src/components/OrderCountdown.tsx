'use client';

import React, { useEffect, useState } from 'react';
import { Card, Progress, Space, Alert, Typography } from 'antd';
import { ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { calculateRemainingSeconds, formatCountdown } from '@/lib/formatters';

const { Title, Text } = Typography;

interface OrderCountdownProps {
  expiresAt: string;
  onExpire?: () => void;
  status: string;
}

export const OrderCountdown: React.FC<OrderCountdownProps> = ({
  expiresAt,
  onExpire,
  status,
}) => {
  const [remaining, setRemaining] = useState<number>(() =>
    calculateRemainingSeconds(expiresAt)
  );

  useEffect(() => {
    // Si el pedido no está en estado pendiente, no correr el temporizador
    if (status !== 'pending') return;

    const timer = setInterval(() => {
      const secs = calculateRemainingSeconds(expiresAt);
      setRemaining(secs);

      if (secs <= 0) {
        clearInterval(timer);
        if (onExpire) {
          onExpire();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, status, onExpire]);

  // Si ya no está pendiente:
  if (status === 'dispatched') {
    return (
      <Alert
        message="¡Pedido Despachado y Entregado!"
        description="Este pedido ya fue procesado y entregado satisfactoriamente."
        type="success"
        showIcon
        style={{ marginBottom: 20 }}
      />
    );
  }

  if (status === 'cancelled') {
    return (
      <Alert
        message="Pedido Cancelado / Anulado"
        description="Este pedido fue anulado y el inventario fue reintegrado a la tienda."
        type="error"
        showIcon
        style={{ marginBottom: 20 }}
      />
    );
  }

  if (status === 'expired' || remaining <= 0) {
    return (
      <Alert
        message="Tiempo Límite Expirado (10 minutos)"
        description="El plazo de 10 minutos para retirar tu pedido venció. El pedido se canceló automáticamente y los productos se reintegraron al stock disponible."
        type="warning"
        showIcon
        style={{ marginBottom: 20 }}
      />
    );
  }

  // 10 minutos = 600 segundos
  const totalSeconds = 10 * 60;
  const percent = Math.min(100, Math.max(0, Math.round((remaining / totalSeconds) * 100)));

  let colorClass = 'timer-normal';
  let progressStrokeColor = '#10b981';
  let messageText = 'Tienes tiempo para pasar por el mostrador.';

  if (remaining < 120) {
    colorClass = 'timer-urgent';
    progressStrokeColor = '#ef4444';
    messageText = '¡Apresúrate! Quedan menos de 2 minutos para recogerlo.';
  } else if (remaining < 300) {
    colorClass = 'timer-warning';
    progressStrokeColor = '#f59e0b';
    messageText = 'Tu pedido está apartado. Pasa pronto al mostrador.';
  }

  return (
    <div className="timer-hero-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <Progress
          type="circle"
          percent={percent}
          size={84}
          strokeColor={progressStrokeColor}
          trailColor="rgba(255, 255, 255, 0.15)"
          format={() => (
            <ClockCircleOutlined
              style={{ fontSize: 28, color: progressStrokeColor }}
            />
          )}
        />
        <div>
          <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8' }}>
            Tiempo restante para retirar
          </div>
          <div className={`timer-countdown-display ${colorClass}`}>
            {formatCountdown(remaining)}
          </div>
          <div style={{ fontSize: 13, color: '#cbd5e1', marginTop: 4 }}>
            {messageText}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 300, textAlign: 'right' }}>
        <Text style={{ color: '#94a3b8', fontSize: 12 }}>
          * Si no recoges tu pedido antes de que el contador llegue a 00:00, se anulará automáticamente para liberar el inventario.
        </Text>
      </div>
    </div>
  );
};

