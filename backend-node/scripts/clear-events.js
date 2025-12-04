const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'biomixer.db');
const db = new Database(dbPath);

console.log('🗑️  Clearing old alarm events...\n');

// Delete all alarm events
const result = db.prepare('DELETE FROM alarm_events').run();

console.log(`✅ Deleted ${result.changes} old events\n`);
console.log('Now run: node scripts/generate-dummy-data.js\n');

db.close();
