import React, { useState } from 'react';
import {
  AnnouncementRecord,
  CouponRecord,
  MenuItem,
  OrderRecord,
  UserAccount,
} from '../types';
import {
  Bell,
  CheckCircle2,
  Edit3,
  Image,
  PackagePlus,
  Plus,
  Receipt,
  RefreshCw,
  Tag,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
  UtensilsCrossed,
  X,
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

type AdminSection = 'PRODUCTS' | 'ORDERS' | 'STUDENTS' | 'COUPONS' | 'ANNOUNCEMENTS';

const PRESET_PRODUCT_IMAGES = [
  { label: 'Samosa', url: 'https://deliz-canteen.onrender.com/images/samosa.png' },
  { label: 'Veg Puff', url: 'https://deliz-canteen.onrender.com/images/veg-puff.png' },
  { label: 'Egg Puff', url: 'https://deliz-canteen.onrender.com/images/egg-puff.png' },
  { label: 'Chicken Puff', url: 'https://deliz-canteen.onrender.com/images/chicken-puff.png' },
  {
    label: 'Masala Chai',
    url: 'https://images.unsplash.com/photo-1561336313-0bd5e0b27ec8?w=600&auto=format&fit=crop&q=80',
  },
];

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
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

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | undefined>(undefined);
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState('25');
  const [prodCategory, setProdCategory] = useState('Snacks');
  const [prodUnit, setProdUnit] = useState('pcs');
  const [prodIsVeg, setProdIsVeg] = useState(true);
  const [prodImage, setProdImage] = useState('https://deliz-canteen.onrender.com/images/samosa.png');
  const [prodAvailable, setProdAvailable] = useState(true);
  const [prodStock, setProdStock] = useState('100');
  const [prodFormError, setProdFormError] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  const [cpnCode, setCpnCode] = useState('');
  const [cpnPercent, setCpnPercent] = useState('15');
  const [cpnMax, setCpnMax] = useState('30');
  const [cpnMin, setCpnMin] = useState('40');

  const [annTitle, setAnnTitle] = useState('');
  const [annMsg, setAnnMsg] = useState('');

  const openAddProductModal = () => {
    setEditingItemId(undefined);
    setProdName('');
    setProdDesc('');
    setProdPrice('25');
    setProdCategory('Snacks');
    setProdUnit('pcs');
    setProdIsVeg(true);
    setProdImage('https://deliz-canteen.onrender.com/images/samosa.png');
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
      image: prodImage.trim() || 'https://deliz-canteen.onrender.com/images/samosa.png',
      isAvailable: prodAvailable,
      stockCount: Number(prodStock) || 100,
    });
    setIsSavingProduct(false);

    if (ok) {
      setShowProductModal(false);
    }
  };

  const paidOrders = orders.filter(
    (o) => o.paymentStatus === 'PAID' || o.paymentStatus === 'SUCCESS'
  );
  const totalRevenue = paidOrders.reduce((acc, o) => acc + o.finalAmount, 0);
  const pendingPickupCount = orders.filter(
    (o) => o.orderStatus !== 'CLAIMED' && o.orderStatus !== 'CANCELLED'
  ).length;

  return (
    <div data-testid="admin_dashboard_screen" className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-nesty-burgundyDark via-nesty-burgundy to-nesty-burgundyLight border-2 border-nesty-gold p-6 text-nesty-cream shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-widest text-nesty-gold">
              NESTY ADMIN PORTAL • AUTHORITATIVE SHARED DATABASE
            </span>
            <h1 className="text-2xl font-extrabold mt-1">Canteen Command & Product Catalog</h1>
            <p className="text-xs sm:text-sm text-nesty-cream/85 mt-0.5">
              Products saved here persist in the shared backend and immediately appear on the
              Student Menu across Web and Android.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={openAddProductModal}
              data-testid="admin_add_products_cta_button"
              className="px-5 py-3 rounded-2xl bg-nesty-gold text-nesty-textPrimary border-2 border-nesty-cream font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-lg hover:bg-nesty-goldLight transition"
            >
              <PackagePlus className="w-4 h-4 text-nesty-burgundy" />
              <span>+ Add Products</span>
            </button>

            <button
              type="button"
              onClick={onRefreshAll}
              data-testid="admin_refresh_button"
              className="px-3.5 py-3 rounded-2xl bg-nesty-cream/15 hover:bg-nesty-cream/25 border border-nesty-gold text-xs font-bold flex items-center gap-1.5 transition"
            >
              <RefreshCw className="w-4 h-4 text-nesty-gold" />
              <span>Sync</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-nesty-gold/30">
          <div className="p-3 rounded-2xl bg-nesty-burgundyDark/60 border border-nesty-gold/40">
            <div className="text-[11px] font-bold text-nesty-gold uppercase">Verified Revenue</div>
            <div className="text-xl font-extrabold mt-0.5">₹{totalRevenue}</div>
          </div>
          <div className="p-3 rounded-2xl bg-nesty-burgundyDark/60 border border-nesty-gold/40">
            <div className="text-[11px] font-bold text-nesty-gold uppercase">Active Orders</div>
            <div className="text-xl font-extrabold mt-0.5">{pendingPickupCount}</div>
          </div>
          <div className="p-3 rounded-2xl bg-nesty-burgundyDark/60 border border-nesty-gold/40">
            <div className="text-[11px] font-bold text-nesty-gold uppercase">Menu Products</div>
            <div className="text-xl font-extrabold mt-0.5">{menuItems.length}</div>
          </div>
          <div className="p-3 rounded-2xl bg-nesty-burgundyDark/60 border border-nesty-gold/40">
            <div className="text-[11px] font-bold text-nesty-gold uppercase">Students</div>
            <div className="text-xl font-extrabold mt-0.5">{students.length}</div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          {
            id: 'PRODUCTS' as const,
            label: `Add / Manage Products (${menuItems.length})`,
            icon: <UtensilsCrossed className="w-4 h-4" />,
            testId: 'admin_tab_products',
          },
          {
            id: 'ORDERS' as const,
            label: `Orders & Payments (${orders.length})`,
            icon: <Receipt className="w-4 h-4" />,
            testId: 'admin_tab_orders',
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

      {activeTab === 'PRODUCTS' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-nesty-creamSurface border border-nesty-gold rounded-2xl p-4">
            <div>
              <h2 className="text-lg font-extrabold text-nesty-burgundy">
                Authoritative Product Catalog
              </h2>
              <p className="text-xs text-nesty-textSecondary">
                Add new dishes, edit prices, upload images, or toggle real-time availability.
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
                      src={item.image}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = item.fallbackImage;
                      }}
                      alt={item.name}
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

      {activeTab === 'ORDERS' && (
        <div className="space-y-3">
          {orders.map((order) => (
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
                  <span className="px-2.5 py-1 rounded-xl bg-nesty-goldLight border border-nesty-gold text-xs font-bold text-nesty-burgundyDark">
                    Block {order.block}
                  </span>
                  <span className="text-xs font-mono font-bold text-nesty-burgundy">
                    Txn: {order.transactionId}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold ${
                      order.paymentStatus === 'FAILED'
                        ? 'bg-nesty-errorBg text-nesty-error'
                        : 'bg-nesty-successBg text-nesty-success'
                    }`}
                  >
                    {order.paymentStatus}
                  </span>
                </div>

                <div className="text-sm font-extrabold text-nesty-textPrimary">
                  {order.items.map((it) => `${it.quantity}x ${it.name}`).join(', ')} — ₹
                  {order.finalAmount}
                </div>

                <div className="text-xs text-nesty-textSecondary">
                  Student: <span className="font-bold">{order.studentName}</span> (
                  {order.studentEmail}) • {order.paymentMethod}
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
                        className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition ${
                          active
                            ? 'bg-nesty-gold text-nesty-textPrimary border-nesty-burgundy'
                            : 'bg-nesty-creamElevated text-nesty-burgundy border-nesty-gold hover:bg-nesty-burgundy hover:text-nesty-cream'
                        }`}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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
                  Roll: {stu.rollNo || 'N/A'} • Block {stu.block}
                </div>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-nesty-goldLight border border-nesty-gold text-xs font-extrabold text-nesty-burgundyDark">
                {stu.coins} Coins
              </div>
            </div>
          ))}
        </div>
      )}

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
                placeholder="Hot Puffs Ready at CB Counter"
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
                    placeholder="https://deliz-canteen.onrender.com/images/samosa.png"
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
