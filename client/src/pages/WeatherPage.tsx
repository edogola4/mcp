import React from 'react';
import { 
  Container, 
  Typography, 
  TextField, 
  Button, 
  Box, 
  Paper, 
  CircularProgress, 
  Alert, 
  InputAdornment
} from '@mui/material';
import { 
  Search as SearchIcon, 
  Refresh as RefreshIcon,
  WaterDrop as WaterDropIcon, 
  Air as AirIcon, 
  Speed as SpeedIcon, 
  Visibility as VisibilityIcon 
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

// Define interface for the weather data
interface WeatherData {
  temperature: number;
  humidity: number;
  description: string;
  city: string;
  country: string;
  icon: string;
  feels_like?: number;
  pressure?: number;
  wind_speed?: number;
  visibility?: number;
  clouds?: number;
  dt?: number;
}

const WeatherIcon = ({ iconCode, alt, size = 64 }: { 
  iconCode: string; 
  alt: string; 
  size?: number 
}) => {
  const iconUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  return (
    <img 
      src={iconUrl}
      alt={alt}
      style={{ width: size, height: size }}
    />
  );
};

const WeatherDetail = ({ 
  icon, 
  label, 
  value,
  size = 'medium'
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number;
  size?: 'small' | 'medium' | 'large';
}) => {
  const sizes = {
    small: { icon: 16, typography: 'body2' },
    medium: { icon: 20, typography: 'body1' },
    large: { icon: 24, typography: 'h6' }
  };
  
  const { icon: iconSize, typography } = sizes[size];
  
  return (
    <Box 
      display="flex" 
      flexDirection="column" 
      alignItems="center" 
      p={2}
      bgcolor="rgba(255, 255, 255, 0.1)"
      borderRadius={2}
      minWidth={100}
    >
      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
        <Box fontSize={iconSize} color="primary.main">
          {icon}
        </Box>
      </Box>
      <Typography variant={typography as any} fontWeight="medium" align="center">
        {value}
      </Typography>
      <Typography 
        variant="caption" 
        color="text.secondary"
        align="center"
        sx={{ 
          fontSize: size === 'small' ? '0.6rem' : '0.75rem',
          mt: 0.5
        }}
      >
        {label}
      </Typography>
    </Box>
  );
};

function WeatherPage() {
  const [location, setLocation] = React.useState('Nairobi, Kenya');
  const [searchInput, setSearchInput] = React.useState('');
  
  const { data: weatherData, isLoading, error, refetch } = useQuery<WeatherData, Error>({
    queryKey: ['weather', location],
    queryFn: async () => {
      try {
        console.log('Fetching weather for:', location);
        const response = await api.call('weather.getCurrent', { city: location });
        console.log('Raw API response:', response);
        
        if (!response || typeof response !== 'object') {
          console.error('Invalid weather data structure:', response);
          throw new Error('Invalid weather data received from server');
        }
        
        // Transform the response to match our WeatherData interface
        const weatherData: WeatherData = {
          ...response,
          // Ensure required fields have default values if missing
          temperature: response.temperature || 0,
          humidity: response.humidity || 0,
          description: response.description || '',
          city: response.city || 'Unknown',
          country: response.country || '',
          icon: response.icon || '01d' // Default icon
        };
        
        return weatherData;
      } catch (err) {
        console.error('Error in queryFn:', err);
        throw err;
      }
    },
    enabled: !!location,
    retry: 1,
    staleTime: 0
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const newLocation = searchInput.trim();
    if (newLocation) {
      console.log('Setting new location:', newLocation);
      setLocation(newLocation);
      setSearchInput('');
    }
  };

  const handleRefresh = () => {
    console.log('Refresh clicked. Current location:', location);
    if (location) {
      console.log('Refreshing weather data for location:', location);
      refetch({
        throwOnError: true,
        cancelRefetch: true,
      }).catch(error => {
        console.error('Error refreshing weather data:', error);
      });
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          Error loading weather data: {error.message}
        </Alert>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={() => refetch()}
          startIcon={<RefreshIcon />}
        >
          Retry
        </Button>
      </Container>
    );
  }

  if (!weatherData) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            No weather data available
          </Typography>
          <Typography variant="body1" color="textSecondary" paragraph>
            Try searching for a city to see the current weather.
          </Typography>
          <Box component="form" onSubmit={handleSearch} sx={{ mb: 3, display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search for a city..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <Button 
              variant="contained" 
              color="primary" 
              type="submit"
              disabled={!searchInput.trim()}
            >
              Search
            </Button>
          </Box>
          <Button 
            variant="outlined" 
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={!location}
          >
            Refresh
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper
        elevation={3}
        sx={{
          p: 4,
          mb: 4,
          background: 'linear-gradient(135deg,rgb(62, 62, 63) 0%,rgb(5, 98, 247) 100%)',
          borderRadius: 4,
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        }}
      >
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
          <Box>
            <Typography
              variant="h4"
              component="h1"
              fontWeight="bold"
              gutterBottom
              sx={{
                background: 'linear-gradient(90deg,rgba(15, 142, 181, 0.92),rgb(85, 220, 247))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'inline-block',
              }}
            >
              {weatherData.city}, {weatherData.country}
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Typography>
          </Box>
          <Button
            variant="contained"
            onClick={handleRefresh}
            disabled={isLoading}
            startIcon={<RefreshIcon />}
            sx={{
              borderRadius: 4,
              textTransform: 'none',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 12px rgba(0, 0, 0, 0.15)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Box>

        {/* Current Weather */}
        <Box
          display="flex"
          flexDirection={{ xs: 'column', md: 'row' }}
          alignItems="center"
          justifyContent="space-between"
          gap={4}
          mb={4}
          p={4}
          sx={{
            background: 'rgba(255, 255, 255, 0.3)',
            borderRadius: 4,
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}
        >
          <Box textAlign="center">
            <WeatherIcon iconCode={weatherData.icon} alt={weatherData.description} size={140} />
            <Typography variant="h5" textTransform="capitalize" color="text.primary">
              {weatherData.description}
            </Typography>
          </Box>

          <Box textAlign={{ xs: 'center', md: 'right' }}>
            <Typography
              variant="h1"
              component="div"
              fontWeight="bold"
              sx={{
                background: 'linear-gradient(90deg, #1a237e, #0d47a1)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontSize: { xs: '4rem', sm: '5rem' },
                lineHeight: 1,
                mb: 1,
              }}
            >
              {Math.round(weatherData.temperature)}°
            </Typography>
            {weatherData.feels_like && (
              <Typography variant="body1" color="text.secondary">
                Feels like {Math.round(weatherData.feels_like)}°C
              </Typography>
            )}
          </Box>
        </Box>

        {/* Weather Details Grid */}
        <Box
          display="grid"
          gridTemplateColumns={{ xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }}
          gap={2}
          mb={4}
        >
          <WeatherDetail
            icon={<WaterDropIcon fontSize="large" />}
            label="Humidity"
            value={`${weatherData.humidity}%`}
            size="large"
          />
          <WeatherDetail
            icon={<AirIcon fontSize="large" />}
            label="Wind Speed"
            value={`${weatherData.wind_speed || 0} m/s`}
            size="large"
          />
          <WeatherDetail
            icon={<SpeedIcon fontSize="large" />}
            label="Pressure"
            value={`${weatherData.pressure || 0} hPa`}
            size="large"
          />
          <WeatherDetail
            icon={<VisibilityIcon fontSize="large" />}
            label="Visibility"
            value={weatherData.visibility ? `${(weatherData.visibility / 1000).toFixed(1)} km` : 'N/A'}
            size="large"
          />
        </Box>

        {/* Search Form */}
        <Box
          component="form"
          onSubmit={handleSearch}
          sx={{
            mt: 4,
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            '& .MuiOutlinedInput-root': {
              borderRadius: 4,
              backgroundColor: 'rgba(62, 60, 60, 0.7)',
              '&:hover': {
                backgroundColor: 'rgba(121, 120, 120, 0.9)',
              },
              '&.Mui-focused': {
                backgroundColor: 'white',
                boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.2)',
              },
            },
          }}
        >
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search for another city..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              sx: {
                borderRadius: 4,
                '& input': {
                  py: 1.5,
                },
              },
            }}
          />
          <Button
            variant="contained"
            type="submit"
            disabled={!searchInput.trim() || isLoading}
            sx={{
              minWidth: 120,
              borderRadius: 4,
              py: 1.5,
              textTransform: 'none',
              fontWeight: 'bold',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 12px rgba(0, 0, 0, 0.15)',
              },
              transition: 'all 0.3s ease',
              background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
              '&:disabled': {
                background: 'rgba(0, 0, 0, 0.12)',
              },
            }}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Search'}
          </Button>
        </Box>

        {/* Footer */}
        <Box mt={4} textAlign="center">
          <Typography variant="body2" color="text.secondary">
            Last updated: {new Date().toLocaleString()}
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            Powered by OpenWeatherMap
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default WeatherPage;