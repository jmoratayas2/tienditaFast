'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Button,
  Badge,
  Tag,
  Drawer,
  Divider,
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
  MenuOutlined,
  CloseOutlined,
  DollarOutlined,
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
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  // Cerrar el drawer al cambiar de ruta
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    if (isConnected) {
      const supabase = createClientBrowser();
      await supabase.auth.signOut();
    }
    localStorage.removeItem('tiendita_current_staff');
    setCurrentUser(null);
    setDrawerOpen(false);
    router.push('/admin/login');
  };

  const isAdmin = userRole === 'admin';
  const isStorefront = !pathname?.startsWith('/admin');

  return (
    <>
      <header className="site-navbar">
        <div className="navbar-inner">
          {/* Lado Izquierdo: Logotipo y marca */}
          <Link href={isStorefront ? '/' : '/admin'} className="brand-link">
            <ShopOutlined style={{ fontSize: 24 }} />
            <span>La Tiendita</span>
            <span className="brand-badge">
              {isStorefront ? 'Pedidos Rápidos' : 'Portal de Gestión'}
            </span>
          </Link>

          {/* Lado Derecho: Acciones y disparador del Menú Lateral */}
          <div className="navbar-actions">
            {isStorefront ? (
              // Vista Clientes
              <>
                {onOpenCart && (
                  <Badge count={cartCount} offset={[-2, 4]} overflowCount={99}>
                    <Button
                      type="primary"
                      icon={<ShoppingCartOutlined style={{ fontSize: 16 }} />}
                      onClick={onOpenCart}
                      style={{
                        background: '#0d9488',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span className="cart-btn-text">Ver Carrito</span>
                    </Button>
                  </Badge>
                )}

                <Button
                  icon={<MenuOutlined style={{ fontSize: 16 }} />}
                  onClick={() => setDrawerOpen(true)}
                  className="nav-menu-btn"
                >
                  <span className="menu-btn-text">Menú</span>
                </Button>
              </>
            ) : (
              // Vista Gestión Interna (Admin / Personal)
              <>
                {currentUser && (
                  <div className="admin-user-pill">
                    <Tag
                      color={isAdmin ? 'gold' : 'cyan'}
                      style={{ margin: 0, fontWeight: 700, padding: '2px 8px', fontSize: 12 }}
                    >
                      {isAdmin ? '🛡️ Admin' : '📦 Despachador'}
                    </Tag>
                    <span className="admin-user-name">
                      {currentUser?.name || currentUser?.email?.split('@')[0]}
                    </span>
                  </div>
                )}

                <Button
                  type="primary"
                  icon={<MenuOutlined style={{ fontSize: 16 }} />}
                  onClick={() => setDrawerOpen(true)}
                  className="nav-menu-btn"
                  style={{
                    background: '#0d9488',
                    fontWeight: 600,
                  }}
                >
                  <span className="menu-btn-text">Menú</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* MENÚ LATERAL DRAWER (Unificado para Escritorio y Móvil)          */}
      {/* ================================================================= */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: '#ccfbf1',
                color: '#0d9488',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
              }}
            >
              <ShopOutlined />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.2, color: '#0f172a' }}>
                La Tiendita
              </div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                {isStorefront ? 'Pedidos Rápidos en Mostrador' : 'Gestión Interna de Pedidos'}
              </div>
            </div>
          </div>
        }
        placement="right"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        width={340}
        closeIcon={<CloseOutlined style={{ fontSize: 16 }} />}
        styles={{ body: { padding: '16px', display: 'flex', flexDirection: 'column' } }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {isStorefront ? (
            // ================= MENÚ: CLIENTES =================
            // (Sin acceso personal ni enlaces de gestión)
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ padding: '4px 6px', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
                Navegación de Clientes
              </div>

              <Link href="/" onClick={() => setDrawerOpen(false)}>
                <div className={`drawer-nav-item ${pathname === '/' ? 'active' : ''}`}>
                  <ShopOutlined style={{ fontSize: 18, color: '#0d9488' }} />
                  <span>Catálogo de Productos</span>
                </div>
              </Link>

              {onOpenCart && (
                <div
                  className="drawer-nav-item"
                  onClick={() => {
                    setDrawerOpen(false);
                    onOpenCart();
                  }}
                >
                  <ShoppingCartOutlined style={{ fontSize: 18, color: '#0d9488' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                    <span>Mi Carrito</span>
                    <Badge count={cartCount} overflowCount={99} style={{ backgroundColor: '#0d9488' }} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            // ================= MENÚ: PERSONAL & ADMIN =================
            // (Sin enlace a Tienda Clientes)
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Tarjeta de perfil del personal conectado */}
              {currentUser && (
                <div className="drawer-user-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        background: isAdmin ? '#fef3c7' : '#ccfbf1',
                        color: isAdmin ? '#d97706' : '#0d9488',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                        flexShrink: 0,
                      }}
                    >
                      <UserOutlined />
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          color: '#0f172a',
                        }}
                      >
                        {currentUser?.name || currentUser?.email?.split('@')[0]}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 3, textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {currentUser?.email}
                      </div>
                      <Tag
                        color={isAdmin ? 'gold' : 'cyan'}
                        style={{ margin: 0, fontSize: 10, fontWeight: 600 }}
                      >
                        {isAdmin ? '🛡️ Administrador' : '📦 Despachador'}
                      </Tag>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ padding: '4px 6px', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
                Módulos de Gestión
              </div>

              <Link href="/admin" onClick={() => setDrawerOpen(false)}>
                <div className={`drawer-nav-item ${pathname === '/admin' ? 'active' : ''}`}>
                  <DashboardOutlined style={{ fontSize: 18, color: '#0d9488' }} />
                  <span>Pedidos Activos</span>
                </div>
              </Link>

              <Link href="/admin/balance" onClick={() => setDrawerOpen(false)}>
                <div className={`drawer-nav-item ${pathname === '/admin/balance' ? 'active' : ''}`}>
                  <DollarOutlined style={{ fontSize: 18, color: '#0d9488' }} />
                  <span>Balance de Ventas</span>
                </div>
              </Link>

              <Link href="/admin/inventario" onClick={() => setDrawerOpen(false)}>
                <div className={`drawer-nav-item ${pathname === '/admin/inventario' ? 'active' : ''}`}>
                  <AppstoreOutlined style={{ fontSize: 18, color: '#0d9488' }} />
                  <span>Catálogo & Horarios</span>
                </div>
              </Link>

              {isAdmin && (
                <>
                  <Link href="/admin/configuracion" onClick={() => setDrawerOpen(false)}>
                    <div className={`drawer-nav-item ${pathname === '/admin/configuracion' ? 'active' : ''}`}>
                      <SettingOutlined style={{ fontSize: 18, color: '#0d9488' }} />
                      <span>Configurar Portal</span>
                    </div>
                  </Link>

                  <Link href="/admin/usuarios" onClick={() => setDrawerOpen(false)}>
                    <div className={`drawer-nav-item ${pathname === '/admin/usuarios' ? 'active' : ''}`}>
                      <TeamOutlined style={{ fontSize: 18, color: '#0d9488' }} />
                      <span>Personal & Roles</span>
                    </div>
                  </Link>
                </>
              )}

              <Divider style={{ margin: '14px 0' }} />

              <div
                className="drawer-nav-item"
                onClick={handleLogout}
                style={{ color: '#ef4444' }}
              >
                <LogoutOutlined style={{ fontSize: 18, color: '#ef4444' }} />
                <span>Cerrar Sesión</span>
              </div>
            </div>
          )}
        </div>

        {/* Pie del Menú */}
        <div style={{ paddingTop: 16, borderTop: '1px solid #f1f5f9', textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
          La Tiendita • v1.3 Sistema Unificado
        </div>
      </Drawer>
    </>
  );
};
