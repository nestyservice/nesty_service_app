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
  if (!url) return '/images/samosa.jpg';
  const clean = url.trim();
  if (clean.includes('deliz-canteen.onrender.com/images/')) {
    const match = clean.match(/([^/]+)\.(?:png|jpg|jpeg)$/i);
    if (match) {
      const name = match[1];
      return `/images/${name}.jpg`;
    }
    return '/images/samosa.jpg';
  }
  return clean;
}

