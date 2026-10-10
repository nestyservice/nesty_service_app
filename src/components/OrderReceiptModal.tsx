import React from 'react';
import { OrderRecord } from '../types';
import { CheckCircle2, Clock, Coins, Receipt, X } from 'lucide-react';

interface OrderReceiptModalProps {
  order: OrderRecord | null;
  isAdmin: boolean;
  onUpdateStatus: (orderId: string, newStatus: string) => void;
  onClose: () => void;
}

export const OrderReceiptModal: React.FC<OrderReceiptModalProps> = ({
  order,
  isAdmin,
  onUpdateStatus,
  onClose,
}) => {
  if (!order) return null;

  const isClaimed = order.orderStatus.toUpperCase() === 'CLAIMED';
  const isPaid = order.paymentStatus === 'PAID' || order.paymentStatus === 'SUCCESS';

  const statusLabel = (() => {
    switch (order.orderStatus.toUpperCase()) {
      case 'CLAIMED':
        return 'ORDER FULFILLED & CLAIMED';
      case 'READY':
        return 'READY FOR COUNTER PICKUP';
      case 'PREPARING':
        return 'PREPARING IN CANTEEN';
      case 'CANCELLED':
        return 'ORDER CANCELLED';
      default:
        return 'ACTIVE • PENDING PICKUP';
    }
  })();

  return (
    <div
      onClick={onClose}
      data-testid="order_receipt_modal_backdrop"
      className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-testid="order_receipt_modal_card"
        className="w-full max-w-md bg-nesty-creamSurface border-2 border-nesty-gold rounded-[28px] shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-nesty-burgundy border border-nesty-gold flex items-center justify-center text-nesty-cream">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-nesty-burgundy">Order #{order.id}</h2>
              <p className="text-xs text-nesty-textSecondary">Digital Order & Payment Receipt</p>
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="close_receipt_modal_button"
            className="p-2 rounded-xl text-nesty-burgundy hover:bg-nesty-creamElevated"
            aria-label="Close Receipt"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status & Transaction ID Banner (Strictly NO QR Code generated or displayed!) */}
        <div
          className={`mt-4 rounded-2xl p-4 border-2 text-center ${
            isClaimed
              ? 'bg-nesty-successBg border-nesty-success'
              : isPaid
              ? 'bg-nesty-goldLight border-nesty-gold'
              : 'bg-nesty-errorBg border-nesty-error'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            {isClaimed ? (
              <CheckCircle2 className="w-5 h-5 text-nesty-success" />
            ) : (
              <Clock className="w-5 h-5 text-nesty-burgundy" />
            )}
            <span
              className={`text-xs font-extrabold tracking-wider uppercase ${
                isClaimed ? 'text-nesty-success' : 'text-nesty-burgundyDark'
              }`}
            >
              {statusLabel}
            </span>
          </div>

          <div
            data-testid="receipt_transaction_id_badge"
            className="mt-2.5 inline-block bg-nesty-creamSurface border border-nesty-gold rounded-xl px-4 py-2"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-nesty-textSecondary">
              TRANSACTION ID
            </div>
            <div className="text-sm font-mono font-extrabold text-nesty-burgundy">
              {order.transactionId}
            </div>
          </div>

          <p className="mt-2 text-xs text-nesty-textPrimary">
            {isClaimed
              ? `Picked up at ${order.block} Block Counter${order.claimedBy ? ` (${order.claimedBy})` : ''}`
              : `Present Order #${order.id} or Transaction ID at the ${order.block} Block Counter for pickup.`}
          </p>
        </div>

        {/* Student & Campus Block Info */}
        <div className="mt-4 bg-nesty-creamElevated border border-nesty-creamBorder rounded-2xl p-3.5 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-nesty-textSecondary">Student Name</span>
            <span className="font-bold text-nesty-textPrimary">{order.studentName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-nesty-textSecondary">Student Email</span>
            <span className="font-bold text-nesty-textPrimary">{order.studentEmail}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-nesty-textSecondary">Pickup Location</span>
            <span className="font-bold text-nesty-textPrimary">{order.block} Block Canteen</span>
          </div>
          <div className="flex justify-between">
            <span className="text-nesty-textSecondary">Payment Method</span>
            <span className="font-bold text-nesty-textPrimary">{order.paymentMethod}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-nesty-textSecondary">Payment Status</span>
            <span className="font-bold text-nesty-textPrimary">{order.paymentStatus}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-nesty-textSecondary">Order Timestamp</span>
            <span className="font-bold text-nesty-textPrimary">
              {order.createdAt.replace('T', ' ').replace('Z', '').slice(0, 19)}
            </span>
          </div>
        </div>

        {/* Ordered Items Breakdown */}
        <div className="mt-4 bg-nesty-creamElevated border border-nesty-creamBorder rounded-2xl p-3.5 space-y-2">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-nesty-burgundy">
            ORDERED ITEMS
          </div>
          {order.items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center text-sm">
              <span className="font-semibold text-nesty-textPrimary">
                {item.quantity}x {item.name}
              </span>
              <span className="font-bold text-nesty-burgundy">₹{item.price * item.quantity}</span>
            </div>
          ))}

          <hr className="border-nesty-creamBorder my-1" />

          {order.discount > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-nesty-textSecondary">Promo Discount</span>
              <span className="font-bold text-nesty-success">-₹{order.discount}</span>
            </div>
          )}
          {order.coinsRedeemed > 0 && (
            <div className="flex justify-between text-xs">
              <span className="text-nesty-textSecondary">Nesty Coins Redeemed</span>
              <span className="font-bold text-nesty-goldDark">-₹{order.coinsRedeemed}</span>
            </div>
          )}
          {order.coinsEarned > 0 && (
            <div className="flex justify-between items-center text-xs">
              <span className="flex items-center gap-1 font-bold text-nesty-goldDark">
                <Coins className="w-3.5 h-3.5" /> Coins Earned
              </span>
              <span className="font-bold text-nesty-goldDark">+{order.coinsEarned} Coins</span>
            </div>
          )}

          <div className="flex justify-between items-center pt-1">
            <span className="text-sm font-extrabold text-nesty-textPrimary">Total Amount Paid</span>
            <span className="text-lg font-extrabold text-nesty-burgundy">₹{order.finalAmount}</span>
          </div>
        </div>

        {/* Admin Order Status Controls */}
        {isAdmin && order.paymentStatus !== 'FAILED' && (
          <div className="mt-4">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-nesty-burgundy mb-2">
              ADMIN ORDER STATUS UPDATE:
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['PREPARING', 'READY', 'CLAIMED'] as const).map((st) => {
                const active = order.orderStatus.toUpperCase() === st;
                return (
                  <button
                    key={st}
                    onClick={() => onUpdateStatus(order.id, st)}
                    className={`py-2 px-2 rounded-xl text-xs font-extrabold transition ${
                      active
                        ? 'bg-nesty-gold text-nesty-textPrimary border border-nesty-burgundy'
                        : 'bg-nesty-burgundy text-nesty-cream hover:bg-nesty-burgundyDark'
                    }`}
                  >
                    {st}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          data-testid="done_receipt_button"
          className="mt-5 w-full py-3 rounded-xl bg-nesty-burgundy text-nesty-cream font-extrabold text-sm hover:bg-nesty-burgundyDark transition"
        >
          Close Receipt
        </button>
      </div>
    </div>
  );
};
