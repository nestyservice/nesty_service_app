import React from 'react';
import { UserAccount } from '../types';
import {
  CreditCard,
  LogOut,
  QrCode,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  User,
  UtensilsCrossed,
} from 'lucide-react';

export type StudentDestination = 'MENU' | 'ORDER_HISTORY' | 'PAYMENT_HISTORY' | 'PROFILE';

interface NestyTopHeaderProps {
  user: UserAccount;
  cartCount: number;
  onOpenCart: () => void;
  onSignOut: () => void;
}

export const NestyTopHeader: React.FC<NestyTopHeaderProps> = ({
  user,
  cartCount,
  onOpenCart,
  onSignOut,
}) => {
  const isAdmin = user.role === 'admin';

  return (
    <header
      data-testid="nesty_top_header"
      className="sticky top-0 z-30 bg-nesty-creamSurface/95 backdrop-blur border-b-[1.5px] border-nesty-gold/60 shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        {/* Brand Logo & Current Identity (No Block names!) */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-nesty-cream border-[1.5px] border-nesty-gold p-1 shrink-0 shadow-sm">
            <img
              src="/images/nesty-logo.jpg"
              alt="Official NESTY Logo"
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-wider text-nesty-burgundy">
                NESTY
              </span>
              {isAdmin && (
                <span className="px-2 py-0.5 rounded-md bg-nesty-burgundy text-nesty-cream border border-nesty-gold text-[10px] font-extrabold uppercase tracking-wider">
                  ADMIN
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-nesty-textSecondary truncate">
              {isAdmin ? 'Campus Canteen Management' : user.name}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {!isAdmin && (
            <>
              <button
                type="button"
                onClick={onOpenCart}
                data-testid="header_cart_button"
                aria-label="Open Cart"
                className="relative w-10 h-10 rounded-xl bg-nesty-burgundy text-nesty-cream border border-nesty-gold flex items-center justify-center hover:bg-nesty-burgundyDark transition shadow-md"
              >
                <ShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  <span
                    data-testid="header_cart_count"
                    className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-nesty-gold text-nesty-textPrimary border border-nesty-cream text-[10px] font-extrabold flex items-center justify-center shadow"
                  >
                    {cartCount}
                  </span>
                )}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onSignOut}
            data-testid="header_sign_out_button"
            title="Sign Out"
            className="px-3 py-2 rounded-xl border border-nesty-burgundy/40 bg-nesty-creamSurface text-nesty-burgundy font-bold text-xs flex items-center gap-1.5 hover:bg-nesty-burgundy hover:text-nesty-cream transition"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};

interface StudentNavigationProps {
  currentDestination: StudentDestination;
  onNavigate: (dest: StudentDestination) => void;
  onSignOut: () => void;
}

export const StudentSidebarNav: React.FC<StudentNavigationProps> = ({
  currentDestination,
  onNavigate,
  onSignOut,
}) => {
  const navItems: Array<{
    id: StudentDestination;
    label: string;
    testId: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'MENU',
      label: 'Canteen Menu',
      testId: 'nav_menu_tab',
      icon: <UtensilsCrossed className="w-4 h-4" />,
    },
    {
      id: 'ORDER_HISTORY',
      label: 'Order History',
      testId: 'nav_order_history_tab',
      icon: <Receipt className="w-4 h-4" />,
    },
    {
      id: 'PAYMENT_HISTORY',
      label: 'Payment History',
      testId: 'nav_payment_history_tab',
      icon: <CreditCard className="w-4 h-4" />,
    },
    {
      id: 'PROFILE',
      label: 'Account & Profile',
      testId: 'nav_profile_tab',
      icon: <User className="w-4 h-4" />,
    },
  ];

  return (
    <>
      <aside
        data-testid="student_desktop_nav"
        className="hidden md:flex md:flex-col md:w-64 shrink-0 bg-nesty-creamSurface border-r border-nesty-gold/50 min-h-[calc(100vh-68px)] p-4 justify-between"
      >
        <div className="space-y-1.5">
          <div className="px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-nesty-textSecondary">
            STUDENT NAVIGATION
          </div>
          {navItems.map((item) => {
            const active = currentDestination === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                data-testid={item.testId}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-extrabold transition ${
                  active
                    ? 'bg-nesty-burgundy text-nesty-cream border border-nesty-gold shadow-sm'
                    : 'text-nesty-textSecondary hover:bg-nesty-creamElevated hover:text-nesty-burgundy'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="pt-4 border-t border-nesty-creamBorder space-y-3">
          <div className="p-3.5 rounded-2xl bg-nesty-goldLight/70 border border-nesty-gold text-[11px] text-nesty-textPrimary">
            <div className="flex items-center gap-1.5 font-extrabold text-nesty-burgundy mb-0.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Instant Counter Pickup</span>
            </div>
            Present your Order ID or Transaction ID directly at the counter.
          </div>

          <button
            type="button"
            onClick={onSignOut}
            data-testid="nav_sign_out_tab_desktop"
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-2xl border border-nesty-error/50 bg-nesty-errorBg text-nesty-error text-xs font-extrabold hover:bg-nesty-error hover:text-white transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <nav
        data-testid="student_bottom_nav"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-nesty-creamSurface border-t-[1.5px] border-nesty-gold shadow-lg grid grid-cols-4 px-1 py-1.5"
      >
        {navItems.map((item) => {
          const active = currentDestination === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              data-testid={`${item.testId}_mobile`}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-bold transition ${
                active
                  ? 'bg-nesty-burgundy text-nesty-cream'
                  : 'text-nesty-textSecondary hover:text-nesty-burgundy'
              }`}
            >
              {item.icon}
              <span className="mt-1 truncate max-w-full">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
