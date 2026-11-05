import { createClientBrowser, isSupabaseConfigured } from './supabase/client';
import {
  Product,
  Order,
  OrderItem,
  PaymentItem,
  StaffUser,
  UserRole,
  StoreSettings,
  ShiftCut,
  PickupType,
  PreparationMode,
  KitchenStatus,
} from './types';
import { INITIAL_PRODUCTS, DEFAULT_STORE_SETTINGS } from './mockData';

const MOCK_PRODUCTS_KEY = 'tiendita_products_gtq';
const MOCK_ORDERS_KEY = 'tiendita_orders';
const MOCK_ORDER_SEQ_KEY = 'tiendita_order_seq';
const MOCK_STAFF_KEY = 'tiendita_staff_users';
const MOCK_SETTINGS_KEY = 'tiendita_store_settings';
const MOCK_CUTS_KEY = 'tiendita_shift_cuts';

const INITIAL_STAFF_USERS: StaffUser[] = [
  {
    id: 'staff-admin-01',
    email: 'admin@tiendita.com',
    first_name: 'Administrador',
    last_name: 'Principal',
    full_name: 'Administrador Principal',
    role: 'admin',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'staff-carlos-02',
    email: 'carlos@tiendita.com',
    first_name: 'Carlos',
    last_name: 'Mora',
    full_name: 'Carlos Mora',
    role: 'despachador',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'staff-ana-03',
    email: 'ana@tiendita.com',
    first_name: 'Ana',
    last_name: 'Gómez',
    full_name: 'Ana Gómez',
    role: 'despachador',
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

// Helper de LocalStorage para almacenamiento local persistente
const getLocalProducts = (): Product[] => {
  if (typeof window === 'undefined') return INITIAL_PRODUCTS;
  const stored = localStorage.getItem(MOCK_PRODUCTS_KEY);
  if (!stored) {
    localStorage.setItem(MOCK_PRODUCTS_KEY, JSON.stringify(INITIAL_PRODUCTS));
    return INITIAL_PRODUCTS;
  }
  try {
    const parsed = JSON.parse(stored);
    // Si contiene precios antiguos en colones (> 300), reiniciar a precios en quetzales
    if (Array.isArray(parsed) && parsed.some((p: Product) => p.price > 300)) {
      localStorage.setItem(MOCK_PRODUCTS_KEY, JSON.stringify(INITIAL_PRODUCTS));
      return INITIAL_PRODUCTS;
    }
    return parsed;
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

const getLocalSettings = (): StoreSettings => {
  if (typeof window === 'undefined') return DEFAULT_STORE_SETTINGS;
  const stored = localStorage.getItem(MOCK_SETTINGS_KEY);
  if (!stored) {
    localStorage.setItem(MOCK_SETTINGS_KEY, JSON.stringify(DEFAULT_STORE_SETTINGS));
    return DEFAULT_STORE_SETTINGS;
  }
  try {
    return { ...DEFAULT_STORE_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_STORE_SETTINGS;
  }
};

const saveLocalSettings = (settings: StoreSettings) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(MOCK_SETTINGS_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event('tiendita_storage_updated'));
  }
};

const getLocalCuts = (): ShiftCut[] => {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(MOCK_CUTS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

const saveLocalCuts = (cuts: ShiftCut[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(MOCK_CUTS_KEY, JSON.stringify(cuts));
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
  isUsingSupabase(): boolean {
    return isSupabaseConfigured();
  },

  // Obtener configuración del portal
  async getStoreSettings(): Promise<StoreSettings> {
    if (this.isUsingSupabase()) {
      const supabase = createClientBrowser();
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .eq('id', 'current')
        .single();
      if (!error && data) {
        return data as StoreSettings;
      }
    }
    return getLocalSettings();
  },

  // Actualizar configuración del portal
  async updateStoreSettings(updates: Partial<StoreSettings>): Promise<StoreSettings> {
    if (this.isUsingSupabase()) {
      const supabase = createClientBrowser();
      const { data, error } = await supabase
        .from('store_settings')
        .upsert({ id: 'current', ...updates, updated_at: new Date().toISOString() })
        .select()
        .single();
      if (!error && data) {
        return data as StoreSettings;
      }
    }
    const current = getLocalSettings();
    const updated = { ...current, ...updates, updated_at: new Date().toISOString() };
    saveLocalSettings(updated);
    return updated;
  },

  // Obtener listado de productos
  async getProducts(includeInactive: boolean = false): Promise<Product[]> {
    if (this.isUsingSupabase()) {
      const supabase = createClientBrowser();
      let query = supabase.from('products').select('*').order('name');
      if (!includeInactive) {
        query = query.eq('is_active', true);
      }
      const { data, error } = await query;
      if (error) {
        console.error('Error cargando productos de Supabase, usando local:', error);
        const local = getLocalProducts();
        return includeInactive ? local : local.filter((p) => p.is_active);
      }
      // Combinar con almacenamiento local por si faltan columnas en el esquema de Supabase
      const local = getLocalProducts();
      const merged = (data || []).map((dbProd: any) => {
        const localMatch = local.find((lp) => lp.id === dbProd.id);
        return {
          barcode: dbProd.barcode !== undefined ? dbProd.barcode : (localMatch?.barcode ?? null),
          is_featured: dbProd.is_featured !== undefined ? dbProd.is_featured : (localMatch?.is_featured ?? false),
          is_prepared: dbProd.is_prepared !== undefined ? dbProd.is_prepared : (localMatch?.is_prepared ?? false),
          available_all_day: dbProd.available_all_day !== undefined ? dbProd.available_all_day : (localMatch?.available_all_day ?? true),
          available_from: dbProd.available_from !== undefined ? dbProd.available_from : (localMatch?.available_from ?? null),
          available_to: dbProd.available_to !== undefined ? dbProd.available_to : (localMatch?.available_to ?? null),
          ...dbProd,
        } as Product;
      });
      return merged;
    }
    const local = getLocalProducts();
    return includeInactive ? local : local.filter((p) => p.is_active);
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
    items: { product: Product; quantity: number }[],
    options?: {
      pickupType?: PickupType;
      scheduledPickupTime?: string | null;
      preparationMode?: PreparationMode;
    }
  ): Promise<{ order_id: string; order_number: string; expires_at: string }> {
    const hasPrepared = items.some((i) => i.product.is_prepared);
    const pickupType: PickupType = options?.pickupType || 'immediate';
    const scheduledTime = options?.scheduledPickupTime || null;
    // Toda comida que requiera preparación se prepara SIEMPRE al llegar el cliente al mostrador (cero desperdicio)
    const preparationMode: PreparationMode = hasPrepared ? 'on_arrival' : 'immediate';
    const kitchenStatus: KitchenStatus =
      preparationMode === 'on_arrival' ? 'pending_arrival' : 'ready';

    const now = new Date();
    let expiresAt: string;

    if (pickupType === 'scheduled' && scheduledTime) {
      const [hh, mm] = scheduledTime.split(':').map((v) => parseInt(v, 10));
      const scheduledDate = new Date();
      scheduledDate.setHours(hh || 0, mm || 0, 0, 0);

      // Margen de cortesía de 20 min después de la hora acordada
      const courtesyMarginMs = 20 * 60 * 1000;
      let targetTime = scheduledDate.getTime() + courtesyMarginMs;
      if (targetTime <= now.getTime()) {
        targetTime = now.getTime() + 20 * 60 * 1000;
      }
      expiresAt = new Date(targetTime).toISOString();
    } else {
      const settings = getLocalSettings();
      const pickupMinutes = settings.pickup_time_minutes || 10;
      expiresAt = new Date(now.getTime() + pickupMinutes * 60 * 1000).toISOString();
    }

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

      if (data?.order_id) {
        try {
          let orderPayload: any = {
            pickup_type: pickupType,
            scheduled_pickup_time: scheduledTime,
            has_prepared_items: hasPrepared,
            preparation_mode: preparationMode,
            kitchen_status: kitchenStatus,
            expires_at: expiresAt,
          };

          for (let attempt = 0; attempt < 8; attempt++) {
            const { error: updErr } = await supabase
              .from('orders')
              .update(orderPayload)
              .eq('id', data.order_id);

            if (!updErr) break;

            const match = updErr.message?.match(/Could not find the '(\w+)' column/i);
            if (match && match[1] && match[1] in orderPayload) {
              delete orderPayload[match[1]];
              continue;
            }
            break;
          }
        } catch (e) {
          console.warn('Advertencia al sincronizar metadatos de pedido en Supabase:', e);
        }
      }

      return {
        order_id: data.order_id,
        order_number: data.order_number,
        expires_at: expiresAt,
      };
    }

    // LÓGICA LOCAL
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

    // 3. Crear pedido con expiración calculada
    const orderId = 'ord-' + Math.random().toString(36).substring(2, 9);
    const orderNumber = getNextOrderNumber();

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
      pickup_type: pickupType,
      scheduled_pickup_time: scheduledTime,
      has_prepared_items: hasPrepared,
      preparation_mode: preparationMode,
      kitchen_status: kitchenStatus,
    };

    orders.unshift(newOrder);
    saveLocalOrders(orders);

    return {
      order_id: orderId,
      order_number: orderNumber,
      expires_at: expiresAt,
    };
  },

  // Actualizar estado de preparación en cocina
  async updateKitchenStatus(
    orderId: string,
    status: KitchenStatus
  ): Promise<boolean> {
    if (this.isUsingSupabase()) {
      const supabase = createClientBrowser();
      await supabase
        .from('orders')
        .update({ kitchen_status: status })
        .eq('id', orderId);
    }

    const orders = getLocalOrders();
    const index = orders.findIndex((o) => o.id === orderId);
    if (index !== -1) {
      orders[index].kitchen_status = status;
      saveLocalOrders(orders);
    }
    return true;
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

  // Despachar pedido con desglose de formas de pago, ajuste de productos en mostrador y cálculo de vuelto
  async dispatchOrder(
    orderId: string,
    dispatcher: { id?: string; name: string },
    payments: PaymentItem[],
    notes?: string,
    updatedItems?: OrderItem[]
  ): Promise<boolean> {
    if (this.isUsingSupabase()) {
      const supabase = createClientBrowser();

      // Si se modificaron o agregaron productos al momento del despacho
      if (updatedItems && updatedItems.length > 0) {
        try {
          const { data: prevItems } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', orderId);

          const prevMap = new Map<string, number>();
          (prevItems || []).forEach((pi: any) => {
            prevMap.set(pi.product_id, (prevMap.get(pi.product_id) || 0) + pi.quantity);
          });

          const newMap = new Map<string, number>();
          updatedItems.forEach((ui) => {
            newMap.set(ui.product_id, (newMap.get(ui.product_id) || 0) + ui.quantity);
          });

          const allProdIds = Array.from(new Set([...Array.from(prevMap.keys()), ...Array.from(newMap.keys())]));
          for (const pId of allProdIds) {
            const oldQty = prevMap.get(pId) || 0;
            const newQty = newMap.get(pId) || 0;
            const diff = newQty - oldQty;
            if (diff !== 0) {
              const { data: pData } = await supabase.from('products').select('stock').eq('id', pId).single();
              if (pData) {
                await supabase.from('products').update({ stock: Math.max(0, pData.stock - diff) }).eq('id', pId);
              }
            }
          }

          await supabase.from('order_items').delete().eq('order_id', orderId);
          const insertPayload = updatedItems.map((ui) => ({
            order_id: orderId,
            product_id: ui.product_id,
            product_name: ui.product_name,
            unit_price: ui.unit_price,
            quantity: ui.quantity,
            subtotal: ui.unit_price * ui.quantity,
          }));
          await supabase.from('order_items').insert(insertPayload);

          const newTotal = updatedItems.reduce((acc, i) => acc + i.unit_price * i.quantity, 0);
          await supabase.from('orders').update({ total_amount: newTotal }).eq('id', orderId);
        } catch (itemErr) {
          console.error('Error actualizando items en despacho:', itemErr);
        }
      }

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
      throw new Error('El tiempo límite para retirar este pedido ya expiró.');
    }

    // Ajuste de productos en localStorage
    if (updatedItems && updatedItems.length > 0) {
      const localProducts = getLocalProducts();
      const prevItems = order.order_items || [];
      const prevMap = new Map<string, number>();
      prevItems.forEach((pi) => prevMap.set(pi.product_id, (prevMap.get(pi.product_id) || 0) + pi.quantity));

      const newMap = new Map<string, number>();
      updatedItems.forEach((ui) => newMap.set(ui.product_id, (newMap.get(ui.product_id) || 0) + ui.quantity));

      const allProdIds = Array.from(new Set([...Array.from(prevMap.keys()), ...Array.from(newMap.keys())]));
      allProdIds.forEach((pId) => {
        const oldQty = prevMap.get(pId) || 0;
        const newQty = newMap.get(pId) || 0;
        const diff = newQty - oldQty;
        const pIndex = localProducts.findIndex((p) => p.id === pId);
        if (pIndex !== -1 && diff !== 0) {
          localProducts[pIndex].stock = Math.max(0, localProducts[pIndex].stock - diff);
        }
      });
      saveLocalProducts(localProducts);

      orders[orderIndex].order_items = updatedItems;
      orders[orderIndex].total_amount = updatedItems.reduce((acc, i) => acc + i.unit_price * i.quantity, 0);
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
          order.cancellation_reason = 'Tiempo límite de recogida expirado.';
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

    // Actualizar campos de un producto
    async updateProduct(productId: string, updates: Partial<Product>): Promise<Product | null> {
      if (this.isUsingSupabase()) {
        const supabase = createClientBrowser();
        let payload: any = { ...updates, updated_at: new Date().toISOString() };
        let resultData: any = null;
        let lastError: any = null;

        // Auto-healing para esquemas no migrados en Supabase:
        // Si falta alguna columna en 'products' (ej: is_prepared, barcode), se descarta del payload y se reintenta
        for (let attempt = 0; attempt < 8; attempt++) {
          const { data, error } = await supabase
            .from('products')
            .update(payload)
            .eq('id', productId)
            .select()
            .single();

          if (!error) {
            resultData = data;
            lastError = null;
            break;
          }

          lastError = error;
          const match = error.message?.match(/Could not find the '(\w+)' column/i);
          if (match && match[1] && match[1] in payload) {
            console.warn(`[Supabase] Columna '${match[1]}' no existe en 'products'. Omitiendo temporalmente para guardar...`);
            delete payload[match[1]];
            continue;
          }
          break;
        }

        if (lastError && !resultData) {
          throw new Error(lastError.message);
        }

        // Mantener sincronizado en localStorage para no perder los campos locales si faltan columnas en BD
        const products = getLocalProducts();
        const index = products.findIndex((p) => p.id === productId);
        if (index !== -1) {
          products[index] = { ...products[index], ...updates, ...(resultData || {}) };
          saveLocalProducts(products);
          return products[index];
        } else if (resultData) {
          const fullProd = { ...resultData, ...updates } as Product;
          products.unshift(fullProd);
          saveLocalProducts(products);
          return fullProd;
        }

        return (resultData || { id: productId, ...updates }) as Product;
      }

      const products = getLocalProducts();
      const index = products.findIndex((p) => p.id === productId);
      if (index !== -1) {
        products[index] = { ...products[index], ...updates };
        saveLocalProducts(products);
        return products[index];
      }
      return null;
    },

    // Actualizar stock de un producto
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
        products[index] = { ...products[index], stock: Math.max(0, newStock) };
        saveLocalProducts(products);
        return true;
      }
      return false;
    },

    // Añadir un nuevo producto
    async addProduct(product: Omit<Product, 'id'>): Promise<Product> {
      if (this.isUsingSupabase()) {
        const supabase = createClientBrowser();
        let payload: any = { ...product };
        let resultData: any = null;
        let lastError: any = null;

        for (let attempt = 0; attempt < 8; attempt++) {
          const { data, error } = await supabase
            .from('products')
            .insert(payload)
            .select()
            .single();

          if (!error) {
            resultData = data;
            lastError = null;
            break;
          }

          lastError = error;
          const match = error.message?.match(/Could not find the '(\w+)' column/i);
          if (match && match[1] && match[1] in payload) {
            console.warn(`[Supabase] Columna '${match[1]}' no existe en 'products' al insertar. Omitiendo...`);
            delete payload[match[1]];
            continue;
          }
          break;
        }

        if (lastError && !resultData) {
          throw new Error(lastError.message);
        }

        const newProd = { ...product, ...(resultData || {}) } as Product;
        const products = getLocalProducts();
        products.unshift(newProd);
        saveLocalProducts(products);
        return newProd;
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

  async getStaffUsers(): Promise < StaffUser[] > {
  if(this.isUsingSupabase()) {
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
    first_name?: string;
    last_name?: string;
    role: UserRole;
    password?: string;
  }): Promise<StaffUser> {
    const finalFirstName = (user.first_name || '').trim();
    const finalLastName = (user.last_name || '').trim();
    const finalFullName = (
      user.full_name ||
      `${finalFirstName} ${finalLastName}`.trim() ||
      finalFirstName ||
      'Personal de Tienda'
    ).trim();

    if (this.isUsingSupabase()) {
      try {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...user,
            first_name: finalFirstName || undefined,
            last_name: finalLastName || undefined,
            full_name: finalFullName,
          }),
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
          full_name: finalFullName,
          first_name: finalFirstName || null,
          last_name: finalLastName || null,
          role: user.role,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as StaffUser;
    }

    const staff = getLocalStaff();
    const existing = staff.find((s) => s.email.toLowerCase() === user.email.toLowerCase());
    if (existing) {
      throw new Error(`El correo ${user.email} ya está registrado.`);
    }

    const newUser: StaffUser = {
      id: 'staff-' + Math.random().toString(36).substring(2, 8),
      email: user.email.trim().toLowerCase(),
      first_name: finalFirstName || undefined,
      last_name: finalLastName || undefined,
      full_name: finalFullName,
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
    updates: {
      role?: UserRole;
      is_active?: boolean;
      full_name?: string;
      first_name?: string;
      last_name?: string;
    }
  ): Promise<boolean> {
    const finalUpdates = { ...updates };
    if (updates.first_name !== undefined || updates.last_name !== undefined) {
      if (!updates.full_name) {
        finalUpdates.full_name = `${updates.first_name || ''} ${updates.last_name || ''}`.trim();
      }
    }

    if (this.isUsingSupabase()) {
      try {
        const res = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...finalUpdates }),
        });
        if (res.ok) return true;
      } catch (e) {
        console.warn('API patch error:', e);
      }

      const supabase = createClientBrowser();
      const { error } = await supabase
        .from('staff_users')
        .update({ ...finalUpdates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw new Error(error.message);
      return true;
    }

    const staff = getLocalStaff();
    const index = staff.findIndex((s) => s.id === id);
    if (index === -1) return false;

    staff[index] = { ...staff[index], ...finalUpdates };
    saveLocalStaff(staff);
    return true;
  },

  // Obtener historial de cortes de caja registrados
  async getShiftCuts(): Promise < ShiftCut[] > {
  if(this.isUsingSupabase()) {
  const supabase = createClientBrowser();
  const { data, error } = await supabase
    .from('shift_cuts')
    .select('*')
    .order('closed_at', { ascending: false });
  if (!error && data) {
    return data as ShiftCut[];
  }
}
const cuts = getLocalCuts();
return cuts.sort((a, b) => new Date(b.closed_at).getTime() - new Date(a.closed_at).getTime());
  },

  // Registrar un corte de caja / cierre de turno por usuario
  async registerShiftCut(payload: {
  userId?: string | null;
  userName: string;
  userRole?: UserRole;
  cashCounted?: number | null;
  notes?: string | null;
}): Promise < ShiftCut > {
  const orders = await this.getOrders('dispatched');
  // Filtrar pedidos despachados por este usuario que aún no pertenezcan a un corte cerrado
  const unclosedOrders = orders.filter((o) => {
    const matchName = o.dispatched_by_name?.toLowerCase() === payload.userName.toLowerCase();
    const matchId = payload.userId && o.dispatched_by_id === payload.userId;
    return (matchName || matchId) && !o.shift_cut_id;
  });

  let totalSales = 0;
  let cashExpected = 0;
  let cardTotal = 0;
  let transferTotal = 0;
  let otherTotal = 0;

  unclosedOrders.forEach((o) => {
    totalSales += o.total_amount;
    (o.payment_details || []).forEach((p) => {
      if (p.method === 'efectivo') {
        cashExpected += p.amount;
      } else if (p.method === 'tarjeta') {
        cardTotal += p.amount;
      } else if (p.method === 'transferencia' || p.method === 'sinpe') {
        transferTotal += p.amount;
      } else {
        otherTotal += p.amount;
      }
    });
  });

  const cashDiff = payload.cashCounted !== null && payload.cashCounted !== undefined
    ? payload.cashCounted - cashExpected
    : null;

  const startedAt = unclosedOrders.length > 0
    ? unclosedOrders[unclosedOrders.length - 1].dispatched_at || unclosedOrders[unclosedOrders.length - 1].created_at
    : new Date().toISOString();

  const closedAt = new Date().toISOString();

  if(this.isUsingSupabase()) {
  const supabase = createClientBrowser();
  const { count } = await supabase.from('shift_cuts').select('*', { count: 'exact', head: true });
  const cutSeq = (count || 0) + 1;
  const cutNumber = `CORTE-${cutSeq.toString().padStart(3, '0')}`;

  const { data: newCut, error } = await supabase
    .from('shift_cuts')
    .insert({
      cut_number: cutNumber,
      user_id: payload.userId || null,
      user_name: payload.userName,
      user_role: payload.userRole || 'despachador',
      started_at: startedAt,
      closed_at: closedAt,
      orders_count: unclosedOrders.length,
      total_sales: totalSales,
      cash_expected: cashExpected,
      cash_counted: payload.cashCounted ?? null,
      cash_difference: cashDiff,
      card_total: cardTotal,
      transfer_total: transferTotal,
      other_total: otherTotal,
      notes: payload.notes || null,
      status: 'closed',
    })
    .select()
    .single();

  if (!error && newCut) {
    if (unclosedOrders.length > 0) {
      const orderIds = unclosedOrders.map((o) => o.id);
      await supabase
        .from('orders')
        .update({ shift_cut_id: newCut.id })
        .in('id', orderIds);
    }
    return newCut as ShiftCut;
  }
}

// LocalStorage Fallback
const localCuts = getLocalCuts();
const cutNumber = `CORTE-${(localCuts.length + 1).toString().padStart(3, '0')}`;
const cutId = 'cut-' + Date.now();

const createdCut: ShiftCut = {
  id: cutId,
  cut_number: cutNumber,
  user_id: payload.userId,
  user_name: payload.userName,
  user_role: payload.userRole || 'despachador',
  started_at: startedAt,
  closed_at: closedAt,
  orders_count: unclosedOrders.length,
  total_sales: totalSales,
  cash_expected: cashExpected,
  cash_counted: payload.cashCounted ?? null,
  cash_difference: cashDiff,
  card_total: cardTotal,
  transfer_total: transferTotal,
  other_total: otherTotal,
  notes: payload.notes || null,
  status: 'closed',
  created_at: closedAt,
};

localCuts.unshift(createdCut);
saveLocalCuts(localCuts);

const allLocalOrders = getLocalOrders();
allLocalOrders.forEach((lo) => {
  const matchName = lo.dispatched_by_name?.toLowerCase() === payload.userName.toLowerCase();
  const matchId = payload.userId && lo.dispatched_by_id === payload.userId;
  if (lo.status === 'dispatched' && !lo.shift_cut_id && (matchName || matchId)) {
    lo.shift_cut_id = cutId;
  }
});
saveLocalOrders(allLocalOrders);

return createdCut;
  },
};
