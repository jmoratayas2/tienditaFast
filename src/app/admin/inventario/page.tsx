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
  Tooltip,
  message,
} from 'antd';
import {
  PlusOutlined,
  AppstoreOutlined,
  DashboardOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  LockOutlined,
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
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>('despachador');
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
      const data = await dataService.getProducts();
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
        is_active: true,
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

  const columns = [
    {
      title: 'Imagen',
      dataIndex: 'image_url',
      key: 'image_url',
      width: 70,
      render: (url: string, record: Product) => (
        <Image
          src={url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100&auto=format&fit=crop&q=60'}
          alt={record.name}
          width={50}
          height={50}
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
          <div style={{ fontWeight: 600 }}>{name}</div>
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
              style={{ width: 80 }}
            />
          ) : (
            <span style={{ fontWeight: 700, fontSize: 15 }}>{stock}</span>
          )}

          {stock === 0 ? (
            <Tag color="error">Agotado</Tag>
          ) : stock <= 3 ? (
            <Tag color="warning">Bajo Stock</Tag>
          ) : (
            <Tag color="success">Disponible</Tag>
          )}
        </Space>
      ),
    },
    ...(isAdmin
      ? [
          {
            title: 'Reposición Rápida',
            key: 'quick',
            render: (_: any, record: Product) => (
              <Space>
                <Button size="small" onClick={() => handleStockChange(record.id, record.stock + 5)}>
                  +5
                </Button>
                <Button size="small" onClick={() => handleStockChange(record.id, record.stock + 20)}>
                  +20
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
                Control de Inventario & Stock
              </Title>
              <Tag color={isAdmin ? 'gold' : 'cyan'}>
                {isAdmin ? '🛡️ Administrador (Control Total)' : '📦 Despachador (Modo Consulta)'}
              </Tag>
            </div>
            <Text type="secondary">
              {isAdmin
                ? 'Ajusta las cantidades disponibles, crea productos y modifica precios.'
                : 'Consulta la disponibilidad en tiempo real para atender a los clientes en mostrador.'}
            </Text>
          </div>

          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchProducts} loading={loading}>
              Actualizar
            </Button>
            {isAdmin && (
              <Button
                type="primary"
                style={{ background: '#0d9488' }}
                icon={<PlusOutlined />}
                onClick={() => setModalOpen(true)}
              >
                Nuevo Producto
              </Button>
            )}
          </Space>
        </div>

        {!isAdmin && (
          <Alert
            message="Modo Consulta de Stock"
            description="Como despachador puedes visualizar las existencias en tiempo real. La edición de stock y agregar nuevos productos requiere rol de Administrador."
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

      {/* Modal para Crear Producto (Solo Admin) */}
      <Modal
        open={modalOpen}
        title="Agregar Nuevo Producto al Catálogo"
        onCancel={() => setModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleAddProduct} initialValues={{ stock: 10, category: 'Cafetería' }}>
          <Form.Item label="Nombre del Producto:" name="name" rules={[{ required: true, message: 'Ingresa el nombre' }]}>
            <Input placeholder="Ej: Capuccino Vainilla 350ml" />
          </Form.Item>

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

          <Form.Item label="Precio Unitario:" name="price" rules={[{ required: true, message: 'Ingresa el precio' }]}>
            <InputNumber min={1} style={{ width: '100%' }} placeholder="Ej: 2500" />
          </Form.Item>

          <Form.Item label="Stock Inicial:" name="stock" rules={[{ required: true, message: 'Ingresa el stock' }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="Ej: 20" />
          </Form.Item>

          <Form.Item label="URL de Imagen:" name="image_url">
            <Input placeholder="https://..." />
          </Form.Item>

          <Form.Item label="Descripción Corta:" name="description">
            <Input.TextArea rows={2} placeholder="Ingredientes, presentación o detalles del producto" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="primary" htmlType="submit" loading={submitting} style={{ background: '#0d9488' }}>
                Guardar Producto
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
