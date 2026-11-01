'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Divider,
  Alert,
  Space,
  Tag,
  message,
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import { Navbar } from '@/components/Navbar';
import { isSupabaseConfigured, createClientBrowser } from '@/lib/supabase/client';
import { dataService } from '@/lib/dataService';
import { UserRole } from '@/lib/types';

const { Title, Text, Paragraph } = Typography;

export default function AdminLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isSupabase = isSupabaseConfigured();

  // Inicio de sesión normal
  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      if (isSupabase) {
        const supabase = createClientBrowser();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });

        if (error) {
          throw new Error(error.message);
        }

        message.success(`Bienvenido ${data.user.email}`);
        router.push('/admin');
      } else {
        // En modo demostración local, verificar rol en staff_users
        const staff = await dataService.getStaffUsers();
        const found = staff.find((s) => s.email.toLowerCase() === values.email.toLowerCase());

        const role: UserRole = found ? found.role : (values.email.includes('admin') ? 'admin' : 'despachador');
        const name = found ? found.full_name : values.email.split('@')[0];

        const demoStaff = {
          id: found ? found.id : 'staff-' + Math.random().toString(36).substring(2, 7),
          name,
          email: values.email,
          role,
        };
        localStorage.setItem('tiendita_current_staff', JSON.stringify(demoStaff));
        message.success(`Sesión iniciada como ${name} (${role})`);
        router.push('/admin');
      }
    } catch (err: any) {
      message.error(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  // Acceso rápido para demostración
  const handleQuickLogin = (name: string, email: string, role: UserRole) => {
    const demoStaff = {
      id: 'staff-' + (role === 'admin' ? 'admin' : email.split('@')[0]),
      name,
      email,
      role,
    };
    localStorage.setItem('tiendita_current_staff', JSON.stringify(demoStaff));
    message.success(`Ingresaste como: ${name} (${role.toUpperCase()})`);
    router.push('/admin');
  };

  return (
    <div>
      <Navbar />

      <main className="main-container" style={{ maxWidth: 480, marginTop: 40 }}>
        <Card
          style={{
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
            borderRadius: 16,
            padding: 8,
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#ccfbf1',
                color: '#0d9488',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px auto',
                fontSize: 26,
              }}
            >
              <SafetyCertificateOutlined />
            </div>
            <Title level={3} style={{ margin: 0 }}>
              Acceso a Personal Interno
            </Title>
            <Text type="secondary">
              Ingresa con tu cuenta de Administrador o Despachador
            </Text>
          </div>

          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item
              label="Correo Electrónico:"
              name="email"
              rules={[{ required: true, message: 'Ingresa tu correo' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                placeholder="usuario@tiendita.com"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="Contraseña:"
              name="password"
              rules={[{ required: true, message: 'Ingresa tu contraseña' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#94a3b8' }} />}
                placeholder="••••••••"
                size="large"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 12 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
                style={{ background: '#0d9488', height: 46 }}
              >
                Iniciar Sesión
              </Button>
            </Form.Item>
          </Form>

          <Divider style={{ margin: '18px 0', fontSize: 13 }}>
            Acceso Rápido por Rol (Demostración)
          </Divider>

          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <Button
              block
              onClick={() => handleQuickLogin('Administrador Principal', 'admin@tiendita.com', 'admin')}
              icon={<CrownOutlined style={{ color: '#eab308' }} />}
              style={{ textAlign: 'left', height: 44, borderLeft: '3px solid #eab308' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><strong>Admin Principal</strong> (admin@tiendita.com)</span>
                <Tag color="gold">Acceso Total</Tag>
              </div>
            </Button>

            <Button
              block
              onClick={() => handleQuickLogin('Carlos Mora', 'carlos@tiendita.com', 'despachador')}
              icon={<CheckCircleOutlined style={{ color: '#0d9488' }} />}
              style={{ textAlign: 'left', height: 44, borderLeft: '3px solid #0d9488' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><strong>Carlos Mora</strong> (Despachador)</span>
                <Tag color="cyan">Despacho & Caja</Tag>
              </div>
            </Button>

            <Button
              block
              onClick={() => handleQuickLogin('Ana Gómez', 'ana@tiendita.com', 'despachador')}
              icon={<CheckCircleOutlined style={{ color: '#0d9488' }} />}
              style={{ textAlign: 'left', height: 44, borderLeft: '3px solid #0d9488' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><strong>Ana Gómez</strong> (Despachadora)</span>
                <Tag color="cyan">Despacho & Caja</Tag>
              </div>
            </Button>
          </Space>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <Link href="/" style={{ color: '#0d9488', fontSize: 13 }}>
              ← Ir a la Tienda de Clientes
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
