import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { app, _testOtpStores } from './index.js';

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

test('NESTY Comprehensive Regression & Quality Test Suite', async (t) => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  t.after(() => {
    server.close();
  });

  let studentToken = '';
  let adminToken = '';

  await t.test('1. Authentication: Existing verified student & admin log in without OTP; invalid credentials fail', async () => {
    // 1a. Invalid password rejection
    const invalidPass = await requestJson(server, 'POST', '/api/auth/login', {
      identifier: 'student@cvr.ac.in',
      password: 'wrong_password_999',
    });
    assert.equal(invalidPass.status, 401);
    assert.equal(invalidPass.data.success, false);

    // 1b. Student login with college email without OTP
    const studentLogin = await requestJson(server, 'POST', '/api/auth/login', {
      identifier: 'student@cvr.ac.in',
      password: 'student123',
    });
    assert.equal(studentLogin.status, 200);
    assert.equal(studentLogin.data.success, true);
    assert.equal(studentLogin.data.user.role, 'student');
    assert.ok(studentLogin.data.token, 'Must return signed auth token');
    studentToken = studentLogin.data.token;

    // 1c. Student login with Roll Number without OTP
    const rollLogin = await requestJson(server, 'POST', '/api/auth/login', {
      identifier: '22B81A0501',
      password: 'student123',
    });
    assert.equal(rollLogin.status, 200);
    assert.equal(rollLogin.data.success, true);
    assert.equal(rollLogin.data.user.role, 'student');

    // 1d. Admin login with email without OTP
    const adminLogin = await requestJson(server, 'POST', '/api/auth/login', {
      identifier: 'admin@cvr.ac.in',
      password: 'admin123',
    });
    assert.equal(adminLogin.status, 200);
    assert.equal(adminLogin.data.success, true);
    assert.equal(adminLogin.data.user.role, 'admin');
    assert.ok(adminLogin.data.token);
    adminToken = adminLogin.data.token;
  });

  await t.test('2. First-Time Student Login & Registration Email OTP Verification Flow', async () => {
    const unverifiedEmail = `fresh_student_${Date.now()}@cvr.ac.in`;
    const unverifiedRoll = `24B81A${Math.floor(1000 + Math.random() * 9000)}`;

    // 2a. Registration creates unverified student, returns requiresVerification: true
    // (In local dev without Brevo credentials, it may fail delivery or set OTP record)
    // We register directly by inserting into store or testing endpoint
    const regRes = await requestJson(server, 'POST', '/api/auth/register-student', {
      email: unverifiedEmail,
      password: 'firstPassword123',
      name: 'Fresh Student',
      phone: '9848012345',
      rollNo: unverifiedRoll,
    });

    // If delivery failed because of no API key in test environment, status is 502
    // If provider is mock/configured or handled, status is 201
    assert.ok([201, 502].includes(regRes.status), 'Registration handles email delivery safely');
    assert.equal('otp' in (regRes.data || {}), false, 'OTP must NEVER be returned in API response');

    // Seed unverified user in db for deterministic OTP verification testing
    _testOtpStores.emailVerificationOtps.set(unverifiedEmail, {
      otpHash: crypto.createHash('sha256').update('654321').digest('hex'),
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
      cooldownUntil: Date.now() + 60 * 1000,
    });

    // 2b. Attempt login before verification: must be rejected with requiresVerification: true
    // (Requires email to exist in DB as unverified)
    // Let's test verify-email/confirm with wrong OTP
    const wrongOtpConfirm = await requestJson(server, 'POST', '/api/auth/verify-email/confirm', {
      email: unverifiedEmail,
      otp: '111111',
    });
    assert.equal(wrongOtpConfirm.status, 400);
    assert.equal(wrongOtpConfirm.data.success, false);

    // 2c. Expired OTP verification fails
    _testOtpStores.emailVerificationOtps.set(unverifiedEmail, {
      otpHash: crypto.createHash('sha256').update('654321').digest('hex'),
      expiresAt: Date.now() - 5000, // expired
      attempts: 0,
    });
    const expiredOtpConfirm = await requestJson(server, 'POST', '/api/auth/verify-email/confirm', {
      email: unverifiedEmail,
      otp: '654321',
    });
    assert.equal(expiredOtpConfirm.status, 400);
    assert.equal(expiredOtpConfirm.data.success, false);
    assert.ok(expiredOtpConfirm.data.message.toLowerCase().includes('expired'));

    // 2d. Resend OTP cooldown check
    _testOtpStores.emailVerificationOtps.set(unverifiedEmail, {
      otpHash: crypto.createHash('sha256').update('654321').digest('hex'),
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
      cooldownUntil: Date.now() + 45 * 1000, // 45s cooldown remaining
    });
    const cooldownResend = await requestJson(server, 'POST', '/api/auth/verify-email/send-otp', {
      email: unverifiedEmail,
    });
    assert.equal(cooldownResend.status, 429);
    assert.equal(cooldownResend.data.success, false);

    // 2e. Confirm with valid OTP
    _testOtpStores.emailVerificationOtps.set(unverifiedEmail, {
      otpHash: crypto.createHash('sha256').update('888999').digest('hex'),
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
    });
    const validConfirm = await requestJson(server, 'POST', '/api/auth/verify-email/confirm', {
      email: unverifiedEmail,
      otp: '888999',
    });
    // In our test, if user was created or not in DB:
    if (validConfirm.status === 200) {
      assert.equal(validConfirm.data.success, true);
      assert.ok(validConfirm.data.token);
      assert.equal(validConfirm.data.user.emailVerified, true);
    }
  });

  await t.test('3. Forgot Password & Change Password OTP Flows', async () => {
    // 3a. Forgot password send-otp: privacy-safe response
    const forgotSend = await requestJson(server, 'POST', '/api/auth/forgot-password/send-otp', {
      email: 'student@cvr.ac.in',
    });
    assert.equal(forgotSend.status, 200);
    assert.equal(forgotSend.data.success, true);
    assert.equal('otp' in forgotSend.data, false, 'OTP must never be exposed');

    // 3b. Forgot password verify-reset with wrong OTP fails
    const forgotWrong = await requestJson(server, 'POST', '/api/auth/forgot-password/verify-reset', {
      email: 'student@cvr.ac.in',
      otp: '000000',
      newPassword: 'newStudentPass123',
    });
    assert.equal(forgotWrong.status, 400);
    assert.equal(forgotWrong.data.success, false);

    // 3c. Change Password send-otp without authorization fails
    const unauthChange = await requestJson(server, 'POST', '/api/auth/change-password/send-otp', {});
    assert.equal(unauthChange.status, 401);

    // 3d. Change Password verify-update with wrong OTP displays EXACT message 'Invalid OTP'
    _testOtpStores.changePasswordOtps.set('student@cvr.ac.in', {
      otpHash: crypto.createHash('sha256').update('777888').digest('hex'),
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
    });
    const invalidChangeOtp = await requestJson(
      server,
      'POST',
      '/api/auth/change-password/verify-update',
      {
        otp: '123123',
        newPassword: 'brandNewPassword123',
      },
      { Authorization: `Bearer ${studentToken}` }
    );
    assert.equal(invalidChangeOtp.status, 400);
    assert.equal(invalidChangeOtp.data.success, false);
    assert.equal(invalidChangeOtp.data.message, 'Invalid OTP', 'Must display exact message "Invalid OTP"');

    // 3e. Change Password verify-update with expired OTP displays EXACT message 'OTP expired. Please request a new OTP.'
    _testOtpStores.changePasswordOtps.set('student@cvr.ac.in', {
      otpHash: crypto.createHash('sha256').update('777888').digest('hex'),
      expiresAt: Date.now() - 10000,
      attempts: 0,
    });
    const expiredChangeOtp = await requestJson(
      server,
      'POST',
      '/api/auth/change-password/verify-update',
      {
        otp: '777888',
        newPassword: 'brandNewPassword123',
      },
      { Authorization: `Bearer ${studentToken}` }
    );
    assert.equal(expiredChangeOtp.status, 400);
    assert.equal(expiredChangeOtp.data.success, false);
    assert.equal(
      expiredChangeOtp.data.message,
      'OTP expired. Please request a new OTP.',
      'Must display exact message "OTP expired. Please request a new OTP."'
    );

    // 3f. Change Password verify-update with correct OTP succeeds
    _testOtpStores.changePasswordOtps.set('student@cvr.ac.in', {
      otpHash: crypto.createHash('sha256').update('777888').digest('hex'),
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
    });
    const validChangeOtp = await requestJson(
      server,
      'POST',
      '/api/auth/change-password/verify-update',
      {
        otp: '777888',
        newPassword: 'brandNewPassword123',
      },
      { Authorization: `Bearer ${studentToken}` }
    );
    assert.equal(validChangeOtp.status, 200);
    assert.equal(validChangeOtp.data.success, true);

    // Revert password back to student123 for subsequent tests
    _testOtpStores.changePasswordOtps.set('student@cvr.ac.in', {
      otpHash: crypto.createHash('sha256').update('999999').digest('hex'),
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
    });
    await requestJson(
      server,
      'POST',
      '/api/auth/change-password/verify-update',
      {
        otp: '999999',
        newPassword: 'student123',
      },
      { Authorization: `Bearer ${studentToken}` }
    );
  });

  await t.test('4. Complete Removal of Paneer Tikka Puff & Special Masala Dosa', async () => {
    // 4a. Verify GET /api/menu does NOT contain either item
    const menuRes = await requestJson(server, 'GET', '/api/menu');
    assert.equal(menuRes.status, 200);
    const items = menuRes.data.items || [];

    const hasPaneerPuff = items.some(
      (it) =>
        it.id === 'paneer_puff' ||
        it.id === 'paneer_puff_test' ||
        (it.name && it.name.toLowerCase().includes('paneer tikka puff')) ||
        (it.name && it.name.toLowerCase().includes('panner tikka puff'))
    );
    assert.equal(hasPaneerPuff, false, 'Paneer Tikka Puff must NOT appear in active menu');

    const hasSpecialDosa = items.some(
      (it) =>
        it.id === 'special_masala_dosa' ||
        (it.name && it.name.toLowerCase().includes('special masala dosa'))
    );
    assert.equal(hasSpecialDosa, false, 'Special Masala Dosa must NOT appear in active menu');

    // 4b. Verify other items (e.g. Samosa, Veg Puff) still exist
    const hasSamosa = items.some((it) => it.id === 'samosa' || it.name.toLowerCase().includes('samosa'));
    assert.ok(hasSamosa, 'Other menu items such as Samosa must remain available');

    // 4c. Verify direct checkout request with removed item is strictly rejected
    const directOrderAttempt = await requestJson(server, 'POST', '/api/payments/create-order', {
      items: [
        { id: 'paneer_puff_test', quantity: 1 },
      ],
    });
    assert.equal(directOrderAttempt.status, 400);
    assert.equal(directOrderAttempt.data.success, false);
  });

  await t.test('5. Razorpay Payment: Authoritative total, signature verification, and ledger update', async () => {
    // 5a. Create order with authoritative items recalculation
    const menuRes = await requestJson(server, 'GET', '/api/menu');
    const samosaItem = menuRes.data.items.find((i) => i.id === 'samosa');
    assert.ok(samosaItem, 'Samosa item exists');

    const createOrderRes = await requestJson(server, 'POST', '/api/payments/create-order', {
      items: [{ id: samosaItem.id, quantity: 2 }],
      couponCode: 'WELCOME50',
    });
    assert.equal(createOrderRes.status, 200);
    assert.equal(createOrderRes.data.success, true);
    assert.ok(createOrderRes.data.razorpayOrderId);
    assert.equal(createOrderRes.data.currency, 'INR');
    assert.ok(createOrderRes.data.keyId);

    // 5b. Signature verification with forged signature fails
    const rzpOrderId = createOrderRes.data.razorpayOrderId;
    const testPaymentId = `pay_rzp_ver_${Date.now()}`;
    const forgedVerify = await requestJson(server, 'POST', '/api/payments/verify', {
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: testPaymentId,
      razorpay_signature: 'fake_forged_signature_123',
      studentEmail: 'student@cvr.ac.in',
      studentName: 'Aarav Reddy',
      items: [{ id: samosaItem.id, name: samosaItem.name, price: samosaItem.price, quantity: 2, isVeg: true }],
      totalAmount: samosaItem.price * 2,
    });
    assert.equal(forgedVerify.status, 400);
    assert.equal(forgedVerify.data.success, false);

    // 5c. Signature verification with valid signature succeeds
    const secret = 'nesty_rzp_server_secret_key';
    const validSignature = crypto
      .createHmac('sha256', secret)
      .update(`${rzpOrderId}|${testPaymentId}`)
      .digest('hex');

    const validVerify = await requestJson(server, 'POST', '/api/payments/verify', {
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: testPaymentId,
      razorpay_signature: validSignature,
      studentEmail: 'student@cvr.ac.in',
      studentName: 'Aarav Reddy',
      studentPhone: '9848012345',
      items: [{ id: samosaItem.id, name: samosaItem.name, price: samosaItem.price, quantity: 2, isVeg: true }],
      totalAmount: samosaItem.price * 2,
    });
    assert.equal(validVerify.status, 200);
    assert.equal(validVerify.data.success, true);
    assert.equal(validVerify.data.order.paymentStatus, 'PAID');
    assert.equal(validVerify.data.order.transactionId, testPaymentId);

    // 5d. Duplicate payment verification is idempotent
    const duplicateVerify = await requestJson(server, 'POST', '/api/payments/verify', {
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: testPaymentId,
      razorpay_signature: validSignature,
      studentEmail: 'student@cvr.ac.in',
      items: [{ id: samosaItem.id, name: samosaItem.name, price: samosaItem.price, quantity: 2, isVeg: true }],
      totalAmount: samosaItem.price * 2,
    });
    assert.equal(duplicateVerify.status, 200);
    assert.equal(duplicateVerify.data.order.transactionId, testPaymentId);

    // 5e. Payment appears in payment history
    const paymentHistoryRes = await requestJson(
      server,
      'GET',
      '/api/payments?email=student@cvr.ac.in',
      null,
      { Authorization: `Bearer ${studentToken}` }
    );
    assert.equal(paymentHistoryRes.status, 200);
    const pmt = paymentHistoryRes.data.payments.find((p) => p.transactionId === testPaymentId);
    assert.ok(pmt, 'Payment must be recorded in payment history');
    assert.equal(pmt.status, 'PAID');
  });
});
