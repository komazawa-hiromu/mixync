import React, { useState, useEffect } from 'react';
import { Modal, Box, Typography, Button, Alert, Rating, Stack } from '@mui/material';
import { API_BASE_URL } from '../config';

function RingingAlarmModal({ alarm, onClose }) {
  const [audioSrc, setAudioSrc] = useState(null);
  const [error, setError] = useState('');
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [moodRating, setMoodRating] = useState(3);
  const [soundRating, setSoundRating] = useState(3);

  useEffect(() => {
    if (alarm) {
      // Reset states for the new alarm
      setError('');
      setShowEvaluation(false);

      // The audio data is now passed directly via WebSocket.
      // No need to fetch or generate anything here.
      if (alarm.audioData) {
        setAudioSrc(alarm.audioData);
      } else {
        // Set a fallback error message if audio data is missing
        setError('受信したアラーム情報に音声データが含まれていません。');
      }
    }
  }, [alarm]);

  const handleStopAndEvaluate = () => {
    setShowEvaluation(true);
    // The audio element will be removed, stopping the sound
  };

  const handleSubmitEvaluation = async () => {
    if (!alarm || !alarm.eventId) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/evaluations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify({
          event_id: alarm.eventId,
          mood_rating: moodRating,
          sound_rating: soundRating
        }),
      });
      if (!response.ok) throw new Error('評価の送信に失敗しました。');
      onClose(); // Close the modal after successful submission
    } catch (err) {
      setError(err.message);
    }
  };

  if (!alarm) return null;

  return (
    <Modal open={true} onClose={onClose}>
      <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 400, bgcolor: 'background.paper', boxShadow: 24, p: 4, borderRadius: 2, textAlign: 'center' }}>
        <Typography variant="h4" component="h2" gutterBottom>
          アラーム
        </Typography>
        <Typography variant="h5" sx={{ mb: 3 }}>
          {alarm.time}
        </Typography>

        {error && <Alert severity="error">{error}</Alert>}

        {!showEvaluation ? (
          // --- Ringing View ---
          <>
            {audioSrc ? (
              <audio src={audioSrc} autoPlay loop />
            ) : (
              !error && <Typography>アラーム音を生成中...</Typography>
            )}
            <Button onClick={handleStopAndEvaluate} variant="contained" color="error" size="large" sx={{ mt: 4 }}>
              アラームを停止して評価する
            </Button>
          </>
        ) : (
          // --- Evaluation View ---
          <>
            <Typography sx={{ mt: 2, mb: 1 }}>今のアラームをもう一度聞く:</Typography>
            <audio controls src={audioSrc} />

            <Typography sx={{ mt: 3, mb: 1 }}>今の目覚めの気分は？ (1:悪い ~ 5:良い)</Typography>
            <Rating name="mood-rating" value={moodRating} onChange={(e, newValue) => setMoodRating(newValue)} size="large" />

            <Typography sx={{ mt: 3, mb: 1 }}>このアラーム音は気に入りましたか？ (1:嫌い ~ 5:好き)</Typography>
            <Rating name="sound-rating" value={soundRating} onChange={(e, newValue) => setSoundRating(newValue)} size="large" />

            <Button onClick={handleSubmitEvaluation} variant="contained" color="primary" size="large" sx={{ mt: 4 }}>
              評価を送信
            </Button>
          </>
        )}
      </Box>
    </Modal>
  );
}

export default RingingAlarmModal;