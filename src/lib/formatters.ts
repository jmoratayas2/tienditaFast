import { Product } from './types';

export function formatCurrency(amount: number, currency: string = 'Q'): string {
  const formatted = new Intl.NumberFormat('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${currency} ${formatted}`;
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('es-GT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export function calculateRemainingSeconds(expiresAtStr: string): number {
  const now = new Date().getTime();
  const expiresAt = new Date(expiresAtStr).getTime();
  const diff = Math.floor((expiresAt - now) / 1000);
  return diff > 0 ? diff : 0;
}

export function formatCountdown(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function isProductAvailableNow(product: Product): { available: boolean; scheduleText?: string } {
  if (!product.is_active) {
    return { available: false, scheduleText: 'No disponible' };
  }

  if (product.available_all_day !== false && (!product.available_from || !product.available_to)) {
    return { available: true };
  }

  const now = new Date();
  const currentHours = now.getHours().toString().padStart(2, '0');
  const currentMinutes = now.getMinutes().toString().padStart(2, '0');
  const currentTime = `${currentHours}:${currentMinutes}`;

  const from = product.available_from || '00:00';
  const to = product.available_to || '23:59';

  const scheduleText = `Horario: ${from} - ${to}`;

  if (currentTime >= from && currentTime <= to) {
    return { available: true, scheduleText };
  }

  return {
    available: false,
    scheduleText: `Disponible de ${from} a ${to}`,
  };
}
