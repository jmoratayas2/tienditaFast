'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  Card,
  Typography,
  Steps,
  Button,
  Tag,
  Divider,
  Spin,
  Alert,
  Popconfirm,
  Space,
  Row,
  Col,
  Result,
  message,
} from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ShoppingOutlined,
  HomeOutlined,
  PrinterOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Navbar } from '@/components/Navbar';
import { OrderCountdown } from '@/components/OrderCountdown';
import { Order } from '@/lib/types';
import { dataService } from '@/lib/dataService';
import { formatCurrency, formatDateTime } from '@/lib/formatters';

const { Title, Text, Paragraph } = Typography;

export default function OrderTrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const fetchOrder = async () => {
    try {
      const data = await dataService.getOrder(orderId);
      setOrder(data);
    } catch (err) {
      console.error('Error cargando pedido:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();

    // Polling cada 4 segundos para actualización en tiempo real cuando el personal despache
    const interval = setInterval(() => {
      fetchOrder();
    }, 4000);

    const handleStorage = () => fetchOrder();
    window.addEventListener('tiendita_storage_updated', handleStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('tiendita_storage_updated', handleStorage);
    };
  }, [orderId]);

  const handleCancelOrder = async () => {
    if (!order) return;
    try {
      setCancelling(true);
      await dataService.cancelOrder(order.id, 'Anulado directamente por el cliente en pantalla');
      message.success('Tu pedido ha sido cancelado y los artículos fueron reintegrados al stock.');
      fetchOrder();
    } catch (err: any) {
      message.error(err.message || 'No se pudo cancelar el pedido.');
    } finally {
      setCancelling(false);
    }
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (loading) {
    return (
      <div>
        <Navbar />
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#64748b' }}>Cargando información del pedido...</div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <Navbar />
        <div className="main-container" style={{ textAlign: 'center', padding: '60px 0' }}>
          <Result
            status="404"
            title="Pedido no encontrado"
            subTitle="El código o identificador de este pedido no existe en el sistema."
            extra={
              <Link href="/">
                <Button type="primary" style={{ background: '#0d9488' }}>
                  Volver al Catálogo
                </Button>
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  // Determinar paso actual para el stepper
  let currentStep = 1;
  let stepStatus: 'process' | 'finish' | 'error' = 'process';

  if (order.status === 'dispatched') {
    currentStep = 3;
    stepStatus = 'finish';
  } else if (order.status === 'cancelled' || order.status === 'expired') {
    currentStep = 1;
    stepStatus = 'error';
  }

  return (
    <div>
      <Navbar />

      <main className="main-container">
        {/* Cabecera del Pedido */}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Title level={2} style={{ margin: 0 }}>
                Pedido #{order.order_number}
              </Title>
              {order.status === 'pending' && <Tag color="processing">Pendiente de Retiro</Tag>}
              {order.status === 'dispatched' && <Tag color="success">Despachado</Tag>}
              {order.status === 'cancelled' && <Tag color="error">Cancelado</Tag>}
              {order.status === 'expired' && <Tag color="warning">Tiempo Expirado</Tag>}
            </div>
            <Text type="secondary">
              Creado el {formatDateTime(order.created_at)} • Para: <strong>{order.customer_name}</strong>
            </Text>
          </div>

          <Space>
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>
              Imprimir Ticket
            </Button>
            <Link href="/">
              <Button icon={<HomeOutlined />}>
                Nueva Compra
              </Button>
            </Link>
          </Space>
        </div>

        {/* Temporizador de 10 minutos (Persistente) */}
        <OrderCountdown
          expiresAt={order.expires_at}
          status={order.status}
          onExpire={fetchOrder}
        />

        {/* Pasos de Estado del Pedido */}
        <Card style={{ marginBottom: 24 }}>
          <Steps
            current={currentStep}
            status={stepStatus}
            items={[
              {
                title: 'Pedido Solicitado',
                description: 'Stock descontado de tienda',
              },
              {
                title: 'En Preparación / Espera',
                description: 'Por retirar en mostrador',
              },
              {
                title: order.status === 'cancelled' || order.status === 'expired' ? 'Anulado / Vencido' : 'Despachado & Pagado',
                description: order.status === 'dispatched'
                  ? `Despachado por ${order.dispatched_by_name || 'Personal'}`
                  : order.status === 'expired'
                  ? 'Expiró el plazo de 10 min'
                  : 'Listo para entregar',
              },
            ]}
          />
        </Card>

        <Row gutter={[24, 24]}>
          {/* Ticket / Comprobante de Productos */}
          <Col xs={24} md={15}>
            <Card title="Detalle de Productos Solicitados" style={{ height: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {order.order_items?.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 0',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>
                        {item.quantity}x {item.product_name}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        Precio unitario: {formatCurrency(item.unit_price)}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>
                      {formatCurrency(item.subtotal)}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '2px dashed #cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800 }}>
                  <span>Total del Pedido:</span>
                  <span style={{ color: '#0d9488' }}>{formatCurrency(order.total_amount)}</span>
                </div>
              </div>

              {/* Información de Pago si ya fue despachado */}
              {order.status === 'dispatched' && order.payment_details && order.payment_details.length > 0 && (
                <div style={{ marginTop: 24, background: '#f0fdf4', padding: 16, borderRadius: 10, border: '1px solid #bbf7d0' }}>
                  <Text strong style={{ color: '#166534', display: 'block', marginBottom: 8 }}>
                    ✓ Información de Pago Registrada al Despachar:
                  </Text>
                  {order.payment_details.map((p, idx) => (
                    <div key={idx} style={{ fontSize: 13, color: '#14532d', marginBottom: 4 }}>
                      • <strong>{p.method.toUpperCase()}</strong>: {formatCurrency(p.amount)}
                      {p.received ? ` (Recibido: ${formatCurrency(p.received)} - Vuelto entregado: ${formatCurrency(p.change || 0)})` : ''}
                      {p.reference ? ` [Ref: ${p.reference}]` : ''}
                    </div>
                  ))}
                  <div style={{ fontSize: 12, color: '#15803d', marginTop: 8 }}>
                    Atendido por: <strong>{order.dispatched_by_name}</strong> el {formatDateTime(order.dispatched_at)}
                  </div>
                </div>
              )}
            </Card>
          </Col>

          {/* Información de Retiro & Acciones */}
          <Col xs={24} md={9}>
            <Card title="Instrucciones para Retiro" style={{ height: '100%' }}>
              <Paragraph style={{ fontSize: 14 }}>
                1. Acércate al mostrador de <strong>La Tiendita</strong>.
              </Paragraph>
              <Paragraph style={{ fontSize: 14 }}>
                2. Indica tu número de pedido: <strong>#{order.order_number}</strong> o tu nombre <strong>{order.customer_name}</strong>.
              </Paragraph>
              <Paragraph style={{ fontSize: 14 }}>
                3. Realiza el pago mediante Efectivo, Tarjeta o SINPE al momento de retirar.
              </Paragraph>

              {order.customer_notes && (
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, margin: '16px 0', border: '1px solid #e2e8f0' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Notas especiales:</Text>
                  <div style={{ fontSize: 13, fontStyle: 'italic' }}>{order.customer_notes}</div>
                </div>
              )}

              <Divider style={{ margin: '16px 0' }} />

              {/* Botón para Anular Pedido mientras esté pendiente */}
              {order.status === 'pending' && (
                <div>
                  <Popconfirm
                    title="¿Deseas anular este pedido?"
                    description="Los productos se devolverán inmediatamente al inventario disponible de la tienda."
                    okText="Sí, Anular"
                    cancelText="No, Mantener"
                    okButtonProps={{ danger: true, loading: cancelling }}
                    onConfirm={handleCancelOrder}
                  >
                    <Button danger block style={{ height: 40 }}>
                      Anular mi Pedido
                    </Button>
                  </Popconfirm>
                  <div style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
                    Si cambiaste de opinión, anúlalo para liberar el stock.
                  </div>
                </div>
              )}

              {order.status === 'dispatched' && (
                <Alert
                  type="success"
                  message="¡Gracias por tu compra!"
                  description="Esperamos que disfrutes tus productos."
                  showIcon
                />
              )}
            </Card>
          </Col>
        </Row>
      </main>
    </div>
  );
}

