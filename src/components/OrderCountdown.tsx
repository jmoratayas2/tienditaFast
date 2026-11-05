'use client';

import React, { useEffect, useState } from 'react';
import { Progress, Alert, Typography, Tag } from 'antd';
import {
  ClockCircleOutlined,
  CalendarOutlined,
  FireOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { calculateRemainingSeconds, formatCountdown } from '@/lib/formatters';
import { PickupType, PreparationMode } from '@/lib/types';

const { Text } = Typography;

interface OrderCountdownProps {
  expiresAt: string;
  onExpire?: () => void;
  status: string;
  pickupType?: PickupType;
  scheduledPickupTime?: string | null;
  preparationMode?: PreparationMode;
  orderNumber?: string;
}

export const OrderCountdown: React.FC<OrderCountdownProps> = ({
  expiresAt,
  onExpire,
  status,
  pickupType = 'immediate',
  scheduledPickupTime,
  preparationMode,
  orderNumber,
}) => {
  const [remaining, setRemaining] = useState<number>(() =>
    calculateRemainingSeconds(expiresAt)
  );

  useEffect(() => {
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
        message="Tiempo Límite Expirado"
        description={
          pickupType === 'scheduled'
            ? `El plazo para retirar tu pedido programado de las ${scheduledPickupTime || ''} ha expirado. El pedido fue cancelado y los artículos regresaron al stock.`
            : 'El plazo de 10 minutos para retirar tu pedido venció. El pedido se canceló automáticamente y los productos se reintegraron al stock disponible.'
        }
        type="warning"
        showIcon
        style={{ marginBottom: 20 }}
      />
    );
  }

  // Si es un pedido programado por hora
  if (pickupType === 'scheduled') {
    return (
      <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            padding: '18px 24px',
            borderRadius: 14,
            color: '#ffffff',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: '#0d9488',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                color: '#ffffff',
                flexShrink: 0,
              }}
            >
              <CalendarOutlined />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.8, color: '#94a3b8', fontWeight: 600 }}>
                  Recogida Programada
                </span>
                <Tag color="cyan" style={{ margin: 0, fontWeight: 700 }}>
                  Hoy {scheduledPickupTime}
                </Tag>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc', marginTop: 2 }}>
                Pasar a las {scheduledPickupTime} hrs
              </div>
              <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 2 }}>
                Tiempo restante para tu horario: <strong>{formatCountdown(remaining)}</strong> (Cortesía extendida)
              </div>
            </div>
          </div>

          <div style={{ maxWidth: 280, textAlign: 'right' }}>
            <Text style={{ color: '#94a3b8', fontSize: 11 }}>
              * Tus productos están apartados para la hora acordada. No se cancelarán a los 10 minutos.
            </Text>
          </div>
        </div>

        {/* Aviso de preparación al llegar si aplica */}
        {preparationMode === 'on_arrival' && (
          <Alert
            message="🍳 Comida Preparada al Momento"
            description={`Al llegar a la tienda, indícale al cajero tu número de pedido #${orderNumber || ''} para que comiencen a preparar tu comida caliente y fresca de inmediato. ¡Así garantizamos comida recién hecha sin desperdicios!`}
            type="info"
            showIcon
            icon={<FireOutlined style={{ color: '#d97706' }} />}
            style={{ borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a' }}
          />
        )}
      </div>
    );
  }

  // Pedido Inmediato (~10 min)
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
    <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
              Tiempo restante para retirar (~10 min)
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

      {/* Aviso de preparación al llegar si aplica */}
      {preparationMode === 'on_arrival' && (
        <Alert
          message="🍳 Comida Preparada al Momento"
          description={`Al llegar a la tienda, indícale al cajero tu número de pedido #${orderNumber || ''} para que comiencen a preparar tu comida caliente y fresca en el mostrador.`}
          type="info"
          showIcon
          icon={<FireOutlined style={{ color: '#d97706' }} />}
          style={{ borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a' }}
        />
      )}
    </div>
  );
};
