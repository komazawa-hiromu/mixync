import React, { useState } from 'react';
import { Paper, Box, Typography, TextField, Button, Alert, CircularProgress } from '@mui/material';

import { API_BASE_URL } from '../config';

function HeartRateAnalyzer() {
  const [minutesAgo, setMinutesAgo] = useState(10);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFetchAndAnalyze = async () => {
    setError('');
    setAnalysisResult(null);
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');

      // Step 1: Fetch the raw heart rate data from Fitbit
      const rawDataResponse = await fetch(`${API_BASE_URL}/api/fitbit/heartrate/fetch-range`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({ minutes_ago: parseInt(minutesAgo, 10) }),
      });
      const rawData = await rawDataResponse.json();
      if (!rawDataResponse.ok) {
        throw new Error(rawData.message || '心拍数データの取得に失敗しました。');
      }

      // Step 2: Send the raw data to the backend for full analysis
      const analysisResponse = await fetch(`${API_BASE_URL}/api/fitbit/heartrate/calculate-awakening-index`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({ hr_dataset: rawData }),
      });
      const resultData = await analysisResponse.json();
      if (!analysisResponse.ok) {
        throw new Error(resultData.message || '覚醒指数の計算に失敗しました。');
      }

      setAnalysisResult(resultData);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mt: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <TextField
          label="何分前"
          type="number"
          value={minutesAgo}
          onChange={(e) => setMinutesAgo(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ width: '150px' }}
        />
        <Button
          onClick={handleFetchAndAnalyze}
          variant="contained"
          disabled={isLoading}
        >
          {isLoading ? <CircularProgress size={24} /> : '覚醒指数を計算'}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      {analysisResult && (
        <Paper variant="outlined" sx={{ p: 2, mt: 2, backgroundColor: '#f5f5f5' }}>
          <Typography variant="h6" gutterBottom>計算結果</Typography>
          <Typography>
            心拍数の上昇速度 (Slope): {analysisResult.awakening_hr_slope.toFixed(4)}
          </Typography>
          <Typography>
            心拍数の瞬間変動 (StdDev): {analysisResult.awakening_hr_stddev.toFixed(4)}
          </Typography>
        </Paper>
      )}
    </Paper>
  );
}

export default HeartRateAnalyzer;
