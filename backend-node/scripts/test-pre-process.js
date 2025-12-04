const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'biomixer.db');
const db = new Database(dbPath);

async function testPreProcess() {
    console.log('🧪 Testing Pre-Process Endpoint\n');

    try {
        // 1. Get user with Fitbit token
        const userStmt = db.prepare('SELECT id, fitbit_access_token FROM users WHERE fitbit_access_token IS NOT NULL LIMIT 1');
        const user = userStmt.get();

        if (!user) {
            console.log('❌ No user with Fitbit token found');
            console.log('ℹ️  This is expected if you haven\'t connected Fitbit yet');
            console.log('ℹ️  The endpoint will return default mixing A\n');
            return;
        }

        console.log(`✅ Found user: ${user.id}`);

        // 2. Get an active alarm
        const alarmStmt = db.prepare('SELECT id FROM alarms WHERE user_id = ? AND is_active = 1 LIMIT 1');
        const alarm = alarmStmt.get(user.id);

        if (!alarm) {
            console.log('❌ No active alarm found for this user');
            console.log('ℹ️  Please create an alarm first\n');
            return;
        }

        console.log(`✅ Found alarm: ${alarm.id}\n`);

        // 3. Get JWT token (simplified - in real scenario, you'd login)
        console.log('📡 Calling pre-process endpoint...\n');

        // Note: This will fail with 401 without proper JWT token
        // But we can see if the endpoint exists and responds
        const response = await axios.post('http://localhost:3001/api/alarm/pre-process', {
            alarm_id: alarm.id
        }, {
            headers: {
                'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE'
            },
            validateStatus: () => true // Accept any status code
        });

        console.log(`Status: ${response.status}`);
        console.log('Response:', JSON.stringify(response.data, null, 2));

        if (response.status === 401) {
            console.log('\nℹ️  Got 401 Unauthorized - this is expected without JWT token');
            console.log('ℹ️  The endpoint exists and is responding correctly');
        } else if (response.status === 200) {
            console.log('\n✅ Pre-process completed successfully!');
            console.log(`Recommended mixing: ${response.data.recommended_mixing}`);
            console.log(`Confidence: ${response.data.confidence}`);
        }

    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log('❌ Server is not running');
            console.log('ℹ️  Please start the server with: npm start\n');
        } else {
            console.log('❌ Error:', error.message);
        }
    } finally {
        db.close();
    }
}

testPreProcess();
