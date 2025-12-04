const { db } = require('./database');
const axios = require('axios');

// --- Fitbit API Helpers ---

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

    // Use better-sqlite3 sync API to update the tokens
    const stmt = db.prepare('UPDATE users SET fitbit_access_token = ?, fitbit_refresh_token = ? WHERE id = ?');
    stmt.run(access_token, refresh_token, user.id);
    console.log('Successfully updated Fitbit tokens for user:', user.id);

    return access_token; // Return the new access token

  } catch (error) {
    console.error('Error refreshing Fitbit token:', error.response ? error.response.data : error.message);
    throw new Error('Could not refresh Fitbit token.');
  }
};

const fitbitApiRequest = async (url, user, retries = 1) => {
  console.log('Making Fitbit API request to:', url);
  try {
    const response = await axios.get(url, { headers: { 'Authorization': `Bearer ${user.fitbit_access_token}` } });
    return response;
  } catch (error) {
    if (error.response && error.response.status === 401 && retries > 0) {
      console.log('Access token expired. Attempting to refresh...');
      const newAccessToken = await refreshFitbitToken(user);
      const updatedUser = { ...user, fitbit_access_token: newAccessToken };
      return fitbitApiRequest(url, updatedUser, retries - 1);
    }
    if (error.response && error.response.status === 429 && retries > 0) {
      console.log('Rate limited. Waiting 1 second before retrying...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fitbitApiRequest(url, user, retries - 1);
    }
    throw error;
  }
};

module.exports = {
  refreshFitbitToken,
  fitbitApiRequest
};