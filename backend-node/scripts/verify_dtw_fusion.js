const axios = require('axios');
const fs = require('fs');
const { db } = require('../lib/database');

const OUTPUT_FILE = 'verify_result.txt';

function log(msg) {
    fs.appendFileSync(OUTPUT_FILE, msg + '\n');
}

// Clear log
if (fs.existsSync(OUTPUT_FILE)) fs.unlinkSync(OUTPUT_FILE);

log('--- Verifying DTW Fusion Logic ---');

try {
    const userId = 1;
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM alarm_events WHERE user_id = ?');
    const count = countStmt.get(userId).count;

    log(`User ${userId} has ${count} events.`);

    if (count < 35) {
        log('WARNING: Not enough events for DTW test! (Expected >= 35)');
        // But we proceed anyway to test the Python logic if possible
    }

    const stmt = db.prepare(`
        SELECT id, hr_pattern_before, mixing_pattern, comfort_score
        FROM alarm_events
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
    `);
    const pastEvents = stmt.all(userId);
    log(`Fetched ${pastEvents.length} past events.`);

    const formattedEvents = pastEvents.map(e => ({
        event_id: e.id,
        hr_pattern_before: JSON.parse(e.hr_pattern_before),
        mixing_pattern: e.mixing_pattern,
        comfort_score: e.comfort_score
    }));

    const generateTestPattern = () => {
        const points = 300;
        const pattern = [];
        for (let i = 0; i < points; i++) {
            const val = 60 + 10 * Math.sin((i) / 50.0);
            pattern.push(Math.round(val));
        }
        return pattern;
    };

    const currentPattern = generateTestPattern();
    log('Generated test pattern.');

    async function runTest() {
        try {
            log('Sending request to Python backend (http://localhost:8000/recommend-mixing)...');

            const response = await axios.post('http://localhost:8000/recommend-mixing', {
                current_pattern: currentPattern,
                past_events: formattedEvents
            });

            log('\n--- Recommendation Result ---');
            log(`Recommended Mixing: ${response.data.recommended_mixing}`);
            log(`Confidence: ${response.data.confidence}`);
            log(`Note: ${response.data.note}`);
            log(`mixing_scores: ${JSON.stringify(response.data.mixing_scores)}`);
            log(`similar_events_count: ${response.data.similar_events_count}`);

            if (String(response.data.recommended_mixing).includes('+')) {
                log('\nSUCCESS: Fusion occurred!');
            } else {
                log('\nResult is single pattern.');
            }

        } catch (error) {
            log(`Test failed: ${error.message}`);
            if (error.response) {
                log(`Response data: ${JSON.stringify(error.response.data)}`);
            }
        }
    }

    runTest();
} catch (err) {
    log(`Script Error: ${err.message}`);
}
