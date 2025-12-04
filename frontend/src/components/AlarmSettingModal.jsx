import React, { useState, useEffect } from 'react';
import { Modal, Box, Typography, TextField, Button, Select, MenuItem, FormControl, InputLabel, Alert } from '@mui/material';

function AlarmSettingModal({ isOpen, onClose, onSave, existingAlarm, audioFiles }) {
  const [datetime, setDatetime] = useState('');
  const [selectedSound, setSelectedSound] = useState('');
  const [mixingPattern, setMixingPattern] = useState('AUTO');

  useEffect(() => {
    if (isOpen) {
      if (existingAlarm) {
        // Convert existing alarm time to datetime-local format
        const now = new Date();
        const [hours, minutes] = existingAlarm.time.split(':');
        now.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        const datetimeString = now.toISOString().slice(0, 16);
        setDatetime(datetimeString);
        setSelectedSound(existingAlarm.sound_file);
        setMixingPattern(existingAlarm.mixing_pattern || 'AUTO');
      } else {
        // Default to tomorrow at 7:00 AM
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(7, 0, 0, 0);
        const datetimeString = tomorrow.toISOString().slice(0, 16);
        setDatetime(datetimeString);
        setSelectedSound(audioFiles.length > 0 ? audioFiles[0] : '');
        setMixingPattern('AUTO');
      }
    }
  }, [isOpen, existingAlarm, audioFiles]);

  const handleSave = () => {
    if (!datetime || !selectedSound) {
      alert('日時とサウンドを選択してください。');
      return;
    }

    const alarmData = {
      id: existingAlarm ? existingAlarm.id : undefined,
      datetime: datetime,
      sound_file: selectedSound,
      mixing_pattern: mixingPattern,
    };
    onSave(alarmData);
    onClose();
  };

  const getMixingDescription = (pattern) => {
    const descriptions = {
      'AUTO': 'AI が睡眠中の心拍数パターンから自動選択',
      'A': 'トレモロ効果 - 音量が周期的に変化',
      'B': 'PAN効果 - 左右に音が移動',
      'C': 'シマーリバーブ - 幻想的な響き'
    };
    return descriptions[pattern] || '';
  };

  return (
    <Modal open={isOpen} onClose={onClose}>
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 500,
        bgcolor: 'background.paper',
        boxShadow: 24,
        p: 4,
        borderRadius: 2,
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        <Typography variant="h6" component="h2" gutterBottom>アラーム設定</Typography>

        <TextField
          label="日時"
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
          InputLabelProps={{ shrink: true }}
          helperText="アラームを鳴らす日時を選択してください"
        />

        <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
          <InputLabel id="sound-select-label">サウンド</InputLabel>
          <Select
            labelId="sound-select-label"
            value={selectedSound}
            label="サウンド"
            onChange={(e) => setSelectedSound(e.target.value)}
          >
            {audioFiles.map(file => (
              <MenuItem key={file} value={file}>{file}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth sx={{ mt: 2, mb: 1 }}>
          <InputLabel id="mixing-select-label">ミキシングパターン</InputLabel>
          <Select
            labelId="mixing-select-label"
            value={mixingPattern}
            label="ミキシングパターン"
            onChange={(e) => setMixingPattern(e.target.value)}
          >
            <MenuItem value="AUTO">🤖 AIに任せる（推奨）</MenuItem>
            <MenuItem value="A">A - トレモロ</MenuItem>
            <MenuItem value="B">B - PAN</MenuItem>
            <MenuItem value="C">C - シマーリバーブ</MenuItem>
          </Select>
        </FormControl>

        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2, ml: 1 }}>
          {getMixingDescription(mixingPattern)}
        </Typography>

        {mixingPattern === 'AUTO' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              アラーム5分前に、睡眠中の心拍数パターンを分析し、
              過去のデータから最適なミキシングを自動選択します。
            </Typography>
          </Alert>
        )}

        {mixingPattern !== 'AUTO' && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              データ収集期間中は手動選択も可能です。
              3週間のデータ収集後は「AIに任せる」を推奨します。
            </Typography>
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button
            onClick={handleSave}
            variant="contained"
            fullWidth
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
            設定
          </Button>
          <Button onClick={onClose} variant="outlined" fullWidth>
            キャンセル
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}

export default AlarmSettingModal;
