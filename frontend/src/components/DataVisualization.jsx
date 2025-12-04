import React, { useState, useEffect } from 'react';
import { Paper, Box, Typography, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { Line, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import { API_BASE_URL } from '../config';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend
);

function DataVisualization() {
    const [events, setEvents] = useState([]);
    const [viewMode, setViewMode] = useState('slope'); // 'slope', 'mixing', 'comfort'

    useEffect(() => {
        fetchEvents();
    }, []);

    const fetchEvents = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/events`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) throw new Error('データの取得に失敗しました。');
            const data = await response.json();
            setEvents(data.filter(e => e.comfort_score !== null)); // Only events with complete data
        } catch (err) {
            console.error('Error fetching events:', err);
        }
    };

    // Prepare data for slope graph
    const slopeChartData = {
        labels: events
            .filter(e => e.awakening_hr_slope !== null)
            .map(e => new Date(e.alarm_time).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }))
            .reverse(),
        datasets: [{
            label: '覚醒速度 (bpm/sec)',
            data: events
                .filter(e => e.awakening_hr_slope !== null)
                .map(e => parseFloat(e.awakening_hr_slope?.toFixed(3) || 0))
                .reverse(),
            borderColor: '#29b6f6',
            backgroundColor: 'rgba(41, 182, 246, 0.1)',
            tension: 0.4
        }]
    };

    // Prepare data for mixing comparison
    const mixingStats = ['A', 'B', 'C'].map(mixing => {
        const mixingEvents = events.filter(e => e.mixing_pattern === mixing && e.comfort_score !== null);
        const avgComfort = mixingEvents.length > 0
            ? mixingEvents.reduce((sum, e) => sum + e.comfort_score, 0) / mixingEvents.length
            : 0;
        const avgSlope = mixingEvents.length > 0
            ? mixingEvents.reduce((sum, e) => sum + (e.awakening_hr_slope || 0), 0) / mixingEvents.length
            : 0;

        return {
            mixing,
            comfort: parseFloat(avgComfort.toFixed(1)),
            slope: parseFloat(avgSlope.toFixed(3)),
            count: mixingEvents.length
        };
    });

    const mixingChartData = {
        labels: mixingStats.map(m => `ミキシング ${m.mixing}`),
        datasets: [
            {
                label: '平均快適度',
                data: mixingStats.map(m => m.comfort),
                backgroundColor: '#50e3c2',
                yAxisID: 'y'
            },
            {
                label: '平均Slope',
                data: mixingStats.map(m => m.slope * 100), // Scale for visibility
                backgroundColor: '#ab47bc',
                yAxisID: 'y1'
            }
        ]
    };

    // Prepare data for comfort score trend
    const comfortChartData = {
        labels: events
            .filter(e => e.comfort_score !== null)
            .map(e => new Date(e.alarm_time).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }))
            .reverse(),
        datasets: [{
            label: '快適度スコア',
            data: events
                .filter(e => e.comfort_score !== null)
                .map(e => parseFloat(e.comfort_score?.toFixed(1) || 0))
                .reverse(),
            borderColor: '#50e3c2',
            backgroundColor: 'rgba(80, 227, 194, 0.1)',
            tension: 0.4
        }]
    };

    const lineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top'
            }
        },
        scales: {
            y: {
                beginAtZero: true
            }
        }
    };

    const barOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top'
            }
        },
        scales: {
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                    display: true,
                    text: '快適度'
                }
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: {
                    display: true,
                    text: 'Slope (×100)'
                },
                grid: {
                    drawOnChartArea: false
                }
            }
        }
    };

    return (
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5">
                    データ可視化
                </Typography>
                <FormControl sx={{ minWidth: 200 }}>
                    <InputLabel>表示モード</InputLabel>
                    <Select
                        value={viewMode}
                        label="表示モード"
                        onChange={(e) => setViewMode(e.target.value)}
                    >
                        <MenuItem value="slope">覚醒速度（Slope）</MenuItem>
                        <MenuItem value="mixing">ミキシング比較</MenuItem>
                        <MenuItem value="comfort">快適度推移</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            {events.length === 0 ? (
                <Typography color="text.secondary">
                    データがまだありません。アラームを使用してデータを収集してください。
                </Typography>
            ) : (
                <>
                    {viewMode === 'slope' && (
                        <Box>
                            <Typography variant="h6" gutterBottom>
                                覚醒速度（Awakening HR Slope）の推移
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                                低い値ほど穏やかな目覚めを示します
                            </Typography>
                            <Box sx={{ height: 300 }}>
                                <Line data={slopeChartData} options={lineOptions} />
                            </Box>
                        </Box>
                    )}

                    {viewMode === 'mixing' && (
                        <Box>
                            <Typography variant="h6" gutterBottom>
                                ミキシングパターン別の比較
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                                各ミキシングの平均快適度とSlope
                            </Typography>
                            <Box sx={{ height: 300 }}>
                                <Bar data={mixingChartData} options={barOptions} />
                            </Box>
                            <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'center' }}>
                                {mixingStats.map(m => (
                                    <Typography key={m.mixing} variant="caption" color="text.secondary">
                                        ミキシング {m.mixing}: {m.count}回
                                    </Typography>
                                ))}
                            </Box>
                        </Box>
                    )}

                    {viewMode === 'comfort' && (
                        <Box>
                            <Typography variant="h6" gutterBottom>
                                快適度スコアの推移
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                                高い値ほど快適な目覚めを示します（最大100点）
                            </Typography>
                            <Box sx={{ height: 300 }}>
                                <Line data={comfortChartData} options={lineOptions} />
                            </Box>
                        </Box>
                    )}
                </>
            )}
        </Paper>
    );
}

export default DataVisualization;
