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
  InputNumber,
  Modal,
  Form,
  Input,
  Select,
  Image,
  Alert,
  Switch,
  Tooltip,
  Row,
  Col,
  Divider,
  message,
} from 'antd';
import {
  PlusOutlined,
  AppstoreOutlined,
  DashboardOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  LockOutlined,
  ClockCircleOutlined,
  StarFilled,
  StarOutlined,
  EditOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Navbar } from '@/components/Navbar';
import { Product, UserRole } from '@/lib/types';
import { dataService } from '@/lib/dataService';
import { formatCurrency } from '@/lib/formatters';
import { isSupabaseConfigured, createClientBrowser } from '@/lib/supabase/client';

const { Title, Text } = Typography;

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('despachador');
  const [availableAllDayNew, setAvailableAllDayNew] = useState(true);
  const [availableAllDayEdit, setAvailableAllDayEdit] = useState(true);

  const isConnected = isSupabaseConfigured();

  // Cargar rol de usuario
  useEffect(() => {
    const checkRole = async () => {
      let email = '';
      if (isConnected) {
        const supabase = createClientBrowser();
        const { data } = await supabase.auth.getUser();
        if (data?.user?.email) email = data.user.email;
      } else {
        const local = localStorage.getItem('tiendita_current_staff');
        if (local) {
          try {
            const parsed = JSON.parse(local);
            email = parsed.email || '';
          } catch {
            // ignore
          }
        }
      }

      try {
        const staffList = await dataService.getStaffUsers();
        const profile = staffList.find((s) => s.email.toLowerCase() === email.toLowerCase());
        if (profile) {
          setUserRole(profile.role);
        } else if (email.toLowerCase().includes('admin')) {
          setUserRole('admin');
        } else {
          setUserRole('despachador');
        }
      } catch {
        setUserRole('despachador');
      }
    };

    checkRole();
  }, [isConnected]);

  const fetchProducts = async () => {
    try {
      // Los administradores ven todos (incluso inactivos para poder activarlos)
      const data = await dataService.getProducts(true);
      setProducts(data);
    } catch (err) {
      console.error('Error cargando inventario:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    const handleStorage = () => fetchProducts();
    window.addEventListener('tiendita_storage_updated', handleStorage);
    return () => window.removeEventListener('tiendita_storage_updated', handleStorage);
  }, []);

  const isAdmin = userRole === 'admin';

  const handleStockChange = async (productId: string, newStock: number) => {
    if (!isAdmin) {
      message.error('Solo los administradores pueden modificar el inventario.');
      return;
    }
    try {
      await dataService.updateProductStock(productId, newStock);
      message.success('Stock actualizado.');
      fetchProducts();
    } catch (err: any) {
      message.error(err.message || 'Error actualizando stock');
    }
  };

  // Alternar si es destacado
  const handleToggleFeatured = async (product: Product) => {
    if (!isAdmin) return;
    try {
      await dataService.updateProduct(product.id, { is_featured: !product.is_featured });
      message.success(`Producto ${!product.is_featured ? 'marcado como Destacado' : 'retirado de Destacados'}.`);
      fetchProducts();
    } catch (err: any) {
      message.error(err.message || 'Error al actualizar producto');
    }
  };

  // Alternar visibilidad activa para clientes
  const handleToggleActive = async (product: Product) => {
    if (!isAdmin) return;
    try {
      await dataService.updateProduct(product.id, { is_active: !product.is_active });
      message.success(`Producto ${!product.is_active ? 'ahora es visible' : 'ha sido ocultado'} para clientes.`);
      fetchProducts();
    } catch (err: any) {
      message.error(err.message || 'Error al actualizar visibilidad');
    }
  };

  const handleOpenEdit = (product: Product) => {
    setEditProduct(product);
    setAvailableAllDayEdit(product.available_all_day !== false);
    editForm.setFieldsValue({
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price,
      stock: product.stock,
      image_url: product.image_url,
      is_active: product.is_active,
      is_featured: product.is_featured || false,
      available_all_day: product.available_all_day !== false,
      available_from: product.available_from || '07:00',
      available_to: product.available_to || '12:00',
    });
  };

  const handleSaveEdit = async (values: any) => {
    if (!editProduct) return;
    try {
      setSubmitting(true);
      await dataService.updateProduct(editProduct.id, {
        name: values.name,
        description: values.description || null,
        category: values.category,
        price: values.price,
        stock: values.stock,
        image_url: values.image_url || null,
        is_active: values.is_active,
        is_featured: values.is_featured,
        available_all_day: values.available_all_day,
        available_from: values.available_all_day ? null : values.available_from,
        available_to: values.available_all_day ? null : values.available_to,
      });

      message.success('Producto y horario actualizados correctamente.');
      setEditProduct(null);
      fetchProducts();
    } catch (err: any) {
      message.error(err.message || 'Error al actualizar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddProduct = async (values: any) => {
    if (!isAdmin) {
      message.error('Solo los administradores pueden agregar productos.');
      return;
    }
    try {
      setSubmitting(true);
      await dataService.addProduct({
        name: values.name,
        description: values.description || null,
        price: values.price,
        stock: values.stock,
        category: values.category || 'General',
        image_url: values.image_url || null,
        is_active: values.is_active ?? true,
        is_featured: values.is_featured ?? false,
        available_all_day: values.available_all_day ?? true,
        available_from: values.available_all_day ? null : values.available_from,
        available_to: values.available_all_day ? null : values.available_to,
      });
      message.success(`Producto "${values.name}" agregado con éxito.`);
      setModalOpen(false);
      form.resetFields();
      fetchProducts();
    } catch (err: any) {
      message.error(err.message || 'Error al agregar producto');
    } finally {
      setSubmitting(false);
    }
  };

  const applyPreset = (targetForm: any, from: string, to: string) => {
    targetForm.setFieldsValue({
      available_all_day: false,
      available_from: from,
      available_to: to,
    });
    if (targetForm === form) setAvailableAllDayNew(false);
    if (targetForm === editForm) setAvailableAllDayEdit(false);
  };

  const columns = [
    {
      title: 'Imagen',
      dataIndex: 'image_url',
      key: 'image_url',
      width: 65,
      render: (url: string, record: Product) => (
        <Image
          src={url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100&auto=format&fit=crop&q=60'}
          alt={record.name}
          width={45}
          height={45}
          style={{ objectFit: 'cover', borderRadius: 6 }}
          fallback="https://images.unsplash.com/photo-1542838132-92c53300491e?w=100&auto=format&fit=crop&q=60"
        />
      ),
    },
    {
      title: 'Producto',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Product) => (
        <div>
          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{name}</span>
            {record.is_featured && (
              <Tag color="gold" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                ⭐ Destacado
              </Tag>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{record.description}</div>
        </div>
      ),
    },
    {
      title: 'Categoría',
      dataIndex: 'category',
      key: 'category',
      render: (cat: string) => <Tag>{cat}</Tag>,
    },
    {
      title: 'Precio',
      dataIndex: 'price',
      key: 'price',
      render: (val: number) => <strong>{formatCurrency(val)}</strong>,
    },
    {
      title: 'Disponibilidad / Horario',
      key: 'schedule',
      render: (_: any, record: Product) => {
        if (record.available_all_day !== false && (!record.available_from || !record.available_to)) {
          return <Tag color="success">Todo el día</Tag>;
        }
        return (
          <Tag color="cyan" icon={<ClockCircleOutlined />}>
            {record.available_from} - {record.available_to}
          </Tag>
        );
      },
    },
    {
      title: 'Stock Actual',
      dataIndex: 'stock',
      key: 'stock',
      render: (stock: number, record: Product) => (
        <Space>
          {isAdmin ? (
            <InputNumber
              min={0}
              max={9999}
              value={stock}
              onChange={(val) => handleStockChange(record.id, val || 0)}
              style={{ width: 75 }}
            />
          ) : (
            <span style={{ fontWeight: 700, fontSize: 15 }}>{stock}</span>
          )}

          {stock === 0 ? (
            <Tag color="error">Agotado</Tag>
          ) : stock <= 3 ? (
            <Tag color="warning">Bajo</Tag>
          ) : (
            <Tag color="success">OK</Tag>
          )}
        </Space>
      ),
    },
    ...(isAdmin
      ? [
          {
            title: 'Visible Portal',
            key: 'active',
            render: (_: any, record: Product) => (
              <Switch
                checked={record.is_active}
                onChange={() => handleToggleActive(record)}
                size="small"
              />
            ),
          },
          {
            title: 'Destacado',
            key: 'featured',
            render: (_: any, record: Product) => (
              <Button
                type="text"
                size="small"
                icon={record.is_featured ? <StarFilled style={{ color: '#f59e0b' }} /> : <StarOutlined />}
                onClick={() => handleToggleFeatured(record)}
              />
            ),
          },
          {
            title: 'Acciones',
            key: 'actions',
            render: (_: any, record: Product) => (
              <Space>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleOpenEdit(record)}
                >
                  Editar
                </Button>
                <Button size="small" onClick={() => handleStockChange(record.id, record.stock + 5)}>
                  +5
                </Button>
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <Navbar />

      <main className="main-container">
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Title level={2} style={{ margin: 0 }}>
                Control de Catálogo, Horarios & Stock
              </Title>
              <Tag color={isAdmin ? 'gold' : 'cyan'}>
                {isAdmin ? '🛡️ Administrador (Control Total)' : '📦 Despachador (Modo Consulta)'}
              </Tag>
            </div>
            <Text type="secondary">
              {isAdmin
                ? 'Configura la visibilidad en portal, horarios en que ciertos productos están disponibles y existencias.'
                : 'Consulta la disponibilidad en tiempo real para atender a los clientes en mostrador.'}
            </Text>
          </div>

          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={fetchProducts} loading={loading}>
              Actualizar
            </Button>
            {isAdmin && (
              <>
                <Link href="/admin/configuracion">
                  <Button icon={<SettingOutlined />}>
                    Configurar Portal
                  </Button>
                </Link>
                <Button
                  type="primary"
                  style={{ background: '#0d9488' }}
                  icon={<PlusOutlined />}
                  onClick={() => setModalOpen(true)}
                >
                  Nuevo Producto
                </Button>
              </>
            )}
          </Space>
        </div>

        {!isAdmin && (
          <Alert
            message="Modo Consulta de Stock"
            description="Como despachador puedes visualizar las existencias y horarios en tiempo real. La edición de stock, horarios y productos requiere rol de Administrador."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Card styles={{ body: { padding: '16px 20px' } }}>
          <Table
            columns={columns}
            dataSource={products}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      </main>

      {/* Modal para Editar Producto & Horario */}
      <Modal
        open={Boolean(editProduct)}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <EditOutlined style={{ color: '#0d9488' }} />
            <span>Editar Producto: {editProduct?.name}</span>
          </div>
        }
        onCancel={() => setEditProduct(null)}
        footer={null}
        width={680}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleSaveEdit}
          style={{ marginTop: 16 }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={16}>
              <Form.Item label="Nombre del Producto:" name="name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Categoría:" name="category">
                <Select
                  options={[
                    { value: 'Cafetería', label: 'Cafetería' },
                    { value: 'Panadería', label: 'Panadería' },
                    { value: 'Bebidas', label: 'Bebidas' },
                    { value: 'Comidas', label: 'Comidas' },
                    { value: 'Repostería', label: 'Repostería' },
                    { value: 'General', label: 'General' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Precio Unitario:" name="price" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Stock en Tienda:" name="stock" rules={[{ required: true }]}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="URL de Imagen:" name="image_url">
            <Input placeholder="https://..." />
          </Form.Item>

          <Form.Item label="Descripción:" name="description">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Divider orientation="left" style={{ margin: '14px 0', fontSize: 13 }}>
            Visibilidad en el Portal de Clientes
          </Divider>

          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col xs={24} sm={12}>
              <Form.Item label="Visible en el Catálogo:" name="is_active" valuePropName="checked">
                <Switch checkedChildren="Visible" unCheckedChildren="Oculto" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Destacar en Portada:" name="is_featured" valuePropName="checked">
                <Switch checkedChildren="Destacado" unCheckedChildren="Estándar" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ margin: '14px 0', fontSize: 13 }}>
            Horario de Disponibilidad para Pedidos
          </Divider>

          <Form.Item label="Disponibilidad por Horario:" name="available_all_day" valuePropName="checked">
            <Switch
              checkedChildren="Todo el Día"
              unCheckedChildren="Horario Específico"
              onChange={(checked) => setAvailableAllDayEdit(checked)}
            />
          </Form.Item>

          {!availableAllDayEdit && (
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
              <div style={{ marginBottom: 10, fontSize: 12, color: '#64748b' }}>
                Atajos de horario habituales:
              </div>
              <Space wrap style={{ marginBottom: 14 }}>
                <Button size="small" onClick={() => applyPreset(editForm, '06:00', '11:30')}>
                  🌅 Desayuno (06:00 - 11:30)
                </Button>
                <Button size="small" onClick={() => applyPreset(editForm, '11:30', '15:30')}>
                  🥪 Almuerzo (11:30 - 15:30)
                </Button>
                <Button size="small" onClick={() => applyPreset(editForm, '15:30', '20:00')}>
                  ☕ Tarde (15:30 - 20:00)
                </Button>
              </Space>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="Hora de Inicio:" name="available_from" rules={[{ required: !availableAllDayEdit }]}>
                    <Input placeholder="07:00" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Hora de Fin:" name="available_to" rules={[{ required: !availableAllDayEdit }]}>
                    <Input placeholder="12:00" />
                  </Form.Item>
                </Col>
              </Row>
            </div>
          )}

          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Space>
              <Button onClick={() => setEditProduct(null)}>Cancelar</Button>
              <Button type="primary" htmlType="submit" loading={submitting} style={{ background: '#0d9488' }}>
                Guardar Cambios
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>

      {/* Modal para Crear Nuevo Producto */}
      <Modal
        open={modalOpen}
        title="Agregar Nuevo Producto al Catálogo"
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={680}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddProduct}
          initialValues={{
            stock: 10,
            category: 'Cafetería',
            is_active: true,
            is_featured: false,
            available_all_day: true,
            available_from: '07:00',
            available_to: '12:00',
          }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={16}>
              <Form.Item label="Nombre del Producto:" name="name" rules={[{ required: true, message: 'Ingresa el nombre' }]}>
                <Input placeholder="Ej: Capuccino Vainilla 350ml" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item label="Categoría:" name="category">
                <Select
                  options={[
                    { value: 'Cafetería', label: 'Cafetería' },
                    { value: 'Panadería', label: 'Panadería' },
                    { value: 'Bebidas', label: 'Bebidas' },
                    { value: 'Comidas', label: 'Comidas' },
                    { value: 'Repostería', label: 'Repostería' },
                    { value: 'General', label: 'General' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Precio Unitario:" name="price" rules={[{ required: true, message: 'Ingresa el precio' }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="Ej: 2500" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Stock Inicial:" name="stock" rules={[{ required: true, message: 'Ingresa el stock' }]}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="Ej: 20" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="URL de Imagen:" name="image_url">
            <Input placeholder="https://..." />
          </Form.Item>

          <Form.Item label="Descripción Corta:" name="description">
            <Input.TextArea rows={2} placeholder="Ingredientes o presentación" />
          </Form.Item>

          <Divider orientation="left" style={{ margin: '12px 0', fontSize: 13 }}>
            Visibilidad y Destacado
          </Divider>

          <Row gutter={16} style={{ marginBottom: 12 }}>
            <Col xs={24} sm={12}>
              <Form.Item label="Visible para Clientes:" name="is_active" valuePropName="checked">
                <Switch checkedChildren="Visible" unCheckedChildren="Oculto" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Marcar como Destacado:" name="is_featured" valuePropName="checked">
                <Switch checkedChildren="Destacado" unCheckedChildren="Estándar" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ margin: '12px 0', fontSize: 13 }}>
            Horario de Disponibilidad
          </Divider>

          <Form.Item label="Disponibilidad por Horario:" name="available_all_day" valuePropName="checked">
            <Switch
              checkedChildren="Todo el Día"
              unCheckedChildren="Horario Específico"
              onChange={(checked) => setAvailableAllDayNew(checked)}
            />
          </Form.Item>

          {!availableAllDayNew && (
            <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
              <div style={{ marginBottom: 10, fontSize: 12, color: '#64748b' }}>
                Atajos de horario habituales:
              </div>
              <Space wrap style={{ marginBottom: 14 }}>
                <Button size="small" onClick={() => applyPreset(form, '06:00', '11:30')}>
                  🌅 Desayuno (06:00 - 11:30)
                </Button>
                <Button size="small" onClick={() => applyPreset(form, '11:30', '15:30')}>
                  🥪 Almuerzo (11:30 - 15:30)
                </Button>
                <Button size="small" onClick={() => applyPreset(form, '15:30', '20:00')}>
                  ☕ Tarde (15:30 - 20:00)
                </Button>
              </Space>

              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="Hora de Inicio:" name="available_from" rules={[{ required: !availableAllDayNew }]}>
                    <Input placeholder="07:00" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Hora de Fin:" name="available_to" rules={[{ required: !availableAllDayNew }]}>
                    <Input placeholder="12:00" />
                  </Form.Item>
                </Col>
              </Row>
            </div>
          )}

          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="primary" htmlType="submit" loading={submitting} style={{ background: '#0d9488' }}>
                Guardar Producto
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
