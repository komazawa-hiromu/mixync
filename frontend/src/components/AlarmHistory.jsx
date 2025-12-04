import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { Paper, Box, Typography, Button, Alert, List, ListItem, ListItemText, Chip, CircularProgress, FormControl, InputLabel, Select, MenuItem, IconButton } from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

function AlarmHistory() {
    const [events, setEvents] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [processingEventId, setProcessingEventId] = useState(null);
    const [sortBy, setSortBy] = useState('date');
    const [sortOrder, setSortOrder] = useState('desc');

    const fetchEvents = async () => {
        setError('');
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/events`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) throw new Error('アラーム履歴の取得に失敗しました。');
            const data = await response.json();
            console.log('Fetched alarm events:', data);
            setEvents(data);
        } catch (err) {
            setError(err.message);
        }
    };

    useEffect(() => { fetchEvents(); }, []);

    const handleCalculatePostProcess = async (eventId, alarmTime) => {
        setSuccess('');
        setError('');
        setProcessingEventId(eventId);

        try {
            const token = localStorage.getItem('token');

            // Call post-process API
            const response = await fetch(`${API_BASE_URL}/api/alarm/post-process`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ event_id: eventId }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || '心拍数データの計算に失敗しました。');
            }

            setSuccess(`起床後データの計算が完了しました（${data.data_points}データポイント、ピーク: ${data.hr_peak}bpm）`);

            // Refresh events
            await fetchEvents();

        } catch (err) {
            setError(err.message);
        } finally {
            setProcessingEventId(null);
        }
    };

    const canCalculate = (event) => {
        // Check if 20 minutes have passed since alarm
        if (!event.alarm_time) return false;

        const alarmTime = new Date(event.alarm_time);
        const now = new Date();
        const minutesPassed = (now - alarmTime) / (1000 * 60);

        // Must be at least 20 minutes after alarm
        // And post-process data should not already exist
        return minutesPassed >= 20 && !event.hr_peak;
    };

    const getTimeUntilCalculation = (event) => {
        if (!event.alarm_time) return '';

        const alarmTime = new Date(event.alarm_time);
        const now = new Date();
        const minutesPassed = (now - alarmTime) / (1000 * 60);

        if (minutesPassed < 20) {
            const remaining = Math.ceil(20 - minutesPassed);
            return `${remaining}分後に計算可能`;
        }

        return '計算可能';
    };

    const sortedEvents = [...events].sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
            case 'date':
                comparison = new Date(a.alarm_time) - new Date(b.alarm_time);
                break;
            case 'slope':
                comparison = (a.awakening_hr_slope || 0) - (b.awakening_hr_slope || 0);
                break;
            case 'comfort':
                comparison = (a.comfort_score || 0) - (b.comfort_score || 0);
                break;
            default:
                break;
        }
        return sortOrder === 'asc' ? comparison : -comparison;
    });

    return (
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h5">
                    アラーム履歴
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>並び替え</InputLabel>
                        <Select
                            value={sortBy}
                            label="並び替え"
                            onChange={(e) => setSortBy(e.target.value)}
                        >
                            <MenuItem value="date">日付</MenuItem>
                            <MenuItem value="slope">Slope</MenuItem>
                            <MenuItem value="comfort">快適度</MenuItem>
                        </Select>
                    </FormControl>
                    <IconButton onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
                        {sortOrder === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
                    </IconButton>
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

            {events.length === 0 ? (
                <Typography color="text.secondary">
                    アラーム履歴がありません
                </Typography>
            ) : (
                <Box sx={{ maxHeight: 400, overflow: 'auto', pr: 1 }}>
                    <List>
                        {sortedEvents.map((event) => (
                            <ListItem
                                key={event.id}
                                sx={{
                                    border: '1px solid #e0e0e0',
                                    borderRadius: 2,
                                    mb: 2,
                                    flexDirection: 'column',
                                    alignItems: 'flex-start'
                                }}
                            >
                                <Box sx={{ width: '100%', mb: 1 }}>
                                    <Typography variant="subtitle1" fontWeight="bold">
                                        イベント #{event.id}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        アラーム時刻: {event.alarm_time ? new Date(event.alarm_time).toLocaleString('ja-JP') : '未設定'}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        ミキシング: {event.mixing_pattern || '未設定'}
                                    </Typography>
                                </Box>

                                <Box sx={{ width: '100%', display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                                    {event.hr_avg_before && (
                                        <Chip
                                            label={`起床前平均: ${event.hr_avg_before.toFixed(1)}bpm`}
                                            size="small"
                                            color="primary"
                                            variant="outlined"
                                        />
                                    )}
                                    {event.hr_peak && (
                                        <Chip
                                            label={`ピーク: ${event.hr_peak}bpm`}
                                            size="small"
                                            color="secondary"
                                            variant="outlined"
                                        />
                                    )}
                                    {event.awakening_hr_slope && (
                                        <Chip
                                            label={`Slope: ${event.awakening_hr_slope.toFixed(2)}`}
                                            size="small"
                                            color="success"
                                            variant="outlined"
                                        />
                                    )}
                                    {event.comfort_score && (
                                        <Chip
                                            label={`快適度: ${event.comfort_score.toFixed(1)}`}
                                            size="small"
                                            color="info"
                                            variant="outlined"
                                        />
                                    )}
                                </Box>

                                {canCalculate(event) ? (
                                    <Button
                                        variant="contained"
                                        size="small"
                                        startIcon={processingEventId === event.id ? <CircularProgress size={16} /> : <CalculateIcon />}
                                        onClick={() => handleCalculatePostProcess(event.id, event.alarm_time)}
                                        disabled={processingEventId === event.id}
                                        sx={{
                                            background: 'linear-gradient(145deg, #50e3c2, #29b6f6)',
                                            color: 'white'
                                        }}
                                    >
                                        {processingEventId === event.id ? '計算中...' : '今日のデータを計算'}
                                    </Button>
                                ) : event.hr_peak ? (
                                    <Chip
                                        icon={<CheckCircleIcon />}
                                        label="計算済み"
                                        size="small"
                                        color="success"
                                    />
                                ) : (
                                    <Typography variant="caption" color="text.secondary">
                                        {getTimeUntilCalculation(event)}
                                    </Typography>
                                )}
                            </ListItem>
                        ))}
                    </List>
                </Box>
            )}

            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
                ※ Fitbit APIの15分のタイムラグがあるため、アラームから20分後以降に計算可能になります
            </Typography>
        </Paper>
    );
}

export default AlarmHistory;