require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const session = require('express-session');
const passport = require('passport');
const flash = require('connect-flash');
const logger = require('morgan');

const initializePassport = require('./lib/passport-config');
initializePassport(passport);

const app = express();

// Middleware
app.use(logger('dev'));
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:5173',     // Vite dev server
      'http://localhost',           // Capacitor
      'capacitor://localhost',      // Capacitor iOS
      'http://10.0.2.2:3001',       // Android emulator
    ];

    // Check if origin matches allowed origins or localhost with any port
    if (allowedOrigins.indexOf(origin) !== -1 || origin.startsWith('http://localhost:')) {
      callback(null, true);
    }
    // Allow any local network IP (192.168.x.x, 10.x.x.x, 172.16.x.x) for real device
    else if (/^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin)) {
      callback(null, true);
    }
    else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json()); // for parsing application/json

// --- Session & Passport Setup ---
app.use(session({
  secret: 'a-very-secret-key-that-should-be-in-env-file', // TODO: Move to .env
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'none',  // Allow cross-origin cookies (required for Capacitor)
    secure: false,     // Set to false for HTTP (development only)
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
// --- End of Setup ---

// A simple test route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the BioMixer Node.js backend!' });
});

// A route to test communication with the Python backend
app.get('/test-python', async (req, res) => {
  try {
    const pythonResponse = await axios.get('http://localhost:8000/');
    res.json({
      message: "Successfully communicated with Python backend.",
      data_from_python: pythonResponse.data
    });
  } catch (error) {
    console.error("Error communicating with Python backend:", error.message);
    res.status(500).json({
      message: "Failed to communicate with Python backend.",
      error: error.message
    });
  }
});

// Routers
const authRouter = require('./routes/auth');
const fitbitRouter = require('./routes/fitbit');
const alarmsRouter = require('./routes/alarms');
const audioRouter = require('./routes/audio');
const evaluationsRouter = require('./routes/evaluations');
const eventsRouter = require('./routes/events');
const alarmEventsRouter = require('./routes/alarm-events');
const alarmProcessRouter = require('./routes/alarm-process');

app.use('/auth', authRouter);
app.use('/api/fitbit', fitbitRouter);
app.use('/api/alarms', alarmsRouter);
app.use('/api/audio', audioRouter);
app.use('/api/evaluations', evaluationsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/alarm-events', alarmEventsRouter);
app.use('/api/alarm', alarmProcessRouter);

// --- New Wake-up Calculation Endpoint ---
app.post('/api/calculate-wakeup', (req, res) => {
  const { bedtime } = req.body; // e.g., "23:30"

  if (!bedtime || !/^\d{2}:\d{2}$/.test(bedtime)) {
    return res.status(400).json({ message: 'Valid bedtime in HH:MM format is required.' });
  }

  const [hours, minutes] = bedtime.split(':').map(Number);

  // Create a date object for today and set the bedtime
  const bedtimeDate = new Date();
  bedtimeDate.setHours(hours, minutes, 0, 0);

  // Add 15 minutes for sleep onset latency
  bedtimeDate.setMinutes(bedtimeDate.getMinutes() + 15);

  const sleepCycles = [4, 5, 6]; // 6h, 7.5h, 9h of sleep
  const recommendations = sleepCycles.map(cycles => {
    const wakeupDate = new Date(bedtimeDate.getTime() + cycles * 90 * 60 * 1000);
    const wakeupHours = wakeupDate.getHours().toString().padStart(2, '0');
    const wakeupMinutes = wakeupDate.getMinutes().toString().padStart(2, '0');
    return `${wakeupHours}:${wakeupMinutes}`;
  });

  res.json({
    message: `理想的な睡眠サイクル（90分）を考慮すると、おすすめの起床時間はこちらです：`,
    times: recommendations
  });
});

module.exports = app;
