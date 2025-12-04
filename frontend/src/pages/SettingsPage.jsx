import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { Paper, Box, Typography, Button, Alert, List, ListItem, ListItemText, IconButton, Link } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

function SettingsPage() {
  const [audioFiles, setAudioFiles] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const fetchAudioFiles = async () => {
    setError('');
    try {
      const token = localStorage.getItem('token');
      const [filesRes, alarmsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/audio/files`, {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }),
        fetch(`${API_BASE_URL}/api/alarms`, {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      ]);

      if (!filesRes.ok) throw new Error('音声ファイルの取得に失敗しました。');
      if (!alarmsRes.ok) throw new Error('設定済みアラームの取得に失敗しました。');

      const files = await filesRes.json();
      const alarms = await alarmsRes.json();

      const alarmSoundFiles = alarms.map(alarm => alarm.sound_file);
      const combinedFiles = [...new Set([...files, ...alarmSoundFiles])];

      setAudioFiles(combinedFiles);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { fetchAudioFiles(); }, []);

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('ファイルが選択されていません。');
      return;
    }
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('audioFile', selectedFile);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/audio/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'アップロードに失敗しました。');
      setSuccess(data.message);
      fetchAudioFiles(); // Refresh the list
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteFile = async (filename) => {
    setError('');
    setSuccess('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/audio/files/${filename}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`
        },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || '削除に失敗しました。');
      setSuccess(data.message);
      fetchAudioFiles(); // Refresh the list
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
      <Link component={RouterLink} to="/">
        &larr; ホームに戻る
      </Link>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mt: 2 }}>
        アラーム音の管理
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Box sx={{ mb: 3 }}>
        <Typography variant="h6">現在のアラーム音</Typography>
        <List>
          {audioFiles.map(file => (
            <ListItem
              key={file}
              secondaryAction={
                <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteFile(file)}>
                  <DeleteIcon />
                </IconButton>
              }
            >
              <ListItemText primary={file} />
            </ListItem>
          ))}
        </List>
      </Box>

      <Box>
        <Typography variant="h6">新しいアラーム音をアップロード (WAV形式のみ)</Typography>
        <Paper variant="outlined" sx={{ p: 2, my: 2, backgroundColor: '#f0f4f8' }}>
          <Typography variant="body2">
            MP3などのファイルをWAV形式に変換する必要があります。
            <Link href="https://www.freeconvert.com/mp3-to-wav" target="_blank" rel="noopener noreferrer">
              こちらのサイト
            </Link>
            などで変換できます。
          </Typography>
        </Paper>

        <input
          type="file"
          accept=".wav,audio/wav"
          onChange={handleFileChange}
          style={{ display: 'block', margin: '10px 0' }}
        />
        <Button variant="contained" onClick={handleUpload}>
          アップロード
        </Button>
      </Box>
    </Paper>
  );
}

export default SettingsPage;
