export type OrderStatus = 'pending' | 'dispatched' | 'cancelled' | 'expired';

export type PaymentMethodType = 'efectivo' | 'tarjeta' | 'transferencia' | 'sinpe' | 'otro';

export type UserRole = 'admin' | 'despachador';

export interface StaffUser {
  id: string;
  auth_user_id?: string | null;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at?: string;
}

export interface PaymentItem {
  id: string;
  method: PaymentMethodType;
  amount: number;
  received?: number;       // Para efectivo: monto entregado por el cliente
  change?: number;         // Para efectivo: vuelto entregado al cliente
  reference?: string;      // Para tarjeta / transferencia / sinpe: número de comprobante
  notes?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  category: string;
  image_url: string | null;
  is_active: boolean;
  is_featured?: boolean;
  barcode?: string | null;
  available_all_day?: boolean;
  available_from?: string; // Formato HH:mm, ej: "06:00"
  available_to?: string;   // Formato HH:mm, ej: "11:30"
  created_at?: string;
  updated_at?: string;
}

export interface StoreSettings {
  id: string;
  store_name: string;
  banner_title: string;
  banner_message: string;
  banner_active: boolean;
  pickup_time_minutes: number;
  is_store_open: boolean;
  closed_message: string;
  show_featured_section: boolean;
  opening_time?: string;
  closing_time?: string;
  updated_at?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  created_at?: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_notes?: string | null;
  status: OrderStatus;
  total_amount: number;
  created_at: string;
  expires_at: string;
  dispatched_at?: string | null;
  dispatched_by_id?: string | null;
  dispatched_by_name?: string | null;
  cancellation_reason?: string | null;
  payment_status: 'unpaid' | 'paid' | 'refunded';
  payment_details: PaymentItem[];
  order_items?: OrderItem[];
  shift_cut_id?: string | null;
}

export interface ShiftCut {
  id: string;
  cut_number: string;
  user_id?: string | null;
  user_name: string;
  user_role?: UserRole;
  started_at: string;
  closed_at: string;
  orders_count: number;
  total_sales: number;
  cash_expected: number;
  cash_counted?: number | null;
  cash_difference?: number | null;
  card_total: number;
  transfer_total: number;
  other_total: number;
  notes?: string | null;
  status: 'closed';
  created_at?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
