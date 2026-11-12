-- ============================================================================
-- NESTY CAMPUS CANTEEN — PERMANENT POSTGRESQL / SUPABASE DATABASE SCHEMA
-- ============================================================================
-- Apply this SQL in your Supabase SQL Editor (or PostgreSQL client).
-- It is 100% idempotent and safe to run multiple times without data loss.
-- Tables created: users, orders, payments, daily_reports
-- ============================================================================

-- 1. USERS & STUDENT ACCOUNTS TABLE (Permanent Student Records)
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT DEFAULT '',
    roll_no TEXT DEFAULT '',
    role TEXT NOT NULL DEFAULT 'student',
    email_verified BOOLEAN NOT NULL DEFAULT true,
    password_hash TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_roll_no ON public.users(roll_no);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- 2. ORDERS TABLE (All Confirmed Orders & Single Tokens)
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    student_email TEXT,
    student_name TEXT,
    student_phone TEXT,
    student_roll_no TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    final_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    payment_method TEXT,
    transaction_id TEXT,
    razorpay_order_id TEXT,
    payment_status TEXT NOT NULL DEFAULT 'PENDING',
    order_status TEXT NOT NULL DEFAULT 'CONFIRMED',
    bill_status TEXT NOT NULL DEFAULT 'ACTIVE',
    bill_collected_at TIMESTAMPTZ,
    token TEXT,
    pickup_token TEXT,
    bill_code TEXT,
    printed_at TIMESTAMPTZ,
    printed_by TEXT,
    claimed_by TEXT,
    claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_student_email ON public.orders(student_email);
CREATE INDEX IF NOT EXISTS idx_orders_student_roll_no ON public.orders(student_roll_no);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_bill_code ON public.orders(bill_code);

-- 3. PAYMENTS TABLE (Verified Razorpay & Counter Payments)
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    order_id TEXT,
    student_email TEXT,
    student_name TEXT,
    student_roll_no TEXT,
    token TEXT,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    payment_method TEXT,
    transaction_id TEXT,
    razorpay_order_id TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    refund_status TEXT NOT NULL DEFAULT 'NONE',
    refund_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    bill_status TEXT NOT NULL DEFAULT 'ACTIVE',
    bill_collected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON public.payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at);

-- 4. DAILY SALES REPORTS TABLE (5:30 PM Reconciled Reports)
CREATE TABLE IF NOT EXISTS public.daily_reports (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    report_id TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL,
    kolkata_timestamp TEXT,
    trigger_type TEXT NOT NULL DEFAULT 'AUTOMATIC_530_PM',
    revenue_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    product_sales JSONB NOT NULL DEFAULT '[]'::jsonb,
    order_ledger JSONB NOT NULL DEFAULT '{}'::jsonb,
    final_totals JSONB NOT NULL DEFAULT '{}'::jsonb,
    business_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    full_report_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON public.daily_reports(date);

-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- Service role key bypasses RLS automatically, ensuring backend operations have full access.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

-- Allow service_role full control over all tables
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'service_role_all_users'
    ) THEN
        CREATE POLICY service_role_all_users ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'service_role_all_orders'
    ) THEN
        CREATE POLICY service_role_all_orders ON public.orders FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'service_role_all_payments'
    ) THEN
        CREATE POLICY service_role_all_payments ON public.payments FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'daily_reports' AND policyname = 'service_role_all_daily_reports'
    ) THEN
        CREATE POLICY service_role_all_daily_reports ON public.daily_reports FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;
END $$;
