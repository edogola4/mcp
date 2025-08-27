import React from 'react';
import { 
  Container, 
  Typography, 
  TextField, 
  Button, 
  Box, 
  Paper, 
  Divider, 
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
  value 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number;
}) => (
  <Box display="flex" alignItems="center" gap={1}>
    <Box>{icon}</Box>
    <Box>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" fontWeight="medium">
        {value}
      </Typography>
    </Box>
  </Box>
);

export default function WeatherPage() {
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

  const lastUpdated = new Date().toLocaleString();

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4, mb: 4 }}>
        {/* Search Bar */}
        <Box component="form" onSubmit={handleSearch} sx={{ mb: 4, display: 'flex', gap: 1 }}>
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
          <Button 
            variant="outlined" 
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Box>

        {/* Current Weather */}
        <Box sx={{ mb: 4 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>
                {weatherData.city}, {weatherData.country}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </Typography>
            </Box>
            <Box textAlign="right">
              <Button 
                variant="outlined" 
                startIcon={<RefreshIcon />}
                onClick={handleRefresh}
                disabled={isLoading}
              >
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </Button>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={4}>
            {/* Left side - Main weather info */}
            <Box flex={1} display="flex" flexDirection="column" alignItems="center">
              <Box display="flex" alignItems="center" mb={2}>
                <WeatherIcon 
                  iconCode={weatherData.icon}
                  alt={weatherData.description}
                  size={120}
                />
                <Box ml={2}>
                  <Typography variant="h2" component="div" fontWeight="bold">
                    {Math.round(weatherData.temperature)}°
                  </Typography>
                  <Typography variant="h6" color="text.secondary" textTransform="capitalize">
                    {weatherData.description}
                  </Typography>
                  {weatherData.feels_like !== undefined && (
                    <Typography variant="body2" color="text.secondary">
                      Feels like: {Math.round(weatherData.feels_like)}°
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>

            {/* Right side - Weather details */}
            <Box flex={1}>
              <Box display="grid" gridTemplateColumns={{ xs: '1fr 1fr', sm: '1fr 1fr 1fr' }} gap={2}>
                <Box>
                  <WeatherDetail 
                    icon={<WaterDropIcon color="primary" />}
                    label="Humidity"
                    value={`${weatherData.humidity}%`}
                  />
                </Box>
                {weatherData.wind_speed !== undefined && (
                  <Box>
                    <WeatherDetail 
                      icon={<AirIcon color="primary" />}
                      label="Wind"
                      value={`${Math.round(weatherData.wind_speed)} m/s`}
                    />
                  </Box>
                )}
                {weatherData.pressure !== undefined && (
                  <Box>
                    <WeatherDetail 
                      icon={<SpeedIcon color="primary" />}
                      label="Pressure"
                      value={`${weatherData.pressure} hPa`}
                    />
                  </Box>
                )}
                {weatherData.visibility !== undefined && (
                  <Box>
                    <WeatherDetail 
                      icon={<VisibilityIcon color="primary" />}
                      label="Visibility"
                      value={`${(weatherData.visibility / 1000).toFixed(1)} km`}
                    />
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="text.secondary">
            Last updated: {lastUpdated}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Powered by OpenWeatherMap
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}
