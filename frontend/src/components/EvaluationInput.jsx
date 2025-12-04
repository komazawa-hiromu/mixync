import React, { useState } from 'react';
import { Box, Typography, Button, Rating, Alert, Paper } from '@mui/material';
import SentimentVeryDissatisfiedIcon from '@mui/icons-material/SentimentVeryDissatisfied';
import SentimentDissatisfiedIcon from '@mui/icons-material/SentimentDissatisfied';
import SentimentNeutralIcon from '@mui/icons-material/SentimentNeutral';
import SentimentSatisfiedIcon from '@mui/icons-material/SentimentSatisfied';
import SentimentVerySatisfiedIcon from '@mui/icons-material/SentimentVerySatisfied';
import { API_BASE_URL } from '../config';

const customIcons = {
    1: {
        icon: <SentimentVeryDissatisfiedIcon fontSize="large" />,
        label: '非常に悪い',
    },
    2: {
        icon: <SentimentDissatisfiedIcon fontSize="large" />,
        label: '悪い',
    },
    3: {
        icon: <SentimentNeutralIcon fontSize="large" />,
        label: '普通',
    },
    4: {
        icon: <SentimentSatisfiedIcon fontSize="large" />,
        label: '良い',
    },
    5: {
        icon: <SentimentVerySatisfiedIcon fontSize="large" />,
        label: '非常に良い',
    },
};

function IconContainer(props) {
    const { value, ...other } = props;
    return <span {...other}>{customIcons[value].icon}</span>;
}

function EvaluationInput({ eventId, onSubmitSuccess }) {
    const [moodRating, setMoodRating] = useState(3);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async () => {
        if (!eventId) {
            setError('イベントIDが見つかりません');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');

            const response = await fetch(`${API_BASE_URL}/api/evaluations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    event_id: eventId,
                    mood_rating: moodRating
                })
            });

            if (!response.ok) {
                throw new Error('評価の送信に失敗しました');
            }

            const data = await response.json();
            console.log('Evaluation submitted:', data);

            setSuccess(true);

            if (onSubmitSuccess) {
                onSubmitSuccess(data);
            }

        } catch (err) {
            console.error('Evaluation error:', err);
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <Paper elevation={3} sx={{ p: 3, textAlign: 'center' }}>
                <Alert severity="success" sx={{ mb: 2 }}>
                    評価を送信しました！ありがとうございます。
                </Alert>
                <Typography variant="body2" color="text.secondary">
                    この評価は次回のアラーム音の最適化に活用されます。
                </Typography>
            </Paper>
        );
    }

    return (
        <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
                目覚めの気分を評価してください
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                今朝の目覚めの気分はいかがでしたか？
            </Typography>

            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                mb: 3
            }}>
                <Rating
                    name="mood-rating"
                    value={moodRating}
                    onChange={(event, newValue) => {
                        setMoodRating(newValue);
                    }}
                    IconContainerComponent={IconContainer}
                    getLabelText={(value) => customIcons[value].label}
                    highlightSelectedOnly
                    size="large"
                    sx={{ fontSize: '3rem' }}
                />

                <Typography variant="h6" sx={{ mt: 2, color: 'primary.main' }}>
                    {customIcons[moodRating].label}
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            <Button
                onClick={handleSubmit}
                variant="contained"
                fullWidth
                disabled={submitting}
                sx={{
                    py: 1.5,
                    fontSize: '1.1rem',
                    borderRadius: '20px',
                    background: 'linear-gradient(145deg, #50e3c2, #29b6f6)',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
                    '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
                    }
                }}
            >
                {submitting ? '送信中...' : '評価を送信'}
            </Button>

            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2, textAlign: 'center' }}>
                この評価はAIがあなたに最適なアラーム音を学習するために使用されます
            </Typography>
        </Paper>
    );
}

export default EvaluationInput;
