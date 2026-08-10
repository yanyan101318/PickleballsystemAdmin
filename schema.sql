-- PostgreSQL schema for tournament-bracket (Firebase migration)
-- Run: psql -U $DB_USER -d $DB_NAME -f schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Stores (extended) ──────────────────────────────────────────────
ALTER TABLE stores ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS contact_number VARCHAR(50);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS stall_number VARCHAR(50);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS vendor_token_id VARCHAR(255);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS portal_url TEXT;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS portal_path VARCHAR(255);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ── Bookings (extra columns) ───────────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_payment_status VARCHAR(50);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS equipment JSONB DEFAULT '[]';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS promo_code VARCHAR(100);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cash_received DECIMAL(12,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS change_amount DECIMAL(12,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS latest_receipt_id VARCHAR(100);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_printed_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_printed_by VARCHAR(255);

-- ── Customers (extra columns) ──────────────────────────────────────
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_bookings INT DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_amount_spent DECIMAL(12,2) DEFAULT 0;

-- ── Products (extra columns) ───────────────────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS prep_time_minutes INT DEFAULT 15;
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_image TEXT;

-- ── Customer orders (extra columns) ────────────────────────────────
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS user_email VARCHAR(255);
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(50);
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS booking_id VARCHAR(255);
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS court_id VARCHAR(255);
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS court_name VARCHAR(255);
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50);
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS cashier_name VARCHAR(255);
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS verification_code VARCHAR(50);
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS settlements JSONB DEFAULT '[]';
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS total_commission DECIMAL(12,2) DEFAULT 0;
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS total_vendor_net DECIMAL(12,2) DEFAULT 0;
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS vendor_order_ids JSONB DEFAULT '[]';
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ── Payments ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(255) PRIMARY KEY,
  booking_id VARCHAR(255),
  user_id VARCHAR(255),
  name VARCHAR(255),
  court_id VARCHAR(255),
  court_name VARCHAR(255),
  booking_date DATE,
  time_slot VARCHAR(50),
  start_time VARCHAR(50),
  end_time VARCHAR(50),
  amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  amount_paid DECIMAL(12,2) DEFAULT 0,
  remaining_balance DECIMAL(12,2) DEFAULT 0,
  payment_plan VARCHAR(50),
  customer_payment_status VARCHAR(50),
  method VARCHAR(50),
  payment_status VARCHAR(50),
  payment_image_url TEXT,
  promo_code VARCHAR(100),
  discount DECIMAL(12,2) DEFAULT 0,
  cash_received DECIMAL(12,2),
  change_amount DECIMAL(12,2),
  rejection_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Court snack orders (Firebase `orders` collection) ────────────────
CREATE TABLE IF NOT EXISTS court_orders (
  id VARCHAR(255) PRIMARY KEY,
  booking_id VARCHAR(255),
  court_id VARCHAR(255),
  court_name VARCHAR(255),
  player_name VARCHAR(255),
  items JSONB DEFAULT '[]',
  total_amount DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'awaiting_approval',
  placed_by_guest BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Sales transactions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_transactions (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(50),
  source VARCHAR(50),
  order_id VARCHAR(255),
  customer_order_id VARCHAR(255),
  items JSONB DEFAULT '[]',
  total DECIMAL(12,2) DEFAULT 0,
  payment_method VARCHAR(50),
  cash_received DECIMAL(12,2),
  change_amount DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── SMS logs ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id VARCHAR(255),
  phone_number VARCHAR(50),
  phone_raw VARCHAR(50),
  message TEXT,
  status VARCHAR(50),
  api_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Vendor tokens ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_tokens (
  id VARCHAR(255) PRIMARY KEY,
  store_id VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL,
  active BOOLEAN DEFAULT true,
  rotated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Vendor payouts ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_payouts (
  id VARCHAR(255) PRIMARY KEY,
  customer_order_id VARCHAR(255),
  settlements JSONB DEFAULT '[]',
  total_commission DECIMAL(12,2) DEFAULT 0,
  total_vendor_net DECIMAL(12,2) DEFAULT 0,
  grand_total DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Food court config ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS food_court_config (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'globalQR',
  title VARCHAR(255) DEFAULT 'RANAW Food Court',
  subtitle TEXT,
  public_path VARCHAR(255),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Customer balances ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_balances (
  user_id VARCHAR(255) PRIMARY KEY,
  outstanding_balance DECIMAL(12,2) DEFAULT 0,
  pay_later_order_ids JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Customer balance payments ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_balance_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) DEFAULT 0,
  payment_method VARCHAR(50),
  cashier_name VARCHAR(255),
  order_ids JSONB DEFAULT '[]',
  previous_balance DECIMAL(12,2) DEFAULT 0,
  new_balance DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Paddle stacking ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS paddle_stack_state (
  id VARCHAR(50) PRIMARY KEY DEFAULT 'state',
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paddle_match_history (
  id VARCHAR(255) PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  ended_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Tournaments ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tournaments (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255),
  format VARCHAR(100),
  tournament_format VARCHAR(100) DEFAULT 'single-elimination',
  scoring_mode VARCHAR(50) DEFAULT 'traditional',
  champion VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_matches (
  id VARCHAR(255) NOT NULL,
  tournament_id VARCHAR(255) NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (tournament_id, id)
);

CREATE INDEX IF NOT EXISTS idx_bookings_court_date ON bookings(court_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_court_orders_booking ON court_orders(booking_id);
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_user ON customer_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id);
