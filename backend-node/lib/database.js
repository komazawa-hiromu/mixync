const Database = require('better-sqlite3');
const path = require('path');

// Use a file-based database named biomixer.db
const dbPath = path.join(__dirname, '..', 'biomixer.db');
const db = new Database(dbPath);

console.log('Connected to the SQLite database.');

// Function to initialize the database and create the users table
const initDb = () => {
  console.log('Initializing database with new schema...');

  // Keep existing tables that are needed
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    fitbit_access_token TEXT,
    fitbit_refresh_token TEXT,
    fitbit_user_id TEXT
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS alarms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    time TEXT NOT NULL,
    days_of_week TEXT,
    sound_file TEXT NOT NULL,
    mixing_pattern TEXT DEFAULT 'AUTO',
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS sleep_logs (
    logId INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    dateOfSleep TEXT NOT NULL,
    duration INTEGER NOT NULL,
    efficiency INTEGER NOT NULL,
    timeInBed INTEGER NOT NULL,
    levels TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS rem_cycle_intervals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sleep_log_id INTEGER NOT NULL,
    dateOfSleep TEXT NOT NULL,
    interval_minutes REAL NOT NULL,
    calculated_at TEXT NOT NULL,
    UNIQUE(user_id, sleep_log_id, interval_minutes),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sleep_log_id) REFERENCES sleep_logs(logId) ON DELETE CASCADE
  )`);

  // Create the new consolidated alarm_events table
  db.exec(`CREATE TABLE IF NOT EXISTS alarm_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    alarm_id INTEGER NOT NULL,
    alarm_time TEXT NOT NULL,
    mixing_pattern TEXT NOT NULL,
    rang_at_jp TEXT,
    hr_pattern_before TEXT,
    hr_avg_before REAL,
    hr_std_before REAL,
    hr_pattern_after TEXT,
    hr_peak REAL,
    awakening_hr_slope REAL,
    awakening_hr_stddev REAL,
    hr_recovery_time REAL,
    hrv_avg REAL,
    hrv_hf REAL,
    hrv_lf_hf_ratio REAL,
    sleep_stage_before TEXT,
    mood_rating INTEGER,
    sound_rating INTEGER,
    comfort_score REAL,
    intensity REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (alarm_id) REFERENCES alarms(id) ON DELETE CASCADE
  )`);

  // Ensure intensity column exists for older databases
  try {
    db.exec('ALTER TABLE alarm_events ADD COLUMN intensity REAL');
  } catch (e) {
    // Column probably already exists; ignore error
  }

  console.log("Database tables created successfully.");
};

module.exports = {
  db,
  initDb
};