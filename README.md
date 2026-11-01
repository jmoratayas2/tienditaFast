# 🏪 La Tiendita - Plataforma de Pedidos Rápidos y Despacho en Tiempo Real

Plataforma completa de toma y despacho de pedidos desarrollada con **Next.js 15 (App Router)**, **Supabase (PostgreSQL, RPC & Realtime)** y diseñada exclusivamente con **Ant Design (AntD)** sin utilizar Tailwind CSS. Desplegable en **Vercel** para producción.

---

## 🚀 Arquitectura y Separación de Vistas

### 1. Vista de Clientes (Pedidos Rápidos)
- **URL:** `/` (Catálogo) y `/order/[id]` (Seguimiento).
- **Sin necesidad de cuenta:** Los clientes eligen productos y confirman su orden indicando únicamente nombre y teléfono.
- **Temporizador de 10 Minutos:**
  - Al crearse la orden, se descuenta el inventario de inmediato y se activa un plazo de 10 minutos para retirar en el mostrador.
  - El temporizador está anclado a la marca de tiempo `expires_at` en base de datos. **Al recargar la página, el temporizador NO se reinicia**.
  - Si el tiempo llega a `00:00`, la orden se anula automáticamente y el inventario regresa al stock disponible.
- **Cancelación por el cliente:** El usuario puede anular su pedido en cualquier momento antes de que sea despachado.

### 2. Portal Administrativo y Personal
- **URL:** `/admin/login` (Ingreso institucional), `/admin` (Despacho), `/admin/inventario` (Inventario) y `/admin/usuarios` (Personal y Roles).
- **Autenticación y Control de Acceso por Roles (RBAC):**
  - **🛡️ Administrador:**
    - Acceso total al sistema.
    - Alta, baja y edición de usuarios internos desde la plataforma (`/admin/usuarios`).
    - Modificación de precios, ajuste de inventario y creación de nuevos productos (`/admin/inventario`).
    - Métricas financieras en tiempo real (recaudación total, pedidos pendientes y despachados).
  - **📦 Despachador:**
    - Acceso al panel de pedidos (`/admin`).
    - Función **"+ Tomar Pedido Mostrador"** para registrar órdenes de clientes presenciales.
    - **Despacho y Cobro:** Registro de formas de pago (Efectivo, Tarjeta, Transferencia, SINPE). En efectivo, calcula automáticamente el vuelto a entregar al cliente.
    - Consulta de existencias en modo lectura en inventario (sin permisos de edición).

---

## 🗄️ Base de Datos en Supabase

En la carpeta `supabase/`:
1. `supabase/schema.sql`:
   - Tablas: `products`, `orders`, `order_items`, `staff_users`.
   - Procedimientos transaccionales: `create_order_with_stock`, `cancel_order_with_stock`, `expire_stale_orders`, `dispatch_order`.
   - Seguridad por filas (RLS) y publicación en `supabase_realtime`.
2. `supabase/seed.sql`:
   - Catálogo inicial de productos y usuarios del personal predeterminados.

---

## ⚙️ Variables de Entorno

Configura en tu panel de Vercel o en `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-de-supabase
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-de-supabase
```

---

## 💻 Ejecución en Desarrollo

```bash
npm install --legacy-peer-deps
npm run build
npm run dev
```
