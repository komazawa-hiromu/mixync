const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'biomixer.db');
const db = new Database(dbPath);

console.log('🗑️  Deleting incomplete events...\n');

// Delete events #107 and #108
const deleteStmt = db.prepare('DELETE FROM alarm_events WHERE id IN (107, 108)');
const result = deleteStmt.run();

console.log(`✅ Deleted ${result.changes} events (ID: 107, 108)\n`);

// Show remaining events
const remainingStmt = db.prepare('SELECT COUNT(*) as count FROM alarm_events');
const remaining = remainingStmt.get();

console.log(`📊 Remaining events: ${remaining.count}\n`);

db.close();
console.log('Done!');
