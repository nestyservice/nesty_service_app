import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { calculateProductCounts, calculateRevenueAnalytics } from './index.js';

test('PRODUCT COUNT: Authoritative calculation reflects orders accurately and handles 0 cleanly', (t) => {
  const dbPath = path.join(process.cwd(), 'server', 'data', 'nesty_shared_db.json');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  const counts = calculateProductCounts(db);
  assert(Array.isArray(counts), 'calculateProductCounts should return an array');
  assert(counts.length > 0, 'Catalog should contain items');

  for (const item of counts) {
    assert(typeof item.id === 'string', 'Item should have an id');
    assert(typeof item.name === 'string', 'Item should have a name');
    assert(typeof item.totalOrdered === 'number', 'totalOrdered should be a number');
    assert(item.totalOrdered >= 0, 'totalOrdered should be non-negative');
  }

  // With 0 active test orders, all items start at 0
  const samosa = counts.find((c) => c.name.toLowerCase().includes('samosa'));
  assert(samosa, 'Samosa should be in product counts');
  assert.strictEqual(samosa.totalOrdered, 0, 'Samosa starts at 0 when no orders exist');

  // Test dynamic calculation with a simulated confirmed order
  const mockDb = {
    ...db,
    orders: [
      {
        id: 'SIM-001',
        paymentStatus: 'PAID',
        orderStatus: 'PENDING_PICKUP',
        items: [{ id: 'samosa', name: 'Samosa', price: 12, quantity: 5 }],
      },
      {
        id: 'SIM-002',
        paymentStatus: 'FAILED', // should be excluded
        orderStatus: 'CANCELLED',
        items: [{ id: 'samosa', name: 'Samosa', price: 12, quantity: 10 }],
      },
    ],
  };
  const dynamicCounts = calculateProductCounts(mockDb);
  const dynamicSamosa = dynamicCounts.find((c) => c.name.toLowerCase().includes('samosa'));
  assert.strictEqual(dynamicSamosa.totalOrdered, 5, 'Dynamic calculation accurately counts only PAID confirmed orders');
});

test('ADMIN CLEANUP: Test students and test orders completely removed from active database', (t) => {
  const dbPath = path.join(process.cwd(), 'server', 'data', 'nesty_shared_db.json');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  // Legitimate admin must exist
  const admin = db.users.find((u) => u.email.toLowerCase() === 'admin@cvr.ac.in');
  assert(admin, 'Admin account admin@cvr.ac.in must exist');
  assert.strictEqual(admin.role, 'admin', 'Admin role must be admin');

  // Test students must NOT exist in active db.users
  const testStudentAarav = db.users.find((u) => u.email.toLowerCase() === 'student@cvr.ac.in' || u.name?.toLowerCase().includes('aarav'));
  assert.strictEqual(testStudentAarav, undefined, 'Aarav Reddy (student@cvr.ac.in) must be removed from active users');

  const testStudentNikilesh = db.users.find((u) => u.email.toLowerCase() === '22b81a0501@cvr.ac.in' || u.name?.toLowerCase().includes('nikilesh'));
  assert.strictEqual(testStudentNikilesh, undefined, 'Nikilesh Kumar (22b81a0501@cvr.ac.in) must be removed from active users');

  const dummyUsers = db.users.filter((u) => u.email.includes('test_student_') || u.email.includes('fresh_student_'));
  assert.strictEqual(dummyUsers.length, 0, 'No dummy test student accounts in active users list');

  // Active orders and payments must be clean of test orders
  assert.strictEqual(db.orders.length, 0, 'Active orders list must be clean of test orders');
  assert.strictEqual(db.payments.length, 0, 'Active payments list must be clean of test payments');

  // Audit trail of archived records must exist safely
  assert(db.archivedTestRecords, 'db.archivedTestRecords audit trail must exist');
  assert(Array.isArray(db.archivedTestRecords.users), 'Archived users list exists');
  assert(db.archivedTestRecords.users.length > 0, 'Archived test accounts must be documented');
  assert(Array.isArray(db.archivedTestRecords.orders), 'Archived orders list exists');
  assert(db.archivedTestRecords.orders.length > 0, 'Archived test orders must be documented');
});

test('REVENUE ANALYTICS: Clean database calculates 0 revenue accurately without crash or fake data', (t) => {
  const dbPath = path.join(process.cwd(), 'server', 'data', 'nesty_shared_db.json');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  const analytics = calculateRevenueAnalytics(db, '');
  assert(analytics, 'Analytics object must be returned');
  assert(analytics.summary, 'Summary must exist');
  assert.strictEqual(analytics.summary.todayRevenue, 0, "Today's revenue is 0 when clean");
  assert.strictEqual(analytics.summary.totalHistoricalRevenue, 0, 'Total historical revenue is 0 when clean');
  assert.strictEqual(analytics.summary.totalSuccessfulPayments, 0, 'Total successful payments is 0 when clean');
  assert.strictEqual(analytics.summary.totalOrders, 0, 'Total orders is 0 when clean');

  // Test with simulated genuine payment
  const mockDb = {
    ...db,
    orders: [
      {
        id: 'REAL-001',
        studentEmail: 'real_student@cvr.ac.in',
        studentName: 'Real Student',
        finalAmount: 120,
        totalAmount: 120,
        paymentStatus: 'PAID',
        createdAt: new Date().toISOString(),
        items: [{ id: 'samosa', name: 'Samosa', price: 12, quantity: 10, isVeg: true }],
      },
    ],
    payments: [
      {
        id: 'pmt_real_001',
        orderId: 'REAL-001',
        studentEmail: 'real_student@cvr.ac.in',
        amount: 120,
        status: 'PAID',
        createdAt: new Date().toISOString(),
      },
    ],
  };
  const realAnalytics = calculateRevenueAnalytics(mockDb, '');
  assert.strictEqual(realAnalytics.summary.totalHistoricalRevenue, 120, 'Revenue accurately sums confirmed payments');
  assert.strictEqual(realAnalytics.summary.totalSuccessfulPayments, 1, 'Successful payments count is 1');
});
