const express = require('express');
const { db } = require('../lib/database');
const { authenticateToken } = require('../middleware/auth');
const axios = require('axios');

const router = express.Router();

// Apply JWT authentication to all routes
router.use(authenticateToken);

// Helper function to get Fitbit tokens
function getFitbitTokens(userId) {
    const stmt = db.prepare('SELECT fitbit_access_token, fitbit_refresh_token FROM users WHERE id = ?');
    const user = stmt.get(userId);
    return user;
}

// Helper function to fetch heart rate data from Fitbit
async function fetchHeartRateDataRange(userId, startTime, endTime) {
    const user = getFitbitTokens(userId);

    if (!user || !user.fitbit_access_token) {
        throw new Error('Fitbit not connected');
    }

    // Format dates for Fitbit API
    const dateStr = startTime.toISOString().split('T')[0];
    const startTimeStr = startTime.toTimeString().slice(0, 8);
    const endTimeStr = endTime.toTimeString().slice(0, 8);

    console.log('[ALARM-PROCESS] Fetching HR data:', { dateStr, startTimeStr, endTimeStr });

    try {
        const response = await axios.get(
            `https://api.fitbit.com/1/user/-/activities/heart/date/${dateStr}/1d/1sec/time/${startTimeStr}/${endTimeStr}.json`,
            {
                headers: {
                    'Authorization': `Bearer ${user.fitbit_access_token}`
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error('[ALARM-PROCESS] Fitbit API error:', error.response?.data || error.message);
        throw new Error('Failed to fetch heart rate data from Fitbit');
    }
}

// Helper function to calculate statistics
function calculateStats(data) {
    if (!data || data.length === 0) {
        return { avg: 0, std: 0 };
    }

    const sum = data.reduce((a, b) => a + b, 0);
    const avg = sum / data.length;

    const squaredDiffs = data.map(value => Math.pow(value - avg, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / data.length;
    const std = Math.sqrt(variance);

    return { avg, std };
}

// Helper function to interpolate irregular HR data to regular intervals
function interpolateHeartRateData(intradayData, targetIntervalSeconds = 5) {
    /**
     * Fitbit returns HR data at irregular intervals (1s, 5s, 10s, 15s).
     * This function interpolates to regular intervals.
     * 
     * Example input:
     * [
     *   { time: "06:25:00", value: 60 },
     *   { time: "06:25:05", value: 62 },  // 5s gap
     *   { time: "06:25:15", value: 65 },  // 10s gap
     *   { time: "06:25:30", value: 68 }   // 15s gap
     * ]
     * 
     * Output (5s intervals):
     * [60, 62, 63.5, 65, 66.5, 68]
     */

    if (!intradayData || intradayData.length === 0) {
        return [];
    }

    // Convert time strings to seconds since start
    const parseTime = (timeStr) => {
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        return hours * 3600 + minutes * 60 + seconds;
    };

    const startTime = parseTime(intradayData[0].time);
    const endTime = parseTime(intradayData[intradayData.length - 1].time);

    // Create time-value pairs
    const dataPoints = intradayData.map(d => ({
        time: parseTime(d.time) - startTime,  // Relative time in seconds
        value: d.value
    }));

    // Generate regular intervals
    const interpolated = [];
    const totalDuration = endTime - startTime;

    for (let t = 0; t <= totalDuration; t += targetIntervalSeconds) {
        // Find surrounding data points
        let before = null;
        let after = null;

        for (let i = 0; i < dataPoints.length; i++) {
            if (dataPoints[i].time <= t) {
                before = dataPoints[i];
            }
            if (dataPoints[i].time >= t && !after) {
                after = dataPoints[i];
                break;
            }
        }

        // Interpolate value
        let value;
        if (before && after && before.time !== after.time) {
            // Linear interpolation
            const ratio = (t - before.time) / (after.time - before.time);
            value = before.value + ratio * (after.value - before.value);
        } else if (before) {
            value = before.value;
        } else if (after) {
            value = after.value;
        } else {
            continue;
        }

        interpolated.push(Math.round(value));
    }

    console.log(`[INTERPOLATE] Original: ${intradayData.length} points, Interpolated: ${interpolated.length} points (${targetIntervalSeconds}s intervals)`);

    return interpolated;
}

// POST /api/alarm/pre-process - Process alarm 5 minutes before
router.post('/pre-process', async (req, res) => {
    try {
        const userId = req.user.id;
        const { alarm_id } = req.body;

        if (!alarm_id) {
            return res.status(400).json({
                message: 'alarm_id is required.'
            });
        }

        console.log('[PRE-PROCESS] Starting for alarm:', alarm_id);

        // Get alarm details
        const alarmStmt = db.prepare('SELECT * FROM alarms WHERE id = ? AND user_id = ?');
        const alarm = alarmStmt.get(alarm_id, userId);

        if (!alarm) {
            return res.status(404).json({ message: 'Alarm not found.' });
        }

        // Calculate alarm time (now + 5 minutes)
        const alarmTime = new Date(Date.now() + 5 * 60 * 1000);

        // Create alarm event NOW (5 minutes before alarm rings)
        const eventStmt = db.prepare(`
            INSERT INTO alarm_events (
                user_id, alarm_id, alarm_time, mixing_pattern, rang_at_jp
            ) VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
        `);
        const eventInfo = eventStmt.run(userId, alarm_id, alarmTime.toISOString(), 'AUTO');
        const eventId = eventInfo.lastInsertRowid;

        console.log(`[PRE-PROCESS] Created event ${eventId} for alarm ${alarm_id}`);

        // Calculate time range for HR data: 30 minutes before alarm to 15 minutes before alarm
        const endTime = new Date(alarmTime.getTime() - 15 * 60 * 1000); // 15 min before alarm
        const startTime = new Date(alarmTime.getTime() - 30 * 60 * 1000); // 30 min before alarm

        console.log('[PRE-PROCESS] Fetching HR data from', startTime.toISOString(), 'to', endTime.toISOString());

        let recommendedMixing = 'A';
        let confidence = 0;
        let hrValues = [];
        let stats = { avg: 0, std: 0 };

        try {
            // Fetch heart rate data from Fitbit
            const hrData = await fetchHeartRateDataRange(userId, startTime, endTime);

            // Extract intraday data
            const intradayData = hrData['activities-heart-intraday']?.dataset || [];

            if (intradayData.length > 0) {
                // Interpolate irregular data to regular 5-second intervals
                hrValues = interpolateHeartRateData(intradayData, 5);

                if (hrValues.length > 0) {
                    // Calculate statistics
                    stats = calculateStats(hrValues);

                    console.log('[PRE-PROCESS] HR data collected:', {
                        data_points: hrValues.length,
                        avg: stats.avg.toFixed(2),
                        std: stats.std.toFixed(2)
                    });

                    // Store HR data in database
                    const updateHrStmt = db.prepare(`
                        UPDATE alarm_events 
                        SET hr_pattern_before = ?, 
                            hr_avg_before = ?, 
                            hr_std_before = ?
                        WHERE id = ?
                    `);
                    updateHrStmt.run(
                        JSON.stringify(hrValues),
                        stats.avg,
                        stats.std,
                        eventId
                    );

                    console.log(`[PRE-PROCESS] Stored HR data in event ${eventId}`);

                    // Count successful past alarm events to determine phase
                    const countStmt = db.prepare(`
                        SELECT COUNT(*) as count 
                        FROM alarm_events 
                        WHERE user_id = ? 
                          AND status = 'COMPLETED'
                          AND id != ?
                    `);
                    // Note: Assuming there is a 'status' column or similar to indicate success.
                    // If 'status' doesn't exist, we can count events with valid comfort_score.
                    // Let's use comfort_score IS NOT NULL as a proxy for a "completed" event (one where user woke up and processing finished).
                    const validEventsStmt = db.prepare(`
                        SELECT COUNT(*) as count 
                        FROM alarm_events 
                        WHERE user_id = ? 
                          AND comfort_score IS NOT NULL
                          AND id != ?
                    `);

                    const countResult = validEventsStmt.get(userId, eventId);
                    const eventCount = countResult.count;

                    console.log(`[PRE-PROCESS] User has ${eventCount} completed alarm events.`);

                    // Progression Logic
                    if (eventCount < 35) {
                        // Fixed Pattern Phase (7 days each)
                        const phaseIndex = Math.floor(eventCount / 7);
                        // 0: A, 1: B, 2: C, 3: D, 4: E
                        const patterns = ['A', 'B', 'C', 'D', 'E'];

                        // Safety check in case eventCount is somehow >= 35 (though if check handles it)
                        // but strictly speaking index shouldn't go out of bounds if < 35.
                        // Max index = floor(34/7) = 4.

                        recommendedMixing = patterns[phaseIndex] || 'A';
                        confidence = 1.0; // Fixed rule, so high confidence

                        console.log(`[PRE-PROCESS] Progression Phase: Day ${eventCount + 1} (Phase ${phaseIndex}). Forcing Pattern: ${recommendedMixing}`);

                    } else {
                        // AI Recommendation Phase (DTW)
                        console.log(`[PRE-PROCESS] AI Phase: Day ${eventCount + 1} (35+ days). Using DTW Recommendation.`);

                        // Get past events for DTW comparison
                        const pastEventsStmt = db.prepare(`
                            SELECT 
                                id as event_id,
                                hr_pattern_before,
                                mixing_pattern,
                                comfort_score
                            FROM alarm_events
                            WHERE user_id = ? 
                                AND id != ?
                                AND hr_pattern_before IS NOT NULL 
                                AND comfort_score IS NOT NULL
                            ORDER BY alarm_time DESC
                        `);
                        const pastEvents = pastEventsStmt.all(userId, eventId);

                        if (pastEvents.length >= 3) {
                            console.log(`[PRE-PROCESS] Found ${pastEvents.length} past events for DTW comparison`);

                            try {
                                // Parse HR patterns
                                const parsedEvents = pastEvents.map(e => ({
                                    event_id: e.event_id,
                                    hr_pattern_before: JSON.parse(e.hr_pattern_before),
                                    mixing_pattern: e.mixing_pattern,
                                    comfort_score: e.comfort_score
                                }));

                                // Call Python backend for DTW recommendation
                                const dtwResponse = await axios.post('http://localhost:8000/recommend-mixing', {
                                    current_pattern: hrValues,
                                    past_events: parsedEvents
                                });

                                recommendedMixing = dtwResponse.data.recommended_mixing;
                                confidence = dtwResponse.data.confidence;

                                console.log('[PRE-PROCESS] DTW recommendation:', {
                                    mixing: recommendedMixing,
                                    confidence: confidence.toFixed(2)
                                });

                            } catch (dtwError) {
                                console.error('[PRE-PROCESS] DTW error:', dtwError.message);
                                console.log('[PRE-PROCESS] Falling back to default mixing A');
                            }
                        } else {
                            // Should not happen if count >= 35, but safety fallback
                            console.log(`[PRE-PROCESS] Not enough past data (${pastEvents.length} events) despite count, using default mixing A`);
                        }
                    }
                } else {
                    console.log('[PRE-PROCESS] Failed to interpolate HR data, using default mixing A');
                }
            } else {
                console.log('[PRE-PROCESS] No HR data available, using default mixing A');
            }
        } catch (fitbitError) {
            console.error('[PRE-PROCESS] Fitbit error:', fitbitError.message);
            console.log('[PRE-PROCESS] Using default mixing A');
        }

        // Update event with recommended mixing
        const updateMixingStmt = db.prepare('UPDATE alarm_events SET mixing_pattern = ? WHERE id = ?');
        updateMixingStmt.run(recommendedMixing, eventId);

        console.log(`[PRE-PROCESS] Updated event ${eventId} with mixing ${recommendedMixing}`);

        // Return recommendation
        res.status(200).json({
            success: true,
            event_id: eventId,
            recommended_mixing: recommendedMixing,
            confidence: confidence,
            hr_data: {
                pattern: hrValues,
                avg: stats.avg,
                std: stats.std,
                data_points: hrValues.length
            }
        });

    } catch (error) {
        console.error('[PRE-PROCESS] Error:', error);
        res.status(500).json({
            success: false,
            recommended_mixing: 'A',
            confidence: 0,
            message: 'Failed to process pre-alarm data.',
            error: error.message
        });
    }
});

// POST /api/alarm/post-process - Process after waking up
router.post('/post-process', async (req, res) => {
    try {
        const userId = req.user.id;
        const { event_id } = req.body;

        if (!event_id) {
            return res.status(400).json({
                message: 'event_id is required.'
            });
        }

        console.log('[POST-PROCESS] Starting for event:', event_id);

        // Get alarm time from event
        const eventStmt = db.prepare('SELECT alarm_time FROM alarm_events WHERE id = ? AND user_id = ?');
        const event = eventStmt.get(event_id, userId);

        if (!event) {
            return res.status(404).json({ message: 'Alarm event not found.' });
        }

        // Calculate time range: alarm time to 3 minutes after
        const alarmDate = new Date(event.alarm_time);
        const startTime = alarmDate;
        const endTime = new Date(alarmDate.getTime() + 3 * 60 * 1000); // 3 min after

        // Fetch heart rate data from Fitbit
        const hrData = await fetchHeartRateDataRange(userId, startTime, endTime);

        // Extract intraday data
        const intradayData = hrData['activities-heart-intraday']?.dataset || [];

        if (intradayData.length === 0) {
            return res.status(400).json({
                message: 'No heart rate data available for the specified time range.'
            });
        }

        // Interpolate irregular data to regular 1-second intervals
        const hrValues = interpolateHeartRateData(intradayData, 1);

        if (hrValues.length === 0) {
            return res.status(400).json({
                message: 'Failed to interpolate heart rate data.'
            });
        }

        // Calculate peak
        const hrPeak = Math.max(...hrValues);

        // Calculate average and intensity (peak - avg) / avg
        const avg = hrValues.reduce((a, b) => a + b, 0) / hrValues.length;
        const intensity = (hrPeak - avg) / avg;

        // Call Python backend to calculate slope and stddev
        let awakeningMetrics = { awakening_hr_slope: null, awakening_hr_stddev: null };

        try {
            const pythonResponse = await axios.post('http://localhost:8000/calculate-awakening-metrics', {
                hr_values: hrValues
            });

            awakeningMetrics = pythonResponse.data;
            console.log('[POST-PROCESS] Python metrics:', awakeningMetrics);
        } catch (pythonError) {
            console.error('[POST-PROCESS] Python backend error:', pythonError.message);
            // Continue without metrics - they can be calculated later
        }

        // Update database with all data, now including intensity
        const stmt = db.prepare(`
          UPDATE alarm_events 
          SET hr_pattern_after = ?, 
              hr_peak = ?,
              awakening_hr_slope = ?,
              awakening_hr_stddev = ?,
              intensity = ?
          WHERE id = ? AND user_id = ?
        `);

        stmt.run(
            JSON.stringify(hrValues),
            hrPeak,
            awakeningMetrics.awakening_hr_slope,
            awakeningMetrics.awakening_hr_stddev,
            intensity,
            event_id,
            userId
        );

        // Calculate comfort_score automatically
        let comfortScore = null;
        if (awakeningMetrics.awakening_hr_slope !== null && awakeningMetrics.awakening_hr_stddev !== null) {
            // Get current mood_rating if exists
            const moodStmt = db.prepare('SELECT mood_rating FROM alarm_events WHERE id = ?');
            const moodData = moodStmt.get(event_id);
            const moodRating = moodData?.mood_rating || 3; // Default to 3 (普通) if not yet rated

            // ---- Objective metrics ----
            // 1. Normalize slope (0‑1, lower better)
            const normalizeSlope = (slope) => {
                if (slope <= 0) return 0;
                if (slope >= 0.2) return 1;
                return slope / 0.2;
            };
            // 2. Normalize stddev (0‑1, lower better)
            const normalizeStddev = (stddev) => {
                if (stddev <= 0) return 0;
                if (stddev >= 15) return 1;
                return stddev / 15;
            };
            // 3. Normalize intensity (0‑1, lower better)
            // intensity was calculated earlier: (peak - avg) / avg
            const normalizeIntensity = (val) => {
                if (val <= 0) return 0;
                if (val >= 0.5) return 1; // treat 50% increase as worst case
                return val / 0.5;
            };

            const normSlope = normalizeSlope(awakeningMetrics.awakening_hr_slope);
            const normStddev = normalizeStddev(awakeningMetrics.awakening_hr_stddev);
            const normIntensity = normalizeIntensity(intensity);

            // Objective score (70% of total)
            const objectiveScore = (
                (1 - normSlope) * 0.5 +      // Slope 50%
                (1 - normStddev) * 0.25 +    // Stability 25%
                (1 - normIntensity) * 0.25   // Intensity 25%
            );

            // ---- Subjective metric ----
            const normalizedMood = (moodRating - 1) / 4; // 1‑5 → 0‑1

            // Total comfort score (0‑100)
            comfortScore = (objectiveScore * 0.7 + normalizedMood * 0.3) * 100;
            comfortScore = Math.round(comfortScore * 10) / 10;

            // Update comfort_score in database
            const scoreStmt = db.prepare('UPDATE alarm_events SET comfort_score = ? WHERE id = ?');
            scoreStmt.run(comfortScore, event_id);

            console.log('[POST-PROCESS] Calculated comfort_score:', comfortScore);
        }

        console.log('[POST-PROCESS] Completed:', {
            event_id,
            data_points: hrValues.length,
            hr_peak: hrPeak,
            slope: awakeningMetrics.awakening_hr_slope,
            stddev: awakeningMetrics.awakening_hr_stddev,
            comfort_score: comfortScore
        });

        res.status(200).json({
            success: true,
            data_points: hrValues.length,
            hr_peak: hrPeak,
            awakening_hr_slope: awakeningMetrics.awakening_hr_slope,
            awakening_hr_stddev: awakeningMetrics.awakening_hr_stddev,
            comfort_score: comfortScore,
            time_range: {
                start: startTime.toISOString(),
                end: endTime.toISOString()
            }
        });

    } catch (error) {
        console.error('[POST-PROCESS] Error:', error);
        res.status(500).json({
            message: 'Failed to process post-alarm data.',
            error: error.message
        });
    }
});

// POST /api/alarm/recommend - Recommend optimal mixing based on current HR pattern
router.post('/recommend', async (req, res) => {
    try {
        const userId = req.user.id;
        const { current_pattern } = req.body;

        if (!current_pattern || !Array.isArray(current_pattern)) {
            return res.status(400).json({
                message: 'current_pattern array is required.'
            });
        }

        console.log('[RECOMMEND] Starting recommendation for user:', userId);

        // Fetch past events with HR patterns and comfort scores
        const stmt = db.prepare(`
      SELECT id, hr_pattern_before, mixing_pattern, comfort_score
      FROM alarm_events
      WHERE user_id = ? 
        AND hr_pattern_before IS NOT NULL 
        AND comfort_score IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 50
    `);
        const pastEvents = stmt.all(userId);

        if (pastEvents.length === 0) {
            // No past data - return default mixing
            console.log('[RECOMMEND] No past data, using default mixing A');
            return res.status(200).json({
                recommended_mixing: 'A',
                confidence: 0.5,
                mixing_scores: {},
                similar_events_count: 0,
                note: 'No past data available, using default mixing A'
            });
        }

        // Format events for Python backend
        const formattedEvents = pastEvents.map(e => ({
            event_id: e.id,
            hr_pattern_before: JSON.parse(e.hr_pattern_before),
            mixing_pattern: e.mixing_pattern,
            comfort_score: e.comfort_score
        }));

        console.log('[RECOMMEND] Calling Python backend with', formattedEvents.length, 'past events');

        // Call Python backend for DTW-based recommendation
        try {
            const pythonResponse = await axios.post('http://localhost:8000/recommend-mixing', {
                current_pattern: current_pattern,
                past_events: formattedEvents
            });

            console.log('[RECOMMEND] Python recommendation:', pythonResponse.data);

            res.status(200).json(pythonResponse.data);

        } catch (pythonError) {
            console.error('[RECOMMEND] Python backend error:', pythonError.message);

            // Fallback: return default mixing
            res.status(200).json({
                recommended_mixing: 'A',
                confidence: 0.5,
                mixing_scores: {},
                similar_events_count: 0,
                note: 'Python backend unavailable, using default mixing A'
            });
        }

    } catch (error) {
        console.error('[RECOMMEND] Error:', error);
        res.status(500).json({
            message: 'Failed to recommend mixing.',
            error: error.message
        });
    }
});

module.exports = router;
