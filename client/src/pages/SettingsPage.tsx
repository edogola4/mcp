import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  Alert,
  Snackbar,
  Tabs,
  Tab,
} from '@mui/material';
import { Save as SaveIcon, Refresh as RefreshIcon } from '@mui/icons-material';

const SettingsPage = () => {
  const [settings, setSettings] = useState({
    theme: 'dark',
    language: 'en',
    notifications: true,
    autoRefresh: true,
    refreshInterval: 30,
    apiEndpoint: 'http://localhost:3000',
  });

  const [activeTab, setActiveTab] = useState(0);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSelectChange = (e: SelectChangeEvent) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = () => {
    // In a real app, you would save these settings to a backend or local storage
    setSnackbar({
      open: true,
      message: 'Settings saved successfully',
      severity: 'success',
    });
  };

  const handleReset = () => {
    setSettings({
      theme: 'dark',
      language: 'en',
      notifications: true,
      autoRefresh: true,
      refreshInterval: 30,
      apiEndpoint: 'http://localhost:3000',
    });
    setSnackbar({
      open: true,
      message: 'Settings reset to defaults',
      severity: 'info',
    });
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2 }}>
          <Tab label="General" />
          <Tab label="Appearance" />
          <Tab label="API" />
          <Tab label="Advanced" />
        </Tabs>

        <Divider sx={{ mb: 3 }} />

        {activeTab === 0 && (
          <Box>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel id="language-label">Language</InputLabel>
              <Select
                labelId="language-label"
                name="language"
                value={settings.language}
                label="Language"
                onChange={handleSelectChange}
              >
                <MenuItem value="en">English</MenuItem>
                <MenuItem value="es">Español</MenuItem>
                <MenuItem value="fr">Français</MenuItem>
                <MenuItem value="de">Deutsch</MenuItem>
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={settings.notifications}
                  onChange={handleChange}
                  name="notifications"
                />
              }
              label="Enable notifications"
              sx={{ mb: 2, display: 'block' }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={settings.autoRefresh}
                  onChange={handleChange}
                  name="autoRefresh"
                />
              }
              label="Auto-refresh data"
              sx={{ mb: 2, display: 'block' }}
            />

            {settings.autoRefresh && (
              <FormControl fullWidth sx={{ mb: 3, maxWidth: 200 }}>
                <TextField
                  label="Refresh interval (seconds)"
                  type="number"
                  name="refreshInterval"
                  value={settings.refreshInterval}
                  onChange={handleChange}
                  inputProps={{ min: 5, max: 3600 }}
                />
              </FormControl>
            )}
          </Box>
        )}

        {activeTab === 1 && (
          <Box>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel id="theme-label">Theme</InputLabel>
              <Select
                labelId="theme-label"
                name="theme"
                value={settings.theme}
                label="Theme"
                onChange={handleSelectChange}
              >
                <MenuItem value="light">Light</MenuItem>
                <MenuItem value="dark">Dark</MenuItem>
                <MenuItem value="system">System Default</MenuItem>
              </Select>
            </FormControl>

            <Typography variant="subtitle2" gutterBottom>
              Accent Color
            </Typography>
            <Box display="flex" gap={2} mb={3}>
              {['primary', 'secondary', 'success', 'error', 'info', 'warning'].map((color) => (
                <Box
                  key={color}
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    bgcolor: `${color}.main`,
                    cursor: 'pointer',
                    border: settings.theme === color ? `3px solid` : 'none',
                    borderColor: 'primary.main',
                  }}
                  onClick={() => setSettings(prev => ({ ...prev, theme: color }))}
                />
              ))}
            </Box>
          </Box>
        )}

        {activeTab === 2 && (
          <Box>
            <TextField
              fullWidth
              label="API Endpoint"
              name="apiEndpoint"
              value={settings.apiEndpoint}
              onChange={handleChange}
              margin="normal"
              helperText="The base URL of your MCP API server"
            />

            <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
              API documentation is available at {settings.apiEndpoint}/docs
            </Alert>

            <Button
              variant="outlined"
              color="primary"
              sx={{ mt: 2 }}
              onClick={() => {
                // Test API connection
                setSnackbar({
                  open: true,
                  message: 'Testing connection...',
                  severity: 'info',
                });
              }}
            >
              Test Connection
            </Button>
          </Box>
        )}

        {activeTab === 3 && (
          <Box>
            <Alert severity="warning" sx={{ mb: 3 }}>
              Advanced settings should be modified with caution. Incorrect settings may cause the application to behave unexpectedly.
            </Alert>

            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Enable debug mode"
              sx={{ mb: 2, display: 'block' }}
            />

            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Enable analytics"
              sx={{ mb: 2, display: 'block' }}
            />

            <Button
              variant="outlined"
              color="secondary"
              sx={{ mt: 2, mr: 2 }}
              onClick={() => {
                localStorage.clear();
                setSnackbar({
                  open: true,
                  message: 'Local storage cleared',
                  severity: 'success',
                });
              }}
            >
              Clear Local Storage
            </Button>

            <Button
              variant="outlined"
              color="error"
              sx={{ mt: 2 }}
              onClick={() => {
                if (window.confirm('Are you sure you want to reset all settings to default?')) {
                  handleReset();
                }
              }}
            >
              Reset All Settings
            </Button>
          </Box>
        )}

        <Divider sx={{ my: 3 }} />

        <Box display="flex" justifyContent="flex-end" gap={2}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleReset}
          >
            Reset
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSave}
          >
            Save Changes
          </Button>
        </Box>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity as any}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SettingsPage;
