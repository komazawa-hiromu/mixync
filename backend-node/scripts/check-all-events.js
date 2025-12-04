const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'biomixer.db');
const db = new Database(dbPath);

console.log('📊 Checking all events data...\n');

const events = db.prepare(`
  SELECT 
    id, 
    alarm_time, 
    mixing_pattern, 
    awakening_hr_slope, 
    comfort_score,
    mood_rating
  FROM alarm_events 
  ORDER BY alarm_time ASC
  LIMIT 5
`).all();

console.log(`Found ${events.length} events (showing first 5):\n`);

events.forEach((e, i) => {
    console.log(`Event ${i + 1}:`);
    console.log(`  ID: ${e.id}`);
    console.log(`  Alarm Time: ${e.alarm_time}`);
    console.log(`  Mixing: ${e.mixing_pattern}`);
    console.log(`  Slope: ${e.awakening_hr_slope?.toFixed(3)}`);
    console.log(`  Comfort Score: ${e.comfort_score?.toFixed(1)}`);
    console.log(`  Mood: ${e.mood_rating}`);
    console.log('');
});

// Check if dates are properly formatted
const firstEvent = events[0];
if (firstEvent) {
    const date = new Date(firstEvent.alarm_time);
    console.log('Date parsing test:');
    console.log(`  Raw: ${firstEvent.alarm_time}`);
    console.log(`  Parsed: ${date.toLocaleString('ja-JP')}`);
    console.log(`  Short: ${date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}`);
}

db.close();
