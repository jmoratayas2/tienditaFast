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
  Result,
  Row,
  Col,
  message,
} from 'antd';
import {
  UserAddOutlined,
  EditOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
  LockOutlined,
  MailOutlined,
  UserOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import { Navbar } from '@/components/Navbar';
import { StaffUser, UserRole } from '@/lib/types';
import { dataService } from '@/lib/dataService';
import { formatDateTime } from '@/lib/formatters';
import { isSupabaseConfigured, createClientBrowser } from '@/lib/supabase/client';

const { Title, Text } = Typography;

// Separar inteligentemente nombres y apellidos
function parseUserNames(user: StaffUser) {
  if (user.first_name && user.last_name) {
    return {
      firstName: user.first_name.trim(),
      lastName: user.last_name.trim(),
      fullName: `${user.first_name} ${user.last_name}`.trim(),
    };
  }

  const rawFull = (user.full_name || '').trim();
  if (!rawFull) {
    return { firstName: '', lastName: '', fullName: 'Personal de Tienda' };
  }

  const parts = rawFull.split(/\s+/);
  if (parts.length <= 1) {
    return { firstName: parts[0] || '', lastName: '', fullName: rawFull };
  }

  // Si tiene 2 partes: parte 1 nombre, parte 2 apellido
  // Si tiene 3 o 4 partes: las últimas son apellidos (común en Latinoamérica)
  if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1], fullName: rawFull };
  }

  const lastName = parts.slice(-2).join(' ');
  const firstName = parts.slice(0, -2).join(' ');
  return { firstName, lastName, fullName: rawFull };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole>('despachador');

  // Modal para Crear Usuario
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm] = Form.useForm();

  // Modal para Editar Usuario
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editForm] = Form.useForm();

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
          } catch {}
        }
      }

      // Cargar lista de personal
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
      message.error(err.message || 'Error cargando lista de personal');
    } finally {
      setLoading(false);
    }
  };

  // Crear usuario con Nombres y Apellidos separados
  const handleCreateUser = async (values: any) => {
    try {
      setCreateSubmitting(true);
      const firstName = (values.first_name || '').trim();
      const lastName = (values.last_name || '').trim();
      const fullName = `${firstName} ${lastName}`.trim();

      await dataService.createStaffUser({
        email: values.email.trim().toLowerCase(),
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        role: values.role,
        password: values.password,
      });

      message.success(`Usuario "${fullName}" creado exitosamente.`);
      setCreateModalOpen(false);
      createForm.resetFields();
      await fetchUsers();
    } catch (err: any) {
      message.error(err.message || 'Error al crear el usuario');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Abrir modal de edición
  const handleOpenEdit = (user: StaffUser) => {
    setEditingUser(user);
    const parsed = parseUserNames(user);
    editForm.setFieldsValue({
      first_name: parsed.firstName,
      last_name: parsed.lastName,
      role: user.role,
      is_active: user.is_active,
    });
    setEditModalOpen(true);
  };

  // Guardar edición de Nombres y Apellidos
  const handleSaveEdit = async (values: any) => {
    if (!editingUser) return;
    try {
      setEditSubmitting(true);
      const firstName = (values.first_name || '').trim();
      const lastName = (values.last_name || '').trim();
      const fullName = `${firstName} ${lastName}`.trim();

      await dataService.updateStaffUser(editingUser.id, {
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        role: values.role,
        is_active: values.is_active,
      });

      // Si el usuario editado es el mismo de la sesión actual, actualizar localStorage
      if (
        currentUser?.email &&
        editingUser.email.toLowerCase() === currentUser.email.toLowerCase()
      ) {
        const local = localStorage.getItem('tiendita_current_staff');
        if (local) {
          try {
            const parsed = JSON.parse(local);
            parsed.name = fullName;
            parsed.role = values.role;
            localStorage.setItem('tiendita_current_staff', JSON.stringify(parsed));
          } catch {}
        }
      }

      message.success(`Datos de "${fullName}" actualizados correctamente.`);
      setEditModalOpen(false);
      setEditingUser(null);
      await fetchUsers();
    } catch (err: any) {
      message.error(err.message || 'Error actualizando usuario');
    } finally {
      setEditSubmitting(false);
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
            subTitle="Esta sección está reservada exclusivamente para el Administrador del sistema. Los despachadores tienen acceso a la atención y cobro de pedidos."
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
      title: 'Personal (Nombres y Apellidos)',
      key: 'full_name',
      render: (_: any, record: StaffUser) => {
        const parsed = parseUserNames(record);
        const initials =
          `${parsed.firstName[0] || ''}${parsed.lastName[0] || ''}`.toUpperCase() || 'U';

        return (
          <Space align="center" size={12}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: record.role === 'admin' ? '#fef3c7' : '#ccfbf1',
                color: record.role === 'admin' ? '#d97706' : '#0d9488',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 14,
                flexShrink: 0,
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              {initials}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{parsed.fullName}</span>
                {record.email === currentUser?.email && (
                  <Tag color="blue" style={{ margin: 0, fontSize: 11, padding: '0 6px' }}>
                    Tú
                  </Tag>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{record.email}</div>
            </div>
          </Space>
        );
      },
    },
    {
      title: 'Rol Asignado',
      dataIndex: 'role',
      key: 'role',
      render: (role: UserRole, record: StaffUser) => (
        <Select
          value={role}
          size="small"
          style={{ width: 155 }}
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
            ? 'Total: Gestión de personal, catálogo, precios y caja'
            : 'Despacho: Toma de pedidos, cobro en caja y anulación'}
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
      title: 'Registro',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date?: string) => (
        <span style={{ fontSize: 12, color: '#64748b' }}>{formatDateTime(date)}</span>
      ),
    },
    {
      title: 'Acciones',
      key: 'actions',
      render: (_: any, record: StaffUser) => (
        <Button
          icon={<EditOutlined />}
          size="small"
          onClick={() => handleOpenEdit(record)}
        >
          Editar
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Navbar />

      <main className="main-container">
        <div
          className="page-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div>
            <Title level={2} style={{ margin: 0 }}>
              Control Interno de Usuarios & Personal
            </Title>
            <Text type="secondary">
              Gestiona el personal con sus <strong>Nombres y Apellidos</strong> correspondientes para atención en caja, despacho y balance.
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
              onClick={() => setCreateModalOpen(true)}
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
                Acceso completo al sistema: alta y edición de personal, catálogo, modificación de precios, inventario y monitoreo financiero de caja.
              </div>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card size="small" style={{ borderLeft: '4px solid #0d9488', background: '#f0fdfa' }}>
              <div style={{ fontWeight: 700, color: '#115e59', marginBottom: 4 }}>
                📦 Rol Despachador
              </div>
              <div style={{ fontSize: 13, color: '#134e4a' }}>
                Enfocado en atención mostrador: tomar pedidos presenciales, cobrar con diferentes métodos de pago, despachar órdenes y realizar corte de turno.
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

      {/* =================================================================== */}
      {/* MODAL 1: CREAR NUEVO USUARIO (Nombres y Apellidos separados)         */}
      {/* =================================================================== */}
      <Modal
        open={createModalOpen}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserAddOutlined style={{ color: '#0d9488', fontSize: 20 }} />
            <span>Crear Usuario Interno</span>
          </div>
        }
        onCancel={() => setCreateModalOpen(false)}
        footer={null}
        width={520}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateUser}
          initialValues={{ role: 'despachador' }}
          style={{ marginTop: 16 }}
        >
          {/* Nombres y Apellidos separados */}
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Nombres:"
                name="first_name"
                rules={[{ required: true, message: 'Ingresa los nombres del usuario' }]}
              >
                <Input
                  prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="Ej: Daniel Alejandro"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Apellidos:"
                name="last_name"
                rules={[{ required: true, message: 'Ingresa los apellidos del usuario' }]}
              >
                <Input
                  prefix={<IdcardOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="Ej: Morales Santos"
                />
              </Form.Item>
            </Col>
          </Row>

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
                  label: '🛡️ Administrador (Acceso total, personal e inventario)',
                },
              ]}
            />
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Space>
              <Button onClick={() => setCreateModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createSubmitting}
                style={{ background: '#0d9488' }}
              >
                Guardar Usuario
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>

      {/* =================================================================== */}
      {/* MODAL 2: EDITAR NOMBRES Y APELLIDOS DEL PERSONAL                     */}
      {/* =================================================================== */}
      <Modal
        open={editModalOpen}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EditOutlined style={{ color: '#0d9488', fontSize: 20 }} />
            <span>Editar Datos de Personal: {editingUser?.email}</span>
          </div>
        }
        onCancel={() => setEditModalOpen(false)}
        footer={null}
        width={520}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleSaveEdit}
          style={{ marginTop: 16 }}
        >
          {/* Nombres y Apellidos */}
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Nombres:"
                name="first_name"
                rules={[{ required: true, message: 'Ingresa los nombres' }]}
              >
                <Input
                  prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="Ej: Daniel Alejandro"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Apellidos:"
                name="last_name"
                rules={[{ required: true, message: 'Ingresa los apellidos' }]}
              >
                <Input
                  prefix={<IdcardOutlined style={{ color: '#94a3b8' }} />}
                  placeholder="Ej: Morales Santos"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Rol del Usuario:"
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
                  label: '🛡️ Administrador (Acceso total)',
                },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Estado de la Cuenta:"
            name="is_active"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="Cuenta Activa"
              unCheckedChildren="Desactivada"
            />
          </Form.Item>

          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Space>
              <Button onClick={() => setEditModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={editSubmitting}
                style={{ background: '#0d9488' }}
              >
                Guardar Cambios
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
