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
  Tabs,
  InputNumber,
  Input,
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
  AuditOutlined,
  FieldTimeOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { Navbar } from '@/components/Navbar';
import { Order, StaffUser, UserRole, PaymentItem, ShiftCut } from '@/lib/types';
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
  const [shiftCuts, setShiftCuts] = useState<ShiftCut[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole>('despachador');

  // Filtros
  const [activeTab, setActiveTab] = useState<'open_shift' | 'cuts_history'>('open_shift');
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customRange, setCustomRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');

  // Modal de Detalle
  const [detailUser, setDetailUser] = useState<UserSalesSummary | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Modal para Realizar Corte de Turno
  const [cutModalOpen, setCutModalOpen] = useState(false);
  const [cutTargetUser, setCutTargetUser] = useState<string>('');
  const [countedCash, setCountedCash] = useState<number | null>(null);
  const [cutNotes, setCutNotes] = useState<string>('');
  const [submittingCut, setSubmittingCut] = useState(false);

  // Arqueo a imprimir (objeto temporal para el ticket de impresión)
  const [printCut, setPrintCut] = useState<{
    cutNumber: string;
    userName: string;
    startedAt: string;
    closedAt: string;
    ordersCount: number;
    cashExpected: number;
    cashCounted?: number | null;
    cashDifference?: number | null;
    cardTotal: number;
    transferTotal: number;
    otherTotal: number;
    totalSales: number;
    notes?: string | null;
  } | null>(null);

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
          setCutTargetUser(match.full_name);
        } else if (email.toLowerCase().includes('admin')) {
          setUserRole('admin');
          setCutTargetUser(email.split('@')[0]);
        }
      } catch {
        // fallback
      }
    };

    initAuth();
  }, [isConnected, router]);

  // 2. Cargar pedidos y cortes de caja
  const loadData = async () => {
    try {
      setLoading(true);
      const [allOrders, cuts, staff] = await Promise.all([
        dataService.getOrders('all'),
        dataService.getShiftCuts(),
        dataService.getStaffUsers(),
      ]);
      setOrders(allOrders);
      setShiftCuts(cuts);
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

  // 3. Filtrar pedidos despachados según el filtro de fecha
  const filteredDispatchedOrders = useMemo(() => {
    const now = dayjs();
    const startOfToday = now.startOf('day');
    const endOfToday = now.endOf('day');

    return orders.filter((o) => {
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
      return true;
    });
  }, [orders, datePreset, customRange]);

  // 4. Agrupar y consolidar ventas por usuario
  const usersSalesList: UserSalesSummary[] = useMemo(() => {
    const map = new Map<string, UserSalesSummary>();

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
        entry.cashAmount += order.total_amount;
        entry.cashReceived += order.total_amount;
      }

      entry.averageTicket = entry.ordersCount > 0 ? entry.totalSales / entry.ordersCount : 0;
    });

    const result = Array.from(map.values());

    if (selectedUserFilter !== 'all') {
      return result.filter(
        (u) =>
          u.userId === selectedUserFilter ||
          u.userName.toLowerCase() === selectedUserFilter.toLowerCase()
      );
    }

    return result.sort((a, b) => b.totalSales - a.totalSales);
  }, [filteredDispatchedOrders, staffUsers, selectedUserFilter]);

  // 5. Totales generales del período
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

  // 6. Información del turno no cerrado para el usuario seleccionado en el corte
  const targetUserUnclosedOrders = useMemo(() => {
    const target = cutTargetUser || currentUser?.name || currentUser?.email?.split('@')[0] || '';
    return orders.filter((o) => {
      const matchName = o.dispatched_by_name?.toLowerCase() === target.toLowerCase();
      const matchId = currentUser?.id && o.dispatched_by_id === currentUser.id;
      return o.status === 'dispatched' && !o.shift_cut_id && (matchName || matchId);
    });
  }, [orders, cutTargetUser, currentUser]);

  const targetUserShiftSummary = useMemo(() => {
    let sales = 0;
    let cash = 0;
    let card = 0;
    let transfer = 0;

    targetUserUnclosedOrders.forEach((o) => {
      sales += o.total_amount;
      (o.payment_details || []).forEach((p) => {
        if (p.method === 'efectivo') cash += p.amount;
        else if (p.method === 'tarjeta') card += p.amount;
        else if (p.method === 'transferencia' || p.method === 'sinpe') transfer += p.amount;
      });
    });

    const diff = countedCash !== null ? countedCash - cash : 0;

    return {
      sales,
      cash,
      card,
      transfer,
      count: targetUserUnclosedOrders.length,
      diff,
    };
  }, [targetUserUnclosedOrders, countedCash]);

  // Abrir modal de corte
  const handleOpenCutModal = (userName?: string) => {
    const userToCut = userName || currentUser?.name || currentUser?.email?.split('@')[0] || '';
    setCutTargetUser(userToCut);
    setCountedCash(null);
    setCutNotes('');
    setCutModalOpen(true);
  };

  // Confirmar y registrar el corte de caja
  const handleConfirmShiftCut = async () => {
    if (!cutTargetUser) {
      message.warning('Selecciona el despachador para el corte.');
      return;
    }

    if (targetUserUnclosedOrders.length === 0) {
      message.warning(`El usuario ${cutTargetUser} no tiene pedidos pendientes de corte.`);
      return;
    }

    try {
      setSubmittingCut(true);
      const staffMatch = staffUsers.find((s) => s.full_name.toLowerCase() === cutTargetUser.toLowerCase());

      const createdCut = await dataService.registerShiftCut({
        userId: staffMatch?.id || currentUser?.id || null,
        userName: cutTargetUser,
        userRole: staffMatch?.role || userRole,
        cashCounted: countedCash,
        notes: cutNotes || null,
      });

      message.success(`¡Corte ${createdCut.cut_number} registrado con éxito!`);
      setCutModalOpen(false);

      // Recargar datos y preparar impresión
      await loadData();

      setPrintCut({
        cutNumber: createdCut.cut_number,
        userName: createdCut.user_name,
        startedAt: createdCut.started_at,
        closedAt: createdCut.closed_at,
        ordersCount: createdCut.orders_count,
        cashExpected: createdCut.cash_expected,
        cashCounted: createdCut.cash_counted,
        cashDifference: createdCut.cash_difference,
        cardTotal: createdCut.card_total,
        transferTotal: createdCut.transfer_total,
        otherTotal: createdCut.other_total,
        totalSales: createdCut.total_sales,
        notes: createdCut.notes,
      });

      setTimeout(() => {
        window.print();
      }, 300);
    } catch (err: any) {
      message.error(err.message || 'Error al registrar el corte de caja');
    } finally {
      setSubmittingCut(false);
    }
  };

  // Imprimir un corte histórico ya registrado
  const handleReprintHistoricalCut = (cut: ShiftCut) => {
    setPrintCut({
      cutNumber: cut.cut_number,
      userName: cut.user_name,
      startedAt: cut.started_at,
      closedAt: cut.closed_at,
      ordersCount: cut.orders_count,
      cashExpected: cut.cash_expected,
      cashCounted: cut.cash_counted,
      cashDifference: cut.cash_difference,
      cardTotal: cut.card_total,
      transferTotal: cut.transfer_total,
      otherTotal: cut.other_total,
      totalSales: cut.total_sales,
      notes: cut.notes,
    });
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Exportar a CSV
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
      'Corte ID',
    ];

    const rows = filteredDispatchedOrders.map((o) => {
      let cash = 0;
      let card = 0;
      let transfer = 0;

      (o.payment_details || []).forEach((p) => {
        if (p.method === 'efectivo') cash += p.amount;
        if (p.method === 'tarjeta') card += p.amount;
        if (p.method === 'transferencia' || p.method === 'sinpe') transfer += p.amount;
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
        `"${o.shift_cut_id || 'Turno Abierto'}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `balance_ventas_${dayjs().format('YYYYMMDD_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success('Reporte exportado exitosamente.');
  };

  // Columnas para tabla de Ventas por Usuario (Turno Abierto)
  const usersColumns = [
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
            icon={<AuditOutlined />}
            onClick={() => handleOpenCutModal(record.userName)}
            disabled={record.ordersCount === 0}
            style={{ borderColor: '#eab308', color: '#ca8a04', fontWeight: 600 }}
          >
            Cerrar Turno
          </Button>
        </Space>
      ),
    },
  ];

  // Columnas para tabla del Historial de Cortes Registrados
  const cutsColumns = [
    {
      title: '# Corte',
      dataIndex: 'cut_number',
      key: 'cut_number',
      render: (num: string) => <Tag color="geekblue" style={{ fontWeight: 700 }}>{num}</Tag>,
    },
    {
      title: 'Despachador / Cajero',
      dataIndex: 'user_name',
      key: 'user_name',
      render: (name: string, record: ShiftCut) => (
        <div>
          <strong style={{ fontSize: 13 }}>{name}</strong>
          <div>
            <Tag color={record.user_role === 'admin' ? 'gold' : 'cyan'} style={{ fontSize: 10, margin: 0 }}>
              {record.user_role === 'admin' ? 'Admin' : 'Despachador'}
            </Tag>
          </div>
        </div>
      ),
    },
    {
      title: 'Cierre de Turno',
      dataIndex: 'closed_at',
      key: 'closed_at',
      render: (dateStr: string) => <span>{formatDateTime(dateStr)}</span>,
    },
    {
      title: 'Pedidos',
      dataIndex: 'orders_count',
      key: 'orders_count',
      align: 'center' as const,
      render: (count: number) => <Tag>{count} pedidos</Tag>,
    },
    {
      title: 'Total Vendido',
      dataIndex: 'total_sales',
      key: 'total_sales',
      render: (val: number) => <strong style={{ color: '#0d9488' }}>{formatCurrency(val)}</strong>,
    },
    {
      title: 'Efectivo Esperado',
      dataIndex: 'cash_expected',
      key: 'cash_expected',
      render: (val: number) => <span>{formatCurrency(val)}</span>,
    },
    {
      title: 'Efectivo Contado',
      dataIndex: 'cash_counted',
      key: 'cash_counted',
      render: (val: number | null | undefined) => (
        val !== null && val !== undefined ? (
          <strong style={{ color: '#16a34a' }}>{formatCurrency(val)}</strong>
        ) : (
          <span style={{ color: '#94a3b8' }}>-</span>
        )
      ),
    },
    {
      title: 'Diferencia',
      key: 'diff',
      render: (_: any, record: ShiftCut) => {
        if (record.cash_difference === null || record.cash_difference === undefined) {
          return <span style={{ color: '#94a3b8' }}>-</span>;
        }
        if (Math.abs(record.cash_difference) < 0.01) {
          return <Tag color="success">Cuadrada (Q 0.00)</Tag>;
        }
        if (record.cash_difference > 0) {
          return <Tag color="blue">Sobrante (+{formatCurrency(record.cash_difference)})</Tag>;
        }
        return <Tag color="error">Faltante ({formatCurrency(record.cash_difference)})</Tag>;
      },
    },
    {
      title: 'Tarjetas / Transferencias',
      key: 'other_payments',
      render: (_: any, record: ShiftCut) => (
        <div style={{ fontSize: 11, color: '#64748b' }}>
          <div>Tarjeta: {formatCurrency(record.card_total)}</div>
          <div>Transf: {formatCurrency(record.transfer_total)}</div>
        </div>
      ),
    },
    {
      title: 'Acciones',
      key: 'actions',
      align: 'right' as const,
      render: (_: any, record: ShiftCut) => (
        <Button
          size="small"
          icon={<PrinterOutlined />}
          onClick={() => handleReprintHistoricalCut(record)}
        >
          Reimprimir Ticket
        </Button>
      ),
    },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '24px 16px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {/* Cabecera y Botón Volver */}
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
                💰 Balance & Corte de Caja por Usuario
              </Title>
              <Paragraph style={{ margin: '4px 0 0', color: '#64748b' }}>
                Arqueo de caja, ventas por despachador y registro oficial de cierres de turno.
              </Paragraph>
            </div>

            <Space wrap>
              <Button
                type="primary"
                style={{ background: '#ca8a04', borderColor: '#ca8a04', fontWeight: 600 }}
                icon={<AuditOutlined />}
                onClick={() => handleOpenCutModal()}
              >
                ⚡ Realizar Corte de Turno
              </Button>
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

        {/* Tarjetas KPI de Totales */}
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
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
                Vouchers y autorizaciones
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

        {/* Pestañas: Turno Actual vs Historial de Cortes Registrados */}
        <Card style={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <Tabs
            activeKey={activeTab}
            onChange={(key: any) => setActiveTab(key)}
            items={[
              {
                key: 'open_shift',
                label: (
                  <span style={{ fontWeight: 700, fontSize: 14 }}>
                    ⚡ Turno Actual (Ventas Abiertas)
                  </span>
                ),
                children: (
                  <div>
                    {/* Filtros de Fecha y Cajero */}
                    <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Text strong style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <UserOutlined style={{ color: '#0d9488' }} /> Cajero:
                        </Text>
                        <Select
                          value={selectedUserFilter}
                          onChange={(val) => setSelectedUserFilter(val)}
                          style={{ width: 220 }}
                          options={[
                            { value: 'all', label: 'Todos los Despachadores' },
                            ...staffUsers.map((s) => ({
                              value: s.id,
                              label: `${s.full_name} (${s.role === 'admin' ? 'Admin' : 'Despachador'})`,
                            })),
                          ]}
                        />
                      </div>
                    </div>

                    {loading ? (
                      <div style={{ textAlign: 'center', padding: 40 }}>
                        <Spin size="large" />
                      </div>
                    ) : usersSalesList.length === 0 ? (
                      <Empty description="No hay despachos registrados para este filtro." />
                    ) : (
                      <Table
                        dataSource={usersSalesList}
                        columns={usersColumns}
                        rowKey="userId"
                        pagination={false}
                        scroll={{ x: 800 }}
                      />
                    )}
                  </div>
                ),
              },
              {
                key: 'cuts_history',
                label: (
                  <span style={{ fontWeight: 700, fontSize: 14 }}>
                    📑 Historial de Cortes Registrados ({shiftCuts.length})
                  </span>
                ),
                children: (
                  <div>
                    {shiftCuts.length === 0 ? (
                      <Empty description="Aún no se han registrado cierres de turno / cortes de caja." />
                    ) : (
                      <Table
                        dataSource={shiftCuts}
                        columns={cutsColumns}
                        rowKey="id"
                        pagination={{ pageSize: 8 }}
                        scroll={{ x: 800 }}
                      />
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </main>

      {/* ================================================================= */}
      {/* MODAL PARA REALIZAR CORTE DE CAJA / CIERRE DE TURNO              */}
      {/* ================================================================= */}
      <Modal
        open={cutModalOpen}
        onCancel={() => setCutModalOpen(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AuditOutlined style={{ color: '#ca8a04', fontSize: 22 }} />
            <span>Realizar Corte de Caja & Cierre de Turno</span>
          </div>
        }
        width={620}
        footer={[
          <Button key="cancel" onClick={() => setCutModalOpen(false)} disabled={submittingCut}>
            Cancelar
          </Button>,
          <Button
            key="submit"
            type="primary"
            style={{ background: '#ca8a04', borderColor: '#ca8a04' }}
            icon={<CheckCircleOutlined />}
            loading={submittingCut}
            disabled={targetUserUnclosedOrders.length === 0}
            onClick={handleConfirmShiftCut}
          >
            Confirmar y Cerrar Turno
          </Button>,
        ]}
      >
        <div style={{ marginTop: 12 }}>
          {/* Selector de Usuario a cortar */}
          <div style={{ marginBottom: 16 }}>
            <Text strong>Despachador / Cajero en Turno:</Text>
            <Select
              value={cutTargetUser}
              onChange={(val) => setCutTargetUser(val)}
              style={{ width: '100%', marginTop: 4 }}
              options={staffUsers.map((s) => ({
                value: s.full_name,
                label: `${s.full_name} (${s.role === 'admin' ? 'Administrador' : 'Despachador'})`,
              }))}
            />
          </div>

          {/* Resumen del Turno Abierto */}
          <div
            style={{
              background: '#fefce8',
              border: '1px solid #fef08a',
              borderRadius: 10,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 13, color: '#854d0e', marginBottom: 8, fontWeight: 700 }}>
              VENTAS ACUMULADAS EN ESTE TURNO:
            </div>

            <Row gutter={[12, 12]}>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 12 }}>Pedidos:</Text>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{targetUserShiftSummary.count} pedidos</div>
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 12 }}>Efectivo Esperado:</Text>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>
                  {formatCurrency(targetUserShiftSummary.cash)}
                </div>
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 12 }}>Gran Total:</Text>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0d9488' }}>
                  {formatCurrency(targetUserShiftSummary.sales)}
                </div>
              </Col>
              <Col span={12}>
                <span style={{ fontSize: 12, color: '#2563eb' }}>
                  💳 Tarjetas: {formatCurrency(targetUserShiftSummary.card)}
                </span>
              </Col>
              <Col span={12}>
                <span style={{ fontSize: 12, color: '#7c3aed' }}>
                  🏦 Transferencias: {formatCurrency(targetUserShiftSummary.transfer)}
                </span>
              </Col>
            </Row>
          </div>

          {targetUserUnclosedOrders.length === 0 ? (
            <Alert
              type="info"
              showIcon
              message="Sin ventas pendientes de corte"
              description={`El despachador ${cutTargetUser} no tiene pedidos activos por cerrar en este momento.`}
              style={{ marginBottom: 16 }}
            />
          ) : (
            <>
              {/* Conteo Físico de Efectivo */}
              <div style={{ marginBottom: 16 }}>
                <Text strong style={{ fontSize: 14 }}>
                  Efectivo Físico Contado en Caja (Q):
                </Text>
                <InputNumber
                  min={0}
                  step={0.5}
                  prefix="Q"
                  placeholder="Ingresa el monto de billetes y monedas contados..."
                  value={countedCash}
                  onChange={(val) => setCountedCash(val)}
                  style={{ width: '100%', marginTop: 4, height: 42, fontSize: 16 }}
                />

                {countedCash !== null && (
                  <div style={{ marginTop: 8 }}>
                    {Math.abs(targetUserShiftSummary.diff) < 0.01 ? (
                      <Alert
                        type="success"
                        showIcon
                        message="Caja Cuadrada Perfecta"
                        description="El efectivo físico coincide exactamente con lo registrado en sistema."
                      />
                    ) : targetUserShiftSummary.diff > 0 ? (
                      <Alert
                        type="info"
                        showIcon
                        message={`Sobrante en Caja: +${formatCurrency(targetUserShiftSummary.diff)}`}
                        description="Hay más dinero físico en caja del esperado según las ventas."
                      />
                    ) : (
                      <Alert
                        type="error"
                        showIcon
                        message={`Faltante en Caja: ${formatCurrency(targetUserShiftSummary.diff)}`}
                        description="Hay menos dinero físico en caja del esperado según las ventas registradas."
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Observaciones del Cierre */}
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Notas u observaciones del cierre (opcional):</Text>
                <Input.TextArea
                  rows={2}
                  placeholder="Ej: Turno entregado a Ana Gómez. Sin novedades."
                  value={cutNotes}
                  onChange={(e) => setCutNotes(e.target.value)}
                  style={{ marginTop: 4 }}
                />
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ================================================================= */}
      {/* MODAL DE DETALLE Y DESGLOSE INDIVIDUAL                           */}
      {/* ================================================================= */}
      <Modal
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileTextOutlined style={{ color: '#0d9488', fontSize: 20 }} />
            <span>Desglose de Pedidos: {detailUser?.userName}</span>
          </div>
        }
        width={800}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            Cerrar
          </Button>,
          <Button
            key="corte"
            type="primary"
            style={{ background: '#ca8a04', borderColor: '#ca8a04' }}
            icon={<AuditOutlined />}
            onClick={() => {
              setDetailModalOpen(false);
              if (detailUser) handleOpenCutModal(detailUser.userName);
            }}
          >
            Hacer Corte de Turno
          </Button>,
        ]}
      >
        {detailUser && (
          <div style={{ marginTop: 12 }}>
            <Table
              dataSource={detailUser.orders}
              rowKey="id"
              pagination={{ pageSize: 6 }}
              size="small"
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
                  title: 'Pagos',
                  key: 'payments',
                  render: (_: any, record: Order) => (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(record.payment_details || []).map((p, idx) => (
                        <Tag
                          key={idx}
                          color={p.method === 'efectivo' ? 'green' : p.method === 'tarjeta' ? 'blue' : 'purple'}
                          style={{ margin: 0, fontSize: 11 }}
                        >
                          {p.method.toUpperCase()}: {formatCurrency(p.amount)}
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
                  render: (val: number) => <strong>{formatCurrency(val)}</strong>,
                },
              ]}
            />
          </div>
        )}
      </Modal>

      {/* ================================================================= */}
      {/* ÁREA DE IMPRESIÓN (Ticket de Corte Térmico / Cierre de Turno)      */}
      {/* ================================================================= */}
      <div id="print-corte-area" style={{ display: 'none' }}>
        {printCut && (
          <div style={{ textAlign: 'center', lineHeight: 1.4 }}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 900 }}>LA TIENDITA</h2>
            <div style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase' }}>
              *** CORTE DE CAJA / CIERRE DE TURNO ***
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, margin: '4px 0' }}>
              COMPROBANTE #{printCut.cutNumber}
            </div>
            <div style={{ fontSize: 11, margin: '6px 0', borderBottom: '1px dashed #000', paddingBottom: 6 }}>
              Fecha Impresión: {dayjs().format('DD/MM/YYYY HH:mm:ss')}
            </div>

            <div style={{ textAlign: 'left', fontSize: 12, margin: '10px 0' }}>
              <div><strong>Despachador:</strong> {printCut.userName}</div>
              <div><strong>Inicio Turno:</strong> {formatDateTime(printCut.startedAt)}</div>
              <div><strong>Cierre Turno:</strong> {formatDateTime(printCut.closedAt)}</div>
              <div><strong>Pedidos Atendidos:</strong> {printCut.ordersCount} pedidos</div>
              {printCut.notes && (
                <div style={{ fontStyle: 'italic', marginTop: 4 }}>
                  <strong>Notas:</strong> {printCut.notes}
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '8px 0', margin: '10px 0', textAlign: 'left', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>(+) Efectivo Cobrado:</span>
                <strong>{formatCurrency(printCut.cashExpected)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>(+) Tarjetas / POS:</span>
                <strong>{formatCurrency(printCut.cardTotal)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>(+) Transferencias / QR:</span>
                <strong>{formatCurrency(printCut.transferTotal)}</strong>
              </div>
              {printCut.otherTotal > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>(+) Otros Medios:</span>
                  <strong>{formatCurrency(printCut.otherTotal)}</strong>
                </div>
              )}
              <div style={{ borderTop: '1px solid #000', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <strong>TOTAL VENDIDO:</strong>
                <strong>{formatCurrency(printCut.totalSales)}</strong>
              </div>
            </div>

            <div style={{ textAlign: 'left', fontSize: 11, background: '#f5f5f5', padding: 8, margin: '10px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>EFECTIVO ESPERADO:</span>
                <strong>{formatCurrency(printCut.cashExpected)}</strong>
              </div>
              {printCut.cashCounted !== null && printCut.cashCounted !== undefined && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span>EFECTIVO CONTADO:</span>
                    <strong>{formatCurrency(printCut.cashCounted)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span>DIFERENCIA:</span>
                    <strong>
                      {printCut.cashDifference && printCut.cashDifference > 0 ? '+' : ''}
                      {formatCurrency(printCut.cashDifference || 0)}
                    </strong>
                  </div>
                </>
              )}
            </div>

            <div style={{ marginTop: 40, borderTop: '1px solid #000', paddingTop: 6, fontSize: 11 }}>
              Firma Cajero: {printCut.userName}
            </div>

            <div style={{ marginTop: 30, borderTop: '1px solid #000', paddingTop: 6, fontSize: 11 }}>
              Firma Supervisor / Administrador
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
