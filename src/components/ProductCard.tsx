'use client';

import React, { useState } from 'react';
import { Card, Tag, Button, InputNumber, Space, Typography, Tooltip } from 'antd';
import { PlusOutlined, ClockCircleOutlined, StarFilled } from '@ant-design/icons';
import { Product } from '@/lib/types';
import { formatCurrency, isProductAvailableNow } from '@/lib/formatters';

const { Text, Title } = Typography;

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, quantity: number) => void;
  cartQuantity?: number;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  cartQuantity = 0,
}) => {
  const [quantity, setQuantity] = useState<number>(1);
  const isOutOfStock = product.stock <= 0;
  const availableToSelect = Math.max(0, product.stock - cartQuantity);

  const availability = isProductAvailableNow(product);
  const isAvailableByTime = availability.available;

  const canAdd = !isOutOfStock && isAvailableByTime && availableToSelect > 0;

  const handleAdd = () => {
    if (quantity > 0 && quantity <= availableToSelect && canAdd) {
      onAddToCart(product, quantity);
      setQuantity(1);
    }
  };

  return (
    <Card
      hoverable={!isOutOfStock && isAvailableByTime}
      className="product-card"
      cover={
        <div className="product-image-container">
          <img
            alt={product.name}
            src={product.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=60'}
            className="product-image"
            style={{
              filter: isOutOfStock || !isAvailableByTime ? 'grayscale(70%) opacity(0.85)' : 'none',
            }}
          />

          {/* Tag de Destacado */}
          {product.is_featured && (
            <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 2 }}>
              <Tag color="gold" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                <StarFilled /> Destacado
              </Tag>
            </div>
          )}

          {/* Tag de Stock */}
          <div className="stock-tag-float">
            {isOutOfStock ? (
              <Tag color="error" style={{ fontWeight: 700 }}>
                Agotado
              </Tag>
            ) : product.stock <= 3 ? (
              <Tag color="warning" style={{ fontWeight: 600 }}>
                ¡Últimas {product.stock}!
              </Tag>
            ) : (
              <Tag color="success">
                {product.stock} disponibles
              </Tag>
            )}
          </div>
        </div>
      }
      styles={{ body: { display: 'flex', flexDirection: 'column', flex: 1, padding: 16 } }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <Tag color="default" style={{ fontSize: 11, textTransform: 'uppercase' }}>
            {product.category}
          </Tag>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#0d9488' }}>
            {formatCurrency(product.price)}
          </div>
        </div>

        <Title level={5} style={{ margin: '6px 0', fontSize: 16, lineHeight: 1.3 }}>
          {product.name}
        </Title>

        <Text type="secondary" style={{ fontSize: 13, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {product.description || 'Producto fresco y de alta calidad.'}
        </Text>

        {/* Indicador de Horario */}
        {availability.scheduleText && (
          <div style={{ marginTop: 8 }}>
            <Tag
              color={isAvailableByTime ? 'cyan' : 'default'}
              icon={<ClockCircleOutlined />}
              style={{ fontSize: 11, borderRadius: 4 }}
            >
              {availability.scheduleText}
            </Tag>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
        {isOutOfStock ? (
          <Button disabled block style={{ borderRadius: 8 }}>
            Sin Stock Disponible
          </Button>
        ) : !isAvailableByTime ? (
          <Button disabled block style={{ borderRadius: 8, fontSize: 13 }}>
            Fuera de Horario
          </Button>
        ) : (
          <Space direction="horizontal" style={{ width: '100%', justifyContent: 'space-between' }}>
            <InputNumber
              min={1}
              max={availableToSelect}
              value={quantity}
              onChange={(val) => setQuantity(val || 1)}
              disabled={availableToSelect <= 0}
              style={{ width: 68 }}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
              disabled={availableToSelect <= 0}
              style={{
                flex: 1,
                background: availableToSelect > 0 ? '#0d9488' : undefined,
              }}
            >
              {availableToSelect <= 0 ? 'En Carrito' : 'Agregar'}
            </Button>
          </Space>
        )}
      </div>
    </Card>
  );
};
