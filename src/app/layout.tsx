import React from 'react';
import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider, App as AntdApp } from 'antd';
import esES from 'antd/locale/es_ES';
import { customTheme } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'La Tiendita - Plataforma de Pedidos y Despacho',
  description: 'Plataforma de pedidos con reserva en tiempo real, límite de 10 minutos y despacho de mostrador.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <AntdRegistry>
          <ConfigProvider theme={customTheme} locale={esES}>
            <AntdApp>
              {children}
            </AntdApp>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}

