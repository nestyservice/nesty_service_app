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
  block: string;
  items: OrderItem[];
  totalAmount: number;
  discount: number;
  finalAmount: number;
  coinsEarned: number;
  coinsRedeemed: number;
  paymentMethod: string;
  transactionId: string;
  razorpayOrderId?: string | null;
  paymentStatus: 'PAID' | 'SUCCESS' | 'FAILED';
  orderStatus: 'PENDING_PICKUP' | 'PREPARING' | 'READY' | 'CLAIMED' | 'CANCELLED';
  failureReason?: string;
  claimedBy?: string | null;
  claimedAt?: string | null;
  createdAt: string;
}

export interface UserAccount {
  email: string;
  id: string;
  name: string;
  phone: string;
  rollNo: string;
  block: string;
  role: 'student' | 'admin';
  coins: number;
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
  type: 'ORDER_RECEIPT' | 'PROMO_COUPON' | 'CAMPUS_COUNTER' | 'INVALID';
  title: string;
  subtitle: string;
  order?: OrderRecord;
  couponCode?: string;
  block?: string;
}

export const CAMPUS_BLOCKS = [
  { id: 'CB', code: 'CB', name: 'Civil Block' },
  { id: 'CM', code: 'CM', name: 'Computer Science and Mechanical Block' },
  { id: 'FB', code: 'FB', name: 'First year Block' },
  { id: 'PG', code: 'PG', name: 'Post Graduate Block' },
];
