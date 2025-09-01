import { useQuery } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  LinearProgress, 
  Typography, 
  Box, 
  Paper, 
  Alert,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import api from '../api/simpleClient';
import {
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';

const StatCard = ({ title, value, icon, color = 'primary' }: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
}) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box display="flex" alignItems="center" mb={2}>
        <Box color={`${color}.main`} mr={1}>
          {icon}
        </Box>
        <Typography color="textSecondary" variant="subtitle2">
          {title}
        </Typography>
      </Box>
      <Typography variant="h5">{value}</Typography>
    </CardContent>
  </Card>
);

const HealthStatus = ({ status }: { status: 'ok' | 'error' | 'warning' }) => (
  <Box display="flex" alignItems="center">
    {status === 'ok' ? (
      <CheckCircleIcon color="success" sx={{ mr: 1 }} />
    ) : (
      <ErrorIcon color={status === 'warning' ? 'warning' : 'error'} sx={{ mr: 1 }} />
    )}
    <Typography
      color={status === 'ok' ? 'success.main' : status === 'warning' ? 'warning.main' : 'error.main'}
      variant="body2"
    >
      {status === 'ok' ? 'Operational' : status === 'warning' ? 'Degraded' : 'Error'}
    </Typography>
  </Box>
);

export default function DashboardPage() {
  const { data: healthData = { 
    status: 'loading', 
    timestamp: new Date().toISOString(),
    memoryUsage: { rss: 0, heapTotal: 0, heapUsed: 0 },
    uptime: 0
  }, isLoading, error } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.call('health.check'),
    retry: 3,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  if (isLoading) {
    return <LinearProgress />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>Dashboard</Typography>
      
      {isLoading && <LinearProgress />}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load health data: {error.message}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* System Stats */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>System Stats</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={4}>
                <StatCard 
                  title="Memory Usage" 
                  value={`${Math.round((healthData.memoryUsage?.heapUsed || 0) / 1024 / 1024)} MB`} 
                  icon={<MemoryIcon />}
                  color="info"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <StatCard 
                  title="Uptime" 
                  value={`${Math.floor((healthData.uptime || 0) / 3600)}h ${Math.floor(((healthData.uptime || 0) % 3600) / 60)}m`} 
                  icon={<SpeedIcon />}
                  color="primary"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <StatCard 
                  title="Status" 
                  value={healthData.status || 'unknown'} 
                  icon={healthData.status === 'healthy' ? <CheckCircleIcon /> : <ErrorIcon />}
                  color={healthData.status === 'healthy' ? 'success' : 'error'}
                />
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        {/* Services Status */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="h6" gutterBottom>Services Status</Typography>
            <Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography component="span">Database</Typography>
                <HealthStatus status={healthData.database === 'ok' ? 'ok' : 'error'} />
              </Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography component="span">File System</Typography>
                <HealthStatus status={healthData.fileSystem === 'ok' ? 'ok' : 'error'} />
              </Box>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography component="span">Environment</Typography>
                <Typography component="span" color="textSecondary">
                  {healthData.environment || 'development'}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>System Health</Typography>
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Typography component="span">Status:</Typography>
                <HealthStatus status={healthData?.status === 'healthy' ? 'ok' : 'error'} />
              </Box>
              <Typography>Last checked: {new Date(healthData?.timestamp).toLocaleString()}</Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
