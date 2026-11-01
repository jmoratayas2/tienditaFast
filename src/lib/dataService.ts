import { createClientBrowser, isSupabaseConfigured } from './supabase/client';
import { Product, Order, OrderItem, PaymentItem, StaffUser, UserRole } from './types';
import { INITIAL_PRODUCTS } from './mockData';

const MOCK_PRODUCTS_KEY = 'tiendita_products';
const MOCK_ORDERS_KEY = 'tiendita_orders';
const MOCK_ORDER_SEQ_KEY = 'tiendita_order_seq';
const MOCK_STAFF_KEY = 'tiendita_staff_users';

const INITIAL_STAFF_USERS: StaffUser[] = [
  {
    id: 'staff-admin-01',
    email: 'admin@tiendita.com',
    full_name: 'Administrador Principal',
    role: 'admin',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'staff-carlos-02',
    email: 'carlos@tiendita.com',
    full_name: 'Carlos Mora',
    role: 'despachador',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'staff-ana-03',
    email: 'ana@tiendita.com',
    full_name: 'Ana Gómez',
    role: 'despachador',
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

// Helper de LocalStorage para modo offline/demo
const getLocalProducts = (): Product[] => {
  if (typeof window === 'undefined') return INITIAL_PRODUCTS;
  const stored = localStorage.getItem(MOCK_PRODUCTS_KEY);
  if (!stored) {
    localStorage.setItem(MOCK_PRODUCTS_KEY, JSON.stringify(INITIAL_PRODUCTS));
    return INITIAL_PRODUCTS;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return INITIAL_PRODUCTS;
  }
};

const saveLocalProducts = (products: Product[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(MOCK_PRODUCTS_KEY, JSON.stringify(products));
    window.dispatchEvent(new Event('tiendita_storage_updated'));
  }
};

const getLocalOrders = (): Order[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(MOCK_ORDERS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

const saveLocalOrders = (orders: Order[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(MOCK_ORDERS_KEY, JSON.stringify(orders));
    window.dispatchEvent(new Event('tiendita_storage_updated'));
  }
};

const getLocalStaff = (): StaffUser[] => {
  if (typeof window === 'undefined') return INITIAL_STAFF_USERS;
  const stored = localStorage.getItem(MOCK_STAFF_KEY);
  if (!stored) {
    localStorage.setItem(MOCK_STAFF_KEY, JSON.stringify(INITIAL_STAFF_USERS));
    return INITIAL_STAFF_USERS;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return INITIAL_STAFF_USERS;
  }
};

const saveLocalStaff = (staff: StaffUser[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(MOCK_STAFF_KEY, JSON.stringify(staff));
    window.dispatchEvent(new Event('tiendita_storage_updated'));
  }
};

const getNextOrderNumber = (): string => {
  if (typeof window === 'undefined') return 'PED-1001';
  let seq = parseInt(localStorage.getItem(MOCK_ORDER_SEQ_KEY) || '1000', 10);
  seq += 1;
  localStorage.setItem(MOCK_ORDER_SEQ_KEY, seq.toString());
  return `PED-${seq}`;
};

export const dataService = {
  // Verificar si estamos usando Supabase real o Mock
  isUsingSupabase(): boolean {
    return isSupabaseConfigured();
  },

  // Obtener listado de productos
  async getProducts(): Promise<Product[]> {
    if (this.isUsingSupabase()) {
      const supabase = createClientBrowser();
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) {
        console.error('Error cargando productos de Supabase, usando local:', error);
        return getLocalProducts();
      }
      return data || [];
    }
    return getLocalProducts();
  },

  // Obtener un pedido específico con sus items
  async getOrder(orderId: string): Promise<Order | null> {
    await this.expireOrders();

    if (this.isUsingSupabase()) {
      const supabase = createClientBrowser();
      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .eq('id', orderId)
        .single();

      if (error) {
        console.error('Error cargando pedido de Supabase:', error);
        const local = getLocalOrders().find((o) => o.id === orderId);
        return local || null;
      }
      return order as Order;
    }

    const local = getLocalOrders().find((o) => o.id === orderId);
    return local || null;
  },

  // Obtener todos los pedidos para el panel de despacho
  async getOrders(statusFilter?: string): Promise<Order[]> {
    await this.expireOrders();

    if (this.isUsingSupabase()) {
      const supabase = createClientBrowser();
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (*)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error obteniendo pedidos de Supabase:', error);
        return getLocalOrders();
      }
      return data || [];
    }

    const all = getLocalOrders();
    if (!statusFilter || statusFilter === 'all') {
      return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return all
      .filter((o) => o.status === statusFilter)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  // Crear un pedido descontando stock inmediatamente
  async createOrder(
    customerName: string,
    customerPhone: string,
    customerNotes: string,
    items: { product: Product; quantity: number }[]
  ): Promise<{ order_id: string; order_number: string; expires_at: string }> {
    if (this.isUsingSupabase()) {
      const supabase = createClientBrowser();
      const payload = items.map((i) => ({
        product_id: i.product.id,
        quantity: i.quantity,
      }));

      const { data, error } = await supabase.rpc('create_order_with_stock', {
        p_customer_name: customerName,
        p_customer_phone: customerPhone,
        p_customer_notes: customerNotes,
        p_items: payload,
      });

      if (error) {
        throw new Error(error.message);
      }

      return data;
    }

    // LÓGICA LOCAL MOCK:
    const products = getLocalProducts();
    const orders = getLocalOrders();

    // 1. Validar disponibilidad de stock
    for (const item of items) {
      const prod = products.find((p) => p.id === item.product.id);
      if (!prod) {
        throw new Error(`El producto "${item.product.name}" ya no existe.`);
      }
      if (prod.stock < item.quantity) {
        throw new Error(
          `Stock insuficiente para "${prod.name}". Disponibles: ${prod.stock}`
        );
      }
    }

    // 2. Descontar stock
    for (const item of items) {
      const prodIndex = products.findIndex((p) => p.id === item.product.id);
      if (prodIndex !== -1) {
        products[prodIndex].stock -= item.quantity;
      }
    }
    saveLocalProducts(products);

    // 3. Crear pedido con expiración de 10 minutos exactos
    const orderId = 'ord-' + Math.random().toString(36).substring(2, 9);
    const orderNumber = getNextOrderNumber();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();

    const totalAmount = items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );

    const orderItems: OrderItem[] = items.map((item) => ({
      id: 'item-' + Math.random().toString(36).substring(2, 9),
      order_id: orderId,
      product_id: item.product.id,
      product_name: item.product.name,
      unit_price: item.product.price,
      quantity: item.quantity,
      subtotal: item.product.price * item.quantity,
    }));

    const newOrder: Order = {
      id: orderId,
      order_number: orderNumber,
      customer_name: customerName.trim() || 'Cliente Mostrador',
      customer_phone: customerPhone.trim() || null,
      customer_notes: customerNotes.trim() || null,
      status: 'pending',
      total_amount: totalAmount,
      created_at: now.toISOString(),
      expires_at: expiresAt,
      payment_status: 'unpaid',
      payment_details: [],
      order_items: orderItems,
    };

    orders.unshift(newOrder);
    saveLocalOrders(orders);

    return {
      order_id: orderId,
      order_number: orderNumber,
      expires_at: expiresAt,
    };
  },

  // Anular/cancelar pedido y restaurar stock
  async cancelOrder(orderId: string, reason?: string): Promise<boolean> {
    if (this.isUsingSupabase()) {
      const supabase = createClientBrowser();
      const { data, error } = await supabase.rpc('cancel_order_with_stock', {
        p_order_id: orderId,
        p_reason: reason || 'Cancelado por el usuario o personal',
      });
      if (error) throw new Error(error.message);
      return data;
    }

    const orders = getLocalOrders();
    const orderIndex = orders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) throw new Error('Pedido no encontrado.');

    const order = orders[orderIndex];
    if (order.status === 'dispatched') {
      throw new Error('No se puede anular un pedido que ya fue despachado.');
    }
    if (order.status === 'cancelled') return true;

    // Restaurar stock
    const products = getLocalProducts();
    if (order.order_items) {
      for (const item of order.order_items) {
        const pIndex = products.findIndex((p) => p.id === item.product_id);
        if (pIndex !== -1) {
          products[pIndex].stock += item.quantity;
        }
      }
      saveLocalProducts(products);
    }

    orders[orderIndex].status = 'cancelled';
    orders[orderIndex].cancellation_reason = reason || 'Cancelado manualmente';
    saveLocalOrders(orders);
    return true;
  },

  // Despachar pedido con desglose de formas de pago y cálculo de vuelto
  async dispatchOrder(
    orderId: string,
    dispatcher: { id?: string; name: string },
    payments: PaymentItem[],
    notes?: string
  ): Promise<boolean> {
    if (this.isUsingSupabase()) {
      const supabase = createClientBrowser();
      const { data, error } = await supabase.rpc('dispatch_order', {
        p_order_id: orderId,
        p_user_id: dispatcher.id || null,
        p_user_name: dispatcher.name,
        p_payments: payments,
        p_notes: notes || null,
      });
      if (error) throw new Error(error.message);
      return data;
    }

    const orders = getLocalOrders();
    const orderIndex = orders.findIndex((o) => o.id === orderId);
    if (orderIndex === -1) throw new Error('Pedido no encontrado.');

    const order = orders[orderIndex];
    if (order.status === 'dispatched') {
      throw new Error('El pedido ya fue despachado previamente.');
    }
    if (order.status === 'cancelled') {
      throw new Error('El pedido se encuentra cancelado.');
    }

    const now = new Date().getTime();
    const expiresAt = new Date(order.expires_at).getTime();
    if (now > expiresAt) {
      await this.expireOrders();
      throw new Error('El tiempo límite de 10 minutos para retirar este pedido ya expiró.');
    }

    orders[orderIndex].status = 'dispatched';
    orders[orderIndex].dispatched_at = new Date().toISOString();
    orders[orderIndex].dispatched_by_id = dispatcher.id || null;
    orders[orderIndex].dispatched_by_name = dispatcher.name;
    orders[orderIndex].payment_status = 'paid';
    orders[orderIndex].payment_details = payments;
    if (notes) {
      orders[orderIndex].customer_notes = (orders[orderIndex].customer_notes ? orders[orderIndex].customer_notes + ' | ' : '') + notes;
    }

    saveLocalOrders(orders);
    return true;
  },

  // Expirar pedidos vencidos automáticamente
  async expireOrders(): Promise<number> {
    if (this.isUsingSupabase()) {
      const supabase = createClientBrowser();
      const { data } = await supabase.rpc('expire_stale_orders');
      return data || 0;
    }

    const orders = getLocalOrders();
    const products = getLocalProducts();
    const now = new Date().getTime();
    let expiredCount = 0;
    let productsModified = false;

    for (const order of orders) {
      if (order.status === 'pending') {
        const expiresTime = new Date(order.expires_at).getTime();
        if (now > expiresTime) {
          order.status = 'expired';
          order.cancellation_reason = 'Tiempo límite de recogida de 10 minutos expirado.';
          expiredCount++;

          if (order.order_items) {
            for (const item of order.order_items) {
              const pIndex = products.findIndex((p) => p.id === item.product_id);
              if (pIndex !== -1) {
                products[pIndex].stock += item.quantity;
                productsModified = true;
              }
            }
          }
        }
      }
    }

    if (expiredCount > 0) {
      if (productsModified) saveLocalProducts(products);
      saveLocalOrders(orders);
    }

    return expiredCount;
  },

  // Actualizar stock de un producto (para el panel de inventario)
  async updateProductStock(productId: string, newStock: number): Promise<boolean> {
    if (this.isUsingSupabase()) {
      const supabase = createClientBrowser();
      const { error } = await supabase
        .from('products')
        .update({ stock: newStock, updated_at: new Date().toISOString() })
        .eq('id', productId);
      if (error) throw new Error(error.message);
      return true;
    }

    const products = getLocalProducts();
    const index = products.findIndex((p) => p.id === productId);
    if (index !== -1) {
      products[index].stock = Math.max(0, newStock);
      saveLocalProducts(products);
      return true;
    }
    return false;
  },

  // Añadir un nuevo producto (para el panel de inventario)
  async addProduct(product: Omit<Product, 'id'>): Promise<Product> {
    if (this.isUsingSupabase()) {
      const supabase = createClientBrowser();
      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }

    const products = getLocalProducts();
    const newProd: Product = {
      ...product,
      id: 'prod-' + Math.random().toString(36).substring(2, 9),
    };
    products.unshift(newProd);
    saveLocalProducts(products);
    return newProd;
  },

  // ==========================================================================
  // GESTIÓN DE USUARIOS INTERNOS DEL PERSONAL (CONTROL INTERNO)
  // ==========================================================================

  async getStaffUsers(): Promise<StaffUser[]> {
    if (this.isUsingSupabase()) {
      const supabase = createClientBrowser();
      const { data, error } = await supabase
        .from('staff_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data as StaffUser[];
      }
    }
    return getLocalStaff();
  },

  async createStaffUser(user: {
    email: string;
    full_name: string;
    role: UserRole;
    password?: string;
  }): Promise<StaffUser> {
    if (this.isUsingSupabase()) {
      try {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(user),
        });
        if (res.ok) {
          const data = await res.json();
          return data;
        }
      } catch (e) {
        console.warn('API error, falling back to direct supabase or local:', e);
      }

      const supabase = createClientBrowser();
      const { data, error } = await supabase
        .from('staff_users')
        .insert({
          email: user.email.trim().toLowerCase(),
          full_name: user.full_name.trim(),
          role: user.role,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as StaffUser;
    }

    // Modo local
    const staff = getLocalStaff();
    const existing = staff.find((s) => s.email.toLowerCase() === user.email.toLowerCase());
    if (existing) {
      throw new Error(`El correo ${user.email} ya está registrado.`);
    }

    const newUser: StaffUser = {
      id: 'staff-' + Math.random().toString(36).substring(2, 8),
      email: user.email.trim().toLowerCase(),
      full_name: user.full_name.trim(),
      role: user.role,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    staff.unshift(newUser);
    saveLocalStaff(staff);
    return newUser;
  },

  async updateStaffUser(
    id: string,
    updates: { role?: UserRole; is_active?: boolean; full_name?: string }
  ): Promise<boolean> {
    if (this.isUsingSupabase()) {
      try {
        const res = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...updates }),
        });
        if (res.ok) return true;
      } catch (e) {
        console.warn('API patch error:', e);
      }

      const supabase = createClientBrowser();
      const { error } = await supabase
        .from('staff_users')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw new Error(error.message);
      return true;
    }

    const staff = getLocalStaff();
    const index = staff.findIndex((s) => s.id === id);
    if (index === -1) return false;

    staff[index] = { ...staff[index], ...updates };
    saveLocalStaff(staff);
    return true;
  },
};
