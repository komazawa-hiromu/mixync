import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { Paper, Box, Typography, Button, Alert } from '@mui/material';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Helper function to get Authorization headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

// Helper function to get the Sunday of a given date
const getSunday = (d) => {
  d = new Date(d);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}

// Helper function to format decimal hours into 'X時間Y分'
const formatDuration = (decimalHours) => {
  if (typeof decimalHours !== 'number' || isNaN(decimalHours)) return '';
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}時間${minutes}分`;
};

function SleepChart() {
  const [chartData, setChartData] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchWeeklySleep = async (date) => {
    setIsLoading(true);
    setError('');
    setChartData(null);
    try {
      const dateString = date.toISOString().split('T')[0];
      const response = await fetch(`${API_BASE_URL}/api/fitbit/sleep/week/${dateString}`, {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('週間の睡眠データの取得に失敗しました。');
      const data = await response.json();

      const labels = Object.keys(data).sort();
      const values = labels.map(label => data[label] / 60); // Convert minutes to hours

      setChartData({
        labels: ['日', '月', '火', '水', '木', '金', '土'],
        datasets: [{
          label: '睡眠時間',
          data: values,
          backgroundColor: 'rgba(74, 144, 226, 0.6)',
          borderColor: 'rgba(74, 144, 226, 1)',
          borderWidth: 1,
        }],
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWeeklySleep(currentDate);
  }, [currentDate]);

  const handleSync = async () => {
    setIsSyncing(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/fitbit/sleep/sync`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error('Fitbitとの同期に失敗しました。');
      // After syncing, refresh the chart data for the current week
      fetchWeeklySleep(currentDate);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const changeWeek = (amount) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + amount * 7);
    setCurrentDate(newDate);
  };

  const getWeekRangeString = () => {
    const sunday = getSunday(currentDate);
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    return `${sunday.toLocaleDateString()} ～ ${saturday.toLocaleDateString()}`;
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: '週間睡眠時間' },
      tooltip: {
        callbacks: {
          label: function (context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += formatDuration(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: '睡眠時間' },
        ticks: {
          stepSize: 0.5, // Set step size to 0.5 hours
          callback: function (value) {
            // Only show whole hours as 'Xh'
            if (value % 1 === 0) {
              return `${value}h`;
            }
            return ''; // Hide fractional hour ticks
          }
        }
      }
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mt: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h3" gutterBottom>
          週間睡眠グラフ
        </Typography>
        <Button onClick={handleSync} variant="outlined" size="small" disabled={isSyncing}>
          {isSyncing ? '同期中...' : 'Fitbitと同期'}
        </Button>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Button onClick={() => changeWeek(-1)}>前の週</Button>
        <Typography>{getWeekRangeString()}</Typography>
        <Button onClick={() => changeWeek(1)}>次の週</Button>
      </Box>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {isLoading && <Typography>読み込み中...</Typography>}
      {chartData && <Bar data={chartData} options={chartOptions} />}
    </Paper>
  );
}

export default SleepChart;