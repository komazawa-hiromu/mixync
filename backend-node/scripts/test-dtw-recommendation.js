/**
 * DTW Recommendation System Test
 * 
 * This script simulates the pre-alarm process to test DTW recommendation
 */

const Database = require('better-sqlite3');
const axios = require('axios');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'biomixer.db');
const db = new Database(dbPath);

async function testDTWRecommendation() {
    console.log('🧪 Testing DTW Recommendation System...\n');

    try {
        // Get user
        const user = db.prepare('SELECT id FROM users LIMIT 1').get();
        if (!user) {
            console.error('❌ No user found');
            return;
        }

        console.log(`✅ User ID: ${user.id}\n`);

        // Get a sample current HR pattern (use one from existing events)
        const sampleEvent = db.prepare(`
      SELECT hr_pattern_before, alarm_time 
      FROM alarm_events 
      WHERE user_id = ? AND hr_pattern_before IS NOT NULL 
      LIMIT 1
    `).get(user.id);

        if (!sampleEvent) {
            console.error('❌ No events with HR data found');
            return;
        }

        const currentPattern = JSON.parse(sampleEvent.hr_pattern_before);
        console.log(`📊 Using sample HR pattern (${currentPattern.length} points)`);
        console.log(`   First 10 values: ${currentPattern.slice(0, 10).join(', ')}`);
        console.log(`   Sample from: ${sampleEvent.alarm_time}\n`);

        // Get all past events for comparison
        const pastEvents = db.prepare(`
      SELECT 
        id as event_id,
        hr_pattern_before,
        mixing_pattern,
        comfort_score
      FROM alarm_events
      WHERE user_id = ? 
        AND hr_pattern_before IS NOT NULL 
        AND comfort_score IS NOT NULL
      ORDER BY alarm_time DESC
    `).all(user.id);

        console.log(`📚 Found ${pastEvents.length} past events for comparison\n`);

        // Parse HR patterns
        const parsedEvents = pastEvents.map(e => ({
            event_id: e.event_id,
            hr_pattern_before: JSON.parse(e.hr_pattern_before),
            mixing_pattern: e.mixing_pattern,
            comfort_score: e.comfort_score
        }));

        // Call Python backend for DTW similarity calculation
        console.log('🔬 Calculating DTW similarities...\n');

        const dtwResponse = await axios.post('http://localhost:8000/calculate-dtw-similarity', {
            current_pattern: currentPattern,
            past_events: parsedEvents
        });

        const similarities = dtwResponse.data.similarities;

        console.log('📈 Top 5 Similar Events:');
        console.log('─'.repeat(70));
        similarities.slice(0, 5).forEach((s, i) => {
            console.log(`${i + 1}. Event #${s.event_id} | Similarity: ${s.similarity.toFixed(4)} | Mixing: ${s.mixing_pattern} | Comfort: ${s.comfort_score?.toFixed(1) || 'N/A'}`);
        });
        console.log('');

        // Call Python backend for mixing recommendation
        console.log('🤖 Getting AI recommendation...\n');

        const recommendResponse = await axios.post('http://localhost:8000/recommend-mixing', {
            current_pattern: currentPattern,
            past_events: parsedEvents
        });

        const recommendation = recommendResponse.data;

        console.log('🎯 Recommendation Result:');
        console.log('─'.repeat(70));
        console.log(`   Recommended Mixing: ${recommendation.recommended_mixing}`);
        console.log(`   Confidence: ${(recommendation.confidence * 100).toFixed(1)}%`);
        console.log(`   Similar Events Used: ${recommendation.similar_events_count}`);
        console.log('');

        if (recommendation.mixing_scores) {
            console.log('📊 Mixing Scores:');
            Object.entries(recommendation.mixing_scores).forEach(([mixing, data]) => {
                console.log(`   ${mixing}: Avg Comfort ${data.average_score.toFixed(1)} (${data.event_count} events)`);
            });
        }

        console.log('\n✅ DTW Recommendation System is working correctly!');
        console.log('\n💡 Next Steps:');
        console.log('   1. Set an alarm with AUTO mode');
        console.log('   2. Wait for 5 minutes before alarm');
        console.log('   3. System will automatically recommend the best mixing');
        console.log('   4. Alarm will ring with the recommended mixing pattern\n');

    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error('❌ Python backend is not running!');
            console.error('   Please start it with: cd backend-python && uvicorn main:app --reload\n');
        } else {
            console.error('❌ Error:', error.message);
            if (error.response) {
                console.error('   Response:', error.response.data);
            }
        }
    } finally {
        db.close();
    }
}

testDTWRecommendation();
