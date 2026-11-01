'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Typography,
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Alert,
  Popconfirm,
  Result,
  Spin,
  Row,
  Col,
  message,
} from 'antd';
import {
  UserAddOutlined,
  TeamOutlined,
  SafetyCertificateOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  StopOutlined,
  ArrowLeftOutlined,
  LockOutlined,
  MailOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Navbar } from '@/components/Navbar';
import { StaffUser, UserRole } from '@/lib/types';
import { dataService } from '@/lib/dataService';
import { formatDateTime } from '@/lib/formatters';
import { isSupabaseConfigured, createClientBrowser } from '@/lib/supabase/client';

const { Title, Text, Paragraph } = Typography;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole>('despachador');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const isConnected = isSupabaseConfigured();

  // Cargar usuario autenticado y su rol
  useEffect(() => {
    const initAuth = async () => {
      let email = '';
      if (isConnected) {
        const supabase = createClientBrowser();
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          setCurrentUser(data.user);
          email = data.user.email || '';
        }
      } else {
        const localUser = localStorage.getItem('tiendita_current_staff');
        if (localUser) {
          try {
            const parsed = JSON.parse(localUser);
            setCurrentUser(parsed);
            email = parsed.email || '';
          } catch {
            // ignore
          }
        }
      }

      // Validar rol
      const staff = await dataService.getStaffUsers();
      setUsers(staff);
      setLoading(false);

      const profile = staff.find((s) => s.email.toLowerCase() === email.toLowerCase());
      if (profile) {
        setUserRole(profile.role);
      } else if (email.toLowerCase().includes('admin')) {
        setUserRole('admin');
      } else {
        setUserRole('despachador');
      }
    };

    initAuth();
  }, [isConnected]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await dataService.getStaffUsers();
      setUsers(data);
    } catch (err: any) {
      message.error(err.message || 'Error cargando personal');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (values: any) => {
    try {
      setSubmitting(true);
      await dataService.createStaffUser({
        email: values.email,
        full_name: values.full_name,
        role: values.role,
        password: values.password,
      });

      message.success(`Usuario "${values.full_name}" creado con éxito.`);
      setModalOpen(false);
      form.resetFields();
      fetchUsers();
    } catch (err: any) {
      message.error(err.message || 'Error al crear el usuario');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: StaffUser) => {
    try {
      await dataService.updateStaffUser(user.id, { is_active: !user.is_active });
      message.success(`Usuario ${user.is_active ? 'desactivado' : 'activado'}.`);
      fetchUsers();
    } catch (err: any) {
      message.error(err.message || 'Error actualizando estado');
    }
  };

  const handleChangeRole = async (user: StaffUser, newRole: UserRole) => {
    try {
      await dataService.updateStaffUser(user.id, { role: newRole });
      message.success(`Rol de ${user.full_name} cambiado a ${newRole}.`);
      fetchUsers();
    } catch (err: any) {
      message.error(err.message || 'Error cambiando rol');
    }
  };

  // Restricción de acceso para no administradores
  if (!loading && userRole !== 'admin') {
    return (
      <div>
        <Navbar />
        <div className="main-container" style={{ maxWidth: 600, marginTop: 60 }}>
          <Result
            status="403"
            title="Acceso Restringido"
            subTitle="Esta sección está reservada exclusivamente para el Administrador del sistema. Los despachadores tienen acceso a la atención, registro y cobro de pedidos."
            extra={
              <Link href="/admin">
                <Button type="primary" style={{ background: '#0d9488' }} icon={<ArrowLeftOutlined />}>
                  Volver al Panel de Despacho
                </Button>
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const columns = [
    {
      title: 'Nombre Completo',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (name: string, record: StaffUser) => (
        <Space direction="vertical" size={1}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {name}
            {record.email === currentUser?.email && (
              <Tag color="blue" style={{ marginLeft: 6, fontSize: 11 }}>Tú</Tag>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{record.email}</div>
        </Space>
      ),
    },
    {
      title: 'Rol Asignado',
      dataIndex: 'role',
      key: 'role',
      render: (role: UserRole, record: StaffUser) => (
        <Select
          value={role}
          size="small"
          style={{ width: 150 }}
          onChange={(newRole) => handleChangeRole(record, newRole)}
          options={[
            {
              value: 'admin',
              label: (
                <span>
                  <Tag color="gold" style={{ margin: 0 }}>🛡️ Admin</Tag>
                </span>
              ),
            },
            {
              value: 'despachador',
              label: (
                <span>
                  <Tag color="cyan" style={{ margin: 0 }}>📦 Despachador</Tag>
                </span>
              ),
            },
          ]}
        />
      ),
    },
    {
      title: 'Permisos',
      key: 'permissions',
      render: (_: any, record: StaffUser) => (
        <span style={{ fontSize: 12, color: '#64748b' }}>
          {record.role === 'admin'
            ? 'Total: Gestión usuarios, inventario, precios y despacho'
            : 'Despacho: Tomar pedidos, cobrar en caja, anular'}
        </span>
      ),
    },
    {
      title: 'Estado',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean, record: StaffUser) => (
        <Space>
          <Switch
            checked={active}
            onChange={() => handleToggleActive(record)}
            size="small"
          />
          <Tag color={active ? 'success' : 'default'}>
            {active ? 'Activo' : 'Inactivo'}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Fecha de Registro',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date?: string) => formatDateTime(date),
    },
  ];

  return (
    <div>
      <Navbar />

      <main className="main-container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>
              Control Interno de Usuarios & Personal
            </Title>
            <Text type="secondary">
              Crea y administra cuentas internas para administradores y despachadores directamente desde aquí.
            </Text>
          </div>

          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchUsers} loading={loading}>
              Actualizar
            </Button>
            <Button
              type="primary"
              style={{ background: '#0d9488' }}
              icon={<UserAddOutlined />}
              onClick={() => setModalOpen(true)}
            >
              Nuevo Usuario
            </Button>
          </Space>
        </div>

        {/* Resumen de Roles */}
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} md={12}>
            <Card size="small" style={{ borderLeft: '4px solid #eab308', background: '#fffbeb' }}>
              <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                🛡️ Rol Administrador
              </div>
              <div style={{ fontSize: 13, color: '#78350f' }}>
                Acceso completo al sistema: alta y baja de personal, edición de catálogo, modificación de precios, ajuste de inventario y monitoreo financiero de caja.
              </div>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card size="small" style={{ borderLeft: '4px solid #0d9488', background: '#f0fdfa' }}>
              <div style={{ fontWeight: 700, color: '#115e59', marginBottom: 4 }}>
                📦 Rol Despachador
              </div>
              <div style={{ fontSize: 13, color: '#134e4a' }}>
                Enfocado en la atención mostrador: tomar pedidos presenciales, cobrar con diferentes medios de pago (efectivo con vuelto), despachar y anular órdenes.
              </div>
            </Card>
          </Col>
        </Row>

        <Card styles={{ body: { padding: '16px 20px' } }}>
          <Table
            columns={columns}
            dataSource={users}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 8 }}
          />
        </Card>
      </main>

      {/* Modal para Crear Usuario */}
      <Modal
        open={modalOpen}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserAddOutlined style={{ color: '#0d9488' }} />
            <span>Crear Usuario Interno</span>
          </div>
        }
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={520}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateUser}
          initialValues={{ role: 'despachador' }}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            label="Nombre Completo del Personal:"
            name="full_name"
            rules={[{ required: true, message: 'Ingresa el nombre completo' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Ej: Daniel Morales"
            />
          </Form.Item>

          <Form.Item
            label="Correo Electrónico (Acceso):"
            name="email"
            rules={[
              { required: true, message: 'Ingresa el correo electrónico' },
              { type: 'email', message: 'Ingresa un correo válido' },
            ]}
          >
            <Input
              prefix={<MailOutlined style={{ color: '#94a3b8' }} />}
              placeholder="daniel@tiendita.com"
            />
          </Form.Item>

          <Form.Item
            label="Contraseña Inicial:"
            name="password"
            rules={[
              { required: true, message: 'Ingresa la contraseña' },
              { min: 6, message: 'Mínimo 6 caracteres' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
              placeholder="••••••••"
            />
          </Form.Item>

          <Form.Item
            label="Rol y Nivel de Acceso:"
            name="role"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                {
                  value: 'despachador',
                  label: '📦 Despachador (Toma pedidos, cobra y despacha)',
                },
                {
                  value: 'admin',
                  label: '🛡️ Administrador (Acceso total, usuarios e inventario)',
                },
              ]}
            />
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                style={{ background: '#0d9488' }}
              >
                Crear y Guardar Usuario
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

