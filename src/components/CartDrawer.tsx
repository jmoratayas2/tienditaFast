'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Drawer,
  List,
  Button,
  Input,
  InputNumber,
  Space,
  Typography,
  Divider,
  Alert,
  Form,
  Empty,
  Radio,
  Select,
  Card,
  Tag,
  Segmented,
  message,
} from 'antd';
import {
  DeleteOutlined,
  ShoppingOutlined,
  ClockCircleOutlined,
  ArrowRightOutlined,
  CalendarOutlined,
  FireOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import confetti from 'canvas-confetti';
import { CartItem, PickupType, PreparationMode } from '@/lib/types';
import { dataService } from '@/lib/dataService';
import { formatCurrency } from '@/lib/formatters';

const { Title, Text } = Typography;

interface CartDrawerProps {
  visible: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  visible,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
}) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  // Opciones de retiro
  const [pickupType, setPickupType] = useState<PickupType>('immediate');
  const [scheduledPickupTime, setScheduledPickupTime] = useState<string>('');

  // Verificar si hay comida que se prepara al momento
  const hasPreparedItems = useMemo(
    () => items.some((i) => i.product.is_prepared),
    [items]
  );

  // Generar horarios de recogida aproximados para hoy (cada 15 min a partir de 20 min en el futuro)
  const availableTimeSlots = useMemo(() => {
    const slots: { value: string; label: string }[] = [];
    const now = new Date();
    const startMin = now.getMinutes() + 20;
    const roundedMin = Math.ceil(startMin / 15) * 15;
    const startDate = new Date(now);
    startDate.setMinutes(roundedMin, 0, 0);

    for (let i = 0; i < 28; i++) {
      const slotDate = new Date(startDate.getTime() + i * 15 * 60 * 1000);
      const h = slotDate.getHours();
      const m = slotDate.getMinutes();
      if (h >= 22) break; // Cierre de tienda
      const hh = h.toString().padStart(2, '0');
      const mm = m.toString().padStart(2, '0');
      const time24 = `${hh}:${mm}`;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      const label = `${h12}:${mm} ${ampm} (Hoy)`;
      slots.push({ value: time24, label });
    }
    return slots;
  }, []);

  // Si se selecciona programado y no hay hora asignada, preseleccionar la primera disponible
  const effectiveScheduledTime =
    scheduledPickupTime || (availableTimeSlots.length > 0 ? availableTimeSlots[0].value : '14:00');

  const totalAmount = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const handleCheckout = async () => {
    if (items.length === 0) return;

    try {
      setLoading(true);
      const res = await dataService.createOrder(
        customerName.trim() || 'Cliente Mostrador',
        customerPhone.trim(),
        customerNotes.trim(),
        items,
        {
          pickupType,
          scheduledPickupTime: pickupType === 'scheduled' ? effectiveScheduledTime : null,
          preparationMode: hasPreparedItems ? 'on_arrival' : 'immediate',
        }
      );

      // Limpiar carrito
      onClearCart();
      onClose();

      // Efecto confetti
      try {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch {
        // Ignorar si falla confetti
      }

      message.success(`¡Pedido #${res.order_number} generado con éxito!`);
      router.push(`/order/${res.order_id}`);
    } catch (err: any) {
      message.error(err.message || 'Error al generar el pedido. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShoppingOutlined style={{ color: '#0d9488', fontSize: 20 }} />
          <span>Mi Pedido ({items.length} {items.length === 1 ? 'producto' : 'productos'})</span>
        </div>
      }
      placement="right"
      onClose={onClose}
      open={visible}
      width={470}
      footer={
        items.length > 0 && (
          <div style={{ padding: '8px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text strong style={{ fontSize: 16 }}>Total a Pagar:</Text>
              <Text strong style={{ fontSize: 22, color: '#0d9488' }}>
                {formatCurrency(totalAmount)}
              </Text>
            </div>

            <Button
              type="primary"
              size="large"
              block
              style={{ background: '#0d9488', height: 48, fontWeight: 700, fontSize: 15 }}
              icon={<ArrowRightOutlined />}
              loading={loading}
              onClick={handleCheckout}
            >
              {pickupType === 'immediate'
                ? 'Confirmar Retiro Inmediato (~10 min)'
                : `Confirmar para las ${effectiveScheduledTime}`}
            </Button>
          </div>
        )
      }
    >
      {items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Aún no has agregado productos a tu pedido."
          style={{ marginTop: 60 }}
        >
          <Button type="primary" onClick={onClose} style={{ background: '#0d9488' }}>
            Explorar Catálogo
          </Button>
        </Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ============================================================= */}
          {/* SECCIÓN 1: MODALIDAD DE RETIRO (Ahora vs Programado)          */}
          {/* ============================================================= */}
          <Card size="small" style={{ borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#0f172a' }}>
              ¿Cuándo pasarás a recoger tu pedido?
            </div>

            <Segmented
              block
              value={pickupType}
              onChange={(val) => setPickupType(val as PickupType)}
              options={[
                {
                  value: 'immediate',
                  label: (
                    <div style={{ padding: '4px 0' }}>
                      <div style={{ fontWeight: 600 }}>⚡ Ahora mismo</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Retiro en ~10 min</div>
                    </div>
                  ),
                },
                {
                  value: 'scheduled',
                  label: (
                    <div style={{ padding: '4px 0' }}>
                      <div style={{ fontWeight: 600 }}>🕒 Programar hora</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>Pasar más tarde hoy</div>
                    </div>
                  ),
                },
              ]}
            />

            {/* Selector de Hora si es Programado */}
            {pickupType === 'scheduled' ? (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#ffffff', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>
                  Selecciona la hora aproximada de recogida:
                </Text>
                <Select
                  style={{ width: '100%' }}
                  value={effectiveScheduledTime}
                  onChange={setScheduledPickupTime}
                  options={availableTimeSlots}
                  suffixIcon={<CalendarOutlined style={{ color: '#0d9488' }} />}
                  placeholder="Elige tu horario de retiro hoy..."
                />
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                  * Tu pedido quedará apartado para esa hora. No se vencerá a los 10 minutos habituales.
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 10 }}>
                💡 <strong>Retiro Inmediato:</strong> El pedido se reserva de inmediato con un temporizador de 10 minutos para retirarlo en tienda.
              </div>
            )}
          </Card>

          {/* ============================================================= */}
          {/* SECCIÓN 2: POLÍTICA DE COMIDA PREPARADA (Cero desperdicios)   */}
          {/* ============================================================= */}
          {hasPreparedItems && (
            <Card
              size="small"
              style={{
                borderRadius: 12,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: '#166534', fontWeight: 700, fontSize: 13 }}>
                <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 16 }} />
                <span>🍳 Preparación fresca al presentarte en mostrador</span>
              </div>
              <div style={{ fontSize: 12, color: '#15803d', lineHeight: 1.4 }}>
                Tu pedido incluye comida que se prepara al momento. Para garantizar que la recibas <strong>caliente, recién hecha y evitar cualquier desperdicio de comida</strong>, la cocina comenzará a prepararla en cuanto te presentes a la tienda y menciones tu número de pedido.
              </div>
            </Card>
          )}

          {/* ============================================================= */}
          {/* SECCIÓN 3: LISTA DE PRODUCTOS                                 */}
          {/* ============================================================= */}
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#0f172a' }}>
              Artículos seleccionados:
            </div>
            <List
              itemLayout="horizontal"
              dataSource={items}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button
                      key="del"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => onRemoveItem(item.product.id)}
                    />,
                  ]}
                  style={{ padding: '8px 0' }}
                >
                  <List.Item.Meta
                    title={
                      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{item.product.name}</span>
                        {item.product.is_prepared && (
                          <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>
                            🍳 Preparado
                          </Tag>
                        )}
                      </div>
                    }
                    description={
                      <Space direction="vertical" size={2}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>
                          {formatCurrency(item.product.price)} c/u
                        </span>
                        <Space direction="horizontal" size={8}>
                          <InputNumber
                            min={1}
                            max={item.product.stock}
                            value={item.quantity}
                            onChange={(val) =>
                              onUpdateQuantity(item.product.id, val || 1)
                            }
                            size="small"
                            style={{ width: 60 }}
                          />
                          <span style={{ fontWeight: 600, color: '#0f172a' }}>
                            = {formatCurrency(item.product.price * item.quantity)}
                          </span>
                        </Space>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </div>

          <Divider style={{ margin: '4px 0' }} />

          {/* ============================================================= */}
          {/* SECCIÓN 4: DATOS DEL CLIENTE                                  */}
          {/* ============================================================= */}
          <div>
            <Title level={5} style={{ margin: '0 0 12px 0', fontSize: 14 }}>
              Datos de Retiro en Mostrador
            </Title>
            <Form layout="vertical" size="small">
              <Form.Item label="Nombres y Apellidos del Cliente:">
                <Input
                  placeholder="Ej: Carlos Morales (Para llamarte al retirar)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </Form.Item>
              <Form.Item label="Teléfono / WhatsApp:">
                <Input
                  placeholder="Ej: 5555-5555 (Para avisarte de tu pedido)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </Form.Item>
              <Form.Item label="Indicaciones especiales:">
                <Input.TextArea
                  rows={2}
                  placeholder="Ej: Salsa aparte, sin cebolla, etc."
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                />
              </Form.Item>
            </Form>
          </div>
        </div>
      )}
    </Drawer>
  );
};
