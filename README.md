# 🏪 La Tiendita - Plataforma de Pedidos y Despacho en Tiempo Real

Plataforma completa de toma y despacho de pedidos desarrollada con **Next.js 15 (App Router)**, **Supabase (PostgreSQL, RPC & Realtime)** y diseñada exclusivamente con **Ant Design (AntD)** sin utilizar Tailwind CSS. Desplegable en **Vercel** con un solo clic.

---

## 🚀 Características Principales

1. **Catálogo & Reserva en Tiempo Real:**
   - Visualización de $N$ productos con stock dinámico.
   - Descuento inmediato y atómico del stock al realizar el pedido (evita sobreventas o condiciones de carrera).
   - Indicadores visuales de stock: *Disponible*, *Bajo Stock* y *Agotado*.

2. **Experiencia del Cliente (Sin necesidad de cuenta):**
   - El cliente selecciona productos y genera su pedido como invitado (únicamente se solicita nombre y teléfono opcional para retiro en mostrador).
   - **Temporizador Persistente de 10 Minutos:**
     - Al confirmar el pedido, se establece un tiempo límite de 10 minutos para recogerlo.
     - El temporizador calcula el tiempo restante respecto a `expires_at`. **Al recargar la página o volver desde otro dispositivo, el temporizador NO se reinicia**.
     - Barra de progreso circular con alertas visuales (Verde $\rightarrow$ Amarillo $\rightarrow$ Rojo parpadeante en los últimos 2 minutos).
     - Si el contador llega a `00:00`, el pedido expira automáticamente y el stock es devuelto al inventario de la tienda.
   - Posibilidad de anular el pedido manualmente antes de ser despachado (libera el stock inmediatamente).

3. **Panel de Despacho & Caja (`/admin`):**
   - **Cuentas de Personal:** Los usuarios de atención deben iniciar sesión con su cuenta para registrar la trazabilidad de quién atendió y despachó cada pedido.
   - **Control de Pedidos en Vivo:**
     - Pestaña de **Pendientes de Retiro** con temporizador en cuenta regresiva en vivo.
     - Pestaña de **Despachados** con registro histórico de cobros.
     - Pestaña de **Anulados / Expirados** con desglose de motivos.
   - **Modal de Despacho & Formas de Pago:**
     - Permite registrar una o múltiples formas de pago (Efectivo, Tarjeta / Datafono, SINPE Móvil / Transferencia).
     - **En Efectivo:** Permite ingresar el monto recibido del cliente y calcula automáticamente el vuelto a entregar en tiempo real.
     - En Tarjeta o Transferencia: Registro del número de referencia / comprobante.
     - Valida que la suma de pagos cubra exactamente el total del pedido.

4. **Gestión de Inventario (`/admin/inventario`):**
   - Control de existencias de productos.
   - Reposición rápida de inventario (+5, +20) y edición directa de stock.
   - Creación de nuevos productos con categoría, precio e imagen.

---

## 🗄️ Base de Datos en Supabase

En la carpeta `supabase/` encontrarás:
1. `supabase/schema.sql`:
   - Tablas `products`, `orders`, `order_items`.
   - Función RPC `create_order_with_stock`: Bloquea los productos (`FOR UPDATE`), valida disponibilidad, descuenta inventario y crea el pedido con expiración de 10 minutos.
   - Función RPC `cancel_order_with_stock`: Restaura el inventario a la tienda y marca el pedido como cancelado.
   - Función RPC `expire_stale_orders`: Restaura automáticamente el inventario de pedidos que superaron los 10 minutos.
   - Función RPC `dispatch_order`: Registra el despachador, los pagos (efectivo, vuelto, tarjeta) y finaliza el pedido.
   - Políticas de seguridad (RLS) y publicación en `supabase_realtime`.
2. `supabase/seed.sql`:
   - 10 productos de muestra para poblar la tienda de inmediato.

### Cómo aplicar en tu proyecto de Supabase:
1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor** en el panel lateral de Supabase.
3. Copia y ejecuta el contenido de `supabase/schema.sql`.
4. Copia y ejecuta el contenido de `supabase/seed.sql`.

---

## ⚙️ Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

> **Nota:** La aplicación cuenta con un **Modo Demostración Interactivo Automático**. Si aún no has conectado las credenciales de Supabase, la tienda funciona con almacenamiento local persistente en el navegador y simula el 100% de la funcionalidad (descuento de stock, temporizador de 10 min, vuelto en efectivo y despacho).

---

## 💻 Ejecución en Desarrollo

```bash
# Instalar dependencias
npm install --legacy-peer-deps

# Iniciar servidor de desarrollo
npm run dev
```

Abre en tu navegador:
- Tienda para clientes: `http://localhost:3000`
- Panel de despacho: `http://localhost:3000/admin`
- Login de personal: `http://localhost:3000/admin/login`

---

## ☁️ Despliegue en Vercel

1. Sube tu código a GitHub o GitLab.
2. Ingresa a [Vercel](https://vercel.com) e importa el repositorio.
3. En la sección **Environment Variables**, agrega:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Haz clic en **Deploy**. ¡Listo!

