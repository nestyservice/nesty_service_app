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

export interface QrValidationResult {
  valid: boolean;
  type: 'ORDER_RECEIPT' | 'PROMO_COUPON' | 'INVALID';
  title: string;
  subtitle: string;
  order?: OrderRecord;
  couponCode?: string;
}
