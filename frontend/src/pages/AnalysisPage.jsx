import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Button, List, ListItem, ListItemText, Checkbox, IconButton, Paper, TextField, Alert, CircularProgress, Divider } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

import { API_BASE_URL } from '../config';

function AnalysisPage() {
  const [events, setEvents] = useState([]);
  const [checkedEvents, setCheckedEvents] = useState(new Set());
  const [minutesAgo, setMinutesAgo] = useState(10);
  const [localResult, setLocalResult] = useState(null); // For display-only results
  const [fetchedRawHrData, setFetchedRawHrData] = useState(null); // New state for raw HR data
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/events`, {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('アラームイベントの取得に失敗しました。');
      const data = await response.json();
      console.log("DEBUG: Data received from /api/events:", data);
      setEvents(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleCheckboxToggle = (eventId) => {
    const newChecked = new Set(checkedEvents);
    if (newChecked.has(eventId)) {
      newChecked.delete(eventId);
    } else {
      newChecked.add(eventId);
    }
    setCheckedEvents(newChecked);
  };

  const handleDelete = async (eventId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/events/${eventId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('イベントの削除に失敗しました。');
      fetchEvents(); // Refresh list after delete
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCalculate = async () => {
    setIsLoading(true);
    setError('');
    setLocalResult(null);
    setFetchedRawHrData(null); // Clear raw data display on new calculation

    try {
      // Step 1: Always perform the calculation based on the 'minutes ago' input
      const token = localStorage.getItem('token');
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
      if (!rawDataResponse.ok) throw new Error(rawData.message || '心拍数データの取得に失敗しました。');

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
      if (!analysisResponse.ok) throw new Error(resultData.message || '覚醒指数の計算に失敗しました。');

      const { awakening_hr_slope, awakening_hr_stddev } = resultData;

      // Step 2: Check if we need to save the results to the database
      if (checkedEvents.size > 0) {
        const response = await fetch(`${API_BASE_URL}/api/events/save-awakening-index`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include',
          body: JSON.stringify({
            event_ids: Array.from(checkedEvents),
            slope: awakening_hr_slope,
            stddev: awakening_hr_stddev
          }),
        });
        if (!response.ok) throw new Error('計算結果のデータベースへの保存に失敗しました。');
        setCheckedEvents(new Set()); // Clear checkboxes
        fetchEvents(); // Refresh list to show new data
      } else {
        // Or, just display the results locally
        setLocalResult(resultData);
        setFetchedRawHrData(rawData); // Display raw data only in display-only mode
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>覚醒指数分析</Typography>
      {error && <Alert severity="error" sx={{ my: 2 }}>{error}</Alert>}

      {/* Manual Calculation Area */}
      <Paper elevation={2} sx={{ p: 2, mb: 4 }}>
        <Typography variant="h6">手動分析 & 計算実行</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
          <TextField
            label="何分前のデータを分析するか"
            type="number"
            value={minutesAgo}
            onChange={(e) => setMinutesAgo(e.target.value)}
            sx={{ width: '250px' }}
          />
          <Button onClick={handleCalculate} variant="contained" disabled={isLoading}>
            {isLoading ? <CircularProgress size={24} /> : '覚醒指数を計算'}
          </Button>
        </Box>
        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
          チェックボックスをONにすると、計算結果がそのイベントに保存されます。OFFの場合は計算結果が下に表示されるだけです。
        </Typography>
        {localResult && (
          <Box sx={{ mt: 2, p: 2, border: '1px dashed grey', borderRadius: '4px' }}>
            <Typography variant="h6" gutterBottom>計算結果 (表示のみ)</Typography>
            <Typography>心拍数の上昇速度 (Slope): {localResult.awakening_hr_slope.toFixed(4)}</Typography>
            <Typography>心拍数の瞬間変動 (StdDev): {localResult.awakening_hr_stddev.toFixed(4)}</Typography>
          </Box>
        )}
        {fetchedRawHrData && checkedEvents.size === 0 && (
          <Box sx={{ mt: 2, p: 2, border: '1px dashed grey', borderRadius: '4px' }}>
            <Typography variant="h6" gutterBottom>取得した生心拍数データ</Typography>
            <pre style={{ maxHeight: '200px', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {JSON.stringify(fetchedRawHrData, null, 2)}
            </pre>
          </Box>
        )}
      </Paper>

      {/* Events List Area */}
      <Typography variant="h5" gutterBottom>アラームイベント履歴</Typography>
      <List>
        {events.map((event) => (
          <Paper key={event.id} sx={{ mb: 1 }}>
            <ListItem
              secondaryAction={
                <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(event.id)}>
                  <DeleteIcon />
                </IconButton>
              }
            >
              <Checkbox
                edge="start"
                checked={checkedEvents.has(event.id)}
                onChange={() => handleCheckboxToggle(event.id)}
              />
              <ListItemText
                primary={`アラーム時刻: ${new Date(event.rang_at_jp).toLocaleString('ja-JP')}`}
                secondary={event.awakening_hr_slope ? `Slope: ${event.awakening_hr_slope.toFixed(4)} / StdDev: ${event.awakening_hr_stddev.toFixed(4)}` : '未計算'}
              />
            </ListItem>
          </Paper>
        ))}
      </List>
    </Box>
  );
}

export default AnalysisPage;
