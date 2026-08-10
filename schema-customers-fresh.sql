-- =====================================================
-- FRESH CUSTOMERS TABLE SCHEMA
-- Drop old, create new from scratch with correct columns
-- =====================================================

-- Step 1: DROP the old customers table (if exists)
DROP TABLE IF EXISTS customers CASCADE;

-- Step 2: CREATE the correct customers table
CREATE TABLE customers (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  contact_number VARCHAR(50),
  email VARCHAR(255),
  total_bookings INTEGER DEFAULT 0,
  total_amount_spent DECIMAL(12,2) DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: CREATE INDEXES for performance
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_created_at ON customers(created_at DESC);

-- Step 4: VERIFY the structure
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customers' ORDER BY ordinal_position;
