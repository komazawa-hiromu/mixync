import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Paper, CircularProgress } from '@mui/material';
import { API_BASE_URL } from '../config';

function HRVTestPage() {
    const [date, setDate] = useState('2025-11-28');
    const [loading, setLoading] = useState(false);
    const [hrvData, setHrvData] = useState(null);
    const [hrData, setHrData] = useState(null);
    const [error, setError] = useState(null);

    const fetchHRVData = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/fitbit/hrv-intraday/${date}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setHrvData(data);
            console.log('HRV Data:', data);
        } catch (err) {
            setError(err.message);
            console.error('Error fetching HRV data:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchHeartRateData = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/fitbit/heart-rate-detailed/${date}?startTime=06:00&endTime=08:00`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            setHrData(data);
            console.log('Heart Rate Data:', data);
        } catch (err) {
            setError(err.message);
            console.error('Error fetching heart rate data:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                HRV・心拍数データテスト
            </Typography>

            <Paper sx={{ p: 3, mb: 3 }}>
                <TextField
                    label="日付"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    sx={{ mb: 2, width: '100%' }}
                    InputLabelProps={{ shrink: true }}
                />

                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="contained"
                        onClick={fetchHRVData}
                        disabled={loading}
                    >
                        HRVデータ取得
                    </Button>

                    <Button
                        variant="contained"
                        color="secondary"
                        onClick={fetchHeartRateData}
                        disabled={loading}
                    >
                        心拍数データ取得（6:00-8:00）
                    </Button>
                </Box>

                {loading && <CircularProgress sx={{ mt: 2 }} />}
                {error && (
                    <Typography color="error" sx={{ mt: 2 }}>
                        エラー: {error}
                    </Typography>
                )}
            </Paper>

            {hrvData && (
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        HRVデータ結果
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                        データポイント数: {hrvData.data_points}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        {hrvData.note}
                    </Typography>
                    <Box sx={{ mt: 2, maxHeight: 400, overflow: 'auto' }}>
                        <pre>{JSON.stringify(hrvData, null, 2)}</pre>
                    </Box>
                </Paper>
            )}

            {hrData && (
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        心拍数データ結果
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                        データポイント数: {hrData.heart_rate_intraday?.['activities-heart-intraday']?.dataset?.length || 0}
                    </Typography>
                    <Box sx={{ mt: 2, maxHeight: 400, overflow: 'auto' }}>
                        <pre>{JSON.stringify(hrData, null, 2)}</pre>
                    </Box>
                </Paper>
            )}
        </Box>
    );
}

export default HRVTestPage;
