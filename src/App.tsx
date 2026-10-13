import React, { useCallback, useEffect, useState } from 'react';
import {
  AnnouncementRecord,
  CouponRecord,
  MenuItem,
  OrderItem,
  OrderRecord,
  PaymentRecord,
  QrValidationResult,
  UserAccount,
} from './types';
import { NestySplashOverlay } from './components/NestySplashOverlay';
import { AuthScreen, persistStudentToVault } from './components/AuthScreen';
import {
  NestyTopHeader,
  StudentDestination,
  StudentSidebarNav,
} from './components/NestyNavigation';
import {
  StudentMenuView,
  StudentOrderHistoryView,
  StudentPaymentHistoryView,
  StudentProfileView,
} from './components/StudentViews';
import { AdminDashboardView } from './components/AdminDashboardView';
import { CartCheckoutDrawer } from './components/CartCheckoutDrawer';
import { OrderReceiptModal } from './components/OrderReceiptModal';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const SESSION_TOKEN_KEY = 'nesty_web_auth_token';
const SESSION_USER_KEY = 'nesty_web_auth_user';
const SPLASH_SEEN_KEY = 'nesty_web_splash_played';

export const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(SPLASH_SEEN_KEY) !== 'true';
    } catch {
      return true;
    }
  });

  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_TOKEN_KEY);
    } catch {
      return null;
    }
  });

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const raw = localStorage.getItem(SESSION_USER_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as UserAccount;
      if ((parsed.role as string).toLowerCase() === 'vendor') return null;
      return parsed;
    } catch {
      return null;
    }
  });

  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [students, setStudents] = useState<UserAccount[]>([]);
  const [coupons, setCoupons] = useState<CouponRecord[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);

  const [studentDestination, setStudentDestination] = useState<StudentDestination>('MENU');
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});
  const [appliedCoupon, setAppliedCoupon] = useState<CouponRecord | null>(null);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [paymentErrorAlert, setPaymentErrorAlert] = useState<string | null>(null);

  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<OrderRecord | null>(null);

  const [toast, setToast] = useState<{ text: string; isError?: boolean } | null>(null);

  const showToast = useCallback((text: string, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 3800);
  }, []);

  const authHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    if (currentUser) {
      headers['x-user-email'] = currentUser.email;
      headers['x-user-role'] = currentUser.role;
      if (currentUser.role === 'admin') {
        headers['x-admin-email'] = currentUser.email;
        headers['x-admin-role'] = 'admin';
      }
    }
    return headers;
  }, [authToken, currentUser]);

  const saveSession = (token: string | null, user: UserAccount | null) => {
    setAuthToken(token);
    setCurrentUser(user);
    try {
      if (token && user) {
        localStorage.setItem(SESSION_TOKEN_KEY, token);
        localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
        if (user.role === 'student') {
          persistStudentToVault(user);
        }
      } else {
        localStorage.removeItem(SESSION_TOKEN_KEY);
        localStorage.removeItem(SESSION_USER_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  };

  const syncAllFromBackend = useCallback(async () => {
    try {
      const [menuRes, cpnRes, annRes] = await Promise.all([
        fetch('/api/menu'),
        fetch('/api/coupons'),
        fetch('/api/announcements/active'),
      ]);

      if (menuRes.ok) {
        const data = await menuRes.json();
        if (Array.isArray(data.items)) setMenuItems(data.items);
      }
      if (cpnRes.ok) {
        const data = await cpnRes.json();
        if (Array.isArray(data.coupons)) setCoupons(data.coupons);
      }
      if (annRes.ok) {
        const data = await annRes.json();
        if (Array.isArray(data.announcements)) setAnnouncements(data.announcements);
      }

      if (currentUser) {
        const ordUrl =
          currentUser.role === 'admin'
            ? '/api/admin/orders'
            : `/api/orders?email=${encodeURIComponent(currentUser.email)}`;
        const ordRes = await fetch(ordUrl, { headers: authHeaders() });
        if (ordRes.ok) {
          const data = await ordRes.json();
          if (Array.isArray(data.orders)) setOrders(data.orders);
        }

        const pmtUrl =
          currentUser.role === 'admin'
            ? '/api/payments'
            : `/api/payments?email=${encodeURIComponent(currentUser.email)}`;
        const pmtRes = await fetch(pmtUrl, { headers: authHeaders() });
        if (pmtRes.ok) {
          const data = await pmtRes.json();
          if (Array.isArray(data.payments)) setPayments(data.payments);
        }

        if (currentUser.role === 'admin') {
          const stuRes = await fetch('/api/admin/students', { headers: authHeaders() });
          if (stuRes.ok) {
            const data = await stuRes.json();
            if (Array.isArray(data.students)) setStudents(data.students);
          }
        }
      }
    } catch {
      // Silent retry
    }
  }, [currentUser, authHeaders]);

  useEffect(() => {
    syncAllFromBackend();
    // Auto-update student menu items and orders continuously (every 5 seconds)
    const interval = setInterval(() => {
      syncAllFromBackend();
    }, 5000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncAllFromBackend();
      }
    };

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [syncAllFromBackend]);

  // Unified Login Handler (Requirement #1 & #4)
  const handleLogin = async (identifier: string, password: string) => {
    setIsAuthLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || 'Invalid email or password.', true);
      } else {
        saveSession(data.token, data.user);
        setStudentDestination('MENU');
        showToast(`Welcome back, ${data.user.name}!`);
      }
    } catch {
      showToast('Unable to reach NESTY server. Please check connection.', true);
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Student Registration without pickup block (Requirement #3)
  const handleRegisterStudent = async (
    email: string,
    password: string,
    name: string,
    phone: string,
    rollNo: string
  ) => {
    setIsAuthLoading(true);
    try {
      const res = await fetch('/api/auth/register-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, phone, rollNo }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        showToast(data.message || 'Registration failed.', true);
      } else {
        saveSession(data.token, data.user);
        setStudentDestination('MENU');
        showToast(data.message || 'Student account created!');
      }
    } catch {
      showToast('Unable to complete registration right now.', true);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleUpdateProfile = async (
    name: string,
    phone: string,
    rollNo: string,
    newPassword?: string
  ) => {
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ name, phone, rollNo, newPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        saveSession(authToken, data.user);
        showToast('Profile updated!');
      } else {
        showToast(data.message || 'Could not update profile.', true);
      }
    } catch {
      showToast('Network error updating profile.', true);
    }
  };

  const handleSignOut = () => {
    saveSession(null, null);
    setCartQuantities({});
    setAppliedCoupon(null);
    setIsCartOpen(false);
    showToast('Signed out of NESTY.');
  };

  const handleAddToCart = (item: MenuItem) => {
    if (!item.isAvailable) {
      showToast(`${item.name} is currently out of stock.`, true);
      return;
    }
    setCartQuantities((prev) => ({
      ...prev,
      [item.id]: (prev[item.id] || 0) + 1,
    }));
    showToast(`Added ${item.name} to cart`);
  };

  const handleUpdateCartQty = (itemId: string, delta: number) => {
    setCartQuantities((prev) => {
      const next = (prev[itemId] || 0) + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: next };
    });
  };

  const handleApplyCoupon = (code: string) => {
    const clean = code.trim().toUpperCase();
    const match = coupons.find((c) => c.code.toUpperCase() === clean);
    if (!match) {
      showToast(`Invalid coupon code "${clean}"`, true);
      return;
    }
    const subtotal = Object.entries(cartQuantities).reduce((sum, [id, qty]) => {
      const it = menuItems.find((m) => m.id === id);
      return sum + (it ? it.price * qty : 0);
    }, 0);
    if (subtotal < match.minOrderAmount) {
      showToast(`Minimum order of ₹${match.minOrderAmount} required for coupon ${match.code}`, true);
      return;
    }
    setAppliedCoupon(match);
    showToast(`Coupon ${match.code} applied!`);
  };

  // Verified Payment Success Callback (Requirement #5)
  const handleVerifiedPaymentSuccess = async (
    paymentMethod: string,
    transactionId: string,
    razorpayOrderId?: string
  ) => {
    if (!currentUser) return;

    setCartQuantities({});
    setAppliedCoupon(null);
    setIsCartOpen(false);
    setPaymentErrorAlert(null);

    await syncAllFromBackend();

    // Look for confirmed order
    const ordUrl = `/api/orders?email=${encodeURIComponent(currentUser.email)}`;
    const res = await fetch(ordUrl, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.orders)) {
        setOrders(data.orders);
        const match = data.orders.find((o: OrderRecord) => o.transactionId === transactionId) || data.orders[0];
        if (match) setSelectedReceiptOrder(match);
      }
    }

    showToast(`Payment confirmed! Transaction ID: ${transactionId}`);
  };

  const handlePaymentFailed = async (paymentMethod: string, reason: string) => {
    if (!currentUser) return;
    setPaymentErrorAlert(`Payment failed or cancelled (${paymentMethod}): ${reason}`);

    try {
      const orderItems: OrderItem[] = Object.entries(cartQuantities)
        .map(([id, quantity]) => {
          const m = menuItems.find((it) => it.id === id);
          return m && quantity > 0
            ? { id: m.id, name: m.name, price: m.price, quantity, isVeg: m.isVeg }
            : null;
        })
        .filter((x): x is OrderItem => x !== null);

      const subtotal = orderItems.reduce((sum, it) => sum + it.price * it.quantity, 0);

      await fetch('/api/payment-failed', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          studentEmail: currentUser.email,
          studentName: currentUser.name,
          studentPhone: currentUser.phone,
          items: orderItems,
          amount: subtotal,
          paymentMethod,
          error: { description: reason },
        }),
      });
      await syncAllFromBackend();
    } catch {
      // Keep error alert visible
    }
  };



  const handleAdminSaveProduct = async (product: {
    existingId?: string;
    name: string;
    description: string;
    price: number;
    category: string;
    unit: string;
    isVeg: boolean;
    image: string;
    isAvailable: boolean;
    stockCount: number;
  }): Promise<boolean> => {
    try {
      const url = product.existingId
        ? `/api/admin/menu/${encodeURIComponent(product.existingId)}`
        : '/api/admin/menu';
      const method = product.existingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(product),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (Array.isArray(data.items)) {
          setMenuItems(data.items);
        } else {
          await syncAllFromBackend();
        }
        showToast(data.message || 'Product saved to NESTY catalog!');
        return true;
      } else {
        showToast(data.message || 'Failed to save product.', true);
        return false;
      }
    } catch {
      showToast('Server error while saving product.', true);
      return false;
    }
  };

  const handleAdminToggleAvailability = async (item: MenuItem) => {
    try {
      const res = await fetch(`/api/admin/menu/${encodeURIComponent(item.id)}/toggle`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await syncAllFromBackend();
        showToast(data.message || 'Updated stock availability');
      } else {
        showToast(data.message || 'Unauthorized', true);
      }
    } catch {
      showToast('Error toggling availability', true);
    }
  };

  const handleAdminDeleteProduct = async (item: MenuItem) => {
    try {
      const res = await fetch(`/api/admin/menu/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        await syncAllFromBackend();
        showToast(data.message || 'Product removed');
      } else {
        showToast(data.message || 'Failed to delete product', true);
      }
    } catch {
      showToast('Error deleting product', true);
    }
  };

  const handleAdminUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ orderStatus: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (selectedReceiptOrder?.id === orderId) {
          setSelectedReceiptOrder(data.order);
        }
        await syncAllFromBackend();
        showToast(data.message || `Order #${orderId} marked as ${newStatus}`);
      } else {
        showToast(data.message || 'Failed to update order status', true);
      }
    } catch {
      showToast('Error updating order status', true);
    }
  };

  const handleAdminCreateCoupon = async (
    code: string,
    discountPercent: number,
    maxDiscount: number,
    minOrderAmount: number
  ) => {
    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ code, discountPercent, maxDiscount, minOrderAmount }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      setCoupons(data.coupons);
      showToast(data.message || 'Coupon created!');
    } else {
      showToast(data.message || 'Failed to create coupon', true);
    }
  };

  const handleAdminDeleteCoupon = async (id: string) => {
    const res = await fetch(`/api/admin/coupons/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      setCoupons(data.coupons);
      showToast('Coupon deleted.');
    }
  };

  const handleAdminCreateAnnouncement = async (title: string, message: string) => {
    const res = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ title, message }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      setAnnouncements(data.announcements);
      showToast('Announcement published!');
    } else {
      showToast(data.message || 'Failed to publish announcement', true);
    }
  };

  const handleAdminDeleteAnnouncement = async (id: string) => {
    const res = await fetch(`/api/admin/announcements/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      setAnnouncements(data.announcements);
      showToast('Announcement deleted.');
    }
  };

  const totalCartItems = Object.values(cartQuantities).reduce((acc, q) => acc + q, 0);
  const activeOrders = orders.filter(
    (o) =>
      (o.paymentStatus === 'PAID' || o.paymentStatus === 'SUCCESS') &&
      o.orderStatus !== 'CLAIMED' &&
      o.orderStatus !== 'CANCELLED'
  );

  return (
    <div className="min-h-screen bg-nesty-cream text-nesty-textPrimary flex flex-col font-sans">
      {showSplash && (
        <NestySplashOverlay
          onFinished={() => {
            setShowSplash(false);
            try {
              sessionStorage.setItem(SPLASH_SEEN_KEY, 'true');
            } catch {
              // ignore
            }
          }}
        />
      )}

      {/* UNIFIED AUTHENTICATION (Requirement #4) */}
      {!currentUser ? (
        <AuthScreen
          isLoading={isAuthLoading}
          onLogin={handleLogin}
          onRegisterStudent={handleRegisterStudent}
          onSessionEstablished={(token, user) => {
            saveSession(token, user);
            setStudentDestination('MENU');
            showToast(`Welcome to NESTY, ${user.name}!`);
          }}
        />
      ) : (
        <>
          <NestyTopHeader
            user={currentUser}
            cartCount={totalCartItems}
            onOpenCart={() => setIsCartOpen(true)}
            onSignOut={handleSignOut}
          />

          {/* AUTOMATIC ROLE-BASED ROUTING: Admin Dashboard vs Student Interface (Requirement #4) */}
          {currentUser.role === 'admin' ? (
            <main className="flex-1">
              <AdminDashboardView
                adminUser={currentUser}
                menuItems={menuItems}
                orders={orders}
                students={students}
                coupons={coupons}
                announcements={announcements}
                onSaveProduct={handleAdminSaveProduct}
                onToggleAvailability={handleAdminToggleAvailability}
                onDeleteProduct={handleAdminDeleteProduct}
                onUpdateOrderStatus={handleAdminUpdateOrderStatus}
                onOpenOrderDetails={(ord) => setSelectedReceiptOrder(ord)}
                onCreateCoupon={handleAdminCreateCoupon}
                onDeleteCoupon={handleAdminDeleteCoupon}
                onCreateAnnouncement={handleAdminCreateAnnouncement}
                onDeleteAnnouncement={handleAdminDeleteAnnouncement}
                onRefreshAll={syncAllFromBackend}
              />
            </main>
          ) : (
            <div className="flex-1 flex max-w-7xl w-full mx-auto">
              <StudentSidebarNav
                currentDestination={studentDestination}
                onNavigate={setStudentDestination}
                onSignOut={handleSignOut}
              />

              <main className="flex-1 p-4 sm:p-6 min-w-0">
                {studentDestination === 'MENU' && (
                  <StudentMenuView
                    menuItems={menuItems}
                    announcements={announcements}
                    activeOrders={activeOrders}
                    cartQuantities={cartQuantities}
                    onAddToCart={handleAddToCart}
                    onUpdateCartQuantity={handleUpdateCartQty}
                    onOpenCart={() => setIsCartOpen(true)}
                    onOpenOrderDetails={(ord) => setSelectedReceiptOrder(ord)}
                    onRefreshMenu={syncAllFromBackend}
                  />
                )}

                {studentDestination === 'ORDER_HISTORY' && (
                  <StudentOrderHistoryView
                    orders={orders}
                    onOpenOrderDetails={(ord) => setSelectedReceiptOrder(ord)}
                  />
                )}

                {studentDestination === 'PAYMENT_HISTORY' && (
                  <StudentPaymentHistoryView
                    payments={payments}
                    orders={orders}
                    onOpenOrderDetails={(ord) => setSelectedReceiptOrder(ord)}
                  />
                )}

                {studentDestination === 'PROFILE' && (
                  <StudentProfileView
                    user={currentUser}
                    onUpdateProfile={handleUpdateProfile}
                    onSignOut={handleSignOut}
                  />
                )}
              </main>
            </div>
          )}

          <CartCheckoutDrawer
            isOpen={isCartOpen}
            user={currentUser}
            menuItems={menuItems}
            cartQuantities={cartQuantities}
            appliedCoupon={appliedCoupon}
            paymentErrorAlert={paymentErrorAlert}
            isProcessingPayment={isProcessingPayment}
            onUpdateQuantity={handleUpdateCartQty}
            onClearCart={() => setCartQuantities({})}
            onApplyCoupon={handleApplyCoupon}
            onClearCoupon={() => setAppliedCoupon(null)}
            onPaySuccess={handleVerifiedPaymentSuccess}
            onPayFailed={handlePaymentFailed}
            onClose={() => setIsCartOpen(false)}
          />

          <OrderReceiptModal
            order={selectedReceiptOrder}
            isAdmin={currentUser.role === 'admin'}
            onUpdateStatus={handleAdminUpdateOrderStatus}
            onClose={() => setSelectedReceiptOrder(null)}
          />
        </>
      )}

      {toast && (
        <div
          data-testid="toast_banner"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-xl border-2 flex items-center gap-2 text-xs font-extrabold transition-all bg-nesty-burgundy text-nesty-cream border-nesty-gold"
        >
          {toast.isError ? (
            <AlertCircle className="w-4 h-4 text-nesty-gold shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-nesty-gold shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
};
