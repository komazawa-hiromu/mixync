const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'biomixer.db');
const db = new Database(dbPath);

console.log('🎲 Generating 99 days of dummy alarm event data...\n');

// Get user ID (assuming user 1 exists)
const userStmt = db.prepare('SELECT id FROM users LIMIT 1');
const user = userStmt.get();

if (!user) {
    console.log('❌ No user found. Please create a user first.');
    db.close();
    process.exit(1);
}

const userId = user.id;
console.log(`✅ Using user ID: ${userId}\n`);

// Get or create alarm
const alarmStmt = db.prepare('SELECT id FROM alarms WHERE user_id = ? LIMIT 1');
const alarm = alarmStmt.get(userId);

let alarmId;
if (!alarm) {
    const createAlarmStmt = db.prepare('INSERT INTO alarms (user_id, time, days_of_week, sound_file, mixing_pattern, is_active) VALUES (?, ?, ?, ?, ?, ?)');
    const info = createAlarmStmt.run(userId, '07:00', '0,1,2,3,4,5,6', 'default.mp3', 'A', 1);
    alarmId = info.lastInsertRowid;
    console.log(`✅ Created dummy alarm ID: ${alarmId}\n`);
} else {
    alarmId = alarm.id;
    console.log(`✅ Using existing alarm ID: ${alarmId}\n`);
}

// Helper: Generate realistic HR pattern
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
        } else if (trend === 'sharp-rise') {
            const progress = i / points;
            hr += progress * 25 * variation + (Math.random() * 5 - 2.5);
        }

        pattern.push(Math.round(hr));
    }

    return pattern;
}

// Helper: Calculate slope
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

// Helper: Calculate stddev
function calculateStddev(hrValues) {
    const mean = hrValues.reduce((a, b) => a + b, 0) / hrValues.length;
    const variance = hrValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / hrValues.length;
    return Math.sqrt(variance);
}

// Helper: Calculate comfort score
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

// Mixing patterns with variation
const mixingPatterns = [
    {
        pattern: 'A',
        baseHR: 58,
        trend: 'rising',
        moodRange: [3, 5],
        variationRange: [0.6, 1.0]  // Gentler awakening
    },
    {
        pattern: 'B',
        baseHR: 60,
        trend: 'rising',
        moodRange: [2, 4],
        variationRange: [1.0, 1.4]  // Medium
    },
    {
        pattern: 'C',
        baseHR: 62,
        trend: 'sharp-rise',
        moodRange: [1, 3],
        variationRange: [1.2, 1.8]  // Harsh awakening
    }
];

const startDate = new Date();
startDate.setDate(startDate.getDate() - 99);

let eventCount = 0;

console.log('📅 Generating 99 days of data...\n');

for (let day = 0; day < 99; day++) {
    const eventDate = new Date(startDate);
    eventDate.setDate(eventDate.getDate() + day);
    eventDate.setHours(7, 0, 0, 0);

    // Cycle through mixing patterns (33 days each)
    const mixingIndex = Math.floor(day / 33) % 3;
    const mixing = mixingPatterns[mixingIndex];

    // Add daily variation
    const dailyVariation = mixing.variationRange[0] +
        Math.random() * (mixing.variationRange[1] - mixing.variationRange[0]);

    const hrBefore = generateHRPattern(mixing.baseHR, 900, 'stable', dailyVariation);
    const hrAfter = generateHRPattern(mixing.baseHR + 5, 180, mixing.trend, dailyVariation);

    const slope = calculateSlope(hrAfter);
    const stddev = calculateStddev(hrAfter);
    const hrPeak = Math.max(...hrAfter);
    const hrAvgBefore = hrBefore.reduce((a, b) => a + b, 0) / hrBefore.length;
    const hrStdBefore = calculateStddev(hrBefore);

    const moodRating = Math.floor(Math.random() * (mixing.moodRange[1] - mixing.moodRange[0] + 1)) + mixing.moodRange[0];
    const comfortScore = calculateComfortScore(slope, stddev, moodRating);

    const stmt = db.prepare(`
        INSERT INTO alarm_events (
            user_id, alarm_id, alarm_time, mixing_pattern,
            hr_pattern_before, hr_avg_before, hr_std_before,
            hr_pattern_after, hr_peak, awakening_hr_slope, awakening_hr_stddev,
            mood_rating, comfort_score,
            rang_at_jp, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
        userId,
        alarmId,
        eventDate.toISOString(),
        mixing.pattern,
        JSON.stringify(hrBefore),
        hrAvgBefore,
        hrStdBefore,
        JSON.stringify(hrAfter),
        hrPeak,
        slope,
        stddev,
        moodRating,
        comfortScore,
        eventDate.toISOString(),
        new Date().toISOString()
    );

    eventCount++;

    if ((day + 1) % 10 === 0) {
        console.log(`  Generated ${day + 1}/99 events...`);
    }
}

console.log('\n' + '='.repeat(50));
console.log(`✅ Successfully generated ${eventCount} dummy events!`);
console.log('='.repeat(50));

const stats = db.prepare(`
    SELECT 
        mixing_pattern,
        COUNT(*) as count,
        AVG(awakening_hr_slope) as avg_slope,
        MIN(awakening_hr_slope) as min_slope,
        MAX(awakening_hr_slope) as max_slope,
        AVG(comfort_score) as avg_comfort
    FROM alarm_events
    WHERE user_id = ?
    GROUP BY mixing_pattern
`).all(userId);

console.log('\n📊 Summary Statistics:');
console.log('─'.repeat(50));
stats.forEach(s => {
    console.log(`  Mixing ${s.mixing_pattern}: ${s.count} events`);
    console.log(`    Slope: ${s.min_slope.toFixed(3)} - ${s.max_slope.toFixed(3)} (avg: ${s.avg_slope.toFixed(3)})`);
    console.log(`    Comfort: ${s.avg_comfort.toFixed(1)}`);
});

console.log('\n🎉 Dummy data generation complete!');
console.log('You can now test the DTW recommendation system.\n');

db.close();
