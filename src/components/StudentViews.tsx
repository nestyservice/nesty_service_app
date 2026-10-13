import React, { useState } from 'react';
import {
  AnnouncementRecord,
  MenuItem,
  OrderRecord,
  PaymentRecord,
  UserAccount,
  resolveFoodImageUrl,
} from '../types';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  CreditCard,
  KeyRound,
  Lock,
  LogOut,
  Minus,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShoppingCart,
  User,
  X,
  XCircle,
} from 'lucide-react';

interface StudentMenuViewProps {
  menuItems: MenuItem[];
  announcements: AnnouncementRecord[];
  activeOrders: OrderRecord[];
  cartQuantities: Record<string, number>;
  onAddToCart: (item: MenuItem) => void;
  onUpdateCartQuantity: (itemId: string, delta: number) => void;
  onOpenCart: () => void;
  onOpenOrderDetails: (order: OrderRecord) => void;
  onRefreshMenu?: () => void;
}

export const StudentMenuView: React.FC<StudentMenuViewProps> = ({
  menuItems,
  announcements,
  activeOrders,
  cartQuantities,
  onAddToCart,
  onUpdateCartQuantity,
  onOpenCart,
  onOpenOrderDetails,
  onRefreshMenu,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [vegOnly, setVegOnly] = useState(false);

  const categories = ['All', ...Array.from(new Set(menuItems.map((m) => m.category)))];

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch =
      !searchQuery.trim() ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat =
      selectedCategory === 'All' || item.category.toLowerCase() === selectedCategory.toLowerCase();
    const matchesVeg = !vegOnly || item.isVeg;
    return matchesSearch && matchesCat && matchesVeg;
  });

  const cartCount = Object.values(cartQuantities).reduce((acc, q) => acc + q, 0);
  const cartSubtotal = Object.entries(cartQuantities).reduce((sum, [id, qty]) => {
    const it = menuItems.find((m) => m.id === id);
    return sum + (it ? it.price * qty : 0);
  }, 0);

  return (
    <div data-testid="student_menu_screen" className="space-y-5 pb-24 md:pb-8">
      {/* Clean Food Ordering Header (No personalized greeting, No block names) */}
      <div className="rounded-3xl bg-gradient-to-r from-nesty-burgundyDark via-nesty-burgundy to-nesty-burgundyLight border-[1.5px] border-nesty-gold p-6 text-nesty-cream shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold tracking-widest uppercase text-nesty-gold">
              <span>CAMPUS CANTEEN DINING</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold mt-1">
              Fresh Food & Beverages
            </h1>
            <p className="text-xs sm:text-sm text-nesty-cream/85 mt-0.5">
              Order fresh food online and collect directly at the canteen counter using your Order ID or Transaction ID.
            </p>
          </div>

          <div className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-nesty-cream/10 border border-nesty-gold/40 text-[11px] font-bold text-nesty-gold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live Counter Catalog</span>
          </div>
        </div>
      </div>

      {announcements.length > 0 && (
        <div className="rounded-2xl bg-nesty-goldLight border border-nesty-gold p-3.5 flex items-start gap-3">
          <Bell className="w-5 h-5 text-nesty-burgundy shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-extrabold text-nesty-burgundy">{announcements[0].title}: </span>
            <span className="text-nesty-textPrimary font-medium">{announcements[0].message}</span>
          </div>
        </div>
      )}

      {/* Active Orders Quick Access (No block names) */}
      {activeOrders.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-extrabold uppercase tracking-wider text-nesty-burgundy">
            ACTIVE PICKUP ORDERS ({activeOrders.length})
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {activeOrders.slice(0, 2).map((ord) => (
              <div
                key={ord.id}
                onClick={() => onOpenOrderDetails(ord)}
                data-testid={`active_order_banner_${ord.id}`}
                className="cursor-pointer rounded-2xl bg-nesty-creamSurface border-2 border-nesty-gold p-4 flex items-center justify-between gap-3 hover:shadow-md transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-nesty-burgundy text-nesty-cream text-xs font-extrabold">
                      #{ord.id}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-nesty-goldLight border border-nesty-gold text-[11px] font-extrabold text-nesty-burgundyDark">
                      Status: {ord.orderStatus}
                    </span>
                  </div>
                  <div className="text-xs font-mono font-bold text-nesty-textSecondary">
                    Txn ID: <span className="text-nesty-burgundy">{ord.transactionId}</span>
                  </div>
                </div>
                <span className="px-3 py-1.5 rounded-xl bg-nesty-creamElevated border border-nesty-gold text-xs font-extrabold text-nesty-burgundy shrink-0">
                  View Receipt →
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Category Filter Bar */}
      <div className="bg-nesty-creamSurface border border-nesty-creamBorder rounded-2xl p-3.5 space-y-3 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-nesty-burgundy absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Samosa, Veg Puff, Chicken Puff..."
              data-testid="menu_search_input"
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-sm focus:outline-none focus:border-nesty-burgundy"
            />
          </div>

          <button
            type="button"
            onClick={() => setVegOnly(!vegOnly)}
            data-testid="veg_only_filter_chip"
            className={`px-4 py-2 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-2 transition ${
              vegOnly
                ? 'bg-nesty-success text-white border-nesty-success'
                : 'bg-nesty-creamElevated text-nesty-textPrimary border-nesty-creamBorder'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 border border-white" />
            <span>Veg Only</span>
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap border transition ${
                  active
                    ? 'bg-nesty-burgundy text-nesty-cream border-nesty-gold'
                    : 'bg-nesty-cream text-nesty-textSecondary border-nesty-creamBorder hover:text-nesty-burgundy'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Product Cards Grid */}
      {filteredItems.length === 0 ? (
        <div className="rounded-3xl bg-nesty-creamSurface border border-nesty-creamBorder p-12 text-center">
          <p className="text-base font-extrabold text-nesty-burgundy">
            No matching canteen items found
          </p>
          <p className="text-xs text-nesty-textSecondary mt-1">
            Try clearing your search filter or switching categories.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item, idx) => {
            const qty = cartQuantities[item.id] || 0;
            const isAboveFold = idx < 3;
            const webpUrl = resolveFoodImageUrl(item.image);
            const jpgFallback = item.fallbackImage || webpUrl.replace(/\.webp$/, '.jpg');
            return (
              <div
                key={item.id}
                data-testid={`menu_item_card_${item.id}`}
                className={`rounded-3xl bg-nesty-creamSurface border-[1.5px] overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between ${
                  item.isAvailable
                    ? 'border-nesty-gold/70'
                    : 'border-nesty-creamBorder opacity-75'
                }`}
              >
                <div>
                  <div className="relative aspect-[4/3] w-full bg-nesty-creamElevated overflow-hidden">
                    <picture>
                      <source srcSet={webpUrl} type="image/webp" />
                      <img
                        src={jpgFallback}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = '/images/samosa.webp';
                        }}
                        alt={item.name}
                        width={640}
                        height={480}
                        loading={isAboveFold ? 'eager' : 'lazy'}
                        fetchPriority={isAboveFold ? 'high' : 'low'}
                        decoding="async"
                        className="w-full h-full object-cover transition-opacity duration-300"
                      />
                    </picture>
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-nesty-creamSurface/95 border border-nesty-gold flex items-center gap-1.5 shadow-sm">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          item.isVeg ? 'bg-nesty-success' : 'bg-nesty-error'
                        }`}
                      />
                      <span className="text-[10px] font-extrabold uppercase text-nesty-textPrimary">
                        {item.isVeg ? 'VEG' : 'NON-VEG'}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-nesty-burgundy/90 text-nesty-cream border border-nesty-gold text-[10px] font-bold">
                      {item.category}
                    </div>

                    {!item.isAvailable && (
                      <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                        <span className="px-4 py-1.5 rounded-xl bg-nesty-error text-white font-extrabold text-xs uppercase tracking-wider">
                          Sold Out
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-extrabold text-nesty-textPrimary">
                        {item.name}
                      </h3>
                      <span className="text-base font-extrabold text-nesty-burgundy shrink-0">
                        ₹{item.price}
                      </span>
                    </div>
                    <p className="text-xs text-nesty-textSecondary mt-1 line-clamp-2">
                      {item.description || 'Fresh campus favorite snack.'}
                    </p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-1 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-nesty-textSecondary">
                    Per {item.unit || 'pcs'}
                  </span>

                  {!item.isAvailable ? (
                    <button
                      type="button"
                      disabled
                      className="px-4 py-2 rounded-xl bg-nesty-creamElevated text-nesty-textSecondary font-bold text-xs cursor-not-allowed"
                    >
                      Unavailable
                    </button>
                  ) : qty === 0 ? (
                    <button
                      type="button"
                      onClick={() => onAddToCart(item)}
                      data-testid={`add_to_cart_${item.id}`}
                      className="px-4 py-2 rounded-xl bg-nesty-burgundy text-nesty-cream border border-nesty-gold font-extrabold text-xs flex items-center gap-1.5 hover:bg-nesty-burgundyDark transition shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add to Cart</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2.5 bg-nesty-burgundy text-nesty-cream border border-nesty-gold rounded-xl px-2.5 py-1.5">
                      <button
                        type="button"
                        onClick={() => onUpdateCartQuantity(item.id, -1)}
                        data-testid={`dec_qty_${item.id}`}
                        className="p-0.5 hover:bg-nesty-burgundyDark rounded"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-extrabold w-4 text-center">{qty}</span>
                      <button
                        type="button"
                        onClick={() => onUpdateCartQuantity(item.id, 1)}
                        data-testid={`inc_qty_${item.id}`}
                        className="p-0.5 hover:bg-nesty-burgundyDark rounded"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Checkout Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-16 md:bottom-6 left-4 right-4 md:left-auto md:right-8 md:w-96 z-20">
          <button
            type="button"
            onClick={onOpenCart}
            data-testid="floating_checkout_bar"
            className="w-full p-4 rounded-2xl bg-nesty-burgundy text-nesty-cream border-2 border-nesty-gold shadow-2xl flex items-center justify-between hover:bg-nesty-burgundyDark transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-nesty-gold text-nesty-textPrimary font-extrabold text-xs flex items-center justify-center">
                {cartCount}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-nesty-gold">View Cart & Checkout</div>
                <div className="text-sm font-extrabold">Total: ₹{cartSubtotal}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-extrabold bg-nesty-cream text-nesty-burgundy px-3.5 py-2 rounded-xl">
              <ShoppingCart className="w-4 h-4" />
              <span>Checkout</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

interface OrderHistoryViewProps {
  orders: OrderRecord[];
  onOpenOrderDetails: (order: OrderRecord) => void;
}

export const StudentOrderHistoryView: React.FC<OrderHistoryViewProps> = ({
  orders,
  onOpenOrderDetails,
}) => {
  return (
    <div data-testid="student_order_history_screen" className="space-y-4 pb-24 md:pb-8">
      <div className="bg-nesty-creamSurface border border-nesty-gold rounded-3xl p-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-nesty-burgundy">Order History</h2>
          <p className="text-xs text-nesty-textSecondary mt-0.5">
            Track your canteen orders. Click any order to open and print your official bill/receipt.
          </p>
        </div>
        <Receipt className="w-8 h-8 text-nesty-goldDark shrink-0" />
      </div>

      {orders.length === 0 ? (
        <div className="bg-nesty-creamSurface border border-nesty-creamBorder rounded-3xl p-12 text-center">
          <Receipt className="w-12 h-12 text-nesty-goldDark mx-auto mb-2" />
          <h3 className="text-base font-extrabold text-nesty-burgundy">No orders placed yet</h3>
          <p className="text-xs text-nesty-textSecondary mt-1">
            Your confirmed canteen orders and pickup statuses will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isClaimed = order.orderStatus === 'CLAIMED';
            const isFailed = order.paymentStatus === 'FAILED';
            return (
              <div
                key={order.id}
                onClick={() => onOpenOrderDetails(order)}
                data-testid={`order_history_card_${order.id}`}
                className="cursor-pointer bg-nesty-creamSurface border-[1.5px] border-nesty-gold/80 rounded-3xl p-5 hover:shadow-md transition space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="px-3 py-1 rounded-xl bg-nesty-burgundy text-nesty-cream text-xs font-extrabold">
                      Order #{order.id}
                    </span>
                    {order.pickupToken && (
                      <span
                        data-testid={`student_order_token_${order.id}`}
                        className="px-3 py-1 rounded-xl bg-nesty-gold text-nesty-burgundyDark border border-nesty-burgundy text-xs font-black tracking-widest shadow-sm"
                      >
                        TOKEN: {order.pickupToken}
                      </span>
                    )}
                    <span className="px-2.5 py-1 rounded-xl bg-nesty-creamElevated border border-nesty-gold text-xs font-bold text-nesty-burgundy">
                      Canteen Counter Pickup
                    </span>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1 ${
                      isFailed
                        ? 'bg-nesty-errorBg text-nesty-error border border-nesty-error'
                        : isClaimed
                        ? 'bg-nesty-successBg text-nesty-success border border-nesty-success'
                        : 'bg-nesty-goldLight text-nesty-burgundyDark border border-nesty-gold'
                    }`}
                  >
                    {isFailed ? (
                      <XCircle className="w-3.5 h-3.5" />
                    ) : isClaimed ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                    <span>{order.orderStatus}</span>
                  </span>
                </div>

                <div className="text-sm font-bold text-nesty-textPrimary">
                  {order.items.map((it) => `${it.quantity}x ${it.name}`).join(', ')}
                </div>

                <div className="pt-2 border-t border-nesty-creamBorder flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="font-mono text-nesty-textSecondary">
                    Transaction ID:{' '}
                    <span className="font-extrabold text-nesty-burgundy">
                      {order.transactionId}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-nesty-textSecondary">
                      {order.createdAt.replace('T', ' ').slice(0, 16)}
                    </span>
                    <span className="text-base font-extrabold text-nesty-burgundy">
                      ₹{order.finalAmount}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface PaymentHistoryViewProps {
  payments: PaymentRecord[];
  orders: OrderRecord[];
  onOpenOrderDetails: (order: OrderRecord) => void;
}

export const StudentPaymentHistoryView: React.FC<PaymentHistoryViewProps> = ({
  payments,
  orders,
  onOpenOrderDetails,
}) => {
  return (
    <div data-testid="student_payment_history_screen" className="space-y-4 pb-24 md:pb-8">
      <div className="bg-nesty-creamSurface border border-nesty-gold rounded-3xl p-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-nesty-burgundy">Payment History</h2>
          <p className="text-xs text-nesty-textSecondary mt-0.5">
            Verified ledger of your Razorpay transactions. Click any payment to view and download your receipt.
          </p>
        </div>
        <CreditCard className="w-8 h-8 text-nesty-goldDark shrink-0" />
      </div>

      {payments.length === 0 ? (
        <div className="bg-nesty-creamSurface border border-nesty-creamBorder rounded-3xl p-12 text-center">
          <CreditCard className="w-12 h-12 text-nesty-goldDark mx-auto mb-2" />
          <h3 className="text-base font-extrabold text-nesty-burgundy">No payment records yet</h3>
          <p className="text-xs text-nesty-textSecondary mt-1">
            Completed online and UPI transactions will be archived here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map((pmt) => {
            const isPaid = pmt.status === 'PAID' || pmt.status === 'SUCCESS';
            const matchedOrder = orders.find(
              (o) => o.id === pmt.orderId || o.transactionId === pmt.transactionId
            );

            return (
              <div
                key={pmt.id}
                onClick={() => {
                  if (matchedOrder) {
                    onOpenOrderDetails(matchedOrder);
                  }
                }}
                data-testid={`payment_history_card_${pmt.id}`}
                className="cursor-pointer bg-nesty-creamSurface border-[1.5px] border-nesty-gold/80 rounded-3xl p-5 hover:shadow-md transition space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-nesty-textSecondary">
                      TRANSACTION ID
                    </div>
                    <div className="text-sm font-mono font-extrabold text-nesty-burgundy">
                      {pmt.transactionId}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-xl text-xs font-extrabold ${
                        isPaid
                          ? 'bg-nesty-successBg text-nesty-success border border-nesty-success'
                          : 'bg-nesty-errorBg text-nesty-error border border-nesty-error'
                      }`}
                    >
                      {pmt.status}
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-nesty-creamElevated border border-nesty-gold text-xs font-bold text-nesty-burgundy">
                      Receipt →
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-nesty-creamBorder text-xs">
                  <div>
                    <span className="text-nesty-textSecondary block">Order Reference</span>
                    <span className="font-bold text-nesty-textPrimary">#{pmt.orderId}</span>
                  </div>
                  <div>
                    <span className="text-nesty-textSecondary block">Payment Method</span>
                    <span className="font-bold text-nesty-textPrimary">{pmt.paymentMethod}</span>
                  </div>
                  <div>
                    <span className="text-nesty-textSecondary block">Date & Time</span>
                    <span className="text-nesty-textPrimary font-medium">
                      {pmt.createdAt.replace('T', ' ').slice(0, 16)}
                    </span>
                  </div>
                  <div>
                    <span className="text-nesty-textSecondary block">Amount Paid</span>
                    <span className="text-sm font-extrabold text-nesty-burgundy">
                      ₹{pmt.amount}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface StudentProfileViewProps {
  user: UserAccount;
  onUpdateProfile: (
    name: string,
    phone: string,
    rollNo: string,
    newPassword?: string
  ) => void;
  onSignOut: () => void;
}

export const StudentProfileView: React.FC<StudentProfileViewProps> = ({
  user,
  onUpdateProfile,
  onSignOut,
}) => {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [rollNo, setRollNo] = useState(user.rollNo);

  // Change Password OTP State (Requirement #2.B)
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [changeOtp, setChangeOtp] = useState('');
  const [changeNewPassword, setChangeNewPassword] = useState('');
  const [changeConfirmPassword, setChangeConfirmPassword] = useState('');
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [changeSuccess, setChangeSuccess] = useState<string | null>(null);
  const [changeCooldown, setChangeCooldown] = useState(0);

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (changeCooldown > 0) {
      timer = setInterval(() => {
        setChangeCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [changeCooldown]);

  const handleInitiateChangePassword = async () => {
    setChangeError(null);
    setChangeSuccess(null);
    setChangeLoading(true);
    try {
      const token = localStorage.getItem('nesty_web_auth_token') || '';
      const res = await fetch('/api/auth/change-password/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setChangeError(data.message || 'Failed to dispatch verification code to your college email.');
      } else {
        setShowChangeModal(true);
        setChangeCooldown(60);
        setChangeOtp('');
        setChangeNewPassword('');
        setChangeConfirmPassword('');
        setChangeSuccess(data.message || 'Verification code sent to your registered college email.');
      }
    } catch {
      setChangeError('Network error connecting to verification service.');
    } finally {
      setChangeLoading(false);
    }
  };

  const handleVerifyAndUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeError(null);
    setChangeSuccess(null);

    if (!changeOtp.trim()) {
      setChangeError('Invalid OTP');
      return;
    }

    if (changeNewPassword.length < 6) {
      setChangeError('New password must be at least 6 characters.');
      return;
    }

    if (changeNewPassword !== changeConfirmPassword) {
      setChangeError('New password and confirmation do not match.');
      return;
    }

    setChangeLoading(true);
    try {
      const token = localStorage.getItem('nesty_web_auth_token') || '';
      const res = await fetch('/api/auth/change-password/verify-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          otp: changeOtp.trim(),
          newPassword: changeNewPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        // Display exact server messages: 'Invalid OTP' or 'OTP expired. Please request a new OTP.'
        setChangeError(data.message || 'Invalid OTP');
      } else {
        setChangeSuccess('Password updated successfully!');
        setTimeout(() => {
          setShowChangeModal(false);
          setChangeOtp('');
          setChangeNewPassword('');
          setChangeConfirmPassword('');
          setChangeSuccess(null);
        }, 1500);
      }
    } catch {
      setChangeError('Network error updating password.');
    } finally {
      setChangeLoading(false);
    }
  };

  return (
    <div data-testid="student_profile_screen" className="max-w-2xl mx-auto space-y-5 pb-24 md:pb-8">
      {/* Student Profile Card (No block, No coins) */}
      <div className="bg-nesty-creamSurface border-[1.5px] border-nesty-gold rounded-3xl p-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-nesty-burgundy text-nesty-cream border-2 border-nesty-gold flex items-center justify-center text-2xl font-extrabold shadow-md">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-nesty-burgundy">{user.name}</h2>
            <p className="text-xs text-nesty-textSecondary">{user.email}</p>
            <span className="inline-block mt-1 px-2.5 py-0.5 rounded-lg bg-nesty-goldLight border border-nesty-gold text-[11px] font-extrabold text-nesty-burgundyDark">
              Roll No: {user.rollNo || 'Student'}
            </span>
          </div>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onUpdateProfile(name, phone, rollNo);
        }}
        className="bg-nesty-creamSurface border border-nesty-creamBorder rounded-3xl p-6 space-y-5 shadow-sm"
      >
        <div className="flex items-center gap-2 text-nesty-burgundy">
          <User className="w-5 h-5" />
          <h3 className="text-base font-extrabold">Edit Student Details</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-nesty-textPrimary mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-sm focus:outline-none focus:border-nesty-burgundy"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
              Roll Number
            </label>
            <input
              type="text"
              value={rollNo}
              onChange={(e) => setRollNo(e.target.value.toUpperCase())}
              className="w-full px-3.5 py-2.5 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-sm focus:outline-none focus:border-nesty-burgundy"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-sm focus:outline-none focus:border-nesty-burgundy"
            />
          </div>
        </div>

        {/* Change Password Section (Requirement #2.B: Exact 'Change Password' text & button) */}
        <div className="pt-4 border-t border-nesty-creamBorder">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="block text-xs font-bold text-nesty-textPrimary mb-0.5">
                Change Password
              </label>
              <p className="text-xs text-nesty-textSecondary">
                Requires one-time verification code delivered to your registered college email ({user.email}).
              </p>
            </div>
            <button
              type="button"
              onClick={handleInitiateChangePassword}
              disabled={changeLoading}
              data-testid="initiate_change_password_button"
              className="px-4 py-2.5 rounded-xl border border-nesty-gold bg-nesty-gold/20 text-nesty-burgundy font-extrabold text-xs hover:bg-nesty-gold/30 transition self-start sm:self-auto disabled:opacity-50"
            >
              {changeLoading ? 'Requesting Code...' : 'Change Password'}
            </button>
          </div>
          {changeError && !showChangeModal && (
            <div className="mt-2 text-xs text-nesty-error flex items-center gap-1 font-semibold">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{changeError}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="submit"
            data-testid="save_profile_button"
            className="px-6 py-2.5 rounded-xl bg-nesty-burgundy text-nesty-cream font-extrabold text-xs hover:bg-nesty-burgundyDark transition"
          >
            Save Profile Changes
          </button>

          <button
            type="button"
            onClick={onSignOut}
            data-testid="profile_sign_out_button"
            className="px-5 py-2.5 rounded-xl border border-nesty-error bg-nesty-errorBg text-nesty-error font-extrabold text-xs flex items-center gap-1.5 hover:bg-nesty-error hover:text-white transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of NESTY</span>
          </button>
        </div>
      </form>

      {/* Change Password OTP Verification Dialog (Requirement #2.B) */}
      {showChangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-nesty-textPrimary/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-nesty-creamSurface border-[1.5px] border-nesty-gold rounded-3xl shadow-2xl p-6">
            <div className="flex items-start justify-between pb-3 border-b border-nesty-creamBorder">
              <div className="flex items-center gap-2 text-nesty-burgundy">
                <KeyRound className="w-5 h-5 text-nesty-gold" />
                <h3 className="text-lg font-extrabold">Change Password</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowChangeModal(false)}
                className="text-nesty-textSecondary hover:text-nesty-burgundy p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-nesty-textSecondary mt-3">
              Enter the 6-digit verification code sent to <strong>{user.email}</strong>, then set your new password.
            </p>

            {changeError && (
              <div className="mt-3 p-3 rounded-xl bg-nesty-errorBg border border-nesty-error text-nesty-error text-xs flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{changeError}</span>
              </div>
            )}

            {changeSuccess && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                <span>{changeSuccess}</span>
              </div>
            )}

            <form onSubmit={handleVerifyAndUpdatePassword} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={changeOtp}
                  onChange={(e) => setChangeOtp(e.target.value)}
                  placeholder="e.g. 123456"
                  required
                  data-testid="change_password_otp_input"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-sm font-mono tracking-widest text-center focus:outline-none focus:border-nesty-burgundy"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={changeNewPassword}
                  onChange={(e) => setChangeNewPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  minLength={6}
                  data-testid="change_password_new_input"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-sm focus:outline-none focus:border-nesty-burgundy"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={changeConfirmPassword}
                  onChange={(e) => setChangeConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  minLength={6}
                  data-testid="change_password_confirm_input"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-sm focus:outline-none focus:border-nesty-burgundy"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleInitiateChangePassword}
                  disabled={changeCooldown > 0 || changeLoading}
                  className="text-xs font-extrabold text-nesty-burgundy hover:underline disabled:text-stone-400"
                >
                  {changeCooldown > 0 ? `Resend code in ${changeCooldown}s` : 'Resend Code'}
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowChangeModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={changeLoading}
                    data-testid="confirm_change_password_button"
                    className="px-5 py-2 rounded-xl text-xs font-extrabold bg-nesty-burgundy text-nesty-cream hover:bg-nesty-burgundyDark transition shadow disabled:opacity-50"
                  >
                    {changeLoading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
