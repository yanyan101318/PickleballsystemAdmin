-- =====================================================
-- FRESH BOOKINGS TABLE SCHEMA (34 FIELDS)
-- Safe approach: Drop old, create new from scratch
-- =====================================================

-- Step 1: DROP the old bookings table (if exists)
DROP TABLE IF EXISTS bookings CASCADE;

-- Step 2: CREATE the correct bookings table with all 34 fields
CREATE TABLE bookings (
  -- PRIMARY KEY
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- USER & CUSTOMER INFO
  user_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  email TEXT,
  
  -- COURT INFO
  court_id TEXT NOT NULL,
  court_name TEXT NOT NULL,
  
  -- BOOKING DATE/TIME
  booking_date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  duration NUMERIC(10,2) NOT NULL,
  players INTEGER,
  
  -- BOOKING STATUS
  status TEXT DEFAULT 'Pending',
  
  -- PAYMENT INFO
  total_amount NUMERIC(10,2) NOT NULL,
  amount_paid NUMERIC(10,2) NOT NULL,
  remaining_balance NUMERIC(10,2),
  hourly_rate NUMERIC(10,2),
  payment_plan TEXT,
  payment_method TEXT,
  customer_payment_status TEXT,
  cash_received NUMERIC(10,2),
  "change" NUMERIC(10,2),
  
  -- ADDITIONAL INFO
  promo_code TEXT,
  equipment TEXT,
  notes TEXT,
  receipt_url TEXT,
  latest_receipt_id TEXT,
  last_printed_by TEXT,
  
  -- TIMESTAMPS
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  extended_at TIMESTAMP,
  last_printed_at TIMESTAMP
);

-- Step 3: CREATE INDEXES for performance
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_court_id ON bookings(court_id);
CREATE INDEX idx_bookings_date ON bookings(booking_date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_created_at ON bookings(created_at DESC);

-- Step 4: VERIFY the structure
-- Run this to check all 34 fields exist:
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
ORDER BY ordinal_position;

-- Expected output: 34 rows (id, user_id, player_name, ... last_printed_at)
