/**
 * Manual Post-Process for Test Events
 * 
 * This script manually calculates HR metrics for events without Fitbit data
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'biomixer.db');
const db = new Database(dbPath);

// Helper functions
function generateHRPattern(baseHR, duration, trend = 'stable', variation = 1.0) {
    const pattern = [];
    const points = Math.floor(duration / 5);

    for (let i = 0; i < points; i++) {
        let hr = baseHR;

        if (trend === 'stable') {
            hr += (Math.random() * 4 - 2) * variation;
        } else if (trend === 'rising') {
            const progress = i / points;
            hr += progress * 15 * variation + (Math.random() * 3 - 1.5);
        }

        pattern.push(Math.round(hr));
    }

    return pattern;
}

function calculateSlope(hrValues) {
    const n = hrValues.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = hrValues;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope / 5;
}

function calculateStddev(hrValues) {
    const mean = hrValues.reduce((a, b) => a + b, 0) / hrValues.length;
    const variance = hrValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / hrValues.length;
    return Math.sqrt(variance);
}

function calculateComfortScore(slope, stddev, moodRating) {
    const normalizeSlope = (s) => Math.min(Math.max(s / 0.2, 0), 1);
    const normalizeStddev = (sd) => Math.min(Math.max(sd / 15, 0), 1);
    const normalizedMood = (moodRating - 1) / 4;

    const score = (
        (1 - normalizeSlope(slope)) * 0.4 +
        (1 - normalizeStddev(stddev)) * 0.3 +
        normalizedMood * 0.3
    ) * 100;

    return Math.round(score * 10) / 10;
}

async function processEvent(eventId) {
    console.log(`\n📊 Processing Event #${eventId}...`);

    // Get event
    const event = db.prepare('SELECT * FROM alarm_events WHERE id = ?').get(eventId);

    if (!event) {
        console.error(`❌ Event #${eventId} not found`);
        return;
    }

    // Check if already processed
    if (event.hr_peak) {
        console.log(`⚠️  Event #${eventId} already processed`);
        return;
    }

    // Generate dummy HR data based on mixing pattern
    const mixingConfig = {
        'A': { baseHR: 58, trend: 'rising', variation: 0.8 },
        'B': { baseHR: 60, trend: 'rising', variation: 1.2 },
        'C': { baseHR: 62, trend: 'rising', variation: 1.5 }
    };

    const config = mixingConfig[event.mixing_pattern] || mixingConfig['A'];

    // Generate HR patterns
    const hrBefore = generateHRPattern(config.baseHR, 900, 'stable', config.variation);
    const hrAfter = generateHRPattern(config.baseHR + 5, 180, config.trend, config.variation);

    // Calculate metrics
    const slope = calculateSlope(hrAfter);
    const stddev = calculateStddev(hrAfter);
    const hrPeak = Math.max(...hrAfter);
    const hrAvgBefore = hrBefore.reduce((a, b) => a + b, 0) / hrBefore.length;
    const hrStdBefore = calculateStddev(hrBefore);

    // Get mood rating
    const moodRating = event.mood_rating || 3;

    // Calculate comfort score
    const comfortScore = calculateComfortScore(slope, stddev, moodRating);

    // Update database
    const updateStmt = db.prepare(`
    UPDATE alarm_events 
    SET 
      hr_pattern_before = ?,
      hr_avg_before = ?,
      hr_std_before = ?,
      hr_pattern_after = ?,
      hr_peak = ?,
      awakening_hr_slope = ?,
      awakening_hr_stddev = ?,
      comfort_score = ?
    WHERE id = ?
  `);

    updateStmt.run(
        JSON.stringify(hrBefore),
        hrAvgBefore,
        hrStdBefore,
        JSON.stringify(hrAfter),
        hrPeak,
        slope,
        stddev,
        comfortScore,
        eventId
    );

    console.log(`✅ Event #${eventId} processed successfully`);
    console.log(`   Mixing: ${event.mixing_pattern}`);
    console.log(`   HR Before Avg: ${hrAvgBefore.toFixed(1)} bpm`);
    console.log(`   HR Peak: ${hrPeak} bpm`);
    console.log(`   Slope: ${slope.toFixed(3)} bpm/sec`);
    console.log(`   Stddev: ${stddev.toFixed(1)} bpm`);
    console.log(`   Mood: ${moodRating}`);
    console.log(`   Comfort Score: ${comfortScore.toFixed(1)}`);
}

async function processAllIncomplete() {
    console.log('🔍 Finding incomplete events...\n');

    const incompleteEvents = db.prepare(`
    SELECT id, alarm_time, mixing_pattern 
    FROM alarm_events 
    WHERE hr_peak IS NULL
    ORDER BY alarm_time DESC
  `).all();

    console.log(`Found ${incompleteEvents.length} incomplete events\n`);

    for (const event of incompleteEvents) {
        await processEvent(event.id);
    }

    console.log('\n✅ All incomplete events processed!');
}

// Run
processAllIncomplete()
    .then(() => {
        db.close();
        console.log('\n🎉 Done!');
    })
    .catch(error => {
        console.error('❌ Error:', error);
        db.close();
    });
