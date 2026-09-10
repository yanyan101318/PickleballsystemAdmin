require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");
const { randomUUID } = require("crypto");
const pool = require("./config/db");
const tournamentV2Routes = require("./server/tournamentV2Routes");

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use("/api/tournaments-v2", tournamentV2Routes);

const notificationsRouter = require("./server/routes/notifications");
app.use("/api/notifications", notificationsRouter);

async function ensureDatabaseSchema() {
  try {
    await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS rejection_reason TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`);
    
    // Add missing columns to courts
    await pool.query(`ALTER TABLE courts ADD COLUMN IF NOT EXISTS base_status VARCHAR(50) DEFAULT 'available'`);
    await pool.query(`ALTER TABLE courts ADD COLUMN IF NOT EXISTS override_status VARCHAR(50)`);
    await pool.query(`ALTER TABLE courts ADD COLUMN IF NOT EXISTS override_expires_at TIMESTAMPTZ`);
    await pool.query(`ALTER TABLE courts ADD COLUMN IF NOT EXISTS qr_code_image TEXT`);

    // Add missing columns to bookings
    await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS remaining_balance DECIMAL(12,2)`);
    await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_plan VARCHAR(50)`);
    await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50)`);
    await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_payment_status VARCHAR(50)`);
    await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12,2)`);
    await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12,2)`);
    await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS email VARCHAR(255)`);
    await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS start_time VARCHAR(50)`);
    await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_time VARCHAR(50)`);
    await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_date DATE`);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS paddle_stack_state (
          id VARCHAR(50) PRIMARY KEY,
          data JSONB,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS paddle_match_history (
          id VARCHAR(255) PRIMARY KEY,
          data JSONB,
          ended_at TIMESTAMPTZ DEFAULT NOW()
        );

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

        CREATE TABLE IF NOT EXISTS borrow_records (
          id VARCHAR(255) PRIMARY KEY,
          customer_name VARCHAR(255),
          items JSONB DEFAULT '[]',
          total_amount DECIMAL(12,2) DEFAULT 0,
          rented_at TIMESTAMPTZ,
          expected_return_at TIMESTAMPTZ,
          returned_at TIMESTAMPTZ,
          actual_return_at TIMESTAMPTZ,
          status VARCHAR(50),
          hours_initial INT,
          estimated_rental_charge DECIMAL(12,2),
          extension_history JSONB DEFAULT '[]',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

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

        CREATE TABLE IF NOT EXISTS v2_tournaments (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255),
          date DATE,
          time VARCHAR(50),
          status VARCHAR(50) DEFAULT 'Active',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS notifications (
          id VARCHAR(255) PRIMARY KEY,
          type VARCHAR(50) DEFAULT 'booking',
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          data JSONB DEFAULT '{}',
          is_read BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS v2_divisions (
          id VARCHAR(255) PRIMARY KEY,
          tournament_id VARCHAR(255) REFERENCES v2_tournaments(id) ON DELETE CASCADE,
          name VARCHAR(255),
          gender VARCHAR(50),
          skill_level VARCHAR(50),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS v2_teams (
          id VARCHAR(255) PRIMARY KEY,
          division_id VARCHAR(255) REFERENCES v2_divisions(id) ON DELETE CASCADE,
          team_name VARCHAR(255),
          player1 VARCHAR(255),
          player2 VARCHAR(255),
          club_name VARCHAR(255),
          wins INT DEFAULT 0,
          losses INT DEFAULT 0,
          point_diff INT DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS v2_matches (
          id VARCHAR(255) PRIMARY KEY,
          division_id VARCHAR(255) REFERENCES v2_divisions(id) ON DELETE CASCADE,
          stage VARCHAR(50),
          bracket_group INT,
          match_round INT,
          match_order INT,
          team_a_id VARCHAR(255) REFERENCES v2_teams(id) ON DELETE SET NULL,
          team_b_id VARCHAR(255) REFERENCES v2_teams(id) ON DELETE SET NULL,
          court VARCHAR(50),
          status VARCHAR(50) DEFAULT 'Pending',
          otp VARCHAR(10),
          score_a INT DEFAULT 0,
          score_b INT DEFAULT 0,
          winner_id VARCHAR(255) REFERENCES v2_teams(id) ON DELETE SET NULL,
          next_match_id VARCHAR(255),
          next_loser_match_id VARCHAR(255),
          match_type VARCHAR(100),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS chats (
          id VARCHAR(255) PRIMARY KEY,
          user_id VARCHAR(255),
          user_name VARCHAR(255),
          email VARCHAR(255),
          last_message TEXT,
          last_message_at TIMESTAMPTZ,
          unread_by_admin BOOLEAN DEFAULT false,
          unread_by_customer BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS messages (
          id VARCHAR(255) PRIMARY KEY,
          chat_id VARCHAR(255) REFERENCES chats(id) ON DELETE CASCADE,
          sender_id VARCHAR(255),
          sender_name VARCHAR(255),
          text TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_messages_chat_created_at ON messages (chat_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats (user_id);
        
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}';
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS image TEXT;
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS group_id VARCHAR(255);

        CREATE TABLE IF NOT EXISTS message_reports (
          id VARCHAR(255) PRIMARY KEY,
          message_id VARCHAR(255) REFERENCES messages(id) ON DELETE CASCADE,
          reporter_id VARCHAR(255),
          reason TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    } catch (err) {
    console.error("Database schema migration failed:", err.message);
  }
}

// ==========================================
// AUTH API (PostgreSQL)
// ==========================================

// POST: Register a new admin user
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required." });
    }

    // Check if email already exists
    const existing = await pool.query("SELECT uid FROM admin WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "This email is already registered." });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const newId = randomUUID();

    const result = await pool.query(
      `INSERT INTO admin (uid, email, full_name, phone, role, password_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING uid as id, email, full_name as display_name, role, photo_url as avatar`,
      [newId, email.trim(), name.trim(), phone ? phone.trim() : null, "admin", password_hash]
    );

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("Register error:", err.message);
    res.status(500).json({ error: "Server error during registration." });
  }
});

// POST: Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const result = await pool.query(
      "SELECT uid as id, email, full_name as display_name, role, password_hash, photo_url as avatar FROM admin WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "No account found with this email." });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(401).json({ error: "This account has no password set. Please register again." });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Incorrect password." });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ error: "Server error during login." });
  }
});

// PATCH: Update Profile (Avatar)
app.patch("/api/auth/profile", async (req, res) => {
  try {
    const { id, avatar } = req.body;
    if (!id) {
      return res.status(400).json({ error: "User ID is required." });
    }

    const result = await pool.query(
      "UPDATE admin SET photo_url = $1 WHERE uid = $2 RETURNING uid as id, email, full_name as display_name, role, photo_url as avatar",
      [avatar, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error("Profile update error:", err.message);
    res.status(500).json({ error: "Server error during profile update." });
  }
});

const isDev = process.env.NODE_ENV !== "production";

// ==========================================
// ADMIN CHAT API
// ==========================================

app.get('/api/chats/admin/chats', async (req, res) => {
  try {
    const chats = await pool.query('SELECT * FROM chats ORDER BY last_message_at DESC');
    res.json(chats.rows.map(c => ({
      id: c.id,
      userId: c.user_id,
      userName: c.user_name,
      lastMessage: c.last_message,
      lastMessageAt: c.last_message_at,
      unreadByAdmin: c.unread_by_admin,
      unreadByCustomer: c.unread_by_customer
    })));
  } catch (error) {
    console.error("Error fetching chats:", error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/chats/admin/chats/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { cursor } = req.query;

    let queryText = '';
    let queryParams = [];

    if (cursor) {
      queryText = `
        SELECT * FROM messages 
        WHERE chat_id = $1 AND created_at < $2 
        ORDER BY created_at DESC 
        LIMIT 50
      `;
      queryParams = [chatId, cursor];
    } else {
      queryText = `
        SELECT * FROM messages 
        WHERE chat_id = $1 
        ORDER BY created_at DESC 
        LIMIT 50
      `;
      queryParams = [chatId];
    }

    const { rows } = await pool.query(queryText, queryParams);
    const messages = rows.reverse(); // old to new for UI rendering
    const nextCursor = rows.length === 50 ? messages[0].created_at : null;

    res.json({
      messages: messages.map(m => ({
        id: m.id,
        chatId: m.chat_id,
        senderId: m.sender_id,
        senderName: m.sender_name,
        text: m.text,
        createdAt: m.created_at,
        isEdited: m.is_edited,
        isDeleted: m.is_deleted,
        isPinned: m.is_pinned,
        reactions: m.reactions || {},
        image: m.image
      })),
      nextCursor
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/chats/admin/chats/:chatId/mark-read', async (req, res) => {
  try {
    await pool.query('UPDATE chats SET unread_by_admin = false WHERE id = $1', [req.params.chatId]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking chat read:", error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/chats/admin/chats/:chatId/messages', async (req, res) => {
  try {
    const { text, senderName, image, groupId } = req.body;
    if (!text && !image) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }
    const chatId = req.params.chatId;
    
    await pool.query(
      'UPDATE chats SET last_message = $1, last_message_at = NOW(), unread_by_admin = false, unread_by_customer = true WHERE id = $2',
      [text || 'Sent an image', chatId]
    );

    const msgId = 'msg_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
    const msg = await pool.query(
      'INSERT INTO messages (id, chat_id, sender_id, sender_name, text, image, group_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [msgId, chatId, 'admin', senderName || 'Admin', text, image, groupId || null]
    );

    const formattedMsg = {
      id: msg.rows[0].id,
      chatId: msg.rows[0].chat_id,
      senderId: msg.rows[0].sender_id,
      senderName: msg.rows[0].sender_name,
      text: msg.rows[0].text,
      createdAt: msg.rows[0].created_at,
      isEdited: false,
      isDeleted: false,
      isPinned: false,
      reactions: {},
      image: msg.rows[0].image,
      groupId: msg.rows[0].group_id
    };

    // Broadcast event to User app's Socket.io server via Postgres NOTIFY
    await pool.query(`SELECT pg_notify('chat_events', $1)`, [
      JSON.stringify({
        event: 'messageCreated',
        chatId,
        payload: formattedMsg
      })
    ]);

    res.json(formattedMsg);
  } catch (error) {
    console.error("Error sending admin message:", error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Edit admin message
app.put('/api/chats/admin/chats/:chatId/messages/:messageId', async (req, res) => {
  try {
    const { text } = req.body;
    const { chatId, messageId } = req.params;
    
    const msg = await pool.query(
      'UPDATE messages SET text = $1, is_edited = true WHERE id = $2 AND chat_id = $3 RETURNING *',
      [text, messageId, chatId]
    );
    
    if (msg.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    
    const formattedMsg = {
      id: msg.rows[0].id,
      chatId: msg.rows[0].chat_id,
      text: msg.rows[0].text,
      isEdited: msg.rows[0].is_edited
    };
    
    await pool.query(`SELECT pg_notify('chat_events', $1)`, [JSON.stringify({ event: 'messageEdited', chatId, payload: formattedMsg })]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error editing message:", error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Delete message (Admin can delete any message in the chat)
app.delete('/api/chats/admin/chats/:chatId/messages/:messageId', async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    
    // First, check if the message has a group_id
    const check = await pool.query('SELECT group_id FROM messages WHERE id = $1 AND chat_id = $2', [messageId, chatId]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const groupId = check.rows[0].group_id;

    if (groupId) {
      const msgs = await pool.query(
        'UPDATE messages SET text = $1, is_deleted = true, image = NULL WHERE group_id = $2 AND chat_id = $3 RETURNING *',
        ['This message was deleted by Admin', groupId, chatId]
      );
      for (const row of msgs.rows) {
        await pool.query(`SELECT pg_notify('chat_events', $1)`, [JSON.stringify({ event: 'messageDeleted', chatId, payload: { id: row.id, chatId, groupId } })]);
      }
    } else {
      const msg = await pool.query(
        'UPDATE messages SET text = $1, is_deleted = true, image = NULL WHERE id = $2 AND chat_id = $3 RETURNING *',
        ['This message was deleted by Admin', messageId, chatId]
      );
      if (msg.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      await pool.query(`SELECT pg_notify('chat_events', $1)`, [JSON.stringify({ event: 'messageDeleted', chatId, payload: { id: messageId, chatId } })]);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Pin/Unpin message
app.post('/api/chats/admin/chats/:chatId/messages/:messageId/pin', async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const check = await pool.query('SELECT is_pinned FROM messages WHERE id = $1 AND chat_id = $2', [messageId, chatId]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    
    const newStatus = !check.rows[0].is_pinned;
    const msg = await pool.query(
      'UPDATE messages SET is_pinned = $1 WHERE id = $2 RETURNING *',
      [newStatus, messageId]
    );
    
    await pool.query(`SELECT pg_notify('chat_events', $1)`, [JSON.stringify({ event: 'messagePinned', chatId, payload: { id: messageId, chatId, isPinned: newStatus } })]);
    res.json({ success: true, isPinned: newStatus });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// React to message
app.post('/api/chats/admin/chats/:chatId/messages/:messageId/react', async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const { emoji } = req.body;
    
    const check = await pool.query('SELECT reactions FROM messages WHERE id = $1 AND chat_id = $2', [messageId, chatId]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    
    let reactions = check.rows[0].reactions || {};
    const adminId = 'admin'; // Use a generic admin ID for reactions
    
    if (!reactions[emoji]) reactions[emoji] = [];
    const userIndex = reactions[emoji].indexOf(adminId);
    if (userIndex > -1) {
      reactions[emoji].splice(userIndex, 1);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji].push(adminId);
    }
    
    await pool.query('UPDATE messages SET reactions = $1 WHERE id = $2', [JSON.stringify(reactions), messageId]);
    
    await pool.query(`SELECT pg_notify('chat_events', $1)`, [JSON.stringify({ event: 'messageReacted', chatId, payload: { id: messageId, chatId, reactions } })]);
    res.json({ success: true, reactions });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==========================================
// SMS API LOGIC (Preserved)
// ==========================================
function loadSendSmsHandler() {
  const handlerPath = path.resolve(__dirname, "api", "send-sms.js");
  if (isDev) {
    delete require.cache[handlerPath];
  }
  return require(handlerPath);
}

app.post("/api/send-sms", async (req, res) => {
  try {
    const sendSmsHandler = loadSendSmsHandler();
    await sendSmsHandler(req, res);
  } catch (e) {
    console.error("Local Server Error:", e);
    res.status(500).json({ error: "Server logic error" });
  }
});


// ==========================================
// COURTS API
// ==========================================
app.get('/api/courts', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, description,
        price_per_hour AS "pricePerHour",
        amenities, is_active AS "isActive",
        active_start_time AS "activeStartTime",
        active_end_time AS "activeEndTime",
        base_status, override_status, override_expires_at,
        qr_code_image AS "qrCodeImage"
      FROM courts ORDER BY name ASC`);
    res.json(result.rows);
  } catch (err) {
    console.error('Courts error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

app.patch('/api/courts/:id', async (req, res) => {
  try {
    const fields = req.body;
    const keys = Object.keys(fields);
    if (!keys.length) return res.status(400).json({ error: 'No fields provided' });
    const set = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const vals = keys.map(k => fields[k]);
    const result = await pool.query(
      `UPDATE courts SET ${set} WHERE id = $${keys.length + 1} RETURNING *`,
      [...vals, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Court update error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

app.post('/api/courts', async (req, res) => {
  try {
    const {
      name, description, price_per_hour, amenities,
      is_active, active_start_time, active_end_time
    } = req.body;
    const result = await pool.query(
      `INSERT INTO courts (name, description, price_per_hour, amenities, is_active, active_start_time, active_end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, description, price_per_hour, amenities, is_active, active_start_time, active_end_time]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Court create error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

app.delete('/api/courts/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM courts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Court delete error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// ==========================================
// ACTIVITY LOGS API
// ==========================================
app.post('/api/activity-logs', async (req, res) => {
  try {
    const { title, description } = req.body;
    const result = await pool.query(
      'INSERT INTO activity_logs (title, description) VALUES ($1, $2) RETURNING *',
      [title, description]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Activity log error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// ==========================================
// BOOKINGS API
// ==========================================
app.get('/api/bookings', async (req, res) => {
  try {
    let where = '';
    const vals = [];
    if (req.query.status) {
      vals.push(req.query.status);
      where = `WHERE status = $1`;
    }
    if (req.query.date) {
      vals.push(req.query.date);
      where = where ? `${where} AND booking_date = $${vals.length}` : `WHERE booking_date = $1`;
    }
    if (req.query.courtId) {
      vals.push(req.query.courtId);
      where = where ? `${where} AND court_id = $${vals.length}` : `WHERE court_id = $1`;
    }
    const result = await pool.query(
      `SELECT 
        id, player_name AS "playerName", contact_number AS "contactNumber", email,
        court_id AS "courtId", court_name AS "courtName",
        booking_date AS "date", time_slot AS "timeSlot",
        start_time AS "startTime", end_time AS "endTime", duration, players,
        total_amount AS "totalAmount", amount_paid AS "amountPaid",
        remaining_balance AS "remainingBalance", payment_method AS "paymentMethod",
        payment_plan AS "paymentPlan", customer_payment_status AS "customerPaymentStatus",
        status, notes, user_id AS "userId",
        created_at AS "createdAt", updated_at AS "updatedAt"
       FROM bookings ${where} ORDER BY created_at DESC`,
      vals
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Bookings error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const { randomUUID } = require('crypto');
    const b = req.body;
    const id = b.id || randomUUID();
    const result = await pool.query(
      `INSERT INTO bookings (id, player_name, contact_number, email, court_id, court_name,
        booking_date, time_slot, start_time, end_time, duration, players,
        total_amount, amount_paid, remaining_balance, payment_method, payment_plan,
        customer_payment_status, status, notes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW())
       RETURNING *`,
      [id, b.player_name||b.playerName, b.contact_number||b.contactNumber, b.email,
       b.court_id||b.courtId, b.court_name||b.courtName,
       b.booking_date||b.date, b.time_slot||b.timeSlot,
       b.start_time||b.startTime, b.end_time||b.endTime,
       b.duration, b.players,
       b.total_amount||b.totalAmount, b.amount_paid||b.amountPaid,
       b.remaining_balance||b.remainingBalance,
       b.payment_method||b.paymentMethod, b.payment_plan||b.paymentPlan,
       b.customer_payment_status||b.customerPaymentStatus,
       b.status||'Pending', b.notes]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Create booking error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

app.patch('/api/bookings/:id', async (req, res) => {
  try {
    const fields = req.body;
    const keys = Object.keys(fields);
    if (!keys.length) return res.status(400).json({ error: 'No fields provided' });
    const snakeKeys = keys.map(k => k.replace(/([A-Z])/g, '_$1').toLowerCase());
    const set = snakeKeys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const vals = keys.map(k => fields[k]);
    await pool.query(
      `UPDATE bookings SET ${set}, updated_at = NOW() WHERE id = $${keys.length + 1}`,
      [...vals, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update booking error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

app.delete('/api/bookings/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM bookings WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete booking error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// ==========================================
// ANNOUNCEMENTS API
// ==========================================
app.get('/api/announcements', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM announcements ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Announcements error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

app.post('/api/announcements', async (req, res) => {
  try {
    const { randomUUID } = require('crypto');
    const { title, message, type, is_active, created_by } = req.body;
    const result = await pool.query(
      `INSERT INTO announcements (id, title, message, type, is_active, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [randomUUID(), title, message, type || 'info', is_active !== false, created_by || 'Admin']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Create announcement error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

app.patch('/api/announcements/:id', async (req, res) => {
  try {
    const { title, message, type, is_active } = req.body;
    const result = await pool.query(
      `UPDATE announcements SET title=$1, message=$2, type=$3, is_active=$4 WHERE id=$5 RETURNING *`,
      [title, message, type, is_active, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update announcement error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

app.delete('/api/announcements/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM announcements WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete announcement error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// ==========================================
// CUSTOMERS / CRM API
// ==========================================
app.get('/api/customers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers ORDER BY updated_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Customers error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// ==========================================
// INVENTORY / EQUIPMENT API
// ==========================================
app.get('/api/equipment', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory_items ORDER BY name ASC');
    const mapped = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      type: r.type,
      totalQty: r.total_qty,
      availableQty: r.available_qty,
      price: r.price,
      pricePerHour: r.price_per_hour,
      overdueFinePerHour: r.overdue_fine_per_hour,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
    res.json(mapped);
  } catch (err) {
    console.error('Equipment error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

app.get('/api/equipment/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory_items WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = result.rows[0];
    const mapped = {
      id: r.id,
      name: r.name,
      category: r.category,
      type: r.type,
      totalQty: r.total_qty,
      availableQty: r.available_qty,
      price: r.price,
      pricePerHour: r.price_per_hour,
      overdueFinePerHour: r.overdue_fine_per_hour,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
    res.json(mapped);
  } catch (err) {
    console.error('Equipment fetch error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

app.post('/api/equipment', async (req, res) => {
  try {
    const { randomUUID } = require('crypto');
    const b = req.body;
    const result = await pool.query(
      `INSERT INTO inventory_items (id, name, category, type, total_qty, available_qty, price, price_per_hour, overdue_fine_per_hour, notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()) RETURNING *`,
      [randomUUID(), b.name, b.category, b.type, b.totalQty ?? b.total_qty ?? 0, b.availableQty ?? b.available_qty ?? 0,
       b.price ?? 0, b.pricePerHour ?? b.price_per_hour ?? 0, b.overdueFinePerHour ?? b.overdue_fine_per_hour ?? 0, b.notes || '']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Create equipment error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

app.patch('/api/equipment/:id', async (req, res) => {
  try {
    const b = req.body;
    await pool.query(
      `UPDATE inventory_items SET name=$1, category=$2, type=$3, total_qty=$4, available_qty=$5,
       price=$6, price_per_hour=$7, overdue_fine_per_hour=$8, notes=$9, updated_at=NOW()
       WHERE id=$10`,
      [b.name, b.category, b.type, b.totalQty ?? b.total_qty, b.availableQty ?? b.available_qty,
       b.price, b.pricePerHour ?? b.price_per_hour, b.overdueFinePerHour ?? b.overdue_fine_per_hour, b.notes, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update equipment error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

app.delete('/api/equipment/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM inventory_items WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete equipment error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

  // ==========================================
  // INVENTORY TRANSACTIONS API
  // ==========================================
  app.get('/api/borrow-records', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM borrow_records ORDER BY created_at DESC');
      const mapped = result.rows.map(r => ({
        id: r.id,
        borrowerName: r.borrower_name,
        items: r.items,
        status: r.status,
        borrowedAt: r.borrowed_at,
        expectedReturnAt: r.expected_return_at,
        actualReturnAt: r.actual_return_at,
        hoursInitial: r.hours_initial,
        estimatedRentalCharge: r.estimated_rental_charge,
        rentalCharge: r.rental_charge,
        overdueCharge: r.overdue_charge,
        lateHours: r.late_hours,
        totalCharge: r.total_charge,
        extensionHistory: r.extension_history,
        createdAt: r.created_at
      }));
      res.json(mapped);
    } catch (err) {
      console.error('Fetch borrow records error:', err.message);
      res.status(500).json({ error: 'Server Error' });
    }
  });

  app.get('/api/borrow-records/:id', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM borrow_records WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      const r = result.rows[0];
      const mapped = {
        id: r.id,
        borrowerName: r.borrower_name,
        items: r.items,
        status: r.status,
        borrowedAt: r.borrowed_at,
        expectedReturnAt: r.expected_return_at,
        actualReturnAt: r.actual_return_at,
        hoursInitial: r.hours_initial,
        estimatedRentalCharge: r.estimated_rental_charge,
        rentalCharge: r.rental_charge,
        overdueCharge: r.overdue_charge,
        lateHours: r.late_hours,
        totalCharge: r.total_charge,
        extensionHistory: r.extension_history,
        createdAt: r.created_at
      };
      res.json(mapped);
    } catch (err) {
      console.error('Fetch borrow record by ID error:', err.message);
      res.status(500).json({ error: 'Server Error' });
    }
  });

  app.post('/api/equipment/borrow', async (req, res) => {
    try {
      const { randomUUID } = require('crypto');
      const b = req.body;
      const id = randomUUID();
      
      await pool.query('BEGIN');
      
      // Insert borrow record
      await pool.query(
        `INSERT INTO borrow_records (id, borrower_name, items, total_charge, borrowed_at, expected_return_at, status, hours_initial, estimated_rental_charge, contact_number, court, created_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW() + interval '1 hour' * $6, $5, $6, $7, $8, $9, NOW())`,
        [id, b.customerName || b.borrowerName, JSON.stringify(b.items), b.totalAmount || 0, b.status || 'pending', b.hoursInitial || 1, b.estimatedRentalCharge || 0, b.contactNumber || null, b.court || null]
      );

      // Decrement stock for each item
      for (const item of b.items) {
        await pool.query(
          `UPDATE inventory_items SET available_qty = available_qty - $1, updated_at = NOW() WHERE id = $2`,
          [item.quantity, item.itemId]
        );
      }

      await pool.query('COMMIT');
      res.json({ id, success: true });
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error('Borrow error:', err.message);
      res.status(500).json({ error: 'Server Error' });
    }
  });

  app.post('/api/equipment/return', async (req, res) => {
    try {
      const b = req.body;
      await pool.query('BEGIN');

      // Update borrow record
      const record = await pool.query(
        `UPDATE borrow_records SET status = 'returned', actual_return_at = NOW(), total_charge = $2, overdue_charge = $3, late_hours = $4 WHERE id = $1 RETURNING *`,
        [b.id, b.totalCharge || 0, b.overdueCharge || 0, b.lateHours || 0]
      );

      if (record.rowCount > 0) {
        const items = record.rows[0].items;
        // Increment stock back
        for (const item of items) {
          await pool.query(
            `UPDATE inventory_items SET available_qty = available_qty + $1, updated_at = NOW() WHERE id = $2`,
            [item.quantity, item.itemId]
          );
        }
      }

      await pool.query('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error('Return error:', err.message);
      res.status(500).json({ error: 'Server Error' });
    }
  });

  app.post('/api/equipment/extend', async (req, res) => {
    try {
      const b = req.body;
      await pool.query(
        `UPDATE borrow_records SET estimated_rental_charge = $1, extension_history = $2, expected_return_at = to_timestamp($3 / 1000.0) WHERE id = $4`,
        [b.estimatedRentalCharge, JSON.stringify(b.extensionHistory), b.expectedReturnAt, b.id]
      );
      res.json({ success: true });
    } catch (err) {
      console.error('Extend borrow error:', err.message);
      res.status(500).json({ error: 'Server Error' });
    }
  });

  app.post('/api/equipment/sale', async (req, res) => {
    try {
      const { randomUUID } = require('crypto');
      const b = req.body;
      const id = randomUUID();
      
      await pool.query('BEGIN');

      await pool.query(
        `INSERT INTO sales_transactions (id, type, source, items, total, payment_method, cash_received, change_amount, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [id, 'equipment', 'pos', JSON.stringify(b.items), b.total, b.paymentMethod, b.cashReceived, b.changeAmount]
      );

      // Decrement stock permanently
      for (const item of b.items) {
        await pool.query(
          `UPDATE inventory_items SET available_qty = available_qty - $1, updated_at = NOW() WHERE id = $2`,
          [item.quantity, item.itemId]
        );
      }

      await pool.query('COMMIT');
      res.json({ id, success: true });
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error('Sale error:', err.message);
      res.status(500).json({ error: 'Server Error' });
    }
  });

// ==========================================
// SALES TRANSACTIONS API
// ==========================================
app.get('/api/sales-transactions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sales_transactions ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch sales transactions error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// ==========================================
// ACTIVITY LOGS API
// ==========================================
app.get('/api/activity-logs', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) {
    console.error('Activity logs error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// ==========================================
// DASHBOARD STATS API
// ==========================================
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [bookingsToday, salesToday, activeToday, pendingPayments] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM bookings WHERE DATE(created_at) = $1`, [today]),
      pool.query(`SELECT COALESCE(SUM(amount_paid),0) as total FROM bookings WHERE DATE(created_at) = $1`, [today]),
      pool.query(`SELECT COUNT(*) FROM bookings WHERE booking_date = $1 AND status = 'Approved'`, [today]),
      pool.query(`SELECT COUNT(*) FROM bookings WHERE customer_payment_status = 'Pending'`),
    ]);
    res.json({
      bookingsToday: parseInt(bookingsToday.rows[0].count),
      salesToday: parseFloat(salesToday.rows[0].total),
      activeBookings: parseInt(activeToday.rows[0].count),
      pendingPayments: parseInt(pendingPayments.rows[0].count),
    });
  } catch (err) {
    console.error('Dashboard stats error:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});


// ==========================================
// EXTENDED API ROUTES (PostgreSQL migration)
// ==========================================
const { registerRoutes } = require("./server/routes");
registerRoutes(app);

// ==========================================
// SERVER STARTUP
// ==========================================

// Background job for equipment return SMS reminders (every 1 minute)
setInterval(async () => {
  try {
    const res = await pool.query(`
      SELECT id, borrower_name, contact_number, expected_return_at, items 
      FROM borrow_records 
      WHERE status = 'active' 
      AND reminder_sent = FALSE 
      AND contact_number IS NOT NULL
      AND expected_return_at IS NOT NULL
      AND expected_return_at <= NOW() + INTERVAL '15 minutes'
    `);
    
    if (res.rows.length > 0) {
      const sendSms = loadSendSmsHandler();
      for (const record of res.rows) {
        if (record.contact_number && record.contact_number.trim().length >= 10) {
          const fakeReq = { 
            method: 'POST', 
            body: { 
              phoneNumber: record.contact_number, 
              message: `Hi ${record.borrower_name}, your equipment rental is due in 15 minutes. Please return it to avoid extra charges!` 
            } 
          };
          let smsSuccess = true;
          let smsData = null;
          const fakeRes = { 
            status: (code) => { 
              if (code !== 200) smsSuccess = false; 
              return fakeRes; 
            },
            json: (data) => { 
              if (data && data.success === false) smsSuccess = false; 
              smsData = data;
              return fakeRes; 
            }
          };
          
          try {
            await sendSms(fakeReq, fakeRes);
            if (smsSuccess) {
              console.log(`[SMS Reminder] Sent to ${record.contact_number} for record ${record.id}`);
            } else {
              console.error(`[SMS Reminder] Failed to send for record ${record.id}:`, smsData);
            }
            await pool.query(
              `INSERT INTO sms_logs (booking_id, phone_number, phone_raw, message, status, api_response)
               VALUES ($1,$2,$3,$4,$5,$6)`,
              [
                record.id, 
                record.contact_number, 
                record.contact_number, 
                fakeReq.body.message, 
                smsSuccess ? 'success' : 'failed',
                smsData ? JSON.stringify(smsData) : null
              ]
            );
          } catch (e) {
            console.error(`[SMS Reminder] Failed to send for record ${record.id}:`, e);
            await pool.query(
              `INSERT INTO sms_logs (booking_id, phone_number, phone_raw, message, status) VALUES ($1,$2,$3,$4,$5)`,
              [record.id, record.contact_number, record.contact_number, fakeReq.body.message, 'failed']
            );
          }
        }
        await pool.query('UPDATE borrow_records SET reminder_sent = TRUE WHERE id = $1', [record.id]);
      }
    }
  } catch (err) {
    console.error('[SMS Reminder Job] Error:', err.message);
  }
}, 60 * 1000);




// ---------------------------------------------------------------------------
// Node-RED Proxy Routes
// All hardware control calls go through here so the browser never makes a
// cross-origin request directly to Node-RED (avoids CORS errors).
// ---------------------------------------------------------------------------
const NODE_RED_ORIGIN = process.env.REACT_APP_NODE_RED_URL || 'http://127.0.0.1:1880';

/** Ping – lets the UI check whether Node-RED is reachable. */
app.get('/api/nodered/ping', async (req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    await fetch(`${NODE_RED_ORIGIN}/`, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);
    res.json({ connected: true });
  } catch (_) {
    res.json({ connected: false });
  }
});

const axios = require('axios');
const https = require('https');
const ipv4Agent = new https.Agent({ family: 4 });

/** Forward POST /api/lights/cloud → TIS Cloud API */
app.post('/api/lights/cloud', async (req, res) => {
  try {
    const upstream = await axios.post('https://tissmarthomeapi.web.app/api/v1/devices/action', req.body, {
      headers: {
        'apikey': req.headers['apikey'] || '',
        'Content-Type': 'application/json'
      },
      timeout: 8000,
      httpsAgent: ipv4Agent
    });
    res.json(upstream.data);
  } catch (err) {
    console.error('TIS Cloud API (/devices/action) error:', err.message);
    res.status(err.response ? err.response.status : 500).json({ error: 'Failed to reach TIS cloud api', details: err.message });
  }
});

/** Forward POST /api/lights/devices → TIS Cloud API */
app.post('/api/lights/devices', async (req, res) => {
  try {
    const upstream = await axios.post('https://tissmarthomeapi.web.app/api/v1/get_devices/all', req.body || {}, {
      headers: {
        'apikey': req.headers['apikey'] || '',
        'Content-Type': 'application/json'
      },
      timeout: 8000,
      httpsAgent: ipv4Agent
    });
    res.json(upstream.data);
  } catch (err) {
    console.error('TIS Cloud API (/get_devices/all) error:', err.message);
    res.status(err.response ? err.response.status : 500).json({ error: 'Failed to reach TIS cloud api', details: err.message });
  }
});

// ---------------------------------------------------------------------------

ensureDatabaseSchema().catch(console.error);

const PORT = process.env.PORT || 3002;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);

  if (isDev) {
    console.log("SMS API reloads on each request (development mode).");
  }

  const mask = process.env.M360_SHORTCODE_MASK || process.env.M360_SENDER_ID || "";
  if (!String(mask).trim()) {
    console.warn(
      "WARNING: M360_SHORTCODE_MASK is not set — SMS will fail until you add your m360 sender ID to .env"
    );
  }
});
