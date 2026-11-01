'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button, Badge, Space, Tag, Dropdown, MenuProps } from 'antd';
import {
  ShopOutlined,
  ShoppingCartOutlined,
  DashboardOutlined,
  AppstoreOutlined,
  UserOutlined,
  TeamOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { isSupabaseConfigured, createClientBrowser } from '@/lib/supabase/client';
import { dataService } from '@/lib/dataService';
import { StaffUser } from '@/lib/types';

interface NavbarProps {
  cartCount?: number;
  onOpenCart?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ cartCount = 0, onOpenCart }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'admin' | 'despachador'>('despachador');
  const isConnected = isSupabaseConfigured();

  const loadUserProfile = async (userEmail: string) => {
    try {
      const staffList = await dataService.getStaffUsers();
      const profile = staffList.find(
        (s) => s.email.toLowerCase() === userEmail.toLowerCase()
      );
      if (profile) {
        setUserRole(profile.role);
        return;
      }
    } catch {
      // ignore
    }
    if (userEmail.toLowerCase().includes('admin')) {
      setUserRole('admin');
    } else {
      setUserRole('despachador');
    }
  };

  useEffect(() => {
    if (isConnected) {
      const supabase = createClientBrowser();
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) {
          setCurrentUser(data.user);
          loadUserProfile(data.user.email || '');
        }
      });

      const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
        if (session?.user) {
          setCurrentUser(session.user);
          loadUserProfile(session.user.email || '');
        } else {
          setCurrentUser(null);
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    } else {
      const localUser = localStorage.getItem('tiendita_current_staff');
      if (localUser) {
        try {
          const parsed = JSON.parse(localUser);
          setCurrentUser(parsed);
          setUserRole(parsed.role || (parsed.email?.includes('admin') ? 'admin' : 'despachador'));
        } catch {
          setCurrentUser(null);
        }
      }
    }
  }, [isConnected]);

  const handleLogout = async () => {
    if (isConnected) {
      const supabase = createClientBrowser();
      await supabase.auth.signOut();
    }
    localStorage.removeItem('tiendita_current_staff');
    setCurrentUser(null);
    router.push('/admin/login');
  };

  const isAdmin = userRole === 'admin';

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'user-email',
      label: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontWeight: 600 }}>{currentUser?.email || currentUser?.name || 'Personal'}</div>
          <div style={{ marginTop: 2 }}>
            <Tag color={isAdmin ? 'gold' : 'cyan'}>
              {isAdmin ? '🛡️ Administrador' : '📦 Despachador'}
            </Tag>
          </div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'despacho',
      icon: <DashboardOutlined />,
      label: <Link href="/admin">Panel de Despacho</Link>,
    },
    ...(isAdmin
      ? [
          {
            key: 'inventario',
            icon: <AppstoreOutlined />,
            label: <Link href="/admin/inventario">Inventario & Precios</Link>,
          },
          {
            key: 'usuarios',
            icon: <TeamOutlined />,
            label: <Link href="/admin/usuarios">Gestión de Personal</Link>,
          },
        ]
      : [
          {
            key: 'inventario',
            icon: <AppstoreOutlined />,
            label: <Link href="/admin/inventario">Consultar Stock</Link>,
          },
        ]),
    { type: 'divider' },
    {
      key: 'logout',
      danger: true,
      icon: <LogoutOutlined />,
      label: 'Cerrar Sesión',
      onClick: handleLogout,
    },
  ];

  const isStorefront = !pathname?.startsWith('/admin');

  return (
    <header className="site-navbar">
      <div className="navbar-inner">
        <Link href="/" className="brand-link">
          <ShopOutlined style={{ fontSize: 26 }} />
          <span>La Tiendita</span>
          <span className="brand-badge">Pedidos Rápidos</span>
        </Link>

        <Space direction="horizontal" size="middle">
          {isStorefront ? (
            <>
              <Link href="/">
                <Button type={pathname === '/' ? 'primary' : 'text'}>
                  Catálogo
                </Button>
              </Link>

              {onOpenCart && (
                <Badge count={cartCount} offset={[-2, 4]} overflowCount={99}>
                  <Button
                    type="primary"
                    icon={<ShoppingCartOutlined />}
                    onClick={onOpenCart}
                    style={{ background: '#0d9488' }}
                  >
                    Ver Carrito
                  </Button>
                </Badge>
              )}

              <Link href="/admin">
                <Button icon={<DashboardOutlined />}>
                  Área de Despacho
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link href="/">
                <Button icon={<ShopOutlined />}>
                  Ir a Tienda
                </Button>
              </Link>

              <Link href="/admin">
                <Button type={pathname === '/admin' ? 'primary' : 'default'} icon={<DashboardOutlined />}>
                  Pedidos Activos
                </Button>
              </Link>

              <Link href="/admin/inventario">
                <Button type={pathname === '/admin/inventario' ? 'primary' : 'default'} icon={<AppstoreOutlined />}>
                  Inventario
                </Button>
              </Link>

              {isAdmin && (
                <Link href="/admin/usuarios">
                  <Button type={pathname === '/admin/usuarios' ? 'primary' : 'default'} icon={<TeamOutlined />}>
                    Usuarios
                  </Button>
                </Link>
              )}
            </>
          )}

          {currentUser ? (
            <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
              <Button icon={<UserOutlined />} style={{ borderColor: isAdmin ? '#eab308' : '#0d9488' }}>
                <span style={{ fontWeight: 600 }}>
                  {currentUser?.email ? currentUser.email.split('@')[0] : currentUser.name || 'Mi Cuenta'}
                </span>
                <Tag color={isAdmin ? 'gold' : 'cyan'} style={{ marginLeft: 6, fontSize: 11 }}>
                  {isAdmin ? 'Admin' : 'Despachador'}
                </Tag>
              </Button>
            </Dropdown>
          ) : (
            <Link href="/admin/login">
              <Button type="dashed" icon={<SafetyCertificateOutlined />}>
                Ingreso Personal
              </Button>
            </Link>
          )}
        </Space>
      </div>
    </header>
  );
};
