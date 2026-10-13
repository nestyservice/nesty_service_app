import React, { useState } from 'react';
import { CouponRecord, MenuItem, UserAccount, resolveFoodImageUrl } from '../types';
import {
  AlertCircle,
  CreditCard,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Trash2,
  X,
} from 'lucide-react';

interface CartCheckoutDrawerProps {
  isOpen: boolean;
  user: UserAccount;
  menuItems: MenuItem[];
  cartQuantities: Record<string, number>;
  appliedCoupon: CouponRecord | null;
  paymentErrorAlert: string | null;
  isProcessingPayment: boolean;
  onUpdateQuantity: (itemId: string, delta: number) => void;
  onClearCart: () => void;
  onApplyCoupon: (code: string) => void;
  onClearCoupon: () => void;
  onPaySuccess: (paymentMethod: string, transactionId: string, razorpayOrderId?: string) => void;
  onPayFailed: (paymentMethod: string, reason: string) => void;
  onClose: () => void;
}

// Dynamically load Razorpay SDK script if not already present
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as unknown as { Razorpay?: unknown }).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export const CartCheckoutDrawer: React.FC<CartCheckoutDrawerProps> = ({
  isOpen,
  user,
  menuItems,
  cartQuantities,
  appliedCoupon,
  paymentErrorAlert,
  isProcessingPayment,
  onUpdateQuantity,
  onClearCart,
  onApplyCoupon,
  onClearCoupon,
  onPaySuccess,
  onPayFailed,
  onClose,
}) => {
  const [couponInput, setCouponInput] = useState('');
  const [isLaunchingRazorpay, setIsLaunchingRazorpay] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  if (!isOpen) return null;

  const cartItems = Object.entries(cartQuantities)
    .map(([id, qty]) => {
      const item = menuItems.find((m) => m.id === id);
      return item && qty > 0 ? { item, qty } : null;
    })
    .filter((x): x is { item: MenuItem; qty: number } => x !== null);

  const totalCount = cartItems.reduce((sum, x) => sum + x.qty, 0);
  const subtotal = cartItems.reduce((sum, x) => sum + x.item.price * x.qty, 0);
  const couponDiscount =
    appliedCoupon && subtotal >= appliedCoupon.minOrderAmount
      ? Math.min(Math.floor((subtotal * appliedCoupon.discountPercent) / 100), appliedCoupon.maxDiscount)
      : 0;
  const finalPayable = Math.max(1, subtotal - couponDiscount);

  // Single unified Razorpay Checkout launcher (Requirement #5)
  const handleLaunchRazorpayCheckout = async () => {
    setCheckoutError(null);
    setIsLaunchingRazorpay(true);

    try {
      // 1. Create valid order on the backend using Razorpay server-side API
      // Authoritative calculation from authoritative product prices in db
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cartItems.map((x) => ({
            id: x.item.id,
            quantity: x.qty,
          })),
          couponCode: appliedCoupon?.code,
          amount: finalPayable,
        }),
      });

      const orderData = await res.json();
      if (!res.ok || !orderData.success) {
        const errorMsg =
          orderData.message ||
          'Razorpay order creation failed. Please check merchant gateway configuration or network connectivity.';
        setCheckoutError(errorMsg);
        onPayFailed('Razorpay Checkout', errorMsg);
        setIsLaunchingRazorpay(false);
        return;
      }

      // 2. Load Razorpay Checkout SDK
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        const errorMsg = 'Failed to load Razorpay Checkout SDK. Please check your internet connection.';
        setCheckoutError(errorMsg);
        onPayFailed('Razorpay Checkout', errorMsg);
        setIsLaunchingRazorpay(false);
        return;
      }

      const RazorpayConstructor = (
        window as unknown as {
          Razorpay: new (opts: Record<string, unknown>) => {
            open: () => void;
            on: (event: string, handler: (data: Record<string, unknown>) => void) => void;
          };
        }
      ).Razorpay;

      if (!RazorpayConstructor) {
        const errorMsg = 'Razorpay checkout interface could not be initialized.';
        setCheckoutError(errorMsg);
        onPayFailed('Razorpay Checkout', errorMsg);
        setIsLaunchingRazorpay(false);
        return;
      }

      // 3. Configure and open actual Razorpay Checkout interface
      // Enables all supported UPI payment methods (GPay, PhonePe, Paytm, etc.) and cards
      const rzpOptions: Record<string, unknown> = {
        key: orderData.keyId || orderData.key,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'NESTY',
        description: 'Campus Canteen Food Order',
        image: '/images/nesty-logo.jpg',
        order_id: orderData.razorpayOrderId,
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.phone || '9999999999',
        },
        notes: {
          student_email: user.email,
          student_name: user.name,
        },
        theme: {
          color: '#701F2B',
        },
        modal: {
          ondismiss: () => {
            setIsLaunchingRazorpay(false);
            onPayFailed('Razorpay Checkout', 'Payment was cancelled or closed before completion.');
          },
        },
        handler: async (response: {
          razorpay_payment_id?: string;
          razorpay_order_id?: string;
          razorpay_signature?: string;
        }) => {
          setIsLaunchingRazorpay(false);
          const paymentId = response.razorpay_payment_id;
          const orderId = response.razorpay_order_id || orderData.razorpayOrderId;
          const signature = response.razorpay_signature;

          if (!paymentId) {
            onPayFailed('Razorpay Checkout', 'No payment reference received from gateway.');
            return;
          }

          // 4. Verify payment signature securely on the backend
          try {
            const verifyRes = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('nesty_web_auth_token') || ''}`,
              },
              body: JSON.stringify({
                razorpay_order_id: orderId,
                razorpay_payment_id: paymentId,
                razorpay_signature: signature,
                studentEmail: user.email,
                studentName: user.name,
                studentPhone: user.phone,
                items: cartItems.map((x) => ({
                  id: x.item.id,
                  name: x.item.name,
                  price: x.item.price,
                  quantity: x.qty,
                  isVeg: x.item.isVeg,
                })),
                totalAmount: subtotal,
                discount: couponDiscount,
                isTestPayment: orderData.isTestMode,
              }),
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              onPaySuccess('Razorpay UPI / Online', paymentId, orderId);
            } else {
              const failReason = verifyData.message || 'Server-side payment signature verification failed.';
              setCheckoutError(failReason);
              onPayFailed('Razorpay Checkout', failReason);
            }
          } catch {
            const failReason = 'Network error during server payment verification.';
            setCheckoutError(failReason);
            onPayFailed('Razorpay Checkout', failReason);
          }
        },
      };

      const rzpInstance = new RazorpayConstructor(rzpOptions);
      rzpInstance.on('payment.failed', (failData: Record<string, unknown>) => {
        setIsLaunchingRazorpay(false);
        const errObj = failData.error as Record<string, unknown> | undefined;
        const reason = (errObj?.description || 'Payment was declined by bank or UPI application.') as string;
        setCheckoutError(reason);
        onPayFailed('Razorpay Checkout', reason);
      });

      rzpInstance.open();
    } catch (err: unknown) {
      setIsLaunchingRazorpay(false);
      const msg = err instanceof Error ? err.message : 'Unknown payment gateway error';
      setCheckoutError(msg);
      onPayFailed('Razorpay Checkout', msg);
    }
  };

  const activeAlert = paymentErrorAlert || checkoutError;

  return (
    <div
      onClick={onClose}
      data-testid="cart_drawer_backdrop"
      className="fixed inset-0 z-40 bg-black/55 flex justify-end"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-testid="cart_checkout_drawer"
        className="w-full max-w-md bg-nesty-creamSurface h-full border-l-2 border-nesty-gold shadow-2xl flex flex-col"
      >
        <div className="px-5 py-4 bg-nesty-creamElevated border-b border-nesty-gold/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingCart className="w-5 h-5 text-nesty-burgundy" />
            <h2 className="text-lg font-extrabold text-nesty-burgundy">Your Cart</h2>
            <span className="px-2.5 py-0.5 rounded-lg bg-nesty-goldLight border border-nesty-gold text-xs font-extrabold text-nesty-burgundyDark">
              {totalCount} {totalCount === 1 ? 'item' : 'items'}
            </span>
          </div>
          <button
            onClick={onClose}
            data-testid="close_cart_drawer_button"
            className="p-2 rounded-xl text-nesty-burgundy hover:bg-nesty-cream"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {activeAlert && (
            <div
              data-testid="payment_error_alert_card"
              className="p-3.5 rounded-2xl bg-nesty-errorBg border border-nesty-error space-y-2"
            >
              <div className="flex items-center gap-1.5 text-nesty-error font-extrabold text-xs">
                <AlertCircle className="w-4 h-4" />
                <span>Payment Notice</span>
              </div>
              <p className="text-xs text-nesty-textPrimary">{activeAlert}</p>
              <button
                onClick={handleLaunchRazorpayCheckout}
                disabled={isLaunchingRazorpay || isProcessingPayment}
                data-testid="retry_payment_button"
                className="w-full py-2 rounded-xl bg-nesty-burgundy text-nesty-cream font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Razorpay Checkout
              </button>
            </div>
          )}

          {cartItems.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <ShoppingCart className="w-14 h-14 text-nesty-goldDark mx-auto" />
              <h3 className="text-base font-extrabold text-nesty-burgundy">Your cart is empty</h3>
              <p className="text-xs text-nesty-textSecondary max-w-xs mx-auto">
                Add freshly prepared items from the NESTY canteen menu to checkout.
              </p>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-nesty-burgundy text-nesty-cream font-bold text-xs"
              >
                Browse Menu
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-nesty-textSecondary">
                  ORDER ITEMS
                </span>
                <button
                  onClick={onClearCart}
                  data-testid="clear_cart_button"
                  className="text-xs font-bold text-nesty-error flex items-center gap-1 hover:underline"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear
                </button>
              </div>

              {cartItems.map(({ item, qty }) => (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-nesty-creamElevated border border-nesty-creamBorder flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={resolveFoodImageUrl(item.image)}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/images/samosa.webp';
                      }}
                      alt={item.name}
                      width={48}
                      height={48}
                      loading="eager"
                      className="w-12 h-12 rounded-xl object-cover border border-nesty-gold shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-nesty-textPrimary truncate">
                        {item.name}
                      </div>
                      <div className="text-xs font-bold text-nesty-burgundy">₹{item.price} each</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-nesty-creamSurface border border-nesty-gold rounded-xl px-2 py-1">
                    <button
                      onClick={() => onUpdateQuantity(item.id, -1)}
                      className="p-1 text-nesty-burgundy hover:bg-nesty-creamElevated rounded"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-extrabold text-nesty-textPrimary w-4 text-center">
                      {qty}
                    </span>
                    <button
                      onClick={() => onUpdateQuantity(item.id, 1)}
                      className="p-1 text-nesty-burgundy hover:bg-nesty-creamElevated rounded"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Promo Coupon Section (No coins) */}
              <div className="p-3.5 rounded-2xl bg-nesty-creamElevated border border-nesty-creamBorder space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-nesty-textPrimary">
                  <Tag className="w-4 h-4 text-nesty-goldDark" />
                  <span>Promo Coupons</span>
                </div>

                {appliedCoupon ? (
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-nesty-goldLight border border-nesty-gold text-xs">
                    <span className="font-bold text-nesty-burgundyDark">
                      {appliedCoupon.code} ({appliedCoupon.discountPercent}% OFF)
                    </span>
                    <button
                      onClick={onClearCoupon}
                      className="text-nesty-error font-bold hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="NESTY20"
                      className="flex-1 px-3 py-2 rounded-xl bg-nesty-creamSurface border border-nesty-gold text-xs focus:outline-none focus:border-nesty-burgundy"
                    />
                    <button
                      onClick={() => onApplyCoupon(couponInput)}
                      className="px-4 py-2 rounded-xl bg-nesty-burgundy text-nesty-cream font-bold text-xs"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="p-3.5 rounded-2xl bg-nesty-creamElevated border border-nesty-gold space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-nesty-textSecondary">Items Subtotal:</span>
                  <span className="font-bold text-nesty-textPrimary">₹{subtotal}</span>
                </div>
                {couponDiscount > 0 && (
                  <div className="flex justify-between text-nesty-success">
                    <span>Promo Discount:</span>
                    <span className="font-bold">-₹{couponDiscount}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-nesty-textSecondary">Counter Pickup:</span>
                  <span className="font-bold text-nesty-burgundy">FREE</span>
                </div>
                <hr className="border-nesty-creamBorder my-1" />
                <div className="flex justify-between items-center pt-1">
                  <span className="text-sm font-extrabold text-nesty-textPrimary">
                    Total Payable:
                  </span>
                  <span className="text-lg font-extrabold text-nesty-burgundy">
                    ₹{finalPayable}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="p-4 bg-nesty-creamElevated border-t border-nesty-gold/50 space-y-2">
            {/* One clear 'Pay Now' button launching Razorpay Checkout (Requirement #5) */}
            <button
              onClick={handleLaunchRazorpayCheckout}
              disabled={isLaunchingRazorpay || isProcessingPayment}
              data-testid="pay_now_razorpay_button"
              className="w-full py-3.5 rounded-xl bg-nesty-burgundy text-nesty-cream font-extrabold text-sm flex items-center justify-center gap-2 hover:bg-nesty-burgundyDark transition disabled:opacity-60 shadow-lg"
            >
              <CreditCard className="w-4 h-4" />
              <span>
                {isLaunchingRazorpay || isProcessingPayment
                  ? 'Connecting to Razorpay...'
                  : `Pay Now • ₹${finalPayable} (Razorpay Checkout)`}
              </span>
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-nesty-textSecondary pt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-nesty-success" />
              <span>Supports UPI (Google Pay, PhonePe, Paytm), Cards & Netbanking</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
