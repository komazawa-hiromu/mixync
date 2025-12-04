import React, { useState } from 'react';
import { API_BASE_URL } from '../config';
import { Paper, Box, Typography, TextField, Button, Alert } from '@mui/material';

// Helper function to get Authorization headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

function WakeupCalculator() {
  const [bedtime, setBedtime] = useState('00:00');
  const [recommendations, setRecommendations] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = async () => {
    setError('');
    setRecommendations(null);
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/fitbit/sleep/analyze-cycle`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ bedtime }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || '分析に失敗しました。');
      }
      setRecommendations(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mt: 3 }}>
      <Typography variant="h5" component="h3" gutterBottom>
        おすすめ起床時間
      </Typography>
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2">あなたの全睡眠データを分析し、あなたに最適化された起床時間を計算します。</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <TextField
          label="就寝時刻"
          type="time"
          value={bedtime}
          onChange={(e) => setBedtime(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <Button
          onClick={handleAnalyze}
          variant="contained"
          disabled={isLoading}
          sx={{
            color: 'white',
            borderRadius: '20px',
            background: 'linear-gradient(145deg, #50e3c2, #29b6f6)',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
            }
          }}
        >
          {isLoading ? '分析中...' : '睡眠サイクルを分析する'}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      {recommendations && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {recommendations.message}
          <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
            {recommendations.times.map(time => <li key={time}>{time}</li>)}
          </ul>
        </Alert>
      )}
    </Paper>
  );
}

export default WakeupCalculator;