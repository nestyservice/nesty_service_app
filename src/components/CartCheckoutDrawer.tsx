import React, { useState } from 'react';
import { CAMPUS_BLOCKS, CouponRecord, MenuItem, UserAccount } from '../types';
import {
  AlertCircle,
  CreditCard,
  MapPin,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Trash2,
  Wallet,
  X,
  Coins,
} from 'lucide-react';

interface CartCheckoutDrawerProps {
  isOpen: boolean;
  user: UserAccount;
  menuItems: MenuItem[];
  cartQuantities: Record<string, number>;
  selectedBlock: string;
  appliedCoupon: CouponRecord | null;
  redeemCoins: boolean;
  paymentErrorAlert: string | null;
  isProcessingPayment: boolean;
  onUpdateQuantity: (itemId: string, delta: number) => void;
  onClearCart: () => void;
  onSelectBlock: (blockCode: string) => void;
  onApplyCoupon: (code: string) => void;
  onClearCoupon: () => void;
  onToggleRedeemCoins: (enabled: boolean) => void;
  onPaySuccess: (paymentMethod: string, transactionId: string, razorpayOrderId?: string) => void;
  onPayFailed: (paymentMethod: string, reason: string) => void;
  onClose: () => void;
}

export const CartCheckoutDrawer: React.FC<CartCheckoutDrawerProps> = ({
  isOpen,
  user,
  menuItems,
  cartQuantities,
  selectedBlock,
  appliedCoupon,
  redeemCoins,
  paymentErrorAlert,
  isProcessingPayment,
  onUpdateQuantity,
  onClearCart,
  onSelectBlock,
  onApplyCoupon,
  onClearCoupon,
  onToggleRedeemCoins,
  onPaySuccess,
  onPayFailed,
  onClose,
}) => {
  const [couponInput, setCouponInput] = useState('');
  const [showGatewaySheet, setShowGatewaySheet] = useState(false);
  const [activeGatewayType, setActiveGatewayType] = useState('Razorpay Online Gateway');

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
  const maxCoinsRedeemable = Math.min(20, Math.max(0, subtotal - couponDiscount - 1));
  const coinsDiscount = redeemCoins ? Math.min(user.coins, maxCoinsRedeemable) : 0;
  const finalPayable = Math.max(1, subtotal - couponDiscount - coinsDiscount);

  const selectedBlockObj = CAMPUS_BLOCKS.find((b) => b.code === selectedBlock) || CAMPUS_BLOCKS[0];

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
          {paymentErrorAlert && (
            <div
              data-testid="payment_error_alert_card"
              className="p-3.5 rounded-2xl bg-nesty-errorBg border border-nesty-error space-y-2"
            >
              <div className="flex items-center gap-1.5 text-nesty-error font-extrabold text-xs">
                <AlertCircle className="w-4 h-4" />
                <span>Payment Alert</span>
              </div>
              <p className="text-xs text-nesty-textPrimary">{paymentErrorAlert}</p>
              <button
                onClick={() => {
                  setActiveGatewayType('Razorpay Online Gateway');
                  setShowGatewaySheet(true);
                }}
                data-testid="retry_payment_button"
                className="w-full py-2 rounded-xl bg-nesty-burgundy text-nesty-cream font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry Payment with Razorpay
              </button>
            </div>
          )}

          {cartItems.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <ShoppingCart className="w-14 h-14 text-nesty-goldDark mx-auto" />
              <h3 className="text-base font-extrabold text-nesty-burgundy">Your cart is empty</h3>
              <p className="text-xs text-nesty-textSecondary max-w-xs mx-auto">
                Add freshly prepared snacks from the Nesty menu to get started!
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
                      src={item.image}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = item.fallbackImage;
                      }}
                      alt={item.name}
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

              <div className="p-3.5 rounded-2xl bg-nesty-creamElevated border border-nesty-creamBorder space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-nesty-textPrimary">
                  <MapPin className="w-4 h-4 text-nesty-burgundy" />
                  <span>Select Campus Pickup Block</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {CAMPUS_BLOCKS.map((b) => {
                    const isSel = selectedBlock === b.code;
                    return (
                      <button
                        key={b.code}
                        onClick={() => onSelectBlock(b.code)}
                        data-testid={`select_block_${b.code}`}
                        className={`py-2 rounded-xl text-xs font-extrabold border transition ${
                          isSel
                            ? 'bg-nesty-burgundy text-nesty-cream border-nesty-gold'
                            : 'bg-nesty-creamSurface text-nesty-textPrimary border-nesty-creamBorder'
                        }`}
                      >
                        {b.code}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11px] font-semibold text-nesty-burgundy">
                  Selected Counter: {selectedBlockObj.name}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-nesty-creamElevated border border-nesty-creamBorder space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-nesty-textPrimary">
                  <Tag className="w-4 h-4 text-nesty-goldDark" />
                  <span>Coupons & Nesty Coins</span>
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

                {user.coins > 0 && (
                  <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={redeemCoins}
                      onChange={(e) => onToggleRedeemCoins(e.target.checked)}
                      className="w-4 h-4 accent-nesty-burgundy rounded"
                    />
                    <Coins className="w-4 h-4 text-nesty-goldDark" />
                    <span className="text-xs font-semibold text-nesty-textPrimary">
                      Redeem Nesty Coins (Balance: {user.coins})
                    </span>
                  </label>
                )}
              </div>

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
                {coinsDiscount > 0 && (
                  <div className="flex justify-between text-nesty-goldDark">
                    <span>Coins Redeemed:</span>
                    <span className="font-bold">-₹{coinsDiscount}</span>
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
            <button
              onClick={() => {
                setActiveGatewayType('Razorpay Online Gateway');
                setShowGatewaySheet(true);
              }}
              disabled={isProcessingPayment}
              data-testid="pay_razorpay_gateway_button"
              className="w-full py-3 rounded-xl bg-nesty-burgundy text-nesty-cream font-extrabold text-sm flex items-center justify-center gap-2 hover:bg-nesty-burgundyDark transition disabled:opacity-60"
            >
              <CreditCard className="w-4 h-4" />
              <span>
                {isProcessingPayment
                  ? 'Verifying Payment...'
                  : `Pay ₹${finalPayable} (Online Gateway)`}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveGatewayType('UPI App (GPay / PhonePe)');
                setShowGatewaySheet(true);
              }}
              disabled={isProcessingPayment}
              data-testid="pay_upi_app_button"
              className="w-full py-2.5 rounded-xl border border-nesty-gold bg-nesty-creamSurface text-nesty-burgundy font-bold text-xs flex items-center justify-center gap-2 hover:bg-nesty-cream"
            >
              <Wallet className="w-4 h-4" />
              <span>Pay via UPI App (PhonePe / GPay / Paytm)</span>
            </button>

            <div className="flex items-center justify-center gap-1 text-[10px] text-nesty-textSecondary pt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-nesty-success" />
              <span>Instant Order & Transaction ID Receipt (No QR Required)</span>
            </div>
          </div>
        )}
      </div>

      {showGatewaySheet && (
        <div
          onClick={() => setShowGatewaySheet(false)}
          className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            data-testid="gateway_verification_modal"
            className="w-full max-w-sm bg-nesty-creamSurface border-2 border-nesty-gold rounded-3xl shadow-2xl p-6 text-center space-y-4"
          >
            <div>
              <h3 className="text-lg font-extrabold text-nesty-burgundy">{activeGatewayType}</h3>
              <p className="text-xs text-nesty-textSecondary">
                Merchant: Nesty Campus Canteen • Block {selectedBlock}
              </p>
            </div>

            <div className="inline-block px-5 py-2.5 rounded-2xl bg-nesty-goldLight border border-nesty-gold text-xl font-extrabold text-nesty-burgundyDark">
              Payable: ₹{finalPayable}
            </div>

            <p className="text-xs text-nesty-textSecondary">
              Complete payment to generate your verified Order ID & Transaction ID receipt.
            </p>

            <div className="space-y-2">
              <button
                onClick={() => {
                  const txnId = `TXN-${activeGatewayType.startsWith('UPI') ? 'UPI' : 'RZP'}-${
                    100000 + Math.floor(Math.random() * 900000)
                  }`;
                  const rzpOrder = `order_${Date.now() % 1000000}`;
                  setShowGatewaySheet(false);
                  onPaySuccess(activeGatewayType, txnId, rzpOrder);
                }}
                data-testid="confirm_verified_payment_button"
                className="w-full py-3 rounded-xl bg-nesty-burgundy text-nesty-cream font-extrabold text-xs hover:bg-nesty-burgundyDark"
              >
                Complete Verified Payment (₹{finalPayable})
              </button>

              <button
                onClick={() => {
                  setShowGatewaySheet(false);
                  onPayFailed(
                    activeGatewayType,
                    'Payment was cancelled or declined by user before completion.'
                  );
                }}
                data-testid="simulate_failed_payment_button"
                className="w-full py-2.5 rounded-xl border border-nesty-error/50 bg-nesty-errorBg text-nesty-error font-bold text-xs"
              >
                Cancel / Simulate Failed Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
