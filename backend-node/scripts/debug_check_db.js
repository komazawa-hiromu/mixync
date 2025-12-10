const { db } = require('../lib/database');
const stmt = db.prepare('SELECT count(*) as count FROM alarm_events');
const row = stmt.get();
console.log('Total alarm events:', row.count);

const patterns = db.prepare('SELECT mixing_pattern, count(*) as c FROM alarm_events GROUP BY mixing_pattern').all();
console.log('Patterns:', patterns);
