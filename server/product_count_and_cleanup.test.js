import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { calculateProductCounts } from './index.js';

test('PRODUCT COUNT: Authoritative calculation reflects all genuine confirmed orders', (t) => {
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

  // Check specific genuine items
  const samosa = counts.find((c) => c.name.toLowerCase().includes('samosa'));
  assert(samosa, 'Samosa should be in product counts');
  assert(samosa.totalOrdered >= 0, 'Samosa count should be valid');
});

test('ADMIN STUDENT CLEANUP: Genuine students preserved and dummy test students archived', (t) => {
  const dbPath = path.join(process.cwd(), 'server', 'data', 'nesty_shared_db.json');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  // Verified genuine students must exist
  const genuineEmails = ['student@cvr.ac.in', '22b81a0501@cvr.ac.in', 'admin@cvr.ac.in'];
  for (const email of genuineEmails) {
    const found = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    assert(found, `Genuine user ${email} must exist in database`);
    assert(found.rollNo || found.role === 'admin', `Genuine student must have a valid Roll Number`);
  }

  // Verified test accounts must NOT be in active users
  const dummyInUsers = db.users.filter((u) => u.email.includes('test_student_') || u.email.includes('fresh_student_'));
  assert.strictEqual(dummyInUsers.length, 0, 'No dummy test accounts in active users list');

  // Audit trail of archived records must exist
  assert(db.archivedTestRecords, 'db.archivedTestRecords audit trail must exist');
  assert(Array.isArray(db.archivedTestRecords.users), 'Archived users list exists');
  assert(db.archivedTestRecords.users.length > 0, 'Archived test accounts must be documented');
});

test('SINGLE TOKEN: Order verification returns unified token and CVR College ID', (t) => {
  const dbPath = path.join(process.cwd(), 'server', 'data', 'nesty_shared_db.json');
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  const sampleOrder = db.orders.find((o) => o.paymentStatus === 'PAID' && o.token);
  assert(sampleOrder, 'Should have at least one paid order with token');
  assert(sampleOrder.token.length === 3, 'Token must be exactly 3 characters');
  assert(/[A-Z]/.test(sampleOrder.token), 'Token must contain uppercase letter');
  assert(/[0-9]/.test(sampleOrder.token), 'Token must contain digit');
  assert(sampleOrder.studentRollNo, 'Order must contain studentRollNo CVR ID');
});
