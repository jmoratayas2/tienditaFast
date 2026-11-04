'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Typography,
  Card,
  Form,
  Input,
  InputNumber,
  Switch,
  Button,
  Space,
  Row,
  Col,
  Divider,
  Alert,
  Result,
  message,
} from 'antd';
import {
  SettingOutlined,
  SaveOutlined,
  ShopOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  StarOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { Navbar } from '@/components/Navbar';
import { StoreSettings, UserRole } from '@/lib/types';
import { dataService } from '@/lib/dataService';
import { DEFAULT_STORE_SETTINGS } from '@/lib/mockData';
import { isSupabaseConfigured, createClientBrowser } from '@/lib/supabase/client';

const { Title, Text, Paragraph } = Typography;

export default function AdminPortalConfigPage() {
  const [form] = Form.useForm();
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  // Cargar configuración existente
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await dataService.getStoreSettings();
      setSettings(data);
      form.setFieldsValue(data);
    } catch (err: any) {
      message.error(err.message || 'Error cargando configuración');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (values: any) => {
    try {
      setSaving(true);
      const updated = await dataService.updateStoreSettings(values);
      setSettings(updated);
      message.success('¡Configuración del portal de clientes guardada correctamente!');
    } catch (err: any) {
      message.error(err.message || 'Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = userRole === 'admin';

  if (!loading && !isAdmin) {
    return (
      <div>
        <Navbar />
        <div className="main-container" style={{ maxWidth: 600, marginTop: 60 }}>
          <Result
            status="403"
            title="Acceso Restringido"
            subTitle="Solo el Administrador tiene autorización para cambiar la configuración visual y operativa del portal de clientes."
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

  return (
    <div>
      <Navbar />

      <main className="main-container" style={{ maxWidth: 900 }}>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>
              Configuración del Portal de Clientes
            </Title>
            <Text type="secondary">
              Personaliza qué ven los clientes en la tienda: estado de apertura, banners, horarios y tiempos de retiro.
            </Text>
          </div>

          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchSettings} loading={loading}>
              Recargar
            </Button>
            <Link href="/" target="_blank">
              <Button icon={<EyeOutlined />}>
                Ver Portal de Clientes
              </Button>
            </Link>
          </Space>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={settings}
        >
          {/* 1. Estado Operativo de la Tienda */}
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShopOutlined style={{ color: '#0d9488' }} />
                <span>Disponibilidad General de la Tienda</span>
              </div>
            }
            style={{ marginBottom: 24 }}
          >
            <Row gutter={[24, 16]}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Recepción de Pedidos en Línea:"
                  name="is_store_open"
                  valuePropName="checked"
                  extra="Si desactivas esta opción, los clientes podrán ver el catálogo pero no podrán confirmar nuevos pedidos."
                >
                  <Switch
                    checkedChildren="Tienda Abierta"
                    unCheckedChildren="Tienda Cerrada"
                  />
                </Form.Item>
              </Col>

              <Col xs={24} md={12}>
                <Form.Item
                  label="Tiempo Límite para Retirar Pedidos (Minutos):"
                  name="pickup_time_minutes"
                  rules={[{ required: true, message: 'Indica los minutos' }]}
                  extra="Plazo tras el cual el pedido se anula automáticamente y libera el inventario."
                >
                  <InputNumber min={3} max={60} style={{ width: '100%' }} addonAfter="minutos" />
                </Form.Item>
              </Col>

              <Col span={24}>
                <Form.Item
                  label="Mensaje cuando la tienda esté cerrada:"
                  name="closed_message"
                >
                  <Input.TextArea
                    rows={2}
                    placeholder="Ej: En este momento la tienda se encuentra cerrada para pedidos en línea. Visítanos en mostrador."
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* 2. Banner Principal & Mensajes de Portada */}
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <EyeOutlined style={{ color: '#0d9488' }} />
                <span>Banner de Bienvenida para Clientes</span>
              </div>
            }
            style={{ marginBottom: 24 }}
          >
            <Form.Item
              label="Mostrar Banner Superior en el Portal:"
              name="banner_active"
              valuePropName="checked"
            >
              <Switch checkedChildren="Visible" unCheckedChildren="Oculto" />
            </Form.Item>

            <Form.Item
              label="Título del Banner:"
              name="banner_title"
              rules={[{ required: true, message: 'Ingresa un título para el banner' }]}
            >
              <Input placeholder="Ej: ¡Haz tu pedido en línea y retira en el mostrador!" />
            </Form.Item>

            <Form.Item
              label="Mensaje Descriptivo del Banner:"
              name="banner_message"
              rules={[{ required: true, message: 'Ingresa el texto del banner' }]}
            >
              <Input.TextArea
                rows={2}
                placeholder="Ej: Selecciona tus productos sin registrarte. Quedan reservados con tiempo límite."
              />
            </Form.Item>
          </Card>

          {/* 3. Módulos y Secciones Visuales */}
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StarOutlined style={{ color: '#0d9488' }} />
                <span>Secciones del Catálogo</span>
              </div>
            }
            style={{ marginBottom: 24 }}
          >
            <Form.Item
              label="Sección de Productos Destacados en Portada:"
              name="show_featured_section"
              valuePropName="checked"
              extra="Muestra un carrusel o cuadrícula destacada con los productos marcados como 'Destacados' en el inventario."
            >
              <Switch checkedChildren="Activa" unCheckedChildren="Desactivada" />
            </Form.Item>

            <Divider style={{ margin: '16px 0' }} />

            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Hora de Apertura General de la Tienda:"
                  name="opening_time"
                >
                  <Input placeholder="07:00" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Hora de Cierre General de la Tienda:"
                  name="closing_time"
                >
                  <Input placeholder="21:00" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <div style={{ textAlign: 'right', marginBottom: 40 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              icon={<SaveOutlined />}
              loading={saving}
              style={{ background: '#0d9488', minWidth: 200, height: 46 }}
            >
              Guardar Cambios del Portal
            </Button>
          </div>
        </Form>
      </main>
    </div>
  );
}

