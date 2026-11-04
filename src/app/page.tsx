'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Typography,
  Input,
  Radio,
  Space,
  Spin,
  Empty,
  Badge,
  Card,
  Row,
  Col,
  Alert,
  Switch,
  Tag,
} from 'antd';
import {
  SearchOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
  StarFilled,
  ShopOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { Navbar } from '@/components/Navbar';
import { ProductCard } from '@/components/ProductCard';
import { CartDrawer } from '@/components/CartDrawer';
import { Product, CartItem, StoreSettings } from '@/lib/types';
import { dataService } from '@/lib/dataService';
import { DEFAULT_STORE_SETTINGS } from '@/lib/mockData';
import { isProductAvailableNow } from '@/lib/formatters';

const { Title, Paragraph, Text } = Typography;

export default function StorefrontPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [onlyAvailableNow, setOnlyAvailableNow] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  const loadData = async () => {
    try {
      const [allProds, currentSettings] = await Promise.all([
        dataService.getProducts(false),
        dataService.getStoreSettings(),
      ]);
      setProducts(allProds);
      setSettings(currentSettings);
    } catch (err) {
      console.error('Error cargando catálogo:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleStorage = () => {
      loadData();
    };

    window.addEventListener('tiendita_storage_updated', handleStorage);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('tiendita_storage_updated', handleStorage);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const handleAddToCart = (product: Product, quantity: number) => {
    if (!settings.is_store_open) return;

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
    setCartOpen(true);
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const categories = ['Todas', ...Array.from(new Set(products.map((p) => p.category)))];

  // Filtrado de productos
  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === 'Todas' || p.category === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));

    if (onlyAvailableNow) {
      const status = isProductAvailableNow(p);
      return matchesCategory && matchesSearch && status.available && p.stock > 0;
    }

    return matchesCategory && matchesSearch;
  });

  // Productos destacados
  const featuredProducts = products.filter((p) => p.is_featured && p.is_active);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar cartCount={totalCartItems} onOpenCart={() => setCartOpen(true)} />

      <main className="main-container" style={{ flex: 1 }}>
        {/* Aviso si la tienda está cerrada por el administrador */}
        {!settings.is_store_open && (
          <Alert
            message="Atención: Recepción de pedidos temporalmente pausada"
            description={settings.closed_message || 'En este momento no estamos recibiendo pedidos en línea.'}
            type="warning"
            showIcon
            style={{ marginBottom: 24, borderRadius: 12, border: '1px solid #fde68a' }}
          />
        )}

        {/* Banner Configurable por el Administrador */}
        {settings.banner_active && (
          <div
            style={{
              background: 'linear-gradient(135deg, #0d9488 0%, #047857 100%)',
              color: '#ffffff',
              borderRadius: 16,
              padding: '32px 24px',
              marginBottom: 28,
              boxShadow: '0 10px 15px -3px rgba(13, 148, 136, 0.2)',
            }}
          >
            <Row gutter={[24, 24]} align="middle">
              <Col xs={24} md={16}>
                <Title level={2} style={{ color: '#ffffff', margin: 0, fontWeight: 800 }}>
                  {settings.banner_title}
                </Title>
                <Paragraph style={{ color: '#ccfbf1', fontSize: 16, marginTop: 8, marginBottom: 16 }}>
                  {settings.banner_message}
                </Paragraph>
                <Space wrap size="middle">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                    <ThunderboltOutlined style={{ color: '#fef08a' }} />
                    <span>Descuento de stock en tiempo real</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                    <ClockCircleOutlined style={{ color: '#fef08a' }} />
                    <span>Límite de {settings.pickup_time_minutes} minutos para retirar</span>
                  </div>
                </Space>
              </Col>
              <Col xs={24} md={8} style={{ textAlign: 'center' }}>
                <Card
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    backdropFilter: 'blur(8px)',
                    color: '#ffffff',
                    borderRadius: 12,
                  }}
                >
                  <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: '#e2e8f0' }}>
                    Tiempo de Retiro
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>
                    {settings.pickup_time_minutes} Minutos
                  </div>
                  <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>
                    El producto se aparta inmediatamente al confirmar.
                  </div>
                </Card>
              </Col>
            </Row>
          </div>
        )}

        {/* Sección de Productos Destacados (Si está habilitada y hay destacados) */}
        {settings.show_featured_section && featuredProducts.length > 0 && selectedCategory === 'Todas' && !search && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <StarFilled style={{ color: '#f59e0b', fontSize: 18 }} />
              <Title level={3} style={{ margin: 0, fontSize: 20 }}>
                Productos Destacados
              </Title>
            </div>
            <div className="product-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
              {featuredProducts.slice(0, 4).map((product) => {
                const inCart = cart.find((item) => item.product.id === product.id)?.quantity || 0;
                return (
                  <ProductCard
                    key={`feat-${product.id}`}
                    product={product}
                    cartQuantity={inCart}
                    onAddToCart={handleAddToCart}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Filtros de Búsqueda y Categorías */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Radio.Group
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            buttonStyle="solid"
            size="middle"
          >
            {categories.map((cat) => (
              <Radio.Button key={cat} value={cat}>
                {cat}
              </Radio.Button>
            ))}
          </Radio.Group>

          <Space wrap size="middle">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={onlyAvailableNow}
                onChange={setOnlyAvailableNow}
                size="small"
              />
              <span style={{ fontSize: 13, color: '#475569' }}>
                Solo disponibles ahora
              </span>
            </div>

            <Input
              placeholder="Buscar por nombre o descripción..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 260, borderRadius: 8 }}
              allowClear
            />
          </Space>
        </div>

        {/* Listado de Productos */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 12, color: '#64748b' }}>Cargando catálogo disponible...</div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No se encontraron productos disponibles con los filtros aplicados."
            style={{ margin: '60px 0' }}
          />
        ) : (
          <div className="product-grid">
            {filteredProducts.map((product) => {
              const inCart = cart.find((item) => item.product.id === product.id)?.quantity || 0;
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  cartQuantity={inCart}
                  onAddToCart={handleAddToCart}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* Footer para Clientes con enlace discreto a personal */}
      <footer style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', padding: '24px 16px', marginTop: 40 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            © {new Date().getFullYear()} <strong>La Tiendita</strong>. Plataforma de Pedidos Rápidos en Mostrador.
          </div>
          <Link href="/admin/login" style={{ fontSize: 13, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
            <SafetyCertificateOutlined />
            <span>Acceso Personal Administrativo</span>
          </Link>
        </div>
      </footer>

      {/* Carrito de Compras Lateral */}
      <CartDrawer
        visible={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveFromCart}
        onClearCart={handleClearCart}
      />
    </div>
  );
}
