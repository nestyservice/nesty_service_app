import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  app,
  _testOtpStores,
  generatePickupToken,
  validateProductionSecrets,
  INSECURE_DEFAULT_JWT_SECRET,
  INSECURE_DEFAULT_ADMIN_PASSWORD,
} from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

test('NESTY Complete End-to-End System Verification Suite (Requirements 1-11)', async (t) => {
  // Ensure test mode for mock email dispatcher
  process.env.NODE_ENV = 'test';

  // 1. ISOLATE DATABASE FIXTURE: Ensure nesty_shared_db.json is 100% clean and untouched
  const dataDir = path.join(__dirname, 'data');
  const originalDbFile = path.join(dataDir, 'nesty_shared_db.json');
  const isolatedDbFile = path.join(dataDir, `nesty_test_fixture_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.json`);

  // Copy real db to isolated test fixture before any test runs
  fs.copyFileSync(originalDbFile, isolatedDbFile);
  process.env.DATABASE_FILE_PATH = path.relative(process.cwd(), isolatedDbFile);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  t.after(() => {
    server.close();
    try {
      if (fs.existsSync(isolatedDbFile)) {
        fs.unlinkSync(isolatedDbFile);
      }
    } catch {}
    delete process.env.DATABASE_FILE_PATH;
  });

  const uniqueSuffix = Date.now();
  const testStudentEmail = `test_student_${uniqueSuffix}@cvr.ac.in`;
  const testStudentRoll = `24B81A${Math.floor(1000 + Math.random() * 9000)}`;
  const testStudentPassword = 'InitialSecurePass123';
  let createdToken = '';
  let adminToken = '';

  // Get admin token for admin operations
  const adminLoginRes = await requestJson(server, 'POST', '/api/auth/login', {
    identifier: 'admin@cvr.ac.in',
    password: 'admin123',
  });
  assert.equal(adminLoginRes.status, 200, 'Admin login should succeed');
  adminToken = adminLoginRes.data.token;

  // -------------------------------------------------------------------------
  // TEST A: Signup with a valid college email sends a real OTP.
  // -------------------------------------------------------------------------
  await t.test('Test A: Signup with a valid college email sends an OTP and returns requiresVerification', async () => {
    const regRes = await requestJson(server, 'POST', '/api/auth/register-student', {
      email: testStudentEmail,
      password: testStudentPassword,
      name: 'Test Student',
      phone: '9848012345',
      rollNo: testStudentRoll,
    });

    assert.equal(regRes.status, 201, 'Registration endpoint should return 201 Created');
    assert.equal(regRes.data.success, true);
    assert.equal(regRes.data.requiresVerification, true);
    assert.equal('otp' in regRes.data, false, 'OTP must NEVER be exposed in API response');
  });

  // -------------------------------------------------------------------------
  // TEST B: The account is not active before correct OTP verification.
  // -------------------------------------------------------------------------
  await t.test('Test B: The account is not active before correct OTP verification', async () => {
    // Attempt login before OTP verification
    const loginAttempt = await requestJson(server, 'POST', '/api/auth/login', {
      identifier: testStudentEmail,
      password: testStudentPassword,
    });

    // Must be rejected with 403 requiresVerification
    assert.equal(loginAttempt.status, 403, 'Unverified account login must be blocked');
    assert.equal(loginAttempt.data.requiresVerification, true);
  });

  // -------------------------------------------------------------------------
  // TEST C: An incorrect or expired OTP cannot create an account.
  // -------------------------------------------------------------------------
  await t.test('Test C: An incorrect or expired OTP cannot create an account', async () => {
    // C1. Incorrect OTP
    const wrongOtpRes = await requestJson(server, 'POST', '/api/auth/verify-email/confirm', {
      email: testStudentEmail,
      otp: '000000',
    });
    assert.equal(wrongOtpRes.status, 400);
    assert.equal(wrongOtpRes.data.success, false);
    assert.equal(wrongOtpRes.data.message, 'Invalid OTP');

    // C2. Expired OTP
    _testOtpStores.emailVerificationOtps.set(testStudentEmail, {
      otpHash: crypto.createHash('sha256').update('123456').digest('hex'),
      expiresAt: Date.now() - 5000, // expired
      attempts: 0,
    });
    const expiredOtpRes = await requestJson(server, 'POST', '/api/auth/verify-email/confirm', {
      email: testStudentEmail,
      otp: '123456',
    });
    assert.equal(expiredOtpRes.status, 400);
    assert.equal(expiredOtpRes.data.success, false);
    assert.ok(expiredOtpRes.data.message.toLowerCase().includes('expired'));
  });

  // -------------------------------------------------------------------------
  // TEST D: Correct OTP creates exactly one persistent account.
  // -------------------------------------------------------------------------
  await t.test('Test D: Correct OTP creates exactly one persistent account', async () => {
    const validOtp = '554433';
    _testOtpStores.emailVerificationOtps.set(testStudentEmail, {
      otpHash: crypto.createHash('sha256').update(validOtp).digest('hex'),
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
      cooldownUntil: Date.now() + 60 * 1000,
    });

    const confirmRes = await requestJson(server, 'POST', '/api/auth/verify-email/confirm', {
      email: testStudentEmail,
      otp: validOtp,
    });

    assert.equal(confirmRes.status, 200, 'Correct OTP confirmation must return 200 OK');
    assert.equal(confirmRes.data.success, true);
    assert.ok(confirmRes.data.token, 'Must return signed auth session token');
    assert.equal(confirmRes.data.user.email, testStudentEmail);
    assert.equal(confirmRes.data.user.emailVerified, true);
    createdToken = confirmRes.data.token;
  });

  // -------------------------------------------------------------------------
  // TEST E: The newly registered credentials work immediately after verification.
  // -------------------------------------------------------------------------
  await t.test('Test E: Newly registered credentials work immediately after verification', async () => {
    // E1. Login with email
    const loginEmailRes = await requestJson(server, 'POST', '/api/auth/login', {
      identifier: testStudentEmail,
      password: testStudentPassword,
    });
    assert.equal(loginEmailRes.status, 200);
    assert.equal(loginEmailRes.data.success, true);
    assert.ok(loginEmailRes.data.token);
    assert.equal(loginEmailRes.data.user.email, testStudentEmail);

    // E2. Login with roll number
    const loginRollRes = await requestJson(server, 'POST', '/api/auth/login', {
      identifier: testStudentRoll,
      password: testStudentPassword,
    });
    assert.equal(loginRollRes.status, 200);
    assert.equal(loginRollRes.data.success, true);
    assert.equal(loginRollRes.data.user.email, testStudentEmail);
  });

  // -------------------------------------------------------------------------
  // TEST F: Logout and login again work with the same credentials.
  // -------------------------------------------------------------------------
  await t.test('Test F: Logout and login again work with the same credentials without OTP', async () => {
    // Subsequent login must proceed directly without requiring another OTP
    const reLoginRes = await requestJson(server, 'POST', '/api/auth/login', {
      identifier: testStudentEmail,
      password: testStudentPassword,
    });
    assert.equal(reLoginRes.status, 200);
    assert.equal(reLoginRes.data.success, true);
    assert.ok(reLoginRes.data.token);
    assert.equal('requiresVerification' in reLoginRes.data, false, 'No OTP required on subsequent login');
  });

  // -------------------------------------------------------------------------
  // TEST G: Account records survive server restart / persistent DB.
  // -------------------------------------------------------------------------
  await t.test('Test G: Account records survive persistent DB reloads', async () => {
    // Verify user is in database file
    const meRes = await requestJson(server, 'GET', '/api/auth/me', null, {
      Authorization: `Bearer ${createdToken}`,
    });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.data.user.email, testStudentEmail);
    assert.equal(meRes.data.user.rollNo, testStudentRoll);
  });

  // -------------------------------------------------------------------------
  // TEST H: Duplicate signup and resend requests do not create duplicate accounts.
  // -------------------------------------------------------------------------
  await t.test('Test H: Duplicate signup and resend requests do not create duplicate accounts', async () => {
    // Attempting to register an already verified student email returns 409 Conflict
    const dupRes = await requestJson(server, 'POST', '/api/auth/register-student', {
      email: testStudentEmail,
      password: 'AnotherPassword999',
      name: 'Duplicate Student',
      phone: '9848012345',
      rollNo: testStudentRoll,
    });
    assert.equal(dupRes.status, 409, 'Duplicate registration must be rejected with 409');
    assert.equal(dupRes.data.success, false);

    // Resend OTP for verified user confirms already verified
    const resendRes = await requestJson(server, 'POST', '/api/auth/verify-email/send-otp', {
      email: testStudentEmail,
    });
    assert.equal(resendRes.status, 200);
    assert.ok(resendRes.data.message.toLowerCase().includes('already verified'));
  });

  // -------------------------------------------------------------------------
  // TEST I: Forgot Password sends an OTP and correct OTP allows password reset.
  // -------------------------------------------------------------------------
  await t.test('Test I: Forgot Password sends an OTP and allows password reset', async () => {
    const forgotSend = await requestJson(server, 'POST', '/api/auth/forgot-password/send-otp', {
      email: testStudentEmail,
    });
    assert.equal(forgotSend.status, 200);
    assert.equal(forgotSend.data.success, true);
    assert.equal('otp' in forgotSend.data, false, 'OTP must not be exposed');

    // Wrong OTP reset attempt fails
    const wrongReset = await requestJson(server, 'POST', '/api/auth/forgot-password/verify-reset', {
      email: testStudentEmail,
      otp: '999999',
      newPassword: 'ResetPassword123',
    });
    assert.equal(wrongReset.status, 400);

    // Seed valid reset OTP
    const resetOtp = '612345';
    _testOtpStores.passwordResetOtps.set(testStudentEmail, {
      otpHash: crypto.createHash('sha256').update(resetOtp).digest('hex'),
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
      cooldownUntil: Date.now() + 60 * 1000,
    });

    const validReset = await requestJson(server, 'POST', '/api/auth/forgot-password/verify-reset', {
      email: testStudentEmail,
      otp: resetOtp,
      newPassword: 'ResetPassword123',
    });
    assert.equal(validReset.status, 200);
    assert.equal(validReset.data.success, true);

    // Old password fails
    const oldLogin = await requestJson(server, 'POST', '/api/auth/login', {
      identifier: testStudentEmail,
      password: testStudentPassword,
    });
    assert.equal(oldLogin.status, 401, 'Old password must no longer work');

    // New password succeeds
    const newLogin = await requestJson(server, 'POST', '/api/auth/login', {
      identifier: testStudentEmail,
      password: 'ResetPassword123',
    });
    assert.equal(newLogin.status, 200);
    createdToken = newLogin.data.token;
  });

  // -------------------------------------------------------------------------
  // TEST J & K: Change Password OTP flow in Profile.
  // -------------------------------------------------------------------------
  await t.test('Test J & K: Change Password OTP blocks invalid OTP and updates password on correct OTP', async () => {
    // J1. Send OTP
    const sendChangeRes = await requestJson(
      server,
      'POST',
      '/api/auth/change-password/send-otp',
      {},
      { Authorization: `Bearer ${createdToken}` }
    );
    assert.equal(sendChangeRes.status, 200);

    // J2. Wrong OTP displays exact message "Invalid OTP"
    const wrongChangeRes = await requestJson(
      server,
      'POST',
      '/api/auth/change-password/verify-update',
      { otp: '000000', newPassword: 'ChangedPassword456' },
      { Authorization: `Bearer ${createdToken}` }
    );
    assert.equal(wrongChangeRes.status, 400);
    assert.equal(wrongChangeRes.data.message, 'Invalid OTP', 'Must return exact message "Invalid OTP"');

    // J3. Expired OTP displays exact message "OTP expired. Please request a new OTP."
    _testOtpStores.changePasswordOtps.set(testStudentEmail, {
      otpHash: crypto.createHash('sha256').update('888888').digest('hex'),
      expiresAt: Date.now() - 5000,
      attempts: 0,
    });
    const expiredChangeRes = await requestJson(
      server,
      'POST',
      '/api/auth/change-password/verify-update',
      { otp: '888888', newPassword: 'ChangedPassword456' },
      { Authorization: `Bearer ${createdToken}` }
    );
    assert.equal(expiredChangeRes.status, 400);
    assert.equal(
      expiredChangeRes.data.message,
      'OTP expired. Please request a new OTP.',
      'Must return exact message "OTP expired. Please request a new OTP."'
    );

    // K. Correct OTP updates password
    const validChangeOtp = '987654';
    _testOtpStores.changePasswordOtps.set(testStudentEmail, {
      otpHash: crypto.createHash('sha256').update(validChangeOtp).digest('hex'),
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
    });
    const validChangeRes = await requestJson(
      server,
      'POST',
      '/api/auth/change-password/verify-update',
      { otp: validChangeOtp, newPassword: 'ChangedPassword456' },
      { Authorization: `Bearer ${createdToken}` }
    );
    assert.equal(validChangeRes.status, 200);
    assert.equal(validChangeRes.data.success, true);

    // Verify new password works on login
    const loginWithChanged = await requestJson(server, 'POST', '/api/auth/login', {
      identifier: testStudentEmail,
      password: 'ChangedPassword456',
    });
    assert.equal(loginWithChanged.status, 200);
  });

  // -------------------------------------------------------------------------
  // TEST L: Email provider failures are reported accurately without bypassing verification.
  // -------------------------------------------------------------------------
  await t.test('Test L: Email provider errors are reported honestly', async () => {
    const invalidEmailRes = await requestJson(server, 'POST', '/api/auth/register-student', {
      email: 'not-an-email',
      password: 'validPass123',
      name: 'Bad Email Student',
    });
    assert.equal(invalidEmailRes.status, 400);
    assert.equal(invalidEmailRes.data.success, false);
  });

  // -------------------------------------------------------------------------
  // TEST M: The static QR is completely removed.
  // -------------------------------------------------------------------------
  await t.test('Test M: The static vending QR endpoint is completely removed', async () => {
    const vendingQrRes = await requestJson(
      server,
      'GET',
      '/api/admin/vending-qr-config',
      null,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.equal(vendingQrRes.status, 404, 'Static vending QR endpoint must be 404 (removed)');
  });

  // -------------------------------------------------------------------------
  // TEST N: A verified payment receives exactly one 3-character token containing letters and numbers.
  // -------------------------------------------------------------------------
  let paidOrderObj = null;
  await t.test('Test N: Verified payment receives exactly one 3-character token containing letters and numbers', async () => {
    // Test the generator directly across 50 iterations
    for (let i = 0; i < 50; i++) {
      const tok = generatePickupToken();
      assert.equal(tok.length, 3, `Token "${tok}" must be exactly 3 characters`);
      assert.ok(/[A-Z]/.test(tok), `Token "${tok}" must contain at least one letter`);
      assert.ok(/[0-9]/.test(tok), `Token "${tok}" must contain at least one digit`);
      assert.equal(/^[A-Z0-9]{3}$/.test(tok), true, `Token "${tok}" must be alphanumeric uppercase`);
    }

    // Verify through payments/verify endpoint
    const rzpOrderId = `order_test_${Date.now()}`;
    const rzpPaymentId = `pay_rzp_token_${Date.now()}`;
    const secret = 'nesty_rzp_server_secret_key';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${rzpOrderId}|${rzpPaymentId}`)
      .digest('hex');

    const verifyRes = await requestJson(server, 'POST', '/api/payments/verify', {
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: signature,
      studentEmail: testStudentEmail,
      studentName: 'Test Student',
      studentPhone: '9848012345',
      items: [{ id: 'samosa', name: 'Samosa', price: 12, quantity: 2, isVeg: true }],
      totalAmount: 24,
    });

    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.data.success, true);
    assert.ok(verifyRes.data.order);
    assert.ok(verifyRes.data.pickupToken);
    const token = verifyRes.data.pickupToken;
    assert.equal(token.length, 3, 'Pickup token must be exactly 3 characters');
    assert.ok(/[A-Z]/.test(token), 'Pickup token must contain at least one letter');
    assert.ok(/[0-9]/.test(token), 'Pickup token must contain at least one digit');
    assert.equal(verifyRes.data.order.pickupToken, token);
    paidOrderObj = verifyRes.data.order;
  });

  // -------------------------------------------------------------------------
  // TEST O: Failed, cancelled, pending, and unverified payments receive no valid pickup token.
  // -------------------------------------------------------------------------
  await t.test('Test O: Failed or unverified payments receive no pickup token', async () => {
    const failedRes = await requestJson(server, 'POST', '/api/payment-failed', {
      studentEmail: testStudentEmail,
      items: [{ id: 'samosa', price: 12, quantity: 1 }],
      amount: 12,
      error: { description: 'Card declined' },
    });

    assert.equal(failedRes.status, 200);
    assert.equal(failedRes.data.order.paymentStatus, 'FAILED');
    assert.equal(
      Boolean(failedRes.data.order.pickupToken),
      false,
      'Failed payment must never have a pickup token'
    );
  });

  // -------------------------------------------------------------------------
  // TEST P: Repeated payment callbacks do not create multiple tokens or duplicate orders.
  // -------------------------------------------------------------------------
  await t.test('Test P: Repeated payment callbacks return the same order and token idempotently', async () => {
    assert.ok(paidOrderObj, 'Preceding paid order exists');

    const duplicateRes = await requestJson(server, 'POST', '/api/payments/verify', {
      razorpay_order_id: paidOrderObj.razorpayOrderId,
      razorpay_payment_id: paidOrderObj.transactionId,
      razorpay_signature: 'any_signature_for_duplicate',
      studentEmail: paidOrderObj.studentEmail,
      items: paidOrderObj.items,
      totalAmount: paidOrderObj.totalAmount,
    });

    assert.equal(duplicateRes.status, 200);
    assert.equal(duplicateRes.data.order.id, paidOrderObj.id, 'Must return same order ID');
    assert.equal(
      duplicateRes.data.pickupToken,
      paidOrderObj.pickupToken,
      'Must return identical pickup token on retry'
    );
  });

  // -------------------------------------------------------------------------
  // TEST Q: Student order history and admin order management display the correct token and order.
  // -------------------------------------------------------------------------
  await t.test('Test Q: Student order history and admin order management display correct token', async () => {
    // Q1. Student orders
    const studentOrdersRes = await requestJson(
      server,
      'GET',
      `/api/orders?email=${encodeURIComponent(testStudentEmail)}`,
      null,
      { Authorization: `Bearer ${createdToken}` }
    );
    assert.equal(studentOrdersRes.status, 200);
    const matchedStudentOrder = studentOrdersRes.data.orders.find((o) => o.id === paidOrderObj.id);
    assert.ok(matchedStudentOrder, 'Order must appear in student order history');
    assert.equal(matchedStudentOrder.pickupToken, paidOrderObj.pickupToken);

    // Q2. Admin orders search by pickupToken
    const adminSearchRes = await requestJson(
      server,
      'GET',
      `/api/admin/orders?search=${encodeURIComponent(paidOrderObj.pickupToken)}`,
      null,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.equal(adminSearchRes.status, 200);
    const matchedAdminOrder = adminSearchRes.data.orders.find((o) => o.id === paidOrderObj.id);
    assert.ok(matchedAdminOrder, 'Admin orders search by pickupToken must find the order');
    assert.equal(matchedAdminOrder.pickupToken, paidOrderObj.pickupToken);
  });

  // -------------------------------------------------------------------------
  // TEST R: Auto-restore verified student account endpoint works seamlessly.
  // -------------------------------------------------------------------------
  await t.test('Test R: Auto-restore verified student account persists student across resets', async () => {
    const timestamp = Date.now();
    const restoreEmail = `restore_student_${timestamp}@cvr.ac.in`;
    const restoreRoll = `24B81A${timestamp % 10000}`;
    const restorePhone = `98480${(timestamp % 90000) + 10000}`;
    const restoreRes = await requestJson(server, 'POST', '/api/auth/restore-verified-account', {
      email: restoreEmail,
      name: 'Restored Student',
      phone: restorePhone,
      rollNo: restoreRoll,
      password: 'mypassword123',
    });

    assert.equal(restoreRes.status, 200);
    assert.equal(restoreRes.data.success, true);
    assert.ok(restoreRes.data.token, 'Must return auth token upon restore');
    assert.equal(restoreRes.data.user.email, restoreEmail);

    // Verify ordinary login now works with the restored account
    const loginRes = await requestJson(server, 'POST', '/api/auth/login', {
      identifier: restoreEmail,
      password: 'mypassword123',
    });
    assert.equal(loginRes.status, 200);
    assert.equal(loginRes.data.success, true);

    // Verify phone login works with the restored account
    const phoneLoginRes = await requestJson(server, 'POST', '/api/auth/login', {
      identifier: restorePhone,
      password: 'mypassword123',
    });
    assert.equal(phoneLoginRes.status, 200);
    assert.equal(phoneLoginRes.data.success, true);
  });

  // -------------------------------------------------------------------------
  // TEST S: Menu uses local fast images without deliz-canteen URLs.
  // -------------------------------------------------------------------------
  await t.test('Test S: Menu catalog items use local instant images', async () => {
    const menuRes = await requestJson(server, 'GET', '/api/menu');
    assert.equal(menuRes.status, 200);
    assert.ok(menuRes.data.items.length > 0);
    for (const item of menuRes.data.items) {
      assert.ok(
        !item.image.includes('deliz-canteen.onrender.com'),
        `Item ${item.name} image must not use lagging deliz-canteen URL`
      );
      assert.ok(
        item.image.startsWith('/images/'),
        `Item ${item.name} image should use local /images/ path: got ${item.image}`
      );
    }
  });

  // -------------------------------------------------------------------------
  // TEST T: Admin Revenue Analytics endpoint security & calculation integrity.
  // -------------------------------------------------------------------------
  await t.test('Test T: Admin Revenue Analytics endpoint security and accurate calculations', async () => {
    // 1. Unauthenticated request must return 403 Forbidden
    const unauthRes = await requestJson(server, 'GET', '/api/admin/revenue/analytics');
    assert.equal(unauthRes.status, 403, 'Unauthenticated revenue request must be rejected');

    // 2. Student request must return 403 Forbidden
    const studentRes = await requestJson(server, 'GET', '/api/admin/revenue/analytics', null, {
      Authorization: `Bearer ${createdToken}`,
    });
    assert.equal(studentRes.status, 403, 'Student revenue request must be rejected');

    // 3. Admin request must return 200 OK with verified analytics payload
    const adminRevRes = await requestJson(server, 'GET', '/api/admin/revenue/analytics', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(adminRevRes.status, 200, 'Admin revenue request must return 200 OK');
    assert.equal(adminRevRes.data.success, true);

    const { summary, selectedDayReport, allTimeProductSales } = adminRevRes.data;
    assert.ok(summary, 'Must contain summary metrics');
    assert.ok(typeof summary.todayRevenue === 'number', 'todayRevenue must be number');
    assert.ok(typeof summary.totalHistoricalRevenue === 'number', 'totalHistoricalRevenue must be number');
    assert.ok(typeof summary.totalSuccessfulPayments === 'number', 'totalSuccessfulPayments must be number');
    assert.ok(typeof summary.totalProductsSold === 'number', 'totalProductsSold must be number');
    assert.ok(typeof summary.totalOrders === 'number', 'totalOrders must be number');
    assert.ok(typeof summary.timeRangeLabel === 'string', 'timeRangeLabel must be string');
    assert.ok(Array.isArray(summary.availableDates), 'availableDates must be array');

    assert.ok(selectedDayReport, 'Must contain selectedDayReport');
    assert.ok(typeof selectedDayReport.grossRevenue === 'number');
    assert.ok(typeof selectedDayReport.netRevenue === 'number');
    assert.ok(Array.isArray(selectedDayReport.transactions));
    assert.ok(Array.isArray(selectedDayReport.productSalesBreakdown));

    assert.ok(Array.isArray(allTimeProductSales), 'allTimeProductSales must be array');

    // 4. Test date-specific query parameter
    const testDate = summary.todayDate;
    const dateQueryRes = await requestJson(
      server,
      'GET',
      `/api/admin/revenue/analytics?date=${testDate}`,
      null,
      { Authorization: `Bearer ${adminToken}` }
    );
    assert.equal(dateQueryRes.status, 200);
    assert.equal(dateQueryRes.data.selectedDayReport.date, testDate);
  });

  // -------------------------------------------------------------------------
  // TEST U: Food image assets (Egg Puff, Chicken Puff, Veg Puff, Samosa) exist in WebP.
  // -------------------------------------------------------------------------
  await t.test('Test U: Food image assets mapped and optimized in WebP format', async () => {
    const publicImagesDir = path.join(process.cwd(), 'public', 'images');
    const requiredImages = ['egg-puff.webp', 'chicken-puff.webp', 'veg-puff.webp', 'samosa.webp'];

    for (const imgName of requiredImages) {
      const fullPath = path.join(publicImagesDir, imgName);
      assert.ok(fs.existsSync(fullPath), `Optimized image ${imgName} must exist at ${fullPath}`);
      const stats = fs.statSync(fullPath);
      assert.ok(stats.size > 1000, `Image ${imgName} size must be non-trivial (>1KB)`);
      assert.ok(stats.size < 200000, `Image ${imgName} must be optimized (<200KB for fast ~1s load)`);
    }
  });

  // =========================================================================
  // SECURITY TEST SUITES (SEC-T1 through SEC-T8)
  // =========================================================================

  await t.test('SEC-T1: Spoofed x-admin-email and x-admin-role headers without valid Bearer token are strictly rejected (403)', async () => {
    const spoofAttempt = await requestJson(
      server,
      'POST',
      '/api/admin/menu',
      { name: 'Spoofed Admin Item', price: 99 },
      { 'x-admin-email': 'admin@cvr.ac.in', 'x-admin-role': 'admin' }
    );
    assert.equal(spoofAttempt.status, 403, 'Unsigned x-admin-* headers must NOT grant admin access');
    assert.equal(spoofAttempt.data.success, false);
  });

  await t.test('SEC-T2: Student token cannot access admin endpoints or view other student records', async () => {
    const studentAdminAttempt = await requestJson(
      server,
      'GET',
      '/api/admin/students',
      null,
      { Authorization: `Bearer ${createdToken}` }
    );
    assert.equal(studentAdminAttempt.status, 403, 'Student token must be blocked from /api/admin/students');
  });

  await t.test('SEC-T3: IDOR prevention on GET /api/orders and GET /api/payments blocks unauthenticated and cross-student order snooping', async () => {
    // 1. Unauthenticated request to /api/orders must return 401
    const unauthOrders = await requestJson(server, 'GET', '/api/orders?email=admin@cvr.ac.in');
    assert.equal(unauthOrders.status, 401, 'Unauthenticated order queries must return 401');

    // 2. Unauthenticated request to /api/payments must return 401
    const unauthPayments = await requestJson(server, 'GET', '/api/payments?email=admin@cvr.ac.in');
    assert.equal(unauthPayments.status, 401, 'Unauthenticated payment queries must return 401');

    // 3. Student requesting other student's email gets ONLY their own orders
    const studentOrders = await requestJson(
      server,
      'GET',
      '/api/orders?email=admin@cvr.ac.in',
      null,
      { Authorization: `Bearer ${createdToken}` }
    );
    assert.equal(studentOrders.status, 200);
    for (const ord of studentOrders.data.orders) {
      assert.equal(ord.studentEmail.toLowerCase(), testStudentEmail.toLowerCase());
    }

    // 4. Student requesting other student's email gets ONLY their own payments
    const studentPayments = await requestJson(
      server,
      'GET',
      '/api/payments?email=admin@cvr.ac.in',
      null,
      { Authorization: `Bearer ${createdToken}` }
    );
    assert.equal(studentPayments.status, 200);
    for (const pmt of studentPayments.data.payments) {
      assert.equal(pmt.studentEmail.toLowerCase(), testStudentEmail.toLowerCase());
    }
  });

  await t.test('SEC-T4: Unauthorized password reset without OTP or credential is rejected (400)', async () => {
    const unauthReset = await requestJson(server, 'POST', '/api/auth/reset-password', {
      email: 'admin@cvr.ac.in',
      newPassword: 'hackedPassword123',
    });
    assert.equal(unauthReset.status, 400, 'Password reset without OTP or current password must fail');
    assert.equal(unauthReset.data.success, false);
  });

  await t.test('SEC-T5: Client-supplied price tampering (e.g. ₹1 for ₹25 puff) is overridden by authoritative catalog price', async () => {
    const tamperedOrder = await requestJson(
      server,
      'POST',
      '/api/orders',
      {
        studentEmail: testStudentEmail,
        block: 'CB',
        items: [{ id: 'veg_puff', name: 'Veg Puff', price: 1, quantity: 2, isVeg: true }],
        totalAmount: 2, // Attacker forged total
      },
      { Authorization: `Bearer ${createdToken}` }
    );
    assert.equal(tamperedOrder.status, 200);
    // Server must enforce real catalog price: 2 * ₹25 = ₹50
    assert.equal(tamperedOrder.data.order.items[0].price, 25, 'Catalog price must be 25');
    assert.equal(tamperedOrder.data.order.totalAmount, 50, 'Authoritative subtotal must be 50');
    assert.equal(tamperedOrder.data.order.finalAmount, 50, 'Final payable must be 50');
  });

  await t.test('SEC-T6: Student profile updates cannot tamper with role', async () => {
    const roleTamper = await requestJson(
      server,
      'PUT',
      '/api/auth/profile',
      { name: 'Student Hacker', role: 'admin' },
      { Authorization: `Bearer ${createdToken}` }
    );
    assert.equal(roleTamper.status, 200);
    assert.equal(roleTamper.data.user.role, 'student', 'Role must remain student');
  });

  await t.test('SEC-T7: Rate limiting protects auth endpoints against excessive brute-force attempts', async () => {
    // Attempt rapid consecutive password reset requests to trigger rate limit (max 5)
    let rateLimited = false;
    for (let i = 0; i < 7; i++) {
      const res = await requestJson(server, 'POST', '/api/auth/reset-password', {
        email: `ratelimit_${uniqueSuffix}@cvr.ac.in`,
        newPassword: 'short',
      });
      if (res.status === 429) {
        rateLimited = true;
        break;
      }
    }
    assert.equal(rateLimited, true, 'Rate limiter should return 429 when threshold exceeded');
  });

  await t.test('SEC-T8: Payment verification rejects invalid or omitted HMAC signature, and confirms authentic signature', async () => {
    // 1. Invalid signature must be rejected with 400
    const fakeSignatureRes = await requestJson(
      server,
      'POST',
      '/api/payments/verify',
      {
        razorpay_order_id: 'order_test_998877',
        razorpay_payment_id: 'pay_test_112233',
        razorpay_signature: 'invalid_forged_hmac_signature_00000000000000000000000000000000',
        studentEmail: testStudentEmail,
        items: [{ id: 'samosa', quantity: 1 }],
      },
      { Authorization: `Bearer ${createdToken}` }
    );
    assert.equal(fakeSignatureRes.status, 400, 'Invalid signature must be rejected with 400');
    assert.equal(fakeSignatureRes.data.success, false);

    // 2. Omitted signature without isTestPayment must be rejected with 400
    const omittedSigRes = await requestJson(
      server,
      'POST',
      '/api/payments/verify',
      {
        razorpay_order_id: 'order_test_998877',
        razorpay_payment_id: 'pay_test_445566',
        studentEmail: testStudentEmail,
        items: [{ id: 'samosa', quantity: 1 }],
      },
      { Authorization: `Bearer ${createdToken}` }
    );
    assert.equal(omittedSigRes.status, 400, 'Omitted signature must be rejected with 400');
    assert.equal(omittedSigRes.data.success, false);

    // 3. Authentic HMAC-SHA256 signature must be verified successfully
    const validOrderId = `order_live_${Date.now()}`;
    const validPaymentId = `pay_live_${Date.now()}`;
    const testSecret = process.env.RAZORPAY_KEY_SECRET || 'nesty_rzp_server_secret_key';
    const validSig = crypto
      .createHmac('sha256', testSecret)
      .update(`${validOrderId}|${validPaymentId}`)
      .digest('hex');

    const validSigRes = await requestJson(
      server,
      'POST',
      '/api/payments/verify',
      {
        razorpay_order_id: validOrderId,
        razorpay_payment_id: validPaymentId,
        razorpay_signature: validSig,
        studentEmail: testStudentEmail,
        items: [{ id: 'samosa', quantity: 2 }],
      },
      { Authorization: `Bearer ${createdToken}` }
    );
    assert.equal(validSigRes.status, 200, 'Valid signature must succeed');
    assert.equal(validSigRes.data.success, true);
    assert.equal(validSigRes.data.order.paymentStatus, 'PAID');
    assert.ok(validSigRes.data.order.pickupToken, 'Must generate valid pickup token');
  });

  // -------------------------------------------------------------------------
  // SECTION: PRODUCTION SECRET VALIDATION TESTS (SEC-PROD-1 to SEC-PROD-9)
  // -------------------------------------------------------------------------
  await t.test('SEC-PROD-1: In production, missing or blank JWT_SECRET fails validation', () => {
    const resMissing = validateProductionSecrets({
      NODE_ENV: 'production',
      JWT_SECRET: '',
      ADMIN_DEFAULT_PASSWORD: 'StrongProductionAdminPassword2026!',
    });
    assert.equal(resMissing.valid, false);
    assert.equal(resMissing.reason, 'INVALID_JWT_SECRET');
    assert.ok(resMissing.message.includes('JWT_SECRET'));

    const resWhitespace = validateProductionSecrets({
      NODE_ENV: 'production',
      JWT_SECRET: '   ',
      ADMIN_DEFAULT_PASSWORD: 'StrongProductionAdminPassword2026!',
    });
    assert.equal(resWhitespace.valid, false);
    assert.equal(resWhitespace.reason, 'INVALID_JWT_SECRET');

    const resUndefined = validateProductionSecrets({
      NODE_ENV: 'production',
      ADMIN_DEFAULT_PASSWORD: 'StrongProductionAdminPassword2026!',
    });
    assert.equal(resUndefined.valid, false);
    assert.equal(resUndefined.reason, 'INVALID_JWT_SECRET');
  });

  await t.test('SEC-PROD-2: In production, default or weak JWT_SECRET fails validation', () => {
    const resDefault = validateProductionSecrets({
      NODE_ENV: 'production',
      JWT_SECRET: INSECURE_DEFAULT_JWT_SECRET,
      ADMIN_DEFAULT_PASSWORD: 'StrongProductionAdminPassword2026!',
    });
    assert.equal(resDefault.valid, false);
    assert.equal(resDefault.reason, 'INVALID_JWT_SECRET');

    const resShort = validateProductionSecrets({
      NODE_ENV: 'production',
      JWT_SECRET: 'short_secret',
      ADMIN_DEFAULT_PASSWORD: 'StrongProductionAdminPassword2026!',
    });
    assert.equal(resShort.valid, false);
    assert.equal(resShort.reason, 'INVALID_JWT_SECRET');
  });

  await t.test('SEC-PROD-3: In production, missing or blank ADMIN_DEFAULT_PASSWORD fails validation', () => {
    const resMissing = validateProductionSecrets({
      NODE_ENV: 'production',
      JWT_SECRET: 'StrongProductionSecretKeyForNesty2026!',
      ADMIN_DEFAULT_PASSWORD: '',
    });
    assert.equal(resMissing.valid, false);
    assert.equal(resMissing.reason, 'INVALID_ADMIN_DEFAULT_PASSWORD');
    assert.ok(resMissing.message.includes('ADMIN_DEFAULT_PASSWORD'));

    const resWhitespace = validateProductionSecrets({
      NODE_ENV: 'production',
      JWT_SECRET: 'StrongProductionSecretKeyForNesty2026!',
      ADMIN_DEFAULT_PASSWORD: '   ',
    });
    assert.equal(resWhitespace.valid, false);
    assert.equal(resWhitespace.reason, 'INVALID_ADMIN_DEFAULT_PASSWORD');

    const resUndefined = validateProductionSecrets({
      NODE_ENV: 'production',
      JWT_SECRET: 'StrongProductionSecretKeyForNesty2026!',
    });
    assert.equal(resUndefined.valid, false);
    assert.equal(resUndefined.reason, 'INVALID_ADMIN_DEFAULT_PASSWORD');
  });

  await t.test('SEC-PROD-4: In production, default admin123 ADMIN_DEFAULT_PASSWORD fails validation', () => {
    const resDefault = validateProductionSecrets({
      NODE_ENV: 'production',
      JWT_SECRET: 'StrongProductionSecretKeyForNesty2026!',
      ADMIN_DEFAULT_PASSWORD: 'admin123',
    });
    assert.equal(resDefault.valid, false);
    assert.equal(resDefault.reason, 'INVALID_ADMIN_DEFAULT_PASSWORD');

    const resInsecureConst = validateProductionSecrets({
      NODE_ENV: 'production',
      JWT_SECRET: 'StrongProductionSecretKeyForNesty2026!',
      ADMIN_DEFAULT_PASSWORD: INSECURE_DEFAULT_ADMIN_PASSWORD,
    });
    assert.equal(resInsecureConst.valid, false);
    assert.equal(resInsecureConst.reason, 'INVALID_ADMIN_DEFAULT_PASSWORD');
  });

  await t.test('SEC-PROD-5: In production, valid strong secrets pass validation without leaking values', () => {
    const resValid = validateProductionSecrets({
      NODE_ENV: 'production',
      JWT_SECRET: 'StrongProductionSecretKeyForNesty2026!',
      ADMIN_DEFAULT_PASSWORD: 'StrongProductionAdminPassword2026!',
    });
    assert.equal(resValid.valid, true);
    assert.equal(resValid.reason, undefined);
  });

  await t.test('SEC-PROD-6: In development and test environments, missing secrets do not block execution', () => {
    const resDev = validateProductionSecrets({
      NODE_ENV: 'development',
    });
    assert.equal(resDev.valid, true);

    const resTest = validateProductionSecrets({
      NODE_ENV: 'test',
    });
    assert.equal(resTest.valid, true);
  });

  await t.test('SEC-PROD-7: Production server process terminates with exit code 1 when launched with insecure secrets', async () => {
    const { spawn } = await import('node:child_process');
    const serverScript = path.join(__dirname, 'index.js');

    const child = spawn(process.execPath, [serverScript], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        JWT_SECRET: '',
        ADMIN_DEFAULT_PASSWORD: 'StrongPassword123!',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    const exitCode = await new Promise((resolve) => {
      child.on('close', resolve);
    });

    assert.equal(exitCode, 1, 'Process must exit with status 1 on insecure production secrets');
    assert.ok(stderr.includes('FATAL CONFIGURATION ERROR'), 'Stderr must explain fatal error without secret leaks');
  });

  await t.test('SEC-PROD-8: In production mode, admin login strictly rejects default admin123 password', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalJwt = process.env.JWT_SECRET;
    const originalPass = process.env.ADMIN_DEFAULT_PASSWORD;
    try {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'StrongUniqueProductionKey2026!';
      process.env.ADMIN_DEFAULT_PASSWORD = 'StrongAdminPassword2026!';

      const loginRes = await requestJson(server, 'POST', '/api/auth/login', {
        identifier: 'admin@cvr.ac.in',
        password: 'admin123',
      });
      assert.equal(loginRes.status, 401, 'admin123 must be rejected with 401 in production');
      assert.equal(loginRes.data.success, false);
      assert.ok(loginRes.data.message.includes('Insecure default admin password cannot be used in production'));
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalJwt !== undefined) process.env.JWT_SECRET = originalJwt; else delete process.env.JWT_SECRET;
      if (originalPass !== undefined) process.env.ADMIN_DEFAULT_PASSWORD = originalPass; else delete process.env.ADMIN_DEFAULT_PASSWORD;
    }
  });

  await t.test('SEC-PROD-9: In production mode, runtime guard rejects requests with 503 if production secrets are invalid', async () => {
    const prevEnv = process.env.NODE_ENV;
    const prevJwt = process.env.JWT_SECRET;
    try {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = '';
      const pingRes = await requestJson(server, 'GET', '/api/menu');
      assert.equal(pingRes.status, 503, 'Must return 503 Service Unavailable when production secrets are misconfigured');
      assert.equal(pingRes.data.error, 'SERVICE_UNAVAILABLE');
    } finally {
      process.env.NODE_ENV = prevEnv;
      if (prevJwt !== undefined) {
        process.env.JWT_SECRET = prevJwt;
      } else {
        delete process.env.JWT_SECRET;
      }
    }
  });
});

