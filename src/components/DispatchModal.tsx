'use client';

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Space,
  Typography,
  Divider,
  Alert,
  Card,
  Tag,
  Row,
  Col,
  message,
} from 'antd';
import {
  DollarOutlined,
  CreditCardOutlined,
  MobileOutlined,
  PlusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Order, PaymentItem, PaymentMethodType } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';
import { dataService } from '@/lib/dataService';

const { Title, Text } = Typography;

interface DispatchModalProps {
  visible: boolean;
  order: Order | null;
  currentUser: { id?: string; name: string; email?: string } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const DispatchModal: React.FC<DispatchModalProps> = ({
  visible,
  order,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [notes, setNotes] = useState('');

  // Inicializar pagos cuando se abre el modal
  useEffect(() => {
    if (order && visible) {
      setPayments([
        {
          id: 'pay-1',
          method: 'efectivo',
          amount: order.total_amount,
          received: order.total_amount,
          change: 0,
        },
      ]);
      setNotes('');
    }
  }, [order, visible]);

  if (!order) return null;

  const totalToPay = order.total_amount;
  const currentTotalAllocated = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const remainingDifference = totalToPay - currentTotalAllocated;

  // Manejar cambio en un método de pago
  const updatePayment = (index: number, fields: Partial<PaymentItem>) => {
    const next = [...payments];
    const item = { ...next[index], ...fields };

    // Si es efectivo y cambian amount o received, recalcular el vuelto
    if (item.method === 'efectivo') {
      const rec = item.received ?? 0;
      const amt = item.amount ?? 0;
      item.change = Math.max(0, rec - amt);
    }

    next[index] = item;
    setPayments(next);
  };

  const addPaymentMethod = () => {
    const remaining = Math.max(0, remainingDifference);
    setPayments([
      ...payments,
      {
        id: 'pay-' + Math.random().toString(36).substring(2, 7),
        method: 'tarjeta',
        amount: remaining,
      },
    ]);
  };

  const removePaymentMethod = (index: number) => {
    if (payments.length <= 1) {
      message.warning('Debe registrar al menos un método de pago.');
      return;
    }
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handleDispatch = async () => {
    // Validaciones
    if (Math.abs(remainingDifference) > 0.01) {
      message.error(
        `El monto asignado (${formatCurrency(currentTotalAllocated)}) debe coincidir exactamente con el total del pedido (${formatCurrency(totalToPay)}).`
      );
      return;
    }

    for (const p of payments) {
      if (p.method === 'efectivo') {
        if ((p.received ?? 0) < p.amount) {
          message.error(
            `En efectivo, el monto recibido (${formatCurrency(p.received ?? 0)}) no puede ser menor a lo que se paga (${formatCurrency(p.amount)}).`
          );
          return;
        }
      }
    }

    const dispatcherName = currentUser?.name || currentUser?.email || 'Despachador en Turno';

    try {
      setSubmitting(true);
      await dataService.dispatchOrder(
        order.id,
        { id: currentUser?.id, name: dispatcherName },
        payments,
        notes
      );
      message.success(`¡Pedido ${order.order_number} despachado con éxito!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      message.error(err.message || 'Error al despachar el pedido');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircleOutlined style={{ color: '#0d9488', fontSize: 20 }} />
          <span>Despachar Pedido #{order.order_number}</span>
        </div>
      }
      width={680}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting}>
          Cancelar
        </Button>,
        <Button
          key="submit"
          type="primary"
          style={{ background: '#0d9488' }}
          icon={<CheckCircleOutlined />}
          loading={submitting}
          onClick={handleDispatch}
        >
          Confirmar Despacho y Cobro
        </Button>,
      ]}
    >
      <div style={{ marginTop: 12 }}>
        {/* Información del despachador y cliente */}
        <Card size="small" style={{ background: '#f8fafc', marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>CLIENTE</Text>
              <div style={{ fontWeight: 600 }}>{order.customer_name}</div>
              {order.customer_phone && (
                <div style={{ fontSize: 13, color: '#64748b' }}>Tel: {order.customer_phone}</div>
              )}
            </Col>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>DESPACHADO POR</Text>
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserOutlined style={{ color: '#0d9488' }} />
                <span>{currentUser?.name || currentUser?.email || 'Personal de Turno'}</span>
              </div>
              <Tag color="cyan" style={{ marginTop: 4 }}>Cuenta Verificada</Tag>
            </Col>
          </Row>
        </Card>

        {/* Resumen de Items */}
        <div style={{ marginBottom: 16 }}>
          <Text strong>Productos del Pedido:</Text>
          <div style={{ maxHeight: 120, overflowY: 'auto', marginTop: 8, border: '1px solid #f1f5f9', borderRadius: 8, padding: 8 }}>
            {order.order_items?.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '4px 0',
                  borderBottom: '1px solid #f8fafc',
                  fontSize: 13,
                }}
              >
                <span>
                  <strong>{item.quantity}x</strong> {item.product_name}
                </span>
                <span>{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 16, fontWeight: 700 }}>
            <span>Total a Cobrar:</span>
            <span style={{ color: '#0d9488' }}>{formatCurrency(order.total_amount)}</span>
          </div>
        </div>

        <Divider orientation="left" style={{ margin: '16px 0 12px 0', fontSize: 14 }}>
          Formas de Pago
        </Divider>

        <Alert
          message="Puedes registrar un solo pago o dividirlo en varias formas (mixto)."
          type="info"
          showIcon
          style={{ marginBottom: 16, fontSize: 13 }}
        />

        {/* Lista de Formas de Pago */}
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {payments.map((p, index) => (
            <Card
              key={p.id}
              size="small"
              style={{
                border: '1px solid #e2e8f0',
                background: p.method === 'efectivo' ? '#f0fdf4' : '#f8fafc',
              }}
            >
              <Row gutter={[12, 12]} align="middle">
                <Col xs={24} sm={8}>
                  <Text style={{ fontSize: 12 }} type="secondary">Método:</Text>
                  <Select
                    value={p.method}
                    style={{ width: '100%', marginTop: 2 }}
                    onChange={(val: PaymentMethodType) => updatePayment(index, { method: val })}
                    options={[
                      { value: 'efectivo', label: '💵 Efectivo' },
                      { value: 'tarjeta', label: '💳 Tarjeta / POS' },
                      { value: 'transferencia', label: '🏦 Transferencia Bancaria' },
                      { value: 'sinpe', label: '📱 Transferencia Móvil / QR' },
                      { value: 'otro', label: 'Otro' },
                    ]}
                  />
                </Col>

                <Col xs={24} sm={8}>
                  <Text style={{ fontSize: 12 }} type="secondary">Monto a pagar ({formatCurrency(0).slice(0, 1)}):</Text>
                  <InputNumber
                    min={1}
                    value={p.amount}
                    style={{ width: '100%', marginTop: 2 }}
                    onChange={(val) => updatePayment(index, { amount: val || 0 })}
                  />
                </Col>

                <Col xs={24} sm={8} style={{ textAlign: 'right' }}>
                  {payments.length > 1 && (
                    <Button
                      danger
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => removePaymentMethod(index)}
                    >
                      Quitar
                    </Button>
                  )}
                </Col>

                {/* Campos especiales según el método */}
                {p.method === 'efectivo' && (
                  <Col span={24}>
                    <div style={{ background: '#dcfce7', padding: '10px 14px', borderRadius: 8, border: '1px solid #86efac' }}>
                      <Row gutter={12} align="middle">
                        <Col xs={24} sm={12}>
                          <Text strong style={{ color: '#166534', fontSize: 13 }}>
                            Monto recibido del cliente:
                          </Text>
                          <InputNumber
                            min={p.amount}
                            value={p.received}
                            style={{ width: '100%', marginTop: 4 }}
                            onChange={(val) => updatePayment(index, { received: val || 0 })}
                            placeholder="Monto entregado"
                          />
                        </Col>
                        <Col xs={24} sm={12}>
                          <Text strong style={{ color: '#166534', fontSize: 13 }}>
                            Vuelto a entregar:
                          </Text>
                          <div
                            style={{
                              fontSize: 20,
                              fontWeight: 800,
                              color: '#15803d',
                              marginTop: 4,
                            }}
                          >
                            {formatCurrency(p.change || 0)}
                          </div>
                        </Col>
                      </Row>
                    </div>
                  </Col>
                )}

                {(p.method === 'tarjeta' || p.method === 'sinpe' || p.method === 'transferencia') && (
                  <Col span={24}>
                    <Text style={{ fontSize: 12 }} type="secondary">
                      Número de Comprobante / Referencia:
                    </Text>
                    <Input
                      placeholder="Ej: Autorización #58203 o No. de Transferencia / Boleta"
                      value={p.reference || ''}
                      onChange={(e) => updatePayment(index, { reference: e.target.value })}
                      style={{ marginTop: 2 }}
                    />
                  </Col>
                )}
              </Row>
            </Card>
          ))}
        </Space>

        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button type="dashed" icon={<PlusOutlined />} onClick={addPaymentMethod}>
            Agregar otra forma de pago
          </Button>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 13, marginRight: 8 }}>Total cubierto:</span>
            <Tag color={Math.abs(remainingDifference) < 0.01 ? 'success' : 'error'} style={{ fontSize: 14, padding: '4px 10px' }}>
              {formatCurrency(currentTotalAllocated)} / {formatCurrency(totalToPay)}
            </Tag>
          </div>
        </div>

        {/* Notas adicionales */}
        <div style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 12 }} type="secondary">Notas de Despacho (Opcional):</Text>
          <Input.TextArea
            rows={2}
            placeholder="Ej: Se entregó con servilletas extra, retiró un familiar, etc."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ marginTop: 4 }}
          />
        </div>
      </div>
    </Modal>
  );
};

