'use client';

import React, { useState } from 'react';
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
  message,
} from 'antd';
import {
  DeleteOutlined,
  ShoppingOutlined,
  ClockCircleOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import confetti from 'canvas-confetti';
import { CartItem } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';
import { dataService } from '@/lib/dataService';

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
        items
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

      message.success(`¡Pedido ${res.order_number} generado con éxito!`);
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
      width={450}
      footer={
        items.length > 0 && (
          <div style={{ padding: '8px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text strong style={{ fontSize: 16 }}>Total a Pagar:</Text>
              <Text strong style={{ fontSize: 20, color: '#0d9488' }}>
                {formatCurrency(totalAmount)}
              </Text>
            </div>

            <Button
              type="primary"
              size="large"
              block
              style={{ background: '#0d9488', height: 48 }}
              icon={<ArrowRightOutlined />}
              loading={loading}
              onClick={handleCheckout}
            >
              Generar Pedido para Retiro
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
          {/* Advertencia de 10 minutos */}
          <Alert
            message="Reserva activa por 10 minutos"
            description="Al hacer tu pedido, el inventario se descontará inmediatamente y tendrás un límite de 10 minutos para recogerlo."
            type="info"
            showIcon
            icon={<ClockCircleOutlined style={{ color: '#0d9488' }} />}
            style={{ borderRadius: 8 }}
          />

          {/* Lista de productos */}
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
                style={{ padding: '10px 0' }}
              >
                <List.Item.Meta
                  title={<div style={{ fontWeight: 600 }}>{item.product.name}</div>}
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

          <Divider style={{ margin: '8px 0' }} />

          {/* Formulario de Cliente */}
          <div>
            <Title level={5} style={{ margin: '0 0 12px 0', fontSize: 15 }}>
              Datos de Retiro en Mostrador
            </Title>
            <Form layout="vertical" size="small">
              <Form.Item label="Tu Nombre (o apodo para llamarte):">
                <Input
                  placeholder="Ej: Carlos Mora (Opcional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </Form.Item>
              <Form.Item label="Teléfono / WhatsApp:">
                <Input
                  placeholder="Ej: 8888-8888 (Para avisarte de tu pedido)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </Form.Item>
              <Form.Item label="Indicaciones especiales:">
                <Input.TextArea
                  rows={2}
                  placeholder="Ej: Para llevar, salsa aparte, etc."
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

