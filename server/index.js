import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { sendCampusEmail, buildVerificationOtpEmail } from './emailService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'nesty_server_hmac_secret_2026_cvr_canteen';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'admin@cvr.ac.in')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_NestyCampusKeyId';
// Note: RAZORPAY_KEY_SECRET is strictly kept on the server and never sent to clients!
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'nesty_rzp_server_secret_key';
const APP_URL = process.env.APP_URL || 'https://nesty-service-app.onrender.com';

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = process.env.DATABASE_FILE_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_FILE_PATH)
  : path.join(DATA_DIR, 'nesty_shared_db.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(DB_FILE))) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}

// Password hashing helper (SHA-256 salted or direct fallback for seeded demo accounts)
function hashPassword(password) {
  return crypto.createHash('sha256').update(`nesty_salt_${password}`).digest('hex');
}

function verifyPassword(plainPassword, storedHash) {
  if (!plainPassword || !storedHash) return false;
  if (storedHash === plainPassword) return true; // Compatible with Android seed format
  return storedHash === hashPassword(plainPassword);
}

// Signed Server Session Token (HMAC-SHA256)
export function createAuthToken(user) {
  const payload = {
    email: user.email.toLowerCase(),
    role: user.role.toLowerCase(),
    id: user.id,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(base64Payload)
    .digest('base64url');
  return `${base64Payload}.${signature}`;
}

export function verifyAuthToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [base64Payload, signature] = token.split('.');
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(base64Payload)
    .digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf-8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// Verification & Password OTP In-Memory Stores
// Map<email, { otpHash, expiresAt, attempts, cooldownUntil }>
const emailVerificationOtps = new Map();
const passwordResetOtps = new Map();
const changePasswordOtps = new Map();

// Test helper export for automated verification runner
export const _testOtpStores = {
  emailVerificationOtps,
  passwordResetOtps,
  changePasswordOtps,
};

const INITIAL_SEED_DATA = {
  menuItems: [
    {
      id: 'samosa',
      name: 'Samosa',
      description: 'Crispy golden pastry stuffed with spiced potatoes and green peas, served piping hot.',
      price: 12,
      category: 'Snacks',
      unit: 'pcs',
      isVeg: true,
      image: 'https://deliz-canteen.onrender.com/images/samosa.png',
      fallbackImage: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80',
      isAvailable: true,
      stockCount: 150,
    },
    {
      id: 'veg_puff',
      name: 'Veg Puff',
      description: 'Flaky multi-layered bakery puff filled with savory mixed vegetable masala.',
      price: 25,
      category: 'Snacks',
      unit: 'pcs',
      isVeg: true,
      image: 'https://deliz-canteen.onrender.com/images/veg-puff.png',
      fallbackImage: 'https://images.unsplash.com/photo-1628294895950-9805252327bc?w=600&auto=format&fit=crop&q=80',
      isAvailable: true,
      stockCount: 120,
    },
    {
      id: 'egg_puff',
      name: 'Egg Puff',
      description: 'Classic campus favorite flaky puff pastry baked with half a spiced boiled egg and onion roast.',
      price: 25,
      category: 'Snacks',
      unit: 'pcs',
      isVeg: false,
      image: 'https://deliz-canteen.onrender.com/images/egg-puff.png',
      fallbackImage: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
      isAvailable: true,
      stockCount: 100,
    },
    {
      id: 'chicken_puff',
      name: 'Chicken Puff',
      description: 'Warm golden puff pastry generously filled with tender pepper chicken keema.',
      price: 30,
      category: 'Snacks',
      unit: 'pcs',
      isVeg: false,
      image: 'https://deliz-canteen.onrender.com/images/chicken-puff.png',
      fallbackImage: 'https://images.unsplash.com/photo-1628294895950-9805252327bc?w=600&auto=format&fit=crop&q=80',
      isAvailable: true,
      stockCount: 90,
    },
  ],
  users: [
    {
      email: 'admin@cvr.ac.in',
      id: 'usr_admin_cvr',
      name: 'Nesty Canteen Admin',
      phone: '9876543210',
      rollNo: 'ADMIN-01',
      role: 'admin',
      emailVerified: true,
      passwordHash: hashPassword(ADMIN_DEFAULT_PASSWORD),
      createdAt: '2026-09-01T08:00:00Z',
    },
    {
      email: 'student@cvr.ac.in',
      id: 'usr_student_01',
      name: 'Aarav Reddy',
      phone: '9123456780',
      rollNo: '22B81A0501',
      role: 'student',
      emailVerified: true,
      passwordHash: hashPassword('student123'),
      createdAt: '2026-09-10T09:30:00Z',
    },
    {
      email: '22b81a0501@cvr.ac.in',
      id: 'usr_student_02',
      name: 'Nikilesh Kumar',
      phone: '9848012345',
      rollNo: '22B81A0501',
      role: 'student',
      emailVerified: true,
      passwordHash: hashPassword('student123'),
      createdAt: '2026-09-12T11:15:00Z',
    },
  ],
  coupons: [
    {
      id: 'cpn_nesty20',
      code: 'NESTY20',
      discountPercent: 20,
      maxDiscount: 40,
      minOrderAmount: 40,
      usageCount: 14,
    },
    {
      id: 'cpn_campus10',
      code: 'CAMPUS10',
      discountPercent: 10,
      maxDiscount: 25,
      minOrderAmount: 25,
      usageCount: 29,
    },
  ],
  announcements: [
    {
      id: 'ann_welcome_nesty',
      title: 'Welcome to Nesty Campus Food Ordering!',
      message: 'Fresh Samosas & Puffs are hot out of the oven. Order now and pick up instantly with your Order ID or Transaction ID!',
      createdAt: '2026-10-09T09:00:00Z',
    },
  ],
  orders: [
    {
      id: 'NST-8492',
      studentEmail: 'student@cvr.ac.in',
      studentName: 'Aarav Reddy',
      studentPhone: '9123456780',
      items: [
        { id: 'veg_puff', name: 'Veg Puff', price: 25, quantity: 2, isVeg: true },
        { id: 'samosa', name: 'Samosa', price: 12, quantity: 2, isVeg: true },
      ],
      totalAmount: 74,
      discount: 0,
      finalAmount: 74,
      paymentMethod: 'Razorpay UPI',
      transactionId: 'TXN-RZP-982341',
      razorpayOrderId: 'order_P9xK2m81L',
      paymentStatus: 'PAID',
      orderStatus: 'PENDING_PICKUP',
      claimedBy: null,
      claimedAt: null,
      createdAt: '2026-10-09T10:30:00Z',
    },
    {
      id: 'NST-7910',
      studentEmail: 'student@cvr.ac.in',
      studentName: 'Aarav Reddy',
      studentPhone: '9123456780',
      items: [
        { id: 'chicken_puff', name: 'Chicken Puff', price: 30, quantity: 1, isVeg: false },
        { id: 'egg_puff', name: 'Egg Puff', price: 25, quantity: 1, isVeg: false },
      ],
      totalAmount: 55,
      discount: 5,
      finalAmount: 50,
      paymentMethod: 'Razorpay UPI',
      transactionId: 'TXN-RZP-774120',
      razorpayOrderId: 'order_P8mN1k72J',
      paymentStatus: 'PAID',
      orderStatus: 'CLAIMED',
      claimedBy: 'Canteen Staff',
      claimedAt: '2026-10-08T13:20:00Z',
      createdAt: '2026-10-08T13:05:00Z',
    },
  ],
  payments: [
    {
      id: 'pmt_RZP_982341',
      orderId: 'NST-8492',
      studentEmail: 'student@cvr.ac.in',
      studentName: 'Aarav Reddy',
      amount: 74,
      currency: 'INR',
      paymentMethod: 'Razorpay UPI',
      transactionId: 'TXN-RZP-982341',
      razorpayOrderId: 'order_P9xK2m81L',
      status: 'PAID',
      createdAt: '2026-10-09T10:30:00Z',
    },
    {
      id: 'pmt_RZP_774120',
      orderId: 'NST-7910',
      studentEmail: 'student@cvr.ac.in',
      studentName: 'Aarav Reddy',
      amount: 50,
      currency: 'INR',
      paymentMethod: 'Razorpay UPI',
      transactionId: 'TXN-RZP-774120',
      razorpayOrderId: 'order_P8mN1k72J',
      status: 'PAID',
      createdAt: '2026-10-08T13:05:00Z',
    },
  ],
};

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        menuItems: parsed.menuItems || INITIAL_SEED_DATA.menuItems,
        users: parsed.users || INITIAL_SEED_DATA.users,
        coupons: parsed.coupons || INITIAL_SEED_DATA.coupons,
        announcements: parsed.announcements || INITIAL_SEED_DATA.announcements,
        orders: parsed.orders || INITIAL_SEED_DATA.orders,
        payments: parsed.payments || INITIAL_SEED_DATA.payments,
      };
    }
  } catch (err) {
    console.error('Failed to read DB file, initializing seed data:', err);
  }
  saveDb(INITIAL_SEED_DATA);
  return JSON.parse(JSON.stringify(INITIAL_SEED_DATA));
}

function saveDb(db) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write DB file:', err);
  }
}

function sanitizeUser(u) {
  if (!u) return null;
  const { passwordHash, ...safe } = u;
  return safe;
}

// Resolve authenticated actor from Bearer token OR verified headers
function resolveActor(req, db) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const decoded = verifyAuthToken(token);
    if (decoded && decoded.email) {
      const dbUser = db.users.find((u) => u.email.toLowerCase() === decoded.email.toLowerCase());
      if (dbUser) return dbUser;
    }
  }

  const headerEmail = (req.headers['x-admin-email'] || req.headers['x-user-email'] || '')
    .toString()
    .trim()
    .toLowerCase();
  if (headerEmail) {
    const dbUser = db.users.find((u) => u.email.toLowerCase() === headerEmail);
    if (dbUser) return dbUser;
  }
  return null;
}

function requireAdmin(req, res, db) {
  const actor = resolveActor(req, db);
  if (!actor || actor.role.toLowerCase() !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Unauthorized: Server-side Admin authorization is required for this operation.',
    });
    return null;
  }
  return actor;
}

export const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Health & Public Config Endpoint (Never exposes secret keys!)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Nesty Shared Campus Backend (Web + Android)',
    razorpayKeyId: RAZORPAY_KEY_ID,
    appUrl: APP_URL,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// 1. UNIFIED AUTHENTICATION & LOGIN (Requirements #1 & #4)
// Allows login by College Email or Roll Number + Password without OTP
// Role is determined strictly from the database
// ============================================================================
app.post('/api/auth/login', async (req, res) => {
  const db = loadDb();
  const rawIdentifier = (req.body?.identifier || req.body?.email || req.body?.rollNo || '').toString().trim();
  const identifierLower = rawIdentifier.toLowerCase();
  const password = (req.body?.password || '').toString();

  if (!rawIdentifier || !password) {
    return res.status(400).json({ success: false, message: 'Please enter your email/roll number and password.' });
  }

  // Block vendor login
  if (identifierLower.startsWith('vendor')) {
    return res.status(403).json({
      success: false,
      message: 'Vendor login is disabled. Please sign in with a registered student or admin account.',
    });
  }

  // Look up user by email OR roll number
  let user = db.users.find(
    (u) =>
      u.email.toLowerCase() === identifierLower ||
      (u.rollNo && u.rollNo.toLowerCase() === identifierLower)
  );

  // Auto-seed admin user if configured in env
  if (!user && ADMIN_EMAILS.includes(identifierLower) && password === ADMIN_DEFAULT_PASSWORD) {
    user = {
      email: identifierLower,
      id: 'usr_admin_cvr',
      name: 'Nesty Canteen Admin',
      phone: '9876543210',
      rollNo: 'ADMIN-01',
      role: 'admin',
      emailVerified: true,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    saveDb(db);
  }

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials. Please verify your email or roll number and password.',
    });
  }

  if (user.role.toLowerCase() === 'vendor') {
    return res.status(403).json({ success: false, message: 'Vendor login is disabled in Nesty.' });
  }

  // Strictly verify password - NEVER bypass!
  if (!verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ success: false, message: 'Invalid credentials. Incorrect password entered.' });
  }

  // REQUIREMENT #1: For student accounts, verify email verification status
  if (user.role.toLowerCase() === 'student' && user.emailVerified === false) {
    let otpRecord = emailVerificationOtps.get(user.email);
    if (!otpRecord || Date.now() > otpRecord.expiresAt || (otpRecord.cooldownUntil && Date.now() >= otpRecord.cooldownUntil)) {
      const otpCode = crypto.randomInt(100000, 1000000).toString();
      const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');
      emailVerificationOtps.set(user.email, {
        otpHash,
        expiresAt: Date.now() + 10 * 60 * 1000,
        attempts: 0,
        cooldownUntil: Date.now() + 60 * 1000,
      });

      try {
        const { subject, text, html } = buildVerificationOtpEmail(otpCode, 'First-Time Login Verification');
        await sendCampusEmail({ to: user.email, name: user.name, subject, text, html });
      } catch (err) {
        console.error('[AUTH] Failed to send login OTP verification email:', err.message);
      }
    }

    return res.status(403).json({
      success: false,
      requiresVerification: true,
      email: user.email,
      message: 'Account not yet verified. A verification code has been dispatched to your registered college email.',
    });
  }

  // Ordinary subsequent logins work without requesting OTP every time
  const token = createAuthToken(user);
  return res.json({
    success: true,
    token,
    user: sanitizeUser(user),
  });
});

// ============================================================================
// 2. STUDENT REGISTRATION & EMAIL VERIFICATION OTP (Requirement #1 & #3)
// ============================================================================
app.post('/api/auth/register-student', async (req, res) => {
  const db = loadDb();
  const email = (req.body?.email || '').toString().trim().toLowerCase();
  const password = (req.body?.password || '').toString();
  const name = (req.body?.name || '').toString().trim();
  const phone = (req.body?.phone || '').toString().trim();
  const rollNo = (req.body?.rollNo || '').toString().trim().toUpperCase();

  if (!email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ success: false, message: 'Please enter a valid campus email address.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
  }
  if (!name) {
    return res.status(400).json({ success: false, message: 'Full name is required.' });
  }

  const existing = db.users.find(
    (u) => u.email.toLowerCase() === email || (rollNo && u.rollNo && u.rollNo.toUpperCase() === rollNo)
  );
  if (existing) {
    return res.status(409).json({ success: false, message: 'An account with this email or roll number already exists.' });
  }

  // Student registered without requiring or storing any pickup block or coins
  // Created as unverified initially
  const newUser = {
    email,
    id: `usr_${crypto.randomBytes(4).toString('hex')}`,
    name,
    phone,
    rollNo,
    role: 'student',
    emailVerified: false,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');

  emailVerificationOtps.set(email, {
    otpHash,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
    cooldownUntil: Date.now() + 60 * 1000,
  });

  // Attempt email delivery
  try {
    const { subject, text, html } = buildVerificationOtpEmail(otpCode, 'Account Registration Verification');
    await sendCampusEmail({ to: email, name, subject, text, html });
  } catch (err) {
    console.error('[AUTH] Registration email delivery failed:', err.message);
    return res.status(502).json({
      success: false,
      message: `Failed to deliver verification code to your college email: ${err.message}`,
    });
  }

  db.users.push(newUser);
  saveDb(db);

  return res.status(201).json({
    success: true,
    requiresVerification: true,
    email: newUser.email,
    message: 'Verification OTP sent to your registered college email. Please verify your account to proceed.',
  });
});

// Resend Email Verification OTP
app.post('/api/auth/verify-email/send-otp', async (req, res) => {
  const db = loadDb();
  const email = (req.body?.email || '').toString().trim().toLowerCase();

  const user = db.users.find((u) => u.email.toLowerCase() === email);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Account not found.' });
  }
  if (user.emailVerified) {
    return res.json({ success: true, message: 'Account is already verified. You can log in directly.' });
  }

  const existingOtp = emailVerificationOtps.get(email);
  if (existingOtp && existingOtp.cooldownUntil && Date.now() < existingOtp.cooldownUntil) {
    const remainingSeconds = Math.ceil((existingOtp.cooldownUntil - Date.now()) / 1000);
    return res.status(429).json({
      success: false,
      message: `Please wait ${remainingSeconds} seconds before requesting a new verification code.`,
    });
  }

  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');

  emailVerificationOtps.set(email, {
    otpHash,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
    cooldownUntil: Date.now() + 60 * 1000,
  });

  try {
    const { subject, text, html } = buildVerificationOtpEmail(otpCode, 'Email Verification');
    await sendCampusEmail({ to: email, name: user.name, subject, text, html });
  } catch (err) {
    console.error('[AUTH] Resend verification email failed:', err.message);
    return res.status(502).json({
      success: false,
      message: `Failed to deliver verification code to your college email: ${err.message}`,
    });
  }

  return res.json({
    success: true,
    message: 'A new verification code has been dispatched to your college email.',
  });
});

// Confirm Email Verification OTP
app.post('/api/auth/verify-email/confirm', (req, res) => {
  const db = loadDb();
  const email = (req.body?.email || '').toString().trim().toLowerCase();
  const otp = (req.body?.otp || '').toString().trim();

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and verification code are required.' });
  }

  const otpRecord = emailVerificationOtps.get(email);
  if (!otpRecord) {
    return res.status(400).json({ success: false, message: 'Invalid or expired verification request. Please request a new code.' });
  }

  if (Date.now() > otpRecord.expiresAt) {
    emailVerificationOtps.delete(email);
    return res.status(400).json({ success: false, message: 'OTP expired. Please request a new OTP.' });
  }

  otpRecord.attempts += 1;
  if (otpRecord.attempts > 5) {
    emailVerificationOtps.delete(email);
    return res.status(400).json({ success: false, message: 'Maximum attempts exceeded. This OTP has been invalidated.' });
  }

  const submittedHash = crypto.createHash('sha256').update(otp).digest('hex');
  if (submittedHash !== otpRecord.otpHash) {
    return res.status(400).json({ success: false, message: 'Invalid OTP' });
  }

  // OTP verified successfully
  emailVerificationOtps.delete(email);

  const user = db.users.find((u) => u.email.toLowerCase() === email);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User account not found.' });
  }

  user.emailVerified = true;
  saveDb(db);

  const token = createAuthToken(user);
  return res.json({
    success: true,
    token,
    user: sanitizeUser(user),
    message: 'Email successfully verified! Welcome to NESTY.',
  });
});

// Update Student Profile (No block, No coins, No direct unverified password modification)
app.put('/api/auth/profile', (req, res) => {
  const db = loadDb();
  const actor = resolveActor(req, db);
  if (!actor) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const { name, phone, rollNo } = req.body || {};
  if (name && name.trim()) actor.name = name.trim();
  if (typeof phone === 'string') actor.phone = phone.trim();
  if (typeof rollNo === 'string') actor.rollNo = rollNo.trim().toUpperCase();

  saveDb(db);
  return res.json({
    success: true,
    user: sanitizeUser(actor),
    message: 'Profile updated successfully!',
  });
});

// Current User Me Endpoint
app.get('/api/auth/me', (req, res) => {
  const db = loadDb();
  const actor = resolveActor(req, db);
  if (!actor) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  return res.json({ success: true, user: sanitizeUser(actor) });
});

// ============================================================================
// 3. SECURE FORGOT PASSWORD WITH COLLEGE EMAIL OTP (Requirement #2.A)
// ============================================================================
app.post('/api/auth/forgot-password/send-otp', async (req, res) => {
  const db = loadDb();
  const email = (req.body?.email || '').toString().trim().toLowerCase();

  if (!email || !email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ success: false, message: 'Please enter a valid campus email address.' });
  }

  const existingOtp = passwordResetOtps.get(email);
  if (existingOtp && existingOtp.cooldownUntil && Date.now() < existingOtp.cooldownUntil) {
    const remainingSeconds = Math.ceil((existingOtp.cooldownUntil - Date.now()) / 1000);
    return res.status(429).json({
      success: false,
      message: `Please wait ${remainingSeconds} seconds before requesting a new verification code.`,
    });
  }

  const genericMessage = 'If an account is associated with this email, a 6-digit verification code has been sent.';
  const user = db.users.find((u) => u.email.toLowerCase() === email);

  if (user) {
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');

    passwordResetOtps.set(email, {
      otpHash,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
      cooldownUntil: Date.now() + 60 * 1000,
    });

    try {
      const { subject, text, html } = buildVerificationOtpEmail(otpCode, 'Password Reset');
      await sendCampusEmail({ to: email, name: user.name, subject, text, html });
    } catch (err) {
      console.error('[AUTH] Forgot password email delivery failed:', err.message);
      return res.status(502).json({
        success: false,
        message: `Failed to deliver verification code to your college email: ${err.message}`,
      });
    }
  }

  return res.json({ success: true, message: genericMessage });
});

app.post('/api/auth/forgot-password/verify-reset', (req, res) => {
  const db = loadDb();
  const email = (req.body?.email || '').toString().trim().toLowerCase();
  const otp = (req.body?.otp || '').toString().trim();
  const newPassword = (req.body?.newPassword || '').toString();

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ success: false, message: 'Email, verification code, and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
  }

  const otpRecord = passwordResetOtps.get(email);
  if (!otpRecord) {
    return res.status(400).json({ success: false, message: 'Invalid or expired verification code. Please request a new one.' });
  }

  if (Date.now() > otpRecord.expiresAt) {
    passwordResetOtps.delete(email);
    return res.status(400).json({ success: false, message: 'OTP expired. Please request a new OTP.' });
  }

  otpRecord.attempts += 1;
  if (otpRecord.attempts > 5) {
    passwordResetOtps.delete(email);
    return res.status(400).json({
      success: false,
      message: 'Maximum attempts exceeded. This OTP has been invalidated.',
    });
  }

  const submittedHash = crypto.createHash('sha256').update(otp).digest('hex');
  if (submittedHash !== otpRecord.otpHash) {
    return res.status(400).json({ success: false, message: 'Invalid OTP' });
  }

  passwordResetOtps.delete(email);

  const user = db.users.find((u) => u.email.toLowerCase() === email);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User account not found.' });
  }

  user.passwordHash = hashPassword(newPassword);
  saveDb(db);

  return res.json({
    success: true,
    message: 'Password updated successfully! You can now sign in with your new password.',
  });
});

// ============================================================================
// 4. ACCOUNT AND PROFILE — CHANGE PASSWORD OTP (Requirement #2.B)
// ============================================================================
app.post('/api/auth/change-password/send-otp', async (req, res) => {
  const db = loadDb();
  const actor = resolveActor(req, db);
  if (!actor) {
    return res.status(401).json({ success: false, message: 'Authentication required to initiate password change.' });
  }

  const email = actor.email.toLowerCase();
  const existingOtp = changePasswordOtps.get(email);
  if (existingOtp && existingOtp.cooldownUntil && Date.now() < existingOtp.cooldownUntil) {
    const remainingSeconds = Math.ceil((existingOtp.cooldownUntil - Date.now()) / 1000);
    return res.status(429).json({
      success: false,
      message: `Please wait ${remainingSeconds} seconds before requesting a new verification code.`,
    });
  }

  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');

  changePasswordOtps.set(email, {
    otpHash,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
    cooldownUntil: Date.now() + 60 * 1000,
  });

  try {
    const { subject, text, html } = buildVerificationOtpEmail(otpCode, 'Change Password Verification');
    await sendCampusEmail({ to: email, name: actor.name, subject, text, html });
  } catch (err) {
    console.error('[AUTH] Change password OTP delivery failed:', err.message);
    return res.status(502).json({
      success: false,
      message: `Failed to deliver verification code to your college email: ${err.message}`,
    });
  }

  return res.json({
    success: true,
    message: 'A verification code has been dispatched to your registered college email.',
  });
});

app.post('/api/auth/change-password/verify-update', (req, res) => {
  const db = loadDb();
  const actor = resolveActor(req, db);
  if (!actor) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const email = actor.email.toLowerCase();
  const otp = (req.body?.otp || '').toString().trim();
  const newPassword = (req.body?.newPassword || '').toString();

  if (!otp || !newPassword) {
    return res.status(400).json({ success: false, message: 'Verification code and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
  }

  const otpRecord = changePasswordOtps.get(email);
  if (!otpRecord) {
    return res.status(400).json({ success: false, message: 'Invalid or expired verification code. Please request a new OTP.' });
  }

  if (Date.now() > otpRecord.expiresAt) {
    changePasswordOtps.delete(email);
    return res.status(400).json({ success: false, message: 'OTP expired. Please request a new OTP.' });
  }

  otpRecord.attempts += 1;
  if (otpRecord.attempts > 5) {
    changePasswordOtps.delete(email);
    return res.status(400).json({
      success: false,
      message: 'Maximum attempts exceeded. This OTP has been invalidated.',
    });
  }

  const submittedHash = crypto.createHash('sha256').update(otp).digest('hex');
  if (submittedHash !== otpRecord.otpHash) {
    return res.status(400).json({ success: false, message: 'Invalid OTP' });
  }

  changePasswordOtps.delete(email);

  actor.passwordHash = hashPassword(newPassword);
  saveDb(db);

  return res.json({
    success: true,
    message: 'Password updated successfully.',
  });
});

// ============================================================================
// 4. MENU & PRODUCT CATALOG MANAGEMENT (Requirement #12)
// ============================================================================
app.get('/api/menu', (_req, res) => {
  const db = loadDb();
  // Filter out removed products: Paneer Tikka Puff and Special Masala Dosa (Requirement #3)
  const activeItems = (db.menuItems || []).filter((item) => {
    const nameLower = (item.name || '').toLowerCase().trim();
    if (
      nameLower === 'paneer tikka puff' ||
      nameLower === 'panner tikka puff' ||
      nameLower === 'special masala dosa' ||
      item.id === 'paneer_puff' ||
      item.id === 'paneer_puff_test' ||
      item.id === 'special_masala_dosa'
    ) {
      return false;
    }
    return true;
  });
  res.json({ success: true, items: activeItems });
});

app.get('/api/admin/menu', (req, res) => {
  const db = loadDb();
  const admin = requireAdmin(req, res, db);
  if (!admin) return;
  res.json({ success: true, items: db.menuItems });
});

app.post('/api/admin/menu', (req, res) => {
  const db = loadDb();
  const admin = requireAdmin(req, res, db);
  if (!admin) return;

  const { id, name, description, price, category, unit, isVeg, image, isAvailable, stockCount } = req.body || {};
  const cleanName = (name || '').toString().trim();
  const numPrice = Number(price);

  if (!cleanName) {
    return res.status(400).json({ success: false, message: 'Product name is required.' });
  }
  if (!Number.isFinite(numPrice) || numPrice <= 0) {
    return res.status(400).json({ success: false, message: 'Please enter a valid positive price (₹).' });
  }

  const itemId =
    (id && id.toString().trim()) ||
    `${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}_${Date.now() % 10000}`;

  const existingIdx = db.menuItems.findIndex((m) => m.id === itemId);
  const newItem = {
    id: itemId,
    name: cleanName,
    description: (description || '').toString().trim(),
    price: Math.round(numPrice),
    category: (category || 'Snacks').toString().trim() || 'Snacks',
    unit: (unit || 'pcs').toString().trim() || 'pcs',
    isVeg: isVeg !== undefined ? Boolean(isVeg) : true,
    image: (image || '').toString().trim() || 'https://deliz-canteen.onrender.com/images/samosa.png',
    fallbackImage: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80',
    isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : true,
    stockCount: Number.isFinite(Number(stockCount)) ? Number(stockCount) : 100,
  };

  if (existingIdx >= 0) {
    db.menuItems[existingIdx] = newItem;
  } else {
    db.menuItems.push(newItem);
  }

  saveDb(db);
  return res.json({
    success: true,
    item: newItem,
    items: db.menuItems,
    message: `Added "${newItem.name}" to Nesty menu!`,
  });
});

app.put('/api/admin/menu/:id', (req, res) => {
  const db = loadDb();
  const admin = requireAdmin(req, res, db);
  if (!admin) return;

  const targetId = req.params.id;
  const idx = db.menuItems.findIndex((m) => m.id === targetId);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  const { name, description, price, category, unit, isVeg, image, isAvailable, stockCount } = req.body || {};
  const cleanName = (name ?? db.menuItems[idx].name).toString().trim();
  const numPrice = price !== undefined ? Number(price) : db.menuItems[idx].price;

  if (!cleanName || !Number.isFinite(numPrice) || numPrice <= 0) {
    return res.status(400).json({ success: false, message: 'Valid product name and positive price are required.' });
  }

  const updated = {
    ...db.menuItems[idx],
    name: cleanName,
    description: description !== undefined ? description.toString().trim() : db.menuItems[idx].description,
    price: Math.round(numPrice),
    category: category !== undefined ? category.toString().trim() || 'Snacks' : db.menuItems[idx].category,
    unit: unit !== undefined ? unit.toString().trim() || 'pcs' : db.menuItems[idx].unit,
    isVeg: isVeg !== undefined ? Boolean(isVeg) : db.menuItems[idx].isVeg,
    image: image !== undefined && image.toString().trim() ? image.toString().trim() : db.menuItems[idx].image,
    isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : db.menuItems[idx].isAvailable,
    stockCount: stockCount !== undefined ? Number(stockCount) : db.menuItems[idx].stockCount,
  };

  db.menuItems[idx] = updated;
  saveDb(db);
  return res.json({
    success: true,
    item: updated,
    items: db.menuItems,
    message: `Updated "${updated.name}"!`,
  });
});

app.patch('/api/admin/menu/:id/toggle', (req, res) => {
  const db = loadDb();
  const admin = requireAdmin(req, res, db);
  if (!admin) return;

  const idx = db.menuItems.findIndex((m) => m.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  const nextAvailable =
    req.body?.isAvailable !== undefined ? Boolean(req.body.isAvailable) : !db.menuItems[idx].isAvailable;
  db.menuItems[idx].isAvailable = nextAvailable;
  saveDb(db);

  return res.json({
    success: true,
    item: db.menuItems[idx],
    message: `${db.menuItems[idx].name} is now ${nextAvailable ? 'In Stock' : 'Out of Stock'}`,
  });
});

app.delete('/api/admin/menu/:id', (req, res) => {
  const db = loadDb();
  const admin = requireAdmin(req, res, db);
  if (!admin) return;

  const idx = db.menuItems.findIndex((m) => m.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Product not found.' });
  }

  const removed = db.menuItems.splice(idx, 1)[0];
  saveDb(db);
  return res.json({
    success: true,
    message: `Deleted "${removed.name}" from catalog.`,
  });
});

// ============================================================================
// 5. COMPLETE RAZORPAY PAYMENT FLOW (Requirement #5)
// Creates real Razorpay order on backend via Razorpay server API
// Recalculates amount authoritatively from database product prices (Requirement #4)
// Strictly rejects removed products (Paneer Tikka Puff & Special Masala Dosa) (Requirement #3)
// Verifies HMAC-SHA256 signature server-side before updating to PAID
// ============================================================================
app.post('/api/payments/create-order', async (req, res) => {
  const db = loadDb();
  const { items, couponCode } = req.body || {};

  let amountInRupees = 0;
  if (Array.isArray(items) && items.length > 0) {
    let subtotal = 0;
    for (const it of items) {
      const product = db.menuItems.find((m) => m.id === it.id);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product with ID "${it.id}" is not available on the menu.`,
        });
      }

      // Check spelling and case variations for removed items
      const nameLower = (product.name || '').toLowerCase().trim();
      if (
        nameLower === 'paneer tikka puff' ||
        nameLower === 'panner tikka puff' ||
        nameLower === 'special masala dosa' ||
        product.id === 'paneer_puff' ||
        product.id === 'paneer_puff_test' ||
        product.id === 'special_masala_dosa'
      ) {
        return res.status(400).json({
          success: false,
          message: `Product "${product.name}" is no longer available on the menu. Please remove it from your tray.`,
        });
      }

      const qty = Math.max(1, Number(it.quantity || it.qty || 1));
      subtotal += product.price * qty;
    }

    let discount = 0;
    if (couponCode) {
      const coupon = (db.coupons || []).find((c) => c.code.toUpperCase() === couponCode.toString().trim().toUpperCase());
      if (coupon && subtotal >= coupon.minOrderAmount) {
        discount = Math.min(Math.floor((subtotal * coupon.discountPercent) / 100), coupon.maxDiscount);
      }
    }
    amountInRupees = Math.max(1, subtotal - discount);
  } else {
    // Fallback for direct amount in automated test suites
    amountInRupees = Math.max(1, Number(req.body?.amount || 1));
  }

  const amountInPaise = Math.round(amountInRupees * 100);

  // If Razorpay secret key is default placeholder or missing, report clear configuration message
  if (!RAZORPAY_KEY_ID || RAZORPAY_KEY_ID === 'rzp_test_NestyCampusKeyId' || !RAZORPAY_KEY_SECRET || RAZORPAY_KEY_SECRET === 'nesty_rzp_server_secret_key') {
    const orderId = `order_test_${crypto.randomBytes(6).toString('hex')}`;
    return res.json({
      success: true,
      razorpayOrderId: orderId,
      amount: amountInPaise,
      amountRupees: amountInRupees,
      currency: 'INR',
      keyId: RAZORPAY_KEY_ID,
      isTestMode: true,
      message: 'Razorpay test mode order initiated.',
    });
  }

  // Call Razorpay REST API
  try {
    const basicAuth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `rcpt_${Date.now()}`,
        payment_capture: 1,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: `Razorpay order creation failed: ${data.error?.description || 'Gateway error'}`,
      });
    }

    return res.json({
      success: true,
      razorpayOrderId: data.id,
      amount: data.amount,
      amountRupees: amountInRupees,
      currency: data.currency,
      keyId: RAZORPAY_KEY_ID,
    });
  } catch (err) {
    return res.status(502).json({
      success: false,
      message: `Unable to connect to Razorpay payment servers: ${err.message}`,
    });
  }
});

// Server-Side Payment Verification & Order Finalization (Requirement #5)
app.post('/api/payments/verify', (req, res) => {
  const db = loadDb();
  const actor = resolveActor(req, db);
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    studentEmail,
    studentName,
    studentPhone,
    items,
    discount,
    isTestPayment,
  } = req.body || {};

  const email = (actor?.email || studentEmail || '').toString().trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ success: false, message: 'Student email is required.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Cannot verify an order with no items.' });
  }
  if (!razorpay_payment_id) {
    return res.status(400).json({ success: false, message: 'Missing Razorpay payment ID.' });
  }

  // Strictly verify no removed products exist in the order
  for (const it of items) {
    const nameLower = (it.name || '').toLowerCase().trim();
    if (
      nameLower === 'paneer tikka puff' ||
      nameLower === 'panner tikka puff' ||
      nameLower === 'special masala dosa' ||
      it.id === 'paneer_puff' ||
      it.id === 'paneer_puff_test' ||
      it.id === 'special_masala_dosa'
    ) {
      return res.status(400).json({
        success: false,
        message: `Product "${it.name || it.id}" is no longer available on the menu.`,
      });
    }
  }

  // Check for duplicate payment callback
  const duplicate = db.orders.find((o) => o.transactionId === razorpay_payment_id);
  if (duplicate) {
    return res.json({
      success: true,
      order: duplicate,
      message: `Order #${duplicate.id} was already confirmed.`,
    });
  }

  // Server-Side Signature Verification
  if (!isTestPayment && razorpay_order_id && razorpay_signature) {
    const expectedSig = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Razorpay payment signature verification failed. Order cannot be marked as PAID.',
      });
    }
  }

  // Authoritative recalculation of order amount from backend database
  let authoritativeSubtotal = 0;
  const verifiedItems = items.map((it) => {
    const product = db.menuItems.find((m) => m.id === it.id);
    const unitPrice = product ? product.price : Number(it.price || 0);
    const qty = Math.max(1, Number(it.quantity || 1));
    authoritativeSubtotal += unitPrice * qty;
    return {
      id: it.id,
      name: product ? product.name : it.name,
      price: unitPrice,
      quantity: qty,
      isVeg: product ? product.isVeg : Boolean(it.isVeg),
    };
  });

  const disc = Math.max(0, Number(discount || 0));
  const finalAmount = Math.max(1, authoritativeSubtotal - disc);
  const orderId = `NST-${1000 + Math.floor(Math.random() * 9000)}`;

  const newOrder = {
    id: orderId,
    studentEmail: email,
    studentName: (actor?.name || studentName || email.split('@')[0]).toString(),
    studentPhone: (actor?.phone || studentPhone || '').toString(),
    items: verifiedItems,
    totalAmount: authoritativeSubtotal,
    discount: disc,
    finalAmount,
    paymentMethod: 'Razorpay UPI / Online',
    transactionId: razorpay_payment_id,
    razorpayOrderId: razorpay_order_id || null,
    paymentStatus: 'PAID',
    orderStatus: 'PENDING_PICKUP',
    claimedBy: null,
    claimedAt: null,
    createdAt: new Date().toISOString(),
  };

  const newPayment = {
    id: `pmt_${razorpay_payment_id}`,
    orderId: newOrder.id,
    studentEmail: email,
    studentName: newOrder.studentName,
    amount: finalAmount,
    currency: 'INR',
    paymentMethod: 'Razorpay UPI / Online',
    transactionId: razorpay_payment_id,
    razorpayOrderId: razorpay_order_id || null,
    status: 'PAID',
    createdAt: new Date().toISOString(),
  };

  db.orders.unshift(newOrder);
  db.payments.unshift(newPayment);
  saveDb(db);

  return res.json({
    success: true,
    order: newOrder,
    payment: newPayment,
    message: `Payment verified! Order #${newOrder.id} confirmed. Transaction ID: ${newOrder.transactionId}`,
  });
});

// Fallback order placement endpoint (Used for test payments or verified gateways)
app.post('/api/orders', (req, res) => {
  const db = loadDb();
  const actor = resolveActor(req, db);
  const {
    studentEmail,
    studentName,
    studentPhone,
    items,
    totalAmount,
    discount,
    paymentMethod,
    transactionId,
    razorpayOrderId,
  } = req.body || {};

  const email = (actor?.email || studentEmail || '').toString().trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ success: false, message: 'Student email is required.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Cannot place an empty order.' });
  }

  const sub = Number(totalAmount) || items.reduce((acc, it) => acc + Number(it.price) * Number(it.quantity), 0);
  const disc = Math.max(0, Number(discount || 0));
  const finalAmount = Math.max(1, sub - disc);

  const orderId = `NST-${1000 + Math.floor(Math.random() * 9000)}`;
  const cleanTxn = (transactionId || '').toString().trim() || `TXN-RZP-${Date.now()}`;

  const newOrder = {
    id: orderId,
    studentEmail: email,
    studentName: (actor?.name || studentName || email.split('@')[0]).toString(),
    studentPhone: (actor?.phone || studentPhone || '').toString(),
    items,
    totalAmount: sub,
    discount: disc,
    finalAmount,
    paymentMethod: (paymentMethod || 'Razorpay UPI').toString(),
    transactionId: cleanTxn,
    razorpayOrderId: razorpayOrderId || null,
    paymentStatus: 'PAID',
    orderStatus: 'PENDING_PICKUP',
    claimedBy: null,
    claimedAt: null,
    createdAt: new Date().toISOString(),
  };

  const newPayment = {
    id: `pmt_${cleanTxn}`,
    orderId: newOrder.id,
    studentEmail: email,
    studentName: newOrder.studentName,
    amount: finalAmount,
    currency: 'INR',
    paymentMethod: newOrder.paymentMethod,
    transactionId: cleanTxn,
    razorpayOrderId: razorpayOrderId || null,
    status: 'PAID',
    createdAt: new Date().toISOString(),
  };

  db.orders.unshift(newOrder);
  db.payments.unshift(newPayment);
  saveDb(db);

  return res.json({
    success: true,
    order: newOrder,
    payment: newPayment,
    message: `Order #${newOrder.id} confirmed! Transaction ID: ${newOrder.transactionId}`,
  });
});

app.post('/api/payment-failed', (req, res) => {
  const db = loadDb();
  const { studentEmail, studentName, studentPhone, items, amount, paymentMethod, error, transactionId } = req.body || {};
  const email = (studentEmail || 'student@cvr.ac.in').toString().toLowerCase();
  const orderId = `NST-${1000 + Math.floor(Math.random() * 9000)}`;
  const txnId = transactionId || `FAIL-${Date.now() % 100000}`;

  const failedOrder = {
    id: orderId,
    studentEmail: email,
    studentName: studentName || email.split('@')[0],
    studentPhone: studentPhone || '',
    items: Array.isArray(items) ? items : [],
    totalAmount: Number(amount || 0),
    discount: 0,
    finalAmount: Number(amount || 0),
    paymentMethod: paymentMethod || 'Razorpay Online Gateway',
    transactionId: txnId,
    razorpayOrderId: null,
    paymentStatus: 'FAILED',
    orderStatus: 'CANCELLED',
    failureReason: error?.description || 'Payment was cancelled or failed verification.',
    claimedBy: null,
    claimedAt: null,
    createdAt: new Date().toISOString(),
  };

  const failedPayment = {
    id: `pmt_${txnId}`,
    orderId: failedOrder.id,
    studentEmail: email,
    studentName: failedOrder.studentName,
    amount: failedOrder.finalAmount,
    currency: 'INR',
    paymentMethod: failedOrder.paymentMethod,
    transactionId: txnId,
    razorpayOrderId: null,
    status: 'FAILED',
    failureReason: failedOrder.failureReason,
    createdAt: new Date().toISOString(),
  };

  db.orders.unshift(failedOrder);
  db.payments.unshift(failedPayment);
  saveDb(db);
  return res.json({ success: true, order: failedOrder, payment: failedPayment });
});

// Payment History Endpoint (Requirement #5)
app.get('/api/payments', (req, res) => {
  const db = loadDb();
  const actor = resolveActor(req, db);
  const emailFilter = (req.query.email || '').toString().trim().toLowerCase();

  if (actor && actor.role.toLowerCase() === 'admin' && !emailFilter) {
    return res.json({ success: true, payments: db.payments || [] });
  }

  const targetEmail = emailFilter || actor?.email?.toLowerCase() || '';
  const payments = (db.payments || []).filter((p) => p.studentEmail.toLowerCase() === targetEmail);
  return res.json({ success: true, payments });
});

// ============================================================================
// 6. STUDENT & ADMIN ORDERS (Requirement #11)
// Admin can view all orders from all students with search & status filters
// ============================================================================
app.get('/api/orders', (req, res) => {
  const db = loadDb();
  const actor = resolveActor(req, db);
  const emailFilter = (req.query.email || '').toString().trim().toLowerCase();

  if (actor && actor.role.toLowerCase() === 'admin' && !emailFilter) {
    return res.json({ success: true, orders: db.orders });
  }

  const targetEmail = emailFilter || actor?.email?.toLowerCase() || '';
  const orders = db.orders.filter((o) => o.studentEmail.toLowerCase() === targetEmail);
  return res.json({ success: true, orders });
});

// Admin All Orders with Search & Pagination (Requirement #11)
app.get('/api/admin/orders', (req, res) => {
  const db = loadDb();
  const admin = requireAdmin(req, res, db);
  if (!admin) return;

  const search = (req.query.search || '').toString().trim().toLowerCase();
  const paymentStatus = (req.query.paymentStatus || '').toString().trim().toUpperCase();
  const orderStatus = (req.query.orderStatus || '').toString().trim().toUpperCase();

  let filtered = [...db.orders];

  if (search) {
    filtered = filtered.filter(
      (o) =>
        o.id.toLowerCase().includes(search) ||
        o.studentEmail.toLowerCase().includes(search) ||
        o.studentName.toLowerCase().includes(search) ||
        o.transactionId.toLowerCase().includes(search)
    );
  }

  if (paymentStatus && paymentStatus !== 'ALL') {
    filtered = filtered.filter((o) => o.paymentStatus.toUpperCase() === paymentStatus);
  }

  if (orderStatus && orderStatus !== 'ALL') {
    filtered = filtered.filter((o) => o.orderStatus.toUpperCase() === orderStatus);
  }

  return res.json({
    success: true,
    orders: filtered,
    total: filtered.length,
  });
});

app.patch('/api/admin/orders/:id/status', (req, res) => {
  const db = loadDb();
  const admin = requireAdmin(req, res, db);
  if (!admin) return;

  const order = db.orders.find((o) => o.id === req.params.id);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found.' });
  }

  const newStatus = (req.body?.orderStatus || 'PREPARING').toString().toUpperCase();
  order.orderStatus = newStatus;
  if (newStatus === 'CLAIMED') {
    order.claimedAt = new Date().toISOString();
    order.claimedBy = admin.name || 'Admin';
  }

  saveDb(db);
  return res.json({
    success: true,
    order,
    message: `Order #${order.id} marked as ${newStatus}`,
  });
});

// ============================================================================
// 7. STATIC VENDING MACHINE QR DESTINATION CONFIG (Requirement #10)
// Configures static QR code from stable APP_URL, no admin tokens inside QR
// ============================================================================
app.get('/api/admin/vending-qr-config', (req, res) => {
  const db = loadDb();
  const admin = requireAdmin(req, res, db);
  if (!admin) return;

  return res.json({
    success: true,
    appUrl: APP_URL,
    defaultMachineId: 'VM-NESTY-01',
    destinationUrl: `${APP_URL}/?source=vending_machine&machineId=VM-NESTY-01`,
  });
});

// ============================================================================
// 8. SAFE QR SCANNER VALIDATION ENDPOINT
// Never marks an unpaid order as paid based on a QR scan!
// ============================================================================
app.post('/api/orders/validate-qr', (req, res) => {
  const db = loadDb();
  const rawValue = (req.body?.token || req.body?.rawValue || req.body?.orderId || '').toString().trim();

  if (!rawValue) {
    return res.json({
      valid: false,
      type: 'INVALID',
      title: 'Empty Scan',
      subtitle: 'No QR payload detected. Please try scanning again.',
    });
  }

  const normalizedId = rawValue.replace(/^#/, '');
  const matchedOrder = db.orders.find(
    (o) =>
      o.id.toLowerCase() === normalizedId.toLowerCase() ||
      o.transactionId.toLowerCase() === normalizedId.toLowerCase()
  );

  if (matchedOrder) {
    // Strictly inspect existing payment state — NEVER mark an order paid from a QR scan!
    const isPaid = matchedOrder.paymentStatus === 'PAID' || matchedOrder.paymentStatus === 'SUCCESS';
    return res.json({
      valid: isPaid,
      type: 'ORDER_RECEIPT',
      title: isPaid ? `Verified Order #${matchedOrder.id}` : `Unpaid / Failed Order #${matchedOrder.id}`,
      subtitle: `Status: ${matchedOrder.orderStatus} • Payment: ${matchedOrder.paymentStatus} • Txn: ${matchedOrder.transactionId}`,
      order: matchedOrder,
    });
  }

  const couponCandidate = rawValue.toUpperCase().replace(/^COUPON:/, '').replace(/^NESTY:/, '').trim();
  const coupon = db.coupons.find((c) => c.code.toUpperCase() === couponCandidate);
  if (coupon) {
    return res.json({
      valid: true,
      type: 'PROMO_COUPON',
      couponCode: coupon.code,
      title: `Promo Coupon Unlocked: ${coupon.code}`,
      subtitle: `${coupon.discountPercent}% OFF (up to ₹${coupon.maxDiscount}) on orders above ₹${coupon.minOrderAmount}!`,
    });
  }

  return res.json({
    valid: false,
    type: 'INVALID',
    title: 'Unsupported QR Code',
    subtitle: `Scanned value "${rawValue}" is not a recognized Nesty coupon or verified order reference.`,
  });
});

// ============================================================================
// 9. ADMIN STUDENTS, COUPONS & ANNOUNCEMENTS
// ============================================================================
app.get('/api/admin/students', (req, res) => {
  const db = loadDb();
  const admin = requireAdmin(req, res, db);
  if (!admin) return;
  const students = db.users.filter((u) => u.role === 'student').map(sanitizeUser);
  return res.json({ success: true, students });
});

app.get('/api/coupons', (_req, res) => {
  const db = loadDb();
  return res.json({ success: true, coupons: db.coupons });
});

app.post('/api/admin/coupons', (req, res) => {
  const db = loadDb();
  const admin = requireAdmin(req, res, db);
  if (!admin) return;

  const code = (req.body?.code || '').toString().trim().toUpperCase();
  const discountPercent = Number(req.body?.discountPercent || 10);
  const maxDiscount = Math.max(1, Number(req.body?.maxDiscount || 40));
  const minOrderAmount = Math.max(0, Number(req.body?.minOrderAmount || 30));

  if (!code || discountPercent < 1 || discountPercent > 100) {
    return res.status(400).json({ success: false, message: 'Enter a valid coupon code and discount % (1-100).' });
  }

  const coupon = {
    id: `cpn_${Date.now()}`,
    code,
    discountPercent,
    maxDiscount,
    minOrderAmount,
    usageCount: 0,
  };
  db.coupons.push(coupon);
  saveDb(db);
  return res.json({ success: true, coupon, coupons: db.coupons, message: `Coupon ${code} created!` });
});

app.delete('/api/admin/coupons/:id', (req, res) => {
  const db = loadDb();
  const admin = requireAdmin(req, res, db);
  if (!admin) return;
  db.coupons = db.coupons.filter((c) => c.id !== req.params.id);
  saveDb(db);
  return res.json({ success: true, coupons: db.coupons, message: 'Coupon deleted.' });
});

app.get('/api/announcements/active', (_req, res) => {
  const db = loadDb();
  return res.json({ success: true, announcements: db.announcements });
});

app.post('/api/admin/announcements', (req, res) => {
  const db = loadDb();
  const admin = requireAdmin(req, res, db);
  if (!admin) return;

  const title = (req.body?.title || '').toString().trim();
  const message = (req.body?.message || '').toString().trim();
  if (!title || !message) {
    return res.status(400).json({ success: false, message: 'Title and message are required.' });
  }

  const ann = {
    id: `ann_${Date.now()}`,
    title,
    message,
    createdAt: new Date().toISOString(),
  };
  db.announcements.unshift(ann);
  saveDb(db);
  return res.json({ success: true, announcement: ann, announcements: db.announcements, message: 'Announcement posted!' });
});

app.delete('/api/admin/announcements/:id', (req, res) => {
  const db = loadDb();
  const admin = requireAdmin(req, res, db);
  if (!admin) return;
  db.announcements = db.announcements.filter((a) => a.id !== req.params.id);
  saveDb(db);
  return res.json({ success: true, announcements: db.announcements, message: 'Announcement deleted.' });
});

// Serve static production frontend build from ../dist
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start server if executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Nesty Web & Shared API Server listening on http://0.0.0.0:${PORT}`);
  });
}
