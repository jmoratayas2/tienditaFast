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
  Space,
  Tag,
  Alert,
  message,
} from 'antd';
import {
  UserOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { isSupabaseConfigured, createClientBrowser } from '@/lib/supabase/client';
import { dataService } from '@/lib/dataService';
import { UserRole } from '@/lib/types';

const { Title, Text } = Typography;

export default function AdminLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSupabase = isSupabaseConfigured();

  const onFinish = async (values: any) => {
    setLoading(true);
    setErrorMessage(null);
    const email = values.email.trim().toLowerCase();
    const password = values.password;

    try {
      if (isSupabase) {
        const supabase = createClientBrowser();
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (authError) {
          throw new Error('Credenciales inválidas. Por favor verifica tu correo y contraseña.');
        }

        // Verificar estado y rol en staff_users
        const { data: staffProfile, error: staffError } = await supabase
          .from('staff_users')
          .select('*')
          .eq('email', email)
          .single();

        if (staffProfile) {
          if (!staffProfile.is_active) {
            await supabase.auth.signOut();
            throw new Error('Tu cuenta ha sido desactivada por el administrador.');
          }

          const staffSession = {
            id: staffProfile.id,
            name: staffProfile.full_name,
            email: staffProfile.email,
            role: staffProfile.role as UserRole,
          };
          localStorage.setItem('tiendita_current_staff', JSON.stringify(staffSession));
        } else {
          // Si no existe fila en staff_users, registrar sesión con su nombre completo de metadatos o por defecto
          const metaName = authData.user?.user_metadata?.full_name || 'Administrador Principal';
          const staffSession = {
            id: authData.user.id,
            name: metaName,
            email: email,
            role: email.includes('admin') ? ('admin' as UserRole) : ('despachador' as UserRole),
          };
          localStorage.setItem('tiendita_current_staff', JSON.stringify(staffSession));
        }

        message.success('Inicio de sesión exitoso');
        router.push('/admin');
      } else {
        // Fallback local: verificar si el usuario existe en el registro del personal
        const staffList = await dataService.getStaffUsers();
        const found = staffList.find((s) => s.email.toLowerCase() === email);

        if (!found) {
          throw new Error('No existe una cuenta registrada con este correo electrónico.');
        }

        if (!found.is_active) {
          throw new Error('Esta cuenta ha sido desactivada por el administrador.');
        }

        const staffSession = {
          id: found.id,
          name: found.full_name,
          email: found.email,
          role: found.role,
        };
        localStorage.setItem('tiendita_current_staff', JSON.stringify(staffSession));

        message.success(`Bienvenido ${found.full_name}`);
        router.push('/admin');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Header simplificado */}
      <header style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '14px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 800, color: '#0d9488' }}>
            <ShopOutlined style={{ fontSize: 22 }} />
            <span>La Tiendita</span>
          </Link>
          <Link href="/">
            <Button icon={<ArrowLeftOutlined />}>
              Ir a Pedidos Rápidos
            </Button>
          </Link>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>
        <Card
          style={{
            maxWidth: 440,
            width: '100%',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08)',
            borderRadius: 16,
            padding: 12,
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
            <Title level={3} style={{ margin: 0, fontWeight: 700 }}>
              Portal Administrativo
            </Title>
            <Text type="secondary" style={{ fontSize: 14 }}>
              Acceso exclusivo para administradores y despachadores
            </Text>
          </div>

          {errorMessage && (
            <Alert
              message={errorMessage}
              type="error"
              showIcon
              closable
              onClose={() => setErrorMessage(null)}
              style={{ marginBottom: 20 }}
            />
          )}

          <Form layout="vertical" onFinish={onFinish} size="large">
            <Form.Item
              label="Correo Electrónico:"
              name="email"
              rules={[
                { required: true, message: 'Ingresa tu correo institucional' },
                { type: 'email', message: 'Ingresa un formato de correo válido' },
              ]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#94a3b8' }} />}
                placeholder="usuario@tiendita.com"
                autoComplete="email"
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
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item style={{ marginTop: 24, marginBottom: 12 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                style={{ background: '#0d9488', height: 46, fontSize: 15, fontWeight: 600 }}
              >
                Ingresar al Sistema
              </Button>
            </Form.Item>
          </Form>

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link href="/" style={{ color: '#0d9488', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ArrowLeftOutlined />
              <span>Volver a la vista de clientes</span>
            </Link>
          </div>
        </Card>
      </main>
    </div>
  );
}
