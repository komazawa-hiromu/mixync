const express = require('express');
const { db } = require('../lib/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply JWT authentication to all routes
router.use(authenticateToken);

// Helper function to normalize values to 0-1 range
function normalize(value, min, max) {
  if (value <= min) return 0;
  if (value >= max) return 1;
  return (value - min) / (max - min);
}

// Helper function to calculate comfort score
function calculateComfortScore(slope, stddev, moodRating) {
  // Normalize metrics (0-1, lower is better for slope and stddev)
  const normalizedSlope = normalize(slope || 0, 0, 0.2); // 0-0.2 bpm/sec
  const normalizedStddev = normalize(stddev || 0, 0, 15); // 0-15 bpm

  // Normalize mood rating (1-5 -> 0-1, higher is better)
  const normalizedMood = moodRating ? (moodRating - 1) / 4 : 0.5; // Default to 0.5 if not provided

  // Calculate weighted score (0-100, higher is better)
  const score = (
    (1 - normalizedSlope) * 0.4 +  // Lower slope is better (40%)
    (1 - normalizedStddev) * 0.3 + // Lower stddev is better (30%)
    normalizedMood * 0.3            // Higher mood is better (30%)
  ) * 100;

  return Math.round(score * 10) / 10; // Round to 1 decimal place
}

// POST /api/evaluations - Submit evaluation and calculate comfort score
router.post('/', (req, res) => {
  const { event_id, mood_rating, sound_rating } = req.body;
  const userId = req.user.id;

  if (!event_id || mood_rating === undefined) {
    return res.status(400).json({ message: 'Event ID and mood_rating are required.' });
  }

  // Validate mood_rating range
  if (mood_rating < 1 || mood_rating > 5) {
    return res.status(400).json({ message: 'mood_rating must be between 1 and 5.' });
  }

  console.log('[EVALUATION] Submitting for event:', event_id, 'mood:', mood_rating);

  try {
    // Get current event data to calculate comfort score
    const getStmt = db.prepare(`
      SELECT awakening_hr_slope, awakening_hr_stddev 
      FROM alarm_events 
      WHERE id = ? AND user_id = ?
    `);
    const event = getStmt.get(event_id, userId);

    if (!event) {
      return res.status(404).json({ message: 'Alarm event not found or user not authorized.' });
    }

    // Calculate comfort score
    const comfortScore = calculateComfortScore(
      event.awakening_hr_slope,
      event.awakening_hr_stddev,
      mood_rating
    );

    // Update event with ratings and comfort score
    const updateStmt = db.prepare(`
      UPDATE alarm_events 
      SET mood_rating = ?, 
          sound_rating = ?, 
          comfort_score = ? 
      WHERE id = ? AND user_id = ?
    `);

    const info = updateStmt.run(
      mood_rating,
      sound_rating || null,
      comfortScore,
      event_id,
      userId
    );

    if (info.changes === 0) {
      return res.status(404).json({ message: 'Failed to update alarm event.' });
    }

    console.log('[EVALUATION] Saved:', {
      event_id,
      mood_rating,
      comfort_score: comfortScore
    });

    res.status(200).json({
      message: 'Evaluation saved successfully.',
      comfort_score: comfortScore
    });
  } catch (error) {
    console.error('[EVALUATION] Error:', error);
    res.status(500).json({ message: 'Failed to save evaluation.', error: error.message });
  }
});

module.exports = router;