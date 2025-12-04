const express = require('express');
const axios = require('axios');
const { db } = require('../lib/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// --- Helper function to refresh Fitbit token ---
const refreshFitbitToken = async (user) => {
  console.log('Refreshing Fitbit token for user:', user.id);
  const base64Credentials = Buffer.from(`${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`).toString('base64');

  try {
    const response = await axios.post(
      'https://api.fitbit.com/oauth2/token',
      `grant_type=refresh_token&refresh_token=${user.fitbit_refresh_token}`,
      { headers: { 'Authorization': `Basic ${base64Credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token } = response.data;

    // Update the new tokens in the database using better-sqlite3 sync API
    const stmt = db.prepare('UPDATE users SET fitbit_access_token = ?, fitbit_refresh_token = ? WHERE id = ?');
    stmt.run(access_token, refresh_token, user.id);
    console.log('Successfully updated Fitbit tokens for user:', user.id);

    return access_token; // Return the new access token

  } catch (error) {
    console.error('Error refreshing Fitbit token:', error.response ? error.response.data : error.message);
    throw new Error('Could not refresh Fitbit token.');
  }
};

// --- Helper function to make Fitbit API requests with auto-refresh ---
const fitbitApiRequest = async (url, user, retries = 1) => {
  console.log('Making Fitbit API request to:', url);
  try {
    const response = await axios.get(url, { headers: { 'Authorization': `Bearer ${user.fitbit_access_token}` } });
    return response;
  } catch (error) {
    // If token is expired (401) and we haven't retried yet
    if (error.response && error.response.status === 401 && retries > 0) {
      console.log('Access token expired. Attempting to refresh...');
      const newAccessToken = await refreshFitbitToken(user);
      const updatedUser = { ...user, fitbit_access_token: newAccessToken };
      // Retry the request with the new token
      return fitbitApiRequest(url, updatedUser, retries - 1);
    }
    // If rate limited (429) and we haven't retried yet
    if (error.response && error.response.status === 429 && retries > 0) {
      console.log('Rate limited. Waiting 1 second before retrying...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fitbitApiRequest(url, user, retries - 1);
    }
    // For other errors or if retries are exhausted, re-throw the error
    throw error;
  }
};


// Apply JWT authentication to all routes in this file
router.use(authenticateToken);

// Middleware to fetch full user info including Fitbit tokens
router.use((req, res, next) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (!user.fitbit_access_token) {
      return res.status(401).json({ message: 'Unauthorized. Please connect your Fitbit account.' });
    }

    // Attach full user info to req.user
    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user data.', error: error.message });
  }
});


router.get('/sleep/:date', async (req, res) => {
  const { date } = req.params;
  const fitbitApiUrl = `https://api.fitbit.com/1.2/user/${req.user.fitbit_user_id}/sleep/date/${date}.json`;
  try {
    const response = await fitbitApiRequest(fitbitApiUrl, req.user);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching Fitbit sleep data:', error.response ? error.response.data.errors : error.message);
    res.status(500).json({ message: 'Failed to fetch sleep data from Fitbit.' });
  }
});

router.get('/heartrate/intraday/:date', async (req, res) => {
  const { date } = req.params;
  const fitbitApiUrl = `https://api.fitbit.com/1/user/${req.user.fitbit_user_id}/activities/heart/date/${date}/1d/1min/time/00:00/23:59.json`;
  try {
    const response = await fitbitApiRequest(fitbitApiUrl, req.user);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching intraday heart rate data:', error.response ? error.response.data.errors : error.message);
    res.status(500).json({ message: 'Failed to fetch intraday heart rate data from Fitbit.' });
  }
});

// GET /api/fitbit/heartrate/intraday-test/:date - For testing 1sec data availability
router.get('/heartrate/intraday-test/:date', async (req, res) => {
  const { date } = req.params;
  const { startTime, endTime } = req.query; // Get startTime and endTime from query parameters

  let fitbitApiUrl = `https://api.fitbit.com/1/user/${req.user.fitbit_user_id}/activities/heart/date/${date}/1d/1sec`;
  if (startTime && endTime) {
    fitbitApiUrl += `/time/${startTime}/${endTime}.json`;
  } else {
    fitbitApiUrl += `/time/00:00/23:59.json`; // Default to full day if not specified
  }

  try {
    const response = await fitbitApiRequest(fitbitApiUrl, req.user);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching 1sec intraday heart rate data:', error.response ? error.response.data.errors : error.message);
    res.status(500).json({ message: 'Failed to fetch 1sec intraday heart rate data.', errors: error.response ? error.response.data.errors : [] });
  }
});


router.post('/process/sleep', async (req, res) => {
  // Simplified to only require sound_file and day_of_week
  const { sound_file, day_of_week } = req.body;

  if (sound_file === undefined || day_of_week === undefined) {
    return res.status(400).json({ message: 'Sound file and day of week are required.' });
  }

  try {
    // Forward only the necessary data to the Python backend
    const payload = { sound_file, day_of_week };
    const pythonResponse = await axios.post('http://localhost:8000/process-sleep-data', payload);
    res.status(200).json(pythonResponse.data);

  } catch (error) {
    console.error('Error forwarding data to Python backend for sound processing:', error.message);
    res.status(500).json({ message: 'Failed to process sound data with Python backend.' });
  }
});

// POST /api/fitbit/heartrate/resample-and-analyze - Resamples and analyzes HR data
router.post('/heartrate/resample-and-analyze', async (req, res) => {
  const { hr_dataset } = req.body;

  if (!hr_dataset) {
    return res.status(400).json({ message: 'Heart rate dataset is required.' });
  }

  try {
    // Forward the data to the Python backend for resampling and analysis
    const pythonResponse = await axios.post('http://localhost:8000/resample-and-analyze', {
      hr_dataset: hr_dataset,
    });

    // Return the result from the Python backend to the client
    res.status(200).json(pythonResponse.data);

  } catch (error) {
    console.error('Error forwarding HR data to Python for analysis:', error.message);
    // Check if the error is from the Python service and forward its response if possible
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ message: 'Failed to analyze heart rate data with Python backend.' });
  }
});

router.get('/sleep/week/:date', async (req, res) => {
  const { date } = req.params;
  const userId = req.user.id; // Use database user ID, not Fitbit user ID
  const { fitbit_user_id } = req.user;

  try {
    const syncUrl = `https://api.fitbit.com/1.2/user/${fitbit_user_id}/sleep/list.json?sort=desc&offset=0&limit=50&beforeDate=${date}`;
    const fitbitResponse = await fitbitApiRequest(syncUrl, req.user);
    const newLogs = fitbitResponse.data.sleep;

    if (newLogs && newLogs.length > 0) {
      const stmt = db.prepare(`INSERT OR IGNORE INTO sleep_logs (logId, user_id, dateOfSleep, duration, efficiency, timeInBed, levels) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      for (const log of newLogs) {
        stmt.run(log.logId, userId, log.dateOfSleep, log.duration, log.efficiency, log.timeInBed, JSON.stringify(log.levels));
      }
      console.log(`Synced ${newLogs.length} sleep logs.`);
    }

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();
    const sunday = new Date(targetDate);
    sunday.setDate(targetDate.getDate() - dayOfWeek);

    const weeklyData = {};
    const selectStmt = db.prepare('SELECT timeInBed FROM sleep_logs WHERE user_id = ? AND dateOfSleep = ?');

    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(sunday);
      currentDay.setDate(sunday.getDate() + i);
      const dateString = currentDay.toISOString().split('T')[0];
      const row = selectStmt.get(userId, dateString);
      weeklyData[dateString] = row ? row.timeInBed : 0;
    }

    res.status(200).json(weeklyData);
  } catch (error) {
    console.error('Error fetching weekly sleep data from local DB:', error.message);
    res.status(500).json({ message: '週間の睡眠データの取得中にエラーが発生しました。' });
  }
});

// POST /api/fitbit/sleep/sync - Fetches latest data from Fitbit and syncs to local DB
router.post('/sleep/sync', async (req, res) => {
  const userId = req.user.id; // Use database user ID
  const { fitbit_user_id } = req.user;

  try {
    const today = new Date().toISOString().split('T')[0];
    const syncUrl = `https://api.fitbit.com/1.2/user/${fitbit_user_id}/sleep/list.json?sort=desc&offset=0&limit=50&beforeDate=${today}`;
    const fitbitResponse = await fitbitApiRequest(syncUrl, req.user);
    const newLogs = fitbitResponse.data.sleep;

    if (newLogs && newLogs.length > 0) {
      const stmt = db.prepare(`INSERT OR IGNORE INTO sleep_logs 
        (logId, user_id, dateOfSleep, duration, efficiency, timeInBed, levels)
        VALUES (?, ?, ?, ?, ?, ?, ?)`);

      for (const log of newLogs) {
        stmt.run(log.logId, userId, log.dateOfSleep, log.duration, log.efficiency, log.timeInBed, JSON.stringify(log.levels));
      }

      console.log(`Synced ${newLogs.length} sleep logs.`);
      res.status(200).json({ message: `Synced ${newLogs.length} sleep logs.` });
    } else {
      res.status(200).json({ message: 'No new sleep logs to sync.' });
    }
  } catch (error) {
    console.error('Error during Fitbit sync:', error.message);
    res.status(500).json({ message: 'Fitbitとのデータ同期中にエラーが発生しました。' });
  }
});

// POST /api/fitbit/sleep/analyze-cycle - Analyzes sleep data from local DB
router.post('/sleep/analyze-cycle', async (req, res) => {
  const userId = req.user.id; // Use database user ID
  const { bedtime } = req.body;

  if (!bedtime) {
    return res.status(400).json({ message: '就寝時刻が必要です。' });
  }

  try {
    // Get all logs for the user from our local database using sync API
    const stmt = db.prepare('SELECT * FROM sleep_logs WHERE user_id = ?');
    const rows = stmt.all(userId);
    const allUserLogs = rows.map(row => ({ ...row, levels: JSON.parse(row.levels) }));

    if (allUserLogs.length === 0) {
      return res.status(404).json({ message: 'ローカルに分析対象の睡眠データがありません。まずFitbitと同期してください。' });
    }

    // Send all logs to Python for analysis
    const pythonResponse = await axios.post('http://localhost:8000/analyze-sleep-cycle', {
      sleep_logs: allUserLogs,
      bedtime: bedtime
    });

    // Save the calculated intervals to the database
    const { cycle_durations_list } = pythonResponse.data;
    if (cycle_durations_list) {
      const insertStmt = db.prepare(`INSERT OR IGNORE INTO rem_cycle_intervals (user_id, sleep_log_id, dateOfSleep, interval_minutes, calculated_at) VALUES (?, ?, ?, ?, ?)`);
      const now = new Date();
      const formattedNow = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      const logMap = new Map(allUserLogs.map(log => [log.logId, log.dateOfSleep]));

      for (const interval of cycle_durations_list) {
        const dateOfSleep = logMap.get(interval.logId) || 'N/A';
        insertStmt.run(userId, interval.logId, dateOfSleep, interval.duration, formattedNow);
      }
    }

    res.status(200).json(pythonResponse.data);

  } catch (error) {
    console.error('Error during sleep cycle analysis:', error.message);
    res.status(500).json({ message: '睡眠サイクルの分析中にエラーが発生しました。', details: error.message });
  }
});


// POST /api/fitbit/heartrate/fetch-range - Fetches HR data for a specific time range.
router.post('/heartrate/fetch-range', async (req, res) => {
  const { minutes_ago } = req.body;

  if (typeof minutes_ago !== 'number' || minutes_ago < 0) {
    return res.status(400).json({ message: 'A non-negative number for minutes_ago is required.' });
  }

  try {
    const now = new Date();
    const endDate = new Date(now.getTime() - minutes_ago * 60 * 1000);
    const startDate = new Date(endDate.getTime() - 4 * 60 * 1000);

    const formatDate = (d) => {
      const year = d.getFullYear();
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const formatTime = (d) => d.toTimeString().split(' ')[0];

    const date = formatDate(startDate);
    // If the 4-minute range spans across midnight, we need to handle it.
    // For simplicity, this example assumes the range is on the same day.
    if (formatDate(endDate) !== date) {
      // More complex logic would be needed here to fetch from two different dates.
      // For now, we will just use the start date. A production app should handle this.
      console.warn("Heart rate fetch range spans across midnight. Fetching only for the start date.");
    }

    const startTime = formatTime(startDate);
    const endTime = formatTime(endDate);

    const fitbitApiUrl = `https://api.fitbit.com/1/user/${req.user.fitbit_user_id}/activities/heart/date/${date}/1d/1sec/time/${startTime}/${endTime}.json`;

    const response = await fitbitApiRequest(fitbitApiUrl, req.user);
    res.status(200).json(response.data);

  } catch (error) {
    console.error('Error fetching ranged heart rate data:', error.response ? error.response.data.errors : error.message);
    res.status(500).json({ message: 'Failed to fetch ranged heart rate data from Fitbit.', details: error.message });
  }
});

// POST /api/fitbit/heartrate/calculate-awakening-index - Forwards HR data to Python for full analysis
router.post('/heartrate/calculate-awakening-index', async (req, res) => {
  const { hr_dataset } = req.body;

  if (!hr_dataset) {
    return res.status(400).json({ message: 'hr_dataset is required.' });
  }

  try {
    // Forward the data to the Python backend for analysis
    const pythonResponse = await axios.post('http://localhost:8000/analyze-awakening', {
      hr_dataset: hr_dataset,
    });

    // Return the result from the Python backend to the client
    res.status(200).json(pythonResponse.data);

  } catch (error) {
    console.error('Error forwarding HR data to Python for awakening analysis:', error.message);
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ message: 'Failed to analyze awakening data with Python backend.' });
  }
});

// --- Get HRV (Heart Rate Variability) data ---
router.get('/hrv/:date', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { date } = req.params; // Format: YYYY-MM-DD

  const userStmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const user = userStmt.get(userId);

  if (!user || !user.fitbit_access_token) {
    return res.status(400).json({ message: 'Fitbit not connected. Please connect your Fitbit account first.' });
  }

  try {
    // Get HRV summary for the date
    const hrvSummaryUrl = `https://api.fitbit.com/1/user/-/hrv/date/${date}.json`;
    const hrvSummaryResponse = await fitbitApiRequest(hrvSummaryUrl, user);

    console.log('[HRV] Summary data:', JSON.stringify(hrvSummaryResponse.data, null, 2));

    res.status(200).json({
      date: date,
      hrv_summary: hrvSummaryResponse.data
    });

  } catch (error) {
    console.error('Error fetching HRV data:', error.message);
    if (error.response) {
      console.error('Fitbit API error:', error.response.data);
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ message: 'Failed to fetch HRV data from Fitbit.' });
  }
});

// --- Get HRV Intraday data (all HRV data for a specific date) ---
router.get('/hrv-intraday/:date', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { date } = req.params; // Format: YYYY-MM-DD

  const userStmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const user = userStmt.get(userId);

  if (!user || !user.fitbit_access_token) {
    return res.status(400).json({ message: 'Fitbit not connected. Please connect your Fitbit account first.' });
  }

  try {
    // Try HRV Intraday endpoint (requires special OAuth scope)
    const hrvIntradayUrl = `https://api.fitbit.com/1/user/-/hrv/date/${date}/all.json`;
    console.log('[HRV Intraday] Requesting URL:', hrvIntradayUrl);

    const hrvIntradayResponse = await fitbitApiRequest(hrvIntradayUrl, user);

    console.log('[HRV Intraday] Full data:', JSON.stringify(hrvIntradayResponse.data, null, 2));

    // Extract the intraday data
    const hrvData = hrvIntradayResponse.data.hrv || [];

    res.status(200).json({
      date: date,
      hrv_data: hrvData,
      data_points: hrvData.length,
      note: 'HRVデータは睡眠中のみ記録されます。Intraday APIには特別な権限が必要な場合があります。'
    });

  } catch (error) {
    console.error('Error fetching HRV intraday data:', error.message);
    if (error.response) {
      console.error('Fitbit API error:', error.response.status, error.response.data);

      // If intraday fails (403/404), try summary endpoint instead
      if (error.response.status === 403 || error.response.status === 404) {
        console.log('[HRV] Intraday not available, trying summary endpoint...');
        try {
          const hrvSummaryUrl = `https://api.fitbit.com/1/user/-/hrv/date/${date}.json`;
          const summaryResponse = await fitbitApiRequest(hrvSummaryUrl, user);

          return res.status(200).json({
            date: date,
            hrv_summary: summaryResponse.data,
            note: 'Intraday HRVデータは利用できません。サマリーデータを返しています。'
          });
        } catch (summaryError) {
          console.error('Summary endpoint also failed:', summaryError.message);
        }
      }

      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ message: 'Failed to fetch HRV data from Fitbit.' });
  }
});

// --- Get detailed intraday heart rate data ---
router.get('/heart-rate-detailed/:date', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { date } = req.params; // Format: YYYY-MM-DD
  const { startTime, endTime } = req.query; // Format: HH:mm

  const userStmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const user = userStmt.get(userId);

  if (!user || !user.fitbit_access_token) {
    return res.status(400).json({ message: 'Fitbit not connected. Please connect your Fitbit account first.' });
  }

  try {
    // Get intraday heart rate data with 1-minute detail level
    let intradayUrl = `https://api.fitbit.com/1/user/-/activities/heart/date/${date}/1d/1min.json`;

    // If time range is specified, add it to the URL
    if (startTime && endTime) {
      intradayUrl = `https://api.fitbit.com/1/user/-/activities/heart/date/${date}/1d/1min/time/${startTime}/${endTime}.json`;
    }

    const intradayResponse = await fitbitApiRequest(intradayUrl, user);

    console.log('[HR Intraday] Data points:', intradayResponse.data['activities-heart-intraday']?.dataset?.length || 0);

    res.status(200).json({
      date: date,
      time_range: { start: startTime || null, end: endTime || null },
      heart_rate_intraday: intradayResponse.data
    });

  } catch (error) {
    console.error('Error fetching detailed heart rate data:', error.message);
    if (error.response) {
      console.error('Fitbit API error:', error.response.data);
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ message: 'Failed to fetch detailed heart rate data from Fitbit.' });
  }
});

// --- Test endpoint: Get HRV and HR data around alarm time ---
router.get('/test-alarm-data/:date/:alarmTime', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { date, alarmTime } = req.params; // date: YYYY-MM-DD, alarmTime: HH:mm

  const userStmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const user = userStmt.get(userId);

  if (!user || !user.fitbit_access_token) {
    return res.status(400).json({ message: 'Fitbit not connected. Please connect your Fitbit account first.' });
  }

  try {
    // Calculate time range: 30 min before to 10 min after alarm
    const [alarmHour, alarmMin] = alarmTime.split(':').map(Number);
    const alarmDate = new Date(`${date}T${alarmTime}:00`);

    const startDate = new Date(alarmDate.getTime() - 30 * 60 * 1000); // 30 min before
    const endDate = new Date(alarmDate.getTime() + 10 * 60 * 1000); // 10 min after

    const startTime = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
    const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;

    // Get HRV data for the date
    const hrvUrl = `https://api.fitbit.com/1/user/-/hrv/date/${date}.json`;
    const hrvResponse = await fitbitApiRequest(hrvUrl, user);

    // Get detailed heart rate data around alarm time
    const hrUrl = `https://api.fitbit.com/1/user/-/activities/heart/date/${date}/1d/1min/time/${startTime}/${endTime}.json`;
    const hrResponse = await fitbitApiRequest(hrUrl, user);

    console.log('[TEST] HRV data:', JSON.stringify(hrvResponse.data, null, 2));
    console.log('[TEST] HR data points:', hrResponse.data['activities-heart-intraday']?.dataset?.length || 0);

    res.status(200).json({
      alarm_time: alarmTime,
      time_range: { start: startTime, end: endTime },
      hrv_data: hrvResponse.data,
      heart_rate_data: hrResponse.data,
      analysis: {
        hrv_available: !!hrvResponse.data.hrv,
        hr_data_points: hrResponse.data['activities-heart-intraday']?.dataset?.length || 0,
        note: 'HRV is only available during sleep. Heart rate data should be available throughout.'
      }
    });

  } catch (error) {
    console.error('Error in test endpoint:', error.message);
    if (error.response) {
      console.error('Fitbit API error:', error.response.data);
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ message: 'Failed to fetch test data from Fitbit.' });
  }
});

module.exports = router;

