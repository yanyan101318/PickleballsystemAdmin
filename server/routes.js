const { randomUUID } = require("crypto");
const pool = require("../config/db");
const {
  rowsToCamel,
  rowToCamel,
  bodyToSnake,
  parseJson,
  stringifyJson,
  newId,
  roundMoney,
} = require("./helpers");

function registerRoutes(app) {
  // ── Bookings ──────────────────────────────────────────────────────
  app.get("/api/bookings", async (req, res) => {
    try {
      const { courtId, courtName, date, status, playerName } = req.query;
      const clauses = [];
      const vals = [];
      if (courtId) {
        const ids = courtId.split(",");
        const subclauses = ids.map(id => {
          vals.push(`%${id}%`);
          return `court_id LIKE $${vals.length}`;
        });
        clauses.push(`(${subclauses.join(" OR ")})`);
      }
      if (courtName) {
        vals.push(courtName);
        clauses.push(`court_name = $${vals.length}`);
      }
      if (date) {
        vals.push(date);
        clauses.push(`booking_date = $${vals.length}`);
      }
      if (status) {
        vals.push(status);
        clauses.push(`LOWER(status) = LOWER($${vals.length})`);
      }
      if (playerName) {
        vals.push(`${playerName}%`);
        clauses.push(`player_name ILIKE $${vals.length}`);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const result = await pool.query(
        `SELECT id, player_name AS "playerName", contact_number AS "contactNumber", email,
          court_id AS "courtId", court_name AS "courtName",
          booking_date AS "date", time_slot AS "timeSlot",
          start_time AS "startTime", end_time AS "endTime", duration, players,
          total_amount AS "totalAmount", amount_paid AS "amountPaid",
          remaining_balance AS "remainingBalance", payment_method AS "paymentMethod",
          payment_plan AS "paymentPlan", customer_payment_status AS "customerPaymentStatus",
          status, notes, user_id AS "userId", equipment, promo_code AS "promoCode",
          receipt_url AS "receiptUrl", cash_received AS "cashReceived",
          "change" AS "change", hourly_rate AS "hourlyRate",
          latest_receipt_id AS "latestReceiptId", last_printed_by AS "lastPrintedBy",
          reviewed_at AS "reviewedAt", extended_at AS "extendedAt", last_printed_at AS "lastPrintedAt",
          created_at AS "createdAt", updated_at AS "updatedAt"
         FROM bookings ${where} ORDER BY created_at DESC`,
        vals
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Bookings list error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.patch("/api/bookings/:id", async (req, res) => {
    try {
      const raw = bodyToSnake(req.body);
      const updates = {};

      for (const [key, value] of Object.entries(raw)) {
        if (key === "date") updates.booking_date = value;
        else if (key === "time_slot") updates.time_slot = value;
        else if (key === "end_time") updates.end_time = value;
        else if (key === "player_name") updates.player_name = value;
        else if (key === "contact_number") updates.contact_number = value;
        else if (key === "total_amount") updates.total_amount = value;
        else if (key === "amount_paid") updates.amount_paid = value;
        else if (key === "remaining_balance") updates.remaining_balance = value;
        else if (key === "payment_method") updates.payment_method = value;
        else if (key === "payment_plan") updates.payment_plan = value;
        else if (key === "customer_payment_status") updates.customer_payment_status = value;
        else if (key === "cash_received") updates.cash_received = value;
        else if (key === "promo_code") updates.promo_code = value;
        else if (key === "receipt_url") updates.receipt_url = value;
        else if (key === "latest_receipt_id") updates.latest_receipt_id = value;
        else if (key === "last_printed_by") updates.last_printed_by = value;
        else if (key === "reviewed_at") updates.reviewed_at = value;
        else if (key === "extended_at") updates.extended_at = value;
        else if (key === "last_printed_at") updates.last_printed_at = value;
        else updates[key] = value;
      }

      if (!Object.prototype.hasOwnProperty.call(updates, "updated_at")) {
        updates.updated_at = new Date().toISOString();
      }

      const entries = Object.entries(updates);
      if (!entries.length) return res.status(400).json({ error: "No fields" });

      const set = entries.map(([k], i) => `"${k}" = $${i + 1}`).join(", ");
      const values = entries.map(([, v]) => v);
      values.push(req.params.id);

      await pool.query(`UPDATE bookings SET ${set} WHERE id = $${entries.length + 1}`, values);
      res.json({ success: true });
    } catch (err) {
      console.error("Booking update error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.get("/api/bookings/search", async (req, res) => {
    try {
      const { courtId, courtName, date, status, playerName } = req.query;
      const clauses = [];
      const vals = [];
      if (courtId) {
        const ids = courtId.split(",");
        const subclauses = ids.map(id => {
          vals.push(`%${id}%`);
          return `court_id LIKE $${vals.length}`;
        });
        clauses.push(`(${subclauses.join(" OR ")})`);
      }
      if (courtName) {
        vals.push(courtName);
        clauses.push(`court_name = $${vals.length}`);
      }
      if (date) {
        vals.push(date);
        clauses.push(`booking_date = $${vals.length}`);
      }
      if (status) {
        vals.push(status);
        clauses.push(`LOWER(status) = LOWER($${vals.length})`);
      }
      if (playerName) {
        vals.push(`${playerName}%`);
        clauses.push(`player_name ILIKE $${vals.length}`);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const result = await pool.query(
        `SELECT id, player_name AS "playerName", contact_number AS "contactNumber", email,
          court_id AS "courtId", court_name AS "courtName",
          booking_date AS "date", time_slot AS "timeSlot",
          start_time AS "startTime", end_time AS "endTime", duration, players,
          total_amount AS "totalAmount", amount_paid AS "amountPaid",
          remaining_balance AS "remainingBalance", payment_method AS "paymentMethod",
          payment_plan AS "paymentPlan", customer_payment_status AS "customerPaymentStatus",
          status, notes, user_id AS "userId", equipment, promo_code AS "promoCode",
          receipt_url AS "receiptUrl", cash_received AS "cashReceived",
          "change" AS "change", hourly_rate AS "hourlyRate",
          latest_receipt_id AS "latestReceiptId", last_printed_by AS "lastPrintedBy",
          reviewed_at AS "reviewedAt", extended_at AS "extendedAt", last_printed_at AS "lastPrintedAt",
          created_at AS "createdAt", updated_at AS "updatedAt"
         FROM bookings ${where} ORDER BY created_at DESC`,
        vals
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Bookings search error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  // Diagnostic: Check bookings table schema
  app.get("/api/admin/bookings-schema", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT column_name, data_type, is_nullable, column_default 
         FROM information_schema.columns 
         WHERE table_name = 'bookings' 
         ORDER BY ordinal_position`
      );
      res.json({
        columns: result.rows.map(r => r.column_name),
        full: result.rows
      });
    } catch (err) {
      console.error("Schema check error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Create booking + payment + customer upsert in one transaction
  app.post("/api/bookings/with-payment", async (req, res) => {
    try {
      const { booking, payment, customer } = req.body;

      console.log("\n=== BOOKING CREATION START ===");

      // STEP 1: GENERATE ID AND VALIDATE
      const bookingId = randomUUID();
      
      if (!booking?.courtId) throw new Error("Missing: courtId");
      if (!booking?.playerName) throw new Error("Missing: playerName");
      if (!booking?.contactNumber) throw new Error("Missing: contactNumber");
      if (!booking?.date) throw new Error("Missing: date");
      if (!booking?.userId) throw new Error("Missing: userId");

      console.log("Generated booking ID:", bookingId);

      // STEP 2: INSERT BOOKING - MAP ALL FIELDS FROM FRONTEND TO DATABASE SCHEMA
      // Complete mapping of all 34 bookings table fields
      const bookingInsert = `
        INSERT INTO bookings (
          id, user_id, player_name, contact_number, email, court_id, court_name, 
          booking_date, time_slot, start_time, end_time, duration, players, 
          status, total_amount, amount_paid, remaining_balance, hourly_rate, 
          payment_plan, payment_method, customer_payment_status, cash_received, 
          "change", promo_code, equipment, notes, receipt_url, latest_receipt_id, 
          last_printed_by, created_at, updated_at, reviewed_at, extended_at, last_printed_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, 
          $29, $30, $31, $32, $33, $34
        ) RETURNING id;
      `;

      const bookingInsertValues = [
        bookingId,                                  // $1 - id (generated)
        booking.userId,                             // $2 - user_id
        booking.playerName,                         // $3 - player_name
        booking.contactNumber,                      // $4 - contact_number
        booking.email || null,                      // $5 - email
        booking.courtId,                            // $6 - court_id
        booking.courtName,                          // $7 - court_name
        booking.date,                               // $8 - booking_date
        booking.timeSlot,                           // $9 - time_slot
        booking.startTime,                          // $10 - start_time
        booking.endTime,                            // $11 - end_time
        booking.duration || 0,                      // $12 - duration
        booking.players || 1,                       // $13 - players
        booking.status || "Pending",                // $14 - status
        booking.totalAmount || 0,                   // $15 - total_amount
        booking.amountPaid || 0,                    // $16 - amount_paid
        booking.remainingBalance || 0,              // $17 - remaining_balance
        booking.hourlyRate || null,                 // $18 - hourly_rate
        booking.paymentPlan || null,                // $19 - payment_plan
        booking.paymentMethod || null,              // $20 - payment_method
        booking.customerPaymentStatus || null,      // $21 - customer_payment_status
        booking.cashReceived || null,               // $22 - cash_received
        booking.change || null,                     // $23 - change
        booking.promoCode || null,                  // $24 - promo_code
        null,                                       // $25 - equipment (null by default)
        booking.notes || null,                      // $26 - notes
        booking.receiptUrl || null,                 // $27 - receipt_url
        null,                                       // $28 - latest_receipt_id (auto-assigned)
        null,                                       // $29 - last_printed_by
        booking.createdAt || new Date().toISOString(),  // $30 - created_at
        new Date().toISOString(),                   // $31 - updated_at
        null,                                       // $32 - reviewed_at
        null,                                       // $33 - extended_at
        null                                        // $34 - last_printed_at
      ];

      console.log("Inserting booking with", bookingInsertValues.length, "values");
      console.log("Mapping:", {
        playerName: booking.playerName,
        courtId: booking.courtId,
        courtName: booking.courtName,
        totalAmount: booking.totalAmount,
        amountPaid: booking.amountPaid
      });

      const bookingResult = await pool.query(bookingInsert, bookingInsertValues);
      const newBookingId = bookingResult.rows[0].id;
      console.log("✓ Booking inserted with ID:", newBookingId);

      // STEP 3: INSERT PAYMENT (if provided)
      if (payment) {
        const paymentId = randomUUID();
        const paymentInsert = `
          INSERT INTO payments (
            id, booking_id, user_id, name, court_id, court_name, 
            payment_date, time_slot, start_time, end_time, amount, total_amount, 
            amount_paid, remaining_balance, payment_plan, customer_payment_status, 
            method, payment_status, discount, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 
            $13, $14, $15, $16, $17, $18, $19, $20
          ) RETURNING id;
        `;

        const paymentInsertValues = [
          paymentId,                                // $1 - id
          newBookingId,                             // $2 - booking_id (link to new booking)
          payment.userId || null,                   // $3 - user_id
          payment.name || null,                     // $4 - name
          payment.courtId || null,                  // $5 - court_id
          payment.courtName || null,                // $6 - court_name
          payment.date || booking.date || null,    // $7 - booking_date
          payment.timeSlot || booking.timeSlot || null,  // $8 - time_slot
          payment.startTime || booking.startTime || null,  // $9 - start_time
          payment.endTime || booking.endTime || null,  // $10 - end_time
          payment.amount || 0,                      // $11 - amount
          payment.totalAmount || 0,                 // $12 - total_amount
          payment.amountPaid || 0,                  // $13 - amount_paid
          payment.remainingBalance || 0,            // $14 - remaining_balance
          payment.paymentPlan || null,              // $15 - payment_plan
          payment.customerPaymentStatus || null,    // $16 - customer_payment_status
          payment.method || null,                   // $17 - method
          payment.paymentStatus || "Approved",      // $18 - payment_status
          payment.discount || 0,                    // $19 - discount
          payment.createdAt || new Date().toISOString()  // $20 - created_at
        ];

        await pool.query(paymentInsert, paymentInsertValues);
        console.log("✓ Payment inserted with ID:", paymentId);
      }

      // STEP 4: UPSERT CUSTOMER
      if (customer?.userId) {
        const applied = roundMoney(customer.amountApplied || 0);
        const existing = await pool.query(
          "SELECT id FROM customers WHERE user_id = $1 LIMIT 1",
          [customer.userId]
        );
        
        if (existing.rows.length) {
          await pool.query(
            `UPDATE customers SET 
             full_name = COALESCE($1, full_name),
             contact_number = COALESCE($2, contact_number),
             email = COALESCE($3, email),
             total_spent = COALESCE(total_spent, 0) + $4,
             updated_at = NOW()
             WHERE user_id = $5`,
            [
              customer.fullName,
              customer.contactNumber,
              customer.email,
              applied,
              customer.userId
            ]
          );
          console.log("✓ Customer updated");
        } else {
          await pool.query(
            `INSERT INTO customers (id, user_id, full_name, contact_number, email,
             total_spent, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
            [
              randomUUID(),
              customer.userId,
              customer.fullName,
              customer.contactNumber,
              customer.email || "",
              applied
            ]
          );
          console.log("✓ Customer created");
        }
      }

      console.log("=== ✓ SUCCESS: Booking created! ===\n");
      res.status(201).json({ 
        success: true,
        bookingId: newBookingId,
        message: "Booking created successfully"
      });

    } catch (error) {
      console.error("\n=== ✗ ERROR ===");
      console.error("Message:", error.message);
      console.error("Code:", error.code);
      console.error("Detail:", error.detail);
      console.error("Column:", error.column);
      console.error("============\n");
      
      res.status(500).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }
  });

  // ── Customers ────────────────────────────────────────────────────
  app.get("/api/customers/search", async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();
      if (!q) return res.json([]);
      const pattern = `${q}%`;
      const [customers, bookings] = await Promise.all([
        pool.query(
          `SELECT DISTINCT full_name AS name FROM customers WHERE full_name ILIKE $1 LIMIT 8`,
          [pattern]
        ),
        pool.query(
          `SELECT DISTINCT player_name AS name FROM bookings WHERE player_name ILIKE $1 LIMIT 8`,
          [pattern]
        ),
      ]);
      const names = new Set();
      [...customers.rows, ...bookings.rows].forEach((r) => {
        if (r.name) names.add(r.name);
      });
      res.json([...names].sort((a, b) => a.localeCompare(b)));
    } catch (err) {
      console.error("Customer search error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.post("/api/customers/upsert", async (req, res) => {
    try {
      const { userId, fullName, contactNumber, email, amountApplied } = req.body;
      if (!userId) return res.status(400).json({ error: "userId required" });
      const applied = roundMoney(amountApplied || 0);
      const existing = await pool.query(
        "SELECT * FROM customers WHERE user_id = $1 OR id = $1 LIMIT 1",
        [userId]
      );
      if (existing.rows.length) {
        const prev = existing.rows[0];
        await pool.query(
          `UPDATE customers SET full_name=$1, contact_number=$2, email=$3,
           total_bookings=COALESCE(total_bookings,0)+1,
           total_amount_spent=COALESCE(total_amount_spent,0)+$4,
           total_spent=COALESCE(total_spent,0)+$4, updated_at=NOW() WHERE id=$5`,
          [fullName || prev.full_name, contactNumber || prev.contact_number, email || prev.email, applied, prev.id]
        );
      } else {
        await pool.query(
          `INSERT INTO customers (id, user_id, full_name, contact_number, email,
           total_bookings, total_amount_spent, total_spent, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,1,$6,$6,NOW(),NOW())`,
          [userId, userId, fullName, contactNumber, email || "", applied]
        );
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Customer upsert error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  // ── Users contact lookup ───────────────────────────────────────────
  app.get("/api/users/:id/contact", async (req, res) => {
    try {
      const [userRes, custRes] = await Promise.all([
        pool.query("SELECT phone, display_name FROM users WHERE id = $1", [req.params.id]),
        pool.query("SELECT contact_number FROM customers WHERE user_id = $1 OR id = $1 LIMIT 1", [req.params.id]),
      ]);
      res.json({
        phone: userRes.rows[0]?.phone || null,
        contactNumber: custRes.rows[0]?.contact_number || null,
      });
    } catch (err) {
      console.error("User contact error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  // ── Payments ───────────────────────────────────────────────────────
  app.get("/api/payments", async (req, res) => {
    try {
      let where = "";
      const vals = [];
      if (req.query.bookingId) {
        vals.push(req.query.bookingId);
        where = "WHERE booking_id = $1";
      }
      const result = await pool.query(
        `SELECT * FROM payments ${where} ORDER BY created_at DESC`,
        vals
      );
      res.json(rowsToCamel(result.rows));
    } catch (err) {
      console.error("Payments error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.patch("/api/payments/:id", async (req, res) => {
    try {
      const b = bodyToSnake(req.body);
      const keys = Object.keys(b);
      if (!keys.length) return res.status(400).json({ error: "No fields" });
      const set = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
      await pool.query(`UPDATE payments SET ${set} WHERE id = $${keys.length + 1}`, [...Object.values(b), req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error("Payment update error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.delete("/api/payments/:id", async (req, res) => {
    try {
      await pool.query("DELETE FROM payments WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error("Payment delete error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.delete("/api/bookings/:id/with-payments", async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM payments WHERE booking_id = $1", [req.params.id]);
      await client.query("DELETE FROM bookings WHERE id = $1", [req.params.id]);
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Delete booking error:", err.message);
      res.status(500).json({ error: "Server Error" });
    } finally {
      client.release();
    }
  });

  app.delete("/api/bookings/:id", async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM payments WHERE booking_id = $1", [req.params.id]);
      await client.query("DELETE FROM bookings WHERE id = $1", [req.params.id]);
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Delete booking error:", err.message);
      res.status(500).json({ error: "Server Error" });
    } finally {
      client.release();
    }
  });

  // ── Borrow records ─────────────────────────────────────────────────
  app.get("/api/borrow-records", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM borrow_records ORDER BY borrowed_at DESC NULLS LAST");
      const rows = result.rows.map((r) => ({
        ...rowToCamel(r),
        items: parseJson(r.items, []),
        extensionHistory: parseJson(r.extension_history, []),
      }));
      res.json(rows);
    } catch (err) {
      console.error("Borrow records error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.post("/api/borrow-records", async (req, res) => {
    const client = await pool.connect();
    try {
      const b = req.body;
      const id = b.id || newId();
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO borrow_records (id, borrower_name, items, status, borrowed_at,
          expected_return_at, hours_initial, estimated_rental_charge, created_at, contact_number, court)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),$9,$10)`,
        [
          id,
          b.borrowerName || b.borrower_name,
          stringifyJson(b.items || []),
          b.status || "active",
          b.borrowedAt || b.borrowed_at || new Date(),
          b.expectedReturnAt || b.expected_return_at,
          b.hoursInitial ?? b.hours_initial ?? 0,
          b.estimatedRentalCharge ?? b.estimated_rental_charge ?? 0,
          b.contactNumber || b.contact_number || null,
          b.court || null,
        ]
      );
      for (const line of b.items || []) {
        if (line.itemId && line.quantity) {
          await client.query(
            `UPDATE inventory_items SET available_qty = GREATEST(0, available_qty - $1), updated_at = NOW()
             WHERE id = $2`,
            [line.quantity, line.itemId]
          );
        }
      }
      await client.query("COMMIT");
      res.json({ id });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Create borrow error:", err.message);
      res.status(500).json({ error: "Server Error" });
    } finally {
      client.release();
    }
  });

  app.patch("/api/borrow-records/:id", async (req, res) => {
    const client = await pool.connect();
    try {
      const b = req.body;
      await client.query("BEGIN");
      const snake = bodyToSnake(b);
      if (snake.items) snake.items = stringifyJson(snake.items);
      if (snake.extension_history) snake.extension_history = stringifyJson(snake.extension_history);
      const keys = Object.keys(snake);
      if (keys.length) {
        const set = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
        await client.query(`UPDATE borrow_records SET ${set} WHERE id = $${keys.length + 1}`, [...Object.values(snake), req.params.id]);
      }
      if (b.restoreItems) {
        for (const line of b.restoreItems) {
          await client.query(
            `UPDATE inventory_items SET available_qty = available_qty + $1, updated_at = NOW() WHERE id = $2`,
            [line.quantity, line.itemId]
          );
        }
      }
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Update borrow error:", err.message);
      res.status(500).json({ error: "Server Error" });
    } finally {
      client.release();
    }
  });

  // ── Equipment (camelCase) ──────────────────────────────────────────
  app.get("/api/inventory", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM inventory_items ORDER BY name ASC");
      res.json(
        result.rows.map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          type: r.type || "rental",
          itemType: r.type || "rental",
          notes: r.notes,
          price: Number(r.price) || 0,
          pricePerHour: Number(r.price_per_hour) || 0,
          overdueFinePerHour: Number(r.overdue_fine_per_hour) || 0,
          totalQty: Number(r.total_qty) || 0,
          availableQty: Number(r.available_qty) || 0,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }))
      );
    } catch (err) {
      console.error("Inventory error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.post("/api/inventory", async (req, res) => {
    try {
      const b = req.body;
      const id = b.id || newId();
      const payload = bodyToSnake(b);
      const itemType = payload.type || payload.item_type || "rental";
      await pool.query(
        `INSERT INTO inventory_items (id, name, category, type, notes, price, price_per_hour,
          overdue_fine_per_hour, total_qty, available_qty, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())`,
        [
          id,
          payload.name || "",
          payload.category || "",
          itemType,
          payload.notes || "",
          payload.price ?? 0,
          payload.price_per_hour ?? 0,
          payload.overdue_fine_per_hour ?? 0,
          payload.total_qty ?? payload.total_qty ?? 0,
          payload.available_qty ?? payload.available_qty ?? 0,
        ]
      );
      res.json({ id });
    } catch (err) {
      console.error("Create inventory error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.patch("/api/inventory/:id", async (req, res) => {
    try {
      const b = bodyToSnake(req.body);
      const keys = Object.keys(b);
      if (!keys.length) return res.status(400).json({ error: "No fields" });
      const set = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
      await pool.query(`UPDATE inventory_items SET ${set}, updated_at=NOW() WHERE id = $${keys.length + 1}`, [...Object.values(b), req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error("Update inventory error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.delete("/api/inventory/:id", async (req, res) => {
    try {
      await pool.query("DELETE FROM inventory_items WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      console.error("Delete inventory error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  // ── Equipment filtering endpoints ───────────────────────────────────
  app.get("/api/equipment/for-rent", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM inventory_items WHERE type IN ('rental', 'both') ORDER BY name ASC`
      );
      res.json(
        result.rows.map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          type: r.type || "rental",
          itemType: r.type || "rental",
          notes: r.notes,
          price: Number(r.price) || 0,
          pricePerHour: Number(r.price_per_hour) || 0,
          overdueFinePerHour: Number(r.overdue_fine_per_hour) || 0,
          totalQty: Number(r.total_qty) || 0,
          availableQty: Number(r.available_qty) || 0,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }))
      );
    } catch (err) {
      console.error("Equipment for-rent error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.get("/api/equipment/for-sale", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT * FROM inventory_items WHERE type IN ('sale', 'both') ORDER BY name ASC`
      );
      res.json(
        result.rows.map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          type: r.type || "sale",
          itemType: r.type || "sale",
          notes: r.notes,
          price: Number(r.price) || 0,
          pricePerHour: Number(r.price_per_hour) || 0,
          salePrice: Number(r.price) || 0,
          overdueFinePerHour: Number(r.overdue_fine_per_hour) || 0,
          totalQty: Number(r.total_qty) || 0,
          availableQty: Number(r.available_qty) || 0,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }))
      );
    } catch (err) {
      console.error("Equipment for-sale error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  // ── Equipment sales endpoint ───────────────────────────────────────
  app.post("/api/equipment/sales", async (req, res) => {
    const client = await pool.connect();
    try {
      const s = req.body;
      const id = s.id || newId();
      const buyerName = s.buyerName?.trim() || "";
      const contactNumber = s.contactNumber?.trim() || "";
      const paymentMethod = s.paymentMethod || "Cash";
      const items = s.items || [];

      if (!buyerName) {
        return res.status(400).json({ error: "Buyer name is required" });
      }

      if (!items.length) {
        return res.status(400).json({ error: "At least one item is required" });
      }

      await client.query("BEGIN");

      let totalAmount = 0;
      const saleItems = [];

      for (const line of items) {
        if (!line.itemId || !line.quantity) continue;

        const itemResult = await client.query(
          `SELECT id, name, price, available_qty FROM inventory_items WHERE id = $1`,
          [line.itemId]
        );

        if (!itemResult.rows.length) {
          throw new Error(`Item ${line.itemId} not found`);
        }

        const item = itemResult.rows[0];
        const qty = Math.max(1, Math.floor(Number(line.quantity) || 1));
        const availQty = Number(item.available_qty) || 0;

        if (availQty < qty) {
          throw new Error(`Not enough stock for "${item.name}". Available: ${availQty}`);
        }

        const itemPrice = Number(item.price) || 0;
        const lineTotal = itemPrice * qty;
        totalAmount += lineTotal;

        saleItems.push({
          itemId: line.itemId,
          itemName: item.name,
          quantity: qty,
          price: itemPrice,
          lineTotal: lineTotal,
        });

        // Deduct from inventory
        await client.query(
          `UPDATE inventory_items SET available_qty = GREATEST(0, available_qty - $1), updated_at = NOW() WHERE id = $2`,
          [qty, line.itemId]
        );
      }

      // Record the sale in sales_transactions
      await client.query(
        `INSERT INTO sales_transactions (id, type, source, items, total, payment_method, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [id, "equipment_sale", "equipment", JSON.stringify(saleItems), totalAmount, paymentMethod]
      );

      await client.query("COMMIT");
      res.json({ id, totalAmount, itemsCount: saleItems.length });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Equipment sale error:", err.message);
      res.status(500).json({ error: err.message || "Server Error" });
    } finally {
      client.release();
    }
  });

  // ── Products ───────────────────────────────────────────────────────
  app.get("/api/products", async (req, res) => {
    try {
      let where = "";
      const vals = [];
      if (req.query.storeId) {
        vals.push(req.query.storeId);
        where = "WHERE store_id = $1";
      }
      const result = await pool.query(
        `SELECT * FROM products ${where} ORDER BY name ASC`,
        vals
      );
      res.json(
        result.rows.map((r) => ({
          id: r.id,
          storeId: r.store_id,
          name: r.name,
          description: r.description,
          category: r.category,
          price: Number(r.price) || 0,
          stock: Number(r.stock) ?? Number(r.quantity) ?? 0,
          quantity: Number(r.quantity) ?? Number(r.stock) ?? 0,
          available: r.available !== false,
          productImage: r.product_image,
          prepTimeMinutes: r.prep_time_minutes ?? 15,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }))
      );
    } catch (err) {
      console.error("Products error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const b = req.body;
      const id = b.id || newId();
      await pool.query(
        `INSERT INTO products (id, store_id, name, description, category, price, stock, quantity,
          available, product_image, prep_time_minutes, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())`,
        [
          id,
          b.storeId || b.store_id || null,
          b.name,
          b.description || "",
          b.category || "",
          b.price ?? 0,
          b.stock ?? 0,
          b.quantity ?? b.stock ?? 0,
          b.available !== false,
          b.productImage || b.product_image || null,
          b.prepTimeMinutes ?? b.prep_time_minutes ?? 15,
        ]
      );
      res.json({ id });
    } catch (err) {
      console.error("Create product error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const b = req.body;
      await pool.query(
        `UPDATE products SET name=COALESCE($1,name), description=COALESCE($2,description),
         category=COALESCE($3,category), price=COALESCE($4,price),
         stock=COALESCE($5,stock), quantity=COALESCE($6,quantity),
         available=COALESCE($7,available), product_image=COALESCE($8,product_image),
         prep_time_minutes=COALESCE($9,prep_time_minutes), updated_at=NOW()
         WHERE id=$10`,
        [
          b.name,
          b.description,
          b.category,
          b.price,
          b.stock,
          b.quantity,
          b.available,
          b.productImage || b.product_image,
          b.prepTimeMinutes ?? b.prep_time_minutes,
          req.params.id,
        ]
      );
      res.json({ success: true });
    } catch (err) {
      console.error("Update product error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      await pool.query("DELETE FROM products WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  // ── Court orders (snack POS) ───────────────────────────────────────
  app.get("/api/court-orders", async (req, res) => {
    try {
      let where = "";
      const vals = [];
      if (req.query.bookingId) {
        vals.push(req.query.bookingId);
        where = "WHERE booking_id = $1";
      }
      const result = await pool.query(
        `SELECT * FROM court_orders ${where} ORDER BY created_at DESC`,
        vals
      );
      res.json(
        result.rows.map((r) => ({
          id: r.id,
          bookingId: r.booking_id,
          courtId: r.court_id,
          courtName: r.court_name,
          playerName: r.player_name,
          items: parseJson(r.items, []),
          totalAmount: Number(r.total_amount) || 0,
          status: r.status,
          placedByGuest: r.placed_by_guest,
          createdAt: r.created_at,
        }))
      );
    } catch (err) {
      console.error("Court orders error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.post("/api/court-orders", async (req, res) => {
    try {
      const b = req.body;
      const id = b.id || newId();
      await pool.query(
        `INSERT INTO court_orders (id, booking_id, court_id, court_name, player_name,
          items, total_amount, status, placed_by_guest, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
        [
          id,
          b.bookingId || b.booking_id,
          b.courtId || b.court_id,
          b.courtName || b.court_name,
          b.playerName || b.player_name,
          stringifyJson(b.items || []),
          b.totalAmount ?? b.total_amount ?? 0,
          b.status || "awaiting_approval",
          b.placedByGuest ?? b.placed_by_guest ?? false,
        ]
      );
      res.json({ id });
    } catch (err) {
      console.error("Create court order error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.patch("/api/court-orders/:id", async (req, res) => {
    try {
      const b = req.body;
      await pool.query(
        `UPDATE court_orders SET status=COALESCE($1,status) WHERE id=$2`,
        [b.status, req.params.id]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.post("/api/court-orders/:id/pay", async (req, res) => {
    const client = await pool.connect();
    try {
      const { cashReceived, change, items, products } = req.body;
      const orderId = req.params.id;
      const txId = newId();
      await client.query("BEGIN");
      const orderRes = await client.query("SELECT * FROM court_orders WHERE id = $1", [orderId]);
      const order = orderRes.rows[0];
      if (!order) throw new Error("Order not found");

      await client.query(
        `INSERT INTO sales_transactions (id, type, source, order_id, items, total,
          payment_method, cash_received, change_amount, created_at)
         VALUES ($1,'pos','court_order',$2,$3,$4,'Cash',$5,$6,NOW())`,
        [txId, orderId, order.items, order.total_amount, cashReceived, change]
      );

      for (const line of items || []) {
        const p = (products || []).find((x) => x.id === line.productId);
        if (!p) continue;
        const field = p.stock != null ? "stock" : "quantity";
        await client.query(
          `UPDATE products SET ${field} = GREATEST(0, COALESCE(${field},0) - $1), updated_at = NOW() WHERE id = $2`,
          [line.quantity, line.productId]
        );
      }

      await client.query("UPDATE court_orders SET status = 'paid' WHERE id = $1", [orderId]);
      await client.query("COMMIT");
      res.json({ transactionId: txId });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Pay court order error:", err.message);
      res.status(500).json({ error: "Server Error" });
    } finally {
      client.release();
    }
  });

  // ── Sales transactions ─────────────────────────────────────────────
  app.get("/api/sales-transactions", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 500, 1000);
      const result = await pool.query(
        `SELECT * FROM sales_transactions ORDER BY created_at DESC LIMIT $1`,
        [limit]
      );
      res.json(
        result.rows.map((r) => ({
          id: r.id,
          type: r.type,
          source: r.source,
          orderId: r.order_id,
          customerOrderId: r.customer_order_id,
          items: parseJson(r.items, []),
          total: Number(r.total) || 0,
          paymentMethod: r.payment_method,
          cashReceived: Number(r.cash_received) || 0,
          change: Number(r.change_amount) || 0,
          createdAt: r.created_at,
        }))
      );
    } catch (err) {
      console.error("Sales transactions error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.post("/api/sales-transactions", async (req, res) => {
    try {
      const b = req.body;
      const id = b.id || newId();
      await pool.query(
        `INSERT INTO sales_transactions (id, type, source, order_id, customer_order_id,
          items, total, payment_method, cash_received, change_amount, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())`,
        [
          id,
          b.type,
          b.source,
          b.orderId || b.order_id,
          b.customerOrderId || b.customer_order_id,
          stringifyJson(b.items || []),
          b.total ?? 0,
          b.paymentMethod || b.payment_method,
          b.cashReceived ?? b.cash_received,
          b.change ?? b.change_amount,
        ]
      );
      res.json({ id });
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  // ── SMS logs ───────────────────────────────────────────────────────
  app.post("/api/sms-logs", async (req, res) => {
    try {
      const b = req.body;
      await pool.query(
        `INSERT INTO sms_logs (booking_id, phone_number, phone_raw, message, status, api_response)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          b.bookingId || b.booking_id,
          b.phoneNumber || b.phone_number,
          b.phoneRaw || b.phone_raw,
          b.message,
          b.status,
          stringifyJson(b.apiResponse || b.api_response),
        ]
      );
      res.json({ success: true });
    } catch (err) {
      console.error("SMS log error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  // ── Courts ────────────────────────────────────────────────────────
  app.get("/api/courts", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT id, name, description, price_per_hour AS "pricePerHour", amenities, is_active AS "isActive",
         active_start_time AS "activeStartTime", active_end_time AS "activeEndTime",
         created_at AS "createdAt", updated_at AS "updatedAt"
         FROM courts ORDER BY name ASC`
      );
      res.json(result.rows);
    } catch (err) {
      console.error("Courts error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  // ── Stores ─────────────────────────────────────────────────────────
  app.get("/api/stores", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM stores ORDER BY name ASC");
      res.json(
        result.rows.map((r) => ({
          id: r.id,
          storeId: r.id,
          name: r.name,
          ownerName: r.owner_name,
          contactNumber: r.contact_number,
          stallNumber: r.stall_number,
          category: r.category,
          description: r.description,
          status: r.status,
          commissionRate: Number(r.commission_rate) || 0,
          estimatedPrepMinutes: r.estimated_prep_minutes,
          logoUrl: r.logo_url,
          vendorTokenId: r.vendor_token_id,
          portalUrl: r.portal_url,
          portalPath: r.portal_path,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }))
      );
    } catch (err) {
      console.error("Stores error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.get("/api/stores/:id", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM stores WHERE id = $1", [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: "Not found" });
      const r = result.rows[0];
      res.json({
        id: r.id,
        name: r.name,
        ownerName: r.owner_name,
        contactNumber: r.contact_number,
        stallNumber: r.stall_number,
        category: r.category,
        status: r.status,
        commissionRate: Number(r.commission_rate) || 0,
        logoUrl: r.logo_url,
        vendorTokenId: r.vendor_token_id,
        portalUrl: r.portal_url,
      });
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.post("/api/stores", async (req, res) => {
    const client = await pool.connect();
    try {
      const b = req.body;
      const storeId = b.id || newId();
      const tokenId = newId();
      const token = b.token || (randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 16));
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO vendor_tokens (id, store_id, token, active, created_at) VALUES ($1,$2,$3,true,NOW())`,
        [tokenId, storeId, token]
      );
      const portalPath = `/vendor/store/${storeId}`;
      await client.query(
        `INSERT INTO stores (id, name, owner_name, contact_number, stall_number, category,
          commission_rate, logo_url, status, vendor_token_id, portal_path, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())`,
        [
          storeId,
          b.name,
          b.ownerName || b.owner_name,
          b.contactNumber || b.contact_number,
          b.stallNumber || b.stall_number,
          b.category || "food",
          b.commissionRate ?? b.commission_rate ?? 0,
          b.logoUrl || b.logo_url,
          b.status || "active",
          tokenId,
          portalPath,
        ]
      );
      await client.query("COMMIT");
      res.json({ id: storeId, token, tokenId, portalPath });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Create store error:", err.message);
      res.status(500).json({ error: "Server Error" });
    } finally {
      client.release();
    }
  });

  app.patch("/api/stores/:id", async (req, res) => {
    try {
      const b = bodyToSnake(req.body);
      const keys = Object.keys(b);
      if (!keys.length) return res.status(400).json({ error: "No fields" });
      b.updated_at = new Date();
      const set = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
      await pool.query(`UPDATE stores SET ${set} WHERE id = $${keys.length + 1}`, [...Object.values(b), req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.delete("/api/stores/:id", async (req, res) => {
    const client = await pool.connect();
    try {
      const store = await client.query("SELECT vendor_token_id FROM stores WHERE id = $1", [req.params.id]);
      await client.query("BEGIN");
      if (store.rows[0]?.vendor_token_id) {
        await client.query("DELETE FROM vendor_tokens WHERE id = $1", [store.rows[0].vendor_token_id]);
      }
      await client.query("DELETE FROM stores WHERE id = $1", [req.params.id]);
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: "Server Error" });
    } finally {
      client.release();
    }
  });

  app.post("/api/stores/:id/rotate-token", async (req, res) => {
    try {
      const store = await pool.query("SELECT vendor_token_id FROM stores WHERE id = $1", [req.params.id]);
      if (!store.rows.length) return res.status(404).json({ error: "Not found" });
      const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 16);
      const tokenId = store.rows[0].vendor_token_id;
      if (tokenId) {
        await pool.query("UPDATE vendor_tokens SET token=$1, rotated_at=NOW(), active=true WHERE id=$2", [token, tokenId]);
      } else {
        const newTokenId = newId();
        await pool.query("INSERT INTO vendor_tokens (id, store_id, token, active) VALUES ($1,$2,$3,true)", [newTokenId, req.params.id, token]);
        await pool.query("UPDATE stores SET vendor_token_id=$1 WHERE id=$2", [newTokenId, req.params.id]);
      }
      res.json({ token });
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.post("/api/vendor/validate-token", async (req, res) => {
    try {
      const { storeId, token } = req.body;
      const storeRes = await pool.query("SELECT * FROM stores WHERE id = $1", [storeId]);
      if (!storeRes.rows.length || storeRes.rows[0].status !== "active") {
        return res.json({ ok: false, error: "Store not found or inactive" });
      }
      const store = storeRes.rows[0];
      if (!store.vendor_token_id) return res.json({ ok: false, error: "Invalid token configuration" });
      const tokenRes = await pool.query("SELECT * FROM vendor_tokens WHERE id = $1", [store.vendor_token_id]);
      if (!tokenRes.rows.length) return res.json({ ok: false, error: "Invalid token" });
      const td = tokenRes.rows[0];
      if (td.store_id !== storeId || td.token !== token || td.active === false) {
        return res.json({ ok: false, error: "Access denied" });
      }
      res.json({
        ok: true,
        store: {
          id: store.id,
          name: store.name,
          status: store.status,
          commissionRate: Number(store.commission_rate) || 0,
        },
      });
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  // ── Customer orders ────────────────────────────────────────────────
  function mapCustomerOrder(r) {
    return {
      id: r.id,
      customerName: r.customer_name,
      customerType: r.customer_type,
      orderSource: r.order_source,
      status: r.status,
      dispatchStatus: r.dispatch_status,
      paymentMode: r.payment_mode,
      paymentStatus: r.payment_status,
      paymentMethod: r.payment_method,
      subtotal: Number(r.subtotal) || 0,
      serviceFee: Number(r.service_fee) || 0,
      grandTotal: Number(r.grand_total) || 0,
      storeBreakdown: parseJson(r.store_breakdown, []),
      settlements: parseJson(r.settlements, []),
      vendorOrderIds: parseJson(r.vendor_order_ids, []),
      userId: r.user_id,
      userEmail: r.user_email,
      guestPhone: r.guest_phone,
      bookingId: r.booking_id,
      courtId: r.court_id,
      courtName: r.court_name,
      verificationCode: r.verification_code,
      totalCommission: Number(r.total_commission) || 0,
      totalVendorNet: Number(r.total_vendor_net) || 0,
      cashierName: r.cashier_name,
      paidAt: r.paid_at,
      dispatchedAt: r.dispatched_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  app.get("/api/customer-orders", async (req, res) => {
    try {
      let where = "";
      const vals = [];
      if (req.query.userId) {
        vals.push(req.query.userId);
        where = "WHERE user_id = $1";
      }
      const result = await pool.query(
        `SELECT * FROM customer_orders ${where} ORDER BY created_at DESC`,
        vals
      );
      res.json(result.rows.map(mapCustomerOrder));
    } catch (err) {
      console.error("Customer orders error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.get("/api/customer-orders/:id", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM customer_orders WHERE id = $1", [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: "Not found" });
      res.json(mapCustomerOrder(result.rows[0]));
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.post("/api/customer-orders", async (req, res) => {
    const client = await pool.connect();
    try {
      const b = req.body;
      const id = b.id || newId();
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO customer_orders (id, customer_name, customer_type, order_source, status,
          dispatch_status, payment_mode, payment_status, subtotal, service_fee, grand_total,
          store_breakdown, user_id, user_email, guest_phone, booking_id, court_id, court_name,
          vendor_order_ids, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW(),NOW())`,
        [
          id,
          b.customerName,
          b.customerType,
          b.orderSource,
          b.status,
          b.dispatchStatus,
          b.paymentMode,
          b.paymentStatus,
          b.subtotal,
          b.serviceFee,
          b.grandTotal,
          stringifyJson(b.storeBreakdown || []),
          b.userId,
          b.userEmail,
          b.guestPhone,
          b.bookingId,
          b.courtId,
          b.courtName,
          stringifyJson(b.vendorOrderIds || []),
        ]
      );

      const vendorOrderIds = [];
      if (b.dispatchNow && b.storeBreakdown) {
        for (const block of b.storeBreakdown) {
          const voId = newId();
          vendorOrderIds.push({ storeId: block.storeId, vendorOrderId: voId });
          await client.query(
            `INSERT INTO orders (id, store_id, customer_order_id, court_id, store_name,
              customer_name, player_name, status, subtotal, payment_badge, items, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
            [
              voId,
              block.storeId,
              id,
              b.courtId,
              block.storeName,
              b.customerName,
              b.customerName,
              "pending",
              block.subtotal,
              b.paymentBadge || "paid",
              stringifyJson(block.items || []),
            ]
          );
        }
        await client.query(
          `UPDATE customer_orders SET vendor_order_ids=$1, dispatch_status='dispatched',
           dispatched_at=NOW() WHERE id=$2`,
          [stringifyJson(vendorOrderIds), id]
        );
      }

      if (b.addToBalance && b.userId && b.grandTotal) {
        const balRes = await client.query("SELECT * FROM customer_balances WHERE user_id = $1", [b.userId]);
        if (balRes.rows.length) {
          await client.query(
            `UPDATE customer_balances SET outstanding_balance = outstanding_balance + $1,
             pay_later_order_ids = pay_later_order_ids || $2::jsonb, updated_at = NOW()
             WHERE user_id = $3`,
            [b.grandTotal, JSON.stringify([id]), b.userId]
          );
        } else {
          await client.query(
            `INSERT INTO customer_balances (user_id, outstanding_balance, pay_later_order_ids)
             VALUES ($1,$2,$3)`,
            [b.userId, b.grandTotal, JSON.stringify([id])]
          );
        }
      }

      await client.query("COMMIT");
      res.json({ customerOrderId: id, vendorOrderIds });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Create customer order error:", err.message);
      res.status(500).json({ error: "Server Error" });
    } finally {
      client.release();
    }
  });

  app.patch("/api/customer-orders/:id", async (req, res) => {
    try {
      const b = bodyToSnake(req.body);
      if (b.store_breakdown) b.store_breakdown = stringifyJson(b.store_breakdown);
      if (b.settlements) b.settlements = stringifyJson(b.settlements);
      if (b.vendor_order_ids) b.vendor_order_ids = stringifyJson(b.vendor_order_ids);
      b.updated_at = new Date();
      const keys = Object.keys(b);
      const set = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
      await pool.query(`UPDATE customer_orders SET ${set} WHERE id = $${keys.length + 1}`, [...Object.values(b), req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.post("/api/customer-orders/:id/pay-at-pos", async (req, res) => {
    const client = await pool.connect();
    try {
      const b = req.body;
      const orderId = req.params.id;
      const orderRes = await client.query("SELECT * FROM customer_orders WHERE id = $1", [orderId]);
      const order = orderRes.rows[0];
      if (!order) return res.status(404).json({ error: "Not found" });

      const verificationCode =
        "FC-" + orderId.substring(0, 6).toUpperCase() + "-" + Math.floor(1000 + Math.random() * 9000);
      const storeBreakdown = parseJson(order.store_breakdown, []);
      const settlements = b.settlements || [];
      const vendorOrderIds = parseJson(order.vendor_order_ids, []);

      await client.query("BEGIN");

      if (order.dispatch_status !== "dispatched") {
        const newVoIds = [];
        for (const block of storeBreakdown) {
          const voId = newId();
          newVoIds.push({ storeId: block.storeId, vendorOrderId: voId });
          await client.query(
            `INSERT INTO orders (id, store_id, customer_order_id, store_name, customer_name,
              status, subtotal, payment_badge, items, created_at)
             VALUES ($1,$2,$3,$4,$5,'pending',$6,'paid',$7,NOW())`,
            [voId, block.storeId, orderId, block.storeName, order.customer_name, block.subtotal, stringifyJson(block.items)]
          );
          for (const item of block.items || []) {
            if (item.productId && item.quantity) {
              await client.query(
                `UPDATE products SET stock = GREATEST(0, COALESCE(stock,0) - $1), updated_at = NOW() WHERE id = $2`,
                [item.quantity, item.productId]
              );
            }
          }
        }
        await client.query(
          `UPDATE customer_orders SET vendor_order_ids=$1, dispatch_status='dispatched', dispatched_at=NOW() WHERE id=$2`,
          [stringifyJson(newVoIds), orderId]
        );
      } else {
        for (const vo of vendorOrderIds) {
          await client.query(
            `UPDATE orders SET payment_badge='paid', status='pending' WHERE id=$1 AND store_id=$2`,
            [vo.vendorOrderId, vo.storeId]
          );
        }
      }

      const payoutId = newId();
      await client.query(
        `INSERT INTO vendor_payouts (id, customer_order_id, settlements, total_commission,
          total_vendor_net, grand_total, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,'pending',NOW())`,
        [payoutId, orderId, stringifyJson(settlements), b.totalCommission, b.totalVendorNet, order.grand_total]
      );

      await client.query(
        `UPDATE customer_orders SET status='paid', payment_status='paid', payment_method=$1,
         cashier_name=$2, paid_at=NOW(), verification_code=$3, settlements=$4,
         total_commission=$5, total_vendor_net=$6, updated_at=NOW() WHERE id=$7`,
        [b.paymentMethod, b.cashierName, verificationCode, stringifyJson(settlements), b.totalCommission, b.totalVendorNet, orderId]
      );

      await client.query("COMMIT");
      res.json({ verificationCode, settlements, totalCommission: b.totalCommission, totalVendorNet: b.totalVendorNet });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Pay at POS error:", err.message);
      res.status(500).json({ error: "Server Error" });
    } finally {
      client.release();
    }
  });

  // ── Vendor orders (orders table) ─────────────────────────────────
  app.get("/api/vendor-orders", async (req, res) => {
    try {
      let where = "WHERE 1=1";
      const vals = [];
      if (req.query.storeId) {
        vals.push(req.query.storeId);
        where += ` AND store_id = $${vals.length}`;
      }
      const result = await pool.query(
        `SELECT * FROM orders ${where} ORDER BY created_at DESC`,
        vals
      );
      res.json(
        result.rows.map((r) => ({
          id: r.id,
          storeId: r.store_id,
          customerOrderId: r.customer_order_id,
          courtId: r.court_id,
          storeName: r.store_name,
          customerName: r.customer_name,
          playerName: r.player_name,
          status: r.status,
          subtotal: Number(r.subtotal) || 0,
          paymentBadge: r.payment_badge,
          items: parseJson(r.items, []),
          visibleToVendor: r.payment_badge !== "BLOCKED",
          transferredAt: r.transferred_at,
          completedAt: r.completed_at,
          createdAt: r.created_at,
        }))
      );
    } catch (err) {
      console.error("Vendor orders error:", err.message);
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.patch("/api/vendor-orders/:storeId/:id", async (req, res) => {
    const client = await pool.connect();
    try {
      const b = req.body;
      const { storeId, id } = req.params;
      await client.query("BEGIN");
      if (b.status === "completed" && b.adjustStock) {
        const orderRes = await client.query("SELECT items, stock_adjusted FROM orders WHERE id=$1 AND store_id=$2", [id, storeId]);
        const order = orderRes.rows[0];
        if (order && !order.stock_adjusted) {
          for (const item of parseJson(order.items, [])) {
            if (item.productId && item.quantity) {
              await client.query(
                `UPDATE products SET stock = GREATEST(0, COALESCE(stock,0) - $1) WHERE id = $2`,
                [Math.floor(Number(item.quantity) || 0), item.productId]
              );
            }
          }
          await client.query(
            `UPDATE orders SET status=$1, completed_at=NOW(), stock_adjusted=true WHERE id=$2 AND store_id=$3`,
            [b.status, id, storeId]
          );
        }
      } else {
        const fields = [];
        const vals = [];
        if (b.status) { vals.push(b.status); fields.push(`status = $${vals.length}`); }
        if (b.transferredAt !== undefined) { vals.push(b.transferredAt || new Date()); fields.push(`transferred_at = $${vals.length}`); }
        if (fields.length) {
          vals.push(id, storeId);
          await client.query(`UPDATE orders SET ${fields.join(", ")} WHERE id = $${vals.length - 1} AND store_id = $${vals.length}`, vals);
        }
      }
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: "Server Error" });
    } finally {
      client.release();
    }
  });

  // ── Vendor payouts ─────────────────────────────────────────────────
  app.get("/api/vendor-payouts", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM vendor_payouts ORDER BY created_at DESC");
      res.json(
        result.rows.map((r) => ({
          id: r.id,
          customerOrderId: r.customer_order_id,
          settlements: parseJson(r.settlements, []),
          totalCommission: Number(r.total_commission) || 0,
          totalVendorNet: Number(r.total_vendor_net) || 0,
          grandTotal: Number(r.grand_total) || 0,
          status: r.status,
          paidAt: r.paid_at,
          createdAt: r.created_at,
        }))
      );
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.patch("/api/vendor-payouts/:id", async (req, res) => {
    try {
      await pool.query(
        `UPDATE vendor_payouts SET status=$1, paid_at=NOW() WHERE id=$2`,
        [req.body.status || "paid", req.params.id]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  // ── Food court config ──────────────────────────────────────────────
  app.get("/api/food-court-config", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM food_court_config WHERE id = 'globalQR'");
      if (!result.rows.length) {
        return res.json({ title: "RANAW Food Court", subtitle: "Scan to order from all stalls", publicPath: "/food-court" });
      }
      const r = result.rows[0];
      res.json({ id: r.id, title: r.title, subtitle: r.subtitle, publicPath: r.public_path });
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.put("/api/food-court-config", async (req, res) => {
    try {
      const b = req.body;
      await pool.query(
        `INSERT INTO food_court_config (id, title, subtitle, public_path, updated_at)
         VALUES ('globalQR',$1,$2,$3,NOW())
         ON CONFLICT (id) DO UPDATE SET title=$1, subtitle=$2, public_path=$3, updated_at=NOW()`,
        [b.title || "RANAW Food Court", b.subtitle || "", b.publicPath || "/food-court"]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  // ── Customer balances ──────────────────────────────────────────────
  app.get("/api/customer-balances/:userId", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM customer_balances WHERE user_id = $1", [req.params.userId]);
      if (!result.rows.length) return res.json({ outstandingBalance: 0, payLaterOrderIds: [] });
      const r = result.rows[0];
      res.json({
        outstandingBalance: Number(r.outstanding_balance) || 0,
        payLaterOrderIds: parseJson(r.pay_later_order_ids, []),
      });
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.post("/api/customer-balances/:userId/add", async (req, res) => {
    try {
      const { customerOrderId, amount } = req.body;
      const existing = await pool.query("SELECT * FROM customer_balances WHERE user_id = $1", [req.params.userId]);
      if (!existing.rows.length) {
        await pool.query(
          `INSERT INTO customer_balances (user_id, outstanding_balance, pay_later_order_ids) VALUES ($1,$2,$3)`,
          [req.params.userId, amount, JSON.stringify([customerOrderId])]
        );
      } else {
        await pool.query(
          `UPDATE customer_balances SET outstanding_balance = outstanding_balance + $1,
           pay_later_order_ids = pay_later_order_ids || $2::jsonb, updated_at = NOW()
           WHERE user_id = $3`,
          [amount, JSON.stringify([customerOrderId]), req.params.userId]
        );
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.post("/api/customer-balances/:userId/settle", async (req, res) => {
    try {
      const { amount, paymentMethod, cashierName, orderIds } = req.body;
      const balRes = await pool.query("SELECT * FROM customer_balances WHERE user_id = $1", [req.params.userId]);
      const current = balRes.rows.length ? Number(balRes.rows[0].outstanding_balance) : 0;
      const pay = roundMoney(amount);
      const newBal = roundMoney(Math.max(0, current - pay));
      const prevIds = balRes.rows.length ? parseJson(balRes.rows[0].pay_later_order_ids, []) : [];
      const newIds = newBal <= 0 ? [] : prevIds.filter((id) => !(orderIds || []).includes(id));

      if (balRes.rows.length) {
        await pool.query(
          `UPDATE customer_balances SET outstanding_balance=$1, pay_later_order_ids=$2, updated_at=NOW() WHERE user_id=$3`,
          [newBal, JSON.stringify(newIds), req.params.userId]
        );
      }

      await pool.query(
        `INSERT INTO customer_balance_payments (user_id, amount, payment_method, cashier_name, order_ids, previous_balance, new_balance)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [req.params.userId, pay, paymentMethod, cashierName, JSON.stringify(orderIds || []), current, newBal]
      );

      res.json({ previousBalance: current, newBalance: newBal });
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  // ── Paddle stacking ────────────────────────────────────────────────
  app.get("/api/paddle-stack/state", async (req, res) => {
    try {
      const result = await pool.query("SELECT data FROM paddle_stack_state WHERE id = 'state'");
      if (!result.rows.length) return res.json({});
      res.json(result.rows[0].data || {});
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.put("/api/paddle-stack/state", async (req, res) => {
    try {
      await pool.query(
        `INSERT INTO paddle_stack_state (id, data, updated_at) VALUES ('state',$1,NOW())
         ON CONFLICT (id) DO UPDATE SET data=$1, updated_at=NOW()`,
        [JSON.stringify(req.body || {})]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.get("/api/paddle-match-history", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 80, 200);
      const result = await pool.query(
        `SELECT id, data, ended_at FROM paddle_match_history ORDER BY ended_at DESC LIMIT $1`,
        [limit]
      );
      res.json(result.rows.map((r) => ({ id: r.id, ...r.data, endedAt: r.ended_at })));
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.post("/api/paddle-match-history", async (req, res) => {
    try {
      const id = req.body.id || newId();
      const { id: _id, ...data } = req.body;
      await pool.query(
        `INSERT INTO paddle_match_history (id, data, ended_at) VALUES ($1,$2,COALESCE($3,NOW()))`,
        [id, JSON.stringify(data), req.body.endedAt || null]
      );
      res.json({ id });
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  // ── Tournaments ────────────────────────────────────────────────────
  app.get("/api/tournaments/:id", async (req, res) => {
    try {
      const result = await pool.query("SELECT * FROM tournaments WHERE id = $1", [req.params.id]);
      if (!result.rows.length) return res.status(404).json({ error: "Not found" });
      const r = result.rows[0];
      res.json({
        name: r.name,
        format: r.format,
        tournamentFormat: r.tournament_format,
        scoringMode: r.scoring_mode,
        champion: r.champion,
        createdAt: r.created_at,
      });
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.post("/api/tournaments", async (req, res) => {
    const client = await pool.connect();
    try {
      const { tournamentId, name, format, tournamentFormat, scoringMode, matchMap } = req.body;
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO tournaments (id, name, format, tournament_format, scoring_mode, created_at)
         VALUES ($1,$2,$3,$4,$5,NOW()) ON CONFLICT (id) DO NOTHING`,
        [tournamentId, name, format, tournamentFormat || "single-elimination", scoringMode || "traditional"]
      );
      for (const match of Object.values(matchMap || {})) {
        const clean = {};
        for (const [k, v] of Object.entries(match)) clean[k] = v === undefined ? null : v;
        await client.query(
          `INSERT INTO tournament_matches (id, tournament_id, data) VALUES ($1,$2,$3)
           ON CONFLICT (tournament_id, id) DO UPDATE SET data=$3`,
          [match.matchId, tournamentId, JSON.stringify(clean)]
        );
      }
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: "Server Error" });
    } finally {
      client.release();
    }
  });

  app.get("/api/tournaments/:id/matches", async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT id, data FROM tournament_matches WHERE tournament_id = $1",
        [req.params.id]
      );
      const matches = {};
      result.rows.forEach((r) => {
        matches[r.id] = r.data;
      });
      res.json(matches);
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.get("/api/tournaments/:id/matches/:matchId", async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT data FROM tournament_matches WHERE tournament_id = $1 AND id = $2",
        [req.params.id, req.params.matchId]
      );
      if (!result.rows.length) return res.status(404).json({ error: "Not found" });
      res.json(result.rows[0].data);
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.patch("/api/tournaments/:id/matches/:matchId", async (req, res) => {
    try {
      const clean = {};
      for (const [k, v] of Object.entries(req.body)) clean[k] = v === undefined ? null : v;
      await pool.query(
        `INSERT INTO tournament_matches (id, tournament_id, data) VALUES ($1,$2,$3)
         ON CONFLICT (tournament_id, id) DO UPDATE SET data=$3`,
        [req.params.matchId, req.params.id, JSON.stringify(clean)]
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });

  app.patch("/api/tournaments/:id", async (req, res) => {
    try {
      const b = bodyToSnake(req.body);
      const keys = Object.keys(b);
      if (!keys.length) return res.status(400).json({ error: "No fields" });
      const set = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");
      await pool.query(`UPDATE tournaments SET ${set} WHERE id = $${keys.length + 1}`, [...Object.values(b), req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Server Error" });
    }
  });
}

module.exports = { registerRoutes };
