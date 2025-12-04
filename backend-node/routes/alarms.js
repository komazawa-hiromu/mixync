const express = require('express');
const { db } = require('../lib/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply JWT authentication to all routes in this router
router.use(authenticateToken);

router.get('/', (req, res) => {
  try {
    const userId = req.user.id;
    const stmt = db.prepare('SELECT * FROM alarms WHERE user_id = ?');
    const rows = stmt.all(userId);
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch alarms.', error: error.message });
  }
});

router.post('/', (req, res) => {
  try {
    const userId = req.user.id;
    const { datetime, sound_file, mixing_pattern, is_active } = req.body;

    if (!datetime || !sound_file) {
      return res.status(400).json({ message: 'Datetime and sound_file are required.' });
    }

    // Parse datetime and extract time and day of week
    const alarmDate = new Date(datetime);
    const time = alarmDate.toTimeString().slice(0, 5); // HH:MM format
    const dayOfWeek = alarmDate.getDay().toString(); // 0-6 (Sunday-Saturday)
    const pattern = mixing_pattern || 'A'; // Default to A if not provided

    console.log('[ALARM] Creating alarm:', { datetime, time, dayOfWeek, sound_file, mixing_pattern: pattern });

    const stmt = db.prepare('INSERT INTO alarms (user_id, time, days_of_week, sound_file, mixing_pattern, is_active) VALUES (?, ?, ?, ?, ?, ?)');
    const info = stmt.run(userId, time, dayOfWeek, sound_file, pattern, is_active === undefined ? 1 : is_active);

    res.status(201).json({ message: 'Alarm created successfully.', alarmId: info.lastInsertRowid });
  } catch (error) {
    console.error('[ALARM] Error creating alarm:', error);
    res.status(500).json({ message: 'Failed to create alarm.', error: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const alarmId = req.params.id;
    const { datetime, time, days_of_week, sound_file, mixing_pattern, is_active } = req.body;

    const updates = [];
    const params = [];

    // If datetime is provided, parse it to get time and day_of_week
    if (datetime !== undefined) {
      const alarmDate = new Date(datetime);
      const parsedTime = alarmDate.toTimeString().slice(0, 5);
      const parsedDayOfWeek = alarmDate.getDay().toString();

      updates.push('time = ?');
      params.push(parsedTime);
      updates.push('days_of_week = ?');
      params.push(parsedDayOfWeek);

      console.log('[ALARM] Updating alarm with datetime:', { datetime, parsedTime, parsedDayOfWeek });
    } else {
      // Fallback to individual fields for backward compatibility
      if (time !== undefined) { updates.push('time = ?'); params.push(time); }
      if (days_of_week !== undefined) { updates.push('days_of_week = ?'); params.push(days_of_week); }
    }

    if (sound_file !== undefined) { updates.push('sound_file = ?'); params.push(sound_file); }
    if (mixing_pattern !== undefined) { updates.push('mixing_pattern = ?'); params.push(mixing_pattern); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active); }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update.' });
    }

    params.push(alarmId, userId);
    const sql = `UPDATE alarms SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`;
    const stmt = db.prepare(sql);
    const info = stmt.run(...params);

    if (info.changes === 0) {
      return res.status(404).json({ message: 'Alarm not found or not authorized to update it.' });
    }

    res.status(200).json({ message: 'Alarm updated successfully.' });
  } catch (error) {
    console.error('[ALARM] Error updating alarm:', error);
    res.status(500).json({ message: 'Failed to update alarm.', error: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const alarmId = req.params.id;

    const stmt = db.prepare('DELETE FROM alarms WHERE id = ? AND user_id = ?');
    const info = stmt.run(alarmId, userId);

    if (info.changes === 0) {
      return res.status(404).json({ message: 'Alarm not found or not authorized.' });
    }

    res.status(200).json({ message: 'Alarm deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete alarm.', error: error.message });
  }
});

module.exports = router;
