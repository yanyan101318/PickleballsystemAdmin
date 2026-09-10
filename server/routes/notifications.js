const express = require('express');
const router = express.Router();
const pool = require('../../config/db');

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const { unreadOnly } = req.query;

    let queryStr = 'SELECT * FROM notifications ';
    const params = [];

    if (unreadOnly === 'true') {
      queryStr += 'WHERE is_read = false ';
    }
    
    queryStr += 'ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await pool.query(queryStr, params);

    const formatted = result.rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      data: row.data,
      isRead: row.is_read,
      is_read: row.is_read,
      createdAt: row.created_at,
      created_at: row.created_at,
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching admin notifications:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*)::int AS count FROM notifications WHERE is_read = false");
    res.json({ unreadCount: result.rows[0]?.count || 0 });
  } catch (err) {
    console.error('Error fetching unread count:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// PATCH /api/notifications/mark-read
router.patch('/mark-read', async (req, res) => {
  try {
    const { id } = req.body || {};
    if (id) {
      await pool.query("UPDATE notifications SET is_read = true WHERE id = $1", [id]);
    } else {
      await pool.query("UPDATE notifications SET is_read = true WHERE is_read = false");
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking admin notifications read:', err.message);
    res.status(500).json({ error: 'Server Error' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE notifications SET is_read = true WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking notification read:", error.message);
    res.status(500).json({ error: "Failed to mark notification read" });
  }
});

module.exports = router;
