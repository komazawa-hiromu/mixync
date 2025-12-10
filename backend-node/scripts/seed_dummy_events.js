const { db } = require('../lib/database');

console.log('--- Seeding 35 FULL Dummy Alarm Events ---');

// 1. Get or Create User
let user = db.prepare('SELECT id FROM users LIMIT 1').get();
if (!user) {
    console.log('Creating dummy user...');
    const result = db.prepare('INSERT INTO users (email, password) VALUES (?, ?)').run('dummy@example.com', 'hashedpassword');
    user = { id: result.lastInsertRowid };
}
const userId = user.id;

// 2. Get or Create Alarm
let alarm = db.prepare('SELECT id FROM alarms WHERE user_id = ? LIMIT 1').get(userId);
if (!alarm) {
    console.log('Creating dummy alarm...');
    const result = db.prepare('INSERT INTO alarms (user_id, time, sound_file, mixing_pattern) VALUES (?, ?, ?, ?)').run(userId, '07:00', 'default.mp3', 'A');
    alarm = { id: result.lastInsertRowid };
}
const alarmId = alarm.id;

console.log(`Target: UserID=${userId}, AlarmID=${alarmId}`);

// Helpers adapted from generate-dummy-data.js
function calculateSlope(hrValues) {
    if (!hrValues || hrValues.length === 0) return 0;
    const n = hrValues.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = hrValues;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const denominator = (n * sumX2 - sumX * sumX);
    if (denominator === 0) return 0;
    const slope = (n * sumXY - sumX * sumY) / denominator;
    return slope;
}

function calculateStddev(hrValues) {
    if (!hrValues || hrValues.length === 0) return 0;
    const mean = hrValues.reduce((a, b) => a + b, 0) / hrValues.length;
    const variance = hrValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / hrValues.length;
    return Math.sqrt(variance);
}

function generateHRPattern(baseHR, durationSeconds, trend = 'stable') {
    const points = Math.floor(durationSeconds / 5); // 5 sec intervals
    const pattern = [];
    for (let i = 0; i < points; i++) {
        let hr = baseHR;
        if (trend === 'stable') {
            hr += (Math.random() * 4 - 2);
        } else if (trend === 'rising') {
            hr += (i / points) * 15 + (Math.random() * 3 - 1.5);
        }
        pattern.push(Math.round(hr));
    }
    return pattern;
}

const patterns = ['A', 'B', 'C', 'D', 'E'];
const countsPerPattern = 7;
let totalInserted = 0;

try {
    // Optional: Clean up "bad" incomplete data from previous runs if needed
    // db.prepare('DELETE FROM alarm_events WHERE hr_pattern_after IS NULL').run();

    const stmt = db.prepare(`
        INSERT INTO alarm_events (
            user_id, alarm_id, alarm_time, mixing_pattern, 
            hr_pattern_before, hr_avg_before, hr_std_before,
            hr_pattern_after, hr_peak, awakening_hr_slope, awakening_hr_stddev,
            hr_recovery_time, hrv_avg, hrv_hf, hrv_lf_hf_ratio,
            sleep_stage_before, mood_rating, sound_rating,
            intensity, comfort_score, created_at, rang_at_jp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
        for (const pat of patterns) {
            for (let i = 0; i < countsPerPattern; i++) {
                const now = new Date();
                // Space them out over last 35 days
                const dateOffset = 35 - totalInserted;
                now.setDate(now.getDate() - dateOffset);
                const dateStr = now.toISOString();

                // 1. Before Pattern (Stable Sleep)
                const hrBefore = generateHRPattern(60, 300, 'stable'); // 5 mins
                const hrAvgBefore = hrBefore.reduce((a, b) => a + b, 0) / hrBefore.length;
                const hrStdBefore = calculateStddev(hrBefore);

                // 2. After Pattern (Awakening)
                // Vary 'rising' logic slightly per pattern to make them distinct?
                const hrAfter = generateHRPattern(65, 180, 'rising'); // 3 mins
                const hrPeak = Math.max(...hrAfter);
                const slope = calculateSlope(hrAfter);
                const stdAfter = calculateStddev(hrAfter);

                // 3. Other metrics
                const recoveryTime = Math.random() * 10; // 0-10 mins
                const hrvAvg = 40 + Math.random() * 40;
                const hrvHf = Math.random() * 1000;
                const hrvRatio = 0.5 + Math.random() * 2;
                const sleepStage = ['light', 'rem', 'light', 'deep'][Math.floor(Math.random() * 4)];

                const mood = Math.floor(Math.random() * 3) + 3; // 3-5 (Good)
                const sound = Math.floor(Math.random() * 3) + 3; // 3-5
                const intensity = Math.random(); // 0.0 - 1.0 (Volume?)

                const comfort = 70 + Math.random() * 30; // 70-100

                stmt.run(
                    userId, alarmId, dateStr, pat,
                    JSON.stringify(hrBefore), hrAvgBefore, hrStdBefore,
                    JSON.stringify(hrAfter), hrPeak, slope, stdAfter,
                    recoveryTime, hrvAvg, hrvHf, hrvRatio,
                    sleepStage, mood, sound,
                    intensity, comfort, dateStr, dateStr
                );
                totalInserted++;
            }
        }
    })();

    console.log(`Successfully inserted ${totalInserted} FULL dummy events.`);

} catch (error) {
    console.error('Error seeding data:', error);
}
