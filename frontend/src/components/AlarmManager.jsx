import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { Paper, Box, Typography, Button, Alert, List, ListItem, ListItemText, IconButton, Switch } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import AlarmSettingModal from './AlarmSettingModal';

// Helper function to get Authorization headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

function AlarmManager() {
  const [alarms, setAlarms] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState(null);
  const [audioFiles, setAudioFiles] = useState([]);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setError('');
    try {
      const [alarmsRes, audioRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/alarms`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE_URL}/api/audio/files`, { headers: getAuthHeaders() })
      ]);
      if (!alarmsRes.ok) throw new Error('アラームの取得に失敗しました。');
      if (!audioRes.ok) throw new Error('音声ファイルの取得に失敗しました。');
      const alarmsData = await alarmsRes.json();
      const audioData = await audioRes.json();
      setAlarms(alarmsData);
      setAudioFiles(audioData);
    } catch (err) { setError(err.message); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveAlarm = async (alarmToSave) => {
    setError('');
    const isEditing = !!alarmToSave.id;
    const url = isEditing ? `${API_BASE_URL}/api/alarms/${alarmToSave.id}` : `${API_BASE_URL}/api/alarms`;
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: getAuthHeaders(),
        body: JSON.stringify(alarmToSave),
      });
      if (!response.ok) { throw new Error(isEditing ? 'アラームの更新に失敗しました。' : 'アラームの保存に失敗しました。'); }
      fetchData(); // Refresh the list
    } catch (err) { setError(err.message); }
  };

  const handleDeleteAlarm = async (id) => {
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/alarms/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!response.ok) { throw new Error('アラームの削除に失敗しました。'); }
      fetchData(); // Refresh the list
    } catch (err) { setError(err.message); }
  };

  const handleToggleAlarm = async (alarm) => {
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/alarms/${alarm.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_active: alarm.is_active ? 0 : 1 }),
      });
      if (!response.ok) { throw new Error('アラームの状態更新に失敗しました。'); }
      fetchData(); // Refresh the list
    } catch (err) { setError(err.message); }
  };

  const formatDaysOfWeek = (days) => {
    if (!days) return '繰り返しなし';
    if (days === '0,1,2,3,4,5,6') return '毎日';
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    return days.split(',').map(day => dayNames[parseInt(day)]).join(', ');
  };

  const handleOpenModal = (alarm = null) => {
    setEditingAlarm(alarm);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAlarm(null);
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mt: 3 }}>
      <Typography variant="h5" component="h3" gutterBottom>アラーム管理</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box>
        {alarms.length === 0 ? (
          <Typography>現在設定されているアラームはありません。</Typography>
        ) : (
          <List>
            {alarms.map((alarm) => (
              <ListItem
                key={alarm.id}
                secondaryAction={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Switch
                      edge="end"
                      onChange={() => handleToggleAlarm(alarm)}
                      checked={alarm.is_active === 1}
                    />
                    <IconButton edge="end" aria-label="edit" onClick={() => handleOpenModal(alarm)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteAlarm(alarm.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemText
                  primary={alarm.time}
                  secondary={`${formatDaysOfWeek(alarm.days_of_week)} - ${alarm.sound_file}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
      <Button
        variant="contained"
        sx={{
          mt: 2,
          color: 'white',
          borderRadius: '20px',
          background: 'linear-gradient(145deg, #50e3c2, #29b6f6)',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
          }
        }}
        startIcon={<AddIcon />}
        onClick={() => handleOpenModal()}
      >
        アラーム設定
      </Button>
      <AlarmSettingModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveAlarm}
        existingAlarm={editingAlarm}
        audioFiles={audioFiles}
      />
    </Paper>
  );
}

export default AlarmManager;