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
  Tooltip,
  Popconfirm,
  message,
} from 'antd';
import {
  DollarOutlined,
  CreditCardOutlined,
  MobileOutlined,
  PlusOutlined,
  MinusOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  UserOutlined,
  ScanOutlined,
  ShoppingCartOutlined,
  CameraOutlined,
} from '@ant-design/icons';
import { Order, OrderItem, PaymentItem, PaymentMethodType, Product } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';
import { dataService } from '@/lib/dataService';
import { BarcodeScannerModal } from './BarcodeScannerModal';

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
  const [items, setItems] = useState<OrderItem[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [notes, setNotes] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedAddProductId, setSelectedAddProductId] = useState<string | null>(null);

  // Cargar catálogo de productos disponibles para agregar
  useEffect(() => {
    if (visible) {
      dataService.getProducts().then((prods) => {
        setCatalogProducts(prods);
      });
    }
  }, [visible]);

  // Inicializar items y pagos cuando se abre el modal
  useEffect(() => {
    if (order && visible) {
      const initialItems = (order.order_items || []).map((i) => ({ ...i }));
      setItems(initialItems);

      const initialTotal = initialItems.reduce((acc, i) => acc + i.unit_price * i.quantity, 0) || order.total_amount;

      setPayments([
        {
          id: 'pay-1',
          method: 'efectivo',
          amount: initialTotal,
          received: initialTotal,
          change: 0,
        },
      ]);
      setNotes('');
      setSelectedAddProductId(null);
    }
  }, [order, visible]);

  if (!order) return null;

  // Total recalculado en vivo según los items presentes
  const totalToPay = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const currentTotalAllocated = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const remainingDifference = totalToPay - currentTotalAllocated;

  // Sincronizar pago cuando cambian los items (si solo hay 1 método registrado)
  const syncSinglePaymentAmount = (newTotal: number) => {
    if (payments.length === 1) {
      const p = payments[0];
      const rec = Math.max(p.received || 0, newTotal);
      setPayments([
        {
          ...p,
          amount: newTotal,
          received: p.method === 'efectivo' ? rec : newTotal,
          change: p.method === 'efectivo' ? Math.max(0, rec - newTotal) : 0,
        },
      ]);
    }
  };

  // Manejador para aumentar cantidad de un producto
  const handleIncreaseQuantity = (productId: string) => {
    const prodInCatalog = catalogProducts.find((p) => p.id === productId);
    const existing = items.find((i) => i.product_id === productId);

    if (prodInCatalog && existing) {
      // Verificar stock disponible considerando lo que ya tenía el pedido
      const originalInOrder = (order.order_items || []).find((i) => i.product_id === productId)?.quantity || 0;
      const extraNeeded = existing.quantity + 1 - originalInOrder;
      if (extraNeeded > prodInCatalog.stock) {
        message.warning(`No hay más stock disponible para ${prodInCatalog.name} (Stock libre: ${prodInCatalog.stock})`);
        return;
      }
    }

    const nextItems = items.map((i) => {
      if (i.product_id === productId) {
        const nextQty = i.quantity + 1;
        return { ...i, quantity: nextQty, subtotal: i.unit_price * nextQty };
      }
      return i;
    });

    setItems(nextItems);
    const nextTotal = nextItems.reduce((acc, i) => acc + i.unit_price * i.quantity, 0);
    syncSinglePaymentAmount(nextTotal);
  };

  // Manejador para disminuir cantidad de un producto
  const handleDecreaseQuantity = (productId: string) => {
    const existing = items.find((i) => i.product_id === productId);
    if (!existing) return;

    if (existing.quantity <= 1) {
      handleRemoveItem(productId);
      return;
    }

    const nextItems = items.map((i) => {
      if (i.product_id === productId) {
        const nextQty = i.quantity - 1;
        return { ...i, quantity: nextQty, subtotal: i.unit_price * nextQty };
      }
      return i;
    });

    setItems(nextItems);
    const nextTotal = nextItems.reduce((acc, i) => acc + i.unit_price * i.quantity, 0);
    syncSinglePaymentAmount(nextTotal);
  };

  // Manejador para quitar completamente un producto del pedido
  const handleRemoveItem = (productId: string) => {
    if (items.length <= 1) {
      message.warning('El pedido debe tener al menos un producto.');
      return;
    }

    const nextItems = items.filter((i) => i.product_id !== productId);
    setItems(nextItems);
    const nextTotal = nextItems.reduce((acc, i) => acc + i.unit_price * i.quantity, 0);
    syncSinglePaymentAmount(nextTotal);
    message.info('Producto removido del pedido.');
  };

  // Agregar producto desde selector o escáner
  const handleAddProductByIdOrBarcode = (identifier: string) => {
    const cleaned = identifier.trim().toLowerCase();
    // Buscar por ID, por código de barras exacto, o por coincidencia de nombre
    const prod = catalogProducts.find(
      (p) =>
        p.id.toLowerCase() === cleaned ||
        (p.barcode && p.barcode.toLowerCase() === cleaned) ||
        p.name.toLowerCase() === cleaned
    );

    if (!prod) {
      message.error(`Producto con código "${identifier}" no encontrado en catálogo.`);
      return;
    }

    const existing = items.find((i) => i.product_id === prod.id);
    const originalInOrder = (order.order_items || []).find((i) => i.product_id === prod.id)?.quantity || 0;
    const currentQty = existing ? existing.quantity : 0;
    const extraNeeded = currentQty + 1 - originalInOrder;

    if (extraNeeded > prod.stock) {
      message.warning(`Stock insuficiente para agregar más ${prod.name} (Stock en tienda: ${prod.stock})`);
      return;
    }

    let nextItems: OrderItem[] = [];
    if (existing) {
      nextItems = items.map((i) => {
        if (i.product_id === prod.id) {
          const nextQty = i.quantity + 1;
          return { ...i, quantity: nextQty, subtotal: i.unit_price * nextQty };
        }
        return i;
      });
    } else {
      const newItem: OrderItem = {
        id: 'item-' + Math.random().toString(36).substring(2, 8),
        order_id: order.id,
        product_id: prod.id,
        product_name: prod.name,
        unit_price: prod.price,
        quantity: 1,
        subtotal: prod.price,
      };
      nextItems = [...items, newItem];
    }

    setItems(nextItems);
    const nextTotal = nextItems.reduce((acc, i) => acc + i.unit_price * i.quantity, 0);
    syncSinglePaymentAmount(nextTotal);
    setSelectedAddProductId(null);
    message.success(`¡${prod.name} agregado al pedido!`);
  };

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
    if (items.length === 0) {
      message.error('El pedido no tiene productos.');
      return;
    }

    // Validaciones de pagos
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
        notes,
        items // Se envían los productos actualizados
      );
      message.success(`¡Pedido #${order.order_number} despachado con éxito!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      message.error(err.message || 'Error al despachar el pedido');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        open={visible}
        onCancel={onClose}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckCircleOutlined style={{ color: '#0d9488', fontSize: 20 }} />
            <span>Despachar Pedido #{order.order_number}</span>
          </div>
        }
        width={720}
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
            Confirmar Despacho y Cobro ({formatCurrency(totalToPay)})
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
                <Tag color="cyan" style={{ marginTop: 4 }}>Turno Activo</Tag>
              </Col>
            </Row>
          </Card>

          {/* ================================================================= */}
          {/* GESTIÓN DE PRODUCTOS DEL PEDIDO (AGREGAR / QUITAR / ESCANEAR)     */}
          {/* ================================================================= */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text strong style={{ fontSize: 14 }}>
                Productos del Pedido ({items.length}):
              </Text>
              <Button
                type="dashed"
                icon={<CameraOutlined style={{ color: '#0d9488' }} />}
                onClick={() => setScannerOpen(true)}
                style={{ borderColor: '#0d9488', color: '#0d9488', fontWeight: 600 }}
              >
                📷 Escanear con Cámara
              </Button>
            </div>

            {/* Lista interactiva de productos */}
            <div
              style={{
                maxHeight: 180,
                overflowY: 'auto',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '4px 8px',
                background: '#ffffff',
              }}
            >
              {items.map((item) => (
                <div
                  key={item.product_id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 4px',
                    borderBottom: '1px solid #f1f5f9',
                    fontSize: 13,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {formatCurrency(item.unit_price)} c/u
                    </div>
                  </div>

                  {/* Controles de cantidad */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Button
                      size="small"
                      icon={<MinusOutlined />}
                      onClick={() => handleDecreaseQuantity(item.product_id)}
                      style={{ width: 26, height: 26 }}
                    />

                    <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>
                      {item.quantity}
                    </span>

                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => handleIncreaseQuantity(item.product_id)}
                      style={{ width: 26, height: 26 }}
                    />

                    <span style={{ fontWeight: 700, minWidth: 70, textAlign: 'right', color: '#0f766e' }}>
                      {formatCurrency(item.subtotal)}
                    </span>

                    <Popconfirm
                      title="¿Quitar este producto del pedido?"
                      onConfirm={() => handleRemoveItem(item.product_id)}
                      okText="Quitar"
                      cancelText="Cancelar"
                    >
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        size="small"
                      />
                    </Popconfirm>
                  </div>
                </div>
              ))}
            </div>

            {/* Selector para agregar producto adicional rápidamente */}
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <Select
                showSearch
                placeholder="+ Buscar producto para agregar..."
                optionFilterProp="label"
                value={selectedAddProductId}
                onChange={(val) => {
                  if (val) handleAddProductByIdOrBarcode(val);
                }}
                style={{ flex: 1 }}
                options={catalogProducts.map((p) => ({
                  value: p.id,
                  label: `${p.name} - ${formatCurrency(p.price)} (${p.stock} disp.)`,
                }))}
              />
            </div>

            {/* Total a cobrar actualizado */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 10,
                padding: '8px 12px',
                background: '#f0fdfa',
                border: '1px solid #ccfbf1',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 800,
              }}
            >
              <span style={{ color: '#0f766e' }}>Total a Cobrar:</span>
              <span style={{ color: '#0d9488', fontSize: 18 }}>{formatCurrency(totalToPay)}</span>
            </div>
          </div>

          <Divider orientation="left" style={{ margin: '16px 0 12px 0', fontSize: 14 }}>
            Formas de Pago
          </Divider>

          {/* Alerta de cuadre si hay diferencia */}
          {Math.abs(remainingDifference) > 0.01 && (
            <Alert
              type="warning"
              showIcon
              message={
                remainingDifference > 0
                  ? `Falta asignar: ${formatCurrency(remainingDifference)}`
                  : `Monto excedido por: ${formatCurrency(Math.abs(remainingDifference))}`
              }
              style={{ marginBottom: 12 }}
            />
          )}

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
                      min={0.1}
                      step={0.5}
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

                  {/* Campos de Efectivo */}
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
                              step={0.5}
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

                  {/* Comprobante / Referencia */}
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
          </div>

          {/* Notas de Despacho */}
          <div style={{ marginTop: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Notas internas de despacho (opcional):</Text>
            <Input.TextArea
              rows={2}
              placeholder="Ej: Cliente solicitó factura electrónica o cambio de presentación."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ marginTop: 4 }}
            />
          </div>
        </div>
      </Modal>

      {/* Modal de Escáner con Cámara del Celular / Código de Barras */}
      <BarcodeScannerModal
        visible={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(scannedCode) => {
          handleAddProductByIdOrBarcode(scannedCode);
        }}
      />
    </>
  );
};
