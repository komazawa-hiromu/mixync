const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'biomixer.db');
const db = new Database(dbPath);

console.log('📊 Checking generated heart rate data...\n');

// Get first event
const event = db.prepare('SELECT * FROM alarm_events LIMIT 1').get();

if (event) {
    console.log('✅ Event found:', event.id);
    console.log('   Mixing:', event.mixing_pattern);
    console.log('   Alarm time:', event.alarm_time);

    // Parse HR patterns
    const hrBefore = JSON.parse(event.hr_pattern_before);
    const hrAfter = JSON.parse(event.hr_pattern_after);

    console.log('\n📈 HR Pattern Before (起床前15分):');
    console.log('   Data points:', hrBefore.length);
    console.log('   First 10 values:', hrBefore.slice(0, 10).join(', '));
    console.log('   Last 10 values:', hrBefore.slice(-10).join(', '));
    console.log('   Average:', event.hr_avg_before.toFixed(1), 'bpm');

    console.log('\n📈 HR Pattern After (起床後3分):');
    console.log('   Data points:', hrAfter.length);
    console.log('   First 10 values:', hrAfter.slice(0, 10).join(', '));
    console.log('   Last 10 values:', hrAfter.slice(-10).join(', '));
    console.log('   Peak:', event.hr_peak, 'bpm');

    console.log('\n📊 Calculated Metrics:');
    console.log('   Slope:', event.awakening_hr_slope.toFixed(3), 'bpm/sec');
    console.log('   Stddev:', event.awakening_hr_stddev.toFixed(1), 'bpm');
    console.log('   Mood:', event.mood_rating);
    console.log('   Comfort Score:', event.comfort_score.toFixed(1));

    console.log('\n✅ Heart rate data is properly stored in JSON format!');
    console.log('   This data will be used for DTW similarity calculation.');
} else {
    console.log('❌ No events found in database');
}

db.close();
