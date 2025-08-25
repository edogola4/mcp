import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  Divider,
  Tabs,
  Tab,
  useTheme,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  LocationOn as LocationIcon,
  Refresh as RefreshIcon,
  Thermostat as ThermostatIcon,
  Water as WaterIcon,
  Air as WindIcon,
  WbSunny as SunIcon,
  NightsStay as MoonIcon,
  Cloud as CloudIcon,
  Opacity as HumidityIcon,
  Visibility as VisibilityIcon,
  Speed as PressureIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

type WeatherData = {
  location: string;
  current: {
    temp_c: number;
    temp_f: number;
    condition: {
      text: string;
      icon: string;
    };
    wind_kph: number;
    wind_degree: number;
    wind_dir: string;
    pressure_mb: number;
    humidity: number;
    cloud: number;
    feelslike_c: number;
    feelslike_f: number;
    vis_km: number;
    uv: number;
    last_updated: string;
  };
  forecast?: {
    forecastday: Array<{
      date: string;
      day: {
        maxtemp_c: number;
        maxtemp_f: number;
        mintemp_c: number;
        mintemp_f: number;
        avgtemp_c: number;
        avgtemp_f: number;
        maxwind_kph: number;
        totalprecip_mm: number;
        totalsnow_cm: number;
        avghumidity: number;
        daily_will_it_rain: number;
        daily_chance_of_rain: string;
        daily_will_it_snow: number;
        daily_chance_of_snow: string;
        condition: {
          text: string;
          icon: string;
        };
        uv: number;
      };
      hour: Array<{
        time: string;
        temp_c: number;
        temp_f: number;
        condition: {
          text: string;
          icon: string;
        };
        wind_kph: number;
        wind_degree: number;
        wind_dir: string;
        pressure_mb: number;
        humidity: number;
        cloud: number;
        feelslike_c: number;
        feelslike_f: number;
        windchill_c: number;
        windchill_f: number;
        heatindex_c: number;
        heatindex_f: number;
        dewpoint_c: number;
        dewpoint_f: number;
        will_it_rain: number;
        chance_of_rain: string;
        will_it_snow: number;
        chance_of_snow: string;
        vis_km: number;
        gust_kph: number;
        uv: number;
      }>;
    }>;
  };
};

const WeatherCard = ({ title, value, icon, unit = '' }: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  unit?: string;
}) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box display="flex" alignItems="center" mb={1}>
        {icon}
        <Typography variant="subtitle2" color="textSecondary" ml={1}>
          {title}
        </Typography>
      </Box>
      <Box display="flex" alignItems="baseline">
        <Typography variant="h5">
          {value}
        </Typography>
        {unit && (
          <Typography variant="body2" color="textSecondary" ml={0.5}>
            {unit}
          </Typography>
        )}
      </Box>
    </CardContent>
  </Card>
);

const WeatherIcon = ({ iconUrl, alt, size = 64 }: { iconUrl: string; alt: string; size?: number }) => (
  <Box
    component="img"
    src={iconUrl.startsWith('http') ? iconUrl : `https:${iconUrl}`}
    alt={alt}
    sx={{ width: size, height: size }}
  />
);

export default function WeatherPage() {
  const [location, setLocation] = useState('New York');
  const [searchInput, setSearchInput] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const theme = useTheme();

  const { data: weatherData, isLoading, error, refetch } = useQuery<WeatherData>({
    queryKey: ['weather', location],
    queryFn: () => api.call('weather.getCurrent', { location }),
    enabled: !!location,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setLocation(searchInput);
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error instanceof Error ? error.message : 'Failed to load weather data'}
      </Alert>
    );
  }

  if (!weatherData) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        Enter a location to see the weather
      </Alert>
    );
  }

  const { current } = weatherData;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Weather</Typography>
        <IconButton onClick={handleRefresh} disabled={isLoading}>
          <RefreshIcon />
        </IconButton>
      </Box>

      <Paper component="form" onSubmit={handleSearch} sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={1}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search for a city..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />,
            }}
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={!searchInput.trim()}
          >
            Search
          </Button>
        </Box>
      </Paper>

      {weatherData && (
        <>
          <Box mb={3}>
            <Box display="flex" alignItems="center" mb={2}>
              <LocationIcon color="primary" />
              <Typography variant="h5" ml={1}>
                {weatherData.location}
              </Typography>
              <Typography variant="body2" color="textSecondary" ml={1}>
                {new Date(current.last_updated).toLocaleString()}
              </Typography>
            </Box>

            <Grid container spacing={3} mb={3}>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 3, height: '100%', textAlign: 'center' }}>
                  <Box display="flex" flexDirection="column" alignItems="center">
                    <WeatherIcon
                      iconUrl={current.condition.icon}
                      alt={current.condition.text}
                      size={96}
                    />
                    <Typography variant="h3" component="div">
                      {Math.round(current.temp_c)}°C
                    </Typography>
                    <Typography variant="h6" color="textSecondary" gutterBottom>
                      {current.condition.text}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Feels like {Math.round(current.feelslike_c)}°C
                    </Typography>
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} md={8}>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={4} md={4}>
                    <WeatherCard
                      title="Wind"
                      value={`${current.wind_kph} km/h`}
                      icon={<WindIcon />}
                    />
                  </Grid>
                  <Grid item xs={6} sm={4} md={4}>
                    <WeatherCard
                      title="Humidity"
                      value={`${current.humidity}%`}
                      icon={<WaterIcon />}
                    />
                  </Grid>
                  <Grid item xs={6} sm={4} md={4}>
                    <WeatherCard
                      title="Pressure"
                      value={`${current.pressure_mb} mb`}
                      icon={<PressureIcon />}
                    />
                  </Grid>
                  <Grid item xs={6} sm={4} md={4}>
                    <WeatherCard
                      title="Visibility"
                      value={`${current.vis_km} km`}
                      icon={<VisibilityIcon />}
                    />
                  </Grid>
                  <Grid item xs={6} sm={4} md={4}>
                    <WeatherCard
                      title="UV Index"
                      value={current.uv}
                      icon={<SunIcon />}
                    />
                  </Grid>
                  <Grid item xs={6} sm={4} md={4}>
                    <WeatherCard
                      title="Cloud Cover"
                      value={`${current.cloud}%`}
                      icon={<CloudIcon />}
                    />
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </Box>

          {weatherData.forecast && (
            <Paper sx={{ p: 2 }}>
              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                indicatorColor="primary"
                textColor="primary"
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab label="Today" />
                <Tab label="Hourly" />
                <Tab label="3-Day Forecast" />
              </Tabs>

              <Divider sx={{ my: 2 }} />

              <Box mt={2}>
                {tabValue === 0 && (
                  <Grid container spacing={2}>
                    {weatherData.forecast.forecastday[0].hour
                      .filter((_, index) => index % 3 === 0) // Show every 3 hours
                      .map((hour) => (
                        <Grid item xs={4} sm={2} key={hour.time}>
                          <Box textAlign="center">
                            <Typography variant="subtitle2">
                              {new Date(hour.time).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Typography>
                            <WeatherIcon
                              iconUrl={hour.condition.icon}
                              alt={hour.condition.text}
                              size={48}
                            />
                            <Typography variant="body1">
                              {Math.round(hour.temp_c)}°C
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {hour.chance_of_rain}% rain
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                  </Grid>
                )}

                {tabValue === 1 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Hourly Forecast
                    </Typography>
                    {/* Add hourly forecast implementation */}
                  </Box>
                )}

                {tabValue === 2 && (
                  <Grid container spacing={2}>
                    {weatherData.forecast.forecastday.slice(0, 3).map((day) => (
                      <Grid item xs={12} sm={6} md={4} key={day.date}>
                        <Paper sx={{ p: 2 }}>
                          <Typography variant="subtitle1">
                            {new Date(day.date).toLocaleDateString(undefined, {
                              weekday: 'long',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </Typography>
                          <Box display="flex" alignItems="center" my={1}>
                            <WeatherIcon
                              iconUrl={day.day.condition.icon}
                              alt={day.day.condition.text}
                              size={48}
                            />
                            <Box ml={2}>
                              <Typography variant="h6">
                                {Math.round(day.day.maxtemp_c)}° / {Math.round(day.day.mintemp_c)}°
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                {day.day.condition.text}
                              </Typography>
                            </Box>
                          </Box>
                          <Grid container spacing={1} mt={1}>
                            <Grid item xs={6}>
                              <Typography variant="body2">
                                <WaterIcon fontSize="small" color="primary" /> {day.day.avghumidity}%
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2">
                                <WindIcon fontSize="small" color="primary" /> {day.day.maxwind_kph} km/h
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2">
                                <OpacityIcon fontSize="small" color="primary" /> {day.day.daily_chance_of_rain}%
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2">
                                <SpeedIcon fontSize="small" color="primary" /> {day.day.avgtemp_c}°C
                              </Typography>
                            </Grid>
                          </Grid>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Box>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}
