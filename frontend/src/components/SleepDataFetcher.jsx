import React, { useState } from 'react';
import { Paper, Box, Typography, TextField, Button, Alert } from '@mui/material';

function SleepDataFetcher() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [sleepData, setSleepData] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [processingResult, setProcessingResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioSrc, setAudioSrc] = useState(null);

  const handleFetchSleepData = async () => {
    setIsLoading(true);
    setError('');
    setSleepData(null);
    setProcessingResult(null);
    setAudioSrc(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/fitbit/sleep/${date}`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || '睡眠データの取得に失敗しました。');
      }
      const data = await response.json();
      setSleepData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessData = async () => {
    if (!sleepData) return;
    setIsProcessing(true);
    setError('');
    setProcessingResult(null);
    setAudioSrc(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/fitbit/process/sleep', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify(sleepData),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'データの処理に失敗しました。');
      }
      const data = await response.json();
      setProcessingResult(data);

      if (data && data.audio_data_base64) {
        const audioDataUrl = `data:audio/${data.audio_format};base64,${data.audio_data_base64}`;
        setAudioSrc(audioDataUrl);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mt: 3 }}>
      <Typography variant="h5" component="h3" gutterBottom>
        睡眠データを取得・処理
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <TextField
          label="日付"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <Button onClick={handleFetchSleepData} variant="contained" disabled={isLoading}>
          {isLoading ? '取得中...' : '1. 睡眠データを取得'}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      {sleepData && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6">取得した睡眠データ ({date})</Typography>
          <Paper variant="outlined" sx={{ p: 2, my: 1, maxHeight: 300, overflow: 'auto' }}>
            <pre>{JSON.stringify(sleepData, null, 2)}</pre>
          </Paper>
          <Button onClick={handleProcessData} variant="contained" color="secondary" disabled={isProcessing}>
            {isProcessing ? '処理中...' : '2. Pythonでデータを処理'}
          </Button>
        </Box>
      )}

      {processingResult && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6">Pythonからの処理結果</Typography>
          <Paper variant="outlined" sx={{ p: 2, my: 1, maxHeight: 300, overflow: 'auto' }}>
            <pre>{JSON.stringify({ ...processingResult, audio_data_base64: '...' }, null, 2)}</pre>
          </Paper>

          {audioSrc && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6">生成されたアラーム</Typography>
              <audio controls src={audioSrc}>
                お使いのブラウザは音声再生に対応していません。
              </audio>
            </Box>
          )}
        </Box>
      )}
    </Paper>
  );
}

export default SleepDataFetcher;