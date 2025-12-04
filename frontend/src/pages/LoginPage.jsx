import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';

// MUI Imports
import { Paper, Box, Typography, TextField, Button, Alert, Link } from '@mui/material';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('[LOGIN] Form submitted');
    console.log('[LOGIN] Email:', email);
    console.log('[LOGIN] API_BASE_URL:', API_BASE_URL);
    setMessage('');

    try {
      console.log('[LOGIN] Sending request to:', `${API_BASE_URL}/auth/login`);
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      console.log('[LOGIN] Response status:', response.status);
      const data = await response.json();
      console.log('[LOGIN] Response data:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to login');
      }

      // Save token and user data using AuthContext
      console.log('[LOGIN] Calling login function');
      login(data.token, data.user);
      console.log('[LOGIN] Navigating to /');
      navigate('/');

    } catch (error) {
      console.error('[LOGIN] Error:', error);
      setMessage(error.message);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          ログイン
        </Typography>

        {message && <Alert severity="error" sx={{ width: '100%', mb: 2 }}>{message}</Alert>}

        <TextField
          label="メールアドレス"
          type="email"
          variant="outlined"
          margin="normal"
          required
          fullWidth
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="パスワード"
          type="password"
          variant="outlined"
          margin="normal"
          required
          fullWidth
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button
          type="submit"
          variant="contained"
          size="large"
          sx={{
            mt: 3,
            mb: 2,
            width: '50%',
            color: 'white',
            borderRadius: '20px',
            background: 'linear-gradient(145deg, #50e3c2, #4a90e2)',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
            }
          }}
        >
          ログイン
        </Button>
        <Typography variant="body2">
          アカウントをお持ちでないですか？ <Link component={RouterLink} to="/register">こちらで新規登録</Link>
        </Typography>
      </Box>
    </Paper>
  );
}

export default LoginPage;