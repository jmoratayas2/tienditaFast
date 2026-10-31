'use client';

import React, { useState } from 'react';
import { Card, Tag, Button, InputNumber, Space, Typography, Tooltip } from 'antd';
import { PlusOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { Product } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';

const { Meta } = Card;
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

  const handleAdd = () => {
    if (quantity > 0 && quantity <= availableToSelect) {
      onAddToCart(product, quantity);
      setQuantity(1);
    }
  };

  return (
    <Card
      hoverable={!isOutOfStock}
      className="product-card"
      cover={
        <div className="product-image-container">
          <img
            alt={product.name}
            src={product.image_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=60'}
            className="product-image"
            style={{ filter: isOutOfStock ? 'grayscale(80%)' : 'none' }}
          />
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
      </div>

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
        {isOutOfStock ? (
          <Button disabled block style={{ borderRadius: 8 }}>
            Sin Stock Disponible
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

