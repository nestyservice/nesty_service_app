import { createClient } from '@supabase/supabase-js';

const getSupabaseUrl = () => (process.env.SUPABASE_URL || '').trim();
const getSupabaseKey = () =>
  (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();

export const isSupabaseConfigured = () => Boolean(getSupabaseUrl() && getSupabaseKey());

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  try {
    return createClient(getSupabaseUrl(), getSupabaseKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  } catch (err) {
    console.warn('[SUPABASE] Failed to initialize client:', err.message);
    return null;
  }
}

/**
 * Synchronizes a single user account to Supabase Authentication (auth.users)
 * Safely handles both new creations and updates if user already exists.
 * Does NOT throw errors or disrupt core application flow.
 */
export async function syncUserToSupabaseAuth(user, rawPassword = null) {
  const client = getSupabaseClient();
  if (!client || !user || !user.email) return null;

  const email = user.email.toLowerCase().trim();
  const metadata = {
    name: user.name || '',
    phone: user.phone || '',
    rollNo: user.rollNo || '',
    role: user.role || 'student',
    emailVerified: Boolean(user.emailVerified !== false),
    nestyUserId: user.id || '',
  };

  try {
    if (client.auth && client.auth.admin) {
      const { data: listData } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 }).catch(() => ({ data: null }));
      const existing = listData?.users?.find((u) => u.email?.toLowerCase() === email);

      if (existing) {
        const updatePayload = {
          email_confirm: true,
          user_metadata: {
            ...existing.user_metadata,
            ...metadata,
          },
        };
        if (rawPassword && rawPassword.length >= 6) {
          updatePayload.password = rawPassword;
        }
        const { data: updateData, error: updateError } = await client.auth.admin.updateUserById(existing.id, updatePayload);
        if (updateError) {
          console.warn(`[SUPABASE] Notice updating user metadata for ${email}:`, updateError.message);
        } else {
          console.log(`[SUPABASE] User updated in Supabase Auth: ${email}`);
        }
        return updateData?.user || existing;
      }

      // User does not exist in Supabase Auth yet: create new user
      const createPayload = {
        email,
        email_confirm: true,
        user_metadata: metadata,
      };
      if (rawPassword && rawPassword.length >= 6) {
        createPayload.password = rawPassword;
      } else {
        createPayload.password = `NestyAuth_${Math.random().toString(36).slice(2, 10)}!${Date.now()}`;
      }

      const { data: createData, error: createError } = await client.auth.admin.createUser(createPayload);
      if (createError) {
        console.warn(`[SUPABASE] Notice creating user in Supabase Auth for ${email}:`, createError.message);
        return null;
      }

      console.log(`[SUPABASE] Successfully registered user in Supabase Authentication: ${email}`);
      return createData?.user || null;
    }

    return null;
  } catch (err) {
    console.warn(`[SUPABASE] Non-fatal auth sync error for ${email}:`, err.message);
    return null;
  }
}

/**
 * Persists a user account permanently to the public.users database table.
 * Also syncs to Supabase Auth.
 */
export async function syncUserToSupabase(user, rawPassword = null) {
  const client = getSupabaseClient();
  if (!user || !user.email) return null;

  const email = user.email.toLowerCase().trim();
  const rollNo = user.rollNo || '';

  // 1. Sync to public.users table if client is configured
  if (client) {
    try {
      const payload = {
        id: user.id,
        email,
        name: user.name || '',
        phone: user.phone || '',
        roll_no: rollNo,
        role: user.role || 'student',
        email_verified: Boolean(user.emailVerified !== false),
        password_hash: user.passwordHash || '',
        created_at: user.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await client.from('users').upsert(payload, { onConflict: 'id' });
      if (error) {
        console.warn(`[SUPABASE] User table upsert notice for ${email}:`, error.message);
      } else {
        console.log(`[SUPABASE] User successfully persisted to public.users table: ${email} (${rollNo})`);
      }
    } catch (err) {
      console.warn(`[SUPABASE] Non-fatal user table sync error for ${email}:`, err.message);
    }
  }

  // 2. Also sync to Supabase Auth
  try {
    await syncUserToSupabaseAuth(user, rawPassword);
  } catch {
    // Non-fatal
  }

  return true;
}

/**
 * Fetches all persistent users from the public.users Supabase table.
 */
export async function fetchUsersFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return [];
  try {
    const { data, error } = await client.from('users').select('*');
    if (error) {
      console.warn('[SUPABASE] Failed to query users table:', error.message);
      return [];
    }
    return (data || []).map((u) => ({
      id: u.id,
      email: (u.email || '').toLowerCase().trim(),
      name: u.name || '',
      phone: u.phone || '',
      rollNo: u.roll_no || '',
      role: u.role || 'student',
      emailVerified: Boolean(u.email_verified !== false),
      passwordHash: u.password_hash || '',
      createdAt: u.created_at || new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('[SUPABASE] Unexpected error querying users table:', err.message);
    return [];
  }
}

/**
 * Synchronizes all local users to Supabase public.users table and Auth.
 */
export async function syncAllUsersToSupabase(users = []) {
  if (!isSupabaseConfigured() || !Array.isArray(users) || users.length === 0) {
    return;
  }
  console.log(`[SUPABASE] Syncing ${users.length} existing users to Supabase database & auth...`);
  for (const u of users) {
    try {
      await syncUserToSupabase(u, null);
    } catch {
      // Ignore individual sync errors
    }
  }
  console.log('[SUPABASE] Initial user sync to Supabase complete.');
}

/**
 * Persist an order to Supabase orders table permanently.
 */
export async function syncOrderToSupabase(order) {
  const client = getSupabaseClient();
  if (!client || !order || !order.id) return null;
  try {
    const singleToken = order.token || order.billCode || order.pickupToken || null;
    const rollNo = order.studentRollNo || order.rollNo || null;
    const payload = {
      id: order.id,
      student_email: order.studentEmail,
      student_name: order.studentName,
      student_phone: order.studentPhone,
      student_roll_no: rollNo,
      items: order.items || [],
      total_amount: order.totalAmount,
      discount: order.discount || 0,
      final_amount: order.finalAmount || order.totalAmount,
      payment_method: order.paymentMethod,
      transaction_id: order.transactionId,
      razorpay_order_id: order.razorpayOrderId,
      payment_status: order.paymentStatus,
      order_status: order.orderStatus,
      bill_status: order.billStatus || (order.orderStatus === 'CLAIMED' ? 'EXPIRED' : 'ACTIVE'),
      bill_collected_at: order.billCollectedAt || null,
      pickup_token: singleToken,
      bill_code: singleToken,
      token: singleToken,
      printed_at: order.printedAt || null,
      printed_by: order.printedBy || null,
      claimed_by: order.claimedBy || null,
      claimed_at: order.claimedAt || null,
      created_at: order.createdAt,
    };
    const { error } = await client.from('orders').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn(`[SUPABASE] Order upsert notice for #${order.id}:`, error.message);
    } else {
      console.log(`[SUPABASE] Order #${order.id} permanently persisted.`);
    }
    return true;
  } catch (err) {
    console.warn(`[SUPABASE] Non-fatal order sync error for #${order.id}:`, err.message);
    return null;
  }
}

/**
 * Persist a payment to Supabase payments table permanently.
 */
export async function syncPaymentToSupabase(payment) {
  const client = getSupabaseClient();
  if (!client || !payment || !payment.id) return null;
  try {
    const singleToken = payment.token || payment.billCode || null;
    const rollNo = payment.studentRollNo || payment.rollNo || null;
    const payload = {
      id: payment.id,
      order_id: payment.orderId,
      student_email: payment.studentEmail,
      student_name: payment.studentName,
      student_roll_no: rollNo,
      token: singleToken,
      amount: payment.amount,
      currency: payment.currency || 'INR',
      payment_method: payment.paymentMethod,
      transaction_id: payment.transactionId,
      razorpay_order_id: payment.razorpayOrderId,
      status: payment.status,
      refund_status: payment.refundStatus || 'NONE',
      refund_amount: Number(payment.refundAmount) || 0,
      bill_status: payment.billStatus || 'ACTIVE',
      bill_collected_at: payment.billCollectedAt || null,
      created_at: payment.createdAt,
    };
    const { error } = await client.from('payments').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn(`[SUPABASE] Payment upsert notice for ${payment.id}:`, error.message);
    } else {
      console.log(`[SUPABASE] Payment ${payment.id} permanently persisted.`);
    }
    return true;
  } catch (err) {
    console.warn(`[SUPABASE] Non-fatal payment sync error for ${payment.id}:`, err.message);
    return null;
  }
}

/**
 * Persist a Daily Sales Report to Supabase daily_reports table permanently.
 */
export async function syncDailyReportToSupabase(report) {
  const client = getSupabaseClient();
  if (!client || !report || !report.date) return null;
  try {
    const payload = {
      id: report.reportId || report.id || `report_${report.date}`,
      date: report.date,
      report_id: report.reportId || report.id || `report_${report.date}`,
      generated_at: report.generatedAt || new Date().toISOString(),
      kolkata_timestamp: report.kolkataTimestamp || '',
      trigger_type: report.triggerType || 'AUTOMATIC_530_PM',
      revenue_summary: report.revenueSummary || {},
      product_sales: report.productSales || [],
      order_ledger: report.orderLedger || {},
      final_totals: report.finalTotals || {},
      business_summary: report.businessSummary || {},
      full_report_json: report,
      created_at: report.generatedAt || new Date().toISOString(),
    };
    const { error } = await client.from('daily_reports').upsert(payload, { onConflict: 'date' });
    if (error) {
      console.warn(`[SUPABASE] Daily report upsert notice for ${report.date}:`, error.message);
    } else {
      console.log(`[SUPABASE] Daily report for ${report.date} permanently persisted.`);
    }
    return true;
  } catch (err) {
    console.warn(`[SUPABASE] Non-fatal daily report sync error for ${report.date}:`, err.message);
    return null;
  }
}

/**
 * Fetches all persistent daily reports from Supabase.
 */
export async function fetchDailyReportsFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return [];
  try {
    const { data, error } = await client.from('daily_reports').select('*');
    if (error) {
      console.warn('[SUPABASE] Failed to query daily_reports table:', error.message);
      return [];
    }
    return (data || []).map((r) => {
      if (r.full_report_json && typeof r.full_report_json === 'object' && r.full_report_json.reportId) {
        return r.full_report_json;
      }
      return {
        id: r.id || r.report_id,
        reportId: r.report_id || r.id,
        date: r.date,
        generatedAt: r.generated_at,
        kolkataTimestamp: r.kolkata_timestamp,
        triggerType: r.trigger_type,
        revenueSummary: r.revenue_summary,
        productSales: r.product_sales,
        orderLedger: r.order_ledger,
        finalTotals: r.final_totals,
        businessSummary: r.business_summary,
      };
    });
  } catch (err) {
    console.warn('[SUPABASE] Unexpected error querying daily_reports table:', err.message);
    return [];
  }
}

/**
 * Load cloud-persisted historical users, orders, payments, and daily reports from Supabase on startup.
 */
export async function fetchPersistentHistoryFromSupabase() {
  const client = getSupabaseClient();
  if (!client) return { users: [], orders: [], payments: [], dailyReports: [] };
  try {
    const [usrRes, ordRes, pmtRes, repRes] = await Promise.all([
      client.from('users').select('*').catch((e) => ({ error: e, data: null })),
      client.from('orders').select('*').catch((e) => ({ error: e, data: null })),
      client.from('payments').select('*').catch((e) => ({ error: e, data: null })),
      client.from('daily_reports').select('*').catch((e) => ({ error: e, data: null })),
    ]);

    if (usrRes?.error) {
      console.warn('[SUPABASE] Failed to query users table:', usrRes.error.message);
    }
    if (ordRes?.error) {
      console.warn('[SUPABASE] Failed to query orders table:', ordRes.error.message);
    }
    if (pmtRes?.error) {
      console.warn('[SUPABASE] Failed to query payments table:', pmtRes.error.message);
    }
    if (repRes?.error) {
      console.warn('[SUPABASE] Failed to query daily_reports table:', repRes.error.message);
    }

    const users = (usrRes?.data || []).map((u) => ({
      id: u.id,
      email: (u.email || '').toLowerCase().trim(),
      name: u.name || '',
      phone: u.phone || '',
      rollNo: u.roll_no || '',
      role: u.role || 'student',
      emailVerified: Boolean(u.email_verified !== false),
      passwordHash: u.password_hash || '',
      createdAt: u.created_at || new Date().toISOString(),
    }));

    const orders = (ordRes?.data || []).map((o) => {
      const singleToken = o.token || o.bill_code || o.pickup_token || null;
      const rollNo = o.student_roll_no || o.roll_no || '';
      return {
        id: o.id,
        studentEmail: o.student_email,
        studentName: o.student_name,
        studentPhone: o.student_phone,
        studentRollNo: rollNo,
        rollNo: rollNo,
        items: o.items || [],
        totalAmount: Number(o.total_amount || 0),
        discount: Number(o.discount || 0),
        finalAmount: Number(o.final_amount || 0),
        paymentMethod: o.payment_method,
        transactionId: o.transaction_id,
        razorpayOrderId: o.razorpay_order_id,
        paymentStatus: o.payment_status,
        orderStatus: o.order_status,
        billStatus: o.bill_status || (o.order_status === 'CLAIMED' ? 'EXPIRED' : 'ACTIVE'),
        billCollectedAt: o.bill_collected_at,
        token: singleToken,
        billCode: singleToken,
        pickupToken: singleToken,
        printedAt: o.printed_at,
        printedBy: o.printed_by,
        claimedBy: o.claimed_by,
        claimedAt: o.claimed_at,
        createdAt: o.created_at,
      };
    });

    const payments = (pmtRes?.data || []).map((p) => {
      const singleToken = p.token || p.bill_code || null;
      const rollNo = p.student_roll_no || p.roll_no || '';
      return {
        id: p.id,
        orderId: p.order_id,
        studentEmail: p.student_email,
        studentName: p.student_name,
        studentRollNo: rollNo,
        rollNo: rollNo,
        amount: Number(p.amount || 0),
        currency: p.currency || 'INR',
        paymentMethod: p.payment_method,
        transactionId: p.transaction_id,
        razorpayOrderId: p.razorpay_order_id,
        status: p.status,
        refundStatus: p.refund_status || 'NONE',
        refundAmount: Number(p.refund_amount) || 0,
        billStatus: p.bill_status || 'ACTIVE',
        billCollectedAt: p.bill_collected_at,
        token: singleToken,
        billCode: singleToken,
        createdAt: p.created_at,
      };
    });

    const dailyReports = (repRes?.data || []).map((r) => {
      if (r.full_report_json && typeof r.full_report_json === 'object' && r.full_report_json.reportId) {
        return r.full_report_json;
      }
      return {
        id: r.id || r.report_id,
        reportId: r.report_id || r.id,
        date: r.date,
        generatedAt: r.generated_at,
        kolkataTimestamp: r.kolkata_timestamp,
        triggerType: r.trigger_type,
        revenueSummary: r.revenue_summary,
        productSales: r.product_sales,
        orderLedger: r.order_ledger,
        finalTotals: r.final_totals,
        businessSummary: r.business_summary,
      };
    });

    return { users, orders, payments, dailyReports };
  } catch (err) {
    console.warn('[SUPABASE] Unexpected error in fetchPersistentHistoryFromSupabase:', err.message);
    return { users: [], orders: [], payments: [], dailyReports: [] };
  }
}
