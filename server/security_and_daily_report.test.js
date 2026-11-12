import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {
  app,
  createAuthToken,
  generateDailySalesReport,
  generateDailyReportCsv,
  checkAndTriggerDailySalesReport,
  getKolkataTime,
  getKolkataDateString,
  revokeToken,
  isTokenRevoked,
  recordSecurityAlert,
} from './index.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'nesty_test_super_secure_jwt_secret_key_32chars_min!!';

// Isolate DB for this test suite so nesty_shared_db.json is never dirtied
const dataDir = path.join(process.cwd(), 'server', 'data');
const originalDbFile = path.join(dataDir, 'nesty_shared_db.json');
const isolatedDbFile = path.join(dataDir, `nesty_test_sec_fixture_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.json`);
fs.copyFileSync(originalDbFile, isolatedDbFile);
process.env.DATABASE_FILE_PATH = path.relative(process.cwd(), isolatedDbFile);

function requestJson(server, method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const port = server.address().port;
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
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

test('DAILY REPORT: Generates comprehensive 5:30 PM audit report with accurate product-wise rankings and zero-sale handling', async () => {
  const mockDb = {
    menuItems: [
      { id: 'samosa', name: 'Samosa', price: 12, category: 'Snacks', isVeg: true },
      { id: 'veg_puff', name: 'Veg Puff', price: 25, category: 'Snacks', isVeg: true },
      { id: 'chicken_puff', name: 'Chicken Puff', price: 30, category: 'Snacks', isVeg: false },
      { id: 'egg_puff', name: 'Egg Puff', price: 25, category: 'Snacks', isVeg: false },
    ],
    orders: [
      {
        id: 'ORD-001',
        createdAt: '2026-11-04T05:30:00.000Z', // In Asia/Kolkata: 11:00 AM on 2026-11-04
        orderStatus: 'CLAIMED',
        paymentStatus: 'PAID',
        paymentMethod: 'UPI',
        totalAmount: 49,
        discountAmount: 10,
        items: [
          { id: 'samosa', name: 'Samosa', price: 12, quantity: 2 },
          { id: 'chicken_puff', name: 'Chicken Puff', price: 30, quantity: 1 },
        ],
      },
      {
        id: 'ORD-002',
        createdAt: '2026-11-04T08:00:00.000Z', // In Asia/Kolkata: 1:30 PM on 2026-11-04
        orderStatus: 'CONFIRMED',
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        totalAmount: 25,
        discountAmount: 0,
        items: [
          { id: 'veg_puff', name: 'Veg Puff', price: 25, quantity: 1 },
        ],
      },
      {
        id: 'ORD-OTHER-DAY',
        createdAt: '2026-11-03T08:00:00.000Z', // Yesterday
        orderStatus: 'CLAIMED',
        paymentStatus: 'PAID',
        paymentMethod: 'UPI',
        totalAmount: 100,
        items: [{ id: 'samosa', price: 12, quantity: 5 }],
      },
    ],
    payments: [
      {
        id: 'PAY-001',
        createdAt: '2026-11-04T05:30:00.000Z',
        orderId: 'ORD-001',
        amount: 44, // 54 - 10 discount = 44
        paymentStatus: 'PAID',
        paymentMethod: 'UPI',
      },
      {
        id: 'PAY-002',
        createdAt: '2026-11-04T08:00:00.000Z',
        orderId: 'ORD-002',
        amount: 25,
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
      },
    ],
    dailyReports: [],
  };

  const report = generateDailySalesReport(mockDb, '2026-11-04', 'AUTOMATED_SCHEDULED');

  assert.equal(report.date, '2026-11-04');
  assert.equal(report.triggerType, 'AUTOMATED_SCHEDULED');

  // Revenue calculation:
  // ORD-001: 2 Samosas (24) + 1 Chicken Puff (30) = 54 gross. Discount 10.
  // ORD-002: 1 Veg Puff (25) = 25 gross. Discount 0.
  // Gross sales = 54 + 25 = 79.
  // Total discounts = 10.
  // Net revenue = 69.
  assert.equal(report.revenueSummary.grossSales, 79);
  assert.equal(report.revenueSummary.totalDiscounts, 10);
  assert.equal(report.revenueSummary.netRevenue, 69);

  // Product sales table:
  // Samosa: 2 units sold, 24 sales
  // Chicken Puff: 1 unit sold, 30 sales
  // Veg Puff: 1 unit sold, 25 sales
  // Egg Puff: 0 units sold, 0 sales (MUST BE INCLUDED!)
  assert.equal(report.productWiseSales.length, 4);

  const eggPuff = report.productWiseSales.find((p) => p.id === 'egg_puff');
  assert.ok(eggPuff, 'Egg Puff with 0 sales must be in product sales table');
  assert.equal(eggPuff.unitsSold, 0);
  assert.equal(eggPuff.totalSales, 0);
  assert.equal(eggPuff.revenuePercentage, 0);

  // Rank #1: Samosa (2 units sold)
  assert.equal(report.productWiseSales[0].id, 'samosa');
  assert.equal(report.productWiseSales[0].rank, 1);
  assert.equal(report.productWiseSales[0].unitsSold, 2);

  // Payment Breakdown
  assert.equal(report.revenueSummary.paymentMethodBreakdown.upi.count, 1);
  assert.equal(report.revenueSummary.paymentMethodBreakdown.upi.amount, 44);
  assert.equal(report.revenueSummary.paymentMethodBreakdown.cash.count, 1);
  assert.equal(report.revenueSummary.paymentMethodBreakdown.cash.amount, 25);

  // Final totals
  assert.equal(report.finalTotals.totalOrders, 2);
  assert.equal(report.finalTotals.totalUnitsSold, 4);

  // Idempotency: re-running on same date updates in-place
  const updatedReport = generateDailySalesReport(mockDb, '2026-11-04', 'MANUAL_ADMIN');
  assert.equal(mockDb.dailyReports.length, 1, 'Idempotency: exactly 1 report must exist for 2026-11-04');
  assert.equal(updatedReport.triggerType, 'MANUAL_ADMIN');
});

test('DAILY REPORT CSV: Produces valid RFC 4180 CSV with business headers and all product rows', () => {
  const mockReport = {
    reportId: 'DSR-20261104-173000',
    date: '2026-11-04',
    kolkataTimestamp: '2026-11-04 17:30:00 IST',
    operationalHours: '08:00 AM - 05:30 PM IST (9.5 hrs)',
    triggerType: 'AUTOMATED_SCHEDULED',
    revenueSummary: {
      grossSales: 1500,
      totalDiscounts: 100,
      netRevenue: 1400,
      paymentMethodBreakdown: {
        upi: { count: 35, amount: 1200 },
        card: { count: 0, amount: 0 },
        cash: { count: 5, amount: 200 },
        netbanking: { count: 0, amount: 0 },
        other: { count: 0, amount: 0 },
      },
    },
    productWiseSales: [
      { rank: 1, id: 'samosa', name: 'Samosa', category: 'Snacks', isVeg: true, unitPrice: 12, unitsSold: 50, totalSales: 600, revenuePercentage: 40 },
      { rank: 2, id: 'chicken_puff', name: 'Chicken Puff', category: 'Snacks', isVeg: false, unitPrice: 30, unitsSold: 30, totalSales: 900, revenuePercentage: 60 },
      { rank: 3, id: 'veg_puff', name: 'Veg Puff', category: 'Snacks', isVeg: true, unitPrice: 25, unitsSold: 0, totalSales: 0, revenuePercentage: 0 },
    ],
    orderLedger: {
      totalOrders: 40,
      completedOrders: 38,
      activeOrders: 2,
      cancelledOrders: 0,
      totalUnitsSold: 80,
      bestSeller: { name: 'Samosa', unitsSold: 50, totalSales: 600 },
    },
    paymentLedger: {
      totalInitiated: 40,
      totalSuccessful: 40,
      totalFailed: 0,
      totalRefunded: 0,
      refundAmount: 0,
      gatewayTransactionCount: 35,
      posCashCount: 5,
    },
    finalTotals: {
      reconciliationStatus: 'BALANCED',
      notes: 'Verified against gateway signatures',
    },
  };

  const csv = generateDailyReportCsv(mockReport);
  assert.ok(csv.includes('"NESTY CAMPUS CANTEEN - DAILY SALES & AUDIT REPORT"'));
  assert.ok(csv.includes('"DSR-20261104-173000"'));
  assert.ok(csv.includes('"Net Revenue Collected (INR)","1400"'));
  assert.ok(csv.includes('"Samosa"'));
  assert.ok(csv.includes('"Chicken Puff"'));
  assert.ok(csv.includes('"Veg Puff"'));
});

test('ADMIN DAILY REPORT APIS: Endpoints protect against student snooping, return reports and accounting CSV', async () => {
  const server = http.createServer(app);
  await new Promise((res) => server.listen(0, res));

  try {
    const adminToken = createAuthToken({
      email: 'admin@cvr.ac.in',
      role: 'admin',
      id: 'usr_admin_cvr',
    });
    const studentToken = createAuthToken({
      email: 'student_test@cvr.ac.in',
      role: 'student',
      id: 'usr_student_test',
    });

    // 1. Student access is blocked with 403
    const studentCheck = await requestJson(server, 'GET', '/api/admin/daily-reports', null, {
      Authorization: `Bearer ${studentToken}`,
    });
    assert.equal(studentCheck.status, 403);

    // 2. Admin can list reports (tested within 5:30 PM - 6:00 PM IST window)
    const windowHeader = { 'x-test-override-time': '2026-11-04T17:35:00+05:30' };
    const adminList = await requestJson(server, 'GET', '/api/admin/daily-reports', null, {
      Authorization: `Bearer ${adminToken}`,
      ...windowHeader,
    });
    assert.equal(adminList.status, 200);
    assert.ok(Array.isArray(adminList.data.reports));

    // 3. Admin can generate report on demand
    const generateRes = await requestJson(server, 'POST', '/api/admin/daily-reports/generate-now', { date: '2026-11-04' }, {
      Authorization: `Bearer ${adminToken}`,
      ...windowHeader,
    });
    assert.equal(generateRes.status, 200);
    assert.equal(generateRes.data.success, true);
    assert.equal(generateRes.data.report.date, '2026-11-04');

    // 4. Admin can fetch specific date report
    const dateRes = await requestJson(server, 'GET', '/api/admin/daily-reports/2026-11-04', null, {
      Authorization: `Bearer ${adminToken}`,
      ...windowHeader,
    });
    assert.equal(dateRes.status, 200);
    assert.equal(dateRes.data.report.date, '2026-11-04');

    // 5. Admin can download CSV export
    const csvRes = await requestJson(server, 'GET', '/api/admin/daily-reports/2026-11-04/csv', null, {
      Authorization: `Bearer ${adminToken}`,
      ...windowHeader,
    });
    assert.equal(csvRes.status, 200);
    assert.ok(csvRes.headers['content-type'].includes('text/csv'));
    assert.ok(typeof csvRes.data === 'string' && csvRes.data.includes('NESTY CAMPUS CANTEEN'));
  } finally {
    server.close();
  }
});

test('POS DEVICE SECURITY: Hardware device authentication, revocation, and alert logging', async () => {
  const server = http.createServer(app);
  await new Promise((res) => server.listen(0, res));

  try {
    const adminToken = createAuthToken({
      email: 'admin@cvr.ac.in',
      role: 'admin',
      id: 'usr_admin_cvr',
    });

    // 1. Admin lists registered POS devices
    const devicesRes = await requestJson(server, 'GET', '/api/admin/pos-devices', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(devicesRes.status, 200);
    assert.ok(devicesRes.data.devices.some((d) => d.deviceId === 'POS-1008-COUNTER1'));

    // 2. Admin registers a new POS device
    const regRes = await requestJson(server, 'POST', '/api/admin/pos-devices/register', {
      deviceId: 'POS-TEST-02',
      name: 'Counter 2 POS',
      model: '1008',
      apiKey: 'test_device_key_sec_123',
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(regRes.status, 200);
    assert.equal(regRes.data.device.deviceId, 'POS-TEST-02');

    // 3. POS API call with valid device headers succeeds
    const posValidRes = await requestJson(server, 'POST', '/api/pos/verify-order', { code: 'A1B' }, {
      'x-pos-device-id': 'POS-TEST-02',
      'x-pos-device-key': 'test_device_key_sec_123',
    });
    // Valid device auth passed (returns 404 for non-existent order, NOT 401 or 403)
    assert.notEqual(posValidRes.status, 401);
    assert.notEqual(posValidRes.status, 403);

    // 4. POS API call with invalid key is strictly rejected (401)
    const posInvalidRes = await requestJson(server, 'POST', '/api/pos/verify-order', { code: 'A1B' }, {
      'x-pos-device-id': 'POS-TEST-02',
      'x-pos-device-key': 'WRONG_KEY',
    });
    assert.equal(posInvalidRes.status, 401);

    // 5. Admin revokes the device
    const revokeRes = await requestJson(server, 'POST', '/api/admin/pos-devices/POS-TEST-02/revoke', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(revokeRes.status, 200);
    assert.equal(revokeRes.data.device.status, 'REVOKED');

    // 6. Revoked device is strictly blocked with 403 Forbidden
    const posBlockedRes = await requestJson(server, 'POST', '/api/pos/verify-order', { code: 'A1B' }, {
      'x-pos-device-id': 'POS-TEST-02',
      'x-pos-device-key': 'test_device_key_sec_123',
    });
    assert.equal(posBlockedRes.status, 403);
    assert.ok(posBlockedRes.data.message.includes('revoked'));

    // 7. Security Alerts are recorded for revoked device attempts
    const alertsRes = await requestJson(server, 'GET', '/api/admin/security-alerts', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(alertsRes.status, 200);
    assert.ok(alertsRes.data.alerts.some((a) => a.type === 'REVOKED_POS_ATTEMPT'));
  } finally {
    server.close();
  }
});

test('SESSION SECURITY: Token logout revocation and refresh token exchange', async () => {
  const server = http.createServer(app);
  await new Promise((res) => server.listen(0, res));

  try {
    const adminUser = {
      email: 'admin@cvr.ac.in',
      role: 'admin',
      id: 'usr_admin_cvr',
      name: 'Nesty Canteen Admin',
    };
    const token = createAuthToken(adminUser);

    // 1. Token works on /api/auth/me
    const meRes = await requestJson(server, 'GET', '/api/auth/me', null, {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.data.user.email, 'admin@cvr.ac.in');

    // 2. Logout revokes token
    const logoutRes = await requestJson(server, 'POST', '/api/auth/logout', null, {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(logoutRes.status, 200);
    assert.equal(logoutRes.data.success, true);

    // 3. Revoked token can no longer access /api/auth/me (401)
    const revokedRes = await requestJson(server, 'GET', '/api/auth/me', null, {
      Authorization: `Bearer ${token}`,
    });
    assert.equal(revokedRes.status, 401);

    // 4. Test Token Refresh with fresh token
    const freshToken = createAuthToken(adminUser);
    const refreshRes = await requestJson(server, 'POST', '/api/auth/refresh-token', null, {
      Authorization: `Bearer ${freshToken}`,
    });
    assert.equal(refreshRes.status, 200);
    assert.equal(refreshRes.data.success, true);
    assert.ok(refreshRes.data.token, 'Must return a fresh token');
    assert.notEqual(refreshRes.data.token, freshToken, 'Refreshed token must be newly generated');
  } finally {
    server.close();
    try {
      if (fs.existsSync(isolatedDbFile)) {
        fs.unlinkSync(isolatedDbFile);
      }
    } catch {}
    delete process.env.DATABASE_FILE_PATH;
  }
});
