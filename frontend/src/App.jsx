import React from 'react';
import { Routes, Route, Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { API_BASE_URL } from './config';

// MUI Imports
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';

// Page Imports
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SettingsPage from './pages/SettingsPage';

// Create a theme based on sleep-app's stylesheet
const theme = createTheme({
  palette: {
    primary: {
      main: '#29b6f6', // A brighter light blue
    },
    secondary: {
      main: '#50e3c2', // sleep-app's secondary-color
    },
    background: {
      default: '#f8f9fa' // sleep-app's light-gray
    }
  },
  typography: {
    fontFamily: 'Helvetica Neue, Arial, sans-serif',
    fontSize: 14, // Base font size
    h5: { fontSize: '1.5rem' }, // Revert h5
    h6: { fontSize: '1.25rem' }, // Revert h6
    body1: { fontSize: '1rem' }, // Revert body1
    body2: { fontSize: '0.875rem' }, // Revert body2
    button: { fontSize: '1rem' }, // Revert button
  },
});

function App() {
  const { isAuthenticated, checkAuthStatus } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      // Clear local storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });

      await checkAuthStatus();
      navigate('/login'); // Redirect to login after logout
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  // Hide header on login and register pages
  const hideHeader = ['/login', '/register'].includes(location.pathname);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      {!hideHeader && (
        <AppBar position="static" sx={{ background: 'linear-gradient(145deg, #50e3c2, #29b6f6)', minHeight: 100 }}>
          <Toolbar sx={{ minHeight: 100 }}>
            <Typography variant="h4" component="div" sx={{ flexGrow: 1 }}>
              new-sunrise-manage
            </Typography>
            {isAuthenticated ? (
              <Box>
                <Button color="inherit" component={RouterLink} to="/" sx={{ fontSize: '1.4rem' }}>ホーム</Button>
                <Button color="inherit" component={RouterLink} to="/settings" sx={{ fontSize: '1.4rem' }}>アラーム音</Button>
                <Button color="inherit" onClick={handleLogout} sx={{ fontSize: '1.4rem' }}>ログアウト</Button>
              </Box>
            ) : (
              <Box>
                <Button color="inherit" component={RouterLink} to="/login" sx={{ fontSize: '1.2rem' }}>ログイン</Button>
                <Button color="inherit" component={RouterLink} to="/register" sx={{ fontSize: '1.2rem' }}>新規登録</Button>
              </Box>
            )}
          </Toolbar>
        </AppBar>
      )}

      <Container component="main" disableGutters sx={{ mt: hideHeader ? 0 : 3, mb: 6 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/fitbit-success" element={<FitbitSuccessHandler />} />
        </Routes>
      </Container>
    </ThemeProvider>
  );
}

// New component to handle Fitbit success redirect
function FitbitSuccessHandler() {
  const { checkAuthStatus } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    const handleRedirect = async () => {
      await checkAuthStatus(); // Re-check auth status to update user data
      navigate('/'); // Redirect to homepage
    };
    handleRedirect();
  }, [checkAuthStatus, navigate]);

  return (
    <Box sx={{ textAlign: 'center', mt: 4 }}>
      <Typography variant="h5">Fitbit連携を処理中...</Typography>
      <Typography variant="body1">しばらくお待ちください。</Typography>
    </Box>
  );
}

export default App;