import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, WS_BASE_URL } from '../config';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

// MUI Imports
import { Paper, Box, Typography, Button } from '@mui/material';

// Component Imports
import WakeupCalculator from '../components/WakeupCalculator';
import AlarmManager from '../components/AlarmManager';
import SleepChart from '../components/SleepChart';
import RingingAlarmModal from '../components/RingingAlarmModal';
import DataVisualization from '../components/DataVisualization';
import AlarmHistory from '../components/AlarmHistory';

function HomePage() {
  const { user, isAuthenticated, loading, getToken } = useAuth();
  const [ringingAlarm, setRingingAlarm] = useState(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      const ws = new WebSocket(WS_BASE_URL);
      ws.onopen = () => console.log('WebSocket connection established');
      ws.onclose = () => console.log('WebSocket connection closed');
      ws.onerror = (error) => console.error('WebSocket Error:', error);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Received WebSocket message:', data);
          if (data.type === 'RING_ALARM' && data.alarm.user_id === user.id) {
            setRingingAlarm(data.alarm);
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };
      return () => ws.close();
    }
  }, [isAuthenticated, user]);

  if (loading) {
    return <Typography>読み込み中...</Typography>;
  }

  const handleStopAlarm = () => {
    setRingingAlarm(null);
  };

  const handleFitbitConnect = async () => {
    const token = getToken();
    const url = `${API_BASE_URL}/auth/fitbit?token=${token}`;

    console.log('[Fitbit Connect] Navigating to:', url);
    console.log('[Fitbit Connect] Is native platform:', Capacitor.isNativePlatform());

    if (Capacitor.isNativePlatform()) {
      console.log('[Fitbit Connect] Opening external browser');
      await Browser.open({ url });
    } else {
      console.log('[Fitbit Connect] Using window.location.assign');
      window.location.assign(url);
    }
  };

  const handleFitbitClear = async () => {
    const token = getToken();
    const url = `${API_BASE_URL}/auth/clear-fitbit?token=${token}`;

    console.log('[Fitbit Clear] Navigating to:', url);
    console.log('[Fitbit Clear] Is native platform:', Capacitor.isNativePlatform());

    if (Capacitor.isNativePlatform()) {
      console.log('[Fitbit Clear] Opening external browser');
      await Browser.open({ url });
    } else {
      console.log('[Fitbit Clear] Using window.location.assign');
      window.location.assign(url);
    }
  };

  const renderUserContent = () => {
    if (!user) return null;
    return (
      <Box>
        <Typography>こんにちは, {user.email} さん。</Typography>
        <WakeupCalculator />
        <AlarmManager />
        <DataVisualization />
        <AlarmHistory />
        <SleepChart />
        {user.fitbit_user_id ? (
          <>
            <Paper elevation={2} sx={{ p: 2, mt: 4, backgroundColor: '#fff0f0' }}>
              <Typography variant="h6" color="error">デバッグ用オプション</Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>Fitbitとの連携で問題が発生した場合、以下のボタンで連携情報をリセットできます。</Typography>
              <Button
                variant="contained"
                color="error"
                onClick={handleFitbitClear}
              >
                Fitbit連携をリセット
              </Button>
            </Paper>
          </>
        ) : (
          <Paper elevation={2} sx={{ p: 3, mt: 3, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>Fitbitアカウントを連携してください。</Typography>
            <Button variant="contained" onClick={handleFitbitConnect}>
              Fitbitと連携
            </Button>
          </Paper>
        )}
      </Box>
    );
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        ようこそ！
      </Typography>
      {isAuthenticated ? renderUserContent() : (
        <Typography>ログインまたは新規登録をしてください。</Typography>
      )}
      <RingingAlarmModal
        alarm={ringingAlarm}
        onClose={handleStopAlarm}
      />
    </Box>
  );
}

export default HomePage;
