import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  AnnouncementRecord,
  CouponRecord,
  MenuItem,
  OrderRecord,
  UserAccount,
  resolveFoodImageUrl,
  RevenueAnalyticsResponse,
  RevenueSummary,
  DailyRevenueReport,
  ProductSaleMetric,
  RevenueTransactionRecord,
} from '../types';
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  Edit3,
  Filter,
  Image,
  IndianRupee,
  PackagePlus,
  PieChart,
  Plus,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  ToggleLeft,
  ToggleRight,
  Trash2,
  TrendingUp,
  Users,
  UtensilsCrossed,
  X,
  XCircle,
} from 'lucide-react';

interface AdminDashboardViewProps {
  adminUser: UserAccount;
  menuItems: MenuItem[];
  orders: OrderRecord[];
  students: UserAccount[];
  coupons: CouponRecord[];
  announcements: AnnouncementRecord[];
  onSaveProduct: (product: {
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
  }) => Promise<boolean>;
  onToggleAvailability: (item: MenuItem) => void;
  onDeleteProduct: (item: MenuItem) => void;
  onUpdateOrderStatus: (orderId: string, newStatus: string) => void;
  onOpenOrderDetails: (order: OrderRecord) => void;
  onCreateCoupon: (
    code: string,
    discountPercent: number,
    maxDiscount: number,
    minOrderAmount: number
  ) => void;
  onDeleteCoupon: (id: string) => void;
  onCreateAnnouncement: (title: string, message: string) => void;
  onDeleteAnnouncement: (id: string) => void;
  onRefreshAll: () => void;
}

type AdminSection = 'PRODUCTS' | 'ORDERS' | 'REVENUE' | 'STUDENTS' | 'COUPONS' | 'ANNOUNCEMENTS' | 'AUDIT_LOGS';

const PRESET_PRODUCT_IMAGES = [
  { label: 'Samosa', url: '/images/samosa.webp' },
  { label: 'Veg Puff', url: '/images/veg-puff.webp' },
  { label: 'Egg Puff', url: '/images/egg-puff.webp' },
  { label: 'Chicken Puff', url: '/images/chicken-puff.webp' },
  {
    label: 'Masala Chai',
    url: 'https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?w=600&auto=format&fit=crop&q=80',
  },
];

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  adminUser,
  menuItems,
  orders,
  students,
  coupons,
  announcements,
  onSaveProduct,
  onToggleAvailability,
  onDeleteProduct,
  onUpdateOrderStatus,
  onOpenOrderDetails,
  onCreateCoupon,
  onDeleteCoupon,
  onCreateAnnouncement,
  onDeleteAnnouncement,
  onRefreshAll,
}) => {
  const [activeTab, setActiveTab] = useState<AdminSection>('PRODUCTS');

  // Product modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | undefined>(undefined);
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState('25');
  const [prodCategory, setProdCategory] = useState('Snacks');
  const [prodUnit, setProdUnit] = useState('pcs');
  const [prodIsVeg, setProdIsVeg] = useState(true);
  const [prodImage, setProdImage] = useState('/images/samosa.jpg');
  const [prodAvailable, setProdAvailable] = useState(true);
  const [prodStock, setProdStock] = useState('100');
  const [prodFormError, setProdFormError] = useState<string | null>(null);

  // Audit Logs State (Security Checklist Item #12)
  interface AuditLogEntry {
    id: string;
    timestamp: string;
    action: string;
    actorEmail: string;
    actorRole: string;
    targetType: string;
    targetId: string | null;
    details: Record<string, any>;
    ip?: string | null;
  }
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState('');

  const fetchAuditLogs = async (actionFilter = auditActionFilter) => {
    try {
      setLoadingAuditLogs(true);
      const token = localStorage.getItem('nesty_auth_token') || sessionStorage.getItem('nesty_auth_token') || '';
      const url = actionFilter
        ? `/api/admin/audit-logs?action=${encodeURIComponent(actionFilter)}&limit=100`
        : '/api/admin/audit-logs?limit=100';
      const res = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.auditLogs)) {
          setAuditLogs(data.auditLogs);
        }
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoadingAuditLogs(false);
    }
  };
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Orders filters state (Requirement #11)
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');

  // Coupons form
  const [cpnCode, setCpnCode] = useState('');
  const [cpnPercent, setCpnPercent] = useState('15');
  const [cpnMax, setCpnMax] = useState('30');
  const [cpnMin, setCpnMin] = useState('40');

  // Announcements form
  const [annTitle, setAnnTitle] = useState('');
  const [annMsg, setAnnMsg] = useState('');

  // Revenue Analytics state (Requirements #3, #4, #5, #6, #7, #9)
  const getTodayISTDate = () => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  };

  const [revenueData, setRevenueData] = useState<RevenueAnalyticsResponse | null>(null);
  const [revenueDate, setRevenueDate] = useState<string>(getTodayISTDate());
  const [revenueSearch, setRevenueSearch] = useState('');
  const [revenueStatusFilter, setRevenueStatusFilter] = useState('ALL');
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [revenueError, setRevenueError] = useState<string | null>(null);
  const [productRankingScope, setProductRankingScope] = useState<'SELECTED_DAY' | 'ALL_TIME'>('SELECTED_DAY');

  const fetchRevenueAnalytics = async (
    targetDate = revenueDate,
    targetSearch = revenueSearch,
    targetStatus = revenueStatusFilter
  ) => {
    setRevenueLoading(true);
    setRevenueError(null);
    try {
      const token =
        localStorage.getItem('nesty_web_auth_token') ||
        localStorage.getItem('nesty_auth_token') ||
        localStorage.getItem('nesty_session_token') ||
        '';
      const adminEmail = adminUser?.email || 'admin@cvr.ac.in';
      const params = new URLSearchParams();
      if (targetDate) params.set('date', targetDate);
      if (targetSearch) params.set('search', targetSearch);
      if (targetStatus && targetStatus !== 'ALL') params.set('status', targetStatus);

      const res = await fetch(`/api/admin/revenue/analytics?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          'x-admin-email': adminEmail,
          'x-admin-role': 'admin',
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to fetch revenue analytics (HTTP ${res.status})`);
      }

      const data: RevenueAnalyticsResponse = await res.json();
      setRevenueData(data);
    } catch (err: any) {
      setRevenueError(err.message || 'Error loading revenue analytics.');
    } finally {
      setRevenueLoading(false);
    }
  };

  // Immediate verified metrics calculated from persistent orders prop
  const fallbackSummary = useMemo(() => {
    const todayStr = getTodayISTDate();
    let todayRevenue = 0;
    let todayPaidCount = 0;
    let todayItemsCount = 0;
    let totalRevenue = 0;
    let totalPaidCount = 0;
    let totalItemsCount = 0;

    for (const o of orders || []) {
      const isPaid =
        (o.paymentStatus || '').toUpperCase() === 'PAID' ||
        (o.paymentStatus || '').toUpperCase() === 'SUCCESS';
      if (!isPaid) continue;
      const amt = Number(o.finalAmount) || 0;
      const itemsCount = (o.items || []).reduce(
        (acc, it) => acc + (Number(it.quantity) || 1),
        0
      );
      totalRevenue += amt;
      totalPaidCount += 1;
      totalItemsCount += itemsCount;

      const ordDate = (o.createdAt || '').split('T')[0];
      if (ordDate === todayStr) {
        todayRevenue += amt;
        todayPaidCount += 1;
        todayItemsCount += itemsCount;
      }
    }

    return {
      todayRevenue,
      todayPaidCount,
      todayItemsCount,
      totalRevenue,
      totalPaidCount,
      totalItemsCount,
      totalOrders: (orders || []).length,
    };
  }, [orders]);

  const currentDayMetrics = useMemo(() => {
    if (revenueData?.selectedDayReport) {
      return revenueData.selectedDayReport;
    }
    const dayOrders = (orders || []).filter((o) => (o.createdAt || '').split('T')[0] === revenueDate);
    const paidOrders = dayOrders.filter(
      (o) => (o.paymentStatus || '').toUpperCase() === 'PAID' || (o.paymentStatus || '').toUpperCase() === 'SUCCESS'
    );
    const gross = paidOrders.reduce((sum, o) => sum + (Number(o.finalAmount) || 0), 0);
    const itemsCount = paidOrders.reduce(
      (sum, o) => sum + (o.items || []).reduce((acc, it) => acc + (Number(it.quantity) || 1), 0),
      0
    );

    return {
      date: revenueDate,
      formattedDate: revenueDate,
      grossRevenue: gross,
      refunds: 0,
      netRevenue: gross,
      successfulPaymentsCount: paidOrders.length,
      ordersPlacedCount: dayOrders.length,
      ordersPaidCount: paidOrders.length,
      productsSoldCount: itemsCount,
      productSalesBreakdown: [] as ProductSaleMetric[],
      transactions: [] as RevenueTransactionRecord[],
    };
  }, [revenueData, orders, revenueDate]);

  const activeTransactions = useMemo(() => {
    if (revenueData?.selectedDayReport?.transactions && revenueData.selectedDayReport.transactions.length > 0) {
      return revenueData.selectedDayReport.transactions;
    }
    const list: RevenueTransactionRecord[] = [];
    const searchLower = (revenueSearch || '').trim().toLowerCase();
    for (const o of orders || []) {
      const ordDate = (o.createdAt || '').split('T')[0];
      if (ordDate !== revenueDate && !searchLower) continue;
      const pmtStatus = (o.paymentStatus || 'PENDING').toUpperCase();
      if (revenueStatusFilter !== 'ALL' && pmtStatus !== revenueStatusFilter) continue;

      const items = (o.items || []).map((it) => ({
        name: it.name || it.id || 'Canteen Item',
        quantity: Number(it.quantity) || 1,
        price: Number(it.price) || 0,
        total: (Number(it.price) || 0) * (Number(it.quantity) || 1),
        isVeg: it.isVeg ?? true,
      }));

      const record: RevenueTransactionRecord = {
        paymentId: `pmt_${o.id}`,
        orderId: o.id,
        transactionId: o.transactionId || 'N/A',
        paymentMethod: o.paymentMethod || 'Razorpay Gateway',
        studentName: o.studentName || 'Student',
        studentEmail: o.studentEmail || '',
        studentIdentifier: `${o.studentName || 'Student'} (${o.studentEmail || ''})`,
        amount: Number(o.finalAmount) || 0,
        paymentStatus: pmtStatus,
        refundStatus: 'NONE',
        refundAmount: 0,
        netAmount: Number(o.finalAmount) || 0,
        paymentDate: o.createdAt || '',
        formattedPaymentTime: o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
        items,
        totalQuantity: items.reduce((acc, it) => acc + it.quantity, 0),
      };

      if (searchLower) {
        const haystack = [
          record.orderId,
          record.transactionId,
          record.studentName,
          record.studentEmail,
          ...record.items.map((it) => it.name),
        ].join(' ').toLowerCase();
        if (!haystack.includes(searchLower)) continue;
      }

      list.push(record);
    }
    return list;
  }, [revenueData, orders, revenueDate, revenueSearch, revenueStatusFilter]);

  useEffect(() => {
    if (activeTab === 'REVENUE') {
      fetchRevenueAnalytics();
    } else if (activeTab === 'AUDIT_LOGS') {
      fetchAuditLogs(auditActionFilter);
    }
  }, [activeTab, revenueDate, revenueStatusFilter, auditActionFilter]);

  const handleRevenueSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRevenueAnalytics(revenueDate, revenueSearch, revenueStatusFilter);
  };

  const navigateRevenueDate = (days: number) => {
    try {
      const parts = revenueDate.split('-').map(Number);
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        d.setDate(d.getDate() + days);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        setRevenueDate(`${y}-${m}-${day}`);
      }
    } catch {
      // ignore
    }
  };

  const openAddProductModal = () => {
    setEditingItemId(undefined);
    setProdName('');
    setProdDesc('');
    setProdPrice('25');
    setProdCategory('Snacks');
    setProdUnit('pcs');
    setProdIsVeg(true);
    setProdImage('/images/samosa.jpg');
    setProdAvailable(true);
    setProdStock('100');
    setProdFormError(null);
    setShowProductModal(true);
  };

  const openEditProductModal = (item: MenuItem) => {
    setEditingItemId(item.id);
    setProdName(item.name);
    setProdDesc(item.description);
    setProdPrice(String(item.price));
    setProdCategory(item.category);
    setProdUnit(item.unit);
    setProdIsVeg(item.isVeg);
    setProdImage(item.image);
    setProdAvailable(item.isAvailable);
    setProdStock(String(item.stockCount));
    setProdFormError(null);
    setShowProductModal(true);
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProdImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleProductFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProdFormError(null);

    const cleanName = prodName.trim();
    const numericPrice = Number(prodPrice);
    if (!cleanName) {
      setProdFormError('Product name is required.');
      return;
    }
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setProdFormError('Please enter a valid positive price in ₹.');
      return;
    }

    setIsSavingProduct(true);
    const ok = await onSaveProduct({
      existingId: editingItemId,
      name: cleanName,
      description: prodDesc.trim(),
      price: Math.round(numericPrice),
      category: prodCategory.trim() || 'Snacks',
      unit: prodUnit.trim() || 'pcs',
      isVeg: prodIsVeg,
      image: prodImage.trim() || '/images/samosa.jpg',
      isAvailable: prodAvailable,
      stockCount: Number(prodStock) || 100,
    });
    setIsSavingProduct(false);

    if (ok) {
      setShowProductModal(false);
    }
  };

  // Filter orders according to search & status selections (Requirement #8 & #11)
  const filteredOrders = orders.filter((order) => {
    const q = orderSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      order.id.toLowerCase().includes(q) ||
      (order.pickupToken && order.pickupToken.toLowerCase().includes(q)) ||
      order.studentName.toLowerCase().includes(q) ||
      order.studentEmail.toLowerCase().includes(q) ||
      order.transactionId.toLowerCase().includes(q);

    const matchesOrderStatus =
      orderStatusFilter === 'ALL' || order.orderStatus.toUpperCase() === orderStatusFilter;

    const matchesPaymentStatus =
      paymentStatusFilter === 'ALL' || order.paymentStatus.toUpperCase() === paymentStatusFilter;

    return matchesSearch && matchesOrderStatus && matchesPaymentStatus;
  });

  const paidOrders = orders.filter(
    (o) => o.paymentStatus === 'PAID' || o.paymentStatus === 'SUCCESS'
  );
  const totalRevenue = paidOrders.reduce((acc, o) => acc + o.finalAmount, 0);
  const pendingPickupCount = orders.filter(
    (o) => o.orderStatus !== 'CLAIMED' && o.orderStatus !== 'CANCELLED'
  ).length;

  return (
    <div data-testid="admin_dashboard_screen" className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Admin Command Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-nesty-burgundyDark via-nesty-burgundy to-nesty-burgundyLight border-2 border-nesty-gold p-6 text-nesty-cream shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-nesty-gold">
              NESTY CANTEEN CONTROL PANEL
            </span>
            <h1 className="text-2xl font-extrabold mt-1">Canteen Operations & Catalog</h1>
            <p className="text-xs sm:text-sm text-nesty-cream/85 mt-0.5">
              Authoritative management of products, all student orders, and canteen pickup tokens.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                onRefreshAll();
                if (activeTab === 'REVENUE') fetchRevenueAnalytics();
              }}
              data-testid="admin_refresh_button"
              className="px-4 py-2.5 rounded-2xl bg-nesty-cream/15 hover:bg-nesty-cream/25 border border-nesty-gold text-xs font-bold flex items-center gap-2 transition"
            >
              <RefreshCw className="w-4 h-4 text-nesty-gold" />
              <span>Sync All Data</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-nesty-gold/30">
          <div className="p-3 rounded-2xl bg-nesty-burgundyDark/60 border border-nesty-gold/40">
            <div className="text-[11px] font-bold text-nesty-gold uppercase">Verified Revenue</div>
            <div className="text-xl font-extrabold mt-0.5">₹{totalRevenue}</div>
          </div>
          <div className="p-3 rounded-2xl bg-nesty-burgundyDark/60 border border-nesty-gold/40">
            <div className="text-[11px] font-bold text-nesty-gold uppercase">Pending Orders</div>
            <div className="text-xl font-extrabold mt-0.5">{pendingPickupCount}</div>
          </div>
          <div className="p-3 rounded-2xl bg-nesty-burgundyDark/60 border border-nesty-gold/40">
            <div className="text-[11px] font-bold text-nesty-gold uppercase">Catalog Items</div>
            <div className="text-xl font-extrabold mt-0.5">{menuItems.length}</div>
          </div>
          <div className="p-3 rounded-2xl bg-nesty-burgundyDark/60 border border-nesty-gold/40">
            <div className="text-[11px] font-bold text-nesty-gold uppercase">Registered Students</div>
            <div className="text-xl font-extrabold mt-0.5">{students.length}</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Products, Orders, Revenue, Students, Coupons, Announcements) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          {
            id: 'PRODUCTS' as const,
            label: `Menu Products (${menuItems.length})`,
            icon: <UtensilsCrossed className="w-4 h-4" />,
            testId: 'admin_tab_products',
          },
          {
            id: 'ORDERS' as const,
            label: `All Orders (${orders.length})`,
            icon: <Receipt className="w-4 h-4" />,
            testId: 'admin_tab_orders',
          },
          {
            id: 'REVENUE' as const,
            label: 'Revenue',
            icon: <IndianRupee className="w-4 h-4" />,
            testId: 'admin_tab_revenue',
          },
          {
            id: 'STUDENTS' as const,
            label: `Students (${students.length})`,
            icon: <Users className="w-4 h-4" />,
            testId: 'admin_tab_students',
          },
          {
            id: 'COUPONS' as const,
            label: `Coupons (${coupons.length})`,
            icon: <Tag className="w-4 h-4" />,
            testId: 'admin_tab_coupons',
          },
          {
            id: 'ANNOUNCEMENTS' as const,
            label: `Announcements (${announcements.length})`,
            icon: <Bell className="w-4 h-4" />,
            testId: 'admin_tab_announcements',
          },
          {
            id: 'AUDIT_LOGS' as const,
            label: 'Audit Logs',
            icon: <ShieldCheck className="w-4 h-4" />,
            testId: 'admin_tab_audit_logs',
          },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              data-testid={tab.testId}
              className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 whitespace-nowrap border transition ${
                active
                  ? 'bg-nesty-burgundy text-nesty-cream border-nesty-gold shadow-sm'
                  : 'bg-nesty-creamSurface text-nesty-textSecondary border-nesty-creamBorder hover:text-nesty-burgundy'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SECTION 1: PRODUCTS CATALOG */}
      {activeTab === 'PRODUCTS' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-nesty-creamSurface border border-nesty-gold rounded-2xl p-4">
            <div>
              <h2 className="text-lg font-extrabold text-nesty-burgundy">
                Menu & Price Management
              </h2>
              <p className="text-xs text-nesty-textSecondary">
                Add canteen items, update pricing in INR, or toggle real-time stock availability.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddProductModal}
              data-testid="admin_secondary_add_product_button"
              className="px-4 py-2.5 rounded-xl bg-nesty-burgundy text-nesty-cream border border-nesty-gold font-extrabold text-xs flex items-center gap-1.5 hover:bg-nesty-burgundyDark transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Product</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {menuItems.map((item) => (
              <div
                key={item.id}
                data-testid={`admin_product_card_${item.id}`}
                className="bg-nesty-creamSurface border-[1.5px] border-nesty-gold/80 rounded-3xl overflow-hidden shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-40 bg-nesty-creamElevated">
                    <img
                      src={resolveFoodImageUrl(item.image)}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/images/samosa.jpg';
                      }}
                      alt={item.name}
                      loading="eager"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-nesty-creamSurface/95 border border-nesty-gold text-[10px] font-extrabold">
                      {item.isVeg ? '🟢 VEG' : '🔴 NON-VEG'}
                    </div>
                    <div
                      className={`absolute top-3 right-3 px-2.5 py-1 rounded-lg text-[10px] font-extrabold ${
                        item.isAvailable
                          ? 'bg-nesty-success text-white'
                          : 'bg-nesty-error text-white'
                      }`}
                    >
                      {item.isAvailable ? 'IN STOCK' : 'OUT OF STOCK'}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-extrabold text-nesty-textPrimary">
                          {item.name}
                        </h3>
                        <span className="text-[11px] font-bold text-nesty-goldDark">
                          {item.category} • {item.unit}
                        </span>
                      </div>
                      <span className="text-lg font-extrabold text-nesty-burgundy">
                        ₹{item.price}
                      </span>
                    </div>
                    <p className="text-xs text-nesty-textSecondary mt-1.5 line-clamp-2">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-nesty-creamBorder flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleAvailability(item)}
                    data-testid={`admin_toggle_avail_${item.id}`}
                    className="px-3 py-1.5 rounded-xl bg-nesty-creamElevated border border-nesty-gold text-xs font-bold text-nesty-burgundy flex items-center gap-1.5"
                  >
                    {item.isAvailable ? (
                      <ToggleRight className="w-4 h-4 text-nesty-success" />
                    ) : (
                      <ToggleLeft className="w-4 h-4 text-nesty-textSecondary" />
                    )}
                    <span>{item.isAvailable ? 'Available' : 'Sold Out'}</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditProductModal(item)}
                      data-testid={`admin_edit_product_${item.id}`}
                      className="p-2 rounded-xl bg-nesty-creamElevated text-nesty-burgundy hover:bg-nesty-goldLight border border-nesty-creamBorder"
                      title="Edit Product"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteProduct(item)}
                      data-testid={`admin_delete_product_${item.id}`}
                      className="p-2 rounded-xl bg-nesty-errorBg text-nesty-error hover:bg-nesty-error hover:text-white border border-nesty-error/30"
                      title="Delete Product"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 2: ALL ORDERS & MANAGEMENT (Requirement #11) */}
      {activeTab === 'ORDERS' && (
        <div className="space-y-4">
          {/* Orders Filter & Search Controls */}
          <div className="bg-nesty-creamSurface border border-nesty-gold rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-nesty-burgundy absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search by Order ID, Student Name, Email, or Transaction ID..."
                  data-testid="admin_order_search_input"
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-sm focus:outline-none focus:border-nesty-burgundy"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  data-testid="admin_order_status_filter"
                  className="px-3 py-2 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-xs font-bold text-nesty-textPrimary focus:outline-none"
                >
                  <option value="ALL">All Order Statuses</option>
                  <option value="PENDING_PICKUP">Pending Pickup</option>
                  <option value="PREPARING">Preparing</option>
                  <option value="READY">Ready</option>
                  <option value="CLAIMED">Claimed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>

                <select
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                  data-testid="admin_payment_status_filter"
                  className="px-3 py-2 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-xs font-bold text-nesty-textPrimary focus:outline-none"
                >
                  <option value="ALL">All Payment Statuses</option>
                  <option value="PAID">Paid Only</option>
                  <option value="FAILED">Failed / Cancelled</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-nesty-textSecondary pt-1">
              <span>
                Showing <strong>{filteredOrders.length}</strong> of {orders.length} campus orders
              </span>
              <button
                type="button"
                onClick={onRefreshAll}
                className="text-nesty-burgundy font-bold flex items-center gap-1 hover:underline"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh Orders
              </button>
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="bg-nesty-creamSurface border border-nesty-creamBorder rounded-3xl p-12 text-center">
              <Receipt className="w-12 h-12 text-nesty-goldDark mx-auto mb-2" />
              <h3 className="text-base font-extrabold text-nesty-burgundy">No orders matching criteria</h3>
              <p className="text-xs text-nesty-textSecondary mt-1">
                Try modifying your search term or clearing the status filters.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const isPaid = order.paymentStatus === 'PAID' || order.paymentStatus === 'SUCCESS';
                return (
                  <div
                    key={order.id}
                    data-testid={`admin_order_row_${order.id}`}
                    className="bg-nesty-creamSurface border-[1.5px] border-nesty-gold/80 rounded-3xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div
                      onClick={() => onOpenOrderDetails(order)}
                      className="cursor-pointer space-y-1.5 flex-1"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-3 py-1 rounded-xl bg-nesty-burgundy text-nesty-cream text-xs font-extrabold">
                          #{order.id}
                        </span>
                        {order.pickupToken && (
                          <span
                            data-testid={`admin_order_token_${order.id}`}
                            className="px-3 py-1 rounded-xl bg-nesty-gold text-nesty-burgundyDark border border-nesty-burgundy text-xs font-black tracking-widest shadow-sm"
                          >
                            TOKEN: {order.pickupToken}
                          </span>
                        )}
                        <span className="text-xs font-mono font-bold text-nesty-burgundy">
                          Txn: {order.transactionId}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold ${
                            isPaid
                              ? 'bg-nesty-successBg text-nesty-success border border-nesty-success'
                              : 'bg-nesty-errorBg text-nesty-error border border-nesty-error'
                          }`}
                        >
                          Payment: {order.paymentStatus}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-nesty-goldLight border border-nesty-gold text-[11px] font-extrabold text-nesty-burgundyDark">
                          Order: {order.orderStatus}
                        </span>
                      </div>

                      <div className="text-sm font-extrabold text-nesty-textPrimary">
                        {order.items.map((it) => `${it.quantity}x ${it.name}`).join(', ')} — Total: ₹
                        {order.finalAmount}
                      </div>

                      <div className="text-xs text-nesty-textSecondary flex flex-wrap items-center gap-2">
                        <span>
                          Student: <strong className="text-nesty-textPrimary">{order.studentName}</strong> (
                          {order.studentEmail})
                        </span>
                        <span>•</span>
                        <span>{order.createdAt.replace('T', ' ').slice(0, 16)}</span>
                        <span>•</span>
                        <span>{order.paymentMethod}</span>
                      </div>
                    </div>

                    {order.paymentStatus !== 'FAILED' && (
                      <div className="flex flex-wrap items-center gap-2">
                        {(['PREPARING', 'READY', 'CLAIMED'] as const).map((st) => {
                          const active = order.orderStatus === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => onUpdateOrderStatus(order.id, st)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition ${
                                active
                                  ? 'bg-nesty-gold text-nesty-textPrimary border-nesty-burgundy shadow-sm'
                                  : 'bg-nesty-creamElevated text-nesty-burgundy border-nesty-gold hover:bg-nesty-burgundy hover:text-nesty-cream'
                              }`}
                            >
                              {st}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => onOpenOrderDetails(order)}
                          className="px-3 py-1.5 rounded-xl bg-nesty-burgundy text-nesty-cream text-xs font-bold hover:bg-nesty-burgundyDark"
                        >
                          View Bill →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: REVENUE ANALYTICS (Requirements #3, #4, #5, #6, #7, #9) */}
      {activeTab === 'REVENUE' && (
        <div data-testid="admin_revenue_section" className="space-y-6">
          {/* Revenue Header & Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-nesty-creamSurface border border-nesty-gold rounded-3xl p-5 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-nesty-burgundy text-nesty-cream text-[10px] font-black uppercase tracking-wider">
                  Verified Audit
                </span>
                <span className="text-xs font-bold text-nesty-goldDark">
                  Timezone: Asia/Kolkata (IST GMT+5:30)
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-nesty-burgundy mt-1">
                Campus Revenue & Financial Analytics
              </h2>
              <p className="text-xs text-nesty-textSecondary mt-0.5">
                Authoritative financial reports computed exclusively from verified payment and order records in the persistent database.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fetchRevenueAnalytics()}
                disabled={revenueLoading}
                data-testid="admin_revenue_refresh_btn"
                className="px-4 py-2.5 rounded-xl bg-nesty-creamElevated hover:bg-nesty-cream border border-nesty-gold text-nesty-burgundy font-extrabold text-xs flex items-center gap-2 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${revenueLoading ? 'animate-spin' : ''}`} />
                <span>Refresh Audit</span>
              </button>
            </div>
          </div>

          {revenueError && (
            <div className="p-4 rounded-2xl bg-nesty-errorBg border border-nesty-error text-nesty-error flex items-center gap-3 text-xs font-bold">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{revenueError}</span>
            </div>
          )}

          {/* Top Summary Metrics Cards (Requirements #3, #7) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Today's Revenue */}
            <div
              data-testid="revenue_metric_today"
              className="p-5 rounded-3xl bg-nesty-creamSurface border-[1.5px] border-nesty-gold shadow-sm relative overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-nesty-textSecondary uppercase tracking-wider">
                    Today's Revenue
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-nesty-gold/20 flex items-center justify-center text-nesty-burgundy">
                    <IndianRupee className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-nesty-burgundy mt-2">
                  ₹{(revenueData ? revenueData.summary.todayRevenue : fallbackSummary.todayRevenue).toLocaleString('en-IN')}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-nesty-creamBorder flex items-center justify-between text-[11px] font-bold text-nesty-textSecondary">
                <span>{(revenueData ? revenueData.summary.todaySuccessfulPayments : fallbackSummary.todayPaidCount) || 0} successful txns</span>
                <span className="text-nesty-burgundy font-extrabold">
                  ₹{(revenueData ? revenueData.summary.todayNetRevenue : fallbackSummary.todayRevenue).toLocaleString('en-IN')} net
                </span>
              </div>
            </div>

            {/* Total Historical Revenue */}
            <div
              data-testid="revenue_metric_total"
              className="p-5 rounded-3xl bg-gradient-to-br from-nesty-burgundy to-nesty-burgundyDark text-nesty-cream border-2 border-nesty-gold shadow-md relative overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-nesty-gold uppercase tracking-wider">
                    Total Historical Revenue
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-nesty-gold/20 flex items-center justify-center text-nesty-gold">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white mt-2">
                  ₹{(revenueData ? revenueData.summary.totalHistoricalRevenue : fallbackSummary.totalRevenue).toLocaleString('en-IN')}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-nesty-gold/30 text-[11px] text-nesty-cream/80 truncate">
                {revenueData?.summary.timeRangeLabel || 'All available persistent records'}
              </div>
            </div>

            {/* Successful Payments & Orders */}
            <div
              data-testid="revenue_metric_payments"
              className="p-5 rounded-3xl bg-nesty-creamSurface border-[1.5px] border-nesty-gold shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-nesty-textSecondary uppercase tracking-wider">
                    Successful Payments
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-nesty-successBg flex items-center justify-center text-nesty-success">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-nesty-textPrimary mt-2">
                  {(revenueData ? revenueData.summary.totalSuccessfulPayments : fallbackSummary.totalPaidCount).toLocaleString('en-IN')}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-nesty-creamBorder flex items-center justify-between text-[11px] font-bold text-nesty-textSecondary">
                <span>Total Orders Placed</span>
                <span className="font-extrabold text-nesty-burgundy">
                  {revenueData ? revenueData.summary.totalOrders : fallbackSummary.totalOrders}
                </span>
              </div>
            </div>

            {/* Total Products Sold & Unpaid Audit */}
            <div
              data-testid="revenue_metric_products"
              className="p-5 rounded-3xl bg-nesty-creamSurface border-[1.5px] border-nesty-gold shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-nesty-textSecondary uppercase tracking-wider">
                    Products Sold
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-nesty-creamElevated flex items-center justify-center text-nesty-burgundy">
                    <UtensilsCrossed className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-nesty-textPrimary mt-2">
                  {(revenueData ? revenueData.summary.totalProductsSold : fallbackSummary.totalItemsCount).toLocaleString('en-IN')}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-nesty-creamBorder flex items-center justify-between text-[11px] font-bold">
                <span className="text-nesty-warning">
                  Pending: {revenueData?.summary.pendingPaymentsCount || 0}
                </span>
                <span className="text-nesty-error">
                  Failed: {revenueData?.summary.failedPaymentsCount || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Date Selection Bar & Quick Navigator (Requirement #4) */}
          <div className="bg-nesty-creamSurface border border-nesty-gold rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-nesty-burgundy flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-nesty-goldDark" />
                  <span>Inspect Day Audit & Date-Wise Report</span>
                </h3>
                <p className="text-xs text-nesty-textSecondary mt-0.5">
                  Select any calendar date to audit exact daily transactions, item quantities, and gross vs net revenue.
                </p>
              </div>

              {/* Date Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigateRevenueDate(-1)}
                  data-testid="revenue_prev_day_btn"
                  className="p-2.5 rounded-xl bg-nesty-creamElevated hover:bg-nesty-cream border border-nesty-creamBorder text-nesty-burgundy text-xs font-bold transition flex items-center gap-1"
                  title="Previous Day"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Prev Day</span>
                </button>

                <div className="relative">
                  <input
                    type="date"
                    value={revenueDate}
                    onChange={(e) => setRevenueDate(e.target.value)}
                    data-testid="revenue_date_picker"
                    className="px-3.5 py-2 rounded-xl bg-nesty-cream border-2 border-nesty-gold font-mono text-xs font-black text-nesty-burgundy outline-none focus:ring-2 focus:ring-nesty-gold"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => navigateRevenueDate(1)}
                  data-testid="revenue_next_day_btn"
                  className="p-2.5 rounded-xl bg-nesty-creamElevated hover:bg-nesty-cream border border-nesty-creamBorder text-nesty-burgundy text-xs font-bold transition flex items-center gap-1"
                  title="Next Day"
                >
                  <span className="hidden sm:inline">Next Day</span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setRevenueDate(getTodayISTDate())}
                  data-testid="revenue_today_btn"
                  className="px-3 py-2 rounded-xl bg-nesty-burgundy text-nesty-cream border border-nesty-gold text-xs font-extrabold hover:bg-nesty-burgundyDark transition"
                >
                  Today
                </button>
              </div>
            </div>

            {/* Quick Available Dates Badges */}
            {revenueData?.summary.availableDates && revenueData.summary.availableDates.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-nesty-creamBorder text-xs">
                <span className="text-[11px] font-bold text-nesty-textSecondary whitespace-nowrap">
                  Active Dates:
                </span>
                {revenueData.summary.availableDates.slice(0, 8).map((dStr) => {
                  const isCurrent = dStr === revenueDate;
                  return (
                    <button
                      key={dStr}
                      type="button"
                      onClick={() => setRevenueDate(dStr)}
                      className={`px-3 py-1 rounded-xl text-xs font-mono font-bold whitespace-nowrap border transition ${
                        isCurrent
                          ? 'bg-nesty-gold text-nesty-burgundyDark border-nesty-burgundy font-black shadow-sm'
                          : 'bg-nesty-creamElevated text-nesty-textSecondary border-nesty-creamBorder hover:text-nesty-burgundy'
                      }`}
                    >
                      {dStr} {dStr === revenueData.summary.todayDate ? '(Today)' : ''}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Day Report Metrics (Requirement #4) */}
          {(revenueData || currentDayMetrics) && (
            <div className="bg-nesty-creamSurface border border-nesty-gold rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-nesty-creamBorder pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-xl bg-nesty-gold text-nesty-burgundyDark font-black font-mono text-xs border border-nesty-goldDark">
                    DATE: {revenueData?.selectedDayReport?.date || currentDayMetrics.date}
                  </span>
                  <span className="text-xs font-bold text-nesty-textSecondary">
                    Daily Revenue Breakdown
                  </span>
                </div>
                <div className="text-sm font-extrabold text-nesty-burgundy">
                  Day Net Collected: ₹{(revenueData ? revenueData.selectedDayReport.netRevenue : currentDayMetrics.netRevenue).toLocaleString('en-IN')}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 rounded-2xl bg-nesty-creamElevated border border-nesty-creamBorder">
                  <div className="text-[11px] font-bold text-nesty-textSecondary">Day Gross Revenue</div>
                  <div className="text-lg font-black text-nesty-burgundy mt-0.5">
                    ₹{(revenueData ? revenueData.selectedDayReport.grossRevenue : currentDayMetrics.grossRevenue).toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-nesty-creamElevated border border-nesty-creamBorder">
                  <div className="text-[11px] font-bold text-nesty-textSecondary">Day Refunds Deducted</div>
                  <div className="text-lg font-black text-nesty-error mt-0.5">
                    ₹{(revenueData ? revenueData.selectedDayReport.refunds : currentDayMetrics.refunds).toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-nesty-creamElevated border border-nesty-creamBorder">
                  <div className="text-[11px] font-bold text-nesty-textSecondary">Day Net Revenue</div>
                  <div className="text-lg font-black text-nesty-success mt-0.5">
                    ₹{(revenueData ? revenueData.selectedDayReport.netRevenue : currentDayMetrics.netRevenue).toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-nesty-creamElevated border border-nesty-creamBorder">
                  <div className="text-[11px] font-bold text-nesty-textSecondary">Successful Payments</div>
                  <div className="text-lg font-black text-nesty-textPrimary mt-0.5">
                    {revenueData ? revenueData.selectedDayReport.successfulPaymentsCount : currentDayMetrics.successfulPaymentsCount}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-nesty-creamElevated border border-nesty-creamBorder">
                  <div className="text-[11px] font-bold text-nesty-textSecondary">Orders Placed / Paid</div>
                  <div className="text-lg font-black text-nesty-textPrimary mt-0.5">
                    {revenueData ? revenueData.selectedDayReport.ordersPlacedCount : currentDayMetrics.ordersPlacedCount} / {revenueData ? revenueData.selectedDayReport.ordersPaidCount : currentDayMetrics.ordersPaidCount}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-nesty-creamElevated border border-nesty-creamBorder">
                  <div className="text-[11px] font-bold text-nesty-textSecondary">Items Sold That Day</div>
                  <div className="text-lg font-black text-nesty-textPrimary mt-0.5">
                    {revenueData ? revenueData.selectedDayReport.productsSoldCount : currentDayMetrics.productsSoldCount} pcs
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Product-Wise Sales Analytics (Requirement #5) */}
          <div className="bg-nesty-creamSurface border border-nesty-gold rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-nesty-burgundy flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-nesty-goldDark" />
                  <span>Product-Wise Sales & Ranking Analytics</span>
                </h3>
                <p className="text-xs text-nesty-textSecondary mt-0.5">
                  Calculated from individual line items of verified orders. Multi-item orders attribute exact item prices and quantities.
                </p>
              </div>

              {/* Scope Switcher */}
              <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-nesty-creamElevated border border-nesty-gold">
                <button
                  type="button"
                  onClick={() => setProductRankingScope('SELECTED_DAY')}
                  data-testid="product_scope_day_btn"
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    productRankingScope === 'SELECTED_DAY'
                      ? 'bg-nesty-burgundy text-nesty-cream shadow-sm'
                      : 'text-nesty-textSecondary hover:text-nesty-burgundy'
                  }`}
                >
                  Selected Day ({revenueDate})
                </button>
                <button
                  type="button"
                  onClick={() => setProductRankingScope('ALL_TIME')}
                  data-testid="product_scope_alltime_btn"
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                    productRankingScope === 'ALL_TIME'
                      ? 'bg-nesty-burgundy text-nesty-cream shadow-sm'
                      : 'text-nesty-textSecondary hover:text-nesty-burgundy'
                  }`}
                >
                  All-Time Overview
                </button>
              </div>
            </div>

            {/* Product Sales Ranking Table */}
            {(() => {
              let metrics =
                productRankingScope === 'SELECTED_DAY'
                  ? revenueData?.selectedDayReport.productSalesBreakdown || []
                  : revenueData?.allTimeProductSales || [];

              if (metrics.length === 0 && orders && orders.length > 0) {
                const map = new Map<string, ProductSaleMetric>();
                for (const o of orders) {
                  const isPaid = (o.paymentStatus || '').toUpperCase() === 'PAID' || (o.paymentStatus || '').toUpperCase() === 'SUCCESS';
                  if (!isPaid) continue;
                  const ordDate = (o.createdAt || '').split('T')[0];
                  if (productRankingScope === 'SELECTED_DAY' && ordDate !== revenueDate) continue;
                  for (const it of o.items || []) {
                    const id = it.id || it.name || 'item';
                    const name = it.name || it.id || 'Canteen Item';
                    const q = Number(it.quantity) || 1;
                    const price = Number(it.price) || 0;
                    if (!map.has(id)) {
                      map.set(id, {
                        productId: id,
                        name,
                        quantitySold: 0,
                        ordersCount: 0,
                        totalSales: 0,
                        isVeg: it.isVeg ?? true,
                      });
                    }
                    const cur = map.get(id)!;
                    cur.quantitySold += q;
                    cur.ordersCount += 1;
                    cur.totalSales += (price * q) || Number(o.finalAmount) || 0;
                  }
                }
                metrics = Array.from(map.values()).sort((a, b) => b.totalSales - a.totalSales);
              }

              if (metrics.length === 0) {
                return (
                  <div className="p-8 text-center bg-nesty-creamElevated rounded-2xl border border-nesty-creamBorder">
                    <UtensilsCrossed className="w-8 h-8 text-nesty-goldDark mx-auto mb-2 opacity-60" />
                    <p className="text-sm font-extrabold text-nesty-burgundy">
                      No product sales recorded for {productRankingScope === 'SELECTED_DAY' ? revenueDate : 'this period'}
                    </p>
                    <p className="text-xs text-nesty-textSecondary mt-0.5">
                      Completed sales with verified payment status will automatically populate this ranking.
                    </p>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-nesty-gold/40 text-nesty-textSecondary font-black uppercase text-[10px]">
                        <th className="py-2.5 px-3">Rank</th>
                        <th className="py-2.5 px-3">Item Name</th>
                        <th className="py-2.5 px-3 text-center">Type</th>
                        <th className="py-2.5 px-3 text-right">Quantity Sold</th>
                        <th className="py-2.5 px-3 text-right">Orders Count</th>
                        <th className="py-2.5 px-3 text-right">Attributable Sales (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-nesty-creamBorder">
                      {metrics.map((pMetric, idx) => {
                        const isTop = idx === 0;
                        return (
                          <tr
                            key={pMetric.productId}
                            className={`hover:bg-nesty-creamElevated/60 transition ${
                              isTop ? 'bg-nesty-gold/10 font-bold' : ''
                            }`}
                          >
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[11px] font-black ${
                                  idx === 0
                                    ? 'bg-nesty-gold text-nesty-burgundyDark border border-nesty-goldDark'
                                    : idx === 1
                                    ? 'bg-nesty-creamElevated border border-nesty-creamBorder text-nesty-textPrimary'
                                    : 'text-nesty-textSecondary'
                                }`}
                              >
                                #{idx + 1}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-extrabold text-nesty-textPrimary">
                              {pMetric.name}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  pMetric.isVeg
                                    ? 'bg-nesty-successBg text-nesty-success border border-nesty-success/50'
                                    : 'bg-nesty-errorBg text-nesty-error border border-nesty-error/50'
                                }`}
                              >
                                {pMetric.isVeg ? 'VEG' : 'NON-VEG'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-black text-nesty-textPrimary">
                              {pMetric.quantitySold} pcs
                            </td>
                            <td className="py-3 px-3 text-right text-nesty-textSecondary">
                              {pMetric.ordersCount}
                            </td>
                            <td className="py-3 px-3 text-right font-black text-nesty-burgundy">
                              ₹{pMetric.totalSales.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>

          {/* Transaction Table & Search (Requirement #6) */}
          <div className="bg-nesty-creamSurface border border-nesty-gold rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-nesty-burgundy flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-nesty-goldDark" />
                  <span>Verified Payment Transactions Table</span>
                </h3>
                <p className="text-xs text-nesty-textSecondary mt-0.5">
                  Detailed payment records with order references, student identifiers, item breakdown, and refund statuses.
                </p>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-nesty-textSecondary">Status:</span>
                <select
                  value={revenueStatusFilter}
                  onChange={(e) => setRevenueStatusFilter(e.target.value)}
                  data-testid="revenue_status_filter"
                  className="px-3 py-1.5 rounded-xl bg-nesty-cream border border-nesty-gold text-xs font-bold text-nesty-burgundy outline-none"
                >
                  <option value="ALL">All Payment Statuses</option>
                  <option value="PAID">PAID / SUCCESS Only</option>
                  <option value="FAILED">FAILED Only</option>
                  <option value="PENDING">PENDING Only</option>
                </select>
              </div>
            </div>

            {/* Search Bar Form */}
            <form onSubmit={handleRevenueSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-nesty-goldDark" />
                <input
                  type="text"
                  value={revenueSearch}
                  onChange={(e) => setRevenueSearch(e.target.value)}
                  data-testid="revenue_search_input"
                  placeholder="Search by Order ID, Transaction ID, Student Name, Student Email, or Item Name..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-xs focus:ring-2 focus:ring-nesty-gold outline-none"
                />
              </div>
              <button
                type="submit"
                data-testid="revenue_search_btn"
                className="px-4 py-2 rounded-xl bg-nesty-burgundy text-nesty-cream font-extrabold text-xs hover:bg-nesty-burgundyDark transition"
              >
                Search
              </button>
              {revenueSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setRevenueSearch('');
                    fetchRevenueAnalytics(revenueDate, '', revenueStatusFilter);
                  }}
                  className="px-3 py-2 rounded-xl bg-nesty-creamElevated border border-nesty-creamBorder text-xs font-bold text-nesty-textSecondary hover:text-nesty-burgundy"
                >
                  Clear
                </button>
              )}
            </form>

            {/* Transactions Table Body */}
            {revenueLoading && activeTransactions.length === 0 ? (
              <div className="p-12 text-center text-xs text-nesty-textSecondary">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-nesty-burgundy" />
                <span>Loading verified transactions...</span>
              </div>
            ) : activeTransactions.length === 0 ? (
              <div className="p-10 text-center bg-nesty-creamElevated rounded-2xl border border-nesty-creamBorder">
                <Receipt className="w-8 h-8 text-nesty-goldDark mx-auto mb-2 opacity-60" />
                <p className="text-sm font-extrabold text-nesty-burgundy">
                  No payment transactions found for {revenueDate}
                </p>
                <p className="text-xs text-nesty-textSecondary mt-0.5">
                  Try selecting another date from the calendar or clearing your search filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setRevenueDate(getTodayISTDate());
                    setRevenueSearch('');
                    setRevenueStatusFilter('ALL');
                  }}
                  className="mt-3 px-4 py-2 rounded-xl bg-nesty-gold text-nesty-burgundyDark text-xs font-black hover:bg-nesty-goldLight transition inline-block"
                >
                  View Today's Transactions
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-nesty-gold/40 text-nesty-textSecondary font-black uppercase text-[10px]">
                      <th className="py-2.5 px-3">Date / Time (IST)</th>
                      <th className="py-2.5 px-3">Order ID</th>
                      <th className="py-2.5 px-3">Txn Reference</th>
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Items Purchased</th>
                      <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-nesty-creamBorder">
                    {activeTransactions.map((tx) => {
                      const isPaid = tx.paymentStatus === 'PAID' || tx.paymentStatus === 'SUCCESS';
                      return (
                        <tr
                          key={tx.paymentId || tx.transactionId || tx.orderId}
                          data-testid={`revenue_txn_row_${tx.orderId}`}
                          className="hover:bg-nesty-creamElevated/60 transition"
                        >
                          <td className="py-3 px-3 font-mono text-[11px] text-nesty-textSecondary whitespace-nowrap">
                            {tx.formattedPaymentTime || tx.paymentDate}
                          </td>
                          <td className="py-3 px-3 font-extrabold text-nesty-burgundy whitespace-nowrap">
                            #{tx.orderId}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-nesty-textPrimary whitespace-nowrap">
                            {tx.transactionId || 'N/A'}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-extrabold text-nesty-textPrimary">{tx.studentName}</div>
                            <div className="text-[10px] text-nesty-textSecondary">{tx.studentEmail}</div>
                          </td>
                          <td className="py-3 px-3 max-w-xs">
                            {tx.items && tx.items.length > 0 ? (
                              <div className="space-y-0.5">
                                {tx.items.map((it, itIdx) => (
                                  <div key={itIdx} className="text-[11px]">
                                    <span className="font-bold text-nesty-textPrimary">
                                      {it.quantity}x {it.name}
                                    </span>
                                    <span className="text-nesty-textSecondary"> (₹{it.total})</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-nesty-textSecondary italic">No items recorded</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <div className="font-black text-nesty-burgundy text-sm">
                              ₹{tx.amount.toLocaleString('en-IN')}
                            </div>
                            {tx.refundAmount > 0 && (
                              <div className="text-[10px] font-bold text-nesty-error">
                                -₹{tx.refundAmount} refunded
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                                isPaid
                                  ? 'bg-nesty-successBg text-nesty-success border border-nesty-success/50'
                                  : tx.paymentStatus === 'FAILED'
                                  ? 'bg-nesty-errorBg text-nesty-error border border-nesty-error/50'
                                  : 'bg-nesty-warningBg text-nesty-warning border border-nesty-warning/50'
                              }`}
                            >
                              {tx.paymentStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 4: STUDENTS LIST (No blocks, No coins) */}
      {activeTab === 'STUDENTS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((stu) => (
            <div
              key={stu.email}
              className="bg-nesty-creamSurface border border-nesty-gold rounded-2xl p-4 flex items-center justify-between"
            >
              <div>
                <div className="text-sm font-extrabold text-nesty-burgundy">{stu.name}</div>
                <div className="text-xs text-nesty-textSecondary">{stu.email}</div>
                <div className="text-[11px] font-semibold text-nesty-textPrimary mt-1">
                  Roll No: {stu.rollNo || 'N/A'} {stu.phone ? `• ${stu.phone}` : ''}
                </div>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-nesty-goldLight border border-nesty-gold text-xs font-extrabold text-nesty-burgundyDark">
                Student
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SECTION 5: COUPONS */}
      {activeTab === 'COUPONS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onCreateCoupon(
                cpnCode,
                Number(cpnPercent) || 10,
                Number(cpnMax) || 30,
                Number(cpnMin) || 30
              );
              setCpnCode('');
            }}
            className="bg-nesty-creamSurface border border-nesty-gold rounded-3xl p-5 space-y-3 h-fit"
          >
            <h3 className="text-base font-extrabold text-nesty-burgundy">Create Promo Coupon</h3>
            <div>
              <label className="block text-xs font-bold mb-1">Coupon Code</label>
              <input
                type="text"
                value={cpnCode}
                onChange={(e) => setCpnCode(e.target.value.toUpperCase())}
                placeholder="FEST25"
                required
                className="w-full px-3 py-2 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-xs"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-bold mb-1">Discount %</label>
                <input
                  type="number"
                  value={cpnPercent}
                  onChange={(e) => setCpnPercent(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1">Max ₹</label>
                <input
                  type="number"
                  value={cpnMax}
                  onChange={(e) => setCpnMax(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold mb-1">Min Bill ₹</label>
                <input
                  type="number"
                  value={cpnMin}
                  onChange={(e) => setCpnMin(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-xs"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-nesty-burgundy text-nesty-cream font-extrabold text-xs"
            >
              Add Coupon
            </button>
          </form>

          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {coupons.map((cpn) => (
              <div
                key={cpn.id}
                className="bg-nesty-creamSurface border border-nesty-gold rounded-2xl p-4 flex items-center justify-between"
              >
                <div>
                  <span className="px-2.5 py-1 rounded-lg bg-nesty-goldLight border border-nesty-gold text-xs font-extrabold text-nesty-burgundy">
                    {cpn.code}
                  </span>
                  <div className="text-xs font-bold text-nesty-textPrimary mt-2">
                    {cpn.discountPercent}% OFF up to ₹{cpn.maxDiscount}
                  </div>
                  <div className="text-[11px] text-nesty-textSecondary">
                    Min Order: ₹{cpn.minOrderAmount}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteCoupon(cpn.id)}
                  className="p-2 rounded-xl bg-nesty-errorBg text-nesty-error"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 6: ANNOUNCEMENTS */}
      {activeTab === 'ANNOUNCEMENTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onCreateAnnouncement(annTitle, annMsg);
              setAnnTitle('');
              setAnnMsg('');
            }}
            className="bg-nesty-creamSurface border border-nesty-gold rounded-3xl p-5 space-y-3 h-fit"
          >
            <h3 className="text-base font-extrabold text-nesty-burgundy">
              Broadcast Campus Announcement
            </h3>
            <div>
              <label className="block text-xs font-bold mb-1">Title</label>
              <input
                type="text"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="Hot Puffs Ready at Canteen"
                required
                className="w-full px-3 py-2 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Message</label>
              <textarea
                rows={3}
                value={annMsg}
                onChange={(e) => setAnnMsg(e.target.value)}
                placeholder="Fresh batch just arrived..."
                required
                className="w-full px-3 py-2 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-xs"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-nesty-burgundy text-nesty-cream font-extrabold text-xs"
            >
              Publish Announcement
            </button>
          </form>

          <div className="lg:col-span-2 space-y-3">
            {announcements.map((a) => (
              <div
                key={a.id}
                className="bg-nesty-creamSurface border border-nesty-gold rounded-2xl p-4 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-sm font-extrabold text-nesty-burgundy">{a.title}</div>
                  <div className="text-xs text-nesty-textPrimary mt-0.5">{a.message}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteAnnouncement(a.id)}
                  className="p-2 rounded-xl bg-nesty-errorBg text-nesty-error shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit Logs Section (Security Checklist Item #12) */}
      {activeTab === 'AUDIT_LOGS' && (
        <div className="space-y-6" data-testid="admin_audit_logs_panel">
          <div className="bg-nesty-creamSurface border border-nesty-creamBorder rounded-[28px] p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-nesty-burgundy" />
                  <h3 className="text-xl font-extrabold text-nesty-burgundy">Security & Operations Audit Trail</h3>
                </div>
                <p className="text-xs text-nesty-textSecondary mt-1">
                  Structured record of menu alterations, order status transitions, coupons, announcements, and webhook payments.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <select
                  value={auditActionFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAuditActionFilter(val);
                    fetchAuditLogs(val);
                  }}
                  className="px-3 py-2 rounded-xl bg-nesty-creamElevated border border-nesty-creamBorder text-xs font-bold text-nesty-burgundy focus:outline-none focus:border-nesty-gold"
                >
                  <option value="">All Actions</option>
                  <option value="MENU_ITEM_CREATED">Menu Created</option>
                  <option value="MENU_ITEM_UPDATED">Menu Updated</option>
                  <option value="MENU_ITEM_AVAILABILITY_TOGGLED">Stock Toggled</option>
                  <option value="MENU_ITEM_DELETED">Menu Deleted</option>
                  <option value="ORDER_STATUS_CHANGED">Order Status Changed</option>
                  <option value="PAYMENT_WEBHOOK_CONFIRMED">Webhook Payment Confirmed</option>
                  <option value="PAYMENT_WEBHOOK_FAILED">Webhook Payment Failed</option>
                  <option value="COUPON_CREATED">Coupon Created</option>
                  <option value="COUPON_DELETED">Coupon Deleted</option>
                  <option value="ANNOUNCEMENT_CREATED">Announcement Created</option>
                  <option value="ANNOUNCEMENT_DELETED">Announcement Deleted</option>
                </select>
                <button
                  type="button"
                  onClick={() => fetchAuditLogs(auditActionFilter)}
                  className="px-3 py-2 rounded-xl bg-nesty-burgundy text-nesty-cream text-xs font-bold flex items-center gap-1.5 hover:bg-nesty-burgundy/90 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAuditLogs ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {loadingAuditLogs ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <RefreshCw className="w-8 h-8 text-nesty-burgundy animate-spin mb-2" />
                <p className="text-xs font-bold text-nesty-textSecondary">Loading audit trail entries...</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="py-12 text-center">
                <ShieldCheck className="w-12 h-12 text-nesty-gold/40 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-nesty-burgundy">No Audit Logs Found</h4>
                <p className="text-xs text-nesty-textSecondary mt-0.5">
                  {auditActionFilter ? `No logs found matching "${auditActionFilter}".` : 'No admin modifications or webhooks recorded yet.'}
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-2.5">
                {auditLogs.map((log) => {
                  const dateStr = new Date(log.timestamp).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  let badgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
                  if (log.action.includes('CREATED') || log.action.includes('CONFIRMED')) {
                    badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                  } else if (log.action.includes('UPDATED') || log.action.includes('CHANGED') || log.action.includes('TOGGLED')) {
                    badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
                  } else if (log.action.includes('DELETED') || log.action.includes('FAILED')) {
                    badgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
                  }

                  return (
                    <div
                      key={log.id}
                      className="p-3.5 rounded-2xl bg-nesty-creamElevated border border-nesty-creamBorder flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${badgeColor}`}>
                            {log.action}
                          </span>
                          <span className="font-bold text-nesty-burgundy">
                            {log.targetType}{log.targetId ? ` #${log.targetId}` : ''}
                          </span>
                        </div>
                        <div className="text-nesty-textSecondary flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                          <span>By: <strong className="text-nesty-textPrimary font-semibold">{log.actorEmail}</strong> ({log.actorRole})</span>
                          {log.ip && <span>IP: {log.ip}</span>}
                          {log.details && Object.keys(log.details).length > 0 && (
                            <span className="font-mono text-[10px] bg-nesty-cream/40 px-1.5 py-0.5 rounded border border-nesty-creamBorder">
                              {JSON.stringify(log.details)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-semibold text-nesty-textSecondary">{dateStr}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Add / Edit Modal */}
      {showProductModal && (
        <div
          onClick={() => setShowProductModal(false)}
          data-testid="admin_product_modal_backdrop"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            data-testid="admin_product_modal_card"
            className="w-full max-w-lg bg-nesty-creamSurface border-2 border-nesty-gold rounded-[28px] shadow-2xl p-6 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-nesty-burgundy text-nesty-cream border border-nesty-gold flex items-center justify-center">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-nesty-burgundy">
                    {editingItemId ? 'Edit Menu Product' : 'Add New Menu Product'}
                  </h3>
                  <p className="text-xs text-nesty-textSecondary">
                    Saved directly to the authoritative backend database
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="p-2 rounded-xl text-nesty-burgundy hover:bg-nesty-creamElevated"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProductFormSubmit} className="mt-4 space-y-3.5">
              {prodFormError && (
                <div className="p-3 rounded-xl bg-nesty-errorBg border border-nesty-error text-xs font-bold text-nesty-error">
                  {prodFormError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={prodName}
                    onChange={(e) => setProdName(e.target.value)}
                    placeholder="e.g. Paneer Puff"
                    data-testid="product_name_input"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-sm focus:outline-none focus:border-nesty-burgundy"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    data-testid="product_price_input"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-sm focus:outline-none focus:border-nesty-burgundy"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  placeholder="Flaky bakery puff stuffed with spiced paneer..."
                  data-testid="product_desc_input"
                  className="w-full px-3.5 py-2 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-xs focus:outline-none focus:border-nesty-burgundy"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={prodCategory}
                    onChange={(e) => setProdCategory(e.target.value)}
                    data-testid="product_category_input"
                    className="w-full px-3 py-2 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={prodUnit}
                    onChange={(e) => setProdUnit(e.target.value)}
                    data-testid="product_unit_input"
                    className="w-full px-3 py-2 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-nesty-textPrimary mb-1">
                    Stock Count
                  </label>
                  <input
                    type="number"
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-nesty-creamElevated border border-nesty-creamBorder flex items-center justify-between">
                  <span className="text-xs font-bold text-nesty-textPrimary">Dietary Status</span>
                  <button
                    type="button"
                    onClick={() => setProdIsVeg(!prodIsVeg)}
                    data-testid="product_veg_toggle"
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold ${
                      prodIsVeg
                        ? 'bg-nesty-success text-white'
                        : 'bg-nesty-error text-white'
                    }`}
                  >
                    {prodIsVeg ? 'VEG' : 'NON-VEG'}
                  </button>
                </div>

                <div className="p-3 rounded-2xl bg-nesty-creamElevated border border-nesty-creamBorder flex items-center justify-between">
                  <span className="text-xs font-bold text-nesty-textPrimary">Availability</span>
                  <button
                    type="button"
                    onClick={() => setProdAvailable(!prodAvailable)}
                    data-testid="product_available_toggle"
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold ${
                      prodAvailable
                        ? 'bg-nesty-burgundy text-nesty-cream'
                        : 'bg-nesty-creamBorder text-nesty-textSecondary'
                    }`}
                  >
                    {prodAvailable ? 'In Stock' : 'Sold Out'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-nesty-textPrimary">
                  Product Image URL or Upload Image
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={prodImage}
                    onChange={(e) => setProdImage(e.target.value)}
                    placeholder="/images/samosa.jpg"
                    data-testid="product_image_input"
                    className="flex-1 px-3 py-2 rounded-xl bg-nesty-cream border border-nesty-creamBorder text-xs"
                  />
                  <label className="px-3 py-2 rounded-xl bg-nesty-creamElevated border border-nesty-gold text-nesty-burgundy font-bold text-xs cursor-pointer flex items-center gap-1 shrink-0">
                    <Image className="w-3.5 h-3.5" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {PRESET_PRODUCT_IMAGES.map((preset) => (
                    <button
                      type="button"
                      key={preset.label}
                      onClick={() => setProdImage(preset.url)}
                      className="px-2.5 py-1 rounded-lg bg-nesty-creamElevated border border-nesty-creamBorder text-[11px] font-bold text-nesty-burgundy hover:bg-nesty-goldLight"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="flex-1 py-3 rounded-xl border border-nesty-creamBorder text-xs font-bold text-nesty-textSecondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  data-testid="save_product_submit_button"
                  className="flex-1 py-3 rounded-xl bg-nesty-burgundy text-nesty-cream border border-nesty-gold font-extrabold text-xs flex items-center justify-center gap-1.5 hover:bg-nesty-burgundyDark transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isSavingProduct
                      ? 'Saving to Database...'
                      : editingItemId
                      ? 'Update Product'
                      : 'Save Product to Menu'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
