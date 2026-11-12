import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'crypto';
import {
  app,
  createAuthToken,
  generateDailySalesReport,
  calculateRevenueAnalytics,
  getKolkataTime,
  getKolkataDateString,
  isWithinDailyReportWindow,
} from './index.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'nesty_test_super_secure_jwt_secret_key_32chars_min!!';

// Isolate DB for this test suite
const dataDir = path.join(process.cwd(), 'server', 'data');
const originalDbFile = path.join(dataDir, 'nesty_shared_db.json');
const testDbFile = path.join(dataDir, `nesty_test_persist_fixture_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.json`);
fs.copyFileSync(originalDbFile, testDbFile);
process.env.DATABASE_FILE_PATH = path.relative(process.cwd(), testDbFile);

function requestJson(server, method, reqPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: reqPath,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let data = null;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, data });
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

// ----------------------------------------------------------------------------
// SCENARIO H1: Student registration persists across backend restart
// ----------------------------------------------------------------------------
test('H1: Student account creation remains in database across simulated restarts', async () => {
  const server = http.createServer(app);
  await new Promise((res) => server.listen(0, res));

  try {
    const rollNo = '22B81A0599';
    const email = '22b81a0599@cvr.ac.in';
    const name = 'Persistent Student';

    // 1. Direct registration / verification restore in DB
    const rawDb = JSON.parse(fs.readFileSync(testDbFile, 'utf8'));
    const studentUser = {
      id: `usr_${crypto.randomBytes(4).toString('hex')}`,
      email,
      name,
      phone: '9876543299',
      rollNo,
      role: 'student',
      emailVerified: true,
      createdAt: new Date().toISOString(),
    };
    rawDb.users.push(studentUser);
    fs.writeFileSync(testDbFile, JSON.stringify(rawDb, null, 2), 'utf8');

    // 2. Simulate complete restart by reading from disk again (as Render does on spinup)
    const reloadedDb = JSON.parse(fs.readFileSync(testDbFile, 'utf8'));
    const found = reloadedDb.users.find((u) => u.email === email);

    assert.ok(found, 'Student record must exist after simulated backend restart');
    assert.equal(found.rollNo, rollNo);
    assert.equal(found.name, name);
    assert.equal(found.emailVerified, true);
  } finally {
    server.close();
  }
});

// ----------------------------------------------------------------------------
// SCENARIO H2: Order creation persists across backend restart
// ----------------------------------------------------------------------------
test('H2: Order remains in database across simulated restarts', async () => {
  const rawDb = JSON.parse(fs.readFileSync(testDbFile, 'utf8'));
  const testOrder = {
    id: `ORD-PERSIST-${Date.now()}`,
    studentEmail: 'genuine_student@cvr.ac.in',
    studentName: 'Genuine CVR Student',
    studentRollNo: '22B81A0588',
    rollNo: '22B81A0588',
    items: [{ id: 'samosa', name: 'Samosa', price: 12, quantity: 2, isVeg: true }],
    totalAmount: 24,
    finalAmount: 24,
    paymentMethod: 'UPI',
    transactionId: `txn_${Date.now()}`,
    paymentStatus: 'PAID',
    orderStatus: 'CONFIRMED',
    billStatus: 'ACTIVE',
    token: 'P7X',
    pickupToken: 'P7X',
    billCode: 'P7X',
    createdAt: new Date().toISOString(),
  };

  rawDb.orders.push(testOrder);
  fs.writeFileSync(testDbFile, JSON.stringify(rawDb, null, 2), 'utf8');

  // Reload simulated container disk
  const reloadedDb = JSON.parse(fs.readFileSync(testDbFile, 'utf8'));
  const foundOrder = reloadedDb.orders.find((o) => o.id === testOrder.id);

  assert.ok(foundOrder, 'Order must survive simulated restart');
  assert.equal(foundOrder.token, 'P7X');
  assert.equal(foundOrder.finalAmount, 24);
  assert.equal(foundOrder.paymentStatus, 'PAID');
});

// ----------------------------------------------------------------------------
// SCENARIO H3: Successful payment remains permanently stored
// ----------------------------------------------------------------------------
test('H3: Successful payment transaction remains permanently stored across restarts', async () => {
  const rawDb = JSON.parse(fs.readFileSync(testDbFile, 'utf8'));
  const testPayment = {
    id: `pmt_rzp_live_${Date.now()}`,
    orderId: 'ORD-TEST-PMT',
    studentEmail: 'genuine_student@cvr.ac.in',
    studentName: 'Genuine CVR Student',
    studentRollNo: '22B81A0588',
    amount: 150,
    currency: 'INR',
    paymentMethod: 'Razorpay UPI',
    transactionId: `pay_tx_${Date.now()}`,
    status: 'PAID',
    token: 'K9Q',
    billCode: 'K9Q',
    createdAt: new Date().toISOString(),
  };

  rawDb.payments.push(testPayment);
  fs.writeFileSync(testDbFile, JSON.stringify(rawDb, null, 2), 'utf8');

  // Reload
  const reloadedDb = JSON.parse(fs.readFileSync(testDbFile, 'utf8'));
  const foundPayment = reloadedDb.payments.find((p) => p.id === testPayment.id);

  assert.ok(foundPayment, 'Payment transaction must remain permanently stored');
  assert.equal(foundPayment.amount, 150);
  assert.equal(foundPayment.status, 'PAID');
});

// ----------------------------------------------------------------------------
// SCENARIO H4: Verify today order count and revenue against actual database records
// ----------------------------------------------------------------------------
test('H4: Verify today order count and revenue against actual database records', () => {
  const todayStr = getKolkataTime().dateStr;
  const mockDb = {
    menuItems: [
      { id: 'samosa', name: 'Samosa', price: 12, isVeg: true },
      { id: 'veg_puff', name: 'Veg Puff', price: 25, isVeg: true },
    ],
    orders: [
      {
        id: 'ORD-T1',
        createdAt: `${todayStr}T10:00:00+05:30`,
        paymentStatus: 'PAID',
        totalAmount: 50,
        items: [{ id: 'veg_puff', price: 25, quantity: 2 }],
      },
      {
        id: 'ORD-T2',
        createdAt: `${todayStr}T11:30:00+05:30`,
        paymentStatus: 'PAID',
        totalAmount: 24,
        items: [{ id: 'samosa', price: 12, quantity: 2 }],
      },
      {
        id: 'ORD-YESTERDAY',
        createdAt: '2026-11-01T10:00:00+05:30',
        paymentStatus: 'PAID',
        totalAmount: 100,
        items: [{ id: 'samosa', price: 12, quantity: 5 }],
      },
    ],
    payments: [
      {
        id: 'PAY-T1',
        orderId: 'ORD-T1',
        createdAt: `${todayStr}T10:00:00+05:30`,
        amount: 50,
        status: 'PAID',
      },
      {
        id: 'PAY-T2',
        orderId: 'ORD-T2',
        createdAt: `${todayStr}T11:30:00+05:30`,
        amount: 24,
        status: 'PAID',
      },
      {
        id: 'PAY-YESTERDAY',
        orderId: 'ORD-YESTERDAY',
        createdAt: '2026-11-01T10:00:00+05:30',
        amount: 100,
        status: 'PAID',
      },
    ],
    users: [
      { id: 'u1', email: 's1@cvr.ac.in', role: 'student', createdAt: `${todayStr}T09:00:00+05:30` },
      { id: 'u2', email: 's2@cvr.ac.in', role: 'student', createdAt: '2026-11-01T09:00:00+05:30' },
    ],
  };

  const analytics = calculateRevenueAnalytics(mockDb, todayStr);

  assert.equal(analytics.summary.todayOrders, 2, "Today's orders must strictly count orders placed today");
  assert.equal(analytics.summary.todayRevenue, 74, "Today's revenue must strictly sum verified payments for today (50 + 24 = 74)");
  assert.equal(analytics.summary.todaySuccessfulPayments, 2);
  assert.equal(analytics.summary.totalHistoricalRevenue, 174, 'Total historical revenue must include past days (74 + 100 = 174)');
});

// ----------------------------------------------------------------------------
// SCENARIO H5: Lifetime student count does not reset the following day
// ----------------------------------------------------------------------------
test('H5: Lifetime registered student count does not reset on date rollover', () => {
  const mockDb = {
    menuItems: [],
    orders: [],
    payments: [],
    users: [
      { id: 'u1', email: 'registered_nov10@cvr.ac.in', role: 'student', createdAt: '2026-11-10T09:00:00+05:30' },
      { id: 'u2', email: 'registered_nov11@cvr.ac.in', role: 'student', createdAt: '2026-11-11T09:00:00+05:30' },
      { id: 'u3', email: 'registered_nov12@cvr.ac.in', role: 'student', createdAt: '2026-11-12T09:00:00+05:30' },
    ],
  };

  // Day 1 (Nov 12)
  const day1 = calculateRevenueAnalytics(mockDb, '2026-11-12');
  assert.equal(day1.summary.totalRegisteredStudents, 3, 'Day 1 lifetime students must be 3');
  assert.equal(day1.selectedDayReport.registeredStudentsCount, 1, 'Day 1 registered students must be 1');

  // Day 2 (Nov 13 rollover)
  const day2 = calculateRevenueAnalytics(mockDb, '2026-11-13');
  assert.equal(day2.summary.totalRegisteredStudents, 3, 'Lifetime student count MUST NOT reset on next day (still 3)');
  assert.equal(day2.selectedDayReport.registeredStudentsCount, 0, 'New day starts with 0 registered students until new signups');
});

// ----------------------------------------------------------------------------
// SCENARIO H6: Daily report access denied at 5:29 PM
// ----------------------------------------------------------------------------
test('H6: Daily report access is strictly denied at 5:29 PM IST (HTTP 403 REPORT_WINDOW_CLOSED)', async () => {
  const server = http.createServer(app);
  await new Promise((res) => server.listen(0, res));

  try {
    const adminToken = createAuthToken({ email: 'admin@cvr.ac.in', role: 'admin', id: 'usr_admin_cvr' });

    // Simulate 5:29:50 PM IST
    const res = await requestJson(server, 'GET', '/api/admin/daily-reports', null, {
      Authorization: `Bearer ${adminToken}`,
      'x-test-override-time': '2026-11-12T17:29:50+05:30',
    });

    assert.equal(res.status, 403, 'Must return 403 Forbidden at 5:29 PM');
    assert.equal(res.data.code, 'REPORT_WINDOW_CLOSED');
    assert.equal(res.data.window.isOpen, false);
  } finally {
    server.close();
  }
});

// ----------------------------------------------------------------------------
// SCENARIO H7: Daily report access allowed at 5:30 PM
// ----------------------------------------------------------------------------
test('H7: Daily report access is allowed at exactly 5:30 PM IST (HTTP 200)', async () => {
  const server = http.createServer(app);
  await new Promise((res) => server.listen(0, res));

  try {
    const adminToken = createAuthToken({ email: 'admin@cvr.ac.in', role: 'admin', id: 'usr_admin_cvr' });

    // Simulate exactly 5:30:00 PM IST
    const res = await requestJson(server, 'GET', '/api/admin/daily-reports', null, {
      Authorization: `Bearer ${adminToken}`,
      'x-test-override-time': '2026-11-12T17:30:00+05:30',
    });

    assert.equal(res.status, 200, 'Must return 200 OK at 5:30 PM');
    assert.equal(res.data.success, true);
    assert.ok(Array.isArray(res.data.reports));
  } finally {
    server.close();
  }
});

// ----------------------------------------------------------------------------
// SCENARIO H8: Daily report access allowed at 5:59 PM
// ----------------------------------------------------------------------------
test('H8: Daily report access is allowed at 5:59 PM IST (HTTP 200)', async () => {
  const server = http.createServer(app);
  await new Promise((res) => server.listen(0, res));

  try {
    const adminToken = createAuthToken({ email: 'admin@cvr.ac.in', role: 'admin', id: 'usr_admin_cvr' });

    // Simulate 5:59:59 PM IST
    const res = await requestJson(server, 'GET', '/api/admin/daily-reports', null, {
      Authorization: `Bearer ${adminToken}`,
      'x-test-override-time': '2026-11-12T17:59:59+05:30',
    });

    assert.equal(res.status, 200, 'Must return 200 OK at 5:59 PM');
    assert.equal(res.data.success, true);
  } finally {
    server.close();
  }
});

// ----------------------------------------------------------------------------
// SCENARIO H9: Daily report access denied at 6:00 PM
// ----------------------------------------------------------------------------
test('H9: Daily report access is strictly denied at 6:00 PM IST (HTTP 403 REPORT_WINDOW_CLOSED)', async () => {
  const server = http.createServer(app);
  await new Promise((res) => server.listen(0, res));

  try {
    const adminToken = createAuthToken({ email: 'admin@cvr.ac.in', role: 'admin', id: 'usr_admin_cvr' });

    // Simulate 6:00:00 PM IST
    const res = await requestJson(server, 'GET', '/api/admin/daily-reports', null, {
      Authorization: `Bearer ${adminToken}`,
      'x-test-override-time': '2026-11-12T18:00:00+05:30',
    });

    assert.equal(res.status, 403, 'Must return 403 Forbidden at 6:00 PM');
    assert.equal(res.data.code, 'REPORT_WINDOW_CLOSED');
    assert.equal(res.data.window.isOpen, false);
  } finally {
    server.close();
  }
});

// ----------------------------------------------------------------------------
// SCENARIO H10: Next day dashboard starts with new daily figures without deleting history
// ----------------------------------------------------------------------------
test('H10: Next day dashboard starts with new daily figures (orders=0, revenue=0) without deleting history', () => {
  const day1Date = '2026-11-12';
  const day2Date = '2026-11-13';

  const mockDb = {
    menuItems: [{ id: 'samosa', name: 'Samosa', price: 12 }],
    orders: [
      {
        id: 'ORD-DAY1-1',
        createdAt: `${day1Date}T12:00:00+05:30`,
        paymentStatus: 'PAID',
        totalAmount: 120,
        items: [{ id: 'samosa', price: 12, quantity: 10 }],
      },
    ],
    payments: [
      {
        id: 'PAY-DAY1-1',
        orderId: 'ORD-DAY1-1',
        createdAt: `${day1Date}T12:00:00+05:30`,
        amount: 8000,
        status: 'PAID',
      },
    ],
    users: [
      { id: 'usr_1', email: 'student1@cvr.ac.in', role: 'student', createdAt: `${day1Date}T10:00:00+05:30` },
    ],
  };

  // Day 1: Orders = 1, Revenue = 8,000
  const day1Analytics = calculateRevenueAnalytics(mockDb, day1Date);
  assert.equal(day1Analytics.selectedDayReport.ordersPlacedCount, 1);
  assert.equal(day1Analytics.selectedDayReport.grossRevenue, 8000);

  // Day 2 (Rollover): No orders yet placed on Day 2
  const day2Analytics = calculateRevenueAnalytics(mockDb, day2Date);
  assert.equal(day2Analytics.selectedDayReport.ordersPlacedCount, 0, "Next day orders must start at 0");
  assert.equal(day2Analytics.selectedDayReport.grossRevenue, 0, "Next day revenue must start at 0");

  // Historical Day 1 records MUST remain permanently intact
  assert.equal(day2Analytics.summary.totalHistoricalRevenue, 8000, "Historical revenue from Day 1 must remain intact");
  assert.equal(day2Analytics.summary.totalOrders, 1, "Historical order count must remain intact");
  assert.equal(day2Analytics.summary.totalRegisteredStudents, 1, "Lifetime student count must remain intact");
});

// ----------------------------------------------------------------------------
// SCENARIO H11: Multiple report requests do not create duplicate reports (Idempotency)
// ----------------------------------------------------------------------------
test('H11: Multiple report requests do not create duplicate reports (Idempotency)', () => {
  const mockDb = {
    menuItems: [{ id: 'samosa', name: 'Samosa', price: 12 }],
    orders: [],
    payments: [],
    dailyReports: [],
  };

  const report1 = generateDailySalesReport(mockDb, '2026-11-12', 'AUTOMATED_SCHEDULED');
  assert.equal(mockDb.dailyReports.length, 1);

  const report2 = generateDailySalesReport(mockDb, '2026-11-12', 'MANUAL_ADMIN');
  assert.equal(mockDb.dailyReports.length, 1, 'Idempotency: Repeated report generation must not duplicate report entries');
  assert.equal(report2.reportId, report1.reportId);

  const report3 = generateDailySalesReport(mockDb, '2026-11-12', 'STARTUP_RECOVERY');
  assert.equal(mockDb.dailyReports.length, 1, 'Third run must still maintain exactly 1 report');
});

// ----------------------------------------------------------------------------
// SCENARIO H12: Existing admin login and student ordering/payment still work
// ----------------------------------------------------------------------------
test('H12: Existing admin login and student ordering/payment functionality still work', async () => {
  const server = http.createServer(app);
  await new Promise((res) => server.listen(0, res));

  try {
    // 1. Admin Login
    const adminLoginRes = await requestJson(server, 'POST', '/api/auth/login', {
      identifier: 'admin@cvr.ac.in',
      password: process.env.ADMIN_DEFAULT_PASSWORD || 'admin123',
    });
    assert.equal(adminLoginRes.status, 200);
    assert.equal(adminLoginRes.data.user.role, 'admin');
    assert.ok(adminLoginRes.data.token);

    // 2. Fetch Menu
    const menuRes = await requestJson(server, 'GET', '/api/menu');
    assert.equal(menuRes.status, 200);
    assert.ok(Array.isArray(menuRes.data.items));
    assert.ok(menuRes.data.items.length > 0);

    // 3. Student Order Placement (with counter cash/verified payment)
    const orderRes = await requestJson(server, 'POST', '/api/orders', {
      studentEmail: 'student_order_test@cvr.ac.in',
      studentName: 'Test Student',
      studentPhone: '9876543210',
      studentRollNo: '22B81A0577',
      items: [{ id: 'samosa', name: 'Samosa', price: 12, quantity: 1, isVeg: true }],
      paymentMethod: 'CASH',
      transactionId: `cash_${Date.now()}`,
    }, {
      Authorization: `Bearer ${adminLoginRes.data.token}`,
    });
    assert.equal(orderRes.status, 200);
    assert.ok(orderRes.data.order.token, 'Must generate single POS token');
    assert.equal(orderRes.data.order.paymentStatus, 'PAID');
  } finally {
    server.close();
    try {
      if (fs.existsSync(testDbFile)) {
        fs.unlinkSync(testDbFile);
      }
    } catch {}
    delete process.env.DATABASE_FILE_PATH;
  }
});
