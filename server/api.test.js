import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from './index.js';

function requestJson(server, method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: addr.port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, data: raw });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test('Nesty Shared Web + Android Backend Verification Suite', async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  t.after(() => {
    server.close();
  });

  let studentToken = '';
  let adminToken = '';

  await t.test('1. Vendor login is strictly rejected while Student & Admin logins succeed', async () => {
    const vendorAttempt = await requestJson(server, 'POST', '/api/auth/login', {
      identifier: 'vendor@cvr.ac.in',
      password: 'vendor123',
    });
    assert.equal(vendorAttempt.status, 403);
    assert.equal(vendorAttempt.data.success, false);

    const studentLogin = await requestJson(server, 'POST', '/api/auth/login', {
      identifier: 'student@cvr.ac.in',
      password: 'student123',
    });
    assert.equal(studentLogin.status, 200);
    assert.equal(studentLogin.data.success, true);
    assert.equal(studentLogin.data.user.role, 'student');
    studentToken = studentLogin.data.token;

    const adminLogin = await requestJson(server, 'POST', '/api/auth/login', {
      identifier: 'admin@cvr.ac.in',
      password: 'admin123',
    });
    assert.equal(adminLogin.status, 200);
    assert.equal(adminLogin.data.success, true);
    assert.equal(adminLogin.data.user.role, 'admin');
    adminToken = adminLogin.data.token;
  });

  await t.test('2. Server-side Admin authorization blocks students from adding products & persists admin products to student menu', async () => {
    const unauthorizedAttempt = await requestJson(
      server,
      'POST',
      '/api/admin/menu',
      {
        name: 'Unauthorized Snack',
        price: 50,
      },
      { Authorization: `Bearer ${studentToken}` }
    );
    assert.equal(unauthorizedAttempt.status, 403);
    assert.equal(unauthorizedAttempt.data.success, false);

    const adminCreate = await requestJson(
      server,
      'POST',
      '/api/admin/menu',
      {
        id: 'paneer_puff_test',
        name: 'Paneer Tikka Puff',
        description: 'Spiced paneer puff baked fresh in the Nesty oven.',
        price: 35,
        category: 'Bakery',
        unit: 'pcs',
        isVeg: true,
        isAvailable: true,
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.equal(adminCreate.status, 200);
    assert.equal(adminCreate.data.success, true);

    const studentMenu = await requestJson(server, 'GET', '/api/menu');
    assert.equal(studentMenu.status, 200);
    const found = studentMenu.data.items.find((i) => i.id === 'paneer_puff_test');
    assert.ok(found, 'Newly added admin product must appear on the student menu');
    assert.equal(found.price, 35);
  });

  await t.test('3. Verified student order creates Order ID & Transaction ID without generating any QR code, and QR scanner never marks unpaid orders as paid', async () => {
    const orderRes = await requestJson(
      server,
      'POST',
      '/api/orders',
      {
        studentEmail: 'student@cvr.ac.in',
        studentName: 'Aarav Reddy',
        block: 'CB',
        items: [{ id: 'samosa', name: 'Samosa', price: 12, quantity: 2, isVeg: true }],
        totalAmount: 24,
        discount: 0,
        coinsRedeemed: 0,
        paymentMethod: 'Razorpay UPI',
        transactionId: 'TXN-WEB-TEST-901',
      },
      { Authorization: `Bearer ${studentToken}` }
    );
    assert.equal(orderRes.status, 200);
    assert.equal(orderRes.data.success, true);
    assert.equal(orderRes.data.order.transactionId, 'TXN-WEB-TEST-901');
    assert.equal('qrCode' in orderRes.data.order, false, 'Order must not contain any QR code field');

    const failedOrderRes = await requestJson(server, 'POST', '/api/payment-failed', {
      studentEmail: 'student@cvr.ac.in',
      studentName: 'Aarav Reddy',
      block: 'CB',
      items: [{ id: 'veg_puff', name: 'Veg Puff', price: 25, quantity: 1, isVeg: true }],
      amount: 25,
      paymentMethod: 'Razorpay Online Gateway',
      error: { description: 'Declined by bank' },
    });
    assert.equal(failedOrderRes.status, 200);
    const failedId = failedOrderRes.data.order.id;

    // Scanning the failed order ID must NOT mark it as paid!
    const scanFailed = await requestJson(server, 'POST', '/api/orders/validate-qr', {
      rawValue: failedId,
    });
    assert.equal(scanFailed.data.valid, false);
    assert.equal(scanFailed.data.type, 'ORDER_RECEIPT');

    // Scanning a valid counter code works
    const scanCounter = await requestJson(server, 'POST', '/api/orders/validate-qr', {
      rawValue: 'NESTY-COUNTER-CB',
    });
    assert.equal(scanCounter.data.valid, true);
    assert.equal(scanCounter.data.type, 'CAMPUS_COUNTER');
  });
});
