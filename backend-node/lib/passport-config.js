const LocalStrategy = require('passport-local').Strategy;
const FitbitOAuth2Strategy = require('passport-fitbit-oauth2').FitbitOAuth2Strategy;
const bcrypt = require('bcrypt');
const { db } = require('./database');

function initialize(passport) {
  const authenticateUser = async (email, password, done) => {
    try {
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

      if (!user) {
        return done(null, false, { message: 'No user with that email' });
      }

      const match = await bcrypt.compare(password, user.password);

      if (match) {
        return done(null, user);
      } else {
        return done(null, false, { message: 'Password incorrect' });
      }
    } catch (error) {
      return done(error);
    }
  };

  passport.use(new LocalStrategy({ usernameField: 'email' }, authenticateUser));

  passport.use(new FitbitOAuth2Strategy({
    clientID: process.env.FITBIT_CLIENT_ID,
    clientSecret: process.env.FITBIT_CLIENT_SECRET,
    callbackURL: `https://${process.env.PC_IP_ADDRESS}/auth/fitbit/callback`,
    scope: ['activity', 'heartrate', 'location', 'nutrition', 'profile', 'settings', 'sleep', 'social', 'weight', 'oxygen_saturation', 'respiratory_rate', 'temperature'],
    passReqToCallback: true
  },
    (req, accessToken, refreshToken, profile, done) => {
      console.log('[FITBIT] OAuth callback received');
      console.log('[FITBIT] Query params:', req.query);

      let userId;

      try {
        // Decode state parameter to get user ID
        if (req.query.state) {
          const stateData = JSON.parse(Buffer.from(req.query.state, 'base64').toString());
          userId = stateData.userId;
          console.log('[FITBIT] User ID from state:', userId);
        }
      } catch (error) {
        console.error('[FITBIT] Error decoding state:', error);
      }

      // Fallback to session if state is not available
      if (!userId && req.session?.userId) {
        userId = req.session.userId;
        console.log('[FITBIT] User ID from session:', userId);
      }

      if (!userId) {
        console.error('[FITBIT] No userId found in state or session');
        return done(new Error('User ID not found'));
      }

      console.log('[FITBIT] Profile ID:', profile.id);

      try {
        const stmt = db.prepare(`UPDATE users SET 
        fitbit_access_token = ?,
        fitbit_refresh_token = ?,
        fitbit_user_id = ?
        WHERE id = ?`);

        stmt.run(accessToken, refreshToken, profile.id, userId);

        console.log('[FITBIT] Successfully updated user with Fitbit data');

        // Fetch the updated user
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
        return done(null, user);
      } catch (error) {
        console.error('[FITBIT] Database error:', error);
        return done(error);
      }
    }));

  passport.serializeUser((user, done) => done(null, user.id));

  passport.deserializeUser((id, done) => {
    try {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      return done(null, user);
    } catch (error) {
      return done(error);
    }
  });
}

module.exports = initialize;
