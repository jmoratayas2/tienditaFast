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
  InputNumber,
  Modal,
  Alert,
  Tooltip,
  Select,
  Divider,
  Segmented,
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
  FireOutlined,
  UserOutlined,
  TeamOutlined,
  PlusCircleOutlined,
  ShoppingCartOutlined,
  ExclamationCircleOutlined,
  CameraOutlined,
} from '@ant-design/icons';
import { Navbar } from '@/components/Navbar';
import { DispatchModal } from '@/components/DispatchModal';
import { BarcodeScannerModal } from '@/components/BarcodeScannerModal';
import { Order, Product, UserRole } from '@/lib/types';
import { dataService } from '@/lib/dataService';
import { formatCurrency, formatDateTime, calculateRemainingSeconds, formatCountdown } from '@/lib/formatters';
import { isSupabaseConfigured, createClientBrowser } from '@/lib/supabase/client';

const { Title, Text, Paragraph } = Typography;

export default function AdminDashboardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingFilter, setPendingFilter] = useState<'all' | 'immediate' | 'scheduled' | 'on_arrival'>('all');
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState<Order | null>(null);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole>('despachador');
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('Cancelado por el mostrador');

  // Estado para el modal de "Tomar Pedido Mostrador"
  const [takeOrderModalOpen, setTakeOrderModalOpen] = useState(false);
  const [counterScannerOpen, setCounterScannerOpen] = useState(false);
  const [orderCustomerName, setOrderCustomerName] = useState('Cliente Mostrador');
  const [orderCustomerPhone, setOrderCustomerPhone] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ productId: string; quantity: number }[]>([]);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  const isSupabase = isSupabaseConfigured();

  // Cargar usuario autenticado y su rol
  useEffect(() => {
    const initUser = async () => {
      let email = '';
      if (isSupabase) {
        const supabase = createClientBrowser();
        const { data } = await supabase.auth.getUser();
        if (!data?.user) {
          router.push('/admin/login');
          return;
        } else {
          const metaName = data.user.user_metadata?.full_name;
          setCurrentUser({
            id: data.user.id,
            name: metaName || 'Personal de Tienda',
            email: data.user.email,
          });
          email = data.user.email || '';
        }
      } else {
        const localStaff = localStorage.getItem('tiendita_current_staff');
        if (localStaff) {
          try {
            const parsed = JSON.parse(localStaff);
            setCurrentUser(parsed);
            email = parsed.email || '';
          } catch {
            router.push('/admin/login');
            return;
          }
        } else {
          router.push('/admin/login');
          return;
        }
      }

      // Validar rol y Nombres y Apellidos desde la lista de personal
      try {
        const staffList = await dataService.getStaffUsers();
        const profile = staffList.find((s) => s.email.toLowerCase() === email.toLowerCase());
        if (profile) {
          setUserRole(profile.role);
          setCurrentUser((prev: any) => ({
            ...prev,
            id: profile.auth_user_id || profile.id || prev?.id,
            name: profile.full_name,
            role: profile.role,
          }));
        } else if (email.toLowerCase().includes('admin')) {
          setUserRole('admin');
        } else {
          setUserRole('despachador');
        }
      } catch {
        setUserRole('despachador');
      }
    };

    initUser();
  }, [isSupabase, router]);

  // Cargar pedidos y productos
  const fetchOrdersAndProducts = async () => {
    try {
      const [allOrders, allProds] = await Promise.all([
        dataService.getOrders('all'),
        dataService.getProducts(),
      ]);
      setOrders(allOrders);
      setProducts(allProds);
    } catch (err) {
      console.error('Error cargando pedidos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrdersAndProducts();

    const interval = setInterval(() => {
      fetchOrdersAndProducts();
    }, 5000);

    const handleStorage = () => fetchOrdersAndProducts();
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
      fetchOrdersAndProducts();
    } catch (err: any) {
      message.error(err.message || 'Error al anular pedido');
    }
  };

  // Lógica para Tomar Pedido Mostrador
  const handleAddItemToCounterOrder = (prodId: string) => {
    const existing = selectedItems.find((i) => i.productId === prodId);
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;

    if (existing) {
      if (existing.quantity >= prod.stock) {
        message.warning(`No hay más stock disponible para ${prod.name}`);
        return;
      }
      setSelectedItems(
        selectedItems.map((i) =>
          i.productId === prodId ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    } else {
      if (prod.stock <= 0) {
        message.warning(`El producto ${prod.name} está agotado`);
        return;
      }
      setSelectedItems([...selectedItems, { productId: prodId, quantity: 1 }]);
    }
  };

  const handleScanCounterItem = (code: string) => {
    const cleaned = code.trim().toLowerCase();
    const prod = products.find(
      (p) =>
        p.id.toLowerCase() === cleaned ||
        (p.barcode && p.barcode.toLowerCase() === cleaned) ||
        p.name.toLowerCase() === cleaned
    );
    if (!prod) {
      message.error(`Producto con código "${code}" no encontrado.`);
      return;
    }
    handleAddItemToCounterOrder(prod.id);
    message.success(`¡${prod.name} agregado al pedido!`);
  };

  const handleUpdateCounterItemQty = (prodId: string, qty: number) => {
    if (qty <= 0) {
      setSelectedItems(selectedItems.filter((i) => i.productId !== prodId));
      return;
    }
    const prod = products.find((p) => p.id === prodId);
    if (prod && qty > prod.stock) {
      message.warning(`Stock máximo disponible: ${prod.stock}`);
      qty = prod.stock;
    }
    setSelectedItems(
      selectedItems.map((i) =>
        i.productId === prodId ? { ...i, quantity: qty } : i
      )
    );
  };

  const handleCreateCounterOrder = async (dispatchImmediately: boolean = false) => {
    if (selectedItems.length === 0) {
      message.warning('Debes agregar al menos un producto al pedido.');
      return;
    }

    try {
      setSubmittingOrder(true);
      const itemsPayload = selectedItems.map((item) => {
        const prod = products.find((p) => p.id === item.productId)!;
        return { product: prod, quantity: item.quantity };
      });

      const res = await dataService.createOrder(
        orderCustomerName.trim() || 'Cliente Mostrador',
        orderCustomerPhone.trim(),
        orderNotes.trim() ? `[Mostrador] ${orderNotes.trim()}` : '[Mostrador]',
        itemsPayload
      );

      message.success(`¡Pedido #${res.order_number} generado con éxito!`);
      setTakeOrderModalOpen(false);
      setSelectedItems([]);
      setOrderCustomerName('Cliente Mostrador');
      setOrderCustomerPhone('');
      setOrderNotes('');

      await fetchOrdersAndProducts();

      if (dispatchImmediately) {
        // Cargar pedido recién creado y abrir modal de cobro
        const created = await dataService.getOrder(res.order_id);
        if (created) {
          setSelectedOrderForDispatch(created);
          setDispatchModalOpen(true);
        }
      }
    } catch (err: any) {
      message.error(err.message || 'Error al crear el pedido.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const counterOrderTotal = selectedItems.reduce((sum, item) => {
    const prod = products.find((p) => p.id === item.productId);
    return sum + (prod ? prod.price * item.quantity : 0);
  }, 0);

  // Pedidos divididos por estado
  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const dispatchedOrders = orders.filter((o) => o.status === 'dispatched');
  const inactiveOrders = orders.filter((o) => o.status === 'cancelled' || o.status === 'expired');

  // Filtro de pedidos pendientes
  const filteredPendingOrders = pendingOrders.filter((o) => {
    if (pendingFilter === 'immediate') return o.pickup_type !== 'scheduled';
    if (pendingFilter === 'scheduled') return o.pickup_type === 'scheduled';
    if (pendingFilter === 'on_arrival') return o.preparation_mode === 'on_arrival';
    return true;
  });

  const handleUpdateKitchen = async (orderId: string, status: any) => {
    try {
      await dataService.updateKitchenStatus(orderId, status);
      message.success(
        status === 'cooking'
          ? 'Cocina iniciada para el pedido.'
          : 'Comida marcada como lista para entregar.'
      );
      fetchOrdersAndProducts();
    } catch {
      message.error('No se pudo actualizar el estado de cocina.');
    }
  };

  // Estadísticas
  const totalRevenue = dispatchedOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const isAdmin = userRole === 'admin';

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
          {record.pickup_type === 'scheduled' ? (
            <Tag color="purple" style={{ margin: 0, fontSize: 11, fontWeight: 700 }}>
              🕒 Cita: {record.scheduled_pickup_time}
            </Tag>
          ) : (
            <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
              ⚡ Inmediato
            </Tag>
          )}
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
      title: 'Cocina & Preparación',
      key: 'prep_status',
      render: (_: any, record: Order) => {
        if (record.preparation_mode === 'on_arrival') {
          if (record.kitchen_status === 'cooking') {
            return (
              <Space direction="vertical" size={4}>
                <Tag color="processing" style={{ fontWeight: 700, margin: 0 }}>
                  🔥 Cocinando en mostrador
                </Tag>
                <Button
                  size="small"
                  type="primary"
                  style={{ background: '#10b981', fontSize: 11 }}
                  onClick={() => handleUpdateKitchen(record.id, 'ready')}
                >
                  ✅ Comida Lista
                </Button>
              </Space>
            );
          }
          if (record.kitchen_status === 'ready') {
            return (
              <Tag color="success" style={{ fontWeight: 700 }}>
                📦 Comida Lista
              </Tag>
            );
          }
          return (
            <Space direction="vertical" size={4}>
              <Tag color="warning" style={{ fontWeight: 700, margin: 0 }}>
                🍳 Esperar al cliente
              </Tag>
              <div style={{ fontSize: 11, color: '#92400e' }}>
                No cocinar hasta que llegue a caja
              </div>
              <Button
                size="small"
                type="primary"
                style={{ background: '#d97706', fontSize: 11 }}
                onClick={() => handleUpdateKitchen(record.id, 'cooking')}
              >
                👨‍🍳 Llegó cliente / Cocinar
              </Button>
            </Space>
          );
        }
        return (
          <Tag color="default" style={{ margin: 0, color: '#475569' }}>
            📦 Empacado / Listo
          </Tag>
        );
      },
    },
    {
      title: 'Productos Solicitados',
      key: 'items',
      render: (_: any, record: Order) => (
        <div style={{ fontSize: 13 }}>
          {record.order_items?.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <strong>{item.quantity}x</strong> <span>{item.product_name}</span>
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
        const isScheduled = record.pickup_type === 'scheduled';
        return (
          <Space direction="vertical" size={2}>
            <Space>
              <ClockCircleOutlined style={{ color: isUrgent ? '#ef4444' : '#10b981' }} />
              <Tag color={isUrgent ? 'error' : isScheduled ? 'purple' : 'success'} style={{ fontSize: 12, fontWeight: 700 }}>
                {remaining > 0 ? formatCountdown(remaining) : 'Venciendo...'}
              </Tag>
            </Space>
            {isScheduled && (
              <span style={{ fontSize: 11, color: '#7c3aed' }}>
                Hora acordada: {record.scheduled_pickup_time}
              </span>
            )}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Title level={2} style={{ margin: 0 }}>
                Panel de Despacho & Caja
              </Title>
              <Tag color={isAdmin ? 'gold' : 'cyan'} style={{ fontSize: 13, padding: '2px 10px' }}>
                {isAdmin ? '🛡️ Administrador' : '📦 Despachador'}
              </Tag>
            </div>
            <Text type="secondary">
              Atendiendo como: <strong>{currentUser?.name || currentUser?.email || 'Despachador'}</strong>
            </Text>
          </div>

          <Space wrap>
            <Button
              type="primary"
              style={{ background: '#0d9488' }}
              icon={<ShoppingCartOutlined />}
              onClick={() => setTakeOrderModalOpen(true)}
            >
              + Tomar Pedido Mostrador
            </Button>

            <Link href="/admin/balance">
              <Button icon={<DollarOutlined />}>
                Balance de Ventas
              </Button>
            </Link>

            <Button icon={<ReloadOutlined />} onClick={fetchOrdersAndProducts} loading={loading}>
              Refrescar
            </Button>

            <Link href="/admin/inventario">
              <Button type="default">
                Inventario
              </Button>
            </Link>

            {isAdmin && (
              <Link href="/admin/usuarios">
                <Button type="default" icon={<TeamOutlined />}>
                  Personal & Roles
                </Button>
              </Link>
            )}
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
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                      <Segmented
                        value={pendingFilter}
                        onChange={(val) => setPendingFilter(val as any)}
                        options={[
                          { value: 'all', label: `Todos (${pendingOrders.length})` },
                          { value: 'immediate', label: `⚡ Inmediatos (~10m) (${pendingOrders.filter(o => o.pickup_type !== 'scheduled').length})` },
                          { value: 'scheduled', label: `🕒 Programados (${pendingOrders.filter(o => o.pickup_type === 'scheduled').length})` },
                          { value: 'on_arrival', label: `🍳 Al Llegar (${pendingOrders.filter(o => o.preparation_mode === 'on_arrival').length})` },
                        ]}
                      />
                    </div>

                    <Table
                      columns={pendingColumns}
                      dataSource={filteredPendingOrders}
                      rowKey="id"
                      loading={loading}
                      pagination={{ pageSize: 8 }}
                      locale={{
                        emptyText: 'No hay pedidos pendientes con este filtro.',
                      }}
                    />
                  </div>
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

      {/* Modal para Tomar Pedido Presencial en Mostrador */}
      <Modal
        open={takeOrderModalOpen}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCartOutlined style={{ color: '#0d9488' }} />
            <span>Tomar Pedido Mostrador (Despacho Rápido)</span>
          </div>
        }
        onCancel={() => setTakeOrderModalOpen(false)}
        width={700}
        footer={[
          <Button key="cancel" onClick={() => setTakeOrderModalOpen(false)}>
            Cancelar
          </Button>,
          <Button
            key="submit-queue"
            loading={submittingOrder}
            onClick={() => handleCreateCounterOrder(false)}
          >
            Guardar Pedido Pendiente
          </Button>,
          <Button
            key="submit-charge"
            type="primary"
            style={{ background: '#0d9488' }}
            loading={submittingOrder}
            onClick={() => handleCreateCounterOrder(true)}
          >
            Cobrar & Despachar Ya
          </Button>,
        ]}
      >
        <div style={{ marginTop: 12 }}>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Text strong style={{ fontSize: 13 }}>Nombre del Cliente:</Text>
              <Input
                value={orderCustomerName}
                onChange={(e) => setOrderCustomerName(e.target.value)}
                placeholder="Cliente Mostrador"
                style={{ marginTop: 4, marginBottom: 12 }}
              />
            </Col>
            <Col xs={24} sm={12}>
              <Text strong style={{ fontSize: 13 }}>Teléfono (Opcional):</Text>
              <Input
                value={orderCustomerPhone}
                onChange={(e) => setOrderCustomerPhone(e.target.value)}
                placeholder="Ej: 8888-8888"
                style={{ marginTop: 4, marginBottom: 12 }}
              />
            </Col>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 12px 0' }}>
            <Text strong style={{ fontSize: 13 }}>Seleccionar Productos:</Text>
            <Button
              size="small"
              type="dashed"
              icon={<CameraOutlined style={{ color: '#0d9488' }} />}
              onClick={() => setCounterScannerOpen(true)}
              style={{ borderColor: '#0d9488', color: '#0d9488', fontWeight: 600 }}
            >
              📷 Escanear con Cámara
            </Button>
          </div>

          {/* Selector de productos */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxHeight: 150, overflowY: 'auto', padding: 4, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            {products.map((p) => (
              <Button
                key={p.id}
                size="small"
                disabled={p.stock <= 0}
                onClick={() => handleAddItemToCounterOrder(p.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span>{p.name}</span>
                <Tag color={p.stock > 0 ? 'cyan' : 'default'} style={{ margin: 0, fontSize: 11 }}>
                  {p.stock > 0 ? `${p.stock} disp.` : 'Agotado'}
                </Tag>
                <strong>{formatCurrency(p.price)}</strong>
              </Button>
            ))}
          </div>

          {/* Items seleccionados en el pedido */}
          <div style={{ marginTop: 16 }}>
            <Text strong>Productos en este Pedido:</Text>
            {selectedItems.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                Haz clic en los productos de arriba para agregarlos.
              </div>
            ) : (
              <div style={{ marginTop: 8, border: '1px solid #e2e8f0', borderRadius: 8, padding: 8 }}>
                {selectedItems.map((item) => {
                  const prod = products.find((p) => p.id === item.productId);
                  if (!prod) return null;
                  return (
                    <div
                      key={item.productId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 0',
                        borderBottom: '1px solid #f8fafc',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{prod.name}</span>
                      <Space>
                        <InputNumber
                          min={1}
                          max={prod.stock}
                          value={item.quantity}
                          onChange={(val) => handleUpdateCounterItemQty(item.productId, val || 0)}
                          size="small"
                          style={{ width: 64 }}
                        />
                        <span style={{ minWidth: 80, textAlign: 'right', fontWeight: 700 }}>
                          {formatCurrency(prod.price * item.quantity)}
                        </span>
                        <Button
                          size="small"
                          danger
                          type="text"
                          onClick={() => handleUpdateCounterItemQty(item.productId, 0)}
                        >
                          ✕
                        </Button>
                      </Space>
                    </div>
                  );
                })}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 8, borderTop: '2px dashed #e2e8f0', fontWeight: 800, fontSize: 16 }}>
                  <span>Total a Pagar:</span>
                  <span style={{ color: '#0d9488' }}>{formatCurrency(counterOrderTotal)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal de Despacho y Registro de Pago */}
      <DispatchModal
        visible={dispatchModalOpen}
        order={selectedOrderForDispatch}
        currentUser={currentUser}
        onClose={() => setDispatchModalOpen(false)}
        onSuccess={fetchOrdersAndProducts}
      />

      {/* Escáner de Código de Barras / Cámara para Pedido Mostrador */}
      <BarcodeScannerModal
        visible={counterScannerOpen}
        onClose={() => setCounterScannerOpen(false)}
        onScan={handleScanCounterItem}
        title="Escanear Producto para Pedido Mostrador"
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
