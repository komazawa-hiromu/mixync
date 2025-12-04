const express = require('express');
const { db } = require('../lib/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply JWT authentication to all routes
router.use(authenticateToken);

// GET /api/events - Fetches all alarm events for the logged-in user
router.get('/', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT 
        id, 
        alarm_id,
        alarm_time, 
        mixing_pattern,
        rang_at_jp, 
        hr_pattern_before,
        hr_avg_before,
        hr_std_before,
        hr_pattern_after,
        hr_peak,
        awakening_hr_slope, 
        awakening_hr_stddev,
        hr_recovery_time,
        hrv_avg,
        hrv_hf,
        hrv_lf_hf_ratio,
        sleep_stage_before,
        mood_rating,
        sound_rating,
        comfort_score,
        created_at
      FROM alarm_events 
      WHERE user_id = ? 
      ORDER BY alarm_time DESC
    `);
    const rows = stmt.all(req.user.id);
    res.status(200).json(rows);
  } catch (error) {
    console.error('[EVENTS] Error fetching events:', error);
    res.status(500).json({ message: 'Error fetching alarm events.', error: error.message });
  }
});

// DELETE /api/events/:id - Deletes a specific alarm event
router.delete('/:id', (req, res) => {
  try {
    const { id: eventId } = req.params;
    const stmt = db.prepare('DELETE FROM alarm_events WHERE id = ? AND user_id = ?');
    const info = stmt.run(eventId, req.user.id);

    if (info.changes === 0) {
      return res.status(404).json({ message: 'Event not found or user not authorized.' });
    }

    res.status(200).json({ message: 'Event deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting event.', error: error.message });
  }
});

// POST /api/events/save-awakening-index - Saves calculated index to one or more events
router.post('/save-awakening-index', (req, res) => {
  const { event_ids, slope, stddev } = req.body;

  if (!Array.isArray(event_ids) || event_ids.length === 0 || slope === undefined || stddev === undefined) {
    return res.status(400).json({ message: 'event_ids array, slope, and stddev are required.' });
  }

  try {
    const updateStmt = db.prepare('UPDATE alarm_events SET awakening_hr_slope = ?, awakening_hr_stddev = ? WHERE id = ? AND user_id = ?');

    // Use transaction for multiple updates
    const updateMany = db.transaction((eventIds) => {
      for (const eventId of eventIds) {
        updateStmt.run(slope, stddev, eventId, req.user.id);
      }
    });

    updateMany(event_ids);

    res.status(200).json({ message: `Successfully updated ${event_ids.length} event(s).` });
  } catch (error) {
    res.status(500).json({ message: 'Error saving awakening index.', error: error.message });
  }
});

module.exports = router;