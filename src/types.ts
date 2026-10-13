export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  unit: string;
  isVeg: boolean;
  image: string;
  fallbackImage: string;
  isAvailable: boolean;
  stockCount: number;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  isVeg: boolean;
}

export interface OrderRecord {
  id: string;
  studentEmail: string;
  studentName: string;
  studentPhone: string;
  block?: string;
  items: OrderItem[];
  totalAmount: number;
  discount: number;
  finalAmount: number;
  coinsEarned?: number;
  coinsRedeemed?: number;
  paymentMethod: string;
  transactionId: string;
  razorpayOrderId?: string | null;
  paymentStatus: 'PAID' | 'SUCCESS' | 'FAILED' | 'PENDING';
  orderStatus: 'PENDING_PICKUP' | 'PREPARING' | 'READY' | 'CLAIMED' | 'CANCELLED';
  pickupToken?: string;
  failureReason?: string;
  claimedBy?: string | null;
  claimedAt?: string | null;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  studentEmail: string;
  studentName: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  transactionId: string;
  razorpayOrderId?: string | null;
  status: 'PAID' | 'SUCCESS' | 'FAILED' | 'PENDING';
  failureReason?: string;
  createdAt: string;
}

export interface UserAccount {
  email: string;
  id: string;
  name: string;
  phone: string;
  rollNo: string;
  block?: string;
  role: 'student' | 'admin';
  coins?: number;
  createdAt: string;
}

export interface CouponRecord {
  id: string;
  code: string;
  discountPercent: number;
  maxDiscount: number;
  minOrderAmount: number;
  usageCount: number;
}

export interface AnnouncementRecord {
  id: string;
  title: string;
  message: string;
  createdAt: string;
}

export interface DailyTokenRecord {
  id: string;
  studentEmail: string;
  studentName: string;
  rollNo: string;
  code: string; // Exactly 3 chars: 1 alphabet + 2 numbers (e.g. 'A42')
  date: string; // 'YYYY-MM-DD'
  status: 'ACTIVE' | 'EXPIRED';
  createdAt: string;
  expiredAt?: string | null;
  expiredBy?: string | null;
}

export interface QrValidationResult {
  valid: boolean;
  type: 'ORDER_RECEIPT' | 'PROMO_COUPON' | 'INVALID';
  title: string;
  subtitle: string;
  order?: OrderRecord;
  couponCode?: string;
}

export function resolveFoodImageUrl(url?: string): string {
  if (!url) return '/images/samosa.webp';
  const clean = url.trim();

  // Known optimized static local food images
  if (clean.includes('egg-puff')) return '/images/egg-puff.webp';
  if (clean.includes('chicken-puff')) return '/images/chicken-puff.webp';
  if (clean.includes('veg-puff')) return '/images/veg-puff.webp';
  if (clean.includes('samosa')) return '/images/samosa.webp';

  if (clean.includes('deliz-canteen.onrender.com/images/')) {
    const match = clean.match(/([^/]+)\.(?:png|jpg|jpeg|webp)$/i);
    if (match) {
      const name = match[1];
      if (['egg-puff', 'chicken-puff', 'veg-puff', 'samosa'].includes(name)) {
        return `/images/${name}.webp`;
      }
      return `/images/${name}.jpg`;
    }
    return '/images/samosa.webp';
  }
  return clean;
}

export interface ProductSaleMetric {
  productId: string;
  name: string;
  category?: string;
  quantitySold: number;
  ordersCount: number;
  totalSales: number;
  isVeg?: boolean;
}

export interface RevenueTransactionItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
  isVeg?: boolean;
}

export interface RevenueTransactionRecord {
  paymentId: string;
  orderId: string;
  transactionId: string;
  paymentMethod: string;
  studentName: string;
  studentEmail: string;
  amount: number;
  paymentStatus: 'PAID' | 'SUCCESS' | 'FAILED' | 'PENDING';
  refundStatus: 'NONE' | 'REFUNDED' | 'PARTIAL';
  refundAmount: number;
  netAmount: number;
  paymentDate: string;
  formattedPaymentTime: string;
  items: RevenueTransactionItem[];
}

export interface DailyRevenueReport {
  date: string;
  formattedDate: string;
  grossRevenue: number;
  refunds: number;
  netRevenue: number;
  successfulPaymentsCount: number;
  ordersPlacedCount: number;
  ordersPaidCount: number;
  productsSoldCount: number;
  productSalesBreakdown: ProductSaleMetric[];
  transactions: RevenueTransactionRecord[];
}

export interface RevenueSummary {
  todayRevenue: number;
  todayRefunds: number;
  todayNetRevenue: number;
  todayDate: string;
  todaySuccessfulPayments: number;
  todayProductsSold: number;
  todayOrders: number;
  totalHistoricalRevenue: number;
  totalHistoricalRefunds: number;
  totalHistoricalNetRevenue: number;
  totalSuccessfulPayments: number;
  totalProductsSold: number;
  totalOrders: number;
  pendingPaymentsCount: number;
  failedPaymentsCount: number;
  timeRangeLabel: string;
  availableDates: string[];
}

export interface RevenueAnalyticsResponse {
  success: boolean;
  summary: RevenueSummary;
  selectedDayReport: DailyRevenueReport;
  allTimeProductSales: ProductSaleMetric[];
}

