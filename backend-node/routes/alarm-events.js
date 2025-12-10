const express = require('express');
const { db } = require('../lib/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply JWT authentication to all routes
router.use(authenticateToken);

// GET /api/alarm-events - Get all alarm events for the user
router.get('/', (req, res) => {
    try {
        const userId = req.user.id;
        const stmt = db.prepare(`
      SELECT * FROM alarm_events 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `);
        const events = stmt.all(userId);

        res.status(200).json(events);
    } catch (error) {
        console.error('[ALARM-EVENTS] Error fetching events:', error);
        res.status(500).json({ message: 'Failed to fetch alarm events.', error: error.message });
    }
});

// GET /api/alarm-events/:id - Get a specific alarm event
router.get('/:id', (req, res) => {
    try {
        const userId = req.user.id;
        const eventId = req.params.id;

        const stmt = db.prepare(`
      SELECT * FROM alarm_events 
      WHERE id = ? AND user_id = ?
    `);
        const event = stmt.get(eventId, userId);

        if (!event) {
            return res.status(404).json({ message: 'Alarm event not found.' });
        }

        res.status(200).json(event);
    } catch (error) {
        console.error('[ALARM-EVENTS] Error fetching event:', error);
        res.status(500).json({ message: 'Failed to fetch alarm event.', error: error.message });
    }
});

// POST /api/alarm-events - Create a new alarm event
router.post('/', (req, res) => {
    try {
        const userId = req.user.id;
        const { alarm_id, alarm_time, mixing_pattern } = req.body;

        if (!alarm_id || !alarm_time || !mixing_pattern) {
            return res.status(400).json({
                message: 'alarm_id, alarm_time, and mixing_pattern are required.'
            });
        }

        // Validate mixing_pattern (Basic check for string)
        if (typeof mixing_pattern !== 'string' || mixing_pattern.length === 0) {
            return res.status(400).json({
                message: 'mixing_pattern must be a valid string.'
            });
        }
        // Strict allow-list removed to support fusion patterns (e.g., "A+B")

        const stmt = db.prepare(`
      INSERT INTO alarm_events (
        user_id, 
        alarm_id, 
        alarm_time, 
        mixing_pattern,
        rang_at_jp
      ) VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
    `);

        const info = stmt.run(userId, alarm_id, alarm_time, mixing_pattern);

        console.log('[ALARM-EVENTS] Created event:', {
            id: info.lastInsertRowid,
            alarm_id,
            mixing_pattern
        });

        res.status(201).json({
            message: 'Alarm event created successfully.',
            event_id: info.lastInsertRowid
        });
    } catch (error) {
        console.error('[ALARM-EVENTS] Error creating event:', error);
        res.status(500).json({ message: 'Failed to create alarm event.', error: error.message });
    }
});

// PUT /api/alarm-events/:id - Update an alarm event
router.put('/:id', (req, res) => {
    try {
        const userId = req.user.id;
        const eventId = req.params.id;
        const updates = req.body;

        // Build dynamic UPDATE query
        const allowedFields = [
            'hr_pattern_before', 'hr_avg_before', 'hr_std_before',
            'hr_pattern_after', 'hr_peak', 'awakening_hr_slope', 'awakening_hr_stddev',
            'hr_recovery_time', 'hrv_avg', 'hrv_hf', 'hrv_lf_hf_ratio',
            'sleep_stage_before', 'mood_rating', 'sound_rating', 'comfort_score'
        ];

        const updateFields = [];
        const params = [];

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                updateFields.push(`${key} = ?`);
                params.push(value);
            }
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ message: 'No valid fields to update.' });
        }

        params.push(eventId, userId);
        const sql = `
      UPDATE alarm_events 
      SET ${updateFields.join(', ')} 
      WHERE id = ? AND user_id = ?
    `;

        const stmt = db.prepare(sql);
        const info = stmt.run(...params);

        if (info.changes === 0) {
            return res.status(404).json({ message: 'Alarm event not found or not authorized.' });
        }

        console.log('[ALARM-EVENTS] Updated event:', eventId, 'Fields:', Object.keys(updates));

        res.status(200).json({ message: 'Alarm event updated successfully.' });
    } catch (error) {
        console.error('[ALARM-EVENTS] Error updating event:', error);
        res.status(500).json({ message: 'Failed to update alarm event.', error: error.message });
    }
});

// DELETE /api/alarm-events/:id - Delete an alarm event
router.delete('/:id', (req, res) => {
    try {
        const userId = req.user.id;
        const eventId = req.params.id;

        const stmt = db.prepare(`
      DELETE FROM alarm_events 
      WHERE id = ? AND user_id = ?
    `);
        const info = stmt.run(eventId, userId);

        if (info.changes === 0) {
            return res.status(404).json({ message: 'Alarm event not found or not authorized.' });
        }

        console.log('[ALARM-EVENTS] Deleted event:', eventId);

        res.status(200).json({ message: 'Alarm event deleted successfully.' });
    } catch (error) {
        console.error('[ALARM-EVENTS] Error deleting event:', error);
        res.status(500).json({ message: 'Failed to delete alarm event.', error: error.message });
    }
});

module.exports = router;
