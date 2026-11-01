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
} from 'antd';
import {
  SearchOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
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

  const categories = ['Todas', ...Array.from(new Set(products.map((p) => p.category)))];

  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === 'Todas' || p.category === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar cartCount={totalCartItems} onOpenCart={() => setCartOpen(true)} />

      <main className="main-container" style={{ flex: 1 }}>
        {/* Banner de Bienvenida y Políticas del Pedido Rápido */}
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
                Pedidos Rápidos para Retiro en Mostrador
              </Title>
              <Paragraph style={{ color: '#ccfbf1', fontSize: 16, marginTop: 8, marginBottom: 16 }}>
                Elige tus productos y confirma tu pedido <strong>sin necesidad de crear una cuenta</strong>. Tus artículos quedan apartados al instante con un límite de <strong>10 minutos</strong> para retirar y pagar en caja.
              </Paragraph>
              <Space wrap size="middle">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                  <ThunderboltOutlined style={{ color: '#fef08a' }} />
                  <span>Reserva automática de existencias</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                  <ClockCircleOutlined style={{ color: '#fef08a' }} />
                  <span>10 minutos para recoger tu pedido</span>
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
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 4 }}>
                  10 Minutos
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>
                  Si el pedido no es retirado dentro del plazo, se anulará automáticamente para liberar el inventario.
                </div>
              </Card>
            </Col>
          </Row>
        </div>

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
            <div style={{ marginTop: 12, color: '#64748b' }}>Cargando catálogo disponible...</div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No se encontraron productos disponibles en esta categoría."
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
