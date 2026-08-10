-- =====================================================
-- FRESH PAYMENTS TABLE SCHEMA
-- Drop old, create new from scratch with correct columns
-- =====================================================

-- Step 1: DROP the old payments table (if exists)
DROP TABLE IF EXISTS payments CASCADE;

-- Step 2: CREATE the correct payments table
CREATE TABLE payments (
  id VARCHAR(255) PRIMARY KEY,
  booking_id VARCHAR(255) NOT NULL,
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

-- Step 3: CREATE INDEXES for performance
CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

-- Step 4: VERIFY the structure
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'payments' ORDER BY ordinal_position;
