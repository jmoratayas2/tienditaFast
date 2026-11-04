'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Typography,
  Card,
  Table,
  Tag,
  Button,
  Space,
  Row,
  Col,
  Statistic,
  Select,
  DatePicker,
  Divider,
  Modal,
  Spin,
  Empty,
  Tooltip,
  Alert,
  message,
} from 'antd';
import {
  DollarOutlined,
  ShoppingOutlined,
  CreditCardOutlined,
  BankOutlined,
  PrinterOutlined,
  DownloadOutlined,
  UserOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  CalendarOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { Navbar } from '@/components/Navbar';
import { Order, StaffUser, UserRole, PaymentItem } from '@/lib/types';
import { dataService } from '@/lib/dataService';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { isSupabaseConfigured, createClientBrowser } from '@/lib/supabase/client';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom';

interface UserSalesSummary {
  userId: string;
  userName: string;
  userRole?: UserRole;
  userEmail?: string;
  ordersCount: number;
  totalSales: number;
  cashAmount: number;
  cashReceived: number;
  cashChange: number;
  cardAmount: number;
  transferAmount: number;
  otherAmount: number;
  averageTicket: number;
  orders: Order[];
}

export default function AdminBalancePage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole>('despachador');

  // Filtros
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customRange, setCustomRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');

  // Modal de Detalle / Arqueo
  const [detailUser, setDetailUser] = useState<UserSalesSummary | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Arqueo a imprimir
  const [printUser, setPrintUser] = useState<UserSalesSummary | null>(null);

  const isConnected = isSupabaseConfigured();

  // 1. Cargar usuario y verificar autenticación
  useEffect(() => {
    const initAuth = async () => {
      let email = '';
      if (isConnected) {
        const supabase = createClientBrowser();
        const { data } = await supabase.auth.getUser();
        if (!data?.user) {
          router.push('/admin/login');
          return;
        }
        setCurrentUser(data.user);
        email = data.user.email || '';
      } else {
        const local = localStorage.getItem('tiendita_current_staff');
        if (!local) {
          router.push('/admin/login');
          return;
        }
        try {
          const parsed = JSON.parse(local);
          setCurrentUser(parsed);
          email = parsed.email || '';
          setUserRole(parsed.role || 'despachador');
        } catch {
          router.push('/admin/login');
          return;
        }
      }

      try {
        const staffList = await dataService.getStaffUsers();
        setStaffUsers(staffList);
        const match = staffList.find((s) => s.email.toLowerCase() === email.toLowerCase());
        if (match) {
          setUserRole(match.role);
        } else if (email.toLowerCase().includes('admin')) {
          setUserRole('admin');
        }
      } catch {
        // fallback
      }
    };

    initAuth();
  }, [isConnected, router]);

  // 2. Cargar pedidos
  const loadData = async () => {
    try {
      setLoading(true);
      const [allOrders, staff] = await Promise.all([
        dataService.getOrders('all'),
        dataService.getStaffUsers(),
      ]);
      setOrders(allOrders);
      setStaffUsers(staff);
    } catch (err: any) {
      message.error(err.message || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 3. Filtrar pedidos despachados por rango de fecha
  const filteredDispatchedOrders = useMemo(() => {
    const now = dayjs();
    const startOfToday = now.startOf('day');
    const endOfToday = now.endOf('day');

    return orders.filter((o) => {
      // Solo pedidos efectivamente despachados y cobrados
      if (o.status !== 'dispatched') return false;

      const orderTime = dayjs(o.dispatched_at || o.created_at);

      if (datePreset === 'today') {
        return orderTime.isAfter(startOfToday) && orderTime.isBefore(endOfToday);
      }
      if (datePreset === 'yesterday') {
        const startYesterday = now.subtract(1, 'day').startOf('day');
        const endYesterday = now.subtract(1, 'day').endOf('day');
        return orderTime.isAfter(startYesterday) && orderTime.isBefore(endYesterday);
      }
      if (datePreset === 'week') {
        const startWeek = now.subtract(7, 'day').startOf('day');
        return orderTime.isAfter(startWeek) && orderTime.isBefore(endOfToday);
      }
      if (datePreset === 'month') {
        const startMonth = now.startOf('month');
        return orderTime.isAfter(startMonth) && orderTime.isBefore(endOfToday);
      }
      if (datePreset === 'custom' && customRange && customRange[0] && customRange[1]) {
        const startCustom = customRange[0].startOf('day');
        const endCustom = customRange[1].endOf('day');
        return orderTime.isAfter(startCustom) && orderTime.isBefore(endCustom);
      }
      // 'all'
      return true;
    });
  }, [orders, datePreset, customRange]);

  // 4. Agrupar y consolidar ventas por usuario
  const usersSalesList: UserSalesSummary[] = useMemo(() => {
    const map = new Map<string, UserSalesSummary>();

    // Inicializar mapa con el personal registrado para asegurar que todos aparezcan
    staffUsers.forEach((staff) => {
      const key = staff.full_name || staff.email;
      map.set(key, {
        userId: staff.id,
        userName: staff.full_name,
        userRole: staff.role,
        userEmail: staff.email,
        ordersCount: 0,
        totalSales: 0,
        cashAmount: 0,
        cashReceived: 0,
        cashChange: 0,
        cardAmount: 0,
        transferAmount: 0,
        otherAmount: 0,
        averageTicket: 0,
        orders: [],
      });
    });

    // Procesar cada orden despachada
    filteredDispatchedOrders.forEach((order) => {
      const dispatcherName = order.dispatched_by_name || 'Despachador en Turno';
      let entry = map.get(dispatcherName);

      if (!entry) {
        entry = {
          userId: order.dispatched_by_id || 'unknown',
          userName: dispatcherName,
          userRole: 'despachador',
          ordersCount: 0,
          totalSales: 0,
          cashAmount: 0,
          cashReceived: 0,
          cashChange: 0,
          cardAmount: 0,
          transferAmount: 0,
          otherAmount: 0,
          averageTicket: 0,
          orders: [],
        };
        map.set(dispatcherName, entry);
      }

      entry.ordersCount += 1;
      entry.totalSales += order.total_amount;
      entry.orders.push(order);

      // Desglose de métodos de pago
      if (order.payment_details && order.payment_details.length > 0) {
        order.payment_details.forEach((p) => {
          if (p.method === 'efectivo') {
            entry.cashAmount += p.amount;
            entry.cashReceived += p.received || p.amount;
            entry.cashChange += p.change || 0;
          } else if (p.method === 'tarjeta') {
            entry.cardAmount += p.amount;
          } else if (p.method === 'transferencia' || p.method === 'sinpe') {
            entry.transferAmount += p.amount;
          } else {
            entry.otherAmount += p.amount;
          }
        });
      } else {
        // Fallback: si no tenía desglose (legacy), se asume efectivo
        entry.cashAmount += order.total_amount;
        entry.cashReceived += order.total_amount;
      }

      entry.averageTicket = entry.ordersCount > 0 ? entry.totalSales / entry.ordersCount : 0;
    });

    const result = Array.from(map.values());

    // Si hay filtro por usuario específico
    if (selectedUserFilter !== 'all') {
      return result.filter(
        (u) =>
          u.userId === selectedUserFilter ||
          u.userName.toLowerCase() === selectedUserFilter.toLowerCase()
      );
    }

    // Ordenar por total vendido descendente
    return result.sort((a, b) => b.totalSales - a.totalSales);
  }, [filteredDispatchedOrders, staffUsers, selectedUserFilter]);

  // 5. Totales generales del período seleccionado
  const grandTotals = useMemo(() => {
    let sales = 0;
    let count = 0;
    let cash = 0;
    let cashReceived = 0;
    let cashChange = 0;
    let card = 0;
    let transfer = 0;

    usersSalesList.forEach((u) => {
      sales += u.totalSales;
      count += u.ordersCount;
      cash += u.cashAmount;
      cashReceived += u.cashReceived;
      cashChange += u.cashChange;
      card += u.cardAmount;
      transfer += u.transferAmount;
    });

    return {
      sales,
      count,
      cash,
      cashReceived,
      cashChange,
      card,
      transfer,
      avgTicket: count > 0 ? sales / count : 0,
    };
  }, [usersSalesList]);

  // 6. Exportar a CSV
  const handleExportCSV = () => {
    if (filteredDispatchedOrders.length === 0) {
      message.warning('No hay ventas registradas en el período para exportar.');
      return;
    }

    const headers = [
      'No. Pedido',
      'Fecha Despacho',
      'Despachador',
      'Cliente',
      'Telefono',
      'Total (Q)',
      'Efectivo (Q)',
      'Tarjeta (Q)',
      'Transferencia (Q)',
      'Metodos y Referencias',
    ];

    const rows = filteredDispatchedOrders.map((o) => {
      let cash = 0;
      let card = 0;
      let transfer = 0;
      const refs: string[] = [];

      (o.payment_details || []).forEach((p) => {
        if (p.method === 'efectivo') cash += p.amount;
        if (p.method === 'tarjeta') card += p.amount;
        if (p.method === 'transferencia' || p.method === 'sinpe') transfer += p.amount;
        if (p.reference) refs.push(`${p.method.toUpperCase()}: ${p.reference}`);
      });

      return [
        `#${o.order_number}`,
        formatDateTime(o.dispatched_at || o.created_at),
        `"${o.dispatched_by_name || 'Despachador'}"`,
        `"${o.customer_name}"`,
        `"${o.customer_phone || ''}"`,
        o.total_amount.toFixed(2),
        cash.toFixed(2),
        card.toFixed(2),
        transfer.toFixed(2),
        `"${refs.join(' | ')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `balance_ventas_${datePreset}_${dayjs().format('YYYYMMDD_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Reporte exportado exitosamente.');
  };

  // 7. Imprimir corte de caja
  const handlePrintCorte = (summary: UserSalesSummary) => {
    setPrintUser(summary);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Columnas para la tabla principal
  const columns = [
    {
      title: 'Despachador / Cajero',
      key: 'user',
      render: (_: any, record: UserSalesSummary) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: record.userRole === 'admin' ? '#fef3c7' : '#ccfbf1',
              color: record.userRole === 'admin' ? '#d97706' : '#0d9488',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            {record.userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{record.userName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Tag color={record.userRole === 'admin' ? 'gold' : 'cyan'} style={{ margin: 0, fontSize: 10 }}>
                {record.userRole === 'admin' ? '🛡️ Admin' : '📦 Despachador'}
              </Tag>
              {record.userEmail && (
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{record.userEmail}</span>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Pedidos',
      dataIndex: 'ordersCount',
      key: 'ordersCount',
      align: 'center' as const,
      render: (count: number) => (
        <Tag color={count > 0 ? 'blue' : 'default'} style={{ fontSize: 12, fontWeight: 700 }}>
          {count} {count === 1 ? 'pedido' : 'pedidos'}
        </Tag>
      ),
    },
    {
      title: 'Efectivo Neto',
      dataIndex: 'cashAmount',
      key: 'cashAmount',
      render: (val: number, record: UserSalesSummary) => (
        <div>
          <strong style={{ color: '#16a34a' }}>{formatCurrency(val)}</strong>
          {record.cashChange > 0 && (
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Vuelto: {formatCurrency(record.cashChange)}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Tarjeta / POS',
      dataIndex: 'cardAmount',
      key: 'cardAmount',
      render: (val: number) => (
        <span style={{ color: '#2563eb' }}>{formatCurrency(val)}</span>
      ),
    },
    {
      title: 'Transferencia / QR',
      dataIndex: 'transferAmount',
      key: 'transferAmount',
      render: (val: number) => (
        <span style={{ color: '#7c3aed' }}>{formatCurrency(val)}</span>
      ),
    },
    {
      title: 'Total Vendido',
      dataIndex: 'totalSales',
      key: 'totalSales',
      render: (val: number) => (
        <strong style={{ fontSize: 15, color: '#0d9488' }}>
          {formatCurrency(val)}
        </strong>
      ),
    },
    {
      title: 'Ticket Promedio',
      dataIndex: 'averageTicket',
      key: 'averageTicket',
      render: (val: number) => <span>{formatCurrency(val)}</span>,
    },
    {
      title: 'Acciones',
      key: 'actions',
      align: 'right' as const,
      render: (_: any, record: UserSalesSummary) => (
        <Space size="small">
          <Button
            size="small"
            type="primary"
            style={{ background: '#0d9488' }}
            icon={<FileTextOutlined />}
            onClick={() => {
              setDetailUser(record);
              setDetailModalOpen(true);
            }}
          >
            Ver Desglose
          </Button>

          <Button
            size="small"
            icon={<PrinterOutlined />}
            onClick={() => handlePrintCorte(record)}
            disabled={record.ordersCount === 0}
          >
            Corte
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '24px 16px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {/* Cabecera y botón volver */}
        <div style={{ marginBottom: 20 }}>
          <Link href="/admin">
            <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 12 }}>
              Volver al Panel de Despacho
            </Button>
          </Link>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div>
              <Title level={2} style={{ margin: 0, color: '#0f172a' }}>
                💰 Balance & Corte de Ventas por Usuario
              </Title>
              <Paragraph style={{ margin: '4px 0 0', color: '#64748b' }}>
                Resumen de ventas recaudadas, métodos de pago y arqueo de caja por despachador en turno.
              </Paragraph>
            </div>

            <Space wrap>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
                Actualizar
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExportCSV}
                disabled={filteredDispatchedOrders.length === 0}
              >
                Exportar CSV
              </Button>
            </Space>
          </div>
        </div>

        {/* Barra de Filtros (Tiempo y Despachador) */}
        <Card style={{ marginBottom: 24, borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} sm={14} md={16}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Text strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CalendarOutlined style={{ color: '#0d9488' }} /> Período:
                </Text>
                <Select
                  value={datePreset}
                  onChange={(val: DatePreset) => setDatePreset(val)}
                  style={{ width: 170 }}
                  options={[
                    { value: 'today', label: '☀️ Hoy (Turno actual)' },
                    { value: 'yesterday', label: '🌙 Ayer' },
                    { value: 'week', label: '📅 Últimos 7 días' },
                    { value: 'month', label: '🗓️ Este Mes' },
                    { value: 'all', label: '♾️ Histórico Completo' },
                    { value: 'custom', label: '📆 Personalizado' },
                  ]}
                />

                {datePreset === 'custom' && (
                  <RangePicker
                    value={customRange as any}
                    onChange={(dates: any) => setCustomRange(dates)}
                    format="DD/MM/YYYY"
                    style={{ minWidth: 240 }}
                  />
                )}
              </div>
            </Col>

            <Col xs={24} sm={10} md={8}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-end' }}>
                <Text strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <UserOutlined style={{ color: '#0d9488' }} /> Cajero:
                </Text>
                <Select
                  value={selectedUserFilter}
                  onChange={(val) => setSelectedUserFilter(val)}
                  style={{ width: '100%', maxWidth: 220 }}
                  options={[
                    { value: 'all', label: 'Todos los Despachadores' },
                    ...staffUsers.map((s) => ({
                      value: s.id,
                      label: `${s.full_name} (${s.role === 'admin' ? 'Admin' : 'Despachador'})`,
                    })),
                  ]}
                />
              </div>
            </Col>
          </Row>
        </Card>

        {/* Tarjetas KPI de Totales Generales */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 12, border: '1px solid #ccfbf1', background: '#f0fdfa' }}>
              <Statistic
                title={<span style={{ fontWeight: 600, color: '#0f766e' }}>Total Vendido ({datePreset === 'today' ? 'Hoy' : 'Período'})</span>}
                value={grandTotals.sales}
                precision={2}
                prefix="Q"
                valueStyle={{ color: '#0d9488', fontWeight: 800, fontSize: 24 }}
              />
              <div style={{ marginTop: 6, fontSize: 12, color: '#0f766e' }}>
                {grandTotals.count} {grandTotals.count === 1 ? 'pedido despachado' : 'pedidos despachados'}
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 12, border: '1px solid #bbf7d0', background: '#f0fdf4' }}>
              <Statistic
                title={<span style={{ fontWeight: 600, color: '#166534' }}>Efectivo en Caja (Neto)</span>}
                value={grandTotals.cash}
                precision={2}
                prefix="Q"
                valueStyle={{ color: '#16a34a', fontWeight: 800, fontSize: 24 }}
              />
              <div style={{ marginTop: 6, fontSize: 12, color: '#166534' }}>
                Vuelto entregado: {formatCurrency(grandTotals.cashChange)}
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 12, border: '1px solid #bfdbfe', background: '#eff6ff' }}>
              <Statistic
                title={<span style={{ fontWeight: 600, color: '#1e40af' }}>Cobros con Tarjeta / POS</span>}
                value={grandTotals.card}
                precision={2}
                prefix="Q"
                valueStyle={{ color: '#2563eb', fontWeight: 800, fontSize: 24 }}
              />
              <div style={{ marginTop: 6, fontSize: 12, color: '#1e40af' }}>
                Comprobantes electrónicos
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card style={{ borderRadius: 12, border: '1px solid #ddd6fe', background: '#f5f3ff' }}>
              <Statistic
                title={<span style={{ fontWeight: 600, color: '#5b21b6' }}>Transferencias / QR</span>}
                value={grandTotals.transfer}
                precision={2}
                prefix="Q"
                valueStyle={{ color: '#7c3aed', fontWeight: 800, fontSize: 24 }}
              />
              <div style={{ marginTop: 6, fontSize: 12, color: '#5b21b6' }}>
                Ticket promedio: {formatCurrency(grandTotals.avgTicket)}
              </div>
            </Card>
          </Col>
        </Row>

        {/* Tabla Principal: Balance por Usuario */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserOutlined style={{ color: '#0d9488' }} />
              <span>Desglose de Ventas por Despachador</span>
            </div>
          }
          style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size="large" />
            </div>
          ) : usersSalesList.length === 0 ? (
            <Empty description="No hay despachos registrados para este filtro." />
          ) : (
            <Table
              dataSource={usersSalesList}
              columns={columns}
              rowKey="userId"
              pagination={false}
              scroll={{ x: 800 }}
            />
          )}
        </Card>
      </main>

      {/* ================================================================= */}
      {/* MODAL DE DETALLE Y ARQUEO INDIVIDUAL                             */}
      {/* ================================================================= */}
      <Modal
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileTextOutlined style={{ color: '#0d9488', fontSize: 20 }} />
            <span>Arqueo y Desglose: {detailUser?.userName}</span>
          </div>
        }
        width={850}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            Cerrar
          </Button>,
          <Button
            key="print"
            type="primary"
            style={{ background: '#0d9488' }}
            icon={<PrinterOutlined />}
            onClick={() => {
              if (detailUser) handlePrintCorte(detailUser);
            }}
          >
            Imprimir Comprobante de Corte
          </Button>,
        ]}
      >
        {detailUser && (
          <div style={{ marginTop: 12 }}>
            {/* Resumen del Arqueo */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <Row gutter={[16, 12]}>
                <Col xs={12} sm={6}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Pedidos Cobrados:</Text>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{detailUser.ordersCount}</div>
                </Col>
                <Col xs={12} sm={6}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Efectivo a Entregar:</Text>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>
                    {formatCurrency(detailUser.cashAmount)}
                  </div>
                </Col>
                <Col xs={12} sm={6}>
                  <Text type="secondary" style={{ fontSize: 12 }}>En Tarjetas / POS:</Text>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#2563eb' }}>
                    {formatCurrency(detailUser.cardAmount)}
                  </div>
                </Col>
                <Col xs={12} sm={6}>
                  <Text type="secondary" style={{ fontSize: 12 }}>En Transferencias:</Text>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#7c3aed' }}>
                    {formatCurrency(detailUser.transferAmount)}
                  </div>
                </Col>
              </Row>
              <Divider style={{ margin: '12px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>Gran Total de Ventas:</Text>
                <span style={{ fontSize: 20, fontWeight: 800, color: '#0d9488' }}>
                  {formatCurrency(detailUser.totalSales)}
                </span>
              </div>
            </div>

            {/* Listado de Pedidos Despachados por este usuario */}
            <Text strong style={{ fontSize: 14 }}>
              Historial de Pedidos Despachados ({detailUser.orders.length}):
            </Text>

            {detailUser.orders.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>
                No se despacharon pedidos en este período.
              </div>
            ) : (
              <Table
                dataSource={detailUser.orders}
                rowKey="id"
                pagination={{ pageSize: 5 }}
                size="small"
                style={{ marginTop: 10 }}
                columns={[
                  {
                    title: '# Pedido',
                    dataIndex: 'order_number',
                    key: 'order_number',
                    render: (num: string, record: Order) => (
                      <Link href={`/order/${record.id}`} target="_blank" style={{ fontWeight: 700 }}>
                        #{num}
                      </Link>
                    ),
                  },
                  {
                    title: 'Hora',
                    key: 'time',
                    render: (_: any, record: Order) => (
                      <span>{dayjs(record.dispatched_at || record.created_at).format('HH:mm:ss')}</span>
                    ),
                  },
                  {
                    title: 'Cliente',
                    dataIndex: 'customer_name',
                    key: 'customer_name',
                  },
                  {
                    title: 'Métodos de Pago',
                    key: 'payments',
                    render: (_: any, record: Order) => (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(record.payment_details || []).map((p, idx) => (
                          <Tag
                            key={idx}
                            color={
                              p.method === 'efectivo'
                                ? 'green'
                                : p.method === 'tarjeta'
                                ? 'blue'
                                : 'purple'
                            }
                            style={{ margin: 0, fontSize: 11 }}
                          >
                            {p.method.toUpperCase()}: {formatCurrency(p.amount)}
                            {p.reference ? ` (${p.reference})` : ''}
                          </Tag>
                        ))}
                      </div>
                    ),
                  },
                  {
                    title: 'Total',
                    dataIndex: 'total_amount',
                    key: 'total_amount',
                    align: 'right' as const,
                    render: (val: number) => (
                      <strong>{formatCurrency(val)}</strong>
                    ),
                  },
                ]}
              />
            )}
          </div>
        )}
      </Modal>

      {/* ================================================================= */}
      {/* ÁREA DE IMPRESIÓN (Corte de Caja Térmico / Ticket)                */}
      {/* ================================================================= */}
      <div id="print-corte-area" style={{ display: 'none' }}>
        {printUser && (
          <div style={{ textAlign: 'center', lineHeight: 1.4 }}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 900 }}>LA TIENDITA</h2>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
              *** CORTE DE CAJA / CIERRE DE TURNO ***
            </div>
            <div style={{ fontSize: 11, margin: '6px 0', borderBottom: '1px dashed #000', paddingBottom: 6 }}>
              Fecha Impresión: {dayjs().format('DD/MM/YYYY HH:mm:ss')}
            </div>

            <div style={{ textAlign: 'left', fontSize: 12, margin: '10px 0' }}>
              <div><strong>Cajero / Despachador:</strong> {printUser.userName}</div>
              <div><strong>Período:</strong> {datePreset.toUpperCase()}</div>
              <div><strong>Cant. Pedidos Cobrados:</strong> {printUser.ordersCount}</div>
            </div>

            <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '8px 0', margin: '10px 0', textAlign: 'left', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>(+) Efectivo Cobrado:</span>
                <strong>{formatCurrency(printUser.cashAmount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>(+) Tarjetas / POS:</span>
                <strong>{formatCurrency(printUser.cardAmount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>(+) Transferencias / QR:</span>
                <strong>{formatCurrency(printUser.transferAmount)}</strong>
              </div>
              {printUser.otherAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>(+) Otros Medios:</span>
                  <strong>{formatCurrency(printUser.otherAmount)}</strong>
                </div>
              )}
              <div style={{ borderTop: '1px solid #000', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <strong>TOTAL RECAUDADO:</strong>
                <strong>{formatCurrency(printUser.totalSales)}</strong>
              </div>
            </div>

            <div style={{ textAlign: 'left', fontSize: 11, background: '#f5f5f5', padding: 8, margin: '10px 0' }}>
              <div><strong>EFECTIVO A ENTREGAR EN CAJA:</strong></div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#000' }}>
                {formatCurrency(printUser.cashAmount)}
              </div>
              <div style={{ fontSize: 10, color: '#555' }}>
                (Recibido: {formatCurrency(printUser.cashReceived)} - Cambio: {formatCurrency(printUser.cashChange)})
              </div>
            </div>

            <div style={{ marginTop: 40, borderTop: '1px solid #000', paddingTop: 6, fontSize: 11 }}>
              Firma del Despachador: {printUser.userName}
            </div>

            <div style={{ marginTop: 30, borderTop: '1px solid #000', paddingTop: 6, fontSize: 11 }}>
              Firma del Supervisor / Administrador
            </div>

            <div style={{ marginTop: 20, fontSize: 10, color: '#777' }}>
              Sistema La Tiendita • Control Interno
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

