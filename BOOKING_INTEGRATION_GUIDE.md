# Booking Integration Guide - PostgreSQL Setup

## Overview
The new booking system in the admin panel (`/admin/new-booking`) is fully integrated with PostgreSQL database for persistent data storage.

## Database Schema
The `bookings` table contains **34 fields**:

```
id                         UUID (Primary Key)
user_id                    Text (User ID from auth)
player_name                Text (Player/Customer Name)
contact_number             Text (Phone Number)
email                      Text (Email Address)
court_id                   Text (Court Reference)
court_name                 Text (Court Name)
booking_date               Date (Booking Date)
time_slot                  Text (Time Slot - e.g., "02:00 PM")
start_time                 Text (Start Time)
end_time                   Text (End Time)
duration                   Numeric (Hours - 0.5, 1, 1.5, 2, etc.)
players                    Integer (Number of Players)
status                     Text (Pending/Approved/Cancelled)
total_amount               Numeric (Total Cost)
amount_paid                Numeric (Amount Paid by Customer)
remaining_balance          Numeric (Balance Due)
hourly_rate                Numeric (Court Hourly Rate)
payment_plan               Text (Full/Partial/Later)
payment_method             Text (gcash/cash)
customer_payment_status    Text (Paid/Partial/Pending)
cash_received              Numeric (Cash Received - if payment is cash)
"change"                   Numeric (Change Amount - if payment is cash)
promo_code                 Text (Discount Promo Code)
equipment                  Text (Equipment JSON)
notes                      Text (Booking Notes)
receipt_url                Text (GCash Receipt Image URL)
latest_receipt_id          Text (Latest Receipt ID)
last_printed_by            Text (Last Printed By User ID)
created_at                 Timestamp (Creation Time)
updated_at                 Timestamp (Last Update Time)
reviewed_at                Timestamp (When Booking Was Reviewed)
extended_at                Timestamp (When Booking Was Extended)
last_printed_at            Timestamp (When Receipt Was Last Printed)
```

## Frontend Flow (React)

### 1. **Booking Form** (`src/components/Book.jsx`)
- Admin fills out booking details
- Form collects: court, date, time, duration, player name, contact, email, payment method, payment plan
- Payment options:
  - **GCash**: Requires receipt image upload
  - **Cash**: Enter cash received and calculate change
  - **Payment Plans**: Full / Partial Down Payment / Pay Later

### 2. **Data Sanitization**
Frontend sanitizes payload before sending to backend:
```javascript
// Deleted fields (not in bookings table):
delete cleanPayload.booking.equipment;       // Array not supported
delete cleanPayload.booking.cashReceived;    // Only in payments table
delete cleanPayload.booking.change;          // Only in payments table

// Kept fields:
// All 31 booking fields are sent with proper mapping
```

### 3. **API Endpoint** 
**POST** `/api/bookings/with-payment`

**Request Payload Structure:**
```javascript
{
  booking: {
    userId: "firebase-uid",
    playerName: "John Doe",
    contactNumber: "+63912345678",
    email: "john@example.com",
    courtId: "court-123",
    courtName: "Court A (Indoor)",
    date: "2024-07-25",
    timeSlot: "02:00 PM",
    startTime: "02:00 PM",
    endTime: "04:00 PM",
    duration: 2,
    players: 2,
    status: "Pending",
    totalAmount: 800,
    amountPaid: 800,
    remainingBalance: 0,
    hourlyRate: 400,
    paymentPlan: "full",
    paymentMethod: "gcash",
    customerPaymentStatus: "Paid",
    promoCode: "PICKLE10",
    notes: "Customer requested window court",
    receiptUrl: "data:image/jpeg;base64,...",
    createdAt: "2024-07-21T10:30:00Z"
  },
  payment: {
    userId: "firebase-uid",
    name: "John Doe",
    courtId: "court-123",
    courtName: "Court A (Indoor)",
    date: "2024-07-25",
    timeSlot: "02:00 PM",
    amount: 800,
    totalAmount: 800,
    amountPaid: 800,
    remainingBalance: 0,
    paymentPlan: "full",
    method: "gcash",
    paymentStatus: "Approved",
    createdAt: "2024-07-21T10:30:00Z"
  },
  customer: {
    userId: "firebase-uid",
    fullName: "John Doe",
    contactNumber: "+63912345678",
    email: "john@example.com",
    amountApplied: 800
  }
}
```

## Backend Flow (Node.js/Express)

### 1. **Route Handler** (`server/routes.js`)
- Receives booking payload
- Generates UUID for booking ID
- Validates required fields
- Maps frontend camelCase to PostgreSQL snake_case

### 2. **Database Insert**
```sql
INSERT INTO bookings (
  id, user_id, player_name, contact_number, email, court_id, court_name,
  booking_date, time_slot, start_time, end_time, duration, players,
  status, total_amount, amount_paid, remaining_balance, hourly_rate,
  payment_plan, payment_method, customer_payment_status, cash_received,
  "change", promo_code, equipment, notes, receipt_url, latest_receipt_id,
  last_printed_by, created_at, updated_at, reviewed_at, extended_at, last_printed_at
) VALUES (...)
```

### 3. **Related Inserts**
- **Payments Table**: Records payment transaction details
- **Customers Table**: Creates or updates customer record with booking count and total spent

### 4. **Response**
```javascript
{
  success: true,
  bookingId: "550e8400-e29b-41d4-a716-446655440000",
  message: "Booking created successfully"
}
```

## Field Mapping Reference

| Frontend (camelCase) | PostgreSQL (snake_case) | Type | Required |
|---|---|---|---|
| userId | user_id | UUID | ✅ |
| playerName | player_name | Text | ✅ |
| contactNumber | contact_number | Text | ✅ |
| email | email | Text | ❌ |
| courtId | court_id | UUID | ✅ |
| courtName | court_name | Text | ✅ |
| date | booking_date | Date | ✅ |
| timeSlot | time_slot | Text | ✅ |
| startTime | start_time | Text | ✅ |
| endTime | end_time | Text | ✅ |
| duration | duration | Numeric | ✅ |
| players | players | Integer | ❌ |
| status | status | Text | ❌ |
| totalAmount | total_amount | Numeric | ✅ |
| amountPaid | amount_paid | Numeric | ✅ |
| remainingBalance | remaining_balance | Numeric | ✅ |
| hourlyRate | hourly_rate | Numeric | ❌ |
| paymentPlan | payment_plan | Text | ❌ |
| paymentMethod | payment_method | Text | ❌ |
| customerPaymentStatus | customer_payment_status | Text | ❌ |
| cashReceived | cash_received | Numeric | ❌ |
| change | change | Numeric | ❌ |
| promoCode | promo_code | Text | ❌ |
| notes | notes | Text | ❌ |
| receiptUrl | receipt_url | Text | ❌ |
| createdAt | created_at | Timestamp | ❌ |

## Testing the Integration

### 1. **Admin Creates Booking**
1. Navigate to: `/admin/new-booking`
2. Fill in all required fields
3. Select court, date, time slot
4. Choose payment method (GCash or Cash)
5. Upload GCash receipt if applicable
6. Click "Complete Booking"

### 2. **Verify in Database**
```sql
SELECT * FROM bookings WHERE user_id = 'firebase-uid' ORDER BY created_at DESC LIMIT 1;
```

### 3. **Check API**
```bash
curl "http://127.0.0.1:3003/api/bookings?date=2024-07-25"
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|---|---|---|
| "Missing: courtId" | Court not selected | Select a court from dropdown |
| "Please upload your GCash receipt" | GCash selected but no image | Upload receipt image |
| "Cash received is less than the amount due" | Cash amount insufficient | Enter correct cash amount |
| "That time is no longer available" | Double booking | Choose different time slot |
| Database error with column | Field name mismatch | Check field mapping in code |

### Debug Mode
Server logs all bookings to console:
```
=== BOOKING CREATION START ===
Generated booking ID: 550e8400-e29b-41d4-a716-446655440000
Inserting booking with 34 values
Mapping: { playerName: 'John Doe', courtId: 'court-123', ... }
✓ Booking inserted with ID: 550e8400-e29b-41d4-a716-446655440000
✓ Payment inserted with ID: 660e8401-e29b-41d4-a716-446655440001
✓ Customer updated
=== ✓ SUCCESS: Booking created! ===
```

## Related Endpoints

### GET Bookings
```
GET /api/bookings?date=2024-07-25&courtId=court-123&status=Pending
GET /api/bookings/search?playerName=John
```

### UPDATE Booking
```
PATCH /api/bookings/:id
Body: { status: "Approved", reviewedAt: "2024-07-21T12:00:00Z" }
```

### PAYMENTS Table
Linked via `booking_id` foreign key. One booking can have multiple payment records.

### CUSTOMERS Table
Tracks customer statistics:
- total_bookings
- total_amount_spent
- total_spent
- Updated on each new booking

## Best Practices

1. **Always provide hourlyRate** - Required for accurate billing
2. **Use proper date format** - "YYYY-MM-DD" (e.g., "2024-07-25")
3. **Time slots** - Use 12-hour format with AM/PM (e.g., "02:00 PM")
4. **Phone validation** - Ensure contact number is valid before submission
5. **Payment proof** - For GCash, always upload receipt image
6. **Customer data** - Keep customer info updated in database

## Performance Notes

- All bookings indexed by `court_id`, `booking_date`, `status`
- Customer lookups by `user_id`
- Queries optimized with proper column mapping
- Receipt images stored as base64 data URLs (consider S3 for production)

---

**Last Updated:** July 21, 2024
**Version:** 1.0 (PostgreSQL Integration)
