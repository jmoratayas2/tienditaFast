'use client';

import React, { useState, useEffect } from 'react';
import {
  Typography,
  Input,
  Radio,
  Space,
  Alert,
  Spin,
  Empty,
  Badge,
  Card,
  Row,
  Col,
} from 'antd';
import {
  SearchOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { Navbar } from '@/components/Navbar';
import { ProductCard } from '@/components/ProductCard';
import { CartDrawer } from '@/components/CartDrawer';
import { Product, CartItem } from '@/lib/types';
import { dataService } from '@/lib/dataService';

const { Title, Paragraph, Text } = Typography;

export default function StorefrontPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const isSupabase = dataService.isUsingSupabase();

  const loadProducts = async () => {
    try {
      const data = await dataService.getProducts();
      setProducts(data);
    } catch (err) {
      console.error('Error cargando catálogo:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();

    // Escuchar actualizaciones de stock en local o eventos
    const handleStorage = () => {
      loadProducts();
    };

    window.addEventListener('tiendita_storage_updated', handleStorage);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('tiendita_storage_updated', handleStorage);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Manejo del carrito
  const handleAddToCart = (product: Product, quantity: number) => {
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

  // Categorías únicas
  const categories = ['Todas', ...Array.from(new Set(products.map((p) => p.category)))];

  // Filtrado
  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === 'Todas' || p.category === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div>
      <Navbar cartCount={totalCartItems} onOpenCart={() => setCartOpen(true)} />

      <main className="main-container">
        {/* Banner de Bienvenida y Políticas del Pedido */}
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
                ¡Haz tu pedido en línea y retira en el mostrador!
              </Title>
              <Paragraph style={{ color: '#ccfbf1', fontSize: 16, marginTop: 8, marginBottom: 16 }}>
                Selecciona tus productos. No necesitas registrarte. Al confirmar, tu pedido queda reservado con un tiempo límite de <strong>10 minutos</strong> para retirarlo en tienda.
              </Paragraph>
              <Space wrap size="middle">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                  <ThunderboltOutlined style={{ color: '#fef08a' }} />
                  <span>Descuento de stock en tiempo real</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                  <ClockCircleOutlined style={{ color: '#fef08a' }} />
                  <span>Temporizador activo de 10 min</span>
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
                  Retiro Inmediato
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
                  10 Minutos Máximo
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>
                  Si no se retira, el pedido se anula y el producto vuelve a estar disponible para otros.
                </div>
              </Card>
            </Col>
          </Row>
        </div>

        {/* Notificación si está en modo local vs Supabase */}
        {!isSupabase && (
          <Alert
            message="Modo Demostración Interactivo Activo"
            description="La tienda está funcionando con base de datos local y temporizador persistente. Para sincronizar en la nube con Supabase, configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local."
            type="info"
            showIcon
            closable
            style={{ marginBottom: 20, borderRadius: 10 }}
          />
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

          <Input
            placeholder="Buscar por nombre o descripción..."
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 280, borderRadius: 8 }}
            allowClear
          />
        </div>

        {/* Listado de Productos */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 12, color: '#64748b' }}>Cargando catálogo de productos...</div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No se encontraron productos que coincidan con la búsqueda."
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

