'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Typography,
  Card,
  Tabs,
  Table,
  Tag,
  Button,
  Space,
  Row,
  Col,
  Statistic,
  Popconfirm,
  Badge,
  Input,
  Modal,
  Alert,
  Tooltip,
  message,
} from 'antd';
import {
  DashboardOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  ReloadOutlined,
  EyeOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { Navbar } from '@/components/Navbar';
import { DispatchModal } from '@/components/DispatchModal';
import { Order } from '@/lib/types';
import { dataService } from '@/lib/dataService';
import { formatCurrency, formatDateTime, calculateRemainingSeconds, formatCountdown } from '@/lib/formatters';
import { isSupabaseConfigured, createClientBrowser } from '@/lib/supabase/client';

const { Title, Text, Paragraph } = Typography;

export default function AdminDashboardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState<Order | null>(null);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('Cancelado por el mostrador');
  const isSupabase = isSupabaseConfigured();

  // Cargar usuario autenticado
  useEffect(() => {
    if (isSupabase) {
      const supabase = createClientBrowser();
      supabase.auth.getUser().then(({ data }) => {
        if (!data?.user) {
          // Si no hay usuario, redirigir al login
          router.push('/admin/login');
        } else {
          setCurrentUser({
            id: data.user.id,
            name: data.user.email?.split('@')[0] || 'Despachador',
            email: data.user.email,
          });
        }
      });
    } else {
      const localStaff = localStorage.getItem('tiendita_current_staff');
      if (localStaff) {
        try {
          setCurrentUser(JSON.parse(localStaff));
        } catch {
          router.push('/admin/login');
        }
      } else {
        router.push('/admin/login');
      }
    }
  }, [isSupabase, router]);

  // Cargar pedidos y actualizar expirados
  const fetchOrders = async () => {
    try {
      const all = await dataService.getOrders('all');
      setOrders(all);
    } catch (err) {
      console.error('Error cargando pedidos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    // Intervalo de refresco cada 5 segundos para actualizar el temporizador de los pedidos pendientes
    const interval = setInterval(() => {
      fetchOrders();
    }, 5000);

    const handleStorage = () => fetchOrders();
    window.addEventListener('tiendita_storage_updated', handleStorage);

    return () => {
      clearInterval(interval);
      window.removeEventListener('tiendita_storage_updated', handleStorage);
    };
  }, []);

  const handleOpenDispatch = (order: Order) => {
    setSelectedOrderForDispatch(order);
    setDispatchModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalOrder) return;
    try {
      await dataService.cancelOrder(cancelModalOrder.id, cancelReason);
      message.success(`Pedido #${cancelModalOrder.order_number} anulado. El stock fue restablecido.`);
      setCancelModalOrder(null);
      fetchOrders();
    } catch (err: any) {
      message.error(err.message || 'Error al anular pedido');
    }
  };

  // Pedidos divididos por estado
  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const dispatchedOrders = orders.filter((o) => o.status === 'dispatched');
  const inactiveOrders = orders.filter((o) => o.status === 'cancelled' || o.status === 'expired');

  // Estadísticas
  const totalRevenue = dispatchedOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

  // Columnas para Pedidos Pendientes
  const pendingColumns = [
    {
      title: 'Pedido',
      dataIndex: 'order_number',
      key: 'order_number',
      render: (num: string, record: Order) => (
        <Space direction="vertical" size={2}>
          <Link href={`/order/${record.id}`} target="_blank">
            <span style={{ fontWeight: 700, color: '#0d9488', fontSize: 15 }}>
              #{num}
            </span>
          </Link>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>
            {formatDateTime(record.created_at)}
          </span>
        </Space>
      ),
    },
    {
      title: 'Cliente',
      dataIndex: 'customer_name',
      key: 'customer_name',
      render: (name: string, record: Order) => (
        <div>
          <div style={{ fontWeight: 600 }}>{name}</div>
          {record.customer_phone && (
            <div style={{ fontSize: 12, color: '#64748b' }}>Tel: {record.customer_phone}</div>
          )}
          {record.customer_notes && (
            <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
              &quot;{record.customer_notes}&quot;
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Productos Solicitados',
      key: 'items',
      render: (_: any, record: Order) => (
        <div style={{ fontSize: 13 }}>
          {record.order_items?.map((item) => (
            <div key={item.id}>
              <strong>{item.quantity}x</strong> {item.product_name}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Total',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (total: number) => (
        <span style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
          {formatCurrency(total)}
        </span>
      ),
    },
    {
      title: 'Tiempo para Retirar',
      key: 'timer',
      render: (_: any, record: Order) => {
        const remaining = calculateRemainingSeconds(record.expires_at);
        const isUrgent = remaining < 180;
        return (
          <Space>
            <ClockCircleOutlined style={{ color: isUrgent ? '#ef4444' : '#10b981' }} />
            <Tag color={isUrgent ? 'error' : 'success'} style={{ fontSize: 13, fontWeight: 700 }}>
              {remaining > 0 ? formatCountdown(remaining) : 'Venciendo...'}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: 'Acciones de Despacho',
      key: 'actions',
      render: (_: any, record: Order) => (
        <Space direction="horizontal" size="small">
          <Button
            type="primary"
            style={{ background: '#0d9488' }}
            icon={<CheckCircleOutlined />}
            onClick={() => handleOpenDispatch(record)}
          >
            Despachar & Cobrar
          </Button>

          <Button
            danger
            icon={<CloseCircleOutlined />}
            onClick={() => setCancelModalOrder(record)}
          >
            Anular
          </Button>
        </Space>
      ),
    },
  ];

  // Columnas para Pedidos Despachados
  const dispatchedColumns = [
    {
      title: 'Pedido',
      dataIndex: 'order_number',
      key: 'order_number',
      render: (num: string, record: Order) => (
        <Link href={`/order/${record.id}`} target="_blank">
          <strong style={{ color: '#0d9488' }}>#{num}</strong>
        </Link>
      ),
    },
    {
      title: 'Cliente',
      dataIndex: 'customer_name',
      key: 'customer_name',
    },
    {
      title: 'Total Pagado',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (val: number) => <span style={{ fontWeight: 700 }}>{formatCurrency(val)}</span>,
    },
    {
      title: 'Forma(s) de Pago',
      key: 'payments',
      render: (_: any, record: Order) => (
        <div>
          {record.payment_details?.map((p, idx) => (
            <div key={idx} style={{ fontSize: 12 }}>
              <Tag color={p.method === 'efectivo' ? 'green' : 'blue'}>
                {p.method.toUpperCase()}
              </Tag>
              {formatCurrency(p.amount)}
              {p.method === 'efectivo' && p.received && (
                <span style={{ color: '#16a34a', marginLeft: 4 }}>
                  (Recibido: {formatCurrency(p.received)} | Vuelto: {formatCurrency(p.change || 0)})
                </span>
              )}
              {p.reference && <span style={{ color: '#64748b' }}> [Ref: {p.reference}]</span>}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Despachado Por',
      dataIndex: 'dispatched_by_name',
      key: 'dispatched_by_name',
      render: (name: string, record: Order) => (
        <div>
          <div style={{ fontWeight: 600 }}>{name || 'Personal'}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>
            {formatDateTime(record.dispatched_at)}
          </div>
        </div>
      ),
    },
  ];

  // Columnas para Inactivos (Cancelados / Expirados)
  const inactiveColumns = [
    {
      title: 'Pedido',
      dataIndex: 'order_number',
      key: 'order_number',
      render: (num: string) => <strong>#{num}</strong>,
    },
    {
      title: 'Cliente',
      dataIndex: 'customer_name',
      key: 'customer_name',
    },
    {
      title: 'Estado',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'expired' ? 'warning' : 'error'}>
          {status === 'expired' ? 'Expiró Plazo (10 min)' : 'Cancelado Manualmente'}
        </Tag>
      ),
    },
    {
      title: 'Motivo / Observación',
      dataIndex: 'cancellation_reason',
      key: 'cancellation_reason',
      render: (reason: string) => (
        <span style={{ fontSize: 13, color: '#64748b' }}>
          {reason || 'Stock reintegrado al inventario.'}
        </span>
      ),
    },
    {
      title: 'Fecha de Creación',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => formatDateTime(date),
    },
  ];

  return (
    <div>
      <Navbar />

      <main className="main-container">
        {/* Cabecera del Panel */}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>
              Panel de Despacho & Caja
            </Title>
            <Text type="secondary">
              Atendiendo como: <strong>{currentUser?.name || currentUser?.email || 'Despachador'}</strong>
            </Text>
          </div>

          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchOrders} loading={loading}>
              Refrescar Pedidos
            </Button>
            <Link href="/admin/inventario">
              <Button type="default">
                Gestionar Inventario
              </Button>
            </Link>
          </Space>
        </div>

        {/* Tarjetas de Métricas en Tiempo Real */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={8}>
            <Card style={{ borderLeft: '4px solid #0d9488' }}>
              <Statistic
                title="Pedidos Pendientes (Por Retirar)"
                value={pendingOrders.length}
                prefix={<ClockCircleOutlined style={{ color: '#0d9488' }} />}
                valueStyle={{ color: '#0d9488', fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={{ borderLeft: '4px solid #10b981' }}>
              <Statistic
                title="Despachados Exitosamente"
                value={dispatchedOrders.length}
                prefix={<CheckCircleOutlined style={{ color: '#10b981' }} />}
                valueStyle={{ color: '#10b981', fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={{ borderLeft: '4px solid #0284c7' }}>
              <Statistic
                title="Total Cobrado en Caja"
                value={totalRevenue}
                formatter={(val) => formatCurrency(Number(val))}
                prefix={<DollarOutlined style={{ color: '#0284c7' }} />}
                valueStyle={{ color: '#0284c7', fontWeight: 700 }}
              />
            </Card>
          </Col>
        </Row>

        {/* Pestañas de Gestión de Pedidos */}
        <Card styles={{ body: { padding: '16px 20px' } }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
              {
                key: 'pending',
                label: (
                  <Badge count={pendingOrders.length} offset={[10, 0]} color="#0d9488">
                    <span>🔔 Pendientes de Retiro</span>
                  </Badge>
                ),
                children: (
                  <Table
                    columns={pendingColumns}
                    dataSource={pendingOrders}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 8 }}
                    locale={{
                      emptyText: 'No hay pedidos pendientes en este momento.',
                    }}
                  />
                ),
              },
              {
                key: 'dispatched',
                label: `✓ Despachados (${dispatchedOrders.length})`,
                children: (
                  <Table
                    columns={dispatchedColumns}
                    dataSource={dispatchedOrders}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 8 }}
                    locale={{
                      emptyText: 'Aún no hay pedidos despachados.',
                    }}
                  />
                ),
              },
              {
                key: 'inactive',
                label: `✕ Anulados & Vencidos (${inactiveOrders.length})`,
                children: (
                  <Table
                    columns={inactiveColumns}
                    dataSource={inactiveOrders}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 8 }}
                    locale={{
                      emptyText: 'No hay pedidos cancelados o expirados.',
                    }}
                  />
                ),
              },
            ]}
          />
        </Card>
      </main>

      {/* Modal de Despacho y Registro de Pago */}
      <DispatchModal
        visible={dispatchModalOpen}
        order={selectedOrderForDispatch}
        currentUser={currentUser}
        onClose={() => setDispatchModalOpen(false)}
        onSuccess={fetchOrders}
      />

      {/* Modal para Anular Pedido */}
      <Modal
        open={Boolean(cancelModalOrder)}
        title={
          <div style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ExclamationCircleOutlined />
            <span>Anular Pedido #{cancelModalOrder?.order_number}</span>
          </div>
        }
        onCancel={() => setCancelModalOrder(null)}
        onOk={handleConfirmCancel}
        okText="Confirmar Anulación"
        cancelText="Volver"
        okButtonProps={{ danger: true }}
      >
        <Paragraph>
          Al anular este pedido, los productos solicitados serán devueltos inmediatamente al stock disponible para que otros clientes puedan comprarlos.
        </Paragraph>
        <div style={{ marginTop: 12 }}>
          <Text strong>Motivo de anulación:</Text>
          <Input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            style={{ marginTop: 6 }}
            placeholder="Ej: Cliente solicitó cancelar, no se presentó, etc."
          />
        </div>
      </Modal>
    </div>
  );
}

