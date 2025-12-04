const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'biomixer.db');
const db = new Database(dbPath);

console.log('Starting migration: Add AI alarm optimization columns...');

try {
    // Check if columns already exist
    const tableInfo = db.prepare("PRAGMA table_info(alarm_events)").all();
    const existingColumns = tableInfo.map(col => col.name);

    const columnsToAdd = [
        { name: 'alarm_time', type: 'DATETIME', comment: 'Alarm timestamp' },
        { name: 'mixing_pattern', type: 'TEXT', comment: 'Mixing type: A, B, or C' },

        // 起床前（リアルタイム取得）
        { name: 'hr_pattern_before', type: 'TEXT', comment: 'JSON: Heart rate pattern before alarm' },
        { name: 'hr_avg_before', type: 'REAL', comment: 'Average HR before alarm' },
        { name: 'hr_std_before', type: 'REAL', comment: 'Std dev of HR before alarm' },

        // 起床後（事後取得）
        { name: 'hr_pattern_after', type: 'TEXT', comment: 'JSON: Heart rate pattern after alarm' },
        { name: 'hr_peak', type: 'REAL', comment: 'Peak heart rate after alarm' },
        { name: 'hr_recovery_time', type: 'INTEGER', comment: 'Recovery time in minutes' },

        // HRV（事後取得、別機能用）
        { name: 'hrv_avg', type: 'REAL', comment: 'Average HRV during sleep' },
        { name: 'hrv_hf', type: 'REAL', comment: 'HRV high frequency component' },
        { name: 'hrv_lf_hf_ratio', type: 'REAL', comment: 'HRV LF/HF ratio' },

        // 睡眠ステージ（事後取得）
        { name: 'sleep_stage_before', type: 'TEXT', comment: 'Sleep stage before alarm: light, deep, rem' },

        // 総合スコア
        { name: 'comfort_score', type: 'REAL', comment: 'Comfort score (0-100)' },

        // タイムスタンプ
        { name: 'created_at', type: 'DATETIME', comment: 'Record creation timestamp', default: 'CURRENT_TIMESTAMP' }
    ];

    let addedCount = 0;

    for (const column of columnsToAdd) {
        if (!existingColumns.includes(column.name)) {
            const defaultClause = column.default ? `DEFAULT ${column.default}` : '';
            const sql = `ALTER TABLE alarm_events ADD COLUMN ${column.name} ${column.type} ${defaultClause}`;

            console.log(`Adding column: ${column.name} (${column.comment})`);
            db.exec(sql);
            addedCount++;
        } else {
            console.log(`Column ${column.name} already exists, skipping.`);
        }
    }

    console.log(`\nMigration completed successfully!`);
    console.log(`Added ${addedCount} new columns.`);

    // Show final schema
    console.log('\n--- Final alarm_events schema ---');
    const finalTableInfo = db.prepare("PRAGMA table_info(alarm_events)").all();
    finalTableInfo.forEach(col => {
        console.log(`  ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`);
    });

} catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
} finally {
    db.close();
}
