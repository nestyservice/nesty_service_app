# Nesty — Responsive Web Application & Shared Android/Web Backend

This folder (`/web`) contains the complete, production-ready **Nesty Responsive Web Application** (React 18 + TypeScript + Tailwind CSS + Vite) and the **Authoritative Shared Backend Server** (Node.js + Express) that serves both the Web App and the Nesty Android App (`com.example`).

---

## 1. Architecture & Shared Database Overview (Why Android Room Data Isn't Automatically on the Website)

- **Why Local Android Room Data is Separate:** The Android app uses an on-device SQLite database (`Room`) for instant offline caching. Browser websites cannot directly read an Android phone's local SQLite storage.
- **How Android & Web Share Data:** Both the Nesty Android app (`NestyRepository.kt`) and the Nesty Web app (`src/App.tsx`) communicate with the **same REST API routes** hosted by `server/index.js`:
  - `POST /api/auth/login` & `POST /api/auth/register-student` (Student & Admin authentication; Vendor login is strictly disabled)
  - `GET /api/menu`, `POST /api/admin/menu`, `PUT /api/admin/menu/:id`, `PATCH /api/admin/menu/:id/toggle`, `DELETE /api/admin/menu/:id` (Server-side admin-verified product catalog)
  - `GET /api/orders`, `POST /api/orders`, `POST /api/payment-failed`, `PATCH /api/admin/orders/:id/status` (Order & Payment ledger with inline Transaction IDs and zero student QR generation)
  - `POST /api/orders/validate-qr` (Safe backend QR validation that never marks an unpaid order as paid)
  - `GET /api/coupons`, `POST /api/admin/coupons`, `GET /api/announcements/active`, `POST /api/admin/announcements`

---

## 2. How to Run Locally (Beginner-Friendly Step-by-Step)

### Prerequisites
- Install **Node.js 18+** (includes `npm`) from [https://nodejs.org](https://nodejs.org).

### Step 1: Open a terminal in the `web` folder
```bash
cd web
```

### Step 2: Install dependencies
```bash
npm install
```

### Step 3: Configure environment variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(Optional)* Edit `.env` to set your own `JWT_SECRET`, `ADMIN_DEFAULT_PASSWORD`, and `RAZORPAY_KEY_SECRET`. Secret keys remain strictly on the Node.js server and are never exposed to the browser.

### Step 4: Build and start the full-stack production server
```bash
npm run build
npm start
```
Now open **[http://localhost:3000](http://localhost:3000)** in any desktop or mobile browser!

- **Demo Student Login:** `student@cvr.ac.in` / `student123`
- **Demo Admin Login:** `admin@cvr.ac.in` / `admin123`

---

## 3. Deploying to Render (Recommended for `deliz-canteen.onrender.com`)

1. Push your repository to **GitHub**.
2. Log in to **[Render](https://dashboard.render.com/)** and click **New + → Web Service** (or open your existing `deliz-canteen` service settings).
3. Configure the service settings:
   - **Root Directory:** `web`
   - **Runtime:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
4. Under **Environment Variables**, add:
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = *(any strong random secret string)*
   - `ADMIN_EMAILS` = `admin@cvr.ac.in`
   - `ADMIN_DEFAULT_PASSWORD` = `admin123`
   - `RAZORPAY_KEY_ID` = *(your Razorpay public key ID)*
   - `RAZORPAY_KEY_SECRET` = *(your server-only Razorpay secret)*
5. Click **Deploy Web Service**. Render will build the frontend and start the Express server on your public `.onrender.com` URL.

---

## 4. Deploying to Google Cloud Run

You can deploy the `/web` folder directly to **Google Cloud Run** using the included `Dockerfile`:

```bash
cd web

# 1. Authenticate and select your Google Cloud project
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID

# 2. Build and deploy to Cloud Run from source
gcloud run deploy nesty-web \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,ADMIN_EMAILS=admin@cvr.ac.in"
```
Cloud Run will output a permanent `https://nesty-web-....run.app` URL that works in any desktop or mobile browser.
