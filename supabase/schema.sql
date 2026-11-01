-- ==============================================================================
-- SCHEMA PARA PLATAFORMA DE PEDIDOS (TIENDITA)
-- Compatible con Supabase y PostgreSQL
-- ==============================================================================

-- 1. Tabla de Productos
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    category TEXT DEFAULT 'General',
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Secuencia para número de pedido legible (ej: PED-1001)
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1001;

-- 3. Tabla de Pedidos
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL DEFAULT ('PED-' || nextval('order_number_seq')::text),
    customer_name TEXT NOT NULL DEFAULT 'Cliente Mostrador',
    customer_phone TEXT,
    customer_notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dispatched', 'cancelled', 'expired')),
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
    dispatched_at TIMESTAMPTZ,
    dispatched_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    dispatched_by_name TEXT,
    cancellation_reason TEXT,
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
    payment_details JSONB DEFAULT '[]'::jsonb
);

-- 4. Tabla de Items del Pedido
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabla de Usuarios Internos del Sistema (Control Interno & Roles)
CREATE TABLE IF NOT EXISTS public.staff_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'despachador' CHECK (role IN ('admin', 'despachador')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para optimizar consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_expires_at ON public.orders(expires_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_staff_users_email ON public.staff_users(email);
CREATE INDEX IF NOT EXISTS idx_staff_users_role ON public.staff_users(role);

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_users;

-- ==============================================================================
-- TRIGGER PARA SINCRONIZAR USUARIOS DE AUTH CON STAFF_USERS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_staff_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.staff_users (auth_user_id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'despachador')
  )
  ON CONFLICT (email) DO UPDATE
  SET auth_user_id = new.id,
      full_name = COALESCE(new.raw_user_meta_data->>'full_name', public.staff_users.full_name),
      role = COALESCE(new.raw_user_meta_data->>'role', public.staff_users.role);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_staff_user();

-- ==============================================================================
-- FUNCIONES RPC TRANSACCIONALES
-- ==============================================================================

-- Función para expirar pedidos vencidos y restaurar inventario
CREATE OR REPLACE FUNCTION public.expire_stale_orders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r_order RECORD;
    v_expired_count INTEGER := 0;
BEGIN
    FOR r_order IN 
        SELECT id 
        FROM public.orders 
        WHERE status = 'pending' AND expires_at < now()
        FOR UPDATE
    LOOP
        UPDATE public.products p
        SET stock = p.stock + oi.quantity,
            updated_at = now()
        FROM public.order_items oi
        WHERE oi.order_id = r_order.id AND p.id = oi.product_id;

        UPDATE public.orders
        SET status = 'expired',
            cancellation_reason = 'Tiempo límite de recogida de 10 minutos expirado.'
        WHERE id = r_order.id;

        v_expired_count := v_expired_count + 1;
    END LOOP;

    RETURN v_expired_count;
END;
$$;

-- Función transaccional para crear un pedido descontando stock de inmediato
CREATE OR REPLACE FUNCTION public.create_order_with_stock(
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_customer_notes TEXT,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item JSONB;
    v_product_id UUID;
    v_qty INT;
    v_stock INT;
    v_price NUMERIC(10, 2);
    v_pname TEXT;
    v_total NUMERIC(10, 2) := 0;
    v_order_id UUID;
    v_order_number TEXT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    PERFORM public.expire_stale_orders();

    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'El carrito de compras no puede estar vacío.';
    END IF;

    v_expires_at := now() + interval '10 minutes';
    INSERT INTO public.orders (
        customer_name,
        customer_phone,
        customer_notes,
        status,
        total_amount,
        expires_at
    ) VALUES (
        COALESCE(NULLIF(TRIM(p_customer_name), ''), 'Cliente Mostrador'),
        NULLIF(TRIM(p_customer_phone), ''),
        NULLIF(TRIM(p_customer_notes), ''),
        'pending',
        0,
        v_expires_at
    )
    RETURNING id, order_number INTO v_order_id, v_order_number;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'quantity')::INT;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'La cantidad solicitada debe ser mayor a cero.';
        END IF;

        SELECT name, price, stock INTO v_pname, v_price, v_stock
        FROM public.products
        WHERE id = v_product_id AND is_active = true
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto solicitado no existe o no se encuentra disponible.';
        END IF;

        IF v_stock < v_qty THEN
            RAISE EXCEPTION 'Stock insuficiente para "%": solo quedan % unidades disponibles.', v_pname, v_stock;
        END IF;

        UPDATE public.products
        SET stock = stock - v_qty,
            updated_at = now()
        WHERE id = v_product_id;

        INSERT INTO public.order_items (
            order_id,
            product_id,
            product_name,
            unit_price,
            quantity,
            subtotal
        ) VALUES (
            v_order_id,
            v_product_id,
            v_pname,
            v_price,
            v_qty,
            v_price * v_qty
        );

        v_total := v_total + (v_price * v_qty);
    END LOOP;

    UPDATE public.orders
    SET total_amount = v_total
    WHERE id = v_order_id;

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'order_number', v_order_number,
        'total_amount', v_total,
        'expires_at', v_expires_at,
        'status', 'pending'
    );
END;
$$;

-- Función transaccional para anular/cancelar un pedido y restaurar stock
CREATE OR REPLACE FUNCTION public.cancel_order_with_stock(
    p_order_id UUID,
    p_reason TEXT DEFAULT 'Cancelado por el usuario o personal de tienda'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_status TEXT;
BEGIN
    SELECT status INTO v_status
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido no encontrado.';
    END IF;

    IF v_status = 'cancelled' THEN
        RETURN true;
    END IF;

    IF v_status = 'dispatched' THEN
        RAISE EXCEPTION 'No se puede anular un pedido que ya ha sido despachado.';
    END IF;

    UPDATE public.products p
    SET stock = p.stock + oi.quantity,
        updated_at = now()
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id AND p.id = oi.product_id;

    UPDATE public.orders
    SET status = 'cancelled',
        cancellation_reason = COALESCE(p_reason, 'Cancelado')
    WHERE id = p_order_id;

    RETURN true;
END;
$$;

-- Función transaccional para despachar un pedido con sus formas de pago
CREATE OR REPLACE FUNCTION public.dispatch_order(
    p_order_id UUID,
    p_user_id UUID,
    p_user_name TEXT,
    p_payments JSONB,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_status TEXT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    SELECT status, expires_at INTO v_status, v_expires_at
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido no encontrado.';
    END IF;

    IF v_status = 'dispatched' THEN
        RAISE EXCEPTION 'Este pedido ya fue despachado previamente.';
    END IF;

    IF v_status = 'cancelled' THEN
        RAISE EXCEPTION 'Este pedido fue cancelado y no puede ser despachado.';
    END IF;

    IF v_status = 'expired' OR (v_status = 'pending' AND v_expires_at < now()) THEN
        PERFORM public.expire_stale_orders();
        RAISE EXCEPTION 'El tiempo límite de 10 minutos para retirar este pedido ya ha expirado.';
    END IF;

    UPDATE public.orders
    SET status = 'dispatched',
        dispatched_at = now(),
        dispatched_by_id = p_user_id,
        dispatched_by_name = COALESCE(p_user_name, 'Despachador en Turno'),
        payment_status = 'paid',
        payment_details = p_payments,
        customer_notes = CASE 
            WHEN p_notes IS NOT NULL AND length(trim(p_notes)) > 0 
            THEN COALESCE(customer_notes || ' | Nota Despacho: ', '') || p_notes 
            ELSE customer_notes 
        END
    WHERE id = p_order_id;

    RETURN true;
END;
$$;

-- ==============================================================================
-- POLÍTICAS DE SEGURIDAD (Row Level Security - RLS)
-- ==============================================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;

-- Productos:
CREATE POLICY "Productos visibles para todos" 
ON public.products FOR SELECT 
USING (true);

CREATE POLICY "Personal gestiona productos" 
ON public.products FOR ALL 
USING (true) 
WITH CHECK (true);

-- Pedidos:
CREATE POLICY "Pedidos visibles para consulta" 
ON public.orders FOR SELECT 
USING (true);

CREATE POLICY "Inserción de pedidos permitida" 
ON public.orders FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Actualización de pedidos permitida" 
ON public.orders FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Items de Pedido:
CREATE POLICY "Items visibles para consulta" 
ON public.order_items FOR SELECT 
USING (true);

CREATE POLICY "Inserción de items permitida" 
ON public.order_items FOR INSERT 
WITH CHECK (true);

-- Usuarios de Personal:
CREATE POLICY "Lectura de usuarios del personal"
ON public.staff_users FOR SELECT
USING (true);

CREATE POLICY "Gestión de usuarios de personal"
ON public.staff_users FOR ALL
USING (true)
WITH CHECK (true);
