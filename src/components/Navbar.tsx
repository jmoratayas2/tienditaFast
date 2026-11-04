'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Button,
  Badge,
  Space,
  Tag,
  Dropdown,
  Drawer,
  Divider,
  MenuProps,
} from 'antd';
import {
  ShopOutlined,
  ShoppingCartOutlined,
  DashboardOutlined,
  AppstoreOutlined,
  UserOutlined,
  TeamOutlined,
  SettingOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  MenuOutlined,
  CloseOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { isSupabaseConfigured, createClientBrowser } from '@/lib/supabase/client';
import { dataService } from '@/lib/dataService';
import { UserRole } from '@/lib/types';

interface NavbarProps {
  cartCount?: number;
  onOpenCart?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ cartCount = 0, onOpenCart }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole>('despachador');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
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

  // Cerrar el drawer móvil al cambiar de ruta
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    if (isConnected) {
      const supabase = createClientBrowser();
      await supabase.auth.signOut();
    }
    localStorage.removeItem('tiendita_current_staff');
    setCurrentUser(null);
    setMobileDrawerOpen(false);
    router.push('/admin/login');
  };

  const isAdmin = userRole === 'admin';
  const isStorefront = !pathname?.startsWith('/admin');

  // Menú dropdown de escritorio para personal
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'user-email',
      label: (
        <div style={{ padding: '4px 0' }}>
          <div style={{ fontWeight: 600 }}>{currentUser?.name || currentUser?.email || 'Personal'}</div>
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
    {
      key: 'inventario',
      icon: <AppstoreOutlined />,
      label: <Link href="/admin/inventario">Catálogo & Horarios</Link>,
    },
    ...(isAdmin
      ? [
          {
            key: 'configuracion',
            icon: <SettingOutlined />,
            label: <Link href="/admin/configuracion">Configurar Portal</Link>,
          },
          {
            key: 'usuarios',
            icon: <TeamOutlined />,
            label: <Link href="/admin/usuarios">Personal & Roles</Link>,
          },
        ]
      : []),
    { type: 'divider' },
    {
      key: 'store',
      icon: <ShopOutlined />,
      label: <Link href="/">Ver Tienda de Clientes</Link>,
    },
    {
      key: 'logout',
      danger: true,
      icon: <LogoutOutlined />,
      label: 'Cerrar Sesión',
      onClick: handleLogout,
    },
  ];

  return (
    <>
      <header className="site-navbar">
        <div className="navbar-inner">
          {/* Lado Izquierdo: Logotipo y marca */}
          <Link href={isStorefront ? '/' : '/admin'} className="brand-link">
            <ShopOutlined style={{ fontSize: 26 }} />
            <span>La Tiendita</span>
            <span className="brand-badge">
              {isStorefront ? 'Pedidos Rápidos' : 'Portal de Gestión'}
            </span>
          </Link>

          {/* ================================================================= */}
          {/* NAVEGACIÓN ESCRITORIO (>= 820px)                                  */}
          {/* ================================================================= */}
          <div className="nav-desktop">
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

                  <Link href="/admin/login">
                    <Button type="text" icon={<SafetyCertificateOutlined />} style={{ color: '#64748b' }}>
                      Acceso Personal
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/admin">
                    <Button type={pathname === '/admin' ? 'primary' : 'default'} icon={<DashboardOutlined />}>
                      Pedidos Activos
                    </Button>
                  </Link>

                  <Link href="/admin/inventario">
                    <Button type={pathname === '/admin/inventario' ? 'primary' : 'default'} icon={<AppstoreOutlined />}>
                      Catálogo & Horarios
                    </Button>
                  </Link>

                  {isAdmin && (
                    <>
                      <Link href="/admin/configuracion">
                        <Button type={pathname === '/admin/configuracion' ? 'primary' : 'default'} icon={<SettingOutlined />}>
                          Configurar Portal
                        </Button>
                      </Link>

                      <Link href="/admin/usuarios">
                        <Button type={pathname === '/admin/usuarios' ? 'primary' : 'default'} icon={<TeamOutlined />}>
                          Personal
                        </Button>
                      </Link>
                    </>
                  )}

                  <Link href="/">
                    <Button type="dashed" icon={<ShopOutlined />}>
                      Tienda Clientes
                    </Button>
                  </Link>

                  {currentUser && (
                    <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
                      <Button icon={<UserOutlined />} style={{ borderColor: isAdmin ? '#eab308' : '#0d9488' }}>
                        <span style={{ fontWeight: 600 }}>
                          {currentUser?.name || currentUser?.email?.split('@')[0] || 'Mi Cuenta'}
                        </span>
                        <Tag color={isAdmin ? 'gold' : 'cyan'} style={{ marginLeft: 6, fontSize: 11 }}>
                          {isAdmin ? 'Admin' : 'Despachador'}
                        </Tag>
                      </Button>
                    </Dropdown>
                  )}
                </>
              )}
            </Space>
          </div>

          {/* ================================================================= */}
          {/* NAVEGACIÓN MÓVIL (< 820px) CON MENÚ HAMBURGUESA                  */}
          {/* ================================================================= */}
          <div className="nav-mobile">
            {/* Si es cliente, acceso directo y destacado al carrito en móvil */}
            {isStorefront && onOpenCart && (
              <Badge count={cartCount} offset={[-3, 3]} overflowCount={99}>
                <Button
                  type="primary"
                  icon={<ShoppingCartOutlined />}
                  onClick={onOpenCart}
                  style={{ background: '#0d9488', height: 38, width: 38 }}
                />
              </Badge>
            )}

            {/* Si es personal, badge rápido de rol en móvil */}
            {!isStorefront && currentUser && (
              <Tag color={isAdmin ? 'gold' : 'cyan'} style={{ margin: 0, fontSize: 11 }}>
                {isAdmin ? 'Admin' : 'Despacho'}
              </Tag>
            )}

            {/* Botón de Hamburguesa */}
            <Button
              icon={<MenuOutlined style={{ fontSize: 18 }} />}
              onClick={() => setMobileDrawerOpen(true)}
              style={{
                height: 38,
                width: 38,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderColor: '#cbd5e1',
              }}
            />
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* DRAWER LATERAL DEL MENÚ HAMBURGUESA (MÓVIL)                       */}
      {/* ================================================================= */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShopOutlined style={{ color: '#0d9488', fontSize: 22 }} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.2 }}>La Tiendita</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {isStorefront ? 'Pedidos Rápidos en Mostrador' : 'Gestión Interna'}
              </div>
            </div>
          </div>
        }
        placement="right"
        onClose={() => setMobileDrawerOpen(false)}
        open={mobileDrawerOpen}
        width={300}
        closeIcon={<CloseOutlined style={{ fontSize: 16 }} />}
        styles={{ body: { padding: '16px', display: 'flex', flexDirection: 'column' } }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {isStorefront ? (
            // ================= MENÚ HAMBURGUESA: CLIENTES =================
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href="/" onClick={() => setMobileDrawerOpen(false)}>
                <div className={`mobile-nav-item ${pathname === '/' ? 'active' : ''}`}>
                  <ShopOutlined style={{ fontSize: 18, color: '#0d9488' }} />
                  <span>Catálogo de Productos</span>
                </div>
              </Link>

              {onOpenCart && (
                <div
                  className="mobile-nav-item"
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    onOpenCart();
                  }}
                >
                  <ShoppingCartOutlined style={{ fontSize: 18, color: '#0d9488' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                    <span>Mi Carrito</span>
                    <Badge count={cartCount} overflowCount={99} />
                  </div>
                </div>
              )}

              <Divider style={{ margin: '14px 0' }} />

              <div style={{ padding: '0 4px', fontSize: 12, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Personal de la Tienda
              </div>

              <Link href="/admin/login" onClick={() => setMobileDrawerOpen(false)}>
                <div className="mobile-nav-item">
                  <SafetyCertificateOutlined style={{ fontSize: 18, color: '#64748b' }} />
                  <span>Acceso Administrativo</span>
                </div>
              </Link>
            </div>
          ) : (
            // ================= MENÚ HAMBURGUESA: PERSONAL & ADMIN =================
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Tarjeta de información del usuario */}
              {currentUser && (
                <div className="mobile-user-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: isAdmin ? '#fef3c7' : '#ccfbf1',
                        color: isAdmin ? '#d97706' : '#0d9488',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                      }}
                    >
                      <UserOutlined />
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {currentUser?.name || currentUser?.email?.split('@')[0]}
                      </div>
                      <Tag color={isAdmin ? 'gold' : 'cyan'} style={{ marginTop: 2, fontSize: 10 }}>
                        {isAdmin ? '🛡️ Administrador' : '📦 Despachador'}
                      </Tag>
                    </div>
                  </div>
                </div>
              )}

              <Link href="/admin" onClick={() => setMobileDrawerOpen(false)}>
                <div className={`mobile-nav-item ${pathname === '/admin' ? 'active' : ''}`}>
                  <DashboardOutlined style={{ fontSize: 18, color: '#0d9488' }} />
                  <span>Pedidos Activos</span>
                </div>
              </Link>

              <Link href="/admin/inventario" onClick={() => setMobileDrawerOpen(false)}>
                <div className={`mobile-nav-item ${pathname === '/admin/inventario' ? 'active' : ''}`}>
                  <AppstoreOutlined style={{ fontSize: 18, color: '#0d9488' }} />
                  <span>Catálogo & Horarios</span>
                </div>
              </Link>

              {isAdmin && (
                <>
                  <Link href="/admin/configuracion" onClick={() => setMobileDrawerOpen(false)}>
                    <div className={`mobile-nav-item ${pathname === '/admin/configuracion' ? 'active' : ''}`}>
                      <SettingOutlined style={{ fontSize: 18, color: '#0d9488' }} />
                      <span>Configurar Portal</span>
                    </div>
                  </Link>

                  <Link href="/admin/usuarios" onClick={() => setMobileDrawerOpen(false)}>
                    <div className={`mobile-nav-item ${pathname === '/admin/usuarios' ? 'active' : ''}`}>
                      <TeamOutlined style={{ fontSize: 18, color: '#0d9488' }} />
                      <span>Personal & Roles</span>
                    </div>
                  </Link>
                </>
              )}

              <Divider style={{ margin: '14px 0' }} />

              <Link href="/" onClick={() => setMobileDrawerOpen(false)}>
                <div className="mobile-nav-item">
                  <ShopOutlined style={{ fontSize: 18, color: '#64748b' }} />
                  <span>Ver Tienda de Clientes</span>
                </div>
              </Link>

              <div
                className="mobile-nav-item"
                onClick={handleLogout}
                style={{ color: '#ef4444' }}
              >
                <LogoutOutlined style={{ fontSize: 18, color: '#ef4444' }} />
                <span>Cerrar Sesión</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer del Drawer */}
        <div style={{ paddingTop: 16, borderTop: '1px solid #f1f5f9', textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
          La Tiendita • v1.2 Móvil Ready
        </div>
      </Drawer>
    </>
  );
};
